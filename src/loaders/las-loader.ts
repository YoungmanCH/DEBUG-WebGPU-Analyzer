import { LASLoader } from "@loaders.gl/las";
import { load } from "@loaders.gl/core";

import { VectorType } from "../renderers/exports";
import { BaseFileLoader } from "./base-loader";

interface LASHeader {
  version: string;
  pointFormat: number;
  pointCount: number;
  scale: [number, number, number];
  offset: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
}

interface LASPointData {
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
  vectorType: VectorType;
}

export class LASFileLoader extends BaseFileLoader<LASParams> {
  /**
   * LAZ/LASファイルのヘッダーから直接バージョンを読み取る
   */
  private async _readLAZVersion(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const view = new DataView(buffer);

      // LASヘッダーのオフセット24-25にバージョン情報がある
      const versionMajor = view.getUint8(24);
      const versionMinor = view.getUint8(25);

      return `${versionMajor}.${versionMinor}`;
    } catch (error) {
      console.warn('Failed to read LAZ version from header:', error);
      return "1.2"; // デフォルト
    }
  }

  async loadFile(): Promise<LASParams> {
    try {
      // ファイルのバージョンを直接読み取る
      const fileVersion = await this._readLAZVersion(this.filename);

      const lasData = await load(this.filename, LASLoader, {
        las: {
          // オプション設定
          colorDepth: 16, // 16-bit colors
          skip: 1, // 間引き（1 = 全ポイント読み込み）
        },
      });

      const header = this._parseHeader(lasData.header, lasData.loaderData, fileVersion);
      const points = this._parsePoints(lasData);
      const boundingBox = {
        min: header.min,
        max: header.max,
      };
      const vectorType = "vec3";

      console.log(`LAS/LAZ file loaded: ${header.pointCount} points (version ${header.version})`);

      return {
        header,
        points,
        boundingBox,
        vectorType,
      };
    } catch (error) {
      // LAZ v1.4エラーを検出
      if (error.message && error.message.includes("file versions <= 1.3")) {
        const filename = this.filename.split("/").pop() || this.filename;
        throw new Error(
          `❌ LAZ v1.4+ File Not Supported\n\n` +
          `File: ${filename}\n\n` +
          `The current library (@loaders.gl/las) only supports LAZ v1.0-1.3.\n\n` +
          `📋 Solution: Use the LAZ converter tool\n\n` +
          `1. Convert LAZ v1.4+ to v1.3:\n` +
          `   cd laz-converter\n` +
          `   node convert.js ../dataset/laz/${filename} -o ../dataset/laz/v13_${filename}\n\n` +
          `2. Update .env to use the converted file:\n` +
          `   LAZ_FILES="dataset/laz/v13_${filename}"\n\n` +
          `Note: The converter will check RGB presence and preserve available data.\n` +
          `For COPC format (recommended for v1.4 files with RGB), see the converter README.`
        );
      }
      throw error;
    }
  }

  private _parseHeader(header: any, loaderData: any, fileVersion: string): LASHeader {
    console.log(`LAS/LAZ Version: ${fileVersion} (format: ${loaderData.pointsFormatId})`);

    return {
      version: fileVersion,
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
