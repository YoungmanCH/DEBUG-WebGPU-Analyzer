import { lruCache } from "./lru-cache";
import { getInCache, putInCache } from "./persistent-cache";
import { createBuffer } from "../webgpu/webgpu-buffer";
import { appState } from "../canvas/state-manager";
import { updateHtmlUI } from "../helper";
import { doesExist, throttledUpdatePersCache } from "../utils/file-manager";

export async function resolvePrefetchNodes(keyMap: any, filename: string) {
  let afterCheckingCache = [];

  for (let i = 0; i < keyMap.length; i += 2) {
    let cachedResult = lruCache.get(keyMap[i]);
    if (!cachedResult) {
      afterCheckingCache.push(keyMap[i], keyMap[i + 1]);
    }
  }

  let filteredElements = [];
  for (let i = 0; i < afterCheckingCache.length; i += 2) {
    let [exist, data] = (await doesExist(
      `${filename}-${afterCheckingCache[i]}`
    )) as any;
    if (exist) {
      lruCache.set(afterCheckingCache[i], JSON.stringify(data));
      appState.persCache = getInCache(
        appState.persCache,
        afterCheckingCache[i]
      );
    } else {
      filteredElements.push(afterCheckingCache[i], afterCheckingCache[i + 1]);
      appState.persCache = putInCache(
        appState.persCache,
        afterCheckingCache[i],
        {
          count: 1,
          date: Date.now(),
        }
      );
    }
  }
  throttledUpdatePersCache(_mapIntoJSON(lruCache));

  return filteredElements;
}

export async function resolveNodeCache(keyMap: any, filename: string) {
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

  // Step 1: Search in BufferMap
  for (let i = 0; i < keyMap.length; i += 2) {
    if (!(keyMap[i] in appState.bufferMap)) {
      newKeyMap.push(keyMap[i], keyMap[i + 1]);
      nodeNotFoundInBuffer++;
    } else {
      nodeFoundInBuffer++;
      const existingBuffer = appState.bufferMap[keyMap[i]];
      newBufferMap[keyMap[i]] = {
        position: existingBuffer.position,
        color: existingBuffer.color,
        maxIntensity: existingBuffer.maxIntensity,
        numPoints: existingBuffer.numPoints,
      };
      if (existingBuffer.maxIntensity > appState.globalMaxIntensity) {
        appState.globalMaxIntensity = existingBuffer.maxIntensity;
      }
      appState.persCache = getInCache(appState.persCache, keyMap[i]);
      delete toDeleteArray[keyMap[i]];
    }
  }

  // Step 2: Search in LRU Cache
  let afterCheckingCache = [];
  for (let i = 0; i < newKeyMap.length; i += 2) {
    let cachedResult: any = lruCache.get(newKeyMap[i]);
    if (cachedResult) {
      nodeFoundInLRU++;
      cachedResult = JSON.parse(cachedResult);
      appState.persCache = getInCache(appState.persCache, newKeyMap[i]);
      let [positionBuffer, colorBuffer] = createBuffer(
        cachedResult.position,
        cachedResult.color
      );
      const maxIntensity = cachedResult.maxIntensity;
      const numPoints = cachedResult.position.length / 4; // position is float32x4
      newBufferMap[newKeyMap[i]] = {
        position: positionBuffer,
        color: colorBuffer,
        maxIntensity: maxIntensity,
        numPoints: numPoints,
      };
      if (maxIntensity > appState.globalMaxIntensity) {
        appState.globalMaxIntensity = maxIntensity;
      }
    } else {
      afterCheckingCache.push(newKeyMap[i], newKeyMap[i + 1]);
    }
  }

  // Step 3: Search in Persistent Cache
  let filteredElements = [];
  for (let i = 0; i < afterCheckingCache.length; i += 2) {
    let [exist, data] = (await doesExist(
      `${filename}-${afterCheckingCache[i]}`
    )) as any;
    if (exist) {
      console.log("found in POFS");
      nodeFoundInPersistent++;
      let [positionBuffer, colorBuffer] = createBuffer(
        data.position,
        data.color
      );
      const numPoints = data.position.length / 4; // position is float32x4
      newBufferMap[afterCheckingCache[i]] = {
        position: positionBuffer,
        color: colorBuffer,
        maxIntensity: data.maxIntensity,
        numPoints: numPoints,
      };
      if (data.maxIntensity > appState.globalMaxIntensity) {
        appState.globalMaxIntensity = data.maxIntensity;
      }
      lruCache.set(afterCheckingCache[i], JSON.stringify(data));
      appState.persCache = getInCache(
        appState.persCache,
        afterCheckingCache[i]
      );
    } else {
      filteredElements.push(afterCheckingCache[i], afterCheckingCache[i + 1]);
      appState.persCache = putInCache(
        appState.persCache,
        afterCheckingCache[i],
        {
          count: 1,
          date: Date.now(),
        }
      );
      nodeToFetch++;
    }
  }

  throttledUpdatePersCache(_mapIntoJSON(lruCache));

  // Mark unused buffers for deletion
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

function _mapIntoJSON(map) {
  return JSON.stringify(Object.fromEntries(map));
}
