import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mat4 } from "gl-matrix";

import { appState } from "./state-manager";

export async function setupViewport(canvas: HTMLCanvasElement) {
  appState.camera = new THREE.PerspectiveCamera(
    50,
    canvas.width / canvas.height,
    0.1,
    4000
  );
  appState.camera.up.set(0, 0, 1);
  appState.camera.position.set(0, 1000, 1000);
  appState.camera.updateProjectionMatrix();

  appState.controls = new OrbitControls(appState.camera, canvas);

  appState.controls.enableDamping = true;
  appState.controls.dampingFactor = 0.5;
  appState.controls.zoomSpeed = 1;
  appState.controls.panSpeed = 2;
  appState.controls.update();

  appState.proj = mat4.perspective(
    mat4.create(),
    (50 * Math.PI) / 180.0,
    canvas.width / canvas.height,
    0.1,
    8000
  );
}
