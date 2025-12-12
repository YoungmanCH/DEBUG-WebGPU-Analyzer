import { appState } from "../views/states/state-manager";
import { MAX_BUFFER_NODES } from "../configs";

/**
 * メモリ管理の設定
 */
const MEMORY_CONFIG = {
  // バッファマップに保持する最大ノード数
  maxBufferNodes: MAX_BUFFER_NODES,
  // 一度に削除するノード数（最大値の10%）
  deleteThreshold: Math.floor(MAX_BUFFER_NODES * 0.1),
  // 最後にアクセスされてからの経過フレーム数の閾値
  maxIdleFrames: 300, // 約5秒（60fps想定）
};

/**
 * ノードの最終アクセス時刻を記録するマップ
 */
const nodeAccessTime = new Map<string, number>();

/**
 * 現在のフレーム番号
 */
let currentFrame = 0;

/**
 * ノードがアクセスされたことを記録
 */
export function markNodeAccessed(nodeKey: string): void {
  nodeAccessTime.set(nodeKey, currentFrame);
}

/**
 * フレームカウンタを更新して現在のフレーム番号を返す
 */
export function incrementFrame(): number {
  currentFrame++;
  return currentFrame;
}

/**
 * 古いノードをメモリから解放
 */
export function cleanupOldNodes(currentVisibleKeys: string[]): void {
  // 現在表示中のノードをマーク
  const visibleSet = new Set(currentVisibleKeys);
  currentVisibleKeys.forEach((key) => markNodeAccessed(key));

  // バッファマップ内のノード数をチェック
  const bufferKeys = Object.keys(appState.bufferMap);
  const currentNodeCount = bufferKeys.length;

  // 閾値を超えていない場合は何もしない
  if (currentNodeCount <= MEMORY_CONFIG.maxBufferNodes) {
    return;
  }

  // 削除候補を収集（表示中でない＆アクセスが古いノード）
  const candidates: { key: string; idleFrames: number }[] = [];

  for (const key of bufferKeys) {
    // 表示中のノードはスキップ
    if (visibleSet.has(key)) {
      continue;
    }

    // 最終アクセス時刻を取得
    const lastAccess = nodeAccessTime.get(key) || 0;
    const idleFrames = currentFrame - lastAccess;

    // 一定期間アクセスされていないノードを候補に追加
    if (idleFrames > MEMORY_CONFIG.maxIdleFrames) {
      candidates.push({ key, idleFrames });
    }
  }

  // アクセスが古い順にソート
  candidates.sort((a, b) => b.idleFrames - a.idleFrames);

  // 削除するノード数を決定
  const deleteCount = Math.min(
    candidates.length,
    MEMORY_CONFIG.deleteThreshold
  );

  // ノードを削除
  for (let i = 0; i < deleteCount; i++) {
    const { key } = candidates[i];
    deleteNode(key);
  }

  if (deleteCount > 0) {
    console.log(
      `[Memory] Cleaned up ${deleteCount} nodes. Current: ${currentNodeCount - deleteCount}/${MEMORY_CONFIG.maxBufferNodes}`
    );
  }
}

/**
 * 特定のノードをメモリから削除
 */
function deleteNode(nodeKey: string): void {
  const bufferInfo = appState.bufferMap[nodeKey];
  if (!bufferInfo) {
    return;
  }

  // GPUバッファを破棄
  try {
    if (bufferInfo.position && typeof bufferInfo.position.destroy === "function") {
      bufferInfo.position.destroy();
    }
    if (bufferInfo.color && typeof bufferInfo.color.destroy === "function") {
      bufferInfo.color.destroy();
    }
  } catch (error) {
    console.warn(`[Memory] Failed to destroy buffer for ${nodeKey}:`, error);
  }

  // マップから削除
  delete appState.bufferMap[nodeKey];
  nodeAccessTime.delete(nodeKey);
}

/**
 * すべてのノードをメモリから削除（シーンリセット時など）
 */
export function clearAllNodes(): void {
  const bufferKeys = Object.keys(appState.bufferMap);

  for (const key of bufferKeys) {
    deleteNode(key);
  }

  nodeAccessTime.clear();
  currentFrame = 0;

  console.log(`[Memory] Cleared all ${bufferKeys.length} nodes`);
}

/**
 * メモリ使用状況を取得
 */
export function getMemoryStats(): {
  totalNodes: number;
  maxNodes: number;
  utilizationPercent: number;
} {
  const totalNodes = Object.keys(appState.bufferMap).length;
  const maxNodes = MEMORY_CONFIG.maxBufferNodes;
  const utilizationPercent = (totalNodes / maxNodes) * 100;

  return {
    totalNodes,
    maxNodes,
    utilizationPercent,
  };
}
