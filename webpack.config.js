const webpack = require("webpack");
const path = require("path");
const lazPerf = require("laz-perf");
const Dotenv = require("dotenv-webpack");
module.exports = {
  entry: "./src/index.ts",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },
  performance: {
    maxAssetSize: 5000000, // 5MB - バンドルサイズ警告の上限を上げる
    maxEntrypointSize: 5000000,
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
      {
        test: /\.wgsl$/,
        type: "asset/source",
      },
    ],
  },
  devServer: {
    port: 8080,
    static: [
      {
        directory: path.resolve(__dirname, "public"),
        publicPath: "/",
      },
      {
        directory: path.resolve(__dirname, "dataset"),
        publicPath: "/dataset",
      },
    ],
    hot: true,
  },
  mode: "development",
  devtool: "cheap-module-source-map",
  plugins: [
    new Dotenv(),
  ],
};
