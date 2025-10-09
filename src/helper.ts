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

export function updateHtmlUIForXYZ(pointCount: number) {
  let statsText = `XYZ File Loaded
                    Total Points: ${pointCount.toLocaleString()}
                    ----------------------------------------------------
                    Status: All points loaded into GPU Buffer

                    Format: XYZ (text-based, flat structure)
                    Cache: Direct load (no dynamic caching)`;
  document.getElementById("stats-div").innerText = statsText;
}

export function updateHtmlUIForTIF(
  pointCount: number,
  width: number,
  height: number,
  metadata?: {
    dataType?: string;
    samplesPerPixel?: number;
    bitsPerSample?: number;
    elevationRange?: string;
    boundingBox?: {
      xMin: number;
      yMin: number;
      zMin: number;
      xMax: number;
      yMax: number;
      zMax: number;
      widthX: number;
      widthY: number;
      widthZ: number;
      centerX: number;
      centerY: number;
      centerZ: number;
    };
    scaleFactor?: number[];
  }
) {
  const dataType = metadata?.dataType || "Unknown";
  const channels = metadata?.samplesPerPixel || "?";
  const bits = metadata?.bitsPerSample || "?";
  const elevRange = metadata?.elevationRange || "N/A";
  const bbox = metadata?.boundingBox;
  const scale = metadata?.scaleFactor || [1, 1, 1];

  let statsText = `GeoTIFF Loaded
                    Total Points: ${pointCount.toLocaleString()}
                    Grid Size: ${width} × ${height}
                    ----------------------------------------------------
                    Status: All points loaded into GPU Buffer

                    Type: ${dataType}
                    Channels: ${channels}, Bit Depth: ${bits}-bit
                    ${dataType === "elevation" ? `Elevation: ${elevRange}` : ""}
                    ${
                      dataType === "rgb+elevation"
                        ? `Elevation: ${elevRange}`
                        : ""
                    }

                    Box Dimensions:
                    X: ${bbox?.widthX.toFixed(2) || "?"} (${
    bbox?.xMin.toFixed(2) || "?"
  } : ${bbox?.xMax.toFixed(2) || "?"})
                    Y: ${bbox?.widthY.toFixed(2) || "?"} (${
    bbox?.yMin.toFixed(2) || "?"
  } : ${bbox?.yMax.toFixed(2) || "?"})
                    Z: ${bbox?.widthZ.toFixed(2) || "?"} (${
    bbox?.zMin.toFixed(2) || "?"
  } : ${bbox?.zMax.toFixed(2) || "?"})

                    Shifted Box Center:
                    X: ${bbox?.centerX.toFixed(2) || "?"}
                    Y: ${bbox?.centerY.toFixed(2) || "?"}
                    Z: ${bbox?.centerZ.toFixed(2) || "?"}

                    Global Box Center:
                    X: ${bbox ? ((bbox.xMin + bbox.xMax) / 2).toFixed(6) : "?"}
                    Y: ${bbox ? ((bbox.yMin + bbox.yMax) / 2).toFixed(6) : "?"}
                    Z: ${bbox ? ((bbox.zMin + bbox.zMax) / 2).toFixed(6) : "?"}

                    Global Scale: ${scale.join(", ")}

                    Format: GeoTIFF (raster grid converted to point cloud)
                    Cache: Direct load (no dynamic caching)`;
  document.getElementById("stats-div").innerText = statsText;
}
