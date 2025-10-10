# ファイル形式のWebGPU表示対応状況

**最終更新日**: 2025-10-10

このドキュメントは、DEBUG-WebGPU-Analyzerプロジェクトにおける各ファイル形式のWebGPU直接表示の対応状況をまとめたものです。

---

## 📊 対応状況一覧

| 形式 | 拡張子 | 対応状況 | 実装状態 | レンダラー | 備考 |
|------|--------|----------|----------|-----------|------|
| **COPC** | `.copc.laz` | ✅ 完全対応 | 実装済み | Vec4 | Octree + アウトオブコア対応 |
| **LAZ** | `.laz` | ✅ 完全対応 | 実装済み | Vec3 | v1.0-1.3対応、v1.4は要変換 |
| **LAS** | `.las` | ✅ 完全対応 | 実装済み | Vec3 | 非圧縮版LAZ |
| **XYZ** | `.xyz` | ✅ 完全対応 | 実装済み | Vec3 | テキスト形式、RGB対応 |
| **TIF/TIFF** | `.tif`, `.tiff` | ✅ 完全対応 | 実装済み | Vec3 | RGB、標高、複合データ対応 |

**対応率**: 5/5 (100%)

---

## 📁 詳細実装状況

### ✅ COPC (.copc.laz) - 完全対応

**実装ファイル**:
- ローダー: `src/loaders/copc-loader.ts`
- ノードローダー: `src/loaders/copc-node-loader.ts`
- レンダラー: `src/renderers/vec4-renderer.ts`
- シェーダー: `src/shaders/vec4-shader.wgsl`

**機能**:
- ✅ HTTPストリーミング読み込み
- ✅ Octree階層構造のサポート
- ✅ 視錐台カリング
- ✅ LOD（Level of Detail）
- ✅ Web Worker並列処理
- ✅ 多層キャッシュシステム（GPU/LRU/永続）
- ✅ LAZ圧縮解凍（laz-perf WASM）

**データフロー**:
```
COPCファイル (HTTP Range Request)
    ↓
Web Worker Pool (並列取得)
    ↓
LAZ解凍 (laz-perf WASM)
    ↓
座標変換・色情報抽出
    ↓
キャッシュ管理 (3層)
    ↓
GPUバッファ作成 (vec4: position + LOD level, vec3: color)
    ↓
WebGPU描画 (インスタンシング)
```

**ベクトルタイプ**: `vec4<f32>` (x, y, z, **level**)
- w成分にLODレベルを格納
- シェーダー内で点のサイズを動的調整

**特記事項**:
- アウトオブコアレンダリング対応（メモリに収まらない大規模データ）
- 最も高度な実装

---

### ✅ LAZ (.laz) - 完全対応

**実装ファイル**:
- ローダー: `src/loaders/las-loader.ts` (LAS/LAZ共通)
- レンダラー: `src/renderers/vec3-renderer.ts`
- シェーダー: `src/shaders/vec3-shader.wgsl`

**ライブラリ**:
- `@loaders.gl/las` (4.3.4) - LAS/LAZ読み込み
- `laz-perf` (0.0.5) - LAZ圧縮解凍（WASM）

**機能**:
- ✅ LAZ v1.0-1.3完全対応
- ✅ RGB色情報の読み込み
- ✅ 輝度情報の読み込み
- ✅ 分類情報の読み込み
- ✅ バージョン自動検出
- ✅ エラーハンドリング（v1.4検出時に詳細ガイド表示）

**対応バージョン**:
```
✅ LAZ v1.0
✅ LAZ v1.1
✅ LAZ v1.2
✅ LAZ v1.3
⚠️ LAZ v1.4+ (要変換 - laz-converterツール使用)
```

**LAZ v1.4対応方法**:
```bash
# laz-converterツールを使用してv1.3に変換
cd laz-converter
node convert.js ../dataset/laz/v14_file.laz -o ../dataset/laz/v13_file.laz
```

**データ構造**:
```typescript
interface LASPointData {
  positions: Float32Array;    // [x, y, z, x, y, z, ...]
  colors?: Float32Array;      // [r, g, b, r, g, b, ...]
  intensities?: Uint16Array;  // [i, i, i, ...]
  classifications?: Uint8Array; // [c, c, c, ...]
}
```

**ベクトルタイプ**: `vec3<f32>` (x, y, z)

**エラーハンドリング**:
- LAZ v1.4検出時に詳細な変換手順を表示
- RGB有無の自動検出
- ファイル破損の検出

---

### ✅ LAS (.las) - 完全対応

**実装ファイル**:
- ローダー: `src/loaders/las-loader.ts` (LAZと共通)
- レンダラー: `src/renderers/vec3-renderer.ts`
- シェーダー: `src/shaders/vec3-shader.wgsl`

**機能**:
- ✅ 非圧縮LASファイルの読み込み
- ✅ LAZと同じデータ構造
- ✅ すべてのLASバージョン対応

**LAZとの違い**:
- 圧縮なし（ファイルサイズ大）
- 解凍処理不要（読み込み高速）
- その他の処理フローはLAZと同一

**ベクトルタイプ**: `vec3<f32>` (x, y, z)

---

### ✅ XYZ (.xyz) - 完全対応

**実装ファイル**:
- ローダー: `src/loaders/xyz-loader.ts`
- レンダラー: `src/renderers/vec3-renderer.ts`
- シェーダー: `src/shaders/vec3-shader.wgsl`

**機能**:
- ✅ テキスト形式のパース
- ✅ RGB色情報の読み込み（オプション）
- ✅ ヘッダー行の自動検出
- ✅ コメント行の除外（`#`で始まる行）
- ✅ 色値の自動正規化（0-1 または 0-255）

**対応フォーマット**:
```
# XYZ形式（座標のみ）
X Y Z
1.0 2.0 3.0
4.0 5.0 6.0

# XYZRGB形式（座標 + RGB）
X Y Z R G B
1.0 2.0 3.0 255 0 0
4.0 5.0 6.0 0 255 0

# 0-1範囲のRGB（自動で0-255に変換）
1.0 2.0 3.0 1.0 0.0 0.0
```

**データ構造**:
```typescript
interface XYZPointData {
  positions: Float32Array;  // [x, y, z, x, y, z, ...]
  colors?: Float32Array;    // [r, g, b, r, g, b, ...] (オプション)
  normals?: Float32Array;   // 将来対応予定
}
```

**ベクトルタイプ**: `vec3<f32>` (x, y, z)

**パース処理**:
1. ファイルをテキストとして読み込み
2. 行分割（空行・コメント除外）
3. ヘッダー行の検出（数値以外を含む行）
4. 各行を空白で分割し数値化
5. 座標（XYZ）は必須、RGBはオプション
6. 色値の範囲を自動検出して正規化

---

### ✅ TIF/TIFF (.tif, .tiff) - 完全対応

**実装ファイル**:
- ローダー: `src/loaders/tif-loader.ts`
- レンダラー: `src/renderers/vec3-renderer.ts`
- シェーダー: `src/shaders/vec3-shader.wgsl`

**ライブラリ**:
- `@loaders.gl/geotiff` (4.3.4) - GeoTIFF読み込み

**機能**:
- ✅ RGB画像データ
- ✅ RGBA画像データ
- ✅ 標高データ（DEM: Digital Elevation Model）
- ✅ グレースケール画像
- ✅ RGB + 標高データの複合
- ✅ マルチスペクトル画像
- ✅ 自動データタイプ判定
- ✅ NoData値のフィルタリング
- ✅ 地理座標系のサポート

**対応データタイプ**:

| データタイプ | 説明 | 判定条件 | 処理内容 |
|-------------|------|---------|---------|
| `rgb` | RGB画像 | PhotometricInterpretation=2, 3ch | RGBをそのまま使用、輝度→Z座標 |
| `rgba` | RGBA画像 | PhotometricInterpretation=2, 4ch | RGBを使用、アルファ無視 |
| `elevation` | 標高データ | SampleFormat=3 (Float), 1ch | 標高→Z座標、グレースケール色 |
| `rgb+elevation` | RGB + 標高 | 4ch, RGB + Float | RGB色 + 実際の標高 |
| `grayscale` | グレースケール | PhotometricInterpretation=1, 1ch | 輝度→Z座標、グレースケール色 |
| `multispectral` | マルチスペクトル | 3ch以上, RGB解釈なし | 最初の3バンドをRGBとして使用 |

**データ変換フロー**:

#### 1. RGB画像
```
RGB画像データ
    ↓
輝度計算 (0.299R + 0.587G + 0.114B)
    ↓
Z座標 = 輝度 × 100
    ↓
点群 (X, Y, Z) + (R, G, B)
```

#### 2. 標高データ
```
標高データ (Float32Array)
    ↓
NoData値除外 (< -1000000 or infinite)
    ↓
Z座標 = 標高値
    ↓
グレースケール色 = (標高 - 最小) / (最大 - 最小) × 255
    ↓
点群 (X, Y, Z) + (Gray, Gray, Gray)
```

#### 3. RGB + 標高（複合）
```
RGBデータ + 標高データ
    ↓
Z座標 = 標高値（実際の高さ）
色 = RGBデータ（実際の色）
    ↓
点群 (X, Y, Z) + (R, G, B)
```

**メタデータ判定**:
```typescript
private _identifyDataType(metadata): TIFDataType {
  // PhotometricInterpretation: 2 = RGB, 1 = BlackIsZero
  // SampleFormat: 3 = Float, 1 = UInt

  if (photometricInterpretation === 2 && samplesPerPixel === 3) {
    return "rgb";
  }

  if (samplesPerPixel === 1 && sampleFormat[0] === 3) {
    return "elevation";
  }

  // ... その他の判定
}
```

**データ構造**:
```typescript
interface TIFPointData {
  positions: Float32Array;   // [x, y, z, x, y, z, ...]
  colors?: Float32Array;     // [r, g, b, r, g, b, ...]
  elevations?: Float32Array; // [z, z, z, ...] (元の標高データ)
}
```

**ベクトルタイプ**: `vec3<f32>` (x, y, z)

**地理座標系**:
- GeoTIFFのバウンディングボックスを使用
- 緯度経度 → XY座標
- 標高 → Z座標

**特記事項**:
- ラスターデータを点群に変換
- 全ピクセルを点として表示
- 大規模画像の場合はメモリ消費に注意

---

## 🔧 技術的詳細

### WebGPUレンダリングパターン

すべてのフォーマットは以下のパターンでWebGPU表示されます:

#### 1. データ読み込み
```typescript
// 各ローダーのloadFile()メソッド
const data = await loader.loadFile();
// data = { header, points, boundingBox, vectorType }
```

#### 2. GPUバッファ作成
```typescript
// src/webgpu/webgpu-buffer.ts
const positionBuffer = device.createBuffer({
  size: positions.length * 4, // Float32 = 4 bytes
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  mappedAtCreation: true,
});

const colorBuffer = device.createBuffer({
  size: colors.length * 4,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  mappedAtCreation: true,
});
```

#### 3. データ転送
```typescript
const positionArray = new Float32Array(positionBuffer.getMappedRange());
positionArray.set(positions);
positionBuffer.unmap();
```

#### 4. レンダリング
```typescript
// src/webgpu/webgpu-renderer.ts
renderPass.setPipeline(pipeline);
renderPass.setBindGroup(0, bindGroup);
renderPass.setVertexBuffer(0, positionBuffer);
renderPass.setVertexBuffer(1, colorBuffer);
renderPass.draw(4, pointCount, 0, 0); // インスタンシング
```

---

## 🎨 レンダラーとシェーダー

### Vec3レンダラー（LAS/LAZ/XYZ/TIF用）

**ファイル**: `src/renderers/vec3-renderer.ts`

**頂点バッファレイアウト**:
```typescript
{
  arrayStride: 12, // 3 floats × 4 bytes
  stepMode: "instance",
  attributes: [{
    shaderLocation: 0,
    offset: 0,
    format: "float32x3"
  }]
}
```

**シェーダー**: `src/shaders/vec3-shader.wgsl`
```wgsl
struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>
};

@vertex
fn main(in: VertexInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOut {
    var out: VertexOut;
    var radius: f32 = 3.0; // 固定サイズ
    var position: vec3<f32> = in.position - /* 中心化 */;

    // カラーマップまたはRGB色
    if params.current_Axis == 3.0 {
        out.color = vec4(in.color.x / 255.0, in.color.y / 255.0, in.color.z / 255.0, 1.0);
    } else {
        // Z/Y/X軸カラーマップ
    }

    position = position + vec3<f32>(radius * direction[vertexIndex], 0.0);
    out.position = MVP_Matrix * vec4<f32>(position, 1.0);
    return out;
}
```

### Vec4レンダラー（COPC用）

**ファイル**: `src/renderers/vec4-renderer.ts`

**頂点バッファレイアウト**:
```typescript
{
  arrayStride: 16, // 4 floats × 4 bytes
  stepMode: "instance",
  attributes: [{
    shaderLocation: 0,
    offset: 0,
    format: "float32x4"
  }]
}
```

**シェーダー**: `src/shaders/vec4-shader.wgsl`
```wgsl
struct VertexInput {
    @location(0) position: vec4<f32>, // (x, y, z, level)
    @location(1) color: vec3<f32>
};

@vertex
fn main(in: VertexInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOut {
    var out: VertexOut;
    var level: f32 = in.position.w; // LODレベル
    var radius: f32 = 3.0 * pow(0.6, level); // レベルに応じて縮小
    radius = max(radius, 1.0);

    // カラーマップ + 輝度調整
    if params.current_Axis == 2.0 {
        cMapIndex = i32((abs(in.position.z - params.z_min) / params.width_z) * 19);
        out.color = getCmapped(cMapIndex);
        out.color = vec4(out.color.x, out.color.y, out.color.z, 1.0) * factor;
    }
    // ...
}
```

---

## 📊 パフォーマンス比較

| フォーマット | ファイルサイズ (1M点) | 読み込み速度 | メモリ使用量 | 特徴 |
|-------------|---------------------|-------------|-------------|------|
| **COPC** | 小 (~10MB) | 高速（ストリーミング） | 小（オンデマンド） | 最適 |
| **LAZ** | 小 (~10MB) | 中速（解凍必要） | 中 | 圧縮効率高 |
| **LAS** | 大 (~40MB) | 高速（解凍不要） | 大 | 非圧縮 |
| **XYZ** | 大 (~50MB) | 低速（テキストパース） | 大 | シンプル |
| **TIF** | 中 (~20MB) | 中速 | 中 | ラスター形式 |

---

## 🔄 データフロー統一図

```
[ファイル読み込み]
    ↓
[フォーマット別ローダー]
├─ COPC: COPCLoader + COPCNodeLoader
├─ LAZ/LAS: LASLoader (@loaders.gl)
├─ XYZ: XYZLoader (自作パーサー)
└─ TIF: TIFLoader (@loaders.gl/geotiff)
    ↓
[統一データ形式]
{
  header: { ... },
  points: {
    positions: Float32Array,
    colors: Float32Array
  },
  boundingBox: { min, max },
  vectorType: "vec3" | "vec4"
}
    ↓
[状態管理]
appState.copcData / lasData / xyzData / tifData
    ↓
[WebGPUバッファ作成]
src/webgpu/webgpu-buffer.ts
├─ createCOPCBuffer() → Vec4
├─ createLASBuffer() → Vec3
├─ createXYZBuffer() → Vec3
└─ createTIFBuffer() → Vec3
    ↓
[レンダラー選択]
src/renderers/renderer-factory.ts
├─ Vec4Renderer (COPC)
└─ Vec3Renderer (LAS/LAZ/XYZ/TIF)
    ↓
[WebGPUレンダリング]
src/webgpu/webgpu-renderer.ts
    ↓
[画面表示]
```

---

## 🚀 実装の優先順位（実績）

実際の実装順序は以下の通りでした:

1. ✅ **COPC** - 最も複雑だが最も効率的（アウトオブコア）
2. ✅ **LAS/LAZ** - 標準フォーマット、ライブラリ活用
3. ✅ **XYZ** - シンプルな形式、テストに最適
4. ✅ **TIF/TIFF** - ラスター→点群変換、用途拡張

---

## 📚 実装ファイル

### ローダー
- COPC: `src/loaders/copc-loader.ts`, `src/loaders/copc-node-loader.ts`
- LAS/LAZ: `src/loaders/las-loader.ts`
- XYZ: `src/loaders/xyz-loader.ts`
- TIF: `src/loaders/tif-loader.ts`
- ファサード: `src/loaders/pointcloud-loader.ts`

### レンダラー
- Vec3: `src/renderers/vec3-renderer.ts`
- Vec4: `src/renderers/vec4-renderer.ts`
- ファクトリ: `src/renderers/renderer-factory.ts`

### シェーダー
- Vec3: `src/shaders/vec3-shader.wgsl`
- Vec4: `src/shaders/vec4-shader.wgsl`

### WebGPUコア
- バッファ管理: `src/webgpu/webgpu-buffer.ts`
- レンダリング: `src/webgpu/webgpu-renderer.ts`
- コンテキスト: `src/webgpu/context.ts`
- ユニフォーム: `src/webgpu/uniform-buffer.ts`

### キャッシュ
- LRU: `src/cache/lru-cache.ts`
- 永続: `src/cache/persistent-cache.ts`
- ノード管理: `src/cache/node-cache-manager.ts`

### Worker
- フェッチャー: `src/worker/fetcher.worker.ts`
- マネージャー: `src/worker/worker-manager.ts`

---

## 🎯 まとめ

**全フォーマット対応完了！**

- ✅ **COPC**: 大規模データに最適（アウトオブコア）
- ✅ **LAZ**: 圧縮効率とバランス良好
- ✅ **LAS**: シンプルで高速
- ✅ **XYZ**: テキスト形式で扱いやすい
- ✅ **TIF**: ラスターデータの可視化に最適

すべてのフォーマットがWebGPUで直接レンダリング可能です。
