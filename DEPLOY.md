# GitHub Pages デプロイ クイックスタート

このプロジェクトをGitHub Pagesで公開するための最小限の手順です。

## 簡単3ステップ

### 1. GitHub Pagesを有効化

GitHubリポジトリの設定で GitHub Pages を有効化します:

1. リポジトリページの **Settings** → **Pages** に移動
2. **Source** で **GitHub Actions** を選択
3. 保存

### 2. mainブランチにプッシュ

```bash
git add .
git commit -m "Setup GitHub Pages deployment"
git push origin main
```

### 3. デプロイ完了を待つ

- **Actions** タブでデプロイ状況を確認
- 完了後、`https://YourgithubUsername.github.io/DEBUG-WebGPU-Analyzer/` でアクセス可能

## 設定ファイル

以下のファイルが自動デプロイ用に作成されています:

- `.github/workflows/deploy.yml` - GitHub Actionsワークフロー
- `webpack.config.production.js` - 本番ビルド設定
- `.env.production` - 本番環境用の環境変数

## カスタマイズ

### データファイルの変更

`.env.production` でCOPCファイルのURLを変更:

```env
# 外部CDNを使用（推奨）
COPC_FILE=https://your-cdn.example.com/file.copc.laz

# または GitHub Pagesで配信（小規模データのみ）
COPC_FILE=/DEBUG-WebGPU-Analyzer/dataset/output/file.copc.laz
```

### リポジトリ名の変更

リポジトリ名が異なる場合、`webpack.config.production.js` を編集:

```javascript
publicPath: "/your-repo-name/"
```

## 詳細ガイド

詳しい設定方法、トラブルシューティングは以下を参照:

- [GitHub Pages デプロイ設定ガイド](./docs/github-pages-setup.md) - 詳細な手順
- [デプロイメントガイド](./docs/deployment-guide.md) - 全デプロイオプション

## 必要な環境

- Node.js 18以上
- WebGPU対応ブラウザ（Chrome/Edge 113+、Safari 17+）

## トラブルシューティング

**ページが真っ白:**
- ブラウザのデベロッパーツールでConsoleエラーを確認
- `webpack.config.production.js` の `publicPath` が正しいか確認

**COPCファイルが読み込めない:**
- `.env.production` のファイルパスが正しいか確認
- CORSエラーの場合、CORS対応サーバーを使用

詳細は [GitHub Pages デプロイ設定ガイド](./docs/github-pages-setup.md) を参照してください。
