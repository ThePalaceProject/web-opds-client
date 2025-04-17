import { expect } from "chai";
import { stub } from "sinon";

import * as React from "react";
import * as PropTypes from "prop-types";
import { shallow } from "enzyme";
import { ReactReduxContext } from "react-redux";

import OPDSCatalog from "../OPDSCatalog";
import Root, { RootProps } from "../Root";
import { mockRouterContext } from "../../__mocks__/routing";
import DataFetcher from "../../DataFetcher";

describe("OPDSCatalog", () => {
  let props = {
    collectionUrl: "collection url",
    bookUrl: "book url",
    proxyUrl: "proxy url",
    navigate: stub(),
    pathFor: (collectionUrl: string, bookUrl: string): string => {
      return "path";
    },
    bookData: {
      id: "book id",
      title: "book title",
      url: "book url"
    },
    pageTitleTemplate: (c, b) => "test title",
    epubReaderUrlTemplate: a => "test reader url"
  };
  let context = mockRouterContext();

  it("passes props to Root", () => {
    let wrapper = shallow(<OPDSCatalog {...props} />, {
      context,
      childContextTypes: {
        router: PropTypes.object,
        pathFor: PropTypes.func
      }
    });
    /**
     * This is painfully fragile, but must be done to make
     * enzyme render the child function beneath ReactReduxContext.Consumer
     */
    const root = wrapper.dive().dive().dive().dive();

    // test that all of the props we passed in are present there
    Object.keys(props).forEach(key => {
      expect(root.props()[key]).to.equal(props[key]);
    });
  });

  it("passes custom DataFetcher to Root", () => {
    const customFetcher = new DataFetcher();
    const propsWithFetcher = {
      ...props,
      fetcher: customFetcher
    };

    const wrapper = mount(<OPDSCatalog {...propsWithFetcher} />, {
      context,
      childContextTypes: {
        router: PropTypes.object,
        pathFor: PropTypes.func
      }
    });

    const root = wrapper.find(Root);

    // Verify that we found exactly one `Root` component.
    expect(root).to.have.length(1);

    // Verify that the fetcher prop is passed to the Root component
    expect(root.props().fetcher).to.equal(customFetcher);
  });
});
