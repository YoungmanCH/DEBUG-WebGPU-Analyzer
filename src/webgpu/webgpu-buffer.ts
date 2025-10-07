import { appState } from "../canvas/state-manager";
import { LASParams } from "../loaders/las-loader";
import { updateHtmlUIForLAS } from "../helper";

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

  if (lasData.points.colors) {
    const rgbaColors = lasData.points.colors;
    colors = new Float32Array(pointCount * 3);

    for (let i = 0; i < pointCount; i++) {
      colors[i * 3] = rgbaColors[i * 4]; // R
      colors[i * 3 + 1] = rgbaColors[i * 4 + 1]; // G
      colors[i * 3 + 2] = rgbaColors[i * 4 + 2]; // B
      // A (rgbaColors[i * 4 + 3]) は無視
    }
  } else {
    // カラーがない場合は白色で埋める
    colors = new Float32Array(pointCount * 3).fill(1.0);
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

  appState.bufferMap["las-main"] = {
    position: positionBuffer,
    color: colorBuffer,
    maxIntensity: maxIntensity,
    numPoints: pointCount,
    vectorType: "vec3",
  };

  // LAS用統計情報を表示
  updateHtmlUIForLAS(pointCount);
}
