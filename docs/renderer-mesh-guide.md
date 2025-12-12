# メッシュレンダラーの使用方法

このガイドでは、点描画レンダラーとメッシュ描画レンダラーの切り替え方法を説明します。

## 概要

プロジェクトには2種類のレンダラーがあります：

### 1. **点描画レンダラー**（デフォルト）
- `Vec3Renderer` / `Vec4Renderer`
- 各点を1ピクセルの点として描画
- WebGPUの`point-list`トポロジーを使用
- 高速だが点が小さく見づらい場合がある

### 2. **メッシュ描画レンダラー**
- `Vec3RendererMesh` / `Vec4RendererMesh`
- 各点を四角形（2つの三角形）として描画
- WebGPUの`triangle-strip`トポロジーを使用
- 点が大きく見やすいが、重なり合ってメッシュのように見える

## ファイル構成

### シェーダー
```
src/shaders/
├── vec3-shader.wgsl        # Vec3点描画シェーダー
├── vec3-shader-mesh.wgsl   # Vec3メッシュ描画シェーダー
├── vec4-shader.wgsl        # Vec4点描画シェーダー
└── vec4-shader-mesh.wgsl   # Vec4メッシュ描画シェーダー
```

### レンダラー
```
src/renderers/
├── vec3-renderer.ts        # Vec3点描画レンダラー
├── vec3-renderer-mesh.ts   # Vec3メッシュ描画レンダラー
├── vec4-renderer.ts        # Vec4点描画レンダラー
└── vec4-renderer-mesh.ts   # Vec4メッシュ描画レンダラー
```

## 使用方法

### 方法1: RendererFactoryを使用

#### 点描画（デフォルト）
```typescript
import { RendererFactory } from "./renderers/exports";

const renderer = RendererFactory.getRenderer(
  "vec4",
  device,
  swapChainFormat
);
renderer.initialize();
```

#### メッシュ描画
```typescript
import { RendererFactory } from "./renderers/exports";

const renderer = RendererFactory.getMeshRenderer(
  "vec4",
  device,
  swapChainFormat
);
renderer.initialize();
```

### 方法2: 直接インスタンス化

#### 点描画
```typescript
import { Vec4Renderer } from "./renderers/exports";

const renderer = new Vec4Renderer(device, swapChainFormat);
renderer.initialize();
```

#### メッシュ描画
```typescript
import { Vec4RendererMesh } from "./renderers/exports";

const renderer = new Vec4RendererMesh(device, swapChainFormat);
renderer.initialize();
```

## WebGPURendererでの切り替え

`src/webgpu/webgpu-renderer.ts`を編集して切り替えます：

### 例1: Vec4でメッシュ描画を使用

```typescript
private _initVec4Renderer(
  device: GPUDevice,
  swapChainFormat: GPUTextureFormat
): void {
  // 点描画版（デフォルト）
  // const vec4Renderer = RendererFactory.getRenderer(
  //   this.vectorType,
  //   device,
  //   swapChainFormat
  // ) as Vec4Renderer;

  // メッシュ描画版
  const vec4Renderer = RendererFactory.getMeshRenderer(
    this.vectorType,
    device,
    swapChainFormat
  ) as Vec4RendererMesh;

  vec4Renderer.initialize();
  this.pipeline = vec4Renderer.getPipeline();
}
```

### 例2: Vec3でメッシュ描画を使用

```typescript
private _initVec3Renderer(
  device: GPUDevice,
  swapChainFormat: GPUTextureFormat
): void {
  // 点描画版（デフォルト）
  // const vec3Renderer = RendererFactory.getRenderer(
  //   this.vectorType,
  //   device,
  //   swapChainFormat
  // ) as Vec3Renderer;

  // メッシュ描画版
  const vec3Renderer = RendererFactory.getMeshRenderer(
    this.vectorType,
    device,
    swapChainFormat
  ) as Vec3RendererMesh;

  vec3Renderer.initialize();
  this.pipeline = vec3Renderer.getPipeline();
}
```

### 例3: renderループでの使用

```typescript
// src/webgpu/webgpu-renderer.ts の _render メソッド内

for (let key in appState.bufferMap) {
  const bufferInfo = appState.bufferMap[key];

  // 点描画版を使用
  const renderer = RendererFactory.getRenderer(
    bufferInfo.vectorType || "vec4",
    device,
    swapChainFormat
  );

  // メッシュ描画版を使用する場合
  // const renderer = RendererFactory.getMeshRenderer(
  //   bufferInfo.vectorType || "vec4",
  //   device,
  //   swapChainFormat
  // );

  renderer.render(
    renderPass,
    bufferInfo.position,
    bufferInfo.color,
    bufferInfo.numPoints,
    bindGroup
  );
}
```

## 描画の違い

### 点描画（point-list）
- **描画コール**: `renderPass.draw(1, pointCount, 0, 0)`
- **頂点数**: 1点あたり1頂点
- **トポロジー**: `point-list`
- **特徴**:
  - 軽量・高速
  - 点が1ピクセル固定
  - カメラを近づけても点は大きくならない

### メッシュ描画（triangle-strip）
- **描画コール**: `renderPass.draw(4, pointCount, 0, 0)`
- **頂点数**: 1点あたり4頂点（四角形）
- **トポロジー**: `triangle-strip`
- **特徴**:
  - 点がワールド座標で一定サイズの四角形として描画
  - LODレベルに応じてサイズ調整（COPC用）
  - 密集した点は重なり合ってメッシュのように見える

### サイズ計算（メッシュ版）

#### Vec4シェーダー（COPC用）
```wgsl
var level: f32 = in.position.w;  // COPCのLODレベル
var radius: f32 = 3.0 * pow(0.6, level);
radius = max(radius, 1.0);

// direction配列で四角形の4頂点を展開
position = position + vec3<f32>(radius * direction[vertexIndex], 0.0);
```

#### Vec3シェーダー（LAS/XYZ/TIF用）
```wgsl
var level: f32 = 0.0;  // デフォルトレベル
var radius: f32 = 3.0 * pow(0.6, level);  // = 3.0
radius = max(radius, 1.0);  // = 3.0

position = position + vec3<f32>(radius * direction[vertexIndex], 0.0);
```

## 推奨使用ケース

### 点描画を使用する場合
- ✅ 大規模な点群（数百万点以上）
- ✅ パフォーマンス重視
- ✅ 正確な点の位置を確認したい場合
- ✅ オーバードロー（重なり）を避けたい場合

### メッシュ描画を使用する場合
- ✅ 点を視覚的に見やすくしたい場合
- ✅ 連続的な表面を表現したい場合
- ✅ カメラから離れた点も見やすくしたい場合
- ✅ 発表・デモ用の見栄えを重視する場合

## トラブルシューティング

### メッシュ描画で点が大きすぎる場合

`vec4-shader-mesh.wgsl` または `vec3-shader-mesh.wgsl` の`radius`計算を調整：

```wgsl
// 元のコード
var radius: f32 = 3.0 * pow(0.6, level);

// 小さくする場合
var radius: f32 = 1.5 * pow(0.6, level);  // 半分のサイズ

// または固定サイズ
var radius: f32 = 1.0;  // 常に1.0
```

### メッシュ描画で点が小さすぎる場合

```wgsl
// 大きくする場合
var radius: f32 = 5.0 * pow(0.6, level);  // より大きく

// または最小サイズを上げる
radius = max(radius, 2.0);  // 最小2.0
```

## まとめ

- 点描画版とメッシュ描画版は完全に独立しているため、簡単に切り替え可能
- デフォルトは点描画（パフォーマンス重視）
- メッシュ描画は視覚的により見やすい
- `RendererFactory.getMeshRenderer()`でメッシュ版を取得
- シェーダーの`radius`値を調整して点のサイズを変更可能
