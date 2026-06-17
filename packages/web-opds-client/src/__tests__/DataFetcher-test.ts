import { expect } from "chai";
import { stub } from "sinon";
const fetchMock = require("fetch-mock");

import DataFetcher from "../DataFetcher";
import { NavigationFeed, AcquisitionFeed } from "opds-feed-parser";
const Cookie = require("js-cookie");

describe("DataFetcher", () => {
  const adapter = (data, url) => "adapter";
  describe("fetch()", () => {
    beforeEach(() => {
      fetchMock.mock("test-url", 200).mock("http://example.com", 200);
    });

    afterEach(() => {
      fetchMock.restore();
    });

    it("uses fetch()", () => {
      let options: RequestInit = {
        method: "POST",
        body: "test",
        credentials: "same-origin"
      };
      let fetcher = new DataFetcher({ adapter });
      fetcher.fetch("test-url", options);
      let fetchArgs = fetchMock.calls();

      expect(fetchMock.called()).to.equal(true);
      expect(fetchArgs[0][0]).to.equal("/test-url");
      expect(fetchArgs[0][1]).to.deep.equal({
        ...options,
        headers: { "X-Requested-With": "XMLHttpRequest", Authorization: "" }
      });
    });

    it("sends credentials by default", () => {
      let options = {
        method: "POST",
        data: { test: "test" }
      };
      let fetcher = new DataFetcher({ adapter });
      fetcher.fetch("test-url", options);
      let fetchArgs = fetchMock.calls();

      expect(fetchMock.called()).to.equal(true);
      expect(fetchArgs[0][0]).to.equal("/test-url");
      expect(fetchArgs[0][1]).to.deep.equal({
        credentials: "same-origin",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Authorization: ""
        },
        ...options
      });
    });

    it("uses proxy url if provided", () => {
      class MockFormData {
        data: any;

        constructor() {
          this.data = {};
        }

        append(key, val) {
          this.data[key] = val;
        }

        get(key) {
          return { value: this.data[key] };
        }

        apply() {
          return;
        }
      }

      let formDataStub = stub(window, "FormData").callsFake(
        () => new MockFormData()
      );

      let proxyUrl = "http://example.com";
      let fetcher = new DataFetcher({ proxyUrl, adapter });
      fetcher.fetch("test-url");
      let fetchArgs = fetchMock.calls();

      expect(fetchMock.called()).to.equal(true);
      expect(fetchArgs[0][0]).to.equal(`${proxyUrl}/`);
      expect(fetchArgs[0][1].method).to.equal("POST");
      expect(fetchArgs[0][1].body.get("url").value).to.equal("test-url");

      formDataStub.restore();
    });

    it("prepares auth headers", () => {
      let fetcher = new DataFetcher({ adapter });
      let credentials = { provider: "test", credentials: "credentials" };
      fetcher.getAuthCredentials = () => credentials;
      fetcher.fetch("test-url");
      let fetchArgs = fetchMock.calls();
      expect(fetchArgs[0][1].headers["Authorization"]).to.equal("credentials");
    });
  });

  describe("Auth Credentials", () => {
    it("doesn't set auth credentials if there are none", () => {
      let fetcher = new DataFetcher({ adapter });
      fetcher.setAuthCredentials(undefined);
      expect(Cookie.get(fetcher.authKey)).to.deep.equal(undefined);
    });

    it("sets auth credentials", () => {
      let fetcher = new DataFetcher({ adapter });
      let credentials = { provider: "test", credentials: "credentials" };
      fetcher.setAuthCredentials(credentials);
      expect(Cookie.get(fetcher.authKey)).to.deep.equal(
        JSON.stringify(credentials)
      );
    });

    it("gets auth credentials", () => {
      let fetcher = new DataFetcher({ adapter });
      let credentials = { provider: "test", credentials: "credentials" };
      Cookie.set(fetcher.authKey, JSON.stringify(credentials));
      expect(fetcher.getAuthCredentials()).to.deep.equal(credentials);
    });

    it("clears auth credentials", () => {
      let fetcher = new DataFetcher({ adapter });
      let credentials = { provider: "test", credentials: "credentials" };
      Cookie.set(fetcher.authKey, JSON.stringify(credentials));
      fetcher.clearAuthCredentials();
      expect(Cookie.get(fetcher.authKey)).to.equal(undefined);
    });
  });

  describe("fetchOPDSData()", () => {
    it("rejects and returns an error if the adapter isn't configured", async () => {
      let fetcher = new DataFetcher();

      // No need to mock a fetch response since it should not reach that point.
      await fetcher.fetchOPDSData("test-url").catch(err => {
        expect(err.status).to.equal(null);
        expect(err.response).to.equal(
          "No adapter has been configured in DataFetcher."
        );
        expect(err.url).to.equal("test-url");
      });
    });

    it("throws error if response isn't 200", async () => {
      fetchMock.mock("test-url", { status: 401, body: "unauthorized" });

      let fetcher = new DataFetcher({ adapter });
      await fetcher.fetchOPDSData("test-url").catch(err => {
        expect(err.status).to.equal(401);
        expect(err.response).to.equal("unauthorized");
        expect(err.url).to.equal("test-url");
      });

      fetchMock.restore();
    });

    it("throws an error if the response is not OPDS", async () => {
      fetchMock.mock("test-url", { status: 200, body: "not OPDS" });

      let fetcher = new DataFetcher({ adapter });
      await fetcher.fetchOPDSData("test-url").catch(err => {
        expect(err.status).to.equal(null);
        expect(err.response).to.equal("Failed to parse OPDS data");
        expect(err.url).to.equal("test-url");
      });

      fetchMock.restore();
    });

    it("throws an error on a bad call", async () => {
      fetchMock.mock("test-url", { status: 500, body: "nope" });

      let fetcher = new DataFetcher({ adapter });
      await fetcher.fetchOPDSData("test-url").catch(err => {
        expect(err.response).to.equal("nope");
      });

      fetchMock.restore();
    });
  });

  describe("applyDeclaredFeedType()", () => {
    // A feed whose only entry has no acquisition link. The OPDS parser
    // classifies this as a navigation feed — the situation that arises for a
    // library with no patron authentication configured, where the Circulation
    // Manager omits borrow links.
    const feedParsedAsNavigation = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>http://example.com/feed</id>
  <title>Test Feed</title>
  <updated>2020-01-01T00:00:00Z</updated>
  <entry>
    <id>urn:test:1</id>
    <title>Book One</title>
    <updated>2020-01-01T00:00:00Z</updated>
    <link href="http://example.com/image.jpg" rel="http://opds-spec.org/image/thumbnail" type="image/jpeg"/>
  </entry>
</feed>`;

    // A feed whose only entry has an acquisition link. The OPDS parser
    // classifies this as an acquisition feed.
    const feedParsedAsAcquisition = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>http://example.com/feed</id>
  <title>Test Feed</title>
  <updated>2020-01-01T00:00:00Z</updated>
  <entry>
    <id>urn:test:1</id>
    <title>Book One</title>
    <updated>2020-01-01T00:00:00Z</updated>
    <link href="http://example.com/borrow" rel="http://opds-spec.org/acquisition/borrow" type="application/atom+xml;type=entry;profile=opds-catalog"/>
  </entry>
</feed>`;

    const feedTypeAdapter = data =>
      data instanceof AcquisitionFeed
        ? "acquisition"
        : data instanceof NavigationFeed
        ? "navigation"
        : "other";

    const fetchFeedType = async (body, contentType) => {
      fetchMock.mock("test-url", {
        status: 200,
        body,
        headers: contentType ? { "Content-Type": contentType } : {}
      });
      let fetcher = new DataFetcher({ adapter: feedTypeAdapter });
      return fetcher.fetchOPDSData("test-url");
    };

    afterEach(() => {
      fetchMock.restore();
    });

    it("uses the acquisition feed type when the content type declares kind=acquisition", async () => {
      const result = await fetchFeedType(
        feedParsedAsNavigation,
        "application/atom+xml;profile=opds-catalog;kind=acquisition"
      );
      expect(result).to.equal("acquisition");
    });

    it("uses the navigation feed type when the content type declares kind=navigation", async () => {
      const result = await fetchFeedType(
        feedParsedAsAcquisition,
        "application/atom+xml;profile=opds-catalog;kind=navigation"
      );
      expect(result).to.equal("navigation");
    });

    it("falls back to the parser's navigation classification when no kind is declared", async () => {
      const result = await fetchFeedType(
        feedParsedAsNavigation,
        "application/atom+xml"
      );
      expect(result).to.equal("navigation");
    });

    it("falls back to the parser's acquisition classification when no kind is declared", async () => {
      const result = await fetchFeedType(
        feedParsedAsAcquisition,
        "application/atom+xml"
      );
      expect(result).to.equal("acquisition");
    });
  });
});
