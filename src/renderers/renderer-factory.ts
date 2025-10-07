import { BaseRenderer } from "./base-renderer";
import { Vec3Renderer } from "./vec3-renderer";
import { Vec4Renderer } from "./vec4-renderer";

export type VectorType = "vec3" | "vec4";

export class RendererFactory {
  private static renderers = new Map<string, BaseRenderer>();

  // TODO: 共通のbindgrouplayoutがあれば実装
  // private static bindGroupLayout: GPUBindGroupLayout | null = null;

  // static setBindGroupLayout(layout: GPUBindGroupLayout | null) {
  //   this.bindGroupLayout = layout;
  // }

  static getRenderer(
    vectorType: VectorType,
    device: GPUDevice,
    swapChainFormat: GPUTextureFormat
  ): BaseRenderer {
    // 既にレンダラーが存在する場合はそれを返す。
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
