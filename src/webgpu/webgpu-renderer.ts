import Stats from "three/addons/libs/stats.module.js";
import { mat4 } from "gl-matrix";

import { WebGPUContext } from "./webgpu-context";
import { WebGPUUniformer } from "./uniform-buffer";
import { CanvasEventManager } from "./canvas-event";

import { setGPUDevice } from "../webgpu/webgpu-buffer";
import {
  RendererFactory,
  VectorType,
} from "../renderers/exports";
import { appState } from "../views/states/state-manager";
import { setupViewport } from "../views/states/viewport-initializer";
import {
  incrementFrame,
  cleanupOldNodes,
  getMemoryStats,
} from "../utils/memory-manager";

export class WebGPURenderer {
  private context: WebGPUContext;
  private vectorType: VectorType;
  private uniformer: WebGPUUniformer;
  private pipeline: GPURenderPipeline;
  private eventManager: CanvasEventManager;
  private stats: any;

  constructor(vectorType: VectorType) {
    this.context = new WebGPUContext();
    this.vectorType = vectorType;
  }

  async initialize(): Promise<void> {
    await this._initializeContext();
    await this._initializeViewport();
    this._initializeRenderer();
    this._initializeUniformer();
    this._initializeEventManager();
    this._setupEventCallbacks();
    this._initializeStats();
  }

  start(): void {
    const pipelineLayout = this.pipeline.getBindGroupLayout(0);
    this.uniformer.createBindGroup(pipelineLayout);
    this.updateMaxIntensity(appState.globalMaxIntensity);
    this.context.createDepthTexture();
    this._render();
  }

  updateMaxIntensity(maxIntensity: number): void {
    this.uniformer.updateParams(7, maxIntensity);
  }

  updateAxis(axis: number): void {
    this.uniformer.updateParams(6, axis);
  }

  private async _initializeContext(): Promise<GPUDevice> {
    await this.context.initialize();
    const device = this.context.getDevice();
    setGPUDevice(device);

    return device;
  }

  private async _initializeViewport(): Promise<void> {
    const canvas = this.context.getCanvas();
    await setupViewport(canvas);
  }

  private _initializeRenderer(): void {
    const device = this.context.getDevice();
    const swapChainFormat = this.context.getFormat();

    if (this.vectorType == "vec3") {
      this._initVec3Renderer(device, swapChainFormat);
    } else if (this.vectorType == "vec4") {
      this._initVec4Renderer(device, swapChainFormat);
    } else {
      throw Error("VectorType is invalid.");
    }
  }

  private _initVec3Renderer(
    device: GPUDevice,
    swapChainFormat: GPUTextureFormat
  ): void {
    // メッシュ版を使用（点描画版に切り替える場合は getMeshRenderer → getRenderer）
    const vec3Renderer = RendererFactory.getMeshRenderer(
      this.vectorType,
      device,
      swapChainFormat
    );

    // 点描画版（normal）
    // const vec3Renderer = RendererFactory.getRenderer(
    //   this.vectorType,
    //   device,
    //   swapChainFormat
    // );

    vec3Renderer.initialize();
    this.pipeline = vec3Renderer.getPipeline();
  }

  private _initVec4Renderer(
    device: GPUDevice,
    swapChainFormat: GPUTextureFormat
  ): void {
    // メッシュ版を使用（点描画版に切り替える場合は getMeshRenderer → getRenderer）
    const vec4Renderer = RendererFactory.getMeshRenderer(
      this.vectorType,
      device,
      swapChainFormat
    );

    // 点描画版（normal）
    // const vec4Renderer = RendererFactory.getRenderer(
    //   this.vectorType,
    //   device,
    //   swapChainFormat
    // );


    vec4Renderer.initialize();
    this.pipeline = vec4Renderer.getPipeline();
  }

  private _initializeUniformer(): void {
    const device = this.context.getDevice();
    const camera = appState.camera;
    const projMatrix = appState.proj;
    const params = appState.params;
    const globalMaxIntensity = appState.globalMaxIntensity;

    this.uniformer = new WebGPUUniformer(device);
    this.uniformer.initialize(camera, projMatrix, params, globalMaxIntensity);
  }

  private _initializeEventManager(): void {
    const canvas = this.context.getCanvas();
    this.eventManager = new CanvasEventManager(canvas);
    this.eventManager.initialize();
  }

  private _setupEventCallbacks(): void {
    this.eventManager.setAxisChangeCallback((axis) => {
      this.updateAxis(axis);
    });
  }

  private _initializeStats(): void {
    this.stats = new (Stats as any)();
    document.body.appendChild(this.stats.dom);
  }

  private _render = (): void => {
    this.stats.update();
    this.uniformer.updateMVP();
    appState.controls.update();

    // フレームカウンタを更新
    const currentFrameNum = incrementFrame();

    const device = this.context.getDevice();
    const bindGroup = this.uniformer.getBindGroup();
    const canvas = this.context.getCanvas();
    const swapChainFormat = this.context.getFormat();

    const encoder = device.createCommandEncoder();
    const renderPassDescriptor = this._createRenderPassDescriptor();
    const renderPass = encoder.beginRenderPass(renderPassDescriptor);

    renderPass.setViewport(0, 0, canvas.width, canvas.height, 0.0, 1.0);

    // バッファマップをループして描画
    const visibleKeys: string[] = [];
    for (let key in appState.bufferMap) {
      visibleKeys.push(key);
      const bufferInfo = appState.bufferMap[key];

      // 点描画版（normal）に切り替える場合は下記をコメント解除
      // const renderer = RendererFactory.getRenderer(
      //   bufferInfo.vectorType || "vec4",
      //   device,
      //   swapChainFormat
      // );

      // メッシュ描画版（mesh）
      const renderer = RendererFactory.getMeshRenderer(
        bufferInfo.vectorType || "vec4",
        device,
        swapChainFormat
      );
      
      renderer.render(
        renderPass,
        bufferInfo.position,
        bufferInfo.color,
        bufferInfo.numPoints,
        bindGroup
      );
    }

    renderPass.end();
    device.queue.submit([encoder.finish()]);

    // 60フレームごとにメモリクリーンアップを実行
    if (currentFrameNum % 60 === 0) {
      cleanupOldNodes(visibleKeys);

      // メモリ使用状況をコンソールに出力（デバッグ用）
      const stats = getMemoryStats();
      if (stats.utilizationPercent > 80) {
        console.warn(
          `[Memory] High utilization: ${stats.totalNodes}/${
            stats.maxNodes
          } (${stats.utilizationPercent.toFixed(1)}%)`
        );
      }
    }

    requestAnimationFrame(() => this._render());
  };

  private _createRenderPassDescriptor(): GPURenderPassDescriptor {
    return {
      colorAttachments: [
        {
          view: this.context.getContext().getCurrentTexture().createView(),
          clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.context.getDepthTexture().createView(),
        depthLoadOp: "clear",
        depthClearValue: 1.0,
        depthStoreOp: "store",
        stencilLoadOp: "clear",
        stencilClearValue: 0,
        stencilStoreOp: "store",
      },
    };
  }

  // getter
  getProjView(): mat4 {
    return this.uniformer.getProjView();
  }
}
