export abstract class BaseRenderer {
  protected device: GPUDevice;
  protected pipeline: GPURenderPipeline;
  protected mvpBuffer: GPUBuffer;
  protected bindGroup: GPUBindGroup;
  protected pipelineLayout: GPUPipelineLayout | null = null;
  protected swapChainFormat: GPUTextureFormat;

  constructor(device: GPUDevice, swapChainFormat: GPUTextureFormat) {
    this.device = device;
    this.swapChainFormat = swapChainFormat;
  }

  abstract getPositionLayout(): GPUVertexBufferLayout;
  abstract getColorLayout(): GPUVertexBufferLayout;
  abstract getShaderCode(): { vertex: string; fragment: string };
  abstract getArrayStride(): number;
  abstract getPipeline(): GPURenderPipeline;
  abstract initialize(bindGroupLayout?: GPUBindGroupLayout): void;

  // 共通の描画処理（点描画用）
  render(
    renderPass: GPURenderPassEncoder,
    positionBuffer: GPUBuffer,
    colorBuffer: GPUBuffer,
    pointCount: number,
    bindGroup: GPUBindGroup
  ): void {
    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.setVertexBuffer(0, positionBuffer);
    renderPass.setVertexBuffer(1, colorBuffer);
    renderPass.draw(1, pointCount, 0, 0); // 点描画: 1頂点×点数
  }
}
