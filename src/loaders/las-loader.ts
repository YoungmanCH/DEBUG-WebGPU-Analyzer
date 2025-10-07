import { BaseFileLoader } from "./base-loader";
import { LASLoader } from "@loaders.gl/las";
import { load } from "@loaders.gl/core";

export interface LASHeader {
  version: string;
  pointFormat: number;
  pointCount: number;
  scale: [number, number, number];
  offset: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
}

export interface LASPointData {
  positions: Float32Array; // [x, y, z, x, y, z, ...]
  colors?: Float32Array; // [r, g, b, r, g, b, ...]
  intensities?: Uint16Array;
  classifications?: Uint8Array;
}

export interface LASParams {
  header: LASHeader;
  points: LASPointData;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  vectorType: string; // "vec3" or "vec4"
}

export class LASFileLoader extends BaseFileLoader<LASParams> {
  async loadFile(): Promise<LASParams> {
    const lasData = await load(this.filename, LASLoader, {
      las: {
        // オプション設定
        colorDepth: 16, // 16-bit colors
        skip: 1, // 間引き（1 = 全ポイント読み込み）
      },
    });

    const header = this._parseHeader(lasData.header, lasData.loaderData);
    const points = this._parsePoints(lasData);
    const boundingBox = {
      min: header.min,
      max: header.max,
    };
    const vectorType = "vec3";

    console.log(`LAS file loaded: ${header.pointCount} points`);

    return {
      header,
      points,
      boundingBox,
      vectorType
    };
  }

  private _parseHeader(header: any, loaderData: any): LASHeader {
    return {
      version: `${header.versionMajor || 1}.${header.versionMinor || 2}`,
      pointFormat: loaderData.pointsFormatId,
      pointCount: loaderData.pointsCount,
      scale: loaderData.scale,
      offset: loaderData.offset,
      min: loaderData.mins,
      max: loaderData.maxs,
    };
  }

  private _parsePoints(lasData: any): LASPointData {
    const positions = lasData.attributes.POSITION?.value;
    const colors = lasData.attributes.COLOR_0?.value;
    const intensities = lasData.attributes.intensity?.value;
    const classifications = lasData.attributes.classification?.value;

    return {
      positions,
      colors,
      intensities,
      classifications,
    };
  }
}
