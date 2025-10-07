export class WebGPUContext {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvas: HTMLCanvasElement;
  private swapChainFormat: GPUTextureFormat = "bgra8unorm"; // Generally: "bgra8unorm"
  private depthTexture: GPUTexture | null = null;

  constructor(canvasId: string = "screen-canvas") {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this._resizeCanvas();
  }

  async initialize(): Promise<void> {
    this.adapter = await navigator.gpu.requestAdapter();
    if (!this.adapter) {
      throw new Error("WebGPU not supported");
    }
    this.device = await this.adapter.requestDevice();
    if (!this.device) {
      throw new Error("Failed to get GPU device");
    }

    this.context = this.canvas.getContext(
      "webgpu"
    ) as unknown as GPUCanvasContext;
    if (!this.context) {
      throw new Error("Failed to get WebGPU context");
    }

    this.swapChainFormat = navigator.gpu.getPreferredCanvasFormat();
    this._configureContext();
  }

  private _resizeCanvas(): void {
    this.canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
    this.canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
  }

  private _configureContext(): void {
    this.context!.configure({
      device: this.device!,
      format: this.swapChainFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      alphaMode: "premultiplied",
    });
  }

  createDepthTexture(): void {
    this.depthTexture = this.device!.createTexture({
      size: [this.canvas.width, this.canvas.height, 1],
      format: "depth24plus-stencil8",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  getDepthTexture(): GPUTexture {
    if (!this.depthTexture) {
      throw new Error(
        "Depth texture not created. Call createDepthTexture() first."
      );
    }
    
    return this.depthTexture;
  }

  getDevice(): GPUDevice {
    return this.device!;
  }

  getContext(): GPUCanvasContext {
    return this.context!;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getFormat(): GPUTextureFormat {
    return this.swapChainFormat;
  }
}
