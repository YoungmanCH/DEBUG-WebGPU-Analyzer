import { COPCFileLoader, COPCParams } from "./copc-loader";
import { LASFileLoader, LASParams } from "./las-loader";
import { XYZFileLoader, XYZParams } from "./xyz-loader";
import { TIFFileLoader, TIFParams } from "./tif-loader";

type extensionType =
  | "copc"
  | "las"
  | "laz"
  | "tif"
  | "tiff"
  | "xyz"
  | "txt"
  | "unknown";

type PointCloudData = COPCParams | LASParams | XYZParams | TIFParams;

export class PointCloudLoader {
  filenames: string[];

  constructor(filename: string | string[]) {
    this.filenames = Array.isArray(filename) ? filename : [filename];
  }

  async loadFiles(
    onFileLoaded: (
      data: PointCloudData,
      format: extensionType,
      filename: string
    ) => Promise<void>
  ): Promise<void> {
    console.log(`Loading ${this.filenames.length} point cloud files...`);

    for (const filename of this.filenames) {
      const format = this._detectFileFormat(filename);
      let data: PointCloudData | null = null;

      switch (format) {
        case "copc":
          const copcLoader = new COPCFileLoader(filename);
          data = await copcLoader.loadFile();
          break;
        case "las":
        case "laz":
          const lasLoader = new LASFileLoader(filename);
          data = await lasLoader.loadFile();
          break;
        case "tif":
        case "tiff":
          const tifLoader = new TIFFileLoader(filename);
          data = await tifLoader.loadFile();
          break;
        case "xyz":
          const xyzLoader = new XYZFileLoader(filename);
          data = await xyzLoader.loadFile();
          break;
        case "txt":
          // TODO: update
          console.log(`TXT format not yet supported: ${filename}`);
          break;
        default:
          console.warn(`Unknown file format for: ${filename}`);
      }

      if (data) {
        await onFileLoaded(data, format, filename);
      }
    }
  }

  private _detectFileFormat(filename: string): extensionType {
    const lowerFilename = filename.toLowerCase();

    if (lowerFilename.endsWith(".copc.laz")) {
      return "copc";
    } else if (lowerFilename.endsWith(".las")) {
      return "las";
    } else if (lowerFilename.endsWith(".laz")) {
      return "laz";
    } else if (
      lowerFilename.endsWith(".tif") ||
      lowerFilename.endsWith(".tiff")
    ) {
      return "tif";
    } else if (lowerFilename.endsWith(".xyz")) {
      return "xyz";
    } else if (lowerFilename.endsWith(".txt")) {
      return "txt";
    } else {
      return "unknown";
    }
  }
}
