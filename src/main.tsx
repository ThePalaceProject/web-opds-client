/// <reference path='../typings/tsd.d.ts'/>

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Root from './components/Root';
import OPDSParser = require("opds-feed-parser");
import { feedToCollection } from "./OPDSDataAdapter";

let parser = new OPDSParser.default();

var httpRequest = new XMLHttpRequest();
httpRequest.onreadystatechange = () => {
  if (httpRequest.readyState === XMLHttpRequest.DONE) {
    if (httpRequest.status === 200) {
      let response = httpRequest.responseText;
      let promise = parser.parse(response);
      promise.then((opdsFeed) => {
        let collectionData = feedToCollection(opdsFeed);

        ReactDOM.render(
          <Root {...collectionData} />,
          document.getElementById("opds-browser")
        );
      });
    }
  }
}
httpRequest.open('GET', "http://feedbooks.github.io/opds-test-catalog/catalog/acquisition/main.xml")
httpRequest.send();

