# GitHub Pagesデプロイ設定ガイド

このプロジェクトをGitHub Pagesで公開するための手順です。

## 前提条件

- GitHubアカウントを持っていること
- このリポジトリをGitHubにプッシュ済みであること
- Node.js 18以上がインストールされていること

## セットアップ手順

### 1. GitHub Pagesを有効化

1. GitHubのリポジトリページにアクセス
2. **Settings** タブをクリック
3. 左サイドバーの **Pages** をクリック
4. **Source** セクションで **GitHub Actions** を選択

![GitHub Pages Settings](https://docs.github.com/assets/cb-47267/mw-1440/images/help/pages/publishing-source-drop-down.webp)

### 2. 環境設定の確認

#### `.env.production` ファイルの確認

本番環境用の設定ファイル `.env.production` が作成されています。

**重要な設定項目:**

```env
# COPCファイルのURL
COPC_FILE=https://media.githubusercontent.com/media/sceneserver/copc/main/naarden-vesting.copc.laz
```

**データファイルの配置オプション:**

##### オプション1: 外部CDNを使用（推奨）

大容量ファイル（100MB以上）の場合、外部CDNやストレージサービスを使用します。

- GitHub LFS + GitHub Media
- AWS S3 + CloudFront
- その他のCORS対応サーバー

`.env.production` でCOPCファイルのURLを外部URLに設定:

```env
COPC_FILE=https://your-cdn.example.com/path/to/file.copc.laz
```

##### オプション2: GitHub Pagesで配信

小規模データ（10-50MB程度）の場合、GitHub Pagesで直接配信できます。

1. `.github/workflows/deploy.yml` の以下のコメントを解除:

```yaml
# オプション: datasetディレクトリをコピー（小規模データの場合）
- name: Copy dataset to dist
  run: |
    if [ -d "dataset" ]; then
      mkdir -p dist/dataset
      cp -r dataset/* dist/dataset/
    fi
```

2. `.env.production` でCOPCファイルのパスを設定:

```env
COPC_FILE=/DEBUG-WebGPU-Analyzer/dataset/output/your-file.copc.laz
```

**注意:** リポジトリ名（`DEBUG-WebGPU-Analyzer`）をパスに含める必要があります。

##### オプション3: Git LFSを使用

大容量ファイルをGit LFSで管理する場合:

1. Git LFSをインストール:

```bash
git lfs install
```

2. LFSで追跡するファイルタイプを設定:

```bash
git lfs track "*.copc.laz"
git lfs track "*.las"
git lfs track "*.laz"
```

3. ファイルをコミット:

```bash
git add .gitattributes
git add dataset/
git commit -m "Add dataset files with LFS"
git push
```

4. GitHub Media URLを使用:

```env
COPC_FILE=https://media.githubusercontent.com/media/YoungmanCH/DEBUG-WebGPU-Analyzer/main/dataset/output/your-file.copc.laz
```

### 3. publicPath の設定確認

`webpack.config.production.js` の `publicPath` を確認:

```javascript
output: {
  filename: "bundle.js",
  path: path.resolve(__dirname, "dist"),
  publicPath: "/DEBUG-WebGPU-Analyzer/",
}
```

**リポジトリ名に応じて変更が必要な場合:**

- ユーザーページ（`username.github.io`）の場合: `publicPath: "/"`
- カスタムドメインを使用する場合: `publicPath: "/"`
- リポジトリページの場合: `publicPath: "/リポジトリ名/"`

### 4. ローカルで本番ビルドをテスト

デプロイ前にローカルでビルドが成功することを確認:

```bash
npm run build:prod
```

ビルドが成功すると、`dist/` ディレクトリに以下が生成されます:

- `bundle.js` - メインJSバンドル
- `bundle.js.map` - ソースマップ
- その他の必要なファイル

### 5. デプロイ

#### 自動デプロイ（推奨）

`main` ブランチにプッシュすると自動的にデプロイされます:

```bash
git add .
git commit -m "Setup GitHub Pages deployment"
git push origin main
```

#### 手動デプロイ

GitHubリポジトリページで:

1. **Actions** タブをクリック
2. **Deploy to GitHub Pages** ワークフローを選択
3. **Run workflow** ボタンをクリック
4. **Run workflow** を確認

### 6. デプロイ状況の確認

1. **Actions** タブで進行状況を確認
2. ワークフローが成功すると、緑色のチェックマークが表示されます
3. エラーが発生した場合、ログを確認して原因を特定

### 7. サイトにアクセス

デプロイが完了したら、以下のURLでアクセスできます:

```
https://YoungmanCH.github.io/DEBUG-WebGPU-Analyzer/
```

（`YoungmanCH` と `DEBUG-WebGPU-Analyzer` は実際のユーザー名とリポジトリ名に置き換えてください）

## トラブルシューティング

### ビルドが失敗する

**症状:** GitHub Actionsでビルドが失敗する

**解決策:**

1. ローカルで `npm run build:prod` を実行して、エラーを確認
2. `package.json` の依存関係が正しいか確認
3. Node.jsのバージョンが一致しているか確認（`.github/workflows/deploy.yml` の `node-version`）

### ページが真っ白

**症状:** デプロイは成功したが、ページが真っ白

**原因と解決策:**

1. **publicPathが間違っている**
   - `webpack.config.production.js` の `publicPath` をリポジトリ名に合わせる
   - ブラウザのデベロッパーツールのConsoleで404エラーを確認

2. **index.htmlがコピーされていない**
   - `.github/workflows/deploy.yml` で `public/index.html` がコピーされているか確認

3. **bundle.jsが読み込めない**
   - ブラウザのNetworkタブで `bundle.js` の読み込みを確認
   - パスが正しいか確認

### COPC ファイルが読み込めない

**症状:** CORSエラーまたは404エラー

**原因と解決策:**

1. **CORS エラー**
   - 外部サーバーがCORSヘッダーを返していない
   - GitHub Media URL、S3（CORS設定済み）などCORS対応サーバーを使用

2. **404 エラー**
   - ファイルパスが間違っている
   - `.env.production` のパスを確認
   - GitHub Pagesでdatasetを配信する場合、リポジトリ名をパスに含める

3. **Range Request 非対応**
   - COPCファイルは部分読み込み（Range Request）が必須
   - サーバーが `Accept-Ranges: bytes` ヘッダーを返すことを確認

### WebGPU が動作しない

**症状:** "WebGPU is not supported" エラー

**原因と解決策:**

1. **ブラウザが対応していない**
   - Chrome/Edge 113以上を使用
   - Safari 17以上（macOS Ventura以降）を使用

2. **HTTPSでない**
   - WebGPUはHTTPS環境でのみ動作
   - GitHub PagesはデフォルトでHTTPS対応

## カスタムドメインの設定（オプション）

独自ドメインを使用する場合:

1. DNSプロバイダーでCNAMEレコードを設定:
   ```
   your-domain.com → YoungmanCH.github.io
   ```

2. GitHubリポジトリの Settings → Pages で **Custom domain** を設定

3. `webpack.config.production.js` の `publicPath` を変更:
   ```javascript
   publicPath: "/"
   ```

4. 再ビルド・再デプロイ

## 本番環境でのデバッグ

デプロイ後にエラーが発生した場合、ブラウザのデベロッパーツールを使用:

1. **Console タブ**: JavaScriptエラーを確認
2. **Network タブ**: ファイルの読み込み状況、CORSエラーを確認
3. **Source タブ**: ソースマップを使用してデバッグ

## まとめ

GitHub Pagesでのデプロイの流れ:

1. `.env.production` でCOPCファイルのURLを設定
2. GitHub PagesをGitHub Actionsに設定
3. `main` ブランチにプッシュ
4. 自動デプロイが実行される
5. `https://username.github.io/repo-name/` でアクセス

問題が発生した場合は、このドキュメントのトラブルシューティングセクションを参照してください。

## 参考リンク

- [GitHub Pages Documentation](https://docs.github.com/pages)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Git LFS Documentation](https://git-lfs.github.com/)
- [WebGPU Browser Support](https://caniuse.com/webgpu)
- [COPC Specification](https://copc.io/)
