# 多層キャッシュシステムアーキテクチャ

**最終更新日**: 2025-10-10

このドキュメントでは、DEBUG-WebGPU-Analyzerプロジェクトにおける3層キャッシュシステムの仕組み、フロー、実装方法について詳しく解説します。

---

## 📋 目次

- [概要](#概要)
- [キャッシュ階層](#キャッシュ階層)
- [システムフロー](#システムフロー)
- [実装詳細](#実装詳細)
- [パフォーマンス最適化](#パフォーマンス最適化)
- [トラブルシューティング](#トラブルシューティング)

---

## 概要

### なぜ多層キャッシュが必要か？

COPC（Cloud Optimized Point Cloud）のような大規模点群データをブラウザで効率的にレンダリングするには、以下の課題があります：

1. **ネットワーク遅延** - HTTPリクエストで毎回データ取得は非効率
2. **メモリ制限** - すべてのデータをメモリに保持できない
3. **GPU制約** - GPUメモリも限られている
4. **ユーザー体験** - スムーズなカメラ操作とレンダリングが必要

これらを解決するために、**3層のキャッシュ階層**を実装しています。

### キャッシュの目的

- ✅ **ネットワークリクエストの削減** - 一度取得したデータを再利用
- ✅ **レンダリング速度の向上** - GPUバッファからの直接描画
- ✅ **メモリ効率の最適化** - 使用頻度に応じたデータ管理
- ✅ **永続性の確保** - ページリロード後もデータを保持

---

## キャッシュ階層

### 3層キャッシュアーキテクチャ

```
┌─────────────────────────────────────────┐
│     L1: GPU Buffer Cache (最速)          │
│  - WebGPU Buffer (VRAM)                 │
│  - 容量: 小 (~数百MB)                    │
│  - 速度: 最速 (GPUダイレクトアクセス)      │
│  - 寿命: レンダリングループ中のみ         │
└─────────────────────────────────────────┘
              ↓ (キャッシュミス)
┌─────────────────────────────────────────┐
│     L2: LRU Cache (高速)                │
│  - In-Memory Cache (RAM)                │
│  - 容量: 中 (最大500ノード)               │
│  - 速度: 高速 (メモリアクセス)            │
│  - 寿命: セッション中 (リロードで消失)     │
└─────────────────────────────────────────┘
              ↓ (キャッシュミス)
┌─────────────────────────────────────────┐
│     L3: Persistent Cache (中速)         │
│  - Origin Private File System (SSD)     │
│  - 容量: 大 (数GB)                       │
│  - 速度: 中速 (ファイルI/O)               │
│  - 寿命: 永続 (ブラウザデータ削除まで)    │
└─────────────────────────────────────────┘
              ↓ (キャッシュミス)
┌─────────────────────────────────────────┐
│     Web Worker Pool (最遅)              │
│  - HTTP Range Request                   │
│  - LAZ解凍 (laz-perf WASM)              │
│  - データ変換                            │
└─────────────────────────────────────────┘
```

### 各レイヤーの詳細

| レベル | 種類 | ストレージ | 容量 | 速度 | 永続性 | 用途 |
|--------|------|-----------|------|------|--------|------|
| **L1** | GPU Buffer | VRAM | 小 (数百MB) | 最速 (0.1ms) | 揮発性 | 現在表示中のノード |
| **L2** | LRU Cache | RAM | 中 (最大500ノード) | 高速 (1ms) | セッション中 | 最近使用したノード |
| **L3** | Persistent | SSD | 大 (数GB) | 中速 (10-100ms) | 永続 | 過去に使用したノード |
| **-** | Network | - | 無制限 | 低速 (100-1000ms) | - | 未キャッシュノード |

---

## システムフロー

### 1. 初期化フロー

```
[アプリケーション起動]
         ↓
[createPersistentMetaCache()]
  - Origin Private File Systemにメタキャッシュファイル作成
  - ファイル名: `${P_CACHE}.json` (例: "copc-cache.json")
         ↓
[pCache()]
  - 既存の永続キャッシュをロード
  - Map形式に変換して appState.persCache に格納
         ↓
[LRUキャッシュ初期化]
  - lru-cacheライブラリで新規インスタンス作成
  - 最大500ノード、updateAgeOnGetオプション有効
         ↓
[準備完了]
```

**実装コード**:
```typescript
// src/index.ts
async function _initializeCache() {
  await createPersistentMetaCache();
  appState.persCache = await pCache();
}
```

---

### 2. ノード取得フロー（resolveNodeCache）

ユーザーがカメラを動かすたびに、視界内のOctreeノードを取得する必要があります。このときの処理フローは以下の通りです。

```
[カメラ移動イベント]
         ↓
[視錐台カリング]
  - Octree走査で視界内のノードを抽出
  - keyMap = [nodeKey1, byteOffset1, nodeKey2, byteOffset2, ...]
         ↓
[resolveNodeCache(keyMap, filename)]
         ↓
┌────────────────────────────────────────┐
│ Step 1: GPU Buffer Cache 検索          │
│ - appState.bufferMap をチェック         │
│ - ヒット → newBufferMapに追加           │
│ - ミス → newKeyMapに追加（次のステップへ）│
└────────────────────────────────────────┘
         ↓ (キャッシュミス)
┌────────────────────────────────────────┐
│ Step 2: LRU Cache 検索                 │
│ - lruCache.get(nodeKey) をチェック      │
│ - ヒット → GPUバッファ作成 → newBufferMap│
│ - ミス → afterCheckingCacheに追加       │
└────────────────────────────────────────┘
         ↓ (キャッシュミス)
┌────────────────────────────────────────┐
│ Step 3: Persistent Cache 検索          │
│ - doesExist(`${filename}-${nodeKey}`)  │
│ - ヒット → GPUバッファ作成 → LRUに追加  │
│ - ミス → filteredElementsに追加         │
└────────────────────────────────────────┘
         ↓ (キャッシュミス)
┌────────────────────────────────────────┐
│ Step 4: Web Worker で取得              │
│ - filteredElements を返す               │
│ - 呼び出し元でWeb Worker Pool実行      │
│ - HTTPリクエスト + LAZ解凍              │
│ - GPUバッファ作成 → 全キャッシュに追加  │
└────────────────────────────────────────┘
         ↓
[統計情報表示]
  - ノード数、キャッシュヒット率など
```

**コード実装** (`src/cache/node-cache-manager.ts`):
```typescript
export async function resolveNodeCache(keyMap: any, filename: string) {
  let nodeFoundInBuffer = 0;
  let nodeFoundInLRU = 0;
  let nodeFoundInPersistent = 0;
  let nodeToFetch = 0;

  let newKeyMap = [];
  let newBufferMap = {};

  // Step 1: GPU Buffer Cache 検索
  for (let i = 0; i < keyMap.length; i += 2) {
    if (!(keyMap[i] in appState.bufferMap)) {
      newKeyMap.push(keyMap[i], keyMap[i + 1]);
    } else {
      nodeFoundInBuffer++;
      // 既存バッファを再利用
      newBufferMap[keyMap[i]] = appState.bufferMap[keyMap[i]];
    }
  }

  // Step 2: LRU Cache 検索
  let afterCheckingCache = [];
  for (let i = 0; i < newKeyMap.length; i += 2) {
    let cachedResult = lruCache.get(newKeyMap[i]);
    if (cachedResult) {
      nodeFoundInLRU++;
      // JSONをパースしてGPUバッファ作成
      cachedResult = JSON.parse(cachedResult);
      let [positionBuffer, colorBuffer] = createBuffer(
        cachedResult.position,
        cachedResult.color
      );
      newBufferMap[newKeyMap[i]] = {
        position: positionBuffer,
        color: colorBuffer,
        maxIntensity: cachedResult.maxIntensity,
        numPoints: cachedResult.position.length / 4,
      };
    } else {
      afterCheckingCache.push(newKeyMap[i], newKeyMap[i + 1]);
    }
  }

  // Step 3: Persistent Cache 検索
  let filteredElements = [];
  for (let i = 0; i < afterCheckingCache.length; i += 2) {
    let [exist, data] = await doesExist(
      `${filename}-${afterCheckingCache[i]}`
    );
    if (exist) {
      nodeFoundInPersistent++;
      // ファイルから読み込んでGPUバッファ作成
      let [positionBuffer, colorBuffer] = createBuffer(
        data.position,
        data.color
      );
      newBufferMap[afterCheckingCache[i]] = {
        position: positionBuffer,
        color: colorBuffer,
        maxIntensity: data.maxIntensity,
        numPoints: data.position.length / 4,
      };
      // LRUキャッシュにも追加
      lruCache.set(afterCheckingCache[i], JSON.stringify(data));
    } else {
      // 取得が必要なノード
      filteredElements.push(afterCheckingCache[i], afterCheckingCache[i + 1]);
      nodeToFetch++;
    }
  }

  // 統計情報表示
  StatsFacade.displayCOPC({
    totalNodes: keyMap.length / 2,
    nodesInBuffer: nodeFoundInBuffer,
    nodesInLRU: nodeFoundInLRU,
    nodesInPersistent: nodeFoundInPersistent,
    nodesToFetch: nodeToFetch,
  });

  return filteredElements; // Web Workerで取得すべきノード
}
```

---

### 3. データ書き込みフロー

Web Workerでノードデータを取得した後、3層すべてに書き込みます。

```
[Web Worker からデータ受信]
  - position: Float32Array
  - color: Float32Array
  - maxIntensity: number
         ↓
[GPUバッファ作成]
  - createBuffer(position, color)
  - positionBuffer, colorBuffer を取得
         ↓
[L1: GPU Buffer Cache に保存]
  - appState.bufferMap[nodeKey] = {
      position: positionBuffer,
      color: colorBuffer,
      maxIntensity,
      numPoints
    }
         ↓
[L2: LRU Cache に保存]
  - lruCache.set(nodeKey, JSON.stringify({
      position: Array.from(position),
      color: Array.from(color),
      maxIntensity
    }))
         ↓
[L3: Persistent Cache に保存]
  - writeFile(`${filename}-${nodeKey}`, JSON.stringify(data))
  - Origin Private File Systemに.binファイルとして保存
         ↓
[メタキャッシュ更新（スロットル処理）]
  - throttledUpdatePersCache(data)
  - 30秒に1回のみ更新（パフォーマンス向上）
```

**コード実装** (`src/loaders/copc-node-loader.ts`):
```typescript
// Web Workerからデータを受信した後
const [localPosition, localColor, nodeKey, maxIntensity] = workerResult;

// L1: GPUバッファ作成
const [positionBuffer, colorBuffer] = createBuffer(localPosition, localColor);
appState.bufferMap[nodeKey] = {
  position: positionBuffer,
  color: colorBuffer,
  maxIntensity,
  numPoints: localPosition.length / 4,
};

// L2: LRUキャッシュに追加
lruCache.set(nodeKey, JSON.stringify({
  position: localPosition,
  color: localColor,
  maxIntensity
}));

// L3: 永続キャッシュに追加（非同期）
writeFile(`${filename}-${nodeKey}`, JSON.stringify({
  position: localPosition,
  color: localColor,
  maxIntensity
}));
```

---

### 4. キャッシュ削除フロー（LRU戦略）

視界外になったノードはGPUメモリを圧迫するため、削除が必要です。

```
[カメラ移動]
         ↓
[新しいノードセットを決定]
  - 視錐台カリング結果 = newBufferMap
         ↓
[削除対象を特定]
  - toDeleteArray = 既存バッファ - 新規バッファ
         ↓
[遅延削除]
  - appState.toDeleteMap に移動
  - 次のフレームで実際に削除
         ↓
[GPUバッファ破棄]
  - buffer.destroy() を呼び出し
  - VRAMを解放
         ↓
[LRUキャッシュは自動管理]
  - 最大500ノードを超えると古いものを自動削除
  - updateAgeOnGet=true で使用頻度を更新
         ↓
[永続キャッシュは保持]
  - ディスクに残る（容量が許す限り）
```

**コード実装** (`src/cache/node-cache-manager.ts`):
```typescript
// 削除対象を特定
let toDeleteArray = existingBuffers.reduce((acc, val) => {
  acc[val] = true;
  return acc;
}, {});

// 新規バッファセット構築時に、使用中のバッファをtoDeleteArrayから除外
for (let i = 0; i < keyMap.length; i += 2) {
  if (keyMap[i] in appState.bufferMap) {
    delete toDeleteArray[keyMap[i]]; // 削除対象から除外
  }
}

// 使用されなくなったバッファを削除マップに移動
for (let key in toDeleteArray) {
  appState.toDeleteMap[key] = {
    position: appState.bufferMap[key].position,
    color: appState.bufferMap[key].color,
  };
}

// 次のフレームで実際に削除
for (const key in appState.toDeleteMap) {
  appState.toDeleteMap[key].position.destroy();
  appState.toDeleteMap[key].color.destroy();
  delete appState.toDeleteMap[key];
}
```

---

## 実装詳細

### L1: GPU Buffer Cache

**目的**: レンダリング中に直接アクセス可能な最速キャッシュ

**実装**:
```typescript
// src/views/states/state-manager.ts
export const appState = {
  bufferMap: {} as Record<string, {
    position: GPUBuffer;
    color: GPUBuffer;
    maxIntensity: number;
    numPoints: number;
  }>,
  toDeleteMap: {} as Record<string, {
    position: GPUBuffer;
    color: GPUBuffer;
  }>,
  // ... その他
};
```

**特徴**:
- **キー**: Octreeノード識別子（例: "0-1-2-3"）
- **値**: WebGPU Bufferオブジェクトとメタデータ
- **容量管理**: 視錐台カリングで自動的に使用中のノードのみ保持
- **削除戦略**: 遅延削除（toDeleteMapに移動→次フレームで破棄）

**バッファ作成**:
```typescript
// src/webgpu/webgpu-buffer.ts
export function createBuffer(
  positions: Float32Array | number[],
  colors: Float32Array | number[]
): [GPUBuffer, GPUBuffer] {
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

  // データ転送
  new Float32Array(positionBuffer.getMappedRange()).set(positions);
  new Float32Array(colorBuffer.getMappedRange()).set(colors);

  positionBuffer.unmap();
  colorBuffer.unmap();

  return [positionBuffer, colorBuffer];
}
```

---

### L2: LRU Cache

**目的**: メモリ上の高速キャッシュ（最近使用したノード）

**実装**:
```typescript
// src/cache/lru-cache.ts
import LRUCache from "lru-cache";

const _options = {
  max: 500,                 // 最大500ノード
  allowStale: false,        // 古いデータを返さない
  updateAgeOnGet: true,     // 取得時に年齢更新
  updateAgeOnHas: true,     // 存在確認時にも年齢更新
};

export const lruCache = new LRUCache(_options);
```

**特徴**:
- **キー**: Octreeノード識別子（文字列）
- **値**: JSON文字列化された点群データ
  ```typescript
  {
    position: number[],     // Float32Arrayから変換
    color: number[],        // Float32Arrayから変換
    maxIntensity: number
  }
  ```
- **容量管理**: 最大500ノード、LRU（Least Recently Used）アルゴリズム
- **永続性**: なし（ページリロードで消失）

**使用例**:
```typescript
// 書き込み
lruCache.set(nodeKey, JSON.stringify({
  position: Array.from(positionArray),
  color: Array.from(colorArray),
  maxIntensity: 1000
}));

// 読み込み
const cachedData = lruCache.get(nodeKey);
if (cachedData) {
  const parsed = JSON.parse(cachedData);
  // GPUバッファ作成に使用
}
```

**LRUアルゴリズムの動作**:
```
初期状態: []
set(A) → [A]
set(B) → [B, A]
get(A) → [A, B]  (Aが最近使用された)
set(C) → [C, A, B]
... (500ノードまで)
set(NEW) → [NEW, C, A, ..., X] (Xが削除される)
```

---

### L3: Persistent Cache

**目的**: ページリロード後も保持される永続キャッシュ

**実装**:
```typescript
// src/cache/persistent-cache.ts

// キャッシュからデータ取得（使用頻度更新）
export function getInCache(cache, key) {
  if (!cache.has(key)) return cache;
  const val = cache.get(key);
  cache.delete(key);
  cache.set(key, {
    date: Date.now(),      // 最終アクセス時刻更新
    count: val.count + 1   // アクセス回数インクリメント
  });
  return cache;
}

// キャッシュにデータ追加
export function putInCache(cache, key, value) {
  cache.delete(key);
  if (cache.size == P_CACHE_CAPACITY) {
    // 容量オーバー時は最も古いエントリを削除
    cache.delete(cache.keys().next().value);
  } else {
    cache.set(key, value);
  }
  return cache;
}

// 永続キャッシュのロード
export async function pCache() {
  const [, content] = await doesExist(P_CACHE);
  const cache = _sortObjectIntoMap(content);
  return cache;
}

// オブジェクトをMapに変換（日付順ソート）
function _sortObjectIntoMap(object: any) {
  const resultMap = new Map();
  if (!object) return resultMap;

  const sortedArray = Object.entries(object).sort(
    (a: any, b: any) => a.date - b.date
  );
  sortedArray.forEach(([key, value]) => resultMap.set(key, value));
  return resultMap;
}
```

**ファイル操作** (`src/utils/file-manager.ts`):
```typescript
// ファイル存在確認 + 読み込み
export async function doesExist(fileName) {
  try {
    const fileToCheck = `${fileName}.bin`;
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(fileToCheck);
    const retrievedBlob = await fileHandle.getFile();

    if (retrievedBlob.size > 0) {
      return await _readBlobAsJSON(retrievedBlob);
    } else {
      return [true, { position: [], color: [] }];
    }
  } catch (error) {
    if (error.name === "NotFoundError") {
      return [false, null];
    }
    throw error;
  }
}

// ファイル書き込み
export async function writeFile(fileName, data) {
  const fileToCheck = `${fileName}.bin`;
  const blob = new Blob([data], { type: "application/octet-stream" });
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(fileToCheck, {
    create: true,
  });
  const writableStream = await fileHandle.createWritable();
  await writableStream.write(blob);
  await writableStream.close();
}

// スロットル処理付きメタキャッシュ更新
export const throttledUpdatePersCache = new CanvasEventManager().throttle(
  _updatePersCache,
  30000  // 30秒に1回のみ更新
);
```

**特徴**:
- **ストレージ**: Origin Private File System API
- **ファイル形式**: `.bin` (JSON文字列をBlobとして保存)
- **ファイル名**: `${filename}-${nodeKey}.bin` (例: "sample-0-1-2.bin")
- **メタデータ**: `${P_CACHE}.json` (アクセス頻度、日時を記録)
- **容量**: ブラウザのストレージ上限まで（通常数GB）

**メタキャッシュ構造**:
```json
{
  "0-1-2": {
    "date": 1696000000000,
    "count": 5
  },
  "0-1-3": {
    "date": 1696000001000,
    "count": 3
  }
}
```

---

## パフォーマンス最適化

### 1. スロットル処理

永続キャッシュへの書き込みは頻繁に行うとパフォーマンス低下の原因になります。

**実装**:
```typescript
// 30秒に1回のみ更新
export const throttledUpdatePersCache = new CanvasEventManager().throttle(
  _updatePersCache,
  30000
);
```

**効果**:
- カメラ移動中の頻繁な書き込みを防止
- ディスクI/Oの削減
- UIのフリーズ防止

---

### 2. 遅延削除

GPUバッファの即座削除はレンダリング中の問題を引き起こす可能性があります。

**実装**:
```typescript
// 削除対象をマーキング
appState.toDeleteMap[key] = { position, color };

// 次のフレームで実際に削除
for (const key in appState.toDeleteMap) {
  appState.toDeleteMap[key].position.destroy();
  appState.toDeleteMap[key].color.destroy();
  delete appState.toDeleteMap[key];
}
```

**効果**:
- レンダリング中のバッファアクセスエラー防止
- フレーム境界での安全な削除

---

### 3. プリフェッチ

視界に入りそうなノードを事前に取得します。

**実装** (`src/cache/node-cache-manager.ts`):
```typescript
export async function resolvePrefetchNodes(keyMap: any, filename: string) {
  let afterCheckingCache = [];

  // LRUキャッシュをチェック
  for (let i = 0; i < keyMap.length; i += 2) {
    let cachedResult = lruCache.get(keyMap[i]);
    if (!cachedResult) {
      afterCheckingCache.push(keyMap[i], keyMap[i + 1]);
    }
  }

  // 永続キャッシュをチェック
  let filteredElements = [];
  for (let i = 0; i < afterCheckingCache.length; i += 2) {
    let [exist, data] = await doesExist(
      `${filename}-${afterCheckingCache[i]}`
    );
    if (exist) {
      // LRUキャッシュにプリロード
      lruCache.set(afterCheckingCache[i], JSON.stringify(data));
    } else {
      filteredElements.push(afterCheckingCache[i], afterCheckingCache[i + 1]);
    }
  }

  return filteredElements;
}
```

**効果**:
- カメラ移動時のスムーズな表示
- ネットワークリクエストの削減

---

### 4. JSON vs TypedArray

**課題**: TypedArrayはJSON.stringifyできない

**解決策**:
```typescript
// 保存時: TypedArray → Array
lruCache.set(key, JSON.stringify({
  position: Array.from(positionFloat32Array),
  color: Array.from(colorFloat32Array),
  maxIntensity
}));

// 読み込み時: Array → TypedArray
const cached = JSON.parse(lruCache.get(key));
const positionBuffer = new Float32Array(cached.position);
const colorBuffer = new Float32Array(cached.color);
```

**トレードオフ**:
- メモリ使用量増加（Arrayの方が大きい）
- シリアライズ/デシリアライズのオーバーヘッド
- しかし、永続化のためには必要

---

## キャッシュヒット率の測定

### 統計情報の表示

**実装** (`src/views/stats-display/copc-stats.ts`):
```typescript
export class COPCStats implements StatsDisplay {
  displayStats(params: COPCStatsParams): void {
    const {
      totalNodes,
      nodesInBuffer,
      nodesInLRU,
      nodesInPersistent,
      nodesToFetch
    } = params;

    const bufferHitRate = (nodesInBuffer / totalNodes * 100).toFixed(1);
    const lruHitRate = (nodesInLRU / totalNodes * 100).toFixed(1);
    const persistentHitRate = (nodesInPersistent / totalNodes * 100).toFixed(1);
    const fetchRate = (nodesToFetch / totalNodes * 100).toFixed(1);

    statsDiv.innerHTML = `
      Total Nodes: ${totalNodes}
      - GPU Buffer: ${nodesInBuffer} (${bufferHitRate}%)
      - LRU Cache: ${nodesInLRU} (${lruHitRate}%)
      - Persistent: ${nodesInPersistent} (${persistentHitRate}%)
      - To Fetch: ${nodesToFetch} (${fetchRate}%)
    `;
  }
}
```

### 理想的なヒット率

| キャッシュレベル | 理想的なヒット率 | 説明 |
|----------------|-----------------|------|
| GPU Buffer | 80-95% | カメラ移動が少ない場合 |
| LRU Cache | 5-15% | 最近表示した領域に戻った場合 |
| Persistent | 0-5% | 過去のセッションで表示した領域 |
| Network | 0-5% | 初めて表示する領域 |

---

## トラブルシューティング

### 問題1: キャッシュヒット率が低い

**症状**: ほとんどのノードがNetworkから取得される

**原因**:
- LRUキャッシュサイズが小さすぎる
- カメラ移動が激しい
- データセットが非常に大きい

**解決策**:
```typescript
// src/cache/lru-cache.ts
const _options = {
  max: 1000,  // 500 → 1000 に増やす
  // ...
};
```

---

### 問題2: メモリ不足

**症状**: ブラウザがクラッシュ、または動作が重くなる

**原因**:
- GPUバッファが解放されていない
- LRUキャッシュが大きすぎる

**解決策**:
```typescript
// GPUバッファの削除確認
console.log("toDeleteMap:", Object.keys(appState.toDeleteMap).length);

// LRUキャッシュサイズ削減
const _options = {
  max: 200,  // 500 → 200 に減らす
};
```

---

### 問題3: 永続キャッシュが保存されない

**症状**: ページリロード後にキャッシュが空

**原因**:
- Origin Private File System APIが無効
- ストレージ容量不足
- プライベートブラウジングモード

**確認方法**:
```typescript
// ブラウザ対応確認
if ('storage' in navigator && 'getDirectory' in navigator.storage) {
  console.log('Origin Private File System supported');
} else {
  console.error('Origin Private File System NOT supported');
}

// ストレージ容量確認
const estimate = await navigator.storage.estimate();
console.log(`使用量: ${estimate.usage} / ${estimate.quota}`);
```

**解決策**:
- Chrome 113以降を使用
- ストレージを空ける
- 通常モードでブラウザを起動

---

### 問題4: パフォーマンス低下

**症状**: カメラ移動時にカクつく

**原因**:
- 永続キャッシュへの頻繁な書き込み
- 同期的なファイルI/O

**解決策**:
```typescript
// スロットル間隔を長くする
export const throttledUpdatePersCache = new CanvasEventManager().throttle(
  _updatePersCache,
  60000  // 30秒 → 60秒
);

// 非同期処理の確認
await writeFile(...); // awaitを忘れずに
```

---

## まとめ

### キャッシュシステムの利点

✅ **高速レンダリング** - GPUバッファから直接描画
✅ **ネットワーク削減** - 一度取得したデータを再利用
✅ **メモリ効率** - LRUアルゴリズムで最適化
✅ **永続性** - ページリロード後も高速
✅ **拡張性** - 3層構造で柔軟な調整が可能

### ベストプラクティス

1. **LRUサイズの調整** - データセットとメモリに応じて
2. **スロットル処理** - 永続キャッシュの書き込み頻度を制限
3. **遅延削除** - GPUバッファの安全な解放
4. **統計情報の監視** - キャッシュヒット率を確認
5. **エラーハンドリング** - ストレージAPIの失敗に備える

### 参考ファイル

- LRUキャッシュ: `src/cache/lru-cache.ts`
- 永続キャッシュ: `src/cache/persistent-cache.ts`
- ノード管理: `src/cache/node-cache-manager.ts`
- ファイル操作: `src/utils/file-manager.ts`
- 統計表示: `src/views/stats-display/copc-stats.ts`

---

**Happy Caching! 🚀**
