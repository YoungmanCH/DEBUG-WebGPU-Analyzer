# ファイル読み込み設定ガイド

**最終更新日**: 2025-10-10

このドキュメントでは、DEBUG-WebGPU-Analyzerで点群ファイルを読み込むための設定方法について説明します。

---

## 📋 目次

- [概要](#概要)
- [設定ファイルの構成](#設定ファイルの構成)
- [ファイル読み込みの仕組み](#ファイル読み込みの仕組み)
- [設定手順](#設定手順)
- [トラブルシューティング](#トラブルシューティング)
- [よくある質問](#よくある質問)

---

## 概要

DEBUG-WebGPU-Analyzerでは、以下の2つの方法でファイル読み込みを設定します：

1. **`.env` ファイル** - ファイルパスを環境変数として定義
2. **`src/index.ts`** - 読み込むファイル形式を選択

---

## 設定ファイルの構成

### ファイル構成図

```
DEBUG-WebGPU-Analyzer/
├── .env                        # 環境変数設定ファイル（Git除外）
├── .env.example               # 環境変数のサンプル（Git管理対象）
├── src/
│   ├── configs.ts             # 環境変数の読み込み
│   └── index.ts               # ファイルローダーの選択
└── dataset/                   # 点群データ配置場所
    ├── copc/
    ├── las/
    ├── laz/
    ├── xyz/
    └── tif/
```

---

## ファイル読み込みの仕組み

### 1. 環境変数の定義 (`.env`)

`.env` ファイルで各フォーマットのファイルパスを定義します。

```bash
# .env
COPC_FILE="https://example.com/sample.copc.laz"
LAS_FILES="dataset/las/sample.las"
LAZ_FILES="dataset/laz/sample.laz"
XYZ_FILES="dataset/xyz/sample.xyz"
TIF_FIlES="dataset/tif/sample.tif"
```

### 2. 環境変数の読み込み (`src/configs.ts`)

`configs.ts` が `.env` の内容を読み込んでエクスポートします。

```typescript
// src/configs.ts
export const COPC_FILE = (process.env as any).COPC_FILE;
export const LAS_FILES = (process.env as any).LAS_FILES;
export const LAZ_FILES = (process.env as any).LAZ_FILES;
export const XYZ_FILES = (process.env as any).XYZ_FILES;
export const TIF_FIlES = (process.env as any).TIF_FIlES;
```

### 3. ローダーの選択 (`src/index.ts`)

`index.ts` の `_initializeFileData()` 関数で使用するローダーを選択します。

```typescript
// src/index.ts
async function _initializeFileData() {
  // 以下のいずれかをコメント解除して使用
  // const { filename, vectorType } = _copc_file_loader();
  // const { filename, vectorType } = _las_file_loader();
  // const { filename, vectorType } = _laz_file_loader();
  const { filename, vectorType } = _xyz_file_loader();  // ← アクティブ
  // const { filename, vectorType } = _tif_file_loader();

  await initializePointCloud(filename);
  return { filename, vectorType };
}
```

### 4. ファイルローダー関数

各ローダー関数は対応する環境変数を読み込みます。

```typescript
// COPC用ローダー
function _copc_file_loader() {
  const filename = COPC_FILE;              // .env の COPC_FILE を使用
  const vectorType: VectorType = "vec4";   // COPCはvec4
  return { filename, vectorType };
}

// LAS用ローダー
function _las_file_loader() {
  const filename = LAS_FILES;              // .env の LAS_FILES を使用
  const vectorType: VectorType = "vec3";   // LASはvec3
  return { filename, vectorType };
}

// LAZ用ローダー
function _laz_file_loader() {
  const filename = LAZ_FILES;              // .env の LAZ_FILES を使用
  const vectorType: VectorType = "vec3";   // LAZはvec3
  return { filename, vectorType };
}

// XYZ用ローダー
function _xyz_file_loader() {
  const filename = XYZ_FILES;              // .env の XYZ_FILES を使用
  const vectorType: VectorType = "vec3";   // XYZはvec3
  return { filename, vectorType };
}

// TIF用ローダー
function _tif_file_loader() {
  const filename = TIF_FIlES;              // .env の TIF_FIlES を使用
  const vectorType: VectorType = "vec3";   // TIFはvec3
  return { filename, vectorType };
}
```

---

## 設定手順

### ステップ1: `.env` ファイルの作成

プロジェクトルートに `.env` ファイルを作成します（存在しない場合）。

```bash
# プロジェクトルートで実行
cp .env.example .env
```

`.env.example` が存在しない場合は、新規作成します：

```bash
# .env
# ==================================================
# DEBUG-WebGPU-Analyzer 環境変数設定
# ==================================================

# --------------------------------------------------
# Octree設定
# --------------------------------------------------
LEAF_CAPACITY=16          # 1ノードあたりの最大点数
BUFFER_CAPACITY=16        # バッファ容量

# --------------------------------------------------
# 永続キャッシュ設定
# --------------------------------------------------
P_CACHE="cache-holder"    # キャッシュファイル名
P_CACHE_CAPACITY=150      # キャッシュ容量

# --------------------------------------------------
# ファイルパス設定
# --------------------------------------------------

# COPC (.copc.laz)
# ローカルファイル または HTTPSのURL
COPC_FILE="https://media.githubusercontent.com/media/sceneserver/copc/main/naarden-vesting.copc.laz"
# COPC_FILE="dataset/copc/sample.copc.laz"

# LAS (.las) - 非圧縮点群ファイル
LAS_FILES="dataset/las/09KD9817.las"

# LAZ (.laz) - 圧縮点群ファイル (v1.0-1.3のみ対応)
LAZ_FILES="dataset/laz/v13_200406_100502_Sample.laz"

# XYZ (.xyz) - テキスト形式点群ファイル
XYZ_FILES="dataset/xyz/A1_20220512.xyz"

# TIF/TIFF (.tif, .tiff) - ラスターデータ
TIF_FIlES="dataset/tif/09KD9816.tif"

# --------------------------------------------------
# 複数ファイル対応（将来実装予定）
# --------------------------------------------------
# POINT_CLOUD_FILES=["dataset/las/file1.las", "dataset/xyz/file2.xyz"]
```

### ステップ2: ファイルパスの設定

`.env` ファイルを編集して、読み込みたいファイルのパスを設定します。

#### ローカルファイルの場合

```bash
# ローカルファイルのパス（datasetディレクトリ基準）
LAZ_FILES="dataset/laz/my_pointcloud.laz"
```

ファイルを配置：
```bash
# ファイルをdatasetディレクトリに配置
mkdir -p dataset/laz
cp /path/to/your/file.laz dataset/laz/my_pointcloud.laz
```

#### リモートファイル（HTTP/HTTPS）の場合

```bash
# HTTPSのURL（COPC推奨）
COPC_FILE="https://example.com/data/sample.copc.laz"
```

**注意**:
- COPCファイルはHTTP Range Requestに対応したサーバーが必要
- LAS/LAZ/XYZ/TIFはファイル全体をダウンロードするため、大きいファイルは非推奨

### ステップ3: ローダーの選択

`src/index.ts` を編集して、使用するローダーを選択します。

```typescript
// src/index.ts
async function _initializeFileData() {
  // 使用したいローダーのコメントを解除
  // const { filename, vectorType } = _copc_file_loader();  // COPC用
  // const { filename, vectorType } = _las_file_loader();   // LAS用
  const { filename, vectorType } = _laz_file_loader();    // LAZ用 ← アクティブ
  // const { filename, vectorType } = _xyz_file_loader();   // XYZ用
  // const { filename, vectorType } = _tif_file_loader();   // TIF用

  try {
    await initializePointCloud(filename);
  } catch (error) {
    // エラー処理
    console.error("Failed to load point cloud:", error);
    throw error;
  }

  return { filename, vectorType };
}
```

### ステップ4: ビルド

変更を反映するためにビルドを実行します。

```bash
# 開発モード（自動リロード）
npm run dev

# または プロダクションビルド
npm run build
```

**重要**:
- `.env` ファイルを変更した場合は、**必ずビルドを再実行**してください
- Webpack Dev Serverを使用している場合は、サーバーを再起動してください

### ステップ5: ブラウザで確認

```
http://localhost:8080
```

ブラウザで開いて点群が表示されることを確認します。

---

## 詳細設定

### 対応ファイル形式と設定

| フォーマット | 拡張子 | 環境変数 | ローダー関数 | VectorType | 備考 |
|------------|--------|---------|------------|-----------|------|
| **COPC** | `.copc.laz` | `COPC_FILE` | `_copc_file_loader()` | `vec4` | HTTP対応、ストリーミング |
| **LAS** | `.las` | `LAS_FILES` | `_las_file_loader()` | `vec3` | 非圧縮 |
| **LAZ** | `.laz` | `LAZ_FILES` | `_laz_file_loader()` | `vec3` | v1.0-1.3のみ対応 |
| **XYZ** | `.xyz` | `XYZ_FILES` | `_xyz_file_loader()` | `vec3` | テキスト形式 |
| **TIF** | `.tif`, `.tiff` | `TIF_FIlES` | `_tif_file_loader()` | `vec3` | ラスター→点群変換 |

### VectorTypeについて

- **`vec4`**: 位置情報 (x, y, z, level) - COPCで使用、LOD対応
- **`vec3`**: 位置情報 (x, y, z) - その他のフォーマットで使用

### Octree設定

```bash
# .env
LEAF_CAPACITY=16      # 1ノードあたりの最大点数（小さいほど細かい分割）
BUFFER_CAPACITY=16    # バッファ容量
```

**推奨値**:
- 小規模データ（~100万点）: `LEAF_CAPACITY=32`
- 中規模データ（100万~1000万点）: `LEAF_CAPACITY=16` (デフォルト)
- 大規模データ（1000万点~）: `LEAF_CAPACITY=8`

### キャッシュ設定

```bash
# .env
P_CACHE="cache-holder"    # キャッシュファイル名（任意の名前）
P_CACHE_CAPACITY=150      # 永続キャッシュの最大ノード数
```

**キャッシュファイルの保存場所**:
- Origin Private File System (ブラウザ内ストレージ)
- `${P_CACHE}.json` として保存される

---

## 設定例

### 例1: ローカルLAZファイルを読み込む

**1. ファイルを配置**:
```bash
mkdir -p dataset/laz
cp /path/to/your/file.laz dataset/laz/my_data.laz
```

**2. `.env` を編集**:
```bash
LAZ_FILES="dataset/laz/my_data.laz"
```

**3. `src/index.ts` を編集**:
```typescript
async function _initializeFileData() {
  const { filename, vectorType } = _laz_file_loader();  // ← この行をアクティブ
  await initializePointCloud(filename);
  return { filename, vectorType };
}
```

**4. ビルド**:
```bash
npm run dev
```

---

### 例2: リモートCOPCファイルを読み込む

**1. `.env` を編集**:
```bash
COPC_FILE="https://hobu-lidar.s3.amazonaws.com/sofi.copc.laz"
```

**2. `src/index.ts` を編集**:
```typescript
async function _initializeFileData() {
  const { filename, vectorType } = _copc_file_loader();  // ← この行をアクティブ
  await initializePointCloud(filename);
  return { filename, vectorType };
}
```

**3. ビルド**:
```bash
npm run dev
```

---

### 例3: XYZファイル（カスタム座標系）を読み込む

**1. XYZファイルのフォーマット確認**:
```
# コメント行
X Y Z R G B
100.5 200.3 50.1 255 0 0
101.2 201.5 51.3 0 255 0
...
```

**2. ファイルを配置**:
```bash
mkdir -p dataset/xyz
cp /path/to/your/file.xyz dataset/xyz/my_points.xyz
```

**3. `.env` を編集**:
```bash
XYZ_FILES="dataset/xyz/my_points.xyz"
```

**4. `src/index.ts` を編集**:
```typescript
async function _initializeFileData() {
  const { filename, vectorType } = _xyz_file_loader();  // ← この行をアクティブ
  await initializePointCloud(filename);
  return { filename, vectorType };
}
```

**5. ビルド**:
```bash
npm run dev
```

---

### 例4: TIF標高データを読み込む

**1. TIFファイルを配置**:
```bash
mkdir -p dataset/tif
cp /path/to/your/elevation.tif dataset/tif/dem.tif
```

**2. `.env` を編集**:
```bash
TIF_FIlES="dataset/tif/dem.tif"
```

**3. `src/index.ts` を編集**:
```typescript
async function _initializeFileData() {
  const { filename, vectorType } = _tif_file_loader();  // ← この行をアクティブ
  await initializePointCloud(filename);
  return { filename, vectorType };
}
```

**4. ビルド**:
```bash
npm run build
```

---

## トラブルシューティング

### 問題1: ファイルが読み込まれない

**症状**:
- ブラウザで真っ白な画面
- コンソールに "Failed to load point cloud" エラー

**原因と対処**:

1. **ファイルパスが間違っている**
   ```bash
   # .env のパスを確認
   LAZ_FILES="dataset/laz/file.laz"  # ← このファイルが存在するか確認
   ```
   ```bash
   # ファイルの存在確認
   ls -la dataset/laz/file.laz
   ```

2. **ビルドを再実行していない**
   ```bash
   # .env を変更したら必ず再ビルド
   npm run build
   ```

3. **ローダーの選択が間違っている**
   ```typescript
   // src/index.ts
   // LAZファイルなのに _las_file_loader() を使っている、など
   const { filename, vectorType } = _laz_file_loader();  // ← 正しいローダーを使用
   ```

---

### 問題2: LAZ v1.4 ファイルでエラー

**症状**:
```
Error: LAZ version 1.4 is not supported.
Please convert to LAZ v1.3 using laz-converter tool.
```

**対処**:

LAZ v1.4ファイルは現在未対応です。v1.3に変換してください。

```bash
# laz-converterツールを使用
cd laz-converter
node convert.js ../dataset/laz/v14_file.laz -o ../dataset/laz/v13_file.laz
```

変換後、`.env` を更新：
```bash
LAZ_FILES="dataset/laz/v13_file.laz"
```

---

### 問題3: リモートCOPCファイルが読み込めない

**症状**:
- HTTPエラー
- CORSエラー

**対処**:

1. **URLが正しいか確認**
   ```bash
   # ブラウザで直接URLを開いてダウンロードできるか確認
   https://example.com/file.copc.laz
   ```

2. **CORSヘッダーの確認**
   - サーバーが `Access-Control-Allow-Origin` ヘッダーを返す必要があります
   - GitHub Media、AWS S3（公開設定）、Cloudflareなどは対応済み

3. **HTTP Range Requestのサポート確認**
   ```bash
   # curlでRange Requestをテスト
   curl -I -H "Range: bytes=0-1023" https://example.com/file.copc.laz

   # レスポンスに以下が含まれていればOK
   # Accept-Ranges: bytes
   # Content-Range: bytes 0-1023/123456
   ```

---

### 問題4: WebGPUエラー

**症状**:
```
WebGPU is not supported in this browser
```

**対処**:

1. **対応ブラウザを使用**
   - Chrome 113以降
   - Edge 113以降
   - Safari Technology Preview

2. **WebGPUを有効化**
   - Chrome: `chrome://flags/` で "WebGPU" を検索して有効化
   - Firefox: `about:config` で `dom.webgpu.enabled` を `true`

---

### 問題5: ビルドエラー

**症状**:
```
ERROR in ./src/index.ts
Module not found: Error: Can't resolve...
```

**対処**:

1. **node_modulesを再インストール**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **TypeScriptエラーの確認**
   ```bash
   npx tsc --noEmit
   ```

---

## よくある質問

### Q1. 複数のファイルを同時に読み込めますか？

**A**: 現在は1つのファイルのみ対応しています。複数ファイルの読み込みは将来実装予定です（`docs/future-improvements.md` 参照）。

---

### Q2. `.env` ファイルをGitにコミットすべきですか？

**A**: いいえ。`.env` は `.gitignore` に含まれており、Gitにコミットされません。代わりに `.env.example` をコミットしてください。

```bash
# .gitignore
.env          # ← 除外される（個人の設定）
!.env.example # ← コミットされる（サンプル）
```

---

### Q3. ファイルパスは相対パスと絶対パスどちらを使うべきですか？

**A**: **相対パス（プロジェクトルート基準）**を推奨します。

```bash
# 推奨（相対パス）
LAZ_FILES="dataset/laz/file.laz"

# 非推奨（絶対パス）
LAZ_FILES="/Users/username/project/dataset/laz/file.laz"
```

**理由**:
- 他の環境で動作しやすい
- プロジェクトの移動に対応できる

---

### Q4. `.env` の変更を反映するためにフルビルドが必要ですか？

**A**: はい。`.env` はビルド時に読み込まれるため、変更後は必ず再ビルドが必要です。

```bash
# 開発モード（自動リロード付き）
npm run dev

# プロダクションビルド
npm run build
```

**注意**: Webpack Dev Serverを起動したまま `.env` を変更した場合、サーバーを**再起動**してください。

---

### Q5. データセットのサンプルはどこで入手できますか？

**A**: 以下のサイトで公開データセットが入手できます。

**COPC**:
- https://github.com/sceneserver/copc
- https://hobu-lidar.s3.amazonaws.com/sofi.copc.laz

**LAS/LAZ**:
- https://usgs.gov/ (米国地質調査所)
- https://opentopography.org/

**XYZ**:
- 各種LiDARデータをテキスト形式に変換

**TIF/TIFF**:
- https://earthexplorer.usgs.gov/ (標高データ)

---

### Q6. ローカルサーバーではなく、静的ホスティングで動作しますか？

**A**: はい、ビルド後のファイルを静的ホスティングにデプロイ可能です。

```bash
# ビルド
npm run build

# public/ ディレクトリを静的ホスティングにアップロード
# - GitHub Pages
# - Netlify
# - Vercel
# - AWS S3 + CloudFront
```

**注意**:
- ローカルファイル (`dataset/`) は含めないでください（サイズが大きい）
- リモートURL（COPC）を使用することを推奨

---

### Q7. ファイル形式を切り替えるたびにコードを編集するのは面倒です

**A**: 将来的にUI上でファイルを選択できる機能を実装予定です（`docs/future-improvements.md` の「ファイル選択UI」を参照）。

現在の回避策：
```typescript
// src/index.ts
// 環境変数で切り替え
const loaderType = (process.env as any).LOADER_TYPE || 'laz';

async function _initializeFileData() {
  switch (loaderType) {
    case 'copc': return _copc_file_loader();
    case 'las': return _las_file_loader();
    case 'laz': return _laz_file_loader();
    case 'xyz': return _xyz_file_loader();
    case 'tif': return _tif_file_loader();
    default: return _laz_file_loader();
  }
}
```

`.env` に追加：
```bash
LOADER_TYPE="laz"
```

---

## まとめ

### ファイル読み込みの流れ（全体図）

```
┌─────────────────────────────────────────────────┐
│ 1. データセット準備                              │
│    - dataset/laz/file.laz                       │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ 2. .env ファイル編集                             │
│    LAZ_FILES="dataset/laz/file.laz"             │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ 3. src/index.ts でローダー選択                   │
│    const { filename, vectorType } =             │
│      _laz_file_loader();                        │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ 4. ビルド実行                                    │
│    npm run build または npm run dev             │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ 5. ブラウザで確認                                │
│    http://localhost:8080                        │
└─────────────────────────────────────────────────┘
```

### チェックリスト

ファイル読み込みを設定する際のチェックリスト：

- [ ] データファイルを `dataset/` ディレクトリに配置
- [ ] `.env` ファイルでファイルパスを設定
- [ ] `src/index.ts` で適切なローダー関数を選択
- [ ] `npm run build` または `npm run dev` を実行
- [ ] ブラウザで `http://localhost:8080` を開く
- [ ] WebGPU対応ブラウザを使用している
- [ ] コンソールエラーがないことを確認

### 関連ドキュメント

- **対応ファイル形式**: `docs/file-format-webgpu-support.md`
- **カラーマップ**: `research-memo/colormap-system-explanation.md`
- **キャッシュシステム**: `docs/cache-system-architecture.md`
- **今後の改善**: `docs/future-improvements.md`

---

**Happy Loading! 🚀**
