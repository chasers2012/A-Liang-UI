export function drawDotGrid(
  ctx: CanvasRenderingContext2D,
  visible: readonly [number, number, number, number],
  gap: number,
  dotColor: string,
) {
  const [vx, vy, vw, vh] = visible;
  const startX = Math.floor(vx / gap) * gap;
  const startY = Math.floor(vy / gap) * gap;
  ctx.fillStyle = dotColor;
  ctx.globalAlpha = 0.55;
  for (let x = startX; x < vx + vw; x += gap) {
    for (let y = startY; y < vy + vh; y += gap) {
      ctx.fillRect(x, y, 1.1, 1.1);
    }
  }
  ctx.globalAlpha = 1;
}
