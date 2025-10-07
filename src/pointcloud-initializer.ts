import { PointCloudLoader } from "./loaders/pointcloud-loader";
import {
  appState,
  updateCOPCState,
  updateLASState,
} from "./canvas/state-manager";
import { LASParams } from "./loaders/las-loader";
import { COPCParams } from "./loaders/copc-loader";

export async function initializePointCloud(files: string[]) {
  const loader = new PointCloudLoader(files);

  await loader.loadFiles(async (data, format, files) => {
    console.log(`Processing ${format} file: ${files}`);

    switch (format) {
      case "copc":
        appState.clock.getDelta(); // clock.getDelat()を呼び出すことで経過時間を計測・リセット
        updateCOPCState(data as COPCParams);
        break;
      case "las":
        updateLASState(data as LASParams);
        break;
      case "laz":
        // updateLAZState(data);
        break;
      default:
        console.warn(`No state updater for format: ${format}`);
    }
  });
}

export async function initializeCOPC(file: string) {
  appState.clock.getDelta(); // clock.getDelat()を呼び出すことで経過時間を計測・リセット

  const loader = new PointCloudLoader(file);
  await loader.loadFiles(async (data, format, file) => {
    console.log(`Processing ${format} file: ${file}`);

    switch (format) {
      case "copc":
        updateCOPCState(data as COPCParams);
        break;
      case "las":
        updateLASState(data as LASParams);
        break;
      default:
        console.warn(`Unexpected format in loadCOPC: ${format}`);
    }
  });
}

export async function initializeLAS(file: string) {
  appState.clock.getDelta(); // clock.getDelat()を呼び出すことで経過時間を計測・リセット

  const loader = new PointCloudLoader(file);
  await loader.loadFiles(async (data, format, file) => {
    console.log(`Processing ${format} file: ${file}`);

    switch (format) {
      case "copc":
        updateCOPCState(data as COPCParams);
        break;
      case "las":
        updateLASState(data as LASParams);
        break;
      default:
        console.warn(`Unexpected format in loadCOPC: ${format}`);
    }
  });
}
