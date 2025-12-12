import { BaseFileLoader } from "./base-loader";
import { VectorType } from "../renderers/exports";

export interface XYZHeader {
  pointCount: number;
  min: [number, number, number];
  max: [number, number, number];
  hasColors: boolean;
  hasNormals: boolean;
}

export interface XYZPointData {
  positions: Float32Array; // [x, y, z, x, y, z, ...]
  colors?: Float32Array; // [r, g, b, r, g, b, ...]
  normals?: Float32Array; // [nx, ny, nz, nx, ny, nz, ...]
}

export interface XYZParams {
  header: XYZHeader;
  points: XYZPointData;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  vectorType: VectorType; // "vec3"　※ 将来的に "vec4"も対応検討。
}

export class XYZFileLoader extends BaseFileLoader<XYZParams> {
  async loadFile(): Promise<XYZParams> {
    // ファイルをテキストとして読み込み
    const text = await this._fetchTextFile(this.filename);

    // 行に分割（空行とコメント行を除外）
    const lines = text.split("\n").filter(
      (line) => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("//");
      }
    );

    // ヘッダー行のチェック
    let dataStartIndex = 0;
    if (lines.length > 0 && this._isHeaderLine(lines[0])) {
      dataStartIndex = 1;
    }

    const points = this._parsePoints(lines.slice(dataStartIndex));

    const header = this._computeHeader(points);

    const boundingBox = {
      min: header.min,
      max: header.max,
    };

    const vectorType = "vec3";

    console.log(`XYZ file loaded: ${header.pointCount} points`);

    return {
      header: header,
      points: points,
      boundingBox: boundingBox,
      vectorType: vectorType,
    };
  }

  private async _fetchTextFile(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    return response.text();
  }

  private _isHeaderLine(line: string): boolean {
    if (!line) return false;

    // 数字以外の文字が含まれていればヘッダー行と判定
    const values = line.trim().split(/\s+/);
    const isHeaderLine = values.some((v) => isNaN(parseFloat(v)));

    return isHeaderLine;
  }

  private _parsePoints(lines: string[]): XYZPointData {
    const positions: number[] = [];
    const colors: number[] = [];
    let hasColors = false;

    for (const line of lines) {
      if (!line.trim()) continue;

      const values = line.trim().split(/\s+/).map(Number);

      // 最低でもXYZが必要 RGBかどうかの判定は後ほど
      if (values.length < 3) {
        continue;
      }

      positions.push(values[0], values[1], values[2]);

      if (values.length >= 6) {
        hasColors = true;
        const r = values[3];
        const g = values[4];
        const b = values[5];

        // RGB値の範囲を自動判定して正規化
        if (r <= 1 && g <= 1 && b <= 1) {
          // 0-1の範囲: 正規化カラー
          colors.push(r * 255, g * 255, b * 255);
        } else if (r <= 255 && g <= 255 && b <= 255) {
          // 0-255の範囲: 8bitカラー
          colors.push(r, g, b);
        } else {
          // 16bitカラー (0-65535): 8bitに変換
          colors.push(r / 256, g / 256, b / 256);
        }
      } else if (hasColors) {
        // 一部の点にだけ色がある場合、白で埋める（シェーダーで255で割るため255にする）
        colors.push(255, 255, 255);
      }
    }

    const parsedPositions = new Float32Array(positions);
    const parsedColors =
      hasColors && colors.length > 0 ? new Float32Array(colors) : undefined;

    return {
      positions: parsedPositions,
      colors: parsedColors,
    };
  }

  private _computeHeader(points: XYZPointData): XYZHeader {
    const { positions, colors, normals } = points;

    if (positions.length === 0) throw new Error("No point data provided.");

    let minX = positions[0];
    let minY = positions[1];
    let minZ = positions[2];
    let maxX = minX;
    let maxY = minY;
    let maxZ = minZ;

    for (let i = 3; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      minX =  Math.min(minX, x);
      minY =  Math.min(minY, y);
      minZ =  Math.min(minZ, z);

      maxX =  Math.max(maxX, x);
      maxY =  Math.max(maxY, y);
      maxZ =  Math.max(maxZ, z);
    }

    const pointCount = positions.length / 3;
    const minPositions = [minX, minY, minZ] as [number, number, number];
    const maxPositions = [maxX, maxY, maxZ] as [number, number, number];
    const hasColors = colors !== undefined;
    const hasNormals = normals !== undefined;

    return {
      pointCount: pointCount,
      min: minPositions,
      max: maxPositions,
      hasColors: hasColors,
      hasNormals: hasNormals,
    };
  }
}
