import OPDSParser, {
  OPDSFeed,
  OPDSEntry,
  NavigationFeed,
  AcquisitionFeed
} from "opds-feed-parser";
import OpenSearchDescriptionParser from "./OpenSearchDescriptionParser";
import { AuthCredentials } from "./interfaces";
import { safeParse } from "fast-content-type-parse";
const Cookie = require("js-cookie");
require("isomorphic-fetch");

export interface RequestError {
  status: number | null;
  response: string;
  url: string;
  headers?: any;
}

export interface RequestRejector {
  (err: RequestError): any;
}

export interface DataFetcherConfig {
  /** If `proxyUrl` is provided, requests will be posted to the proxy url instead
      of the original url, to get around CORS restrictions. The proxy server should
      get the original url out of the form data, make the request, and return
      the response. */
  proxyUrl?: string;

  /** Function to convert OPDS data to an internal format needed by the application. */
  adapter?: (data: OPDSFeed | OPDSEntry, url: string) => any;
}

/** Handles requests to OPDS servers. */
export default class DataFetcher {
  public authKey: string;
  private proxyUrl?: string;
  private adapter?: (data: OPDSFeed | OPDSEntry, url: string) => any;

  constructor(config: DataFetcherConfig = {}) {
    this.proxyUrl = config.proxyUrl;
    this.adapter = config.adapter;
    this.authKey = "authCredentials";
  }

  fetchOPDSData(url: string) {
    let parser = new OPDSParser();
    if (!this.adapter) {
      return Promise.reject({
        status: null,
        response: "No adapter has been configured in DataFetcher.",
        url
      });
    }

    return new Promise((resolve, reject: RequestRejector) => {
      this.fetch(url)
        .then(response => {
          response
            .text()
            .then(text => {
              if (this.isErrorCode(response.status)) {
                reject({
                  status: response.status,
                  response: text,
                  url: url,
                  headers: response.headers
                });
              }

              parser
                .parse(text)
                .then((parsedData: OPDSFeed | OPDSEntry) => {
                  resolve(
                    this.adapter?.(
                      this.applyDeclaredFeedType(parsedData, response),
                      url
                    )
                  );
                })
                .catch(err => {
                  reject({
                    status: null,
                    response: "Failed to parse OPDS data",
                    url: url
                  });
                });
            })
            .catch(error => {
              reject({
                status: response.status,
                response: error.message,
                url: url,
                headers: response.headers
              });
            });
        })
        .catch(error => reject(error));
    });
  }

  /**
   * Determine a feed's type from the `kind` the server declares in the response
   * content type (`kind=acquisition` or `kind=navigation`) rather than from
   * opds-feed-parser's structural guess.
   *
   * The parser only sees the feed body, so it classifies a document as an
   * acquisition feed when *every* entry has an acquisition link and otherwise
   * falls back to a navigation feed. That heuristic misfires for valid
   * acquisition feeds whose entries legitimately have no acquisition links — for
   * instance a library with no patron authentication, where the Circulation
   * Manager omits borrow links — so their books would render as navigation links
   * instead of books with cover images.
   *
   * The content type is the authoritative, spec-defined source of the feed kind,
   * so we trust it when present and fall back to the parser's classification only
   * when no kind is declared. NavigationFeed and AcquisitionFeed share the same
   * shape, so re-wrapping only changes the type the adapter keys off of.
   */
  applyDeclaredFeedType(
    parsedData: OPDSFeed | OPDSEntry,
    response: Response
  ): OPDSFeed | OPDSEntry {
    // Only feeds have a kind; entry documents are returned unchanged.
    if (!(parsedData instanceof OPDSFeed)) {
      return parsedData;
    }

    const header = response.headers.get("content-type") ?? "";
    const kind = safeParse(header).parameters.kind?.toLowerCase();

    if (kind === "acquisition" && !(parsedData instanceof AcquisitionFeed)) {
      return new AcquisitionFeed({ ...parsedData });
    }
    if (kind === "navigation" && !(parsedData instanceof NavigationFeed)) {
      return new NavigationFeed({ ...parsedData });
    }
    return parsedData;
  }

  fetchSearchDescriptionData(searchDescriptionUrl: string) {
    let parser = new OpenSearchDescriptionParser();

    return new Promise((resolve, reject: RequestRejector) => {
      this.fetch(searchDescriptionUrl)
        .then(response => {
          response.text().then(text => {
            if (this.isErrorCode(response.status)) {
              reject({
                status: response.status,
                response: text,
                url: searchDescriptionUrl
              });
            }

            parser
              .parse(text, searchDescriptionUrl)
              .then(openSearchDescription => {
                resolve(openSearchDescription);
              })
              .catch(err => {
                reject({
                  status: null,
                  response: "Failed to parse OPDS data",
                  url: searchDescriptionUrl
                });
              });
          });
        })
        .catch(reject);
    });
  }

  fetch(url: string, options: RequestInit = {}): Promise<Response> {
    options = Object.assign({ credentials: "same-origin" }, options);

    if (this.proxyUrl) {
      let formData = new (window as any).FormData();
      formData.append("url", url);
      Object.assign(options, {
        method: "POST",
        body: formData
      });
      url = this.proxyUrl;
    }

    options["headers"] = this.prepareAuthHeaders(options["headers"]);

    return fetch(url, options);
  }

  setAuthCredentials(credentials?: AuthCredentials): void {
    if (credentials) {
      Cookie.set(this.authKey, JSON.stringify(credentials));
    }
  }

  getAuthCredentials(): AuthCredentials | undefined {
    let credentials = Cookie.get(this.authKey);
    if (credentials) {
      return JSON.parse(credentials);
    }
  }

  clearAuthCredentials(): void {
    Cookie.remove(this.authKey);
  }

  prepareAuthHeaders(headers: any = {}): any {
    const credentials = this.getAuthCredentials();
    return {
      Authorization: credentials?.credentials ?? "",
      // server needs to know request came from JS in order to omit
      // 'Www-Authenticate: Basic' header, which triggers browser's
      // ugly basic auth popup
      "X-Requested-With": "XMLHttpRequest",
      // if we set an Authorization header already
      // it should overwrite the one from this function
      ...headers
    };
  }

  isErrorCode(status: number) {
    return status < 200 || status >= 400;
  }
}
