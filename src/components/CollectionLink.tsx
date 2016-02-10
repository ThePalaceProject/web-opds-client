import * as React from "react";

export default class CollectionLink extends React.Component<CollectionLinkProps, any> {
  render(): JSX.Element {
    return (
      <a className={this.props.className} href={"?url=" + this.props.url} onClick={this.handleClick.bind(this)}>
        {this.props.text}
      </a>
    );
  }

  handleClick(event) {
    // if any of these keys are pressed, the url is opened by the browser as it pleases
    if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
      return true;
    } else {
      // if not, the url is passed to fetchCollection
      this.props.fetchCollection(this.props.url);
      event.preventDefault();
      return false;
    }
  }
}