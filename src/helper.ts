import * as Octree from "./octree/octree";

export function fillArray(points, count, width, height, depth) {
  for (let i = 0; i < count; i++) {
    let point = new Octree.OctreePoint(
      i,
      Math.floor(Math.random() * width) - width / 2,
      Math.floor(Math.random() * height) - height / 2,
      Math.floor(Math.random() * depth) - depth / 2
    );
    points.push(point);
  }
}

export function fillMidNodes(tree) {
  if (!tree.isDivided) {
    tree.points.splice(0, 1);
    return tree.points[0];
  }

  let children = [
    tree.minNE,
    tree.minNW,
    tree.minSW,
    tree.minSE,
    tree.maxNE,
    tree.maxNW,
    tree.maxSW,
    tree.maxSE,
  ];
  let result = [];
  for (let i = 0, _length = children.length; i < _length; i++) {
    let result1 = fillMidNodes(children[i]);
    if (result1 != null) {
      result.push(result1);
    }
  }
  let passIndex = Math.ceil(result.length / 2);
  let passingValue = result[passIndex];
  if (tree.level > 0) {
    result.splice(passIndex, 1);
  }
  tree.representativeNodes = [...result];
  return passingValue;
}

export function updateHtmlUI(
  nodeNotFoundInBuffer,
  nodeFoundInBuffer,
  nodeFoundInLRU,
  nodeFoundInPersistent,
  nodeToFetch
) {
  let statsText = `Among total nodes needed ${
    nodeFoundInBuffer + nodeNotFoundInBuffer
  }\b
                    nodes found in GPU Buffer: ${nodeFoundInBuffer} \b
                    ----------------------------------------------------
                    nodes need to be loaded ${nodeNotFoundInBuffer}\b
                    \b
                    nodes found in LRU Cache: ${nodeFoundInLRU} \b
                    nodes found in Persistent memory: ${nodeFoundInPersistent} \b
                    nodes that were fetched from host: ${nodeToFetch}    `;
  document.getElementById("stats-div").innerText = statsText;
}

export function updateHtmlUIForLAS(pointCount: number, filename?: string) {
  let statsText = `LAS File Loaded
                    Total Points: ${pointCount.toLocaleString()}
                    ----------------------------------------------------
                    Status: All points loaded into GPU Buffer

                    Format: LAS (flat structure, no LOD)
                    Cache: Direct load (no dynamic caching)`;
  document.getElementById("stats-div").innerText = statsText;
}
