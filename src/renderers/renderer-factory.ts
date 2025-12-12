import { BaseRenderer } from "./base-renderer";
import { Vec3Renderer } from "./vec3-renderer";
import { Vec4Renderer } from "./vec4-renderer";
import { Vec3RendererMesh } from "./vec3-renderer-mesh";
import { Vec4RendererMesh } from "./vec4-renderer-mesh";

export type VectorType = "vec3" | "vec4";

export class RendererFactory {
  private static renderers = new Map<string, BaseRenderer>();
  private static meshRenderers = new Map<string, BaseRenderer>();

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

  static getMeshRenderer(
    vectorType: VectorType,
    device: GPUDevice,
    swapChainFormat: GPUTextureFormat
  ): BaseRenderer {
    const key = `${vectorType}-mesh`;

    if (!this.meshRenderers.has(key)) {
      const renderer =
        vectorType === "vec3"
          ? new Vec3RendererMesh(device, swapChainFormat)
          : new Vec4RendererMesh(device, swapChainFormat);

      renderer.initialize();

      this.meshRenderers.set(key, renderer);
    }

    return this.meshRenderers.get(key)!;
  }
}
