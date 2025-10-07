export type CameraMoveCallback = (signal?: AbortSignal) => void | Promise<void>;
export type AxisChangeCallback = (axis: number) => void;

export class CanvasEventManager {
  private canvas: HTMLCanvasElement;
  private abortController: AbortController | null = null;
  private keyMap = { isDown: false };

  private onCameraMove?: CameraMoveCallback;
  private onAxisChange?: AxisChangeCallback;

  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  setCameraMoveCallback(callback: CameraMoveCallback): void {
    this.onCameraMove = callback;
  }

  setAxisChangeCallback(callback: AxisChangeCallback): void {
    this.onAxisChange = callback;
  }

  initialize(): void {
    this._setupMouseEvents();
    this._setupWheelEvents();
    this._setupUIEvents();
  }

  throttle(callback: Function, interval: number) {
    let enableCall = true;
    return function (...args: any[]) {
      if (!enableCall) return;
      enableCall = false;
      callback.apply(null, args);
      setTimeout(() => (enableCall = true), interval);
    };
  }

  private _setupMouseEvents(): void {
    this.canvas.addEventListener("mousedown", (e) => {
      if (e.buttons === 1 || e.buttons === 2) {
        this.keyMap.isDown = true;
      }
    });

    window.addEventListener("mouseup", () => {
      this.keyMap.isDown = false;
    });

    this.canvas.addEventListener("mousemove", () => {
      if (this.keyMap.isDown) {
        this._throttledCameraMove();
      }
    });
  }

  private _setupWheelEvents(): void {
    window.addEventListener("wheel", () => {
      if (this.abortController) {
        this.abortController.abort();
      }

      this.abortController = new AbortController();
      this._throttledCameraMove(this.abortController.signal);
    });
  }

  private _setupUIEvents(): void {
    const selectColormap = document.getElementById("colormap-axis");
    if (selectColormap) {
      selectColormap.addEventListener("change", (event) => {
        const axis = parseInt((event.target as HTMLSelectElement).value);
        this._handleAxisChange(axis);
      });
    }
  }

  private _throttledCameraMove = this.throttle((signal?: AbortSignal) => {
    if (this.onCameraMove) {
      this.onCameraMove(signal);
    }
  }, 2000);

  private _handleAxisChange(axis: number): void {
    if (this.onAxisChange) {
      this.onAxisChange(axis);
    }
  }
}
