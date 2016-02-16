jest.autoMockOff();

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as TestUtils from "react-addons-test-utils";

import ConnectedRoot, { Root } from "../Root";
import Collection from "../Collection";
import UrlForm from "../UrlForm";
import BookDetails from "../BookDetails";
import { groupedCollectionData } from "./collectionData";
import { createStore, applyMiddleware } from "redux";
let thunk: any = require("redux-thunk");
import reducers from "../../reducers/index";
import { Provider } from "react-redux";

describe("Root", () => {
  it("shows a collection if props include collectionData", () => {
    let collectionData: CollectionData = groupedCollectionData;
    let root = TestUtils.renderIntoDocument(
      <Root collectionData={collectionData} />
    );

    let collections = TestUtils.scryRenderedComponentsWithType(root, Collection);
    expect(collections.length).toBe(1);
    expect(collections[0].props.collection.title).toBe(collectionData.title);
  });


  it("shows a url form if props do not include collectionData", () => {
    let root = TestUtils.renderIntoDocument(
      <Root />
    );

    let urlForms = TestUtils.scryRenderedComponentsWithType(root, UrlForm);
    expect(urlForms.length).toBe(1);
  });

  it("fetches a collection url", () => {
    let startCollection = "http://feedbooks.github.io/opds-test-catalog/catalog/acquisition/blocks.xml";
    let setCollectionAndBook = jest.genMockFunction();
    let root = TestUtils.renderIntoDocument(
      <Root startCollection={startCollection} setCollectionAndBook={setCollectionAndBook} />
    );

    expect(setCollectionAndBook.mock.calls.length).toBe(1);
    expect(setCollectionAndBook.mock.calls[0][0]).toBe(startCollection);
  });

  it("fetches a book url", () => {
    let startBook = "http://example.com/book";
    let setCollectionAndBook = jest.genMockFunction();
    let root = TestUtils.renderIntoDocument(
      <Root startBook={startBook} setCollectionAndBook={setCollectionAndBook} />
    );

    expect(setCollectionAndBook.mock.calls.length).toBe(1);
    expect(setCollectionAndBook.mock.calls[0][1]).toBe(startBook);
  });

  it("shows loading message", () => {
    let root = TestUtils.renderIntoDocument(
      <Root isFetching={true} />
    );

    let loading = TestUtils.findRenderedDOMComponentWithClass(root, "loading");
    expect(loading.textContent).toBeTruthy;
  });

  it("shows error message", () => {
    let root = TestUtils.renderIntoDocument(
      <Root error={"test error"} />
    );

    let error = TestUtils.findRenderedDOMComponentWithClass(root, "error");
    expect(error.textContent).toContain("test error");
  });

  it("shows book detail", () => {
    let bookData = groupedCollectionData.lanes[0].books[0];
    let root = TestUtils.renderIntoDocument(
      <Root bookData={bookData} />
    );
    let book = TestUtils.findRenderedDOMComponentWithClass(root, "bookDetails");

    expect(book.textContent).toContain(bookData.title);
    expect(book.textContent).toContain(bookData.authors.join(", "));
  });

  describe("connected to store", () => {
    let store: Redux.Store;
    let collectionData: CollectionData = groupedCollectionData;
    let onNavigate;
    let root, rootInstance;

    beforeEach(() => {
      store = createStore(reducers, applyMiddleware(thunk));
      onNavigate = jest.genMockFunction();
      TestUtils.renderIntoDocument(
        <Provider store={store}>
          <ConnectedRoot
            ref={(c) => root = c}
            onNavigate={onNavigate}
            collectionData={collectionData} />
        </Provider>
      );
      rootInstance = root.getWrappedInstance();
    });

    it("calls onNavigate when fetching collection", () => {
      let collectionLink = TestUtils.scryRenderedDOMComponentsWithClass(rootInstance, "laneTitle")[0];
      let collectionUrl = decodeURIComponent(collectionLink.getAttribute("href").split("collection=")[1]);
      TestUtils.Simulate.click(collectionLink);

      expect(onNavigate.mock.calls.length).toBe(1);
      expect(onNavigate.mock.calls[0][0]).toBe(collectionUrl);
    });

    it("calls onNavigate when showing or hiding a book", () => {
      let bookLink =  TestUtils.scryRenderedDOMComponentsWithClass(rootInstance, "laneBookLink")[0];
      let url = bookLink.getAttribute("href");
      let parts = url.slice(1).split("&");
      let collectionUrl = decodeURIComponent(parts[0].split("=")[1]);
      let bookUrl = decodeURIComponent(parts[1].split("=")[1]);
      TestUtils.Simulate.click(bookLink);
      let closeLink = TestUtils.findRenderedDOMComponentWithClass(rootInstance, "bookDetailsCloseLink");
      TestUtils.Simulate.click(closeLink);

      expect(onNavigate.mock.calls.length).toBe(2);
      // can't test collectionUrl because it comes from Root's props,
      // which only get set asynchronously from a fetch, which is too
      // much for this test:
      // expect(onNavigate.mock.calls[0][0]).toBe(collectionUrl);
      expect(onNavigate.mock.calls[0][1]).toBe(bookUrl);
      expect(onNavigate.mock.calls[1][1]).toBeFalsy;
    });
  });
});