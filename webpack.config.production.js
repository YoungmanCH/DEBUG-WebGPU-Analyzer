const webpack = require("webpack");
const path = require("path");
const Dotenv = require("dotenv-webpack");

module.exports = {
  entry: "./src/index.ts",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
    // GitHub Pagesでリポジトリ名がパスに含まれる場合は以下を設定
    // 例: https://username.github.io/DEBUG-WebGPU-Analyzer/
    // カスタムドメインやユーザーページ（username.github.io）の場合は "/" に変更
    publicPath: process.env.PUBLIC_PATH || "/DEBUG-WebGPU-Analyzer/",
  },
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },
  performance: {
    maxAssetSize: 5000000, // 5MB
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
  mode: "production",
  devtool: "source-map",
  plugins: [
    new Dotenv({
      path: "./.env.production",
      safe: false,
      systemvars: true,
      defaults: "./.env",
    }),
  ],
};
