import { LASStats, LASMetadata } from "./las-stats";
import { LAZStats, LAZMetadata } from "./laz-stats";
import { XYZStats, XYZMetadata } from "./xyz-stats";
import { TIFStats, TIFMetadata } from "./tif-stats";
import { COPCStats, COPCMetadata } from "./copc-stats";
import { StatsImplements } from "./implements";

export class StatsFacade {
  private static _display<T>(
    stats: StatsImplements<T>,
    metadata: T,
    elementId: string = "stats-div" //  DOM manipulation
  ): void {
    const consoleLines = stats.displayForConsole(metadata);
    consoleLines.forEach((line) => console.log(line));

    const uiText = stats.formatForUI(metadata);
    const element = document.getElementById(elementId);
    if (element) {
      element.innerText = uiText;
    }
  }

  static displayLAS(metadata: LASMetadata): void {
    this._display(new LASStats(), metadata);
  }

  static displayLAZ(metadata: LAZMetadata): void {
    this._display(new LAZStats(), metadata);
  }

  static displayXYZ(metadata: XYZMetadata): void {
    this._display(new XYZStats(), metadata);
  }

  static displayTIF(metadata: TIFMetadata): void {
    this._display(new TIFStats(), metadata);
  }

  static displayCOPC(metadata: COPCMetadata): void {
    this._display(new COPCStats(), metadata);
  }
}
