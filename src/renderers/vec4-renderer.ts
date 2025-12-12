import { BaseRenderer } from "./base-renderer";
import vec4ShaderCode from "../shaders/vec4-shader.wgsl";

export class Vec4Renderer extends BaseRenderer {
  getPositionLayout(): GPUVertexBufferLayout {
    return {
      arrayStride: 16, // 4 × 4 bytes
      stepMode: "instance",
      attributes: [
        {
          shaderLocation: 0,
          offset: 0,
          format: "float32x4", // 4要素
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
    return {
      vertex: vec4ShaderCode,
      fragment: vec4ShaderCode,
    };
  }

  getArrayStride(): number {
    return 16;
  }

  getPipeline(): GPURenderPipeline {
    return this.pipeline;
  }

  initialize(): void {
    const { vertex, fragment } = this.getShaderCode();

    let layout: GPUPipelineLayout | "auto" = "auto";

    this.pipeline = this.device.createRenderPipeline({
      label: "Vec4Renderer pipeline",
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
        topology: "point-list",
        cullMode: "none",
      },
    });
  }

  // Vec4特有の処理（LOD可視化など）
  setLevelColorMap(colorMap: any) {
    // レベルごとの色マップを設定
  }
}
