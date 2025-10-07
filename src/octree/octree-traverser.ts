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
    let distance = Math.sqrt(
      Math.pow(Math.abs(cameraPosition[0] - centerX), 2) +
        Math.pow(Math.abs(cameraPosition[1] - centerY), 2) +
        Math.pow(Math.abs(cameraPosition[2] - centerZ), 2)
    );
    if (
      !_isNodeVisible(
        [centerX, centerY, centerZ],
        Math.max(...width),
        distance,
        projViewMatrix,
        level,
        key,
        nodePages
      )
    ) {
      return [];
    }

    let centerXLeft = centerX - width[0] / 2;
    let centerXRight = centerX + width[0] / 2;
    let centerYTop = centerY + width[1] / 2;
    let centerYBottom = centerY - width[1] / 2;
    let centerZNear = centerZ + width[2] / 2;
    let centerZFar = centerZ - width[2] / 2;

    let result = [key, nodePages[key].pointCount];
    DIRECTION.forEach((element) => {
      let [dx, dy, dz] = element;
      let key1 = `${newLevel}-${2 * x + dx}-${2 * y + dy}-${2 * z + dz}`;
      if (!(key1 in nodePages && nodePages[key].pointCount > 0)) {
        return [];
      }
      centerX = centerXLeft;
      centerY = centerYBottom;
      centerZ = centerZFar;
      if (dx == 1) {
        centerX = centerXRight;
      }
      if (dy == 1) {
        centerY = centerYTop;
      }
      if (dz == 1) {
        centerZ = centerZNear;
      }
      let result1 = _traverseOctree(
        [newLevel, 2 * x + dx, 2 * y + dy, 2 * z + dz],
        centerX,
        centerY,
        centerZ,
        [width[0] / 2, width[1] / 2, width[2] / 2]
      );
      result.push(...result1);
    });
    return result;
  }

  let finalPoints = _traverseOctree(root, centerX, centerY, centerZ, [
    width[0],
    width[1],
    width[2],
  ]);
  return [finalPoints, loaderState.nodeToPrefetch];
}

function _isNodeVisible(
  _center,
  radius,
  distance,
  _projViewMatrix,
  _level,
  _key,
  _nodePages
) {
  let projectedRadius =
    (radius * loaderState.screenHeight) /
    (distance * (2 * Math.tan(loaderState.fovRadian / 2.0)));
  return Math.abs(projectedRadius) > 90;
}
