import type { SaveData } from '../save/persistence.js';
import { isLevelUnlocked } from '../save/persistence.js';
import { LEVELS } from '../challenge/level-data.js';

const F_UI = 'Fredoka, sans-serif';
const F_ACTION = 'Bangers, cursive';

interface ButtonRect { x: number; y: number; w: number; h: number }

const levelBtnRects: ButtonRect[] = [];
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

export function drawLevelSelect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  save: SaveData,
  time: number,
): void {
  const cx = w / 2;
  const s = Math.min(24, w * 0.05);

  // Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${s * 1.6}px ${F_ACTION}`;
  ctx.fillText('SELECT LEVEL', cx, h * 0.08);

  // Grid: 4 columns x 5 rows
  const cols = 4;
  const rows = 5;
  const gridW = Math.min(w * 0.85, 320);
  const cellW = gridW / cols;
  const cellH = cellW * 1.15;
  const gridH = rows * cellH;
  const gridX = cx - gridW / 2;
  const gridY = h * 0.14;

  levelBtnRects.length = 0;

  for (let i = 0; i < LEVELS.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const bx = gridX + col * cellW + 3;
    const by = gridY + row * cellH + 3;
    const bw = cellW - 6;
    const bh = cellH - 6;

    const unlocked = isLevelUnlocked(save, i);
    const starCount = save.challengeStars?.[i] ?? 0;

    levelBtnRects.push({ x: bx, y: by, w: bw, h: bh });

    if (unlocked) {
      // Background
      const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
      if (starCount >= 3) {
        grad.addColorStop(0, '#554400');
        grad.addColorStop(1, '#332800');
      } else if (starCount > 0) {
        grad.addColorStop(0, '#2a2244');
        grad.addColorStop(1, '#1a1533');
      } else {
        grad.addColorStop(0, '#222233');
        grad.addColorStop(1, '#181822');
      }
      ctx.fillStyle = grad;
      roundRectFill(ctx, bx, by, bw, bh, 8);

      // Border
      ctx.strokeStyle = starCount >= 3 ? 'rgba(255,200,50,0.5)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx + 8, by);
      ctx.lineTo(bx + bw - 8, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 8);
      ctx.lineTo(bx + bw, by + bh - 8);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 8, by + bh);
      ctx.lineTo(bx + 8, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 8);
      ctx.lineTo(bx, by + 8);
      ctx.quadraticCurveTo(bx, by, bx + 8, by);
      ctx.closePath();
      ctx.stroke();

      // Level number
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${s * 0.9}px ${F_ACTION}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, bx + bw / 2, by + bh * 0.3);

      // Level name (truncated)
      ctx.fillStyle = '#999999';
      ctx.font = `400 ${Math.max(8, s * 0.4)}px ${F_UI}`;
      const name = LEVELS[i].name.length > 10 ? LEVELS[i].name.slice(0, 9) + '...' : LEVELS[i].name;
      ctx.fillText(name, bx + bw / 2, by + bh * 0.55);

      // Stars
      const starSize = Math.max(8, s * 0.45);
      const starY = by + bh * 0.78;
      for (let si = 0; si < 3; si++) {
        const starX = bx + bw / 2 + (si - 1) * (starSize * 1.2);
        ctx.fillStyle = si < starCount ? '#ffcc00' : '#333333';
        ctx.font = `${starSize}px ${F_UI}`;
        ctx.fillText('\u2605', starX, starY);
      }
    } else {
      // Locked level
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      roundRectFill(ctx, bx, by, bw, bh, 8);

      ctx.fillStyle = '#444444';
      ctx.font = `700 ${s * 1.2}px ${F_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('\u{1F512}', bx + bw / 2, by + bh * 0.45);

      ctx.fillStyle = '#444444';
      ctx.font = `400 ${Math.max(8, s * 0.35)}px ${F_UI}`;
      ctx.fillText(`${i + 1}`, bx + bw / 2, by + bh * 0.75);
    }
  }

  // Back button
  const backW = s * 4;
  const backH = s * 1.4;
  const backX = cx - backW / 2;
  const backY = gridY + gridH + s * 0.5;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  roundRectFill(ctx, backX, backY, backW, backH, 8);
  backBtnRect = { x: backX, y: backY, w: backW, h: backH };
  ctx.fillStyle = '#888888';
  ctx.font = `600 ${s * 0.7}px ${F_UI}`;
  ctx.textAlign = 'center';
  ctx.fillText('BACK', cx, backY + backH / 2);

  ctx.textAlign = 'left';
}

export function hitTestLevelSelect(px: number, py: number, save: SaveData): number | 'back' | null {
  // Check level buttons
  for (let i = 0; i < levelBtnRects.length; i++) {
    const r = levelBtnRects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
      if (isLevelUnlocked(save, i)) return i;
      return null; // locked
    }
  }
  // Check back button
  const b = backBtnRect;
  if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return 'back';
  return null;
}
