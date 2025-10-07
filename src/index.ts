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
import { retrivePoints } from "./loaders/point-cloud-loader";

import "./styles/main.css";

function _files_loader(): any {
  const files: string = (process.env as any).POINT_CLOUD_FILES;
  const parsed_files: string[] = JSON.parse(files);

  return parsed_files;
}

function _copc_file_loader(): string {
  const filename = (process.env as any).COPC_FILE;

  return filename;
}

function _las_file_loader(): string {
  const filename = (process.env as any).LAS_FILES;

  return filename;
}

// ============================================================================
// Initialization
// ============================================================================




async function _render(file: string): Promise<void> {
  const vectorType: VectorType = "vec4";
  const renderer = new WebGPURenderer("screen-canvas", vectorType);

  await renderer.initialize();

  const projView = renderer.getProjView();

  if (appState.lasData) {
    createLASBuffer();
  } else {
    await retrivePoints(file.split("/").pop().split(".")[0], projView);
  }

  renderer.start();
}

(async () => {
  await createPersistentMetaCache();
  appState.persCache = await pCache();

  // const files = _files_loader();
  // await initializePointCloud(files);

  // const file = _las_file_loader();
  // await initializeLAS(file);

  const file = _copc_file_loader();
  await initializeCOPC(file);

  await _render(file);
})();
