// 在 canvas 上畫 QR code（點陣由 vendor/qrcode.js 計算）：白底深色點，手機相機最好掃

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} text 要編進去的網址
 * @param {{ size?: number, margin?: number }} [options] size 是畫布的像素寬度，margin 是外圍留白的格數
 */
export function drawQr(canvas, text, { size = 480, margin = 2 } = {}) {
  const qr = window.qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const cell = Math.max(1, Math.floor(size / (count + margin * 2)));
  const full = cell * (count + margin * 2);
  canvas.width = full;
  canvas.height = full;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, full, full);
  ctx.fillStyle = "#121316";
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) ctx.fillRect((col + margin) * cell, (row + margin) * cell, cell, cell);
    }
  }
}
