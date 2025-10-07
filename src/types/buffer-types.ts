/**
 * GPU buffer metadata for point cloud rendering
 */
export interface PointCloudBufferData {
  position: GPUBuffer;
  color: GPUBuffer;
  maxIntensity: number;
  numPoints: number;
}

export type BufferMap = Record<string, PointCloudBufferData>;
