const webpack = require("webpack");
const path = require("path");
const lazPerf = require("laz-perf");
const Dotenv = require("dotenv-webpack");
module.exports = {
  entry: "./src/index.ts",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "docs"),
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    fallback: {
      fs: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.worker\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: "worker-loader",
          options: {
            esModule: true,
          },
        },
      },
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  devServer: {
    port: 8080,
    static: path.resolve(__dirname, "docs"),
    hot: true,
  },
  mode: "development",
  devtool: "cheap-module-source-map",
  plugins: [
    new Dotenv(),
    // commonjs({ include: /node_modules\/laz-perf/ }),
  ],
};
