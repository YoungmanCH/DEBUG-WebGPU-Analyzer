import { StatsImplements } from "./implements";

export interface COPCMetadata {
  totalNodes: number;
  nodesInBuffer: number;
  nodesNotInBuffer: number;
  nodesInLRU: number;
  nodesInPersistent: number;
  nodesToFetch: number;
}

export class COPCStats implements StatsImplements<COPCMetadata> {
  displayForConsole(metadata: COPCMetadata): string[] {
    return [
      "=== COPC Cache Stats ===",
      `Total nodes needed: ${metadata.totalNodes}`,
      `Nodes in GPU Buffer: ${metadata.nodesInBuffer}`,
      `Nodes need to be loaded: ${metadata.nodesNotInBuffer}`,
      `Nodes in LRU Cache: ${metadata.nodesInLRU}`,
      `Nodes in Persistent: ${metadata.nodesInPersistent}`,
      `Nodes to fetch: ${metadata.nodesToFetch}`,
    ];
  }

  formatForUI(metadata: COPCMetadata): string {
    return `Among total nodes needed ${metadata.totalNodes}
                    nodes found in GPU Buffer: ${metadata.nodesInBuffer}
                    ----------------------------------------------------
                    nodes need to be loaded ${metadata.nodesNotInBuffer}

                    nodes found in LRU Cache: ${metadata.nodesInLRU}
                    nodes found in Persistent memory: ${metadata.nodesInPersistent}
                    nodes that were fetched from host: ${metadata.nodesToFetch}`;
  }
}
