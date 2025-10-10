import { StatsImplements } from "./implements";
import { BoundingBox } from "./types";

export interface TIFMetadata {
  filename: string;
  pointCount: number;
  width: number;
  height: number;
  dataType: string;
  samplesPerPixel: number;
  bitsPerSample: number;
  elevationRange: string;
  boundingBox: BoundingBox;
  scaleFactor: number[];
}

export class TIFStats implements StatsImplements<TIFMetadata> {
  displayForConsole(metadata: TIFMetadata): string[] {
    const lines = [
      '=== GeoTIFF File Info ===',
      `File: ${metadata.filename}`,
      `Total Points: ${metadata.pointCount.toLocaleString()}`,
      `Grid Size: ${metadata.width} × ${metadata.height}`,
      `Type: ${metadata.dataType}`,
      `Channels: ${metadata.samplesPerPixel}, Bit Depth: ${metadata.bitsPerSample}-bit`,
    ];

    if (metadata.dataType === 'elevation' || metadata.dataType === 'rgb+elevation') {
      lines.push(`Elevation Range: ${metadata.elevationRange}`);
    }

    if (metadata.boundingBox) {
      const bbox = metadata.boundingBox;
      lines.push(
        `Box Dimensions:`,
        `  X: ${bbox.widthX.toFixed(2)} (${bbox.xMin.toFixed(2)} : ${bbox.xMax.toFixed(2)})`,
        `  Y: ${bbox.widthY.toFixed(2)} (${bbox.yMin.toFixed(2)} : ${bbox.yMax.toFixed(2)})`,
        `  Z: ${bbox.widthZ.toFixed(2)} (${bbox.zMin.toFixed(2)} : ${bbox.zMax.toFixed(2)})`,
        `Shifted Box Center: (${bbox.centerX.toFixed(2)}, ${bbox.centerY.toFixed(2)}, ${bbox.centerZ.toFixed(2)})`,
        `Global Box Center: (${((bbox.xMin + bbox.xMax) / 2).toFixed(6)}, ${((bbox.yMin + bbox.yMax) / 2).toFixed(6)}, ${((bbox.zMin + bbox.zMax) / 2).toFixed(6)})`
      );
    }

    if (metadata.scaleFactor) {
      lines.push(`Global Scale: ${metadata.scaleFactor.join(', ')}`);
    }

    return lines;
  }

  formatForUI(metadata: TIFMetadata): string {
    return `GeoTIFF Loaded
                    File: ${metadata.filename}
                    Points: ${metadata.pointCount.toLocaleString()}
                    Grid: ${metadata.width} × ${metadata.height}
                    Type: ${metadata.dataType}`;
  }
}
