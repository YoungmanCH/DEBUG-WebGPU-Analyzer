import { selectVisibleNodes } from "../octree/octree-traverser";
import { writeFile } from "../utils/file-manager";
import { appState } from "../canvas/state-manager";
import { createBuffer } from "../webgpu/webgpu-buffer";
import {
  resolveNodeCache,
  resolvePrefetchNodes,
} from "../cache/node-cache-manager";
import { createWorker, MAX_WORKERS } from "./worker-manager";

export async function loadCOPCNodes(
  filename: string,
  projectionViewMatrix: any,
  controllerSignal: AbortSignal | null = null
): Promise<void> {
  let [keyCountMap, nodeToPrefetch] = selectVisibleNodes(
    appState.nodePages,
    [0, 0, 0, 0],
    appState.centerX,
    appState.centerY,
    appState.centerZ,
    [0.5 * appState.widthX, 0.5 * appState.widthY, 0.5 * appState.widthZ],
    appState.scaleFactor,
    appState.controls,
    projectionViewMatrix
  );

  keyCountMap = await resolveNodeCache(keyCountMap, filename);
  appState.prefetchKeyCountMap = await resolvePrefetchNodes(
    nodeToPrefetch,
    filename
  );

  appState.clock.getDelta();
  let totalNodes = keyCountMap.length / 2;
  let doneCount = 0;

  for (let m = 0; m < keyCountMap.length; ) {
    let remaining = totalNodes - doneCount;
    let numbWorker = Math.min(MAX_WORKERS, remaining);
    for (let i = 0; i < numbWorker; i++) {
      appState.promises.push(createWorker(keyCountMap[m], keyCountMap[m + 1]));
      doneCount++;
      m += 2;
      if (doneCount % MAX_WORKERS == 0 || doneCount == totalNodes) {
        await _syncThread(filename);
        if (controllerSignal && controllerSignal.aborted) {
          return;
        }
      }
    }
  }
}

async function _syncThread(filename: string): Promise<void> {
  await Promise.all(appState.promises).then(async (response) => {
    for (let i = 0, _length = response.length; i < _length; i++) {
      let data = response[i];
      let fileName = data[2];

      let dataJson = {
        position: data[0],
        color: data[1],
        maxIntensity: data[3],
      };

      let dataJsonStringify = JSON.stringify(dataJson);
      await writeFile(`${filename}-${fileName}`, dataJsonStringify);

      let [positionBuffer, colorBuffer] = createBuffer(data[0], data[1]);
      const numPoints = data[0].length / 4; // position is float32x4
      appState.bufferMap[data[2]] = {
        position: positionBuffer,
        color: colorBuffer,
        maxIntensity: data[3],
        numPoints: numPoints,
      };
    }
  });
}
