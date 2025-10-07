import * as THREE from "three";

import { COPCParams } from "../loaders/copc-loader";
import { LASParams } from "../loaders/las-loader";

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

  // LAS data
  lasData: null,

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



export function updateCOPCState(copcData: COPCParams) {
  // Initialize COPC state
  appState.scaleFactor = [1.0, 1.0, 1.0];
  appState.copcString = JSON.stringify(copcData.copc);

  // Set bounding box
  [
    appState.xMin,
    appState.yMin,
    appState.zMin,
    appState.xMax,
    appState.yMax,
    appState.zMax,
  ] = [...copcData.boundingBox.min, ...copcData.boundingBox.max];

  // Calculate scaled bounding box
  appState.xMin *= appState.scaleFactor[0];
  appState.xMax *= appState.scaleFactor[0];
  appState.yMin *= appState.scaleFactor[1];
  appState.yMax *= appState.scaleFactor[1];
  appState.zMin *= appState.scaleFactor[2];
  appState.zMax *= appState.scaleFactor[2];

  // Calculate dimensions
  appState.widthX = Math.abs(appState.xMax - appState.xMin);
  appState.widthY = Math.abs(appState.yMax - appState.yMin);
  appState.widthZ = Math.abs(appState.zMax - appState.zMin);

  // Set params
  appState.params = [
    appState.widthX,
    appState.widthY,
    appState.widthZ,
    appState.xMin,
    appState.yMin,
    appState.zMin,
  ];

  // Calculate center
  appState.centerX =
    (appState.xMin + appState.xMax) / 2 - appState.xMin - 0.5 * appState.widthX;
  appState.centerY =
    (appState.yMin + appState.yMax) / 2 - appState.yMin - 0.5 * appState.widthY;
  appState.centerZ =
    (appState.zMin + appState.zMax) / 2 - appState.zMin - 0.5 * appState.widthZ;

  // Set hierarchy data
  appState.nodePages = copcData.hierarchy.nodes;
  appState.nodePagesString = JSON.stringify(copcData.hierarchy.nodes);
  appState.pagesString = JSON.stringify(copcData.hierarchy.pages);
}


export function updateLASState(lasData: LASParams) {
  // スケールファクターを設定（正規化）
  appState.scaleFactor = [1.0, 1.0, 1.0];

  // バウンディングボックスを設定
  [
    appState.xMin,
    appState.yMin,
    appState.zMin,
    appState.xMax,
    appState.yMax,
    appState.zMax,
  ] = [...lasData.boundingBox.min, ...lasData.boundingBox.max];

  // スケール適用
  appState.xMin *= appState.scaleFactor[0];
  appState.xMax *= appState.scaleFactor[0];
  appState.yMin *= appState.scaleFactor[1];
  appState.yMax *= appState.scaleFactor[1];
  appState.zMin *= appState.scaleFactor[2];
  appState.zMax *= appState.scaleFactor[2];

  // 寸法計算
  appState.widthX = Math.abs(appState.xMax - appState.xMin);
  appState.widthY = Math.abs(appState.yMax - appState.yMin);
  appState.widthZ = Math.abs(appState.zMax - appState.zMin);

  // パラメータ設定
  appState.params = [
    appState.widthX,
    appState.widthY,
    appState.widthZ,
    appState.xMin,
    appState.yMin,
    appState.zMin,
  ];

  // 中心点計算
  appState.centerX =
    (appState.xMin + appState.xMax) / 2 - appState.xMin - 0.5 * appState.widthX;
  appState.centerY =
    (appState.yMin + appState.yMax) / 2 - appState.yMin - 0.5 * appState.widthY;
  appState.centerZ =
    (appState.zMin + appState.zMax) / 2 - appState.zMin - 0.5 * appState.widthZ;

  // LASデータを一時保存（WebGPU初期化後にバッファ作成）
  appState.lasData = lasData;
}
