import { VectorType } from "../renderers/exports";

/**
 * GPU buffer metadata for point cloud rendering
 */
export interface PointCloudBufferData {
  position: GPUBuffer;
  color: GPUBuffer;
  maxIntensity: number;
  numPoints: number;
  vectorType: VectorType;
}

export type BufferMap = Record<string, PointCloudBufferData>;
