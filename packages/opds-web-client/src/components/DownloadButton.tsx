import * as React from "react";
import download from "./download";
import { useActions } from "./context/ActionsContext";

export interface DownloadButtonProps extends React.HTMLProps<{}> {
  url: string;
  mimeType: string;
  isPlainLink?: boolean;
  title?: string;
  indirectType?: string;
}

const DownloadButton: React.FC<DownloadButtonProps> = props => {
  const {
    ref,
    url,
    mimeType,
    isPlainLink,
    indirectType,
    title,
    type,
    ...elementProps
  } = props;
  const { actions, dispatch } = useActions();
  const fulfill = () => {
    let dispatchFn;
    let action;
    if (isIndirect()) {
      action = actions.indirectFulfillBook(url, indirectType);
      dispatchFn = dispatch(action).then(url => {
        window.open(url, "_blank");
      });
    } else {
      // TODO: use mimeType variable once we fix the link type in our
      // OPDS entries
      action = actions.fulfillBook(url);
      dispatchFn = dispatch(action).then(blob => {
        download(blob, generateFilename(title), mimeTypeFn());
      });
    }
    return dispatchFn;
  };
  const isIndirect = () =>
    indirectType &&
    mimeType === "application/atom+xml;type=entry;profile=opds-catalog";
  const generateFilename = (str: string): string =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + fileExtension();
  const mimeTypeFn = () =>
    mimeType === "vnd.adobe/adept+xml"
      ? "application/vnd.adobe.adept+xml"
      : mimeType;
  const fileExtension = () =>
    ({
      "application/epub+zip": ".epub",
      "application/pdf": ".pdf",
      "application/vnd.adobe.adept+xml": ".acsm",
      "application/x-mobipocket-ebook": ".mobi"
    }[mimeTypeFn()] || "");
  const downloadLabel = () => {
    if (
      indirectType ===
      "text/html;profile=http://librarysimplified.org/terms/profiles/streaming-media"
    ) {
      return "Read Online";
    }
    let type = fileExtension()
      .replace(".", "")
      .toUpperCase();
    return `Download${type ? " " + type : ""}`;
  };
  let downloadProps = {
    className: "btn btn-default download-button",
    ...elementProps
  };
  if (isPlainLink) {
    downloadProps["href"] = url;
    downloadProps["target"] = "_blank";
  } else {
    downloadProps["onClick"] = fulfill;
    downloadProps["className"] =
      `${downloadProps["className"]} ` +
      `download-${fileExtension().slice(1)}-button`;
  }

  return (
    <span>
      {React.createElement(
        isPlainLink ? "a" : "button",
        downloadProps,
        downloadLabel()
      )}
    </span>
  );
};

export default DownloadButton;
