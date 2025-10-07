import { BaseRenderer } from "./base-renderer";
import { Vec3Renderer } from "./vec3-renderer";
import { Vec4Renderer } from "./vec4-renderer";

export type VectorType = "vec3" | "vec4";

export class RendererFactory {
  private static renderers = new Map<string, BaseRenderer>();

  static getRenderer(
    vectorType: VectorType,
    device: GPUDevice,
    swapChainFormat: GPUTextureFormat
  ): BaseRenderer {
    if (!this.renderers.has(vectorType)) {
      const renderer =
        vectorType === "vec3"
          ? new Vec3Renderer(device, swapChainFormat)
          : new Vec4Renderer(device, swapChainFormat);

      renderer.initialize();

      this.renderers.set(vectorType, renderer);
    }

    return this.renderers.get(vectorType)!;
  }
}
