import { BaseFileLoader } from "./base-loader";

export interface LASParams {
  las: any;
}

export class LASFileLoader extends BaseFileLoader<LASParams> {
  async loadFile(): Promise<LASParams> {
    const las = 

    return {
      las: null,
    }
  }
}
