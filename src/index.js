import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Copc } from "copc";
import Worker from "./worker/fetcher.worker.js";
import { device, stages, renderWrapper } from "./webgpu/renderer";
import { traverseTreeWrapper } from "./passiveloader";
import {
  writeFile,
  doesExist,
  createPersistentMetaCache,
  throttledUpdatePersCache,
} from "./private_origin/file_manager";
import {
  pCache,
  getInCache,
  mapIntoJSON,
  putInCache,
} from "./private_origin/cache_manager";
import { updateHtmlUI } from "./helper";
import { cache } from "./lru-cache/index";
import "./styles/main.css";

const SOURCE_FILE_NAME = process.env.filename.split("/").pop();
const MAX_WORKERS = navigator.hardwareConcurrency - 1;

const canvas = document.getElementById("screen-canvas");
canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
canvas.height = window.innerHeight * (window.devicePixelRatio || 1);

export const appState = {
  bufferMap: {},
  toDeleteMap: {},
  persCache: null,
  globalMaxIntensity: 0,
  prefetchKeyCountMap: null,

  // COPC data
  nodePages: null,
  nodePagesString: null,
  pagesString: null,
  copcString: null,

  // Bounding box
  xMin: 0,
  yMin: 0,
  zMin: 0,
  xMax: 0,
  yMax: 0,
  zMax: 0,
  widthX: 0,
  widthY: 0,
  widthZ: 0,
  centerX: 0,
  centerY: 0,
  centerZ: 0,
  scaleFactor: null,

  // Three.js objects
  camera: null,
  controls: null,
  proj: null,
  params: null,

  // Worker management
  workerCount: 0,
  promises: [],
  clock: new THREE.Clock(),
};

export async function loadCOPC() {
  appState.clock.getDelta();
  const filename = process.env.filename;
  const copc = await Copc.create(filename);
  console.log("file is", copc);

  appState.scaleFactor = [1.0, 1.0, 1.0];
  appState.copcString = JSON.stringify(copc);

  [appState.xMin, appState.yMin, appState.zMin, appState.xMax, appState.yMax, appState.zMax] = [
    ...copc.header.min,
    ...copc.header.max,
  ];

  appState.xMin *= appState.scaleFactor[0];
  appState.xMax *= appState.scaleFactor[0];
  appState.yMin *= appState.scaleFactor[1];
  appState.yMax *= appState.scaleFactor[1];
  appState.zMin *= appState.scaleFactor[2];
  appState.zMax *= appState.scaleFactor[2];

  appState.widthX = Math.abs(appState.xMax - appState.xMin);
  appState.widthY = Math.abs(appState.yMax - appState.yMin);
  appState.widthZ = Math.abs(appState.zMax - appState.zMin);

  appState.params = [
    appState.widthX,
    appState.widthY,
    appState.widthZ,
    appState.xMin,
    appState.yMin,
    appState.zMin,
  ];

  appState.centerX = (appState.xMin + appState.xMax) / 2 - appState.xMin - 0.5 * appState.widthX;
  appState.centerY = (appState.yMin + appState.yMax) / 2 - appState.yMin - 0.5 * appState.widthY;
  appState.centerZ = (appState.zMin + appState.zMax) / 2 - appState.zMin - 0.5 * appState.widthZ;

  const { nodes: nodePages1, pages: pages } = await Copc.loadHierarchyPage(
    filename,
    copc.info.rootHierarchyPage
  );
  appState.nodePages = nodePages1;
  appState.nodePagesString = JSON.stringify(nodePages1);
  appState.pagesString = JSON.stringify(pages);
}

export async function retrivePoints(projectionViewMatrix, controllerSignal = null) {
  let [keyCountMap, nodeToPrefetch] = traverseTreeWrapper(
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

  keyCountMap = await _filterKeyCountMap(keyCountMap);
  appState.prefetchKeyCountMap = await _filterKeyCountMapPrefetch(nodeToPrefetch);

  appState.clock.getDelta();
  let totalNodes = keyCountMap.length / 2;
  let doneCount = 0;

  for (let m = 0; m < keyCountMap.length; ) {
    let remaining = totalNodes - doneCount;
    let numbWorker = Math.min(MAX_WORKERS, remaining);
    for (let i = 0; i < numbWorker; i++) {
      appState.promises.push(_createWorker(keyCountMap[m], keyCountMap[m + 1]));
      doneCount++;
      m += 2;
      if (doneCount % MAX_WORKERS == 0 || doneCount == totalNodes) {
        await _syncThread();
        if (controllerSignal && controllerSignal.aborted) {
          return;
        }
      }
    }
  }
}

function _createBuffer(positions, colors) {
  let size = positions.length;
  let positionBuffer = device.device.createBuffer({
    label: `${size}`,
    size: size * 4,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });

  let positionMappedArray = new Float32Array(positionBuffer.getMappedRange());
  positionMappedArray.set(positions);
  positionBuffer.unmap();

  let colorBuffer = device.device.createBuffer({
    label: `${size}`,
    size: size * 4,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });

  let colorMappedArray = new Float32Array(colorBuffer.getMappedRange());
  colorMappedArray.set(colors);
  colorBuffer.unmap();
  return [positionBuffer, colorBuffer];
}

function _createWorker(data1, data2) {
  let myNode = data1.split("-").map(Number);
  let myLevel = myNode[0];
  return new Promise((resolve) => {
    let worker = new Worker();
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

async function _syncThread() {
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
      await writeFile(`${SOURCE_FILE_NAME}-${fileName}`, dataJsonStringify);

      let [positionBuffer, colorBuffer] = _createBuffer(data[0], data[1]);

      appState.bufferMap[data[2]] = {
        position: positionBuffer,
        color: colorBuffer,
        maxIntensity: data[3],
      };
    }
  });
}


async function _filterKeyCountMapPrefetch(keyMap) {
  let afterCheckingCache = [];

  for (let i = 0; i < keyMap.length; i += 2) {
    let cachedResult = cache.get(keyMap[i]);
    if (!cachedResult) {
      afterCheckingCache.push(keyMap[i], keyMap[i + 1]);
    }
  }

  let filteredElements = [];
  for (let i = 0; i < afterCheckingCache.length; i += 2) {
    let [exist, data] = await doesExist(
      `${SOURCE_FILE_NAME}-${afterCheckingCache[i]}`
    );
    if (exist) {
      cache.set(afterCheckingCache[i], JSON.stringify(data));
      appState.persCache = getInCache(appState.persCache, afterCheckingCache[i]);
    } else {
      filteredElements.push(afterCheckingCache[i], afterCheckingCache[i + 1]);
      appState.persCache = putInCache(appState.persCache, afterCheckingCache[i], {
        count: 1,
        date: Date.now(),
      });
    }
  }
  throttledUpdatePersCache(mapIntoJSON(cache));
  return filteredElements;
}

async function _filterKeyCountMap(keyMap) {
  let nodeNotFoundInBuffer = 0;
  let nodeFoundInBuffer = 0;
  let nodeFoundInLRU = 0;
  let nodeFoundInPersistent = 0;
  let nodeToFetch = 0;

  let newKeyMap = [];
  let newBufferMap = {};
  for (const key in appState.toDeleteMap) {
    appState.toDeleteMap[key].position.destroy();
    appState.toDeleteMap[key].color.destroy();
    delete appState.toDeleteMap[key];
  }

  let existingBuffers = Object.keys(appState.bufferMap);
  let toDeleteArray = existingBuffers.reduce((acc, val) => {
    acc[val] = true;
    return acc;
  }, {});

  for (let i = 0; i < keyMap.length; i += 2) {
    if (!(keyMap[i] in appState.bufferMap)) {
      newKeyMap.push(keyMap[i], keyMap[i + 1]);
      nodeNotFoundInBuffer++;
    } else {
      nodeFoundInBuffer++;
      let maxIntensity = appState.bufferMap[keyMap[i]].maxIntensity;
      newBufferMap[keyMap[i]] = {
        position: appState.bufferMap[keyMap[i]].position,
        color: appState.bufferMap[keyMap[i]].color,
        maxIntensity: maxIntensity,
      };
      if (maxIntensity > appState.globalMaxIntensity) {
        appState.globalMaxIntensity = maxIntensity;
      }
      appState.persCache = getInCache(appState.persCache, keyMap[i]);
      delete toDeleteArray[keyMap[i]];
    }
  }

  let afterCheckingCache = [];
  for (let i = 0; i < newKeyMap.length; i += 2) {
    let cachedResult = cache.get(newKeyMap[i]);
    if (cachedResult) {
      nodeFoundInLRU++;
      cachedResult = JSON.parse(cachedResult);
      appState.persCache = getInCache(appState.persCache, newKeyMap[i]);
      let [positionBuffer, colorBuffer] = _createBuffer(
        cachedResult.position,
        cachedResult.color
      );
      const maxIntensity = cachedResult.maxIntensity;
      newBufferMap[newKeyMap[i]] = {
        position: positionBuffer,
        color: colorBuffer,
        maxIntensity: maxIntensity,
      };
      if (maxIntensity > appState.globalMaxIntensity) {
        appState.globalMaxIntensity = maxIntensity;
      }
    } else {
      afterCheckingCache.push(newKeyMap[i], newKeyMap[i + 1]);
    }
  }

  let filteredElements = [];
  for (let i = 0; i < afterCheckingCache.length; i += 2) {
    let [exist, data] = await doesExist(
      `${SOURCE_FILE_NAME}-${afterCheckingCache[i]}`
    );
    if (exist) {
      console.log("found in POFS");
      nodeFoundInPersistent++;
      let [positionBuffer, colorBuffer] = _createBuffer(data.position, data.color);
      newBufferMap[afterCheckingCache[i]] = {
        position: positionBuffer,
        color: colorBuffer,
        maxIntensity: data.maxIntensity,
      };
      if (data.maxIntensity > appState.globalMaxIntensity) {
        appState.globalMaxIntensity = data.maxIntensity;
      }
      cache.set(afterCheckingCache[i], JSON.stringify(data));
      appState.persCache = getInCache(appState.persCache, afterCheckingCache[i]);
    } else {
      filteredElements.push(afterCheckingCache[i], afterCheckingCache[i + 1]);
      appState.persCache = putInCache(appState.persCache, afterCheckingCache[i], {
        count: 1,
        date: Date.now(),
      });
      nodeToFetch++;
    }
  }

  throttledUpdatePersCache(mapIntoJSON(cache));

  for (let key in toDeleteArray) {
    appState.toDeleteMap[key] = {
      position: appState.bufferMap[key].position,
      color: appState.bufferMap[key].position,
    };
  }
  appState.bufferMap = newBufferMap;

  updateHtmlUI(
    nodeNotFoundInBuffer,
    nodeFoundInBuffer,
    nodeFoundInLRU,
    nodeFoundInPersistent,
    nodeToFetch
  );
  return filteredElements;
}

async function _createCameraProj() {
  appState.camera = new THREE.PerspectiveCamera(
    50,
    canvas.width / canvas.height,
    0.1,
    4000
  );
  appState.camera.up.set(0, 0, 1);
  appState.camera.position.set(0, 1000, 1000);
  appState.camera.updateProjectionMatrix();

  appState.controls = new OrbitControls(appState.camera, canvas);

  appState.controls.enableDamping = true;
  appState.controls.dampingFactor = 0.5;
  appState.controls.zoomSpeed = 1;
  appState.controls.panSpeed = 2;
  appState.controls.update();

  appState.proj = mat4.perspective(
    mat4.create(),
    (50 * Math.PI) / 180.0,
    canvas.width / canvas.height,
    0.1,
    8000
  );
}

// ============================================================================
// Initialization
// ============================================================================

(async () => {
  await createPersistentMetaCache();
  appState.persCache = await pCache();

  await _createCameraProj();
  await loadCOPC();

  let projViewMatrix = await stages(appState.camera, appState.proj, appState.params);
  await retrivePoints(projViewMatrix);
  await renderWrapper();
})();
