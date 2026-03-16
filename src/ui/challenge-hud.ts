import { ChallengePhase, type GameState } from '../core/state.js';
import { LEVELS } from '../challenge/level-data.js';

const F_UI = 'Fredoka, sans-serif';
const F_ACTION = 'Bangers, cursive';

interface ButtonRect { x: number; y: number; w: number; h: number }

let nextLevelBtnRect: ButtonRect = { x: 0, y: 0, w: 0, h: 0 };
let levelSelectBtnRect: ButtonRect = { x: 0, y: 0, w: 0, h: 0 };
let retryBtnRect: ButtonRect = { x: 0, y: 0, w: 0, h: 0 };

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

function formatTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const frac = Math.floor((ms % 1000) / 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${frac}`;
}

export function drawChallengeHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  boardX: number,
  boardRight: number,
  hudHeight: number,
): void {
  const ch = state.challenge;
  if (!ch) return;

  const level = LEVELS[ch.levelIndex];
  const fontSize = Math.max(12, (boardRight - boardX) * 0.04);

  ctx.textBaseline = 'middle';

  // Level name (left)
  ctx.fillStyle = '#cccccc';
  ctx.font = `600 ${fontSize * 0.85}px ${F_UI}`;
  ctx.textAlign = 'left';
  ctx.fillText(level?.name ?? `Level ${ch.levelIndex + 1}`, boardX + 4, hudHeight / 2 - 6);

  // Timer (center)
  const cx = (boardX + boardRight) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${fontSize}px ${F_UI}`;
  ctx.textAlign = 'center';
  ctx.fillText(formatTime(ch.elapsedMs), cx, hudHeight / 2 - 6);

  // Remaining / Total (right)
  ctx.fillStyle = '#ffcc44';
  ctx.font = `600 ${fontSize * 0.85}px ${F_UI}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${ch.remainingTargets}/${ch.targetCandyCount}`, boardRight - 4, hudHeight / 2 - 6);

  // Progress bar
  const barW = boardRight - boardX - 8;
  const barH = 4;
  const barX = boardX + 4;
  const barY = hudHeight / 2 + 8;
  ctx.fillStyle = '#222222';
  roundRectFill(ctx, barX, barY, barW, barH, 2);

  const progress = ch.targetCandyCount > 0
    ? (ch.targetCandyCount - ch.remainingTargets) / ch.targetCandyCount
    : 0;
  if (progress > 0) {
    const grad = ctx.createLinearGradient(barX, barY, barX + barW * progress, barY);
    grad.addColorStop(0, '#44ff88');
    grad.addColorStop(1, '#22cc66');
    ctx.fillStyle = grad;
    roundRectFill(ctx, barX, barY, barW * progress, barH, 2);
  }

  ctx.textAlign = 'left';
}

export function drawCountdown(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timerMs: number,
): void {
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(60, w * 0.15);

  const secondsLeft = Math.ceil(timerMs / 1000);
  const text = secondsLeft > 0 ? `${secondsLeft}` : 'GO!';

  // Scale animation: pulse within each second
  const frac = (timerMs % 1000) / 1000;
  const scale = secondsLeft > 0 ? 1 + frac * 0.3 : 1.5;
  const alpha = secondsLeft > 0 ? 0.5 + frac * 0.5 : 1.0;

  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = secondsLeft > 0 ? '#ffffff' : '#44ff88';
  ctx.font = `700 ${s * scale}px ${F_ACTION}`;
  ctx.fillText(text, cx, cy);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'left';
}

export function drawVictoryScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: GameState,
  time: number,
): void {
  const ch = state.challenge;
  if (!ch) return;

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(28, w * 0.06);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title
  ctx.fillStyle = '#44ff88';
  ctx.font = `700 ${s * 2}px ${F_ACTION}`;
  ctx.fillText('LEVEL CLEAR!', cx, cy - s * 4.5);

  // Stars
  const starSize = s * 1.8;
  for (let i = 0; i < 3; i++) {
    const sx = cx + (i - 1) * (starSize * 1.3);
    ctx.fillStyle = i < ch.stars ? '#ffcc00' : '#333333';
    ctx.font = `${starSize}px ${F_UI}`;
    ctx.fillText('\u2605', sx, cy - s * 2);
  }

  // Time
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${s * 1.1}px ${F_UI}`;
  ctx.fillText(formatTime(ch.elapsedMs), cx, cy - s * 0.3);

  ctx.fillStyle = '#888888';
  ctx.font = `400 ${s * 0.6}px ${F_UI}`;
  ctx.fillText(`Score: ${state.score}`, cx, cy + s * 1);

  // Buttons
  const btnW = Math.min(200, w * 0.5);
  const btnH = s * 2;
  const gap = s * 0.8;

  // Next Level button (only if not last level)
  const hasNext = ch.levelIndex < LEVELS.length - 1;
  if (hasNext) {
    const nextY = cy + s * 2.5;
    const grad = ctx.createLinearGradient(cx - btnW / 2, nextY, cx - btnW / 2, nextY + btnH);
    grad.addColorStop(0, '#44ff88');
    grad.addColorStop(1, '#22cc66');
    ctx.fillStyle = grad;
    roundRectFill(ctx, cx - btnW / 2, nextY, btnW, btnH, 10);
    nextLevelBtnRect = { x: cx - btnW / 2, y: nextY, w: btnW, h: btnH };

    ctx.fillStyle = '#000000';
    ctx.font = `700 ${s * 0.85}px ${F_ACTION}`;
    ctx.fillText('NEXT LEVEL', cx, nextY + btnH / 2);

    // Level Select button
    const selY = nextY + btnH + gap;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRectFill(ctx, cx - btnW / 2, selY, btnW, btnH, 10);
    levelSelectBtnRect = { x: cx - btnW / 2, y: selY, w: btnW, h: btnH };

    ctx.fillStyle = '#aaaaaa';
    ctx.font = `600 ${s * 0.7}px ${F_UI}`;
    ctx.fillText('LEVEL SELECT', cx, selY + btnH / 2);
  } else {
    // Last level: only show Level Select
    nextLevelBtnRect = { x: 0, y: 0, w: 0, h: 0 };
    const selY = cy + s * 2.5;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRectFill(ctx, cx - btnW / 2, selY, btnW, btnH, 10);
    levelSelectBtnRect = { x: cx - btnW / 2, y: selY, w: btnW, h: btnH };

    ctx.fillStyle = '#aaaaaa';
    ctx.font = `600 ${s * 0.7}px ${F_UI}`;
    ctx.fillText('LEVEL SELECT', cx, selY + btnH / 2);
  }

  // Reset retry rect so it's not clickable on victory
  retryBtnRect = { x: 0, y: 0, w: 0, h: 0 };

  ctx.textAlign = 'left';
}

export function drawFailedScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: GameState,
): void {
  const ch = state.challenge;
  if (!ch) return;

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(28, w * 0.06);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ff4444';
  ctx.font = `700 ${s * 2}px ${F_ACTION}`;
  ctx.fillText('LEVEL FAILED', cx, cy - s * 3.5);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = `400 ${s * 0.8}px ${F_UI}`;
  ctx.fillText(`${ch.remainingTargets} candies remaining`, cx, cy - s * 1.5);

  // Buttons
  const btnW = Math.min(200, w * 0.5);
  const btnH = s * 2;
  const gap = s * 0.8;

  // Retry button
  const retryY = cy + s * 0.5;
  const grad = ctx.createLinearGradient(cx - btnW / 2, retryY, cx - btnW / 2, retryY + btnH);
  grad.addColorStop(0, '#ff8844');
  grad.addColorStop(1, '#cc5522');
  ctx.fillStyle = grad;
  roundRectFill(ctx, cx - btnW / 2, retryY, btnW, btnH, 10);
  retryBtnRect = { x: cx - btnW / 2, y: retryY, w: btnW, h: btnH };

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${s * 0.85}px ${F_ACTION}`;
  ctx.fillText('RETRY', cx, retryY + btnH / 2);

  // Level Select button
  const selY = retryY + btnH + gap;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRectFill(ctx, cx - btnW / 2, selY, btnW, btnH, 10);
  levelSelectBtnRect = { x: cx - btnW / 2, y: selY, w: btnW, h: btnH };

  ctx.fillStyle = '#aaaaaa';
  ctx.font = `600 ${s * 0.7}px ${F_UI}`;
  ctx.fillText('LEVEL SELECT', cx, selY + btnH / 2);

  // Reset next level rect so it's not clickable on fail
  nextLevelBtnRect = { x: 0, y: 0, w: 0, h: 0 };

  ctx.textAlign = 'left';
}

export function hitTestChallengeOverlay(px: number, py: number): 'next_level' | 'level_select' | 'retry' | null {
  if (hitBtn(px, py, nextLevelBtnRect)) return 'next_level';
  if (hitBtn(px, py, retryBtnRect)) return 'retry';
  if (hitBtn(px, py, levelSelectBtnRect)) return 'level_select';
  return null;
}

function hitBtn(px: number, py: number, r: ButtonRect): boolean {
  return r.w > 0 && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
