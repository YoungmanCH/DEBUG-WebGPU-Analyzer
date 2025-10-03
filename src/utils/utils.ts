import { COPCFileLoader, COPCParams } from "../loaders/copc-loader";
// import { LASFileLoader, LASParams } from "../loaders/las-loader";
// import { LAZFileLoader, LAZParams } from "../loaders/laz-loader";

export function deepCopy(obj) {
  const newObj = {};

  for (let key in obj) {
    const value = obj[key];

    if (typeof value === "object" && value !== null) {
      newObj[key] = deepCopy(value);
    } else {
      newObj[key] = value;
    }
  }

  return newObj;
}


export type extensionType = "copc" | "las" | "laz" | "tif" | "xyz" | "unknown";

export type PointCloudData = COPCParams;
// export type PointCloudData = COPCParams | LASParams | LAZParams;

export class FileLoader {
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
          // const lasLoader = new LASFileLoader(filename);
          // data = await lasLoader.loadFile();
          break;
        case "laz":
          // const lazLoader = new LAZFileLoader(filename);
          // data = await lazLoader.loadFile();
          break;
        case "tif":
          // TODO: update
          console.log(`TIF format not yet supported: ${filename}`);
          break;
        case "xyz":
          // TODO: update
          console.log(`XYZ format not yet supported: ${filename}`);
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
    }

    return "unknown";
  }
}
