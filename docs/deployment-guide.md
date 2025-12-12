# WebGPU Point Cloud Viewer デプロイメントガイド

このプロジェクトをWeb上で公開するための主要なパターンとステップをまとめます。

---

## パターン1: 静的サイトホスティング（推奨）

### 対象サービス
- **GitHub Pages**（無料、最も簡単）
- **Netlify**（無料プラン有、自動デプロイ）
- **Vercel**（無料プラン有、高速）
- **Cloudflare Pages**（無料、高速CDN）

### メリット
- 無料または低コスト
- セットアップが簡単
- 自動デプロイ対応
- SSL証明書が自動で付与される
- CDN経由で高速配信

### デメリット
- サーバーサイド処理ができない（このプロジェクトは問題なし）
- 大容量データファイルの配信には別途CDN設定が必要

### デプロイステップ

#### 1. ビルド設定の確認
```bash
# package.jsonのビルドスクリプトを確認
npm run build
```

#### 2. ビルド出力ディレクトリの確認
- Webpack/Parcel/Viteなどの設定を確認
- 通常は `dist/` または `build/` ディレクトリ

#### 3. 環境変数の設定
- `.env`ファイルの内容を本番環境用に調整
- COPCファイルパスを公開URL（HTTPSまたはCORS対応サーバー）に変更

#### 4. GitHub Pagesの場合
- リポジトリの Settings → Pages
- Source を `GitHub Actions` または `main branch` に設定
- `.github/workflows/deploy.yml` を作成（GitHub Actions使用時）

#### 5. Netlify/Vercelの場合
- ダッシュボードから「New Site」
- GitHubリポジトリを接続
- ビルドコマンド: `npm run build`
- 公開ディレクトリ: `dist`（または設定に応じて変更）
- 環境変数を設定画面で追加

#### 6. カスタムドメイン設定（オプション）
- DNS設定でCNAMEレコードを追加
- SSL証明書は自動発行

---

## パターン2: クラウドストレージ + CDN

### 対象サービス
- **AWS S3 + CloudFront**
- **Google Cloud Storage + Cloud CDN**
- **Azure Blob Storage + Azure CDN**

### メリット
- 大容量データファイル（COPC/LAS/LAZ）の配信に最適
- 高速なグローバル配信
- カスタムキャッシュ設定が可能
- Range Request対応（COPCに必須）

### デメリット
- 初期設定が複雑
- コストが発生（トラフィック量に応じて）
- AWSやGCPの知識が必要

### デプロイステップ

#### 1. ビルド
```bash
npm run build
```

#### 2. ストレージバケットの作成
- S3/GCS/Azure Storageでバケット作成
- 静的ウェブサイトホスティングを有効化
- CORS設定を追加（Range Request許可）

#### 3. データファイルのアップロード
- COPCファイルを別バケットまたは同じバケットにアップロード
- 適切なContent-Typeを設定
- キャッシュヘッダーを設定

#### 4. CDNの設定
- CloudFront/Cloud CDN/Azure CDNディストリビューションを作成
- オリジンをストレージバケットに設定
- Range Request対応の確認
- SSL証明書の設定

#### 5. .envファイルの更新
- COPC_FILEをCDNのURLに変更

#### 6. デプロイ
- ビルドファイルをバケットにアップロード
- CDNキャッシュをクリア

---

## パターン3: Docker + コンテナホスティング

### 対象サービス
- **AWS ECS / Fargate**
- **Google Cloud Run**
- **Azure Container Instances**
- **Heroku Container Registry**
- **Railway**
- **Fly.io**

### メリット
- 環境の再現性が高い
- スケーラブル
- 複数環境（開発/本番）の管理が容易
- サーバーサイド処理も追加可能

### デメリット
- Docker知識が必要
- 静的サイトには過剰な場合がある
- コストが高め

### デプロイステップ

#### 1. Dockerfileの作成
- マルチステージビルドを使用
- Nginxで静的ファイルを配信

#### 2. docker-compose.ymlの作成（ローカル確認用）

#### 3. ビルドとテスト
```bash
docker build -t webgpu-viewer .
docker run -p 8080:80 webgpu-viewer
```

#### 4. コンテナレジストリにプッシュ
- Docker Hub / AWS ECR / GCR にイメージをプッシュ

#### 5. コンテナサービスにデプロイ
- Cloud Run / ECS / Azure Container Instances でサービス作成
- 環境変数を設定
- ヘルスチェックの設定

#### 6. カスタムドメイン・SSL設定

---

## パターン4: Node.jsサーバー（Express）でホスティング

### 対象サービス
- **Heroku**
- **Railway**
- **Render**
- **AWS Elastic Beanstalk**
- **DigitalOcean App Platform**

### メリット
- サーバーサイドロジック追加可能
- ファイルアップロード機能などを追加しやすい
- WebSocketなどのリアルタイム通信も可能

### デメリット
- 静的サイトには過剰
- メンテナンスコストが高い
- コストが高め

### デプロイステップ

#### 1. Expressサーバーのセットアップ
- `server.js` を作成
- 静的ファイルを配信するミドルウェア設定

#### 2. package.jsonの修正
- `start` スクリプトを追加

#### 3. Procfile作成（Heroku等）

#### 4. 環境変数の設定
- `.env` の内容をサービスの環境変数に設定

#### 5. デプロイ
```bash
# Herokuの場合
heroku create
git push heroku main
```

#### 6. データファイルの配置
- COPCファイルを別CDNにアップロード
- または `/public` ディレクトリに配置

---

## 重要な考慮事項

### 1. WebGPU対応ブラウザ
- Chrome/Edge 113+
- Safari 17+ (macOS Ventura以降)
- 非対応ブラウザ用のフォールバック表示を追加推奨

### 2. CORS設定
- COPCファイルを別サーバーから読み込む場合、CORSヘッダーが必須
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: Range
```

### 3. Range Request対応
- COPCファイルは部分読み込み（HTTP Range Request）が必須
- サーバー/CDNが `Accept-Ranges: bytes` ヘッダーを返す必要あり

### 4. データファイルサイズ
- 大容量COPCファイル（100MB+）はCDN経由配信推奨
- 小規模データ（～10MB）は静的ホスティングでも可

### 5. キャッシュ戦略
- HTMLファイル: キャッシュなし（always fresh）
- JS/CSSファイル: 長期キャッシュ（hash付きファイル名）
- COPCファイル: 中期キャッシュ（1週間～1ヶ月）

### 6. 環境変数の管理
- 本番環境用の `.env.production` を作成
- 機密情報（API key等）は各サービスの環境変数機能を使用
- GitHubに `.env` ファイルをコミットしない（`.gitignore`で除外）

---

## おすすめデプロイパターン

### 小規模プロジェクト（デモ・ポートフォリオ）
→ **GitHub Pages** または **Netlify**
- 無料
- セットアップ簡単
- 小容量COPCファイル（～50MB）を同梱

### 中規模プロジェクト（研究発表・社内ツール）
→ **Vercel** または **Cloudflare Pages**
- 高速CDN
- 自動デプロイ
- カスタムドメイン無料

### 大規模プロジェクト（商用・大容量データ）
→ **AWS S3 + CloudFront** または **GCS + Cloud CDN**
- 大容量データファイル配信
- グローバル高速配信
- スケーラブル

### 追加機能が必要な場合（認証・DB等）
→ **Docker + Cloud Run** または **Railway**
- サーバーサイド処理可能
- 拡張性が高い

---

## 次のステップ

1. デプロイパターンを選択
2. COPCファイルの配置場所を決定（同じサーバーor別CDN）
3. `.env.production` を作成してファイルパスを本番URLに変更
4. ビルド設定を確認
5. テストデプロイ
6. カスタムドメイン設定（オプション）
7. アクセス解析・モニタリング設定（オプション）

---

## 参考リンク

- [WebGPU Browser Support](https://caniuse.com/webgpu)
- [GitHub Pages Documentation](https://docs.github.com/pages)
- [Netlify Documentation](https://docs.netlify.com/)
- [Vercel Documentation](https://vercel.com/docs)
- [AWS S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [COPC Specification](https://copc.io/)
