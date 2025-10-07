import { BaseRenderer } from "./base-renderer";
import vec3ShaderCode from "../shaders/vec3-shader.wgsl";

export class Vec3Renderer extends BaseRenderer {
  getPositionLayout(): GPUVertexBufferLayout {
    return {
      arrayStride: 12, // 3 × 4 bytes
      stepMode: "instance",
      attributes: [
        {
          shaderLocation: 0,
          offset: 0,
          format: "float32x3", // 3要素
        },
      ],
    };
  }

  getColorLayout(): GPUVertexBufferLayout {
    return {
      arrayStride: 12, // 3 × 4 bytes
      stepMode: "instance",
      attributes: [
        {
          shaderLocation: 1,
          offset: 0,
          format: "float32x3",
        },
      ],
    };
  }

  getShaderCode() {
    return { vertex: vec3ShaderCode, fragment: vec3ShaderCode };
  }

  getArrayStride(): number {
    return 12;
  }

  getPipeline(): GPURenderPipeline {
    return this.pipeline;
  }

  initialize(): void {
    const { vertex, fragment } = this.getShaderCode();

    let layout: GPUPipelineLayout | "auto" = "auto";

    this.pipeline = this.device.createRenderPipeline({
      label: "Vec3Renderer pipeline",
      layout: layout,
      vertex: {
        module: this.device.createShaderModule({ code: vertex }),
        entryPoint: "main",
        buffers: [this.getPositionLayout(), this.getColorLayout()],
      },
      fragment: {
        module: this.device.createShaderModule({ code: fragment }),
        entryPoint: "fragmentMain",
        targets: [{ format: this.swapChainFormat }],
      },
      depthStencil: {
        format: "depth24plus-stencil8",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
      primitive: {
        topology: "triangle-strip",
        cullMode: "none",
      },
    });
  }

  // Vec3特有の処理があればここに追加
  renderWithIntensity(
    renderPass: GPURenderPassEncoder,
    buffer: GPUBuffer,
    intensities: Uint16Array
  ) {
    // 強度ベースのカラーリングなど
  }
}
