class Loader {
  url: string;

  constructor(url: string) {
    this.url = url;
  }
  async loadHeader() {
    // loadheader
    let loaderByteSize = 549;
  }
}

export function computeFocalLength(angle) {
  let canvas = document.getElementById("screen-canvas");
  let angleRadian = (angle * Math.PI) / 180;
  return canvas.clientHeight * 0.5 * (1 / Math.tan(angleRadian / 2));
}

export function computeSSE(width, distance, focalLength) {
  return (width / distance) * focalLength;
}
