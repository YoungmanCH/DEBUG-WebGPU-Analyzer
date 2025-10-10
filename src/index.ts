import { createPersistentMetaCache } from "./utils/file-manager";
import { pCache } from "./cache/persistent-cache";
import { initializePointCloud } from "./views/pointcloud-initializer";
import { appState } from "./views/states/state-manager";
import {
  createLASBuffer,
  createXYZBuffer,
  createTIFBuffer,
} from "./webgpu/webgpu-buffer";
import { WebGPURenderer } from "./webgpu/webgpu-renderer";
import { VectorType } from "./renderers/exports";
import { loadCOPCNodes } from "./loaders/copc-node-loader";
import {
  POINT_CLOUD_FILES,
  COPC_FILE,
  LAS_FILES,
  LAZ_FILES,
  XYZ_FILES,
  TIF_FIlES,
} from "./configs";

import "./styles/main.css";

async function _initializeCache() {
  await createPersistentMetaCache();
  appState.persCache = await pCache();
}

async function _initializeFileData() {
  // const { filename, vectorType } = _copc_file_loader();
  // const { filename, vectorType } = _las_file_loader();
  const { filename, vectorType } = _xyz_file_loader();
  // const { filename, vectorType } = _tif_file_loader();
  // const { filename, vectorType } = _laz_file_loader();

  try {
    await initializePointCloud(filename);
  } catch (error) {
    // エラーをUIに表示
    const statsDiv = document.getElementById("stats-div");
    if (statsDiv) {
      statsDiv.innerText = error.message || "Failed to load point cloud";
      statsDiv.style.color = "#ff6b6b";
      statsDiv.style.whiteSpace = "pre-wrap"; // 改行を保持
      statsDiv.style.fontFamily = "monospace";
      statsDiv.style.fontSize = "12px";
      statsDiv.style.padding = "20px";
      statsDiv.style.backgroundColor = "#2a2a2a";
      statsDiv.style.border = "2px solid #ff6b6b";
      statsDiv.style.borderRadius = "8px";
    }
    console.error("Failed to load point cloud:", error);
    throw error;
  }

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

function _laz_file_loader() {
  const filename = LAZ_FILES;
  const vectorType: VectorType = "vec3";
  return { filename, vectorType };
}

function _xyz_file_loader() {
  const filename = XYZ_FILES;
  const vectorType: VectorType = "vec3";
  return { filename, vectorType };
}

function _tif_file_loader() {
  const filename = TIF_FIlES;
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
  } else if (appState.xyzData) {
    createXYZBuffer();
  } else if (appState.tifData) {
    createTIFBuffer();
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
