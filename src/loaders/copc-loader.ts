import { BaseFileLoader } from "./base-loader";
import { Copc } from "copc";

export interface COPCParams {
  copc: any;
  hierarchy: {
    nodes: any;
    pages: any;
  };
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  vectorType: string; // "vec3" or "vec4"
}

export class COPCFileLoader extends BaseFileLoader<COPCParams> {
  async loadFile(): Promise<COPCParams> {
    const copc = await Copc.create(this.filename);
    const hierarchy = await this._loadHierarchy(copc);
    const boundingBox = {
      min: copc.header.min,
      max: copc.header.max,
    };
    const vectorType = "vec4";

    console.log(`Loading COPC file: ${this.filename}`);
    console.log("COPC file loaded:", copc);

    return {
      copc,
      hierarchy,
      boundingBox,
      vectorType,
    };
  }

  private async _loadHierarchy(copc: any) {
    const { nodes, pages } = await Copc.loadHierarchyPage(
      this.filename,
      copc.info.rootHierarchyPage
    );

    return { nodes, pages };
  }
}
