import { computeFocalLength } from "../utils/loader";

const DIRECTION = [
  [0, 0, 0],
  [0, 0, 1],
  [0, 1, 0],
  [0, 1, 1],
  [1, 0, 0],
  [1, 0, 1],
  [1, 1, 0],
  [1, 1, 1],
];

const canvas = document.getElementById("screen-canvas") as HTMLCanvasElement;
canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
canvas.height = window.innerHeight * (window.devicePixelRatio || 1);

const loaderState = {
  cameraFocalLength: computeFocalLength(90),
  nodeToPrefetch: [],
  screenWidth: canvas.width,
  screenHeight: canvas.height,
  fovRadian: Math.PI / 2,
};

// LOD設定
const LOD_CONFIG = {
  // スクリーン上のピクセル閾値（これ以上大きければ子ノードを探索）
  minScreenPixels: 50,
  // プリフェッチ用の閾値（少し大きめ）
  prefetchScreenPixels: 100,
  // 最大探索深度（メモリ節約のため）
  maxLevel: 15,
};

/**
 * カメラの視錐台とLODに基づいて、レンダリングすべきノードを選択する
 *
 * @param octreeNodes - Octreeノードの辞書
 * @param rootKey - ルートノードのキー [level, x, y, z]
 * @param boundingBox - バウンディングボックスの情報
 * @param camera - カメラコントロール
 * @param projViewMatrix - プロジェクション×ビュー行列
 * @returns [可視ノードのキー配列, プリフェッチ対象のキー配列]
 */
export function selectVisibleNodes(
  nodePages,
  root,
  centerX,
  centerY,
  centerZ,
  width,
  _scale,
  controls,
  projViewMatrix
) {
  let cameraPosition = controls.object.position.toArray();
  loaderState.nodeToPrefetch = [];

  function _traverseOctree(root, centerX, centerY, centerZ, width) {
    let [level, x, y, z] = root;
    let newLevel = level + 1;
    let key = level + "-" + x + "-" + y + "-" + z;

    // カメラからの距離を計算
    let distance = Math.sqrt(
      Math.pow(cameraPosition[0] - centerX, 2) +
        Math.pow(cameraPosition[1] - centerY, 2) +
        Math.pow(cameraPosition[2] - centerZ, 2)
    );

    // 可視性とLOD判定
    const visibility = _isNodeVisible(
      [centerX, centerY, centerZ],
      Math.max(...width),
      distance,
      projViewMatrix,
      level,
      key,
      nodePages
    );

    // 0: 非表示 → 何も返さない
    if (visibility === 0) {
      return [];
    }

    // 1: このノードを表示 → このノードだけ返す
    if (visibility === 1) {
      return [key, nodePages[key].pointCount];
    }

    // 2: 子ノードを探索
    let centerXLeft = centerX - width[0] / 4;
    let centerXRight = centerX + width[0] / 4;
    let centerYTop = centerY + width[1] / 4;
    let centerYBottom = centerY - width[1] / 4;
    let centerZNear = centerZ + width[2] / 4;
    let centerZFar = centerZ - width[2] / 4;

    let result = [];
    DIRECTION.forEach((element) => {
      let [dx, dy, dz] = element;
      let key1 = `${newLevel}-${2 * x + dx}-${2 * y + dy}-${2 * z + dz}`;

      // 子ノードが存在しない場合はスキップ
      if (!(key1 in nodePages && nodePages[key1].pointCount > 0)) {
        return;
      }

      // 子ノードの中心座標を計算
      let childCenterX = dx === 1 ? centerXRight : centerXLeft;
      let childCenterY = dy === 1 ? centerYTop : centerYBottom;
      let childCenterZ = dz === 1 ? centerZNear : centerZFar;

      // 再帰的に子ノードを探索
      let result1 = _traverseOctree(
        [newLevel, 2 * x + dx, 2 * y + dy, 2 * z + dz],
        childCenterX,
        childCenterY,
        childCenterZ,
        [width[0] / 2, width[1] / 2, width[2] / 2]
      );
      result.push(...result1);
    });

    // 子ノードが何も返さなかった場合は、このノードを表示
    if (result.length === 0) {
      return [key, nodePages[key].pointCount];
    }

    return result;
  }

  let finalPoints = _traverseOctree(root, centerX, centerY, centerZ, [
    width[0],
    width[1],
    width[2],
  ]);
  return [finalPoints, loaderState.nodeToPrefetch];
}

/**
 * ノードの可視性とLODを判定
 * @returns 0: 非表示, 1: このノードを表示, 2: 子ノードを探索
 */
function _isNodeVisible(
  center: number[],
  radius: number,
  distance: number,
  projViewMatrix: any,
  level: number,
  key: string,
  nodePages: any
): number {
  // 距離が0に近い場合の処理
  if (distance < 0.1) {
    distance = 0.1;
  }

  // スクリーン上での投影サイズを計算
  let projectedRadius =
    (radius * loaderState.screenHeight) /
    (distance * (2 * Math.tan(loaderState.fovRadian / 2.0)));

  // 視錐台カリング：ノードの球体がカメラから見えるかチェック
  // ノードの境界球がカメラの視野角内にあるか判定
  const sphereRadius = radius * Math.sqrt(3); // ボックスを囲む球の半径

  // 簡易的な視錐台カリング：距離と視野角から判定
  const maxVisibleDistance = sphereRadius + (loaderState.screenHeight / (2 * Math.tan(loaderState.fovRadian / 2.0)));

  // カメラから遠すぎる場合は非表示
  if (distance > maxVisibleDistance * 10) {
    return 0; // 非表示
  }

  // カメラに近すぎて球の内部にいる場合は表示
  if (distance < sphereRadius) {
    return 1;
  }

  // 投影サイズが小さすぎる場合は非表示
  if (Math.abs(projectedRadius) < 1) {
    return 0;
  }

  // 最大深度に達している場合は、このノードを表示
  if (level >= LOD_CONFIG.maxLevel) {
    return 1;
  }

  // LOD判定：投影サイズが閾値より大きければ子ノードを探索
  if (Math.abs(projectedRadius) > LOD_CONFIG.minScreenPixels) {
    // 子ノードが存在するかチェック
    const hasChildren = _hasChildren(level, key, nodePages);
    if (hasChildren) {
      // プリフェッチ対象として登録
      if (Math.abs(projectedRadius) > LOD_CONFIG.prefetchScreenPixels) {
        loaderState.nodeToPrefetch.push(key);
      }
      return 2; // 子ノードを探索
    }
  }

  return 1; // このノードを表示
}

/**
 * ノードに子が存在するかチェック
 */
function _hasChildren(level: number, key: string, nodePages: any): boolean {
  const [_, x, y, z] = key.split("-").map(Number);
  const newLevel = level + 1;

  for (let i = 0; i < DIRECTION.length; i++) {
    const [dx, dy, dz] = DIRECTION[i];
    const childKey = `${newLevel}-${2 * x + dx}-${2 * y + dy}-${2 * z + dz}`;
    if (childKey in nodePages && nodePages[childKey].pointCount > 0) {
      return true;
    }
  }
  return false;
}