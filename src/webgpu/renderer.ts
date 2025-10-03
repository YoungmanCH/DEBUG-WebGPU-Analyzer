import { vs, fs } from "../shaders/renderShader";
import { appState, retrivePoints } from "../index";
import Stats from "three/addons/libs/stats.module.js";
import { mat4 } from "gl-matrix";

const renderContext = {
  adapter: null,
  device: null,
  context: null,
  canvas: null,
  swapChainFormat: "bgra8unorm",
  renderPipeline: null,

  // Buffers
  mvpBindGroup: null,
  mvpBuffer: null,
  colorMapBuffer: null,
  paramsBuffer: null,
  levelBuffer: null,
  renderDepthTexture: null,

  // Matrices and camera
  projView: mat4.create(),
  proj: null,
  camera: null,
  param: null,

  // Render state
  commandEncoder: null,
  renderPassDescriptor: null,
  numPoints: 0,

  // UI state
  currentAxis: 3,
  abortController: null,
  keyMap: {
    isDown: false,
    dragging: false,
  },
};

const stats = new (Stats as any)();
document.body.appendChild(stats.dom);

export { renderContext as device };

export function throttle(callback, interval) {
  let enableCall = true;
  return function (...args) {
    if (!enableCall) return;
    enableCall = false;
    callback.apply(this, args);
    setTimeout(() => (enableCall = true), interval);
  };
}

export async function stages(cameraObj, projMatrix, params) {
  await _init();
  await _initRenderPipeline();
  const projectionViewMatrix = await _initUniform(cameraObj, projMatrix, params);
  return projectionViewMatrix;
}

export async function renderWrapper() {
  await _createBindGroups();
  await _createDepthBuffer();
  await _updateMaxIntensity();
  _render();
}

async function _init() {
  renderContext.adapter = await navigator.gpu.requestAdapter();
  if (!renderContext.adapter) return _handleFallback();
  renderContext.device = await renderContext.adapter.requestDevice();
  if (!renderContext.device) return _handleFallback();

  renderContext.canvas = document.getElementById("screen-canvas");
  renderContext.canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
  renderContext.canvas.height = window.innerHeight * (window.devicePixelRatio || 1);

  renderContext.context = renderContext.canvas.getContext("webgpu");
  if (!renderContext.context) {
    console.error("could not get context from the canvas");
    return;
  }

  renderContext.swapChainFormat = navigator.gpu.getPreferredCanvasFormat();
  _configureSwapChain(renderContext.device);
  _setupEventListeners();
}

function _handleFallback() {
  console.error("unable to start webgpu");
  return;
}

function _configureSwapChain(gpuDevice) {
  renderContext.context.configure({
    device: gpuDevice,
    format: renderContext.swapChainFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    alphaMode: "premultiplied",
  });
}

function _setupEventListeners() {
  renderContext.canvas.addEventListener("mousedown", (e) => {
    if (e.buttons == 1 || e.buttons == 2) {
      renderContext.keyMap.isDown = true;
    }
  });

  window.addEventListener("mouseup", () => {
    renderContext.keyMap.isDown = false;
  });

  renderContext.canvas.addEventListener("mousemove", () => {
    if (renderContext.keyMap.isDown == true) {
      _throttleTreeTravel(renderContext.projView);
    }
  });

  window.addEventListener("wheel", () => {
    if (renderContext.abortController) {
      renderContext.abortController.abort();
    }
    renderContext.abortController = new AbortController();
    _throttleTreeTravel(renderContext.projView, renderContext.abortController.signal);
  });
}

const _throttleTreeTravel = throttle(retrivePoints, 2000);

async function _initRenderPipeline() {
  const vsModule = renderContext.device.createShaderModule({
    label: "vertex shader",
    code: vs,
  });

  const fsModule = renderContext.device.createShaderModule({
    label: "fragment shader",
    code: fs,
  });

  const positionAttributeDesc = {
    shaderLocation: 0,
    offset: 0,
    format: "float32x4",
  };

  const colorAttributeDesc = {
    shaderLocation: 1,
    offset: 0,
    format: "float32x3",
  };

  const vertexShaderDescriptor = {
    module: vsModule,
    entryPoint: "main",
    buffers: [
      {
        arrayStride: 16,
        stepMode: "instance",
        attributes: [positionAttributeDesc],
      },
      {
        arrayStride: 12,
        stepMode: "instance",
        attributes: [colorAttributeDesc],
      },
    ],
  };

  const fragmentShaderDescriptor = {
    module: fsModule,
    entryPoint: "main",
    targets: [{ format: renderContext.swapChainFormat }],
  };

  const depthStencilDescriptor = {
    format: "depth24plus-stencil8",
    depthWriteEnabled: true,
    depthCompare: "less",
  };

  const primitiveDescriptor = {
    topology: "triangle-strip",
    cullMode: "none",
  };

  renderContext.renderPipeline = await renderContext.device.createRenderPipeline({
    label: "render pipeline",
    layout: "auto",
    vertex: vertexShaderDescriptor,
    fragment: fragmentShaderDescriptor,
    depthStencil: depthStencilDescriptor,
    primitive: primitiveDescriptor,
  });
}

function _initUniform(cam, projMatrix, params) {
  renderContext.camera = cam;
  renderContext.proj = projMatrix;
  renderContext.param = params;
  params.push(renderContext.currentAxis);
  params.push(appState.globalMaxIntensity);

  renderContext.paramsBuffer = renderContext.device.createBuffer({
    size: 8 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  const mapArrayParams = new Float32Array(renderContext.paramsBuffer.getMappedRange());
  mapArrayParams.set(params);
  renderContext.paramsBuffer.unmap();

  renderContext.levelBuffer = renderContext.device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  const mapArrayLevel = new Float32Array(renderContext.levelBuffer.getMappedRange());
  mapArrayLevel.set([0]);
  renderContext.levelBuffer.unmap();

  // Create colormap
  const hsvColors = [
    [0.0, 0.0, 0.5], [0.0, 0.2, 0.7], [0.0, 0.4, 0.9], [0.0, 0.6, 1.0],
    [0.0, 0.8, 1.0], [0.2, 0.9, 0.8], [0.4, 1.0, 0.6], [0.6, 1.0, 0.4],
    [0.8, 1.0, 0.2], [1.0, 1.0, 0.0], [1.0, 0.9, 0.0], [1.0, 0.8, 0.0],
    [1.0, 0.6, 0.0], [1.0, 0.4, 0.0], [1.0, 0.2, 0.0], [0.9, 0.0, 0.0],
    [0.7, 0.0, 0.0], [0.5, 0.0, 0.0], [0.3, 0.0, 0.0], [0.1, 0.5, 0.0],
  ].flat();

  renderContext.colorMapBuffer = renderContext.device.createBuffer({
    size: hsvColors.length * 3 * 4,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
  });

  const mapArray = new Float32Array(renderContext.colorMapBuffer.getMappedRange());
  mapArray.set(hsvColors);
  renderContext.colorMapBuffer.unmap();

  renderContext.mvpBuffer = renderContext.device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const viewMatrix = renderContext.camera.matrixWorldInverse.elements;
  renderContext.projView = mat4.mul(renderContext.projView, viewMatrix, renderContext.proj);
  return renderContext.projView;
}

async function _createBindGroups() {
  renderContext.mvpBindGroup = renderContext.device.createBindGroup({
    label: "uniform bindgroup - rendering",
    layout: renderContext.renderPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: renderContext.mvpBuffer },
      },
      {
        binding: 1,
        resource: { buffer: renderContext.colorMapBuffer },
      },
      {
        binding: 2,
        resource: { buffer: renderContext.paramsBuffer },
      },
    ],
  });
}

async function _createDepthBuffer() {
  renderContext.renderDepthTexture = renderContext.device.createTexture({
    size: [renderContext.canvas.width, renderContext.canvas.height, 1],
    format: "depth24plus-stencil8",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
}

async function _updateMaxIntensity() {
  renderContext.param[renderContext.param.length - 1] = appState.globalMaxIntensity;
  const stagingBuffer = renderContext.device.createBuffer({
    usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
    size: 32,
    mappedAtCreation: true,
  });

  const stagingData = new Float32Array(stagingBuffer.getMappedRange());
  stagingData.set(renderContext.param);
  stagingBuffer.unmap();
  const copyEncoder = renderContext.device.createCommandEncoder();
  copyEncoder.copyBufferToBuffer(stagingBuffer, 28, renderContext.paramsBuffer, 28, 4);
  renderContext.device.queue.submit([copyEncoder.finish()]);
}

function _render() {
  stats.update();
  renderContext.commandEncoder = renderContext.device.createCommandEncoder();

  const viewMatrix = renderContext.camera.matrixWorldInverse.elements;
  renderContext.projView = mat4.mul(renderContext.projView, renderContext.proj, viewMatrix);
  appState.controls.update();

  _encodeCommand();

  const wvStagingBuffer = renderContext.device.createBuffer({
    size: 4 * 16,
    usage: GPUBufferUsage.COPY_SRC,
    mappedAtCreation: true,
  });
  const stagingUniformData = new Float32Array(wvStagingBuffer.getMappedRange());
  stagingUniformData.set(renderContext.projView);
  wvStagingBuffer.unmap();
  renderContext.commandEncoder.copyBufferToBuffer(wvStagingBuffer, 0, renderContext.mvpBuffer, 0, 64);

  const renderPass = renderContext.commandEncoder.beginRenderPass(renderContext.renderPassDescriptor);
  renderPass.setPipeline(renderContext.renderPipeline);
  renderPass.setViewport(0, 0, renderContext.canvas.width, renderContext.canvas.height, 0.0, 1.0);
  renderPass.setBindGroup(0, renderContext.mvpBindGroup);

  for (let key in appState.bufferMap) {
    renderPass.setVertexBuffer(0, appState.bufferMap[key].position);
    renderPass.setVertexBuffer(1, appState.bufferMap[key].color);
    renderContext.numPoints = +appState.bufferMap[key].position.label / 4;
    renderPass.draw(4, renderContext.numPoints, 0, 0);
  }

  renderPass.end();
  renderContext.device.queue.submit([renderContext.commandEncoder.finish()]);
  requestAnimationFrame(_render);
}

async function _encodeCommand() {
  const colorAttachment = {
    view: renderContext.context.getCurrentTexture().createView(),
    clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
    loadOp: "clear",
    storeOp: "store",
  };

  const depthAttachment = {
    view: renderContext.renderDepthTexture.createView(),
    depthLoadOp: "clear",
    depthClearValue: 1.0,
    depthStoreOp: "store",
    stencilLoadOp: "clear",
    stencilClearValue: 0,
    stencilStoreOp: "store",
  };

  renderContext.renderPassDescriptor = {
    colorAttachments: [colorAttachment],
    depthStencilAttachment: depthAttachment,
  };
}

async function _updateAxis() {
  renderContext.param[renderContext.param.length - 2] = renderContext.currentAxis;
  const stagingBuffer = renderContext.device.createBuffer({
    usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
    size: 32,
    mappedAtCreation: true,
  });

  const stagingData = new Float32Array(stagingBuffer.getMappedRange());
  stagingData.set(renderContext.param);
  stagingBuffer.unmap();
  const copyEncoder = renderContext.device.createCommandEncoder();
  copyEncoder.copyBufferToBuffer(stagingBuffer, 24, renderContext.paramsBuffer, 24, 8);
  renderContext.device.queue.submit([copyEncoder.finish()]);
}

(() => {
  const selectColormap = document.getElementById("colormap-axis");
  selectColormap.addEventListener("change", (event) => {
    const axis = parseInt((event.target as HTMLSelectElement).value);
    if (axis != renderContext.currentAxis) {
      renderContext.currentAxis = axis;
      _updateAxis();
    }
  });
})();
