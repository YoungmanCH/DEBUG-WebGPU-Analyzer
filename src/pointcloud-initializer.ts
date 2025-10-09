import {
  appState,
  updateCOPCState,
  updateLASState,
  updateXYZState,
  updateTIFState,
} from "./canvas/state-manager";
import {
  COPCParams,
  LASParams,
  XYZParams,
  TIFParams,
  PointCloudLoader,
} from "./loaders/exports";

export async function initializePointCloud(files: string[]) {
  const loader = new PointCloudLoader(files);

  const onFileLoaded = async (data, format, files) => {
    console.log(`Processing ${format} file: ${files}`);

    switch (format) {
      case "copc":
        // clock.getDelat()を呼び出すことで経過時間を計測・リセット
        appState.clock.getDelta();
        updateCOPCState(data as COPCParams);
        break;
      case "las":
        appState.clock.getDelta();
        updateLASState(data as LASParams);
        break;
      case "laz":
        // updateLAZState(data);
        break;
      case "tif":
      case "tiff":
        appState.clock.getDelta();
        updateTIFState(data as TIFParams);
        break;
      case "xyz":
        appState.clock.getDelta();
        updateXYZState(data as XYZParams);
        break;
      case "txt":
        // updateTXTState(data);
        break;
      default:
        console.warn(`No state updater for format: ${format}`);
    }
  };

  await loader.loadFiles(onFileLoaded);
}
