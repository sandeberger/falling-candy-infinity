import type { SaveData } from '../save/persistence.js';

const F_TITLE = 'Bangers, cursive';
const F_UI = 'Fredoka, sans-serif';

export function drawMenu(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  save: SaveData,
  time: number,
): void {
  // No solid background — demo plays behind with dim overlay from main.ts
  const colors = ['#ff4444', '#4488ff', '#44dd44', '#ffdd44', '#cc44ff'];

  const cx = w / 2;

  // Title
  const titleSize = Math.min(36, w * 0.08);
  ctx.font = `700 ${titleSize}px ${F_TITLE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Wobble each letter
  const title = 'FALLING CANDY';
  const subtitle = 'INFINITY';
  const titleY = h * 0.28;
  for (let i = 0; i < title.length; i++) {
    const yOff = Math.sin(time * 0.003 + i * 0.4) * 5;
    const charW = ctx.measureText(title[i]).width;
    const startX = cx - ctx.measureText(title).width / 2;
    let xPos = startX;
    for (let j = 0; j < i; j++) xPos += ctx.measureText(title[j]).width;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(title[i], xPos + charW / 2 + 2, titleY + yOff + 3);
    // Letter
    ctx.fillStyle = colors[i % 5];
    ctx.fillText(title[i], xPos + charW / 2, titleY + yOff);
  }

  // Subtitle
  ctx.font = `700 ${titleSize * 1.4}px ${F_TITLE}`;
  const subY = titleY + titleSize * 2;
  const hue = (time * 0.1) % 360;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(subtitle, cx + 2, subY + 3);
  ctx.fillStyle = `hsl(${hue}, 70%, 70%)`;
  ctx.fillText(subtitle, cx, subY);

  // Play button
  const btnY = h * 0.54;
  const pulse = (Math.sin(time * 0.004) + 1) * 0.5;
  const btnAlpha = 0.7 + pulse * 0.3;
  ctx.globalAlpha = btnAlpha;
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.max(20, titleSize * 0.65)}px ${F_UI}`;
  ctx.fillText('TAP TO PLAY', cx, btnY);
  ctx.globalAlpha = 1;

  // High score
  if (save.highScore > 0) {
    const statY = h * 0.67;
    const statFont = Math.max(13, titleSize * 0.4);
    ctx.fillStyle = '#999999';
    ctx.font = `400 ${statFont}px ${F_UI}`;
    ctx.fillText(`High Score: ${save.highScore}`, cx, statY);
    ctx.fillText(`Best Stage: ${save.bestStage + 1}  \u00b7  Best Chain: ${save.bestChain}`, cx, statY + statFont * 1.6);
    ctx.fillText(`Games Played: ${save.totalRuns}`, cx, statY + statFont * 3.2);
  }

  // Controls hint
  ctx.fillStyle = '#666666';
  const hintFont = Math.max(10, titleSize * 0.32);
  ctx.font = `400 ${hintFont}px ${F_UI}`;
  ctx.fillText('\u2190\u2192 Move  \u2191 Rotate  Space Drop  A Ability', cx, h * 0.88);
  ctx.fillText('Touch: Drag=Move  Tap=Rotate  Swipe\u2193=Drop', cx, h * 0.92);

  ctx.textAlign = 'left';
}

export function drawOnboarding(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  age: number,
): boolean {
  const duration = 4000;
  if (age >= duration) return false;

  const t = age / duration;
  const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 1;

  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const fontSize = Math.min(20, w * 0.045);

  ctx.fillStyle = '#ffdd44';
  ctx.font = `700 ${fontSize * 1.4}px ${F_TITLE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HOW TO PLAY', cx, h * 0.25);

  const instructions = [
    ['\u2190 \u2192  or  Drag', 'Move candy'],
    ['\u2191  or  Tap', 'Rotate'],
    ['Space  or  Swipe \u2193', 'Hard drop'],
    ['Match 3+ same color', 'Score points!'],
    ['A  key', 'Sugar Burst ability'],
  ];

  for (let i = 0; i < instructions.length; i++) {
    const reveal = Math.min(1, (age - i * 400) / 300);
    if (reveal <= 0) continue;
    ctx.globalAlpha = alpha * reveal;
    const y = h * 0.35 + i * (fontSize * 2.5);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${fontSize}px ${F_UI}`;
    ctx.fillText(instructions[i][0], cx, y);
    ctx.fillStyle = '#999999';
    ctx.font = `400 ${fontSize * 0.85}px ${F_UI}`;
    ctx.fillText(instructions[i][1], cx, y + fontSize * 1.2);
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  return true;
}
