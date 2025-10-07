import Stats from "three/addons/libs/stats.module.js";
import { mat4 } from "gl-matrix";

import vec4ShaderCode from "../shaders/vec4-shader.wgsl";
import { appState } from "../canvas/state-manager";

// これでFPSなどの数値を管理できる。
const stats = new (Stats as any)();
document.body.appendChild(stats.dom);

export async function stages(cameraObj, projMatrix, params) {
  const { device, context, swapChainFormat } = await _init();
  const renderPipeline = await _initRenderPipeline(device, swapChainFormat);
  const { projView, mvpBuffer, colorMapBuffer, paramsBuffer } = _initUniform(
    device,
    cameraObj,
    projMatrix,
    params
  );

  return {
    device,
    projViewMatrix: projView,
    context,
    swapChainFormat,
    renderPipeline,
    mvpBuffer,
    colorMapBuffer,
    paramsBuffer,
  };
}

export async function renderWrapper(
  device: GPUDevice,
  canvas: HTMLCanvasElement,
  context: GPUCanvasContext,
  renderPipeline: GPURenderPipeline,
  mvpBuffer: GPUBuffer,
  colorMapBuffer: GPUBuffer,
  paramsBuffer: GPUBuffer,
  camera: any,
  projMatrix: any,
  params: number[]
) {
  const mvpBindGroup = await _createBindGroups(
    device,
    renderPipeline,
    mvpBuffer,
    colorMapBuffer,
    paramsBuffer
  );
  const renderDepthTexture = _createDepthBuffer(device, canvas);
  await _updateMaxIntensity(device, paramsBuffer, params);

  _render(
    device,
    canvas,
    context,
    renderPipeline,
    mvpBuffer,
    mvpBindGroup,
    renderDepthTexture,
    camera,
    projMatrix
  );
}

async function _init(): Promise<{
  device: GPUDevice;
  context: GPUCanvasContext;
  swapChainFormat: GPUTextureFormat;
}> {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("WebGPU not supported");

  const device = await adapter.requestDevice();
  if (!device) throw new Error("Failed to get GPU device");

  const canvas = document.getElementById("screen-canvas") as HTMLCanvasElement;
  canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
  canvas.height = window.innerHeight * (window.devicePixelRatio || 1);

  const context = canvas.getContext("webgpu") as unknown as GPUCanvasContext;
  if (!context) throw new Error("could not get context from the canvas");

  const swapChainFormat = navigator.gpu.getPreferredCanvasFormat();
  _configureSwapChain(device, context, swapChainFormat);

  return { device, context, swapChainFormat };
}

function _configureSwapChain(
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat
) {
  context.configure({
    device: device,
    format: format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    alphaMode: "premultiplied",
  });
}

async function _initRenderPipeline(
  device: GPUDevice,
  swapChainFormat: GPUTextureFormat
): Promise<GPURenderPipeline> {
  const format = swapChainFormat;

  const vsModule = device.createShaderModule({
    label: "vertex shader",
    code: vec4ShaderCode,
  });

  const fsModule = device.createShaderModule({
    label: "fragment shader",
    code: vec4ShaderCode,
  });

  const positionAttributeDesc: GPUVertexAttribute = {
    shaderLocation: 0,
    offset: 0,
    format: "float32x4",
  };

  const colorAttributeDesc: GPUVertexAttribute = {
    shaderLocation: 1,
    offset: 0,
    format: "float32x3",
  };

  const vertexShaderDescriptor: GPUVertexState = {
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

  const fragmentShaderDescriptor: GPUFragmentState = {
    module: fsModule,
    entryPoint: "fragmentMain",
    targets: [{ format: format as GPUTextureFormat }],
  };

  const depthStencilDescriptor: GPUDepthStencilState = {
    format: "depth24plus-stencil8",
    depthWriteEnabled: true,
    depthCompare: "less",
  };

  const primitiveDescriptor: GPUPrimitiveState = {
    topology: "triangle-strip",
    cullMode: "none",
  };

  const renderPipeline = device.createRenderPipeline({
    label: "render pipeline",
    layout: "auto",
    vertex: vertexShaderDescriptor,
    fragment: fragmentShaderDescriptor,
    depthStencil: depthStencilDescriptor,
    primitive: primitiveDescriptor,
  });

  return renderPipeline;
}

function _initUniform(
  device: GPUDevice,
  cam: any,
  projMatrix: any,
  params: number[],
  currentAxis: number = 3
): {
  projView: mat4;
  mvpBuffer: GPUBuffer;
  colorMapBuffer: GPUBuffer;
  paramsBuffer: GPUBuffer;
} {
  params.push(currentAxis);
  params.push(appState.globalMaxIntensity);

  const paramsBuffer = device.createBuffer({
    size: 8 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  const mapArrayParams = new Float32Array(paramsBuffer.getMappedRange());
  mapArrayParams.set(params);
  paramsBuffer.unmap();

  // Create colormap
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

  const colorMapBuffer = device.createBuffer({
    size: hsvColors.length * 3 * 4,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
  });

  const mapArray = new Float32Array(colorMapBuffer.getMappedRange());
  mapArray.set(hsvColors);
  colorMapBuffer.unmap();

  const mvpBuffer = device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const viewMatrix = cam.matrixWorldInverse.elements;
  const projView = mat4.mul(mat4.create(), projMatrix, viewMatrix);

  return {
    projView,
    mvpBuffer,
    colorMapBuffer,
    paramsBuffer,
  };
}

async function _createBindGroups(
  device: GPUDevice,
  renderPipeline: GPURenderPipeline,
  mvpBuffer: GPUBuffer,
  colorMapBuffer: GPUBuffer,
  paramsBuffer: GPUBuffer
): Promise<GPUBindGroup> {
  const mvpBindGroup = device.createBindGroup({
    label: "uniform bindgroup - rendering",
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: mvpBuffer },
      },
      {
        binding: 1,
        resource: { buffer: colorMapBuffer },
      },
      {
        binding: 2,
        resource: { buffer: paramsBuffer },
      },
    ],
  });

  return mvpBindGroup;
}

function _createDepthBuffer(
  device: GPUDevice,
  canvas: HTMLCanvasElement
): GPUTexture {
  const renderDepthTexture = device.createTexture({
    size: [canvas.width, canvas.height, 1],
    format: "depth24plus-stencil8",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  return renderDepthTexture;
}

async function _updateMaxIntensity(
  device: GPUDevice,
  paramsBuffer: GPUBuffer,
  params: number[]
) {
  params[params.length - 1] = appState.globalMaxIntensity;

  const stagingBuffer = device.createBuffer({
    usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
    size: 32,
    mappedAtCreation: true,
  });

  const stagingData = new Float32Array(stagingBuffer.getMappedRange());
  stagingData.set(params);
  stagingBuffer.unmap();

  const copyEncoder = device.createCommandEncoder();
  copyEncoder.copyBufferToBuffer(stagingBuffer, 28, paramsBuffer, 28, 4);
  device.queue.submit([copyEncoder.finish()]);
}

function _render(
  device: GPUDevice,
  canvas: HTMLCanvasElement,
  context: GPUCanvasContext,
  renderPipeline: GPURenderPipeline,
  mvpBuffer: GPUBuffer,
  mvpBindGroup: GPUBindGroup,
  renderDepthTexture: GPUTexture,
  camera: any,
  projMatrix: mat4
) {
  stats.update();
  const commandEncoder = device.createCommandEncoder();

  const viewMatrix = camera.matrixWorldInverse.elements;
  const projView = mat4.mul(mat4.create(), projMatrix, viewMatrix);
  appState.controls.update();

  const renderPassDescriptor = _encodeCommand(context, renderDepthTexture);

  const wvStagingBuffer = device.createBuffer({
    size: 4 * 16,
    usage: GPUBufferUsage.COPY_SRC,
    mappedAtCreation: true,
  });
  const stagingUniformData = new Float32Array(wvStagingBuffer.getMappedRange());
  stagingUniformData.set(projView as Float32Array);
  wvStagingBuffer.unmap();
  commandEncoder.copyBufferToBuffer(wvStagingBuffer, 0, mvpBuffer, 0, 64);

  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
  renderPass.setPipeline(renderPipeline);
  renderPass.setViewport(0, 0, canvas.width, canvas.height, 0.0, 1.0);
  renderPass.setBindGroup(0, mvpBindGroup);

  for (let key in appState.bufferMap) {
    renderPass.setVertexBuffer(0, appState.bufferMap[key].position);
    renderPass.setVertexBuffer(1, appState.bufferMap[key].color);
    const numPoints = Math.floor(+appState.bufferMap[key].position.label / 4);
    renderPass.draw(4, numPoints, 0, 0);
  }

  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(() =>
    _render(
      device,
      canvas,
      context,
      renderPipeline,
      mvpBuffer,
      mvpBindGroup,
      renderDepthTexture,
      camera,
      projMatrix
    )
  );
}

function _encodeCommand(
  context: GPUCanvasContext,
  renderDepthTexture: GPUTexture
): GPURenderPassDescriptor {
  const colorAttachment: GPURenderPassColorAttachment = {
    view: context.getCurrentTexture().createView(),
    clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
    loadOp: "clear",
    storeOp: "store",
  };

  const depthAttachment: GPURenderPassDepthStencilAttachment = {
    view: renderDepthTexture.createView(),
    depthLoadOp: "clear",
    depthClearValue: 1.0,
    depthStoreOp: "store",
    stencilLoadOp: "clear",
    stencilClearValue: 0,
    stencilStoreOp: "store",
  };

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [colorAttachment],
    depthStencilAttachment: depthAttachment,
  };

  return renderPassDescriptor;
}
