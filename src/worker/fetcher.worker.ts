import { Copc } from "copc";
import * as THREE from "three";
import { POINT_CLOUD_FILES, LAS_FILES, COPC_FILE } from "../configs";

// TODO: 後でファイルを読み込みを修正する。
function _files_loader(): any {
  const files: string = POINT_CLOUD_FILES;
  const parsed_files: string[] = JSON.parse(files);

  return parsed_files;
}

function _las_file_loader(): string {
  const filename = LAS_FILES;

  return filename;
}

function _copc_file_loader(): string {
  const filename = COPC_FILE;

  return filename;
}

// const files = _files_loader();
const FILENAME = _copc_file_loader();
// const FILENAME = _las_file_loader();

// Worker state
const workerState = {
  color: new THREE.Color(),
  colors: [],
  positions: [],
  maxZ: -999,
  minZ: 1000,
  maxIntensity: -100,

  // Geometry bounds
  xMin: 0,
  yMin: 0,
  zMin: 0,
  widthX: 0,
  widthY: 0,
  widthZ: 0,
  scaleX: 0,
  scaleY: 0,
  scaleZ: 0,
  level: 0,
};

// ============================================================================
// Message Handlers
// ============================================================================

onmessage = function (message) {
  const nodePagesStr = message.data[0];
  const nodes = JSON.parse(nodePagesStr);
  const copcStr = message.data[2];
  const copc = JSON.parse(copcStr);

  const mapIndex = message.data[3];
  const pointCount = message.data[4];
  const myRoot = nodes[mapIndex];

  workerState.xMin = message.data[5][0];
  workerState.yMin = message.data[5][1];
  workerState.zMin = message.data[5][2];
  workerState.widthX = message.data[5][3];
  workerState.widthY = message.data[5][4];
  workerState.widthZ = message.data[5][5];
  workerState.scaleX = message.data[5][6];
  workerState.scaleY = message.data[5][7];
  workerState.scaleZ = message.data[5][8];
  workerState.level = message.data[5][9];

  _loadData(copc, myRoot, pointCount);
};

async function _init() {
  postMessage(200);
}

async function _loadData(copc, myRoot, pointCount) {
  const view = await Copc.loadPointDataView(FILENAME, copc, myRoot);
  const getters = ["X", "Y", "Z", "Red", "Green", "Blue"].map(view.getter);

  for (let j = 0; j < pointCount; j += 1) {
    _readPoints(j, getters);
  }

  postMessage([
    workerState.positions,
    workerState.colors,
    [
      workerState.minZ,
      workerState.maxZ,
      workerState.maxIntensity,
      workerState.level,
    ],
  ]);
}

function _readPoints(id, getters) {
  const returnPoint = _getXYZRGB(id, getters);

  if (returnPoint[2] > workerState.maxZ) {
    workerState.maxZ = returnPoint[2];
  }
  if (returnPoint[2] < workerState.minZ) {
    workerState.minZ = returnPoint[2];
  }

  workerState.positions.push(returnPoint[0], returnPoint[1], returnPoint[2]);

  const vx = returnPoint[3];
  if (vx > workerState.maxIntensity) {
    workerState.maxIntensity = vx;
  }

  workerState.color.setRGB(returnPoint[3], returnPoint[4], returnPoint[5]);
  workerState.colors.push(
    workerState.color.r,
    workerState.color.g,
    workerState.color.b
  );
}

function _getXYZRGB(index, getters) {
  return getters.map((get) => get(index));
}

// Initialize worker
_init();
