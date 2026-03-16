const F_UI = 'Fredoka, sans-serif';
const F_ACTION = 'Bangers, cursive';

interface ButtonRect { x: number; y: number; w: number; h: number }

let endlessBtnRect: ButtonRect = { x: 0, y: 0, w: 0, h: 0 };
let challengeBtnRect: ButtonRect = { x: 0, y: 0, w: 0, h: 0 };
let backBtnRect: ButtonRect = { x: 0, y: 0, w: 0, h: 0 };

function roundRectFill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  if (w <= 0 || h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

export function drawModeSelect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
): void {
  const cx = w / 2;
  const s = Math.min(28, w * 0.06);

  // Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${s * 1.8}px ${F_ACTION}`;
  ctx.fillText('SELECT MODE', cx, h * 0.28);

  // Button dimensions
  const btnW = Math.min(260, w * 0.7);
  const btnH = s * 3;
  const gap = s * 1.5;

  // Endless button
  const endlessY = h * 0.42;
  const endlessGrad = ctx.createLinearGradient(cx - btnW / 2, endlessY, cx - btnW / 2, endlessY + btnH);
  endlessGrad.addColorStop(0, '#4488ff');
  endlessGrad.addColorStop(1, '#2266cc');
  ctx.fillStyle = endlessGrad;
  roundRectFill(ctx, cx - btnW / 2, endlessY, btnW, btnH, 12);
  endlessBtnRect = { x: cx - btnW / 2, y: endlessY, w: btnW, h: btnH };

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${s * 1.1}px ${F_ACTION}`;
  ctx.fillText('ENDLESS', cx, endlessY + btnH * 0.4);
  ctx.fillStyle = '#aaccff';
  ctx.font = `400 ${s * 0.55}px ${F_UI}`;
  ctx.fillText('Classic survival mode', cx, endlessY + btnH * 0.72);

  // Challenge button
  const challengeY = endlessY + btnH + gap;
  const chalGrad = ctx.createLinearGradient(cx - btnW / 2, challengeY, cx - btnW / 2, challengeY + btnH);
  chalGrad.addColorStop(0, '#ff8844');
  chalGrad.addColorStop(1, '#cc5522');
  ctx.fillStyle = chalGrad;
  roundRectFill(ctx, cx - btnW / 2, challengeY, btnW, btnH, 12);
  challengeBtnRect = { x: cx - btnW / 2, y: challengeY, w: btnW, h: btnH };

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${s * 1.1}px ${F_ACTION}`;
  ctx.fillText('CHALLENGE', cx, challengeY + btnH * 0.4);
  ctx.fillStyle = '#ffcc99';
  ctx.font = `400 ${s * 0.55}px ${F_UI}`;
  ctx.fillText('Clear puzzle levels', cx, challengeY + btnH * 0.72);

  // Back button
  const backS = s * 0.7;
  const backW = s * 4;
  const backH = s * 1.4;
  const backX = cx - backW / 2;
  const backY = h * 0.85;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  roundRectFill(ctx, backX, backY, backW, backH, 8);
  backBtnRect = { x: backX, y: backY, w: backW, h: backH };
  ctx.fillStyle = '#888888';
  ctx.font = `600 ${backS}px ${F_UI}`;
  ctx.fillText('BACK', cx, backY + backH / 2);

  ctx.textAlign = 'left';
}

export function hitTestModeSelect(px: number, py: number): 'endless' | 'challenge' | 'back' | null {
  if (hitBtn(px, py, endlessBtnRect)) return 'endless';
  if (hitBtn(px, py, challengeBtnRect)) return 'challenge';
  if (hitBtn(px, py, backBtnRect)) return 'back';
  return null;
}

function hitBtn(px: number, py: number, r: ButtonRect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
