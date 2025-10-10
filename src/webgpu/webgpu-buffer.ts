import { appState } from "../views/states/state-manager";
import { StatsFacade } from "../views/stats-display/exports";
import { LASParams, XYZParams, TIFParams } from "../loaders/exports";
import { VectorType } from "../renderers/exports";

let gpuDevice: GPUDevice | null = null;

export function setGPUDevice(device: GPUDevice | null) {
  if (!device) {
    throw new Error("Cannot set null GPU device");
  }
  gpuDevice = device;
}

export function createBuffer(
  positions: Float32Array | number[],
  colors: Float32Array | number[]
): [GPUBuffer, GPUBuffer] {
  if (!gpuDevice) {
    throw new Error("GPU device not initialized. Call setGPUDevice first.");
  }

  // positionBuffer（点群データ其々の頂点バッファ）
  const positionBuffer = _createPositionBuffer(positions.length);
  const positionMappedArray = new Float32Array(positionBuffer.getMappedRange());
  positionMappedArray.set(positions);
  positionBuffer.unmap();

  // colorBuffer（点群データ其々のカラーバッファ）
  const colorBuffer = _createColorBuffer(colors.length);
  const colorMappedArray = new Float32Array(colorBuffer.getMappedRange());
  colorMappedArray.set(colors);
  colorBuffer.unmap();

  return [positionBuffer, colorBuffer];
}

function _createPositionBuffer(elementCount: number): GPUBuffer {
  const byteSize = elementCount * 4; // float32 × 4 bytes

  const buffer: GPUBuffer = gpuDevice.createBuffer({
    // TODO: label経由でrendererで各点毎の要素数を取得しているが、文字列表記で返すのはカスなので修正。
    label: `${elementCount}`,
    size: byteSize,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });

  return buffer;
}

function _createColorBuffer(elementCount: number): GPUBuffer {
  const byteSize = elementCount * 4; // float32 × 4 bytes

  const buffer: GPUBuffer = gpuDevice.createBuffer({
    label: "Point Cloud Color Buffer",
    size: byteSize,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });

  return buffer;
}

export function createLASBuffer() {
  const lasData = appState.lasData as LASParams;

  // RGBAからRGBに変換（Aチャンネルを除去）
  let colors: Float32Array;
  const pointCount = lasData.points.positions.length / 3; // vec3なので÷3

  let hasValidColor = false;

  if (lasData.points.colors) {
    const sourceColors = lasData.points.colors;
    const channelsPerPoint = sourceColors.length / pointCount;

    // 色データが全て0かチェック（RGB情報が実質ない場合）
    const sampleSize = Math.min(sourceColors.length, 100);
    for (let i = 0; i < sampleSize; i++) {
      // Alphaチャンネル以外で0以外の値があるかチェック
      if (channelsPerPoint === 4) {
        const channelIndex = i % 4;
        if (channelIndex !== 3 && sourceColors[i] > 0) {
          hasValidColor = true;
          break;
        }
      } else if (sourceColors[i] > 0) {
        hasValidColor = true;
        break;
      }
    }

    colors = new Float32Array(pointCount * 3);

    if (!hasValidColor) {
      // RGB値が全て0の場合は単色（グレー）で表示
      console.log("LAS: No valid RGB data detected, using gray color");
      colors.fill(128);
    } else if (channelsPerPoint === 4) {
      // RGBA形式
      for (let i = 0; i < pointCount; i++) {
        colors[i * 3] = sourceColors[i * 4]; // R
        colors[i * 3 + 1] = sourceColors[i * 4 + 1]; // G
        colors[i * 3 + 2] = sourceColors[i * 4 + 2]; // B
      }
    } else if (channelsPerPoint === 3) {
      // RGB形式（そのままコピー）
      colors.set(sourceColors);
    } else {
      console.warn(
        `Unexpected color channels: ${channelsPerPoint}, using white`
      );
      colors.fill(255);
    }
  } else {
    // カラーがない場合は単色（グレー）で表示
    console.log("LAS: No color data, using gray color");
    colors = new Float32Array(pointCount * 3).fill(128);
  }

  const [positionBuffer, colorBuffer] = createBuffer(
    lasData.points.positions,
    colors
  );

  // 最大強度を計算（スプレッド演算子を使わない）
  let maxIntensity = 0;
  if (lasData.points.intensities) {
    for (let i = 0; i < lasData.points.intensities.length; i++) {
      if (lasData.points.intensities[i] > maxIntensity) {
        maxIntensity = lasData.points.intensities[i];
      }
    }
  }

  const vectorType: VectorType = "vec3";

  appState.bufferMap["las-main"] = {
    position: positionBuffer,
    color: colorBuffer,
    maxIntensity: maxIntensity,
    numPoints: pointCount,
    vectorType: vectorType,
  };

  // ファイル名を取得（LASかLAZか判別）
  const fullPath = appState.currentFilename || "Unknown";
  const filename = fullPath.split("/").pop() || fullPath;
  const isLAZ = filename.toLowerCase().endsWith(".laz");

  // Bounding Box情報を取得
  const min = lasData.boundingBox.min;
  const max = lasData.boundingBox.max;
  const boundingBox = {
    xMin: min[0],
    yMin: min[1],
    zMin: min[2],
    xMax: max[0],
    yMax: max[1],
    zMax: max[2],
    widthX: max[0] - min[0],
    widthY: max[1] - min[1],
    widthZ: max[2] - min[2],
    centerX: appState.centerX,
    centerY: appState.centerY,
    centerZ: appState.centerZ,
  };

  // LAS/LAZ用統計情報を表示
  const metadata = {
    filename: filename,
    pointCount: pointCount,
    version: lasData.header.version,
    hasRGB: hasValidColor,
    maxIntensity: maxIntensity,
    boundingBox: boundingBox,
    scaleFactor: appState.scaleFactor,
  };

  if (isLAZ) {
    StatsFacade.displayLAZ(metadata);
  } else {
    StatsFacade.displayLAS(metadata);
  }
}

export function createXYZBuffer() {
  const xyzData = appState.xyzData as XYZParams;
  const points = xyzData.points;

  // XYZからRGBに変換（XYZは既にRGB形式なのでそのまま）
  let colors: Float32Array;
  const pointCount = xyzData.points.positions.length / 3; // vec3なので÷3
  const hasRGB = !!points.colors;

  if (points.colors) {
    colors = points.colors;
  } else {
    // カラーがない場合はグレーで埋める
    colors = new Float32Array(pointCount * 3).fill(128);
  }

  const [positionBuffer, colorBuffer] = createBuffer(points.positions, colors);
  const vectorType: VectorType = "vec3";

  appState.bufferMap["xyz-main"] = {
    position: positionBuffer,
    color: colorBuffer,
    maxIntensity: 0, // XYZファイルにはIntensityがない
    numPoints: pointCount,
    vectorType: vectorType,
  };

  // ファイル名を取得
  const fullPath = appState.currentFilename || "Unknown";
  const filename = fullPath.split("/").pop() || fullPath;

  // XYZ用統計情報を表示
  StatsFacade.displayXYZ({
    filename: filename,
    pointCount: pointCount,
    hasRGB: hasRGB,
  });
}

export function createTIFBuffer() {
  const tifData = appState.tifData as TIFParams;
  const points = tifData.points;
  const pointCount = points.positions.length / 3; // vec3なので÷3

  let colors: Float32Array;
  if (points.colors) {
    colors = points.colors;
  } else {
    colors = new Float32Array(pointCount * 3).fill(128);
  }

  const [positionBuffer, colorBuffer] = createBuffer(points.positions, colors);

  const vectorType: VectorType = "vec3";

  appState.bufferMap["tif-main"] = {
    position: positionBuffer,
    color: colorBuffer,
    maxIntensity: 0,
    numPoints: pointCount,
    vectorType: vectorType,
  };

  // ファイル名を取得
  const fullPath = appState.currentFilename || "Unknown";
  const filename = fullPath.split("/").pop() || fullPath;

  StatsFacade.displayTIF({
    filename: filename,
    pointCount: pointCount,
    width: tifData.header.width,
    height: tifData.header.height,
    dataType: (tifData.header as any).dataType || "Unknown",
    samplesPerPixel: (tifData.header as any).samplesPerPixel || 0,
    bitsPerSample: (tifData.header as any).bitsPerSample || 0,
    elevationRange: (tifData.header as any).elevationRange || "N/A",
    boundingBox: {
      xMin: appState.xMin,
      yMin: appState.yMin,
      zMin: appState.zMin,
      xMax: appState.xMax,
      yMax: appState.yMax,
      zMax: appState.zMax,
      widthX: appState.widthX,
      widthY: appState.widthY,
      widthZ: appState.widthZ,
      centerX: appState.centerX,
      centerY: appState.centerY,
      centerZ: appState.centerZ,
    },
    scaleFactor: appState.scaleFactor,
  });
}
