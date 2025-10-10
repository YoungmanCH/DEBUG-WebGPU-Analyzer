import { StatsImplements } from "./implements";
import { BoundingBox } from "./types";

export interface LAZMetadata {
  filename: string;
  pointCount: number;
  version: string;
  hasRGB: boolean;
  maxIntensity: number;
  boundingBox: BoundingBox;
  scaleFactor: number[];
}

export class LAZStats implements StatsImplements<LAZMetadata> {
  displayForConsole(metadata: LAZMetadata): string[] {
    const lines = [
      `=== LAZ File Info ===`,
      `File: ${metadata.filename}`,
      `Version: ${metadata.version}`,
      `Total Points: ${metadata.pointCount.toLocaleString()}`,
      `Color Data: ${metadata.hasRGB ? 'RGB Available' : 'No RGB (Gray)'}`,
      `Max Intensity: ${metadata.maxIntensity}`,
    ];

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

  formatForUI(metadata: LAZMetadata): string {
    return `LAZ File Loaded
                    File: ${metadata.filename}
                    Points: ${metadata.pointCount.toLocaleString()}
                    Version: ${metadata.version}
                    Color: ${metadata.hasRGB ? 'RGB' : 'Gray'}`;
  }
}
