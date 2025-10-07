import { mat4 } from "gl-matrix";

export class WebGPUUniformer {
  private device: GPUDevice;
  private mvpBuffer: GPUBuffer;
  private colorMapBuffer: GPUBuffer;
  private paramsBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup | null = null;

  private camera: any;
  private projMatrix: mat4;
  private projView: mat4 = mat4.create();
  private params: number[];

  constructor(device: GPUDevice) {
    this.device = device;
  }

  initialize(
    camera: any,
    projMatrix: mat4,
    params: number[],
    globalMaxIntensity: number
  ) {
    this.camera = camera;
    this.projMatrix = projMatrix;
    this.params = params;

    // TODO: Axisを変更できるように引数を後ほど修正する。
    const currentAxis: number = 3;

    params.push(currentAxis);
    params.push(globalMaxIntensity);

    this._createParamsBuffer();
    this._createColorMapBuffer();
    this._createMVPBuffer();

    const viewMatrix = this.camera.matrixWorldInverse.elements;
    this.projView = mat4.mul(this.projView, this.projMatrix, viewMatrix);
  }

  createBindGroup(pipelineLayout: GPUBindGroupLayout) {
    this.bindGroup = this.device.createBindGroup({
      label: "uniform bindgroup",
      layout: pipelineLayout,
      entries: [
        { binding: 0, resource: { buffer: this.mvpBuffer } },
        { binding: 1, resource: { buffer: this.colorMapBuffer } },
        { binding: 2, resource: { buffer: this.paramsBuffer } },
      ],
    });
  }

  updateMVP(): void {
    const viewMatrix = this.camera.matrixWorldInverse.elements;
    this.projView = mat4.mul(this.projView, this.projMatrix, viewMatrix);

    const stagingBuffer = this.device.createBuffer({
      size: 4 * 16,
      usage: GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });

    const stagingData = new Float32Array(stagingBuffer.getMappedRange());
    stagingData.set(this.projView as Float32Array);
    stagingBuffer.unmap();

    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(stagingBuffer, 0, this.mvpBuffer, 0, 64);
    this.device.queue.submit([encoder.finish()]);
  }

  updateParams(index: number, value: number): void {
    this.params[index] = value;

    const stagingBuffer = this.device.createBuffer({
      usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
      size: 32,
      mappedAtCreation: true,
    });

    const stagingData = new Float32Array(stagingBuffer.getMappedRange());
    stagingData.set(this.params);
    stagingBuffer.unmap();

    const copyEncoder = this.device.createCommandEncoder();
    copyEncoder.copyBufferToBuffer(
      stagingBuffer,
      index * 4,
      this.paramsBuffer,
      index * 4,
      4
    );

    this.device.queue.submit([copyEncoder.finish()]);
  }

  private _createParamsBuffer(): void {
    this.paramsBuffer = this.device.createBuffer({
      size: 8 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    const mapArray = new Float32Array(this.paramsBuffer.getMappedRange());
    mapArray.set(this.params);
    this.paramsBuffer.unmap();
  }

  private _createColorMapBuffer(): void {
    const hsvColors = [
      [0.0, 0.0, 0.5],
      [0.0, 0.2, 0.7],
      [0.0, 0.4, 0.9],
      [0.0, 0.6, 1.0],
      [0.0, 0.8, 1.0],
      [0.2, 0.9, 0.8],
      [0.4, 1.0, 0.6],
      [0.6, 1.0, 0.4],
      [0.8, 1.0, 0.2],
      [1.0, 1.0, 0.0],
      [1.0, 0.9, 0.0],
      [1.0, 0.8, 0.0],
      [1.0, 0.6, 0.0],
      [1.0, 0.4, 0.0],
      [1.0, 0.2, 0.0],
      [0.9, 0.0, 0.0],
      [0.7, 0.0, 0.0],
      [0.5, 0.0, 0.0],
      [0.3, 0.0, 0.0],
      [0.1, 0.5, 0.0],
    ].flat();

    this.colorMapBuffer = this.device.createBuffer({
      size: hsvColors.length * 3 * 4,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });

    const mapArray = new Float32Array(this.colorMapBuffer.getMappedRange());
    mapArray.set(hsvColors);
    this.colorMapBuffer.unmap();
  }

  // MVP: (Model-View-Projection) , mvpBuffer: 全頂点に共通する変換行列を格納
  // バッファサイズ: 常に64バイト（頂点数に関係なく）
  // この関数は初期データを書き込む
  private _createMVPBuffer(): void {
    this.mvpBuffer = this.device.createBuffer({
      size: 16 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    const viewMatrix = this.camera.matrixWorldInverse.elements;
    const projView = mat4.mul(mat4.create(), this.projMatrix, viewMatrix);
    const mapArray = new Float32Array(this.mvpBuffer.getMappedRange());
    mapArray.set(projView as Float32Array);
    this.mvpBuffer.unmap();
  }

  getMVPBuffer(): GPUBuffer {
    return this.mvpBuffer;
  }

  getColorMapBuffer(): GPUBuffer {
    return this.colorMapBuffer;
  }

  getParamsBuffer(): GPUBuffer {
    return this.paramsBuffer;
  }

  getBindGroup(): GPUBindGroup {
    return this.bindGroup!;
  }

  getProjView(): mat4 {
    return this.projView;
  }
}
