# カラーマップシステムの解説

## 作成日
2025-10-10

## 概要
このドキュメントでは、WebGPUレンダラーにおけるカラーマップシステムの仕組みを解説します。点群データを異なる視点（座標軸またはRGB色）で視覚化するための機構です。

---

## カラーマップの種類

プロジェクトでは4種類のカラーマップをサポートしています：

| モード | currentAxis値 | 説明 |
|--------|--------------|------|
| **RGB Color Map** | 3 | 点群データに含まれる実際のRGB色情報を使用 |
| **Z-axis Color Map** | 2 | 高さ（Z座標）に応じて色を変化させる |
| **Y-axis Color Map** | 1 | Y座標に応じて色を変化させる |
| **X-axis Color Map** | 0 | X座標に応じて色を変化させる |

### 各モードの用途

#### 1. RGB Color Map (デフォルト)
- **用途**: 点群データに記録された実際の色を表示
- **利点**: 現実に近い色で表示される
- **使用例**: 航空レーザー測量で撮影された建物や地形の色を再現

#### 2. Z-axis Color Map
- **用途**: 高度の可視化
- **利点**: 地形の起伏や建物の高さが一目で分かる
- **使用例**: 地形解析、洪水シミュレーション、高度分布の確認

#### 3. Y-axis / X-axis Color Map
- **用途**: 特定の方向の分布を可視化
- **利点**: データの空間的な広がりを理解しやすい
- **使用例**: データの偏りや範囲の確認

---

## システムアーキテクチャ

### 1. カラーパレットの定義（TypeScript側）

**ファイル**: `src/webgpu/uniform-buffer.ts`
**メソッド**: `_createColorMapBuffer()` (109-142行目)

```typescript
private _createColorMapBuffer(): void {
  const hsvColors = [
    [0.0, 0.0, 0.5],  // 色0: 暗い青
    [0.0, 0.2, 0.7],  // 色1: 青
    [0.0, 0.4, 0.9],  // 色2: 明るい青
    [0.0, 0.6, 1.0],  // 色3: シアン寄りの青
    [0.0, 0.8, 1.0],  // 色4: シアン
    [0.2, 0.9, 0.8],  // 色5: 緑がかったシアン
    [0.4, 1.0, 0.6],  // 色6: 黄緑
    [0.6, 1.0, 0.4],  // 色7: 緑
    [0.8, 1.0, 0.2],  // 色8: 黄緑
    [1.0, 1.0, 0.0],  // 色9: 黄色
    [1.0, 0.9, 0.0],  // 色10: 黄色（やや暗め）
    [1.0, 0.8, 0.0],  // 色11: オレンジがかった黄色
    [1.0, 0.6, 0.0],  // 色12: オレンジ
    [1.0, 0.4, 0.0],  // 色13: 濃いオレンジ
    [1.0, 0.2, 0.0],  // 色14: 赤オレンジ
    [0.9, 0.0, 0.0],  // 色15: 赤
    [0.7, 0.0, 0.0],  // 色16: 暗い赤
    [0.5, 0.0, 0.0],  // 色17: さらに暗い赤
    [0.3, 0.0, 0.0],  // 色18: 非常に暗い赤
    [0.1, 0.5, 0.0],  // 色19: 暗い緑がかった色
  ].flat();

  this.colorMapBuffer = this.device.createBuffer({
    size: hsvColors.length * 3 * 4, // 20色 × 3成分 × 4バイト
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
  });

  const mapArray = new Float32Array(this.colorMapBuffer.getMappedRange());
  mapArray.set(hsvColors);
  this.colorMapBuffer.unmap();
}
```

**カラーグラデーション**:
```
青 → シアン → 緑 → 黄 → オレンジ → 赤
```

このグラデーションは科学的可視化で一般的な「クール→ウォーム」配色です。

---

### 2. シェーダー側の処理

**ファイル**:
- `src/shaders/vec3-shader.wgsl` (LAS/LAZ/XYZ/TIF用)
- `src/shaders/vec4-shader.wgsl` (COPC用)

#### シェーダー構造

```wgsl
struct paramsUniform {
    width_x: f32,          // X方向の幅
    width_y: f32,          // Y方向の幅
    width_z: f32,          // Z方向の幅（高さ）
    x_min: f32,            // X座標の最小値
    y_min: f32,            // Y座標の最小値
    z_min: f32,            // Z座標の最小値
    current_Axis: f32,     // カラーマップモード (0/1/2/3)
    max_Intensity: f32     // 最大輝度値（COPC用）
};

struct cmapUniform {
    colors: array<vec4<f32>, 20>  // 20色のカラーパレット
};

@group(0) @binding(0) var<uniform> MVP_Matrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> cMap: cmapUniform;
@group(0) @binding(2) var<uniform> params: paramsUniform;
```

#### カラーマップ取得関数

```wgsl
fn getCmapped(cMapIndex: i32) -> vec4<f32> {
    var cmapped = cMap.colors[cMapIndex];
    if cMapIndex > 19 {
        cmapped = cMap.colors[19];  // 範囲外は最後の色（赤系）
    }
    return cmapped;
}
```

---

### 3. 頂点シェーダーでの色決定ロジック

#### Z-axis Color Map (currentAxis == 2.0)

```wgsl
if params.current_Axis == 2.0 {
    // Z座標を正規化してインデックスに変換
    cMapIndex = i32((abs(in.position.z - params.z_min) / params.width_z) * 19.0);
    let mappedColor = getCmapped(cMapIndex);
    out.color = vec4(mappedColor.xyz, 1.0);

    if cMapIndex < 0 {
        out.color = vec4(1.0, 0.0, 0.0, 1.0);  // エラー表示（赤）
    }
}
```

**計算式**:
```
正規化値 = (Z座標 - Z最小値) / Z範囲
インデックス = floor(正規化値 × 19)
```

- Z座標が最小値に近い → インデックス 0 → 青系
- Z座標が最大値に近い → インデックス 19 → 赤系

#### Y-axis Color Map (currentAxis == 1.0)

```wgsl
else if params.current_Axis == 1.0 {
    cMapIndex = i32(1.25 * (abs(in.position.y - params.y_min) / params.width_y) * 19.0);
    out.color = getCmapped(cMapIndex);
}
```

**注**: `1.25` の係数により、色の変化が少し強調されます。

#### X-axis Color Map (currentAxis == 0.0)

```wgsl
else if params.current_Axis == 0.0 {
    cMapIndex = i32(1.25 * (abs(in.position.x - params.x_min) / params.width_x) * 19.0);
    out.color = getCmapped(cMapIndex);
}
```

#### RGB Color Mode (currentAxis == 3.0)

```wgsl
else {
    // 点群データの実際のRGB値を使用（0-255を0.0-1.0に正規化）
    out.color = vec4(in.color.x / 255.0, in.color.y / 255.0, in.color.z / 255.0, 1.0);
}
```

---

## データフロー

```
1. TypeScript側
   ↓
   [カラーパレット定義]
   20色のHSVグラデーション
   ↓
   [GPUバッファ作成]
   colorMapBuffer (240バイト)
   ↓
   [BindGroup作成]
   シェーダーに転送

2. シェーダー側
   ↓
   [頂点ごとに処理]
   current_Axisの値を確認
   ↓
   ┌─────────────────┐
   │ current_Axis?   │
   └─────────────────┘
         │
    ┌────┼────┬────┬────┐
    │    │    │    │    │
   [0]  [1]  [2]  [3]  [other]
    │    │    │    │    │
   X軸  Y軸  Z軸  RGB  RGB(デフォルト)
    │    │    │    │
    └────┴────┴────┘
         │
   [座標を正規化]
   (座標 - 最小値) / 範囲
         │
   [インデックス計算]
   正規化値 × 19
         │
   [カラーパレット参照]
   cMap.colors[index]
         │
   [フラグメントシェーダーへ]
   最終的な色として描画
```

---

## 実装の詳細

### パラメータの初期化

**ファイル**: `src/webgpu/uniform-buffer.ts`
**メソッド**: `initialize()` (19-41行目)

```typescript
initialize(
  camera: any,
  projMatrix: mat4,
  params: number[],
  globalMaxIntensity: number,
  currentAxis: number = 3  // デフォルト値3（RGBモード）
) {
  this.camera = camera;
  this.projMatrix = projMatrix;
  this.params = params;

  params.push(currentAxis);        // params[6] = current_Axis
  params.push(globalMaxIntensity); // params[7] = max_Intensity

  this._createParamsBuffer();
  this._createColorMapBuffer();
  this._createMVPBuffer();

  const viewMatrix = this.camera.matrixWorldInverse.elements;
  this.projView = mat4.mul(this.projView, this.projMatrix, viewMatrix);
}
```

### パラメータ構造

`params` 配列の構成（8要素、32バイト）:
```
params[0] = width_x     // X方向の幅
params[1] = width_y     // Y方向の幅
params[2] = width_z     // Z方向の幅
params[3] = x_min       // X座標の最小値
params[4] = y_min       // Y座標の最小値
params[5] = z_min       // Z座標の最小値
params[6] = current_Axis     // カラーマップモード (0/1/2/3)
params[7] = max_Intensity    // 最大輝度値
```

---

## UIとの連携

**ファイル**: `public/index.html` (33-42行目)

```html
<select id="colormap-axis">
  <optgroup label="Color Strategy">
    <option value="3">RGB Color</option>
    <option value="2">Z-axis color map</option>
    <option value="0">X-axis color map</option>
    <option value="1">Y-axis color map</option>
  </optgroup>
</select>
```

このセレクトボックスで選択された値（0/1/2/3）が `current_Axis` として使用されます。

**イベントハンドリング**は `public/js/dom-main.js` で実装されており、選択が変更されると `updateParams()` メソッドが呼ばれます。

---

## パフォーマンス考慮事項

### 1. バッファサイズの最適化
- カラーパレット: 20色 × 3成分 × 4バイト = **240バイト**（固定サイズ）
- パラメータバッファ: 8要素 × 4バイト = **32バイト**（固定サイズ）
- MVP行列: 16要素 × 4バイト = **64バイト**（固定サイズ）

### 2. GPU計算の効率
- カラーマップのインデックス計算は整数演算のみ
- 配列参照は定数時間（O(1)）
- 分岐処理は最小限（4パターンのみ）

### 3. メモリアクセスパターン
- ユニフォームバッファは全頂点で共有（メモリ効率的）
- カラーパレットは読み取り専用（キャッシュヒット率が高い）

---

## 拡張可能性

### カラーパレットのカスタマイズ

現在のコードでは20色のグラデーションが固定されていますが、以下のように拡張可能：

1. **カラーパレット数の変更**
   - シェーダー側: `array<vec4<f32>, N>` のサイズを変更
   - TypeScript側: `hsvColors` 配列の要素数を変更
   - インデックス計算: `* 19.0` を `* (N-1).0` に変更

2. **動的カラーパレット**
   - ユーザーが選択できる複数のプリセットを用意
   - ファイルやURLから読み込み可能にする

3. **逆転カラーマップ**
   - 配列を逆順にすることで、赤→青のグラデーションに変更

---

## トラブルシューティング

### よくある問題

#### 1. 色が表示されない
**原因**: `currentAxis` が不正な値
**解決**: デフォルト値（3）を使用するか、0-3の範囲を確認

#### 2. 全て同じ色になる
**原因**: 座標範囲（width_x/y/z）がゼロまたは非常に小さい
**解決**: データの境界ボックスを確認

#### 3. 色が極端（全て青または全て赤）
**原因**: 座標の正規化が正しくない
**解決**: `x_min`, `y_min`, `z_min` と `width_x`, `width_y`, `width_z` の値を確認

---

## まとめ

このカラーマップシステムは以下の特徴を持ちます：

1. **柔軟性**: 4種類の可視化モードをサポート
2. **効率性**: GPU上で並列計算、固定サイズのバッファ使用
3. **拡張性**: カラーパレットのカスタマイズが容易
4. **ユーザビリティ**: UIで簡単に切り替え可能

科学的可視化において、データを異なる角度から観察することは重要であり、このシステムはその要求を満たしています。
