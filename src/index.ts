import { createPersistentMetaCache } from "./utils/file-manager";
import { pCache } from "./cache/persistent-cache";
import {
  initializePointCloud,
  initializeCOPC,
  initializeLAS,
} from "./pointcloud-initializer";
import { appState } from "./canvas/state-manager";
import { createLASBuffer } from "./webgpu/webgpu-buffer";

import { WebGPURenderer } from "./webgpu/webgpu-renderer";
import { VectorType } from "./renderers/exports";
import { loadCOPCNodes } from "./loaders/copc-node-loader";
import { POINT_CLOUD_FILES, COPC_FILE, LAS_FILES } from "./configs";

import "./styles/main.css";

async function _initializeCache() {
  await createPersistentMetaCache();
  appState.persCache = await pCache();
}

async function _initializeFileData() {
  // const files = _files_loader();
  // await initializePointCloud(files);

  const { filename, vectorType } = _las_file_loader();
  await initializeLAS(filename);

  // const { filename, vectorType } = _copc_file_loader();
  // await initializeCOPC(filename);

  return { filename, vectorType };
}

function _files_loader(): any {
  const files: string = POINT_CLOUD_FILES;
  const parsed_files: string[] = JSON.parse(files);

  return parsed_files;
}

function _copc_file_loader() {
  const filename = COPC_FILE;
  const vectorType: VectorType = "vec4";

  return { filename, vectorType };
}

function _las_file_loader() {
  const filename = LAS_FILES;
  const vectorType: VectorType = "vec3";

  return { filename, vectorType };
}

// ============================================================================
// Initialization
// ============================================================================

async function _render(file: string, vectorType: VectorType): Promise<void> {
  const renderer = new WebGPURenderer(vectorType);
  await renderer.initialize();

  if (appState.lasData) {
    createLASBuffer();
  } else {
    const projView = renderer.getProjView();
    await loadCOPCNodes(file.split("/").pop().split(".")[0], projView);
  }

  renderer.start();
}

(async () => {
  await _initializeCache();
  const { filename, vectorType } = await _initializeFileData();
  await _render(filename, vectorType);
})();
