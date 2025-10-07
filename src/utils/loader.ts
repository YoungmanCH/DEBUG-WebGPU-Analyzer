export function computeFocalLength(angle) {
  const canvas = document.getElementById("screen-canvas");
  const angleRadian = (angle * Math.PI) / 180;
  return canvas.clientHeight * 0.5 * (1 / Math.tan(angleRadian / 2));
}
