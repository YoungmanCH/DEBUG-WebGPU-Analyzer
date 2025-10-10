# 今後の課題と改善点

**最終更新日**: 2025-10-10

このドキュメントでは、DEBUG-WebGPU-Analyzerプロジェクトにおける今後の課題、改善案、機能追加の提案をまとめています。

---

## 📋 目次

- [優先度の高い課題](#優先度の高い課題)
- [機能追加の提案](#機能追加の提案)
- [パフォーマンス改善](#パフォーマンス改善)
- [コード品質向上](#コード品質向上)
- [ドキュメント改善](#ドキュメント改善)
- [テスト戦略](#テスト戦略)
- [ユーザビリティ向上](#ユーザビリティ向上)
- [技術的負債](#技術的負債)
- [長期的な展望](#長期的な展望)

---

## 優先度の高い課題

### 🔴 緊急度: 高

#### 1. LAZ v1.4 ネイティブサポート

**現状**:
- LAZ v1.4ファイルは外部ツール（laz-converter）による変換が必要
- ユーザーは手動でv1.3に変換する必要がある

**問題点**:
```typescript
// src/loaders/las-loader.ts:58
// TODO: update
// 現在はv1.0-1.3のみ対応
```

**改善案**:
- laz-perf WASMライブラリのv1.4対応版を調査
- または別のLAZ解凍ライブラリの導入を検討
- ブラウザ内で自動変換する機能の実装

**実装見積もり**: 中規模（2-3週間）

**参考**:
- laz-perf: https://github.com/hobuinc/laz-perf
- LASzip: https://laszip.org/

---

#### 2. エラーハンドリングの強化

**現状**:
- エラー発生時のユーザー通知が不十分
- 一部のエラーがコンソールにのみ表示される

**問題点**:
```typescript
// src/index.ts:36-54
// エラーをUIに表示しているが、すべてのローダーで統一されていない
```

**改善案**:

1. **統一エラーハンドラの実装**:
```typescript
// src/utils/error-handler.ts (新規作成)
export class ErrorHandler {
  static displayError(error: Error, context: string) {
    const statsDiv = document.getElementById("stats-div");
    if (statsDiv) {
      statsDiv.innerHTML = `
        <div class="error-message">
          <h3>❌ Error in ${context}</h3>
          <p>${error.message}</p>
          <details>
            <summary>Technical Details</summary>
            <pre>${error.stack}</pre>
          </details>
        </div>
      `;
    }
    console.error(`[${context}]`, error);
  }
}
```

2. **すべてのローダーでの適用**:
- COPCLoader
- LASLoader
- XYZLoader
- TIFLoader

**実装見積もり**: 小規模（1週間）

---

#### 3. GPU Buffer のラベリング改善

**現状**:
- WebGPU Bufferにラベルがないためデバッグが困難
- Chrome DevToolsでバッファの識別が難しい

**問題点**:
```typescript
// src/webgpu/webgpu-buffer.ts:42
// TODO: label経由でrendererで各点毎の要素数を取得しているが、
// 文字列表記で返すのはカスなので修正。
```

**改善案**:

1. **型安全なラベリングシステム**:
```typescript
// src/types/buffer-types.ts (新規)
export enum BufferLabel {
  COPC_POSITION = "copc-position",
  COPC_COLOR = "copc-color",
  LAS_POSITION = "las-position",
  LAS_COLOR = "las-color",
  // ...
}

export interface BufferMetadata {
  label: BufferLabel;
  elementsPerPoint: number;
  vectorType: "vec3" | "vec4";
}

// src/webgpu/webgpu-buffer.ts
export function createBuffer(
  positions: Float32Array,
  colors: Float32Array,
  metadata: BufferMetadata
): [GPUBuffer, GPUBuffer] {
  const positionBuffer = device.createBuffer({
    size: positions.length * 4,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
    label: `${metadata.label}-position`, // 明示的なラベル
  });

  // ...
}
```

**実装見積もり**: 中規模（1-2週間）

---

### 🟡 緊急度: 中

#### 4. メモリリークの監視と防止

**現状**:
- 長時間使用時のメモリリークが懸念される
- GPUバッファの解放が適切に行われているか不明

**改善案**:

1. **メモリ監視システムの実装**:
```typescript
// src/utils/memory-monitor.ts (新規)
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private intervalId: number;

  startMonitoring(intervalMs: number = 5000) {
    this.intervalId = setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        console.log({
          usedJSHeapSize: (memory.usedJSHeapSize / 1048576).toFixed(2) + " MB",
          totalJSHeapSize: (memory.totalJSHeapSize / 1048576).toFixed(2) + " MB",
          jsHeapSizeLimit: (memory.jsHeapSizeLimit / 1048576).toFixed(2) + " MB",
        });

        // 閾値を超えたら警告
        if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.9) {
          console.warn("⚠️ Memory usage is high!");
        }
      }
    }, intervalMs);
  }

  stopMonitoring() {
    clearInterval(this.intervalId);
  }
}
```

2. **GPUバッファの自動クリーンアップ**:
```typescript
// src/cache/buffer-cleanup.ts (新規)
export class BufferCleanup {
  static cleanupUnusedBuffers() {
    const currentTime = Date.now();
    for (const [key, buffer] of Object.entries(appState.bufferMap)) {
      // 最終アクセスから10分以上経過したバッファを削除
      if (currentTime - buffer.lastAccessed > 600000) {
        buffer.position.destroy();
        buffer.color.destroy();
        delete appState.bufferMap[key];
      }
    }
  }
}
```

**実装見積もり**: 中規模（2週間）

---

#### 5. Web Worker のエラーリカバリ

**現状**:
- Workerがクラッシュした場合のリカバリ機能がない
- ネットワークエラー時の再試行がない

**改善案**:

```typescript
// src/worker/worker-manager.ts
export class RobustWorkerManager {
  private maxRetries = 3;

  async executeWithRetry(task: any, retries = 0): Promise<any> {
    try {
      return await this.execute(task);
    } catch (error) {
      if (retries < this.maxRetries) {
        console.warn(`Worker failed, retrying (${retries + 1}/${this.maxRetries})`);
        await this.delay(1000 * Math.pow(2, retries)); // Exponential backoff
        return this.executeWithRetry(task, retries + 1);
      } else {
        throw new Error(`Worker failed after ${this.maxRetries} retries: ${error}`);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**実装見積もり**: 小規模（1週間）

---

## 機能追加の提案

### 1. 複数ファイルの同時読み込み

**現状**:
- **1つのファイルのみ読み込み可能**
- `src/index.ts` の `_initializeFileData()` で1つのローダーのみを選択
- 複数のデータセットを同時に表示できない

**問題点**:
```typescript
// src/index.ts
async function _initializeFileData() {
  // 以下のいずれか1つのみ選択可能
  // const { filename, vectorType } = _copc_file_loader();
  // const { filename, vectorType } = _las_file_loader();
  const { filename, vectorType } = _laz_file_loader();  // ← 1つのみアクティブ
  // const { filename, vectorType } = _xyz_file_loader();
  // const { filename, vectorType } = _tif_file_loader();

  await initializePointCloud(filename);  // 単一ファイル
  return { filename, vectorType };
}
```

**制限事項**:
- ✗ 建物と地形を同時に表示できない
- ✗ 異なる時期のデータを比較できない
- ✗ 複数のLiDARスキャンを統合できない
- ✗ データセットごとの表示/非表示切り替えができない

**`.env` の複数ファイル設定は未対応**:
```bash
# .env
# 配列形式で記述可能だが、現在は使用されていない
POINT_CLOUD_FILES=["dataset/las/file1.las", "dataset/xyz/file2.xyz"]
```

**改善提案**:

1. **DatasetManager の実装**:
```typescript
// src/multi-file/dataset-manager.ts (新規)
export class DatasetManager {
  private datasets: Map<string, PointCloudData> = new Map();

  async loadDataset(id: string, file: string) {
    const loader = this.getLoaderForFile(file);
    const data = await loader.loadFile(file);
    this.datasets.set(id, data);
    return data;
  }

  async loadMultipleDatasets(files: Array<{id: string, path: string}>) {
    const promises = files.map(f => this.loadDataset(f.id, f.path));
    return await Promise.all(promises);
  }

  getDataset(id: string): PointCloudData | undefined {
    return this.datasets.get(id);
  }

  getAllDatasets(): PointCloudData[] {
    return Array.from(this.datasets.values());
  }

  removeDataset(id: string): boolean {
    return this.datasets.delete(id);
  }

  toggleDatasetVisibility(id: string, visible: boolean) {
    const dataset = this.datasets.get(id);
    if (dataset) {
      dataset.visible = visible;
      // GPU バッファの更新
    }
  }

  // データセットのマージ（オプション）
  async mergeDatasets(ids: string[]): Promise<PointCloudData> {
    const merged = {
      positions: [],
      colors: [],
      intensities: [],
      classifications: []
    };

    for (const id of ids) {
      const dataset = this.datasets.get(id);
      if (dataset && dataset.visible) {
        merged.positions.push(...dataset.points.positions);
        merged.colors.push(...dataset.points.colors);
        // ...
      }
    }

    return merged;
  }
}
```

2. **index.ts の改善**:
```typescript
// src/index.ts
async function _initializeMultipleFiles() {
  const datasetManager = new DatasetManager();

  // .env の POINT_CLOUD_FILES から読み込み
  const files = _files_loader(); // 既存の関数を活用

  const datasets = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const id = `dataset-${i}`;
    const data = await datasetManager.loadDataset(id, file);
    datasets.push({ id, filename: file, data });

    // プログレスバー表示
    console.log(`Loaded ${i + 1}/${files.length}: ${file}`);
  }

  return { datasetManager, datasets };
}
```

3. **UI でのデータセット管理**:
```html
<!-- public/index.html に追加 -->
<div id="dataset-panel">
  <h3>Loaded Datasets</h3>
  <ul id="dataset-list">
    <!-- 動的に追加 -->
  </ul>
  <button id="add-dataset-btn">+ Add Dataset</button>
</div>
```

```typescript
// src/views/dataset-panel.ts (新規)
export class DatasetPanel {
  private manager: DatasetManager;

  updateUI() {
    const list = document.getElementById('dataset-list');
    list.innerHTML = '';

    this.manager.getAllDatasets().forEach((dataset, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <input type="checkbox"
               id="dataset-${index}"
               ${dataset.visible ? 'checked' : ''}>
        <label for="dataset-${index}">
          ${dataset.filename} (${dataset.points.numPoints} points)
        </label>
        <button class="remove-btn" data-id="${index}">×</button>
      `;

      // イベントリスナー
      const checkbox = li.querySelector('input');
      checkbox.addEventListener('change', (e) => {
        this.manager.toggleDatasetVisibility(index, e.target.checked);
      });

      list.appendChild(li);
    });
  }
}
```

**実装見積もり**: 大規模（4-5週間）

**優先度**: 🔵 P4（長期展望）

**関連ドキュメント**:
- `docs/file-loading-configuration.md` - 現在の単一ファイル読み込み方法
- セクション「3. マルチファイル・マルチデータセット対応」（本ドキュメント後半）でも詳細を記載

---

### 2. ファイル選択UI

**現状**:
- ファイルパスをコードで直接指定する必要がある
- `src/configs.ts` と `src/index.ts` を編集する必要がある

**提案**:

```html
<!-- public/index.html に追加 -->
<div id="file-selector">
  <input type="file" id="file-input" accept=".copc.laz,.laz,.las,.xyz,.tif,.tiff">
  <button id="load-button">Load Point Cloud</button>
</div>
```

```typescript
// src/views/file-selector.ts (新規)
export class FileSelector {
  static async loadFromFile(file: File) {
    const extension = file.name.split('.').pop()?.toLowerCase();

    const arrayBuffer = await file.arrayBuffer();
    const loader = this.getLoaderForExtension(extension);

    const data = await loader.loadFromBuffer(arrayBuffer);
    return data;
  }

  private static getLoaderForExtension(ext: string) {
    switch (ext) {
      case 'laz': return new LASLoader();
      case 'las': return new LASLoader();
      case 'xyz': return new XYZLoader();
      case 'tif':
      case 'tiff': return new TIFLoader();
      default: throw new Error(`Unsupported file type: ${ext}`);
    }
  }
}
```

**メリット**:
- ユーザーフレンドリー
- ローカルファイルの読み込みが簡単
- 開発時の効率向上

**実装見積もり**: 中規模（1-2週間）

---

### 2. カメラコントロールの改善

**現状**:
- three.jsのOrbitControlsに依存
- カメラ操作が限定的

**提案**:

1. **カメラプリセット機能**:
```typescript
// src/views/camera-presets.ts (新規)
export class CameraPresets {
  static topView(camera: THREE.Camera, boundingBox: BoundingBox) {
    const center = boundingBox.getCenter();
    camera.position.set(center.x, boundingBox.max.y + 100, center.z);
    camera.lookAt(center.x, center.y, center.z);
  }

  static frontView(camera: THREE.Camera, boundingBox: BoundingBox) {
    // ...
  }

  static sideView(camera: THREE.Camera, boundingBox: BoundingBox) {
    // ...
  }
}
```

2. **カメラパス録画・再生**:
```typescript
// src/views/camera-recorder.ts (新規)
export class CameraRecorder {
  private keyframes: Array<{time: number, position: vec3, rotation: quat}> = [];

  record(camera: THREE.Camera) {
    this.keyframes.push({
      time: Date.now(),
      position: camera.position.toArray(),
      rotation: camera.quaternion.toArray()
    });
  }

  async playback(camera: THREE.Camera) {
    // キーフレームを補間して再生
  }
}
```

**実装見積もり**: 中規模（2週間）

---

### 3. 点群フィルタリング機能

**現状**:
- すべての点を表示
- 特定の条件での絞り込みができない

**提案**:

```typescript
// src/filters/point-filter.ts (新規)
export interface FilterCriteria {
  intensityRange?: [number, number];
  classificationIds?: number[];
  heightRange?: [number, number];
  colorRange?: {r: [number, number], g: [number, number], b: [number, number]};
}

export class PointFilter {
  static filter(points: PointData, criteria: FilterCriteria): PointData {
    const filtered = {
      positions: [],
      colors: [],
      intensities: [],
      classifications: []
    };

    for (let i = 0; i < points.positions.length / 3; i++) {
      const z = points.positions[i * 3 + 2];
      const intensity = points.intensities?.[i];
      const classification = points.classifications?.[i];

      // 高さフィルタ
      if (criteria.heightRange) {
        if (z < criteria.heightRange[0] || z > criteria.heightRange[1]) {
          continue;
        }
      }

      // 輝度フィルタ
      if (criteria.intensityRange && intensity !== undefined) {
        if (intensity < criteria.intensityRange[0] || intensity > criteria.intensityRange[1]) {
          continue;
        }
      }

      // 分類フィルタ
      if (criteria.classificationIds && classification !== undefined) {
        if (!criteria.classificationIds.includes(classification)) {
          continue;
        }
      }

      // フィルタを通過した点を追加
      filtered.positions.push(
        points.positions[i * 3],
        points.positions[i * 3 + 1],
        points.positions[i * 3 + 2]
      );
      filtered.colors.push(
        points.colors[i * 3],
        points.colors[i * 3 + 1],
        points.colors[i * 3 + 2]
      );
    }

    return filtered;
  }
}
```

**UI例**:
```html
<div id="filter-panel">
  <h3>Point Cloud Filters</h3>
  <label>
    Height Range:
    <input type="range" id="height-min" min="0" max="1000">
    <input type="range" id="height-max" min="0" max="1000">
  </label>
  <label>
    Intensity Range:
    <input type="range" id="intensity-min" min="0" max="65535">
    <input type="range" id="intensity-max" min="0" max="65535">
  </label>
  <label>
    Classification:
    <select multiple id="classification-filter">
      <option value="2">Ground</option>
      <option value="3">Low Vegetation</option>
      <option value="4">Medium Vegetation</option>
      <option value="5">High Vegetation</option>
      <option value="6">Building</option>
    </select>
  </label>
</div>
```

**実装見積もり**: 大規模（3-4週間）

---

### 4. 測定ツール

**現状**:
- 点群の可視化のみ
- 距離や面積の測定ができない

**提案**:

```typescript
// src/tools/measurement-tool.ts (新規)
export class MeasurementTool {
  private points: vec3[] = [];

  addPoint(point: vec3) {
    this.points.push(point);
  }

  // 2点間の距離
  getDistance(): number {
    if (this.points.length < 2) return 0;
    const [p1, p2] = this.points;
    return vec3.distance(p1, p2);
  }

  // 3点で定義される面積
  getArea(): number {
    if (this.points.length < 3) return 0;
    const [p1, p2, p3] = this.points;
    const v1 = vec3.subtract(vec3.create(), p2, p1);
    const v2 = vec3.subtract(vec3.create(), p3, p1);
    const cross = vec3.cross(vec3.create(), v1, v2);
    return vec3.length(cross) / 2;
  }

  // 高低差
  getElevationDifference(): number {
    if (this.points.length < 2) return 0;
    const heights = this.points.map(p => p[2]);
    return Math.max(...heights) - Math.min(...heights);
  }

  // ポリライン長
  getPolylineLength(): number {
    if (this.points.length < 2) return 0;
    let totalLength = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      totalLength += vec3.distance(this.points[i], this.points[i + 1]);
    }
    return totalLength;
  }

  clear() {
    this.points = [];
  }
}
```

**UI統合**:
- マウスクリックで測定点を追加
- リアルタイムで測定結果を表示
- ESCキーで測定をリセット

**実装見積もり**: 大規模（3-4週間）

---

### 5. スクリーンショット・エクスポート機能

**提案**:

```typescript
// src/utils/screenshot.ts (新規)
export class Screenshot {
  static async capture(canvas: HTMLCanvasElement, filename: string = 'pointcloud.png') {
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  static async captureHighRes(
    canvas: HTMLCanvasElement,
    scale: number = 2
  ): Promise<Blob> {
    // 高解像度レンダリング
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;

    canvas.width = originalWidth * scale;
    canvas.height = originalHeight * scale;

    // 再レンダリング
    await new Promise(resolve => requestAnimationFrame(resolve));

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });

    // 元のサイズに戻す
    canvas.width = originalWidth;
    canvas.height = originalHeight;

    return blob;
  }
}
```

**実装見積もり**: 小規模（1週間）

---

## パフォーマンス改善

### 1. Octree構築の最適化

**現状**:
- Octree構築が同期的で大規模データでは時間がかかる

**改善案**:

```typescript
// src/octree/async-octree-builder.ts (新規)
export class AsyncOctreeBuilder {
  async buildIncrementally(
    points: PointData,
    chunkSize: number = 100000,
    onProgress?: (progress: number) => void
  ): Promise<Octree> {
    const octree = new Octree(/* ... */);
    const totalPoints = points.positions.length / 3;

    for (let i = 0; i < totalPoints; i += chunkSize) {
      const end = Math.min(i + chunkSize, totalPoints);
      const chunk = this.extractChunk(points, i, end);

      // チャンクごとにOctreeに追加
      await this.addChunkToOctree(octree, chunk);

      // 進捗通知
      if (onProgress) {
        onProgress(end / totalPoints);
      }

      // UIをブロックしないよう一時停止
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return octree;
  }
}
```

**実装見積もり**: 中規模（2週間）

---

### 2. LODの動的調整

**現状**:
- 固定のLOD戦略
- カメラ距離に応じた最適化が不十分

**改善案**:

```typescript
// src/octree/dynamic-lod.ts (新規)
export class DynamicLOD {
  static calculateLODLevel(
    nodeDepth: number,
    distanceToCamera: number,
    screenSpaceError: number
  ): number {
    // カメラからの距離に応じてLODレベルを調整
    const baseLOD = nodeDepth;

    if (distanceToCamera < 10) {
      return baseLOD; // 最高詳細度
    } else if (distanceToCamera < 50) {
      return Math.max(0, baseLOD - 1);
    } else if (distanceToCamera < 100) {
      return Math.max(0, baseLOD - 2);
    } else {
      return Math.max(0, baseLOD - 3);
    }
  }

  static calculatePointSize(lodLevel: number, baseSize: number = 3.0): number {
    // LODレベルに応じて点のサイズを調整
    return baseSize * Math.pow(0.6, lodLevel);
  }
}
```

**シェーダー統合**:
```wgsl
// src/shaders/vec4-shader.wgsl
@vertex
fn main(in: VertexInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOut {
    var level: f32 = in.position.w;
    var distanceToCamera: f32 = length(in.position.xyz - cameraPosition);

    // 動的LOD計算
    var adjustedLevel: f32 = level + floor(distanceToCamera / 50.0);
    var radius: f32 = 3.0 * pow(0.6, adjustedLevel);
    radius = max(radius, 0.5); // 最小サイズ

    // ...
}
```

**実装見積もり**: 中規模（2週間）

---

### 3. Web Worker Poolのスケーリング

**現状**:
- Worker数が固定（CPU論理コア数 - 1）
- タスクの種類によって最適なWorker数が異なる

**改善案**:

```typescript
// src/worker/adaptive-worker-pool.ts (新規)
export class AdaptiveWorkerPool {
  private minWorkers = 2;
  private maxWorkers = navigator.hardwareConcurrency || 4;
  private currentWorkers: Worker[] = [];

  async scaleUp(targetSize: number) {
    while (this.currentWorkers.length < Math.min(targetSize, this.maxWorkers)) {
      const worker = new Worker(/* ... */);
      this.currentWorkers.push(worker);
    }
  }

  async scaleDown(targetSize: number) {
    while (this.currentWorkers.length > Math.max(targetSize, this.minWorkers)) {
      const worker = this.currentWorkers.pop();
      worker?.terminate();
    }
  }

  async autoScale(queueLength: number) {
    // キューの長さに応じて自動的にスケール
    const optimalWorkers = Math.min(
      Math.ceil(queueLength / 10),
      this.maxWorkers
    );

    if (optimalWorkers > this.currentWorkers.length) {
      await this.scaleUp(optimalWorkers);
    } else if (optimalWorkers < this.currentWorkers.length) {
      await this.scaleDown(optimalWorkers);
    }
  }
}
```

**実装見積もり**: 中規模（2週間）

---

### 4. キャッシュのプリロード戦略

**現状**:
- 視界に入ってから初めてノードを取得
- カメラ移動方向の予測がない

**改善案**:

```typescript
// src/cache/predictive-prefetch.ts (新規)
export class PredictivePrefetch {
  private cameraHistory: Array<{position: vec3, time: number}> = [];
  private maxHistoryLength = 10;

  recordCameraPosition(position: vec3) {
    this.cameraHistory.push({
      position: vec3.clone(position),
      time: Date.now()
    });

    if (this.cameraHistory.length > this.maxHistoryLength) {
      this.cameraHistory.shift();
    }
  }

  predictNextRegion(octree: Octree): string[] {
    if (this.cameraHistory.length < 2) return [];

    // カメラの移動ベクトルを計算
    const last = this.cameraHistory[this.cameraHistory.length - 1];
    const previous = this.cameraHistory[this.cameraHistory.length - 2];

    const velocity = vec3.subtract(
      vec3.create(),
      last.position,
      previous.position
    );
    const timeDelta = last.time - previous.time;

    // 次の位置を予測（等速直線運動を仮定）
    const predictedPosition = vec3.scaleAndAdd(
      vec3.create(),
      last.position,
      velocity,
      1000 / timeDelta // 1秒後の位置
    );

    // 予測位置周辺のノードを取得
    return octree.getNodesNear(predictedPosition, 50);
  }

  async prefetchPredictedNodes(
    nodeKeys: string[],
    filename: string
  ) {
    // バックグラウンドでノードをプリフェッチ
    for (const key of nodeKeys) {
      if (!lruCache.has(key)) {
        // 低優先度でWorkerに投げる
        await this.fetchNodeAsync(key, filename);
      }
    }
  }
}
```

**実装見積もり**: 大規模（3週間）

---

## コード品質向上

### 1. TypeScript型安全性の強化

**現状**:
- 一部で `any` 型の使用
- 型定義が不完全

**改善案**:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noUncheckedIndexedAccess": true, // 追加
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

**既存コードの修正**:
```typescript
// Before
function processData(data: any) {
  return data.position;
}

// After
interface PointCloudData {
  position: Float32Array;
  color: Float32Array;
  maxIntensity?: number;
}

function processData(data: PointCloudData): Float32Array {
  return data.position;
}
```

**実装見積もり**: 大規模（4週間）

---

### 2. ユニットテストの拡充

**現状**:
- テストが不十分（package.jsonにJest設定はあるが実装が少ない）

**提案**:

```typescript
// tests/loaders/las-loader.test.ts
import { describe, it, expect } from '@jest/globals';
import { LASLoader } from '../../src/loaders/las-loader';

describe('LASLoader', () => {
  it('should load LAS file correctly', async () => {
    const loader = new LASLoader();
    const data = await loader.loadFile('dataset/las/sample.las');

    expect(data.header).toBeDefined();
    expect(data.points.positions).toBeInstanceOf(Float32Array);
    expect(data.points.colors).toBeInstanceOf(Float32Array);
  });

  it('should detect LAZ version', async () => {
    const loader = new LASLoader();
    const version = await loader.detectVersion('dataset/laz/sample.laz');

    expect(version).toMatch(/^1\.[0-3]$/);
  });

  it('should throw error for unsupported LAZ v1.4', async () => {
    const loader = new LASLoader();

    await expect(
      loader.loadFile('dataset/laz/v14_sample.laz')
    ).rejects.toThrow('LAZ v1.4 is not supported');
  });
});
```

**カバレッジ目標**:
- ローダー: 80%以上
- キャッシュシステム: 90%以上
- Octree: 85%以上
- レンダラー: 70%以上（WebGPU部分は統合テスト）

**実装見積もり**: 大規模（6週間）

---

### 3. E2Eテストの追加

**現状**:
- Playwrightの設定はあるが実装が不十分

**提案**:

```typescript
// tests/e2e/point-cloud-rendering.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Point Cloud Rendering', () => {
  test('should render LAS file', async ({ page }) => {
    await page.goto('http://localhost:8080');

    // ファイルが読み込まれるまで待機
    await page.waitForSelector('canvas', { timeout: 10000 });

    // WebGPUが初期化されたか確認
    const hasWebGPU = await page.evaluate(() => {
      return 'gpu' in navigator;
    });
    expect(hasWebGPU).toBe(true);

    // 統計情報が表示されているか確認
    const statsText = await page.textContent('#stats-div');
    expect(statsText).toContain('Total Points');

    // スクリーンショット比較
    await expect(page).toHaveScreenshot('las-rendering.png', {
      maxDiffPixels: 100
    });
  });

  test('should switch color maps', async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.waitForSelector('canvas');

    // RGBカラー
    await page.selectOption('#colormap-select', 'rgb');
    await expect(page).toHaveScreenshot('colormap-rgb.png');

    // Z軸カラーマップ
    await page.selectOption('#colormap-select', 'z-axis');
    await expect(page).toHaveScreenshot('colormap-z.png');
  });

  test('should handle camera controls', async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.waitForSelector('canvas');

    const canvas = page.locator('canvas');

    // マウスドラッグでカメラ回転
    await canvas.hover();
    await page.mouse.down();
    await page.mouse.move(100, 100);
    await page.mouse.up();

    // カメラが動いたことを確認（統計情報の変化で判定）
    const statsAfter = await page.textContent('#stats-div');
    expect(statsAfter).toBeDefined();
  });
});
```

**実装見積もり**: 中規模（3週間）

---

### 4. ESLint/Prettier の導入

**提案**:

```json
// .eslintrc.json (新規)
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

```json
// .prettierrc (新規)
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

**package.json に追加**:
```json
{
  "scripts": {
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write 'src/**/*.{ts,js,json,md}'"
  }
}
```

**実装見積もり**: 小規模（1週間）

---

## ドキュメント改善

### 1. API リファレンスドキュメント

**提案**:

TypeDocを使用した自動生成

```bash
npm install --save-dev typedoc
```

```json
// typedoc.json (新規)
{
  "entryPoints": ["src/index.ts"],
  "out": "docs/api",
  "exclude": ["**/*.test.ts", "**/*.spec.ts"],
  "plugin": ["typedoc-plugin-markdown"]
}
```

**package.json に追加**:
```json
{
  "scripts": {
    "docs:generate": "typedoc"
  }
}
```

**実装見積もり**: 小規模（1週間）

---

### 2. チュートリアルドキュメント

**提案**:

```markdown
# docs/tutorials/getting-started.md (新規)

## はじめに

このチュートリアルでは、DEBUG-WebGPU-Analyzerを使って
初めての点群データを表示する方法を学びます。

### ステップ1: データの準備

1. サンプルLASファイルをダウンロード
2. `dataset/las/` に配置

### ステップ2: 設定ファイルの編集

...
```

```markdown
# docs/tutorials/custom-colormap.md (新規)

## カスタムカラーマップの作成

独自のカラーマップを追加する方法...
```

**実装見積もり**: 中規模（2週間）

---

## テスト戦略

### 1. テスト自動化パイプライン

**提案**:

```yaml
# .github/workflows/ci.yml (新規)
name: CI

on:
  push:
    branches: [ main, feature/** ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linter
      run: npm run lint

    - name: Run unit tests
      run: npm run test:coverage

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/coverage-final.json

    - name: Install Playwright
      run: npx playwright install --with-deps

    - name: Run E2E tests
      run: npm run test:visual

    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: playwright-report
        path: playwright-report/
```

**実装見積もり**: 小規模（1週間）

---

### 2. パフォーマンステスト

**提案**:

```typescript
// tests/performance/rendering-benchmark.test.ts
import { performance } from 'perf_hooks';

describe('Rendering Performance', () => {
  it('should render 1M points at 60fps', async () => {
    const startTime = performance.now();
    const frames = [];

    for (let i = 0; i < 60; i++) {
      const frameStart = performance.now();
      await renderer.render();
      const frameEnd = performance.now();
      frames.push(frameEnd - frameStart);
    }

    const avgFrameTime = frames.reduce((a, b) => a + b) / frames.length;
    const fps = 1000 / avgFrameTime;

    expect(fps).toBeGreaterThanOrEqual(60);
  });

  it('should cache nodes efficiently', async () => {
    const cacheHitRate = await measureCacheHitRate();
    expect(cacheHitRate).toBeGreaterThanOrEqual(0.8); // 80%以上
  });
});
```

**実装見積もり**: 中規模（2週間）

---

## ユーザビリティ向上

### 1. プログレスバー

**提案**:

```typescript
// src/views/progress-bar.ts (新規)
export class ProgressBar {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'progress-bar';
    this.element.innerHTML = `
      <div class="progress-container">
        <div class="progress-bar-fill" style="width: 0%"></div>
        <span class="progress-text">Loading...</span>
      </div>
    `;
    document.body.appendChild(this.element);
  }

  update(progress: number, message: string = '') {
    const fill = this.element.querySelector('.progress-bar-fill') as HTMLDivElement;
    const text = this.element.querySelector('.progress-text') as HTMLSpanElement;

    fill.style.width = `${progress * 100}%`;
    text.textContent = message || `${(progress * 100).toFixed(1)}%`;
  }

  hide() {
    this.element.style.display = 'none';
  }

  show() {
    this.element.style.display = 'block';
  }
}
```

**統合例**:
```typescript
// src/loaders/las-loader.ts
const progressBar = new ProgressBar();
progressBar.show();

await loader.loadFile(filename, {
  onProgress: (loaded, total) => {
    progressBar.update(loaded / total, `Loading LAS file: ${loaded}/${total} bytes`);
  }
});

progressBar.hide();
```

**実装見積もり**: 小規模（1週間）

---

### 2. キーボードショートカット

**提案**:

```typescript
// src/views/keyboard-shortcuts.ts (新規)
export class KeyboardShortcuts {
  private shortcuts = new Map<string, () => void>();

  register(key: string, callback: () => void) {
    this.shortcuts.set(key.toLowerCase(), callback);
  }

  initialize() {
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();

      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd + キー
        const shortcut = `ctrl+${key}`;
        const callback = this.shortcuts.get(shortcut);
        if (callback) {
          e.preventDefault();
          callback();
        }
      } else {
        // 単一キー
        const callback = this.shortcuts.get(key);
        if (callback) {
          e.preventDefault();
          callback();
        }
      }
    });
  }
}

// 使用例
const shortcuts = new KeyboardShortcuts();
shortcuts.register('r', () => resetCamera());
shortcuts.register('f', () => toggleFullscreen());
shortcuts.register('ctrl+s', () => saveScreenshot());
shortcuts.register('h', () => showHelp());
shortcuts.initialize();
```

**ヘルプオーバーレイ**:
```html
<div id="shortcuts-help" style="display: none;">
  <h3>Keyboard Shortcuts</h3>
  <ul>
    <li><kbd>R</kbd> - Reset Camera</li>
    <li><kbd>F</kbd> - Toggle Fullscreen</li>
    <li><kbd>Ctrl+S</kbd> - Save Screenshot</li>
    <li><kbd>H</kbd> - Show/Hide Help</li>
    <li><kbd>1-4</kbd> - Switch Color Map</li>
    <li><kbd>ESC</kbd> - Cancel Measurement</li>
  </ul>
</div>
```

**実装見積もり**: 小規模（1週間）

---

### 3. レスポンシブUI

**現状**:
- デスクトップのみを想定

**提案**:

```css
/* src/styles/responsive.css (新規) */
@media (max-width: 768px) {
  #stats-div {
    font-size: 10px;
    padding: 5px;
  }

  #colormap-select {
    width: 100%;
    margin: 5px 0;
  }

  canvas {
    width: 100vw !important;
    height: 100vh !important;
  }
}

@media (max-width: 480px) {
  #stats-div {
    font-size: 8px;
  }
}
```

**タッチ操作対応**:
```typescript
// src/webgpu/touch-controls.ts (新規)
export class TouchControls {
  private touchStartDistance = 0;

  initialize(canvas: HTMLCanvasElement) {
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        // ピンチズーム開始
        this.touchStartDistance = this.getTouchDistance(e.touches);
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        // ピンチズーム
        const currentDistance = this.getTouchDistance(e.touches);
        const scale = currentDistance / this.touchStartDistance;
        this.zoom(scale);
      } else if (e.touches.length === 1) {
        // パン
        this.pan(e.touches[0]);
      }
    });
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
```

**実装見積もり**: 中規模（2週間）

---

## 技術的負債

### 1. three.jsへの依存削減

**現状**:
- カメラ制御とOrbitControlsのみにthree.jsを使用
- 大きなバンドルサイズ（three.js: ~600KB）

**提案**:

```typescript
// src/camera/custom-camera.ts (新規)
export class CustomCamera {
  position: vec3;
  rotation: quat;
  fov: number;
  aspect: number;
  near: number;
  far: number;

  constructor(fov: number, aspect: number, near: number, far: number) {
    this.position = vec3.fromValues(0, 0, 10);
    this.rotation = quat.create();
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
  }

  getViewMatrix(): mat4 {
    const view = mat4.create();
    mat4.fromRotationTranslation(view, this.rotation, this.position);
    mat4.invert(view, view);
    return view;
  }

  getProjectionMatrix(): mat4 {
    const proj = mat4.create();
    mat4.perspective(proj, this.fov, this.aspect, this.near, this.far);
    return proj;
  }
}
```

```typescript
// src/camera/orbit-controls.ts (新規)
export class CustomOrbitControls {
  private camera: CustomCamera;
  private target: vec3;
  private damping = 0.05;

  rotate(deltaX: number, deltaY: number) {
    const rotX = quat.create();
    const rotY = quat.create();

    quat.setAxisAngle(rotX, [0, 1, 0], deltaX * 0.01);
    quat.setAxisAngle(rotY, [1, 0, 0], deltaY * 0.01);

    quat.multiply(this.camera.rotation, rotX, this.camera.rotation);
    quat.multiply(this.camera.rotation, rotY, this.camera.rotation);
  }

  zoom(delta: number) {
    const direction = vec3.create();
    vec3.subtract(direction, this.camera.position, this.target);
    vec3.scale(direction, direction, 1 + delta * 0.1);
    vec3.add(this.camera.position, this.target, direction);
  }
}
```

**メリット**:
- バンドルサイズ削減（~600KB → ~50KB）
- three.jsの不要な機能を除外
- WebGPUに最適化された実装

**デメリット**:
- カメラ制御の再実装が必要
- three.jsの高度な機能が使えない

**実装見積もり**: 大規模（4週間）

---

### 2. 設定ファイルの一元化

**現状**:
- `src/configs.ts` に環境変数依存のハードコーディング
- `src/index.ts` で手動でローダーを切り替え

**提案**:

```typescript
// src/config/app-config.ts (新規)
export interface AppConfig {
  rendering: {
    pointSize: number;
    lod: {
      enabled: boolean;
      maxLevel: number;
    };
  };
  cache: {
    lru: {
      maxSize: number;
    };
    persistent: {
      enabled: boolean;
      capacity: number;
    };
  };
  worker: {
    maxWorkers: number;
    enablePrefetch: boolean;
  };
  ui: {
    showStats: boolean;
    statsUpdateInterval: number;
  };
}

export const defaultConfig: AppConfig = {
  rendering: {
    pointSize: 3.0,
    lod: {
      enabled: true,
      maxLevel: 8
    }
  },
  cache: {
    lru: {
      maxSize: 500
    },
    persistent: {
      enabled: true,
      capacity: 10000
    }
  },
  worker: {
    maxWorkers: navigator.hardwareConcurrency - 1 || 4,
    enablePrefetch: true
  },
  ui: {
    showStats: true,
    statsUpdateInterval: 100
  }
};
```

```json
// config/development.json (新規)
{
  "rendering": {
    "pointSize": 5.0
  },
  "ui": {
    "showStats": true
  }
}
```

```json
// config/production.json (新規)
{
  "rendering": {
    "pointSize": 3.0
  },
  "ui": {
    "showStats": false
  }
}
```

**実装見積もり**: 中規模（2週間)

---

## 長期的な展望

### 1. WebAssemblyによる高速化

**提案**:

Octree構築や視錐台カリングなどのCPU集約的な処理をWASMで実装

```rust
// src/wasm/octree-builder.rs (新規)
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmOctree {
    nodes: Vec<Node>,
}

#[wasm_bindgen]
impl WasmOctree {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmOctree {
        WasmOctree { nodes: Vec::new() }
    }

    pub fn insert_points(&mut self, positions: &[f32], colors: &[f32]) {
        // 高速なOctree構築ロジック
    }

    pub fn frustum_culling(&self, frustum: &[f32]) -> Vec<u32> {
        // 高速な視錐台カリング
    }
}
```

**期待される効果**:
- Octree構築: 3-5倍高速化
- 視錐台カリング: 2-3倍高速化

**実装見積もり**: 大規模（6-8週間）

---

### 2. WebGPU Compute Shaderの活用

**提案**:

点群の前処理やフィルタリングをCompute Shaderで実装

```wgsl
// src/shaders/point-filter.compute.wgsl (新規)
@group(0) @binding(0) var<storage, read> inputPositions: array<vec3<f32>>;
@group(0) @binding(1) var<storage, read> inputColors: array<vec3<f32>>;
@group(0) @binding(2) var<storage, read_write> outputPositions: array<vec3<f32>>;
@group(0) @binding(3) var<storage, read_write> outputColors: array<vec3<f32>>;
@group(0) @binding(4) var<storage, read_write> outputCount: atomic<u32>;

struct FilterParams {
    minHeight: f32,
    maxHeight: f32,
    minIntensity: f32,
    maxIntensity: f32
};
@group(1) @binding(0) var<uniform> params: FilterParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= arrayLength(&inputPositions)) {
        return;
    }

    let position = inputPositions[idx];
    let color = inputColors[idx];

    // 高さフィルタ
    if (position.z >= params.minHeight && position.z <= params.maxHeight) {
        let outIdx = atomicAdd(&outputCount, 1u);
        outputPositions[outIdx] = position;
        outputColors[outIdx] = color;
    }
}
```

**期待される効果**:
- 大量の点のフィルタリングがGPU並列処理で高速化
- CPUの負荷軽減

**実装見積もり**: 大規模（4週間）

---

### 3. マルチファイル・マルチデータセット対応

**提案**:

複数の点群ファイルを同時に読み込み・表示

```typescript
// src/multi-file/dataset-manager.ts (新規)
export class DatasetManager {
  private datasets: Map<string, PointCloudData> = new Map();

  async loadDataset(id: string, file: string) {
    const loader = this.getLoaderForFile(file);
    const data = await loader.loadFile(file);
    this.datasets.set(id, data);
  }

  async mergeDatasets(ids: string[]): Promise<PointCloudData> {
    const merged = {
      positions: [],
      colors: []
    };

    for (const id of ids) {
      const dataset = this.datasets.get(id);
      if (dataset) {
        merged.positions.push(...dataset.points.positions);
        merged.colors.push(...dataset.points.colors);
      }
    }

    return merged;
  }

  toggleDatasetVisibility(id: string, visible: boolean) {
    // データセットの表示/非表示を切り替え
  }
}
```

**UI例**:
```html
<div id="dataset-panel">
  <h3>Datasets</h3>
  <ul>
    <li>
      <input type="checkbox" checked id="dataset-1">
      <label>Building.laz</label>
    </li>
    <li>
      <input type="checkbox" checked id="dataset-2">
      <label>Terrain.las</label>
    </li>
  </ul>
  <button id="add-dataset">Add Dataset...</button>
</div>
```

**実装見積もり**: 大規模（5週間）

---

### 4. クラウド統合

**提案**:

AWS S3、Google Cloud Storage等からの直接読み込み

```typescript
// src/loaders/cloud-loader.ts (新規)
export class CloudLoader {
  async loadFromS3(
    bucket: string,
    key: string,
    credentials: AWSCredentials
  ): Promise<PointCloudData> {
    const s3Client = new S3Client(credentials);

    // Range Requestでヘッダーのみ取得
    const header = await s3Client.getObject({
      Bucket: bucket,
      Key: key,
      Range: 'bytes=0-1024'
    });

    // ファイル形式を判定
    const loader = this.getLoaderForHeader(header);

    // データをストリーミング取得
    return await loader.loadFromStream(
      s3Client.getObjectStream(bucket, key)
    );
  }

  async loadFromGCS(
    bucket: string,
    object: string,
    credentials: GCPCredentials
  ): Promise<PointCloudData> {
    // Google Cloud Storage実装
  }
}
```

**実装見積もり**: 大規模（6週間）

---

## 実装優先度マトリクス

| 課題 | 緊急度 | 重要度 | 実装難易度 | 推奨優先度 |
|------|--------|--------|-----------|----------|
| LAZ v1.4対応 | 高 | 高 | 中 | 🔴 P0 |
| エラーハンドリング強化 | 高 | 高 | 低 | 🔴 P0 |
| GPU Buffer ラベリング | 中 | 中 | 中 | 🟡 P1 |
| メモリリーク監視 | 中 | 高 | 中 | 🟡 P1 |
| Worker エラーリカバリ | 中 | 中 | 低 | 🟡 P1 |
| ファイル選択UI | 低 | 高 | 中 | 🟢 P2 |
| カメラコントロール改善 | 低 | 中 | 中 | 🟢 P2 |
| 点群フィルタリング | 低 | 高 | 高 | 🟢 P2 |
| 測定ツール | 低 | 中 | 高 | 🟢 P3 |
| スクリーンショット | 低 | 低 | 低 | 🟢 P3 |
| Octree構築最適化 | 中 | 高 | 中 | 🟡 P1 |
| 動的LOD | 中 | 中 | 中 | 🟡 P1 |
| Worker Pool スケーリング | 低 | 中 | 中 | 🟢 P2 |
| 予測的プリフェッチ | 低 | 中 | 高 | 🟢 P3 |
| TypeScript 型安全性 | 中 | 高 | 高 | 🟡 P1 |
| ユニットテスト | 中 | 高 | 高 | 🟡 P1 |
| E2Eテスト | 低 | 中 | 中 | 🟢 P2 |
| ESLint/Prettier | 低 | 中 | 低 | 🟢 P2 |
| APIドキュメント | 低 | 中 | 低 | 🟢 P2 |
| チュートリアル | 低 | 高 | 中 | 🟢 P2 |
| CI/CDパイプライン | 中 | 高 | 低 | 🟡 P1 |
| パフォーマンステスト | 低 | 中 | 中 | 🟢 P2 |
| プログレスバー | 低 | 低 | 低 | 🟢 P3 |
| キーボードショートカット | 低 | 低 | 低 | 🟢 P3 |
| レスポンシブUI | 低 | 中 | 中 | 🟢 P2 |
| three.js依存削減 | 低 | 中 | 高 | 🟢 P3 |
| 設定ファイル一元化 | 低 | 中 | 中 | 🟢 P2 |
| WASM高速化 | 低 | 高 | 高 | 🔵 P4 |
| Compute Shader | 低 | 中 | 高 | 🔵 P4 |
| マルチファイル対応 | 低 | 高 | 高 | 🔵 P4 |
| クラウド統合 | 低 | 中 | 高 | 🔵 P4 |

**優先度の定義**:
- 🔴 **P0**: 即時対応（1-2週間以内）
- 🟡 **P1**: 短期対応（1-2ヶ月以内）
- 🟢 **P2**: 中期対応（3-6ヶ月以内）
- 🟢 **P3**: 中長期対応（6ヶ月-1年）
- 🔵 **P4**: 長期展望（1年以上）

---

## まとめ

### 次の3ヶ月のロードマップ

**フェーズ1（1ヶ月目）: 基盤強化**
1. LAZ v1.4対応
2. エラーハンドリング統一
3. GPU Bufferラベリング改善
4. CI/CDパイプライン構築
5. ESLint/Prettier導入

**フェーズ2（2ヶ月目）: 品質向上**
1. TypeScript型安全性強化
2. ユニットテスト拡充（カバレッジ80%目標）
3. メモリリーク監視システム
4. Octree構築最適化
5. 動的LOD実装

**フェーズ3（3ヶ月目）: 機能追加**
1. ファイル選択UI
2. 点群フィルタリング
3. カメラコントロール改善
4. E2Eテスト追加
5. チュートリアルドキュメント作成

### 成功指標（KPI）

- **パフォーマンス**:
  - 1M点の表示: 60fps以上
  - キャッシュヒット率: 85%以上
  - 初回ロード時間: 3秒以内

- **品質**:
  - テストカバレッジ: 80%以上
  - TypeScript strictモード: 100%
  - ビルド警告: 0件

- **ユーザビリティ**:
  - エラー発生時の適切な通知: 100%
  - ドキュメント完全性: 90%以上
  - レスポンシブ対応: 完了

---

**このドキュメントは定期的に更新されます。最終更新: 2025-10-10**
