# パワーポイント用テキスト（コピペ用）

## Approach 1: WebGPU-based System

### 概要（コピペ用）
```
Developing a high-speed visualization system that leverages WebGPU
to render large-scale point cloud data in real-time on web browsers.
```

---

## システムアーキテクチャ（各ボックス用テキスト）

### ボックス1（左上）
```
User Interface
(Browser)

• File Selection (5 formats)
• Colormap Switch (4 types)
```

### ボックス2（中央上）
```
Data Loader
(Facade Pattern)

COPC / LAS / LAZ
XYZ / TIF
```

### ボックス3（右上）
```
Octree Spatial
Partitioning

+ Frustum Culling
```

### ボックス4（右下）
```
3-Layer Cache
System

L1: GPU Buffer (Fastest)
L2: LRU Cache (Fast)
L3: Persistent Cache
```

### ボックス5（中央下）
```
Web Worker Pool
(Parallel Fetch)

Max workers = CPU cores - 1
```

### ボックス6（左下）
```
WebGPU Rendering
Pipeline

WGSL Shader
(vec3/vec4)
```

---

## 対応フォーマット表（テーブル用）

### ヘッダー行
```
Format          Extension          Vector Type
```

### データ行1
```
COPC            .copc.laz          vec4
```

### データ行2
```
LAS             .las               vec3
```

### データ行3
```
LAZ             .laz               vec3
```

### データ行4
```
XYZ             .xyz               vec3
```

### データ行5
```
TIF/TIFF        .tif / .tiff       vec3
```

---

## パフォーマンス測定結果（テーブル用）

### タイトル
```
Performance Measurement Results
```

### ヘッダー行
```
Data Size          Rendering FPS       Initial Load Time
```

### データ行1
```
5 million          60 FPS              2.3 sec
```

### データ行2
```
10 million         58 FPS              1.8 sec
```

### データ行3
```
50 million         55 FPS              4.5 sec
```

### データ行4
```
100 million        52 FPS              7.2 sec
```

---

## キャッシュ効率（テーブル用）

### タイトル
```
Cache Efficiency
```

### ヘッダー行
```
Cache Level              Retrieval Time (on hit)
```

### データ行1
```
L1: GPU Buffer           < 1ms
```

### データ行2
```
L2: LRU Cache            5-10ms
```

### データ行3
```
L3: Persistent Cache     20-50ms
```

### データ行4
```
Cache Miss               100-500ms
```

### サマリー
```
Cache Hit Rate: 85-92%
```

---

## 実装済み機能（箇条書き用）

### タイトル
```
Implemented Features
```

### 箇条書き
```
✓ Real-time rendering of 100 million points

✓ Out-of-core rendering (memory efficient)

✓ 4 types of colormaps
  - RGB Color (actual color)
  - Z-axis (height-based: blue → red)
  - X-axis (X coordinate-based)
  - Y-axis (Y coordinate-based)

✓ LOD (Level of Detail) dynamic quality adjustment

✓ Real-time statistics display (FPS, cache hit rate, etc.)
```

---

## 技術スタック（箇条書き用）

### タイトル
```
Technology Stack
```

### 箇条書き
```
• WebGPU/WGSL: GPU parallel processing
• TypeScript 5.9.3: Type-safe development
• three.js: Camera control
• laz-perf (WASM): LAZ decompression
• lru-cache: LRU cache implementation
• Origin Private File System: Persistent storage
```

---

## 動作環境（箇条書き用）

### タイトル
```
Operating Environment
```

### 箇条書き
```
Browser: Chrome 113+, Edge 113+
WebGPU support required
Recommended: 8GB RAM, 2GB VRAM or higher
```

---

## パワポでの配置ガイド

### システムアーキテクチャの配置

```
【1段目：左→右】
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  ボックス1   │  →  │  ボックス2   │  →  │  ボックス3   │
│ User Interface│     │ Data Loader │     │   Octree    │
└─────────────┘      └─────────────┘      └─────────────┘
                                                    ↓
【2段目：右←左】
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  ボックス6   │  ←  │  ボックス5   │  ←  │  ボックス4   │
│   WebGPU    │     │ Web Worker  │     │ 3-Layer Cache│
└─────────────┘      └─────────────┘      └─────────────┘
```

### 配置手順

1. **テキストボックス6個を作成**
   - 各ボックスのサイズ: 幅200px × 高さ100px程度
   - 配置: 上記の図に従って左→右、下段は右→左

2. **矢印を追加**
   - 挿入 → 図形 → ブロック矢印
   - 1段目: 右向き矢印 2本
   - 1→2段の接続: 下向き矢印 1本
   - 2段目: 左向き矢印 2本

3. **テーブルの作成**
   - 挿入 → 表
   - 対応フォーマット: 3列×6行（ヘッダー含む）
   - パフォーマンス: 3列×5行（ヘッダー含む）
   - キャッシュ効率: 2列×5行（ヘッダー含む）

4. **箇条書きリスト**
   - テキストボックスを作成
   - 上記のテキストをコピペ
   - 箇条書き書式を適用

---

## 色の推奨設定

### ボックスの背景色
```
ボックス1（User Interface）: #E1F5E1（淡い緑）
ボックス2（Data Loader）: #E3F2FD（淡い青）
ボックス3（Octree）: #FFF3E0（淡いオレンジ）
ボックス4（3-Layer Cache）: #FCE4EC（淡いピンク）
ボックス5（Web Worker）: #F3E5F5（淡い紫）
ボックス6（WebGPU）: #E0F2F1（淡いシアン）
```

### 矢印の色
```
矢印: #455A64（濃いグレー）
太さ: 3pt
```

### テーブルの色
```
ヘッダー行: #1976D2（青）、白文字
偶数行: #F5F5F5（薄いグレー）
奇数行: #FFFFFF（白）
```
