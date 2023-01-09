const path = require("path");
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

var config = merge(common, {
  mode: "development",
  devtool: "inline-source-map",
  entry: {
    app: ["webpack/hot/dev-server", "./src/app.tsx"]
  },
  output: {
    filename: "web-opds-client.js",
    publicPath: "http://localhost:8090/dist",
    library: "OPDSWebClient",
    libraryTarget: "umd"
  },
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: ["style-loader", "css-loader", "sass-loader"]
      },
      {
        test: /\.tsx?$/,
        exclude: [/node_modules/],
        use: ["react-hot-loader/webpack", "ts-loader"]
      }
    ]
  },
  devServer: {
    historyApiFallback: true,
    hot: true,
    port: 8090,
    static: {
      directory: path.resolve(__dirname, "build")
    }
  }
});

module.exports = config;
