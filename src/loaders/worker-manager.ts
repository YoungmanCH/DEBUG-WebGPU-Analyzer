import * as WorkerModule from "../worker/fetcher.worker";
import { appState } from "../canvas/state-manager";

const Worker = (WorkerModule as any).default || WorkerModule;

export const MAX_WORKERS = navigator.hardwareConcurrency - 1;

export function createWorker(data1: string, data2: number): Promise<any> {
  let myNode = data1.split("-").map(Number);
  let myLevel = myNode[0];
  return new Promise((resolve) => {
    let worker = new (Worker as any)();
    worker.onmessage = (event) => {
      let postMessageRes = event.data;
      if (postMessageRes == 200) {
        worker.postMessage([
          appState.nodePagesString,
          appState.pagesString,
          appState.copcString,
          data1,
          data2,
          [
            appState.xMin,
            appState.yMin,
            appState.zMin,
            appState.widthX,
            appState.widthY,
            appState.widthZ,
            appState.scaleFactor[0],
            appState.scaleFactor[1],
            appState.scaleFactor[2],
            myLevel,
          ],
        ]);
      } else {
        appState.workerCount += 1;
        let position = postMessageRes[0];
        let color = postMessageRes[1];
        let [, , maxIntensity, dataLevel] = postMessageRes[2];
        if (maxIntensity > appState.globalMaxIntensity) {
          appState.globalMaxIntensity = maxIntensity;
        }
        let localPosition = [];
        let localColor = [];
        for (let i = 0; i < position.length; i++) {
          if (i > 0 && i % 3 == 0) {
            localPosition.push(dataLevel);
          }
          localPosition.push(position[i]);
          localColor.push(color[i]);
        }
        localPosition.push(dataLevel);

        if (appState.workerCount == MAX_WORKERS) {
          appState.workerCount = 0;
          appState.promises = [];
        }
        worker.terminate();
        resolve([localPosition, localColor, data1, maxIntensity]);
      }
    };
  });
}
