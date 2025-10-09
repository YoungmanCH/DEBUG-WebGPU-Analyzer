import { fromUrl } from "geotiff";
import { VectorType } from "../renderers/exports";
import { BaseFileLoader } from "./base-loader";

export interface TIFHeader {
  width: number;
  height: number;
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  resolution: [number, number];
}

export interface TIFPointData {
  positions: Float32Array; // [x, y, z, x, y, z, ...]
  colors?: Float32Array; // [r, g, b, r, g, b, ...]
  elevations?: Float32Array; // [z, z, z, ...] 標高データ（positionsのzとは別）
}

export type TIFDataType = "rgb" | "rgba" | "elevation" | "rgb+elevation" | "grayscale" | "multispectral" | "unknown";

export interface TIFParams {
  header: TIFHeader;
  points: TIFPointData;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  vectorType: VectorType;
  dataType: TIFDataType;
}

export class TIFFileLoader extends BaseFileLoader<TIFParams> {
  async loadFile(): Promise<TIFParams> {
    const image = await this._loadGeoTIFFImage();
    const imageMetadata = this._extractImageMetadata(image);
    const rasterData = await this._readRasterData(image, imageMetadata);

    const conversionResult = this._convertRasterToPointCloud(
      rasterData,
      imageMetadata
    );

    return this._buildTIFParams(conversionResult, imageMetadata);
  }

  private async _loadGeoTIFFImage() {
    const tiff = await fromUrl(this.filename);
    return await tiff.getImage();
  }

  private _extractImageMetadata(image: any) {
    const width = image.getWidth();
    const height = image.getHeight();
    const samplesPerPixel = image.getSamplesPerPixel();
    const bitsPerSample = image.getBitsPerSample();
    const bbox = image.getBoundingBox();

    const bounds = {
      west: bbox[0],
      south: bbox[1],
      east: bbox[2],
      north: bbox[3],
    };

    // 詳細なメタデータを取得
    const fileDirectory = image.fileDirectory;
    const photometricInterpretation = fileDirectory.PhotometricInterpretation;
    const sampleFormat = fileDirectory.SampleFormat || [1]; // デフォルトはUInt
    const planarConfiguration = fileDirectory.PlanarConfiguration;

    // データタイプを正確に判定
    const dataType = this._identifyDataType({
      samplesPerPixel,
      photometricInterpretation,
      sampleFormat,
      bitsPerSample,
    });

    console.log(
      `GeoTIFF: ${width}×${height}, ${samplesPerPixel} channel(s), ${bitsPerSample}-bit, Type: ${dataType}`
    );
    console.log(
      `  PhotometricInterpretation: ${photometricInterpretation}, SampleFormat: ${sampleFormat}`
    );

    return {
      width,
      height,
      samplesPerPixel,
      bitsPerSample,
      sampleFormat,
      photometricInterpretation,
      planarConfiguration,
      bounds,
      dataType,
    };
  }

  private _identifyDataType(metadata: {
    samplesPerPixel: number;
    photometricInterpretation?: number;
    sampleFormat?: number[];
    bitsPerSample?: number;
  }): TIFDataType {
    const { samplesPerPixel, photometricInterpretation, sampleFormat } = metadata;

    // RGB画像の判定 (PhotometricInterpretation = 2: RGB)
    if (photometricInterpretation === 2 && samplesPerPixel === 3) {
      return "rgb";
    }

    // RGBA画像の判定
    if (photometricInterpretation === 2 && samplesPerPixel === 4) {
      return "rgba";
    }

    // 標高データの判定（浮動小数点 + 単一バンド）
    // SampleFormat = 3: Float
    if (samplesPerPixel === 1 && sampleFormat && sampleFormat[0] === 3) {
      return "elevation";
    }

    // グレースケール画像
    // PhotometricInterpretation = 1: BlackIsZero
    if (samplesPerPixel === 1 && photometricInterpretation === 1) {
      return "grayscale";
    }

    // RGB + 標高データの判定（4バンド以上で、最後のバンドが浮動小数点）
    if (samplesPerPixel === 4 && photometricInterpretation === 2 &&
        sampleFormat && sampleFormat.length >= 4 && sampleFormat[3] === 3) {
      return "rgb+elevation";
    }

    // マルチスペクトル（3バンド以上で、RGB解釈ではない）
    if (samplesPerPixel >= 3 && photometricInterpretation !== 2) {
      return "multispectral";
    }

    // 判定できない場合、フォールバック
    // 3チャンネル以上ならRGBと仮定、それ以外は標高データと仮定
    if (samplesPerPixel >= 3) {
      console.warn(`Unknown data type, assuming RGB. samplesPerPixel: ${samplesPerPixel}`);
      return "rgb";
    }

    console.warn(`Unknown data type, assuming elevation. samplesPerPixel: ${samplesPerPixel}`);
    return "elevation";
  }

  private async _readRasterData(image: any, metadata: any) {
    const rasters = await image.readRasters();

    // RGB + 標高データの場合（4バンド目が標高）
    if (metadata.dataType === "rgb+elevation") {
      return {
        rgb: this._interleaveRGBChannels(rasters, metadata.width, metadata.height),
        elevation: rasters[3] as Float32Array,
      };
    }

    // RGBまたはRGBAのみ
    if (metadata.dataType === "rgb" || metadata.dataType === "rgba") {
      return {
        rgb: this._interleaveRGBChannels(rasters, metadata.width, metadata.height),
        elevation: null,
      };
    }

    // 標高データまたはグレースケールのみ
    if (metadata.dataType === "elevation" || metadata.dataType === "grayscale") {
      return {
        rgb: null,
        elevation: rasters[0] as Float32Array,
      };
    }

    // マルチスペクトル画像 - 最初の3バンドをRGBとして処理
    if (metadata.dataType === "multispectral") {
      console.warn("Multispectral image detected, using first 3 bands as RGB");
      return {
        rgb: this._interleaveRGBChannels(rasters, metadata.width, metadata.height),
        elevation: null,
      };
    }

    throw new Error(`Unsupported data type: ${metadata.dataType}`);
  }

  private _interleaveRGBChannels(
    rasters: any,
    width: number,
    height: number
  ): Uint8ClampedArray {
    const r = rasters[0];
    const g = rasters[1];
    const b = rasters[2];
    const data = new Uint8ClampedArray(width * height * 3);

    for (let i = 0; i < width * height; i++) {
      data[i * 3] = r[i];
      data[i * 3 + 1] = g[i];
      data[i * 3 + 2] = b[i];
    }

    return data;
  }

  private _buildTIFParams(conversionResult: any, metadata: any): TIFParams {
    const header = this._createHeader(
      metadata.width,
      metadata.height,
      metadata.bounds
    );
    const boundingBox = this._computeBoundingBox(
      conversionResult.points.positions
    );

    console.log(
      `TIF loaded: ${conversionResult.points.positions.length / 3} points`
    );

    (header as any).samplesPerPixel = metadata.samplesPerPixel;
    (header as any).bitsPerSample = metadata.bitsPerSample;
    (header as any).dataType = metadata.dataType;
    (header as any).sampleFormat = metadata.sampleFormat;
    (header as any).photometricInterpretation = metadata.photometricInterpretation;
    (header as any).elevationRange = conversionResult.elevationRange;

    return {
      header,
      points: conversionResult.points,
      boundingBox,
      vectorType: "vec3",
      dataType: metadata.dataType,
    };
  }

  private _convertRasterToPointCloud(
    rasterData: { rgb: Uint8ClampedArray | null; elevation: Float32Array | null },
    metadata: any
  ): { points: TIFPointData; elevationRange?: string } {
    // Case 1: RGB + 標高データ両方ある
    if (rasterData.rgb && rasterData.elevation) {
      return this._convertRGBWithElevationToPointCloud(
        rasterData.rgb,
        rasterData.elevation,
        metadata
      );
    }

    // Case 2: RGBのみ
    if (rasterData.rgb) {
      return this._convertRGBImageToPointCloud(rasterData.rgb, metadata);
    }

    // Case 3: 標高のみ
    if (rasterData.elevation) {
      return this._convertElevationDataToPointCloud(rasterData.elevation, metadata);
    }

    throw new Error("No valid raster data found");
  }

  private _convertRGBImageToPointCloud(
    rasterData: Uint8ClampedArray,
    metadata: any
  ): { points: TIFPointData } {
    const { width, height, bounds } = metadata;
    const { positions, colors } = this._extractRGBPoints(
      rasterData,
      width,
      height,
      bounds
    );

    return {
      points: {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
      },
    };
  }

  private _extractRGBPoints(
    rasterData: Uint8ClampedArray,
    width: number,
    height: number,
    bounds: any
  ) {
    const positions: number[] = [];
    const colors: number[] = [];
    const isRGBA = rasterData.length === width * height * 4;
    const stride = isRGBA ? 4 : 3;
    const xStep = (bounds.east - bounds.west) / width;
    const yStep = (bounds.north - bounds.south) / height;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const pixelIndex = (row * width + col) * stride;
        const r = rasterData[pixelIndex];
        const g = rasterData[pixelIndex + 1];
        const b = rasterData[pixelIndex + 2];

        const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        const z = luminance * 100;
        const x = bounds.west + col * xStep;
        const y = bounds.north - row * yStep;

        positions.push(x, y, z);
        colors.push(r, g, b);
      }
    }

    return { positions, colors };
  }

  private _convertElevationDataToPointCloud(
    rasterData: Float32Array,
    metadata: any
  ): { points: TIFPointData; elevationRange: string } {
    const { width, height, bounds } = metadata;
    const { positions, minZ, maxZ } = this._extractElevationPoints(
      rasterData,
      width,
      height,
      bounds
    );

    const elevationRange = `${minZ.toFixed(2)}m to ${maxZ.toFixed(2)}m`;
    console.log(
      `  Elevation: ${elevationRange} (range: ${(maxZ - minZ).toFixed(2)}m)`
    );

    const colors = this._generateGrayscaleColors(positions, minZ, maxZ);

    return {
      points: {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
      },
      elevationRange,
    };
  }

  private _convertRGBWithElevationToPointCloud(
    rgbData: Uint8ClampedArray,
    elevationData: Float32Array,
    metadata: any
  ): { points: TIFPointData; elevationRange: string } {
    const { width, height, bounds } = metadata;
    const positions: number[] = [];
    const colors: number[] = [];
    const xStep = (bounds.east - bounds.west) / width;
    const yStep = (bounds.north - bounds.south) / height;

    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const pixelIndex = row * width + col;

        // RGB色データを取得
        const r = rgbData[pixelIndex * 3];
        const g = rgbData[pixelIndex * 3 + 1];
        const b = rgbData[pixelIndex * 3 + 2];

        // 標高データを取得
        const z = elevationData[pixelIndex];

        if (this._isNoDataValue(z)) continue;

        const x = bounds.west + col * xStep;
        const y = bounds.north - row * yStep;

        positions.push(x, y, z); // 標高を使用
        colors.push(r, g, b);    // RGBカラーを使用

        minZ = Math.min(z, minZ);
        maxZ = Math.max(z, maxZ);
      }
    }

    const elevationRange = `${minZ.toFixed(2)}m to ${maxZ.toFixed(2)}m`;
    console.log(
      `  RGB + Elevation: ${elevationRange} (range: ${(maxZ - minZ).toFixed(2)}m)`
    );

    return {
      points: {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        elevations: elevationData, // 元の標高データも保持
      },
      elevationRange,
    };
  }

  private _extractElevationPoints(
    rasterData: Float32Array,
    width: number,
    height: number,
    bounds: any
  ) {
    const positions: number[] = [];
    let minZ = Infinity;
    let maxZ = -Infinity;
    const xStep = (bounds.east - bounds.west) / width;
    const yStep = (bounds.north - bounds.south) / height;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const index = row * width + col;
        const z = rasterData[index];

        if (this._isNoDataValue(z)) continue;

        const x = bounds.west + col * xStep;
        const y = bounds.north - row * yStep;

        positions.push(x, y, z);
        minZ = Math.min(z, minZ);
        maxZ = Math.max(z, maxZ);
      }
    }

    return { positions, minZ, maxZ };
  }

  private _isNoDataValue(value: number): boolean {
    return value < -1000000 || !isFinite(value);
  }

  // カラー設定がない場合、標高に基づくグレースケールカラーを生成
  private _generateGrayscaleColors(
    positions: number[],
    minZ: number,
    maxZ: number
  ): number[] {
    const colors: number[] = [];
    const range = maxZ - minZ;

    for (let i = 2; i < positions.length; i += 3) {
      const z = positions[i];
      const normalizedZ = (z - minZ) / range;
      const gray = normalizedZ * 255;

      colors.push(gray, gray, gray);
    }

    return colors;
  }

  private _createHeader(width: number, height: number, bounds: any): TIFHeader {
    const resolutions: [number, number] = [
      (bounds.east - bounds.west) / width,
      (bounds.north - bounds.south) / height,
    ];

    return {
      width: width,
      height: height,
      bounds: bounds,
      resolution: resolutions,
    };
  }

  private _computeBoundingBox(positions: Float32Array): {
    min: [number, number, number];
    max: [number, number, number];
  } {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }

    const min: [number, number, number] = [minX, minY, minZ];
    const max: [number, number, number] = [maxX, maxY, maxZ];

    return { min: min, max: max };
  }
}
