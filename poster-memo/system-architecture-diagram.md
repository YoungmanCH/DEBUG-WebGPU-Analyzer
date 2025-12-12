# システムアーキテクチャ図（Mermaid版）

## Approach 1: WebGPU System Architecture

### フロー図

```mermaid
flowchart TD
    A[ユーザーインターフェース Browser<br/>- ファイル選択 5種フォーマット<br/>- カラーマップ切り替え 4種類]
    B[データローダー ファサードパターン<br/>COPC / LAS / LAZ / XYZ / TIF]
    C[Octree空間分割<br/>+ 視錐台カリング]
    D[3層キャッシュシステム<br/>L1: GPU Buffer 最速<br/>L2: LRU Cache 高速<br/>L3: Persistent 永続]
    E[Web Worker Pool 並列処理<br/>最大並列数 = CPU論理コア - 1]
    F[WebGPU レンダリングパイプライン<br/>WGSL シェーダー vec3/vec4]

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F

    style A fill:#e1f5e1
    style B fill:#e3f2fd
    style C fill:#fff3e0
    style D fill:#fce4ec
    style E fill:#f3e5f5
    style F fill:#e0f2f1
```

### 対応フォーマット表

```mermaid
%%{init: {'theme':'base'}}%%
graph TB
    subgraph formats["対応フォーマット"]
        copc["COPC<br/>.copc.laz<br/>vec4"]
        las["LAS<br/>.las<br/>vec3"]
        laz["LAZ<br/>.laz<br/>vec3"]
        xyz["XYZ<br/>.xyz<br/>vec3"]
        tif["TIF/TIFF<br/>.tif/.tiff<br/>vec3"]
    end

    style copc fill:#bbdefb
    style las fill:#c8e6c9
    style laz fill:#fff9c4
    style xyz fill:#ffccbc
    style tif fill:#f8bbd0
```

---

## パフォーマンス測定結果

### 描画FPSと初期読込時間

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'fontSize':'16px'}}}%%
xychart-beta
    title "パフォーマンス測定結果"
    x-axis [500万点, 1000万点, 5000万点, 1億点]
    y-axis "FPS" 0 --> 70
    bar [60, 58, 55, 52]
```

```mermaid
%%{init: {'theme':'base'}}%%
xychart-beta
    title "初期読込時間（秒）"
    x-axis [500万点, 1000万点, 5000万点, 1億点]
    y-axis "秒" 0 --> 8
    bar [2.3, 1.8, 4.5, 7.2]
```

---

## キャッシュ効率

### キャッシュヒット時の取得時間

```mermaid
%%{init: {'theme':'base'}}%%
graph LR
    subgraph cache["キャッシュ階層と取得時間"]
        L1["L1: GPU Buffer<br/>< 1ms<br/>⚡最速"]
        L2["L2: LRU Cache<br/>5-10ms<br/>🚀高速"]
        L3["L3: Persistent<br/>20-50ms<br/>💾永続"]
        MISS["キャッシュミス<br/>100-500ms<br/>🌐ネットワーク"]
    end

    L1 -.-> L2
    L2 -.-> L3
    L3 -.-> MISS

    style L1 fill:#4caf50,color:#fff
    style L2 fill:#8bc34a,color:#fff
    style L3 fill:#ffc107,color:#000
    style MISS fill:#ff5722,color:#fff
```

**ヒット率**: 85-92%

---

## 技術スタック

```mermaid
mindmap
  root((Approach 1<br/>WebGPU))
    コア技術
      WebGPU/WGSL
        GPU並列処理
      TypeScript 5.9.3
        型安全な開発
    レンダリング
      three.js
        カメラ制御
    データ処理
      laz-perf WASM
        LAZ解凍
      lru-cache
        LRUキャッシュ
      Origin Private FS
        永続化
```

---

## 実装済み機能

```mermaid
graph TD
    subgraph features["実装済み機能"]
        A[✓ 1億点規模の<br/>リアルタイム描画]
        B[✓ アウトオブコア<br/>レンダリング]
        C[✓ 4種類の<br/>カラーマップ]
        D[✓ LOD動的<br/>品質調整]
        E[✓ リアルタイム<br/>統計表示]
    end

    subgraph colormap["カラーマップ詳細"]
        C1[RGB Color<br/>実際の色]
        C2[Z-axis<br/>青→赤]
        C3[X-axis<br/>座標色]
        C4[Y-axis<br/>座標色]
    end

    C --> C1
    C --> C2
    C --> C3
    C --> C4

    style A fill:#e8f5e9
    style B fill:#e3f2fd
    style C fill:#fff3e0
    style D fill:#fce4ec
    style E fill:#f3e5f5
    style C1 fill:#ffebee
    style C2 fill:#e0f2f1
    style C3 fill:#fff9c4
    style C4 fill:#f3e5f5
```

---

## 動作環境

```mermaid
graph LR
    subgraph env["動作環境"]
        direction TB
        A[ブラウザ<br/>Chrome 113+<br/>Edge 113+]
        B[WebGPU<br/>対応必須]
        C[推奨環境<br/>8GB RAM<br/>2GB VRAM]
    end

    style A fill:#4285f4,color:#fff
    style B fill:#34a853,color:#fff
    style C fill:#fbbc04,color:#000
```

---

## GitHubでの表示

このMarkdownファイルをGitHubにpushすると、Mermaid図が自動的にレンダリングされます。

## PowerPoint/Keynoteでの使用

1. **Mermaid Live Editor**を使用
   - https://mermaid.live/
   - 上記のコードをコピペ
   - PNG/SVGでエクスポート

2. **VS Code拡張機能**を使用
   - "Markdown Preview Mermaid Support"
   - プレビューからスクリーンショット

3. **コマンドラインツール**
   ```bash
   npm install -g @mermaid-js/mermaid-cli
   mmdc -i diagram.md -o diagram.png
   ```
