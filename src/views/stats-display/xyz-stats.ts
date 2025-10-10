import { StatsImplements } from "./implements";

export interface XYZMetadata {
  filename: string;
  pointCount: number;
  hasRGB: boolean;
}

export class XYZStats implements StatsImplements<XYZMetadata> {
  displayForConsole(metadata: XYZMetadata): string[] {
    return [
      '=== XYZ File Info ===',
      `File: ${metadata.filename}`,
      `Total Points: ${metadata.pointCount.toLocaleString()}`,
      `Color Data: ${metadata.hasRGB ? 'RGB Available' : 'No RGB (Gray)'}`,
    ];
  }

  formatForUI(metadata: XYZMetadata): string {
    return `XYZ File Loaded
                    File: ${metadata.filename}
                    Points: ${metadata.pointCount.toLocaleString()}
                    Color: ${metadata.hasRGB ? 'RGB' : 'Gray'}`;
  }
}
