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
  const titleSize = Math.min(72, w * 0.16);
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
  ctx.font = `600 ${Math.max(40, titleSize * 0.65)}px ${F_UI}`;
  ctx.fillText('TAP TO PLAY', cx, btnY);
  ctx.globalAlpha = 1;

  // High score
  if (save.highScore > 0) {
    const statY = h * 0.67;
    const statFont = Math.max(26, titleSize * 0.4);
    ctx.fillStyle = '#999999';
    ctx.font = `400 ${statFont}px ${F_UI}`;
    ctx.fillText(`High Score: ${save.highScore}`, cx, statY);
    ctx.fillText(`Best Stage: ${save.bestStage + 1}  \u00b7  Best Chain: ${save.bestChain}`, cx, statY + statFont * 1.6);
    ctx.fillText(`Games Played: ${save.totalRuns}`, cx, statY + statFont * 3.2);
  }

  // Controls hint
  ctx.fillStyle = '#666666';
  const hintFont = Math.max(20, titleSize * 0.32);
  ctx.font = `400 ${hintFont}px ${F_UI}`;
  ctx.fillText('\u2190\u2192 Move  \u2191 Rotate  Space Drop  A Ability', cx, h * 0.88);
  ctx.fillText('Touch: Drag=Move  Tap=Rotate  Swipe\u2193=Drop', cx, h * 0.92);

  ctx.textAlign = 'left';
}

// --- Install prompt banner ---
let installBannerRect = { x: 0, y: 0, w: 0, h: 0 };
let installDismissRect = { x: 0, y: 0, w: 0, h: 0 };

export function drawInstallBanner(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
): void {
  const bannerW = Math.min(300, w * 0.85);
  const bannerH = 90;
  const bx = (w - bannerW) / 2;
  const by = h * 0.72;

  // Slide-in animation (first 400ms)
  const slideT = Math.min(1, time / 400);
  const slideEase = 1 - Math.pow(1 - slideT, 3);
  const offsetY = (1 - slideEase) * 60;
  const alpha = slideEase;

  ctx.globalAlpha = alpha;

  // Banner background
  ctx.fillStyle = 'rgba(20, 10, 40, 0.92)';
  ctx.beginPath();
  const r = 12;
  ctx.moveTo(bx + r, by + offsetY);
  ctx.lineTo(bx + bannerW - r, by + offsetY);
  ctx.quadraticCurveTo(bx + bannerW, by + offsetY, bx + bannerW, by + offsetY + r);
  ctx.lineTo(bx + bannerW, by + offsetY + bannerH - r);
  ctx.quadraticCurveTo(bx + bannerW, by + offsetY + bannerH, bx + bannerW - r, by + offsetY + bannerH);
  ctx.lineTo(bx + r, by + offsetY + bannerH);
  ctx.quadraticCurveTo(bx, by + offsetY + bannerH, bx, by + offsetY + bannerH - r);
  ctx.lineTo(bx, by + offsetY + r);
  ctx.quadraticCurveTo(bx, by + offsetY, bx + r, by + offsetY);
  ctx.closePath();
  ctx.fill();

  // Border glow
  ctx.strokeStyle = 'rgba(68, 136, 255, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const cx = w / 2;
  const s = Math.min(16, w * 0.04);

  // Icon
  ctx.fillStyle = '#4488ff';
  ctx.font = `700 ${s * 1.5}px ${F_UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u2b07', bx + 24, by + offsetY + bannerH / 2 - 4);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${s}px ${F_UI}`;
  ctx.textAlign = 'left';
  ctx.fillText('Install as App', bx + 44, by + offsetY + bannerH * 0.32);

  // Description
  ctx.fillStyle = '#999999';
  ctx.font = `400 ${s * 0.75}px ${F_UI}`;
  ctx.fillText('Faster start, fullscreen, offline play', bx + 44, by + offsetY + bannerH * 0.56);

  // Install button
  const btnW = 80;
  const btnH = 30;
  const btnX = bx + bannerW - btnW - 12;
  const btnY = by + offsetY + (bannerH - btnH) / 2;

  ctx.fillStyle = '#4488ff';
  ctx.beginPath();
  ctx.moveTo(btnX + 6, btnY);
  ctx.lineTo(btnX + btnW - 6, btnY);
  ctx.quadraticCurveTo(btnX + btnW, btnY, btnX + btnW, btnY + 6);
  ctx.lineTo(btnX + btnW, btnY + btnH - 6);
  ctx.quadraticCurveTo(btnX + btnW, btnY + btnH, btnX + btnW - 6, btnY + btnH);
  ctx.lineTo(btnX + 6, btnY + btnH);
  ctx.quadraticCurveTo(btnX, btnY + btnH, btnX, btnY + btnH - 6);
  ctx.lineTo(btnX, btnY + 6);
  ctx.quadraticCurveTo(btnX, btnY, btnX + 6, btnY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${s * 0.8}px ${F_UI}`;
  ctx.textAlign = 'center';
  ctx.fillText('INSTALL', btnX + btnW / 2, btnY + btnH / 2);

  // Dismiss X
  const dismissSize = 20;
  const dismissX = bx + bannerW - dismissSize - 4;
  const dismissY = by + offsetY + 2;
  ctx.fillStyle = '#666666';
  ctx.font = `400 ${12}px ${F_UI}`;
  ctx.fillText('\u2715', dismissX + dismissSize / 2, dismissY + dismissSize / 2);

  // Store hit-test rects (with offsetY baked in)
  installBannerRect = { x: btnX, y: btnY, w: btnW, h: btnH };
  installDismissRect = { x: dismissX, y: dismissY, w: dismissSize, h: dismissSize };

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function hitTestInstallBanner(px: number, py: number): 'install' | 'dismiss' | null {
  const r = installBannerRect;
  if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return 'install';
  const d = installDismissRect;
  if (px >= d.x && px <= d.x + d.w && py >= d.y && py <= d.y + d.h) return 'dismiss';
  return null;
}

// --- Intro / Logo Reveal ---
const INTRO_DURATION = 3000;
const INTRO_FADE_OUT = 400; // crossfade to menu at end

// Candy colors for letter glow
const INTRO_COLORS = ['#ff4444', '#4488ff', '#44dd44', '#ffdd44', '#cc44ff'];

export function drawIntro(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
): boolean {
  const t = time / INTRO_DURATION; // 0→1 over full intro

  // --- Background: dark plum with growing radial glow ---
  ctx.fillStyle = '#0e0618';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h * 0.38;

  // Radial candy glow (builds up phase 0.1→0.5)
  const glowStrength = Math.min(1, Math.max(0, (t - 0.1) / 0.4));
  if (glowStrength > 0) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
    grad.addColorStop(0, `rgba(120, 40, 160, ${0.3 * glowStrength})`);
    grad.addColorStop(0.4, `rgba(60, 20, 100, ${0.15 * glowStrength})`);
    grad.addColorStop(1, 'rgba(14, 6, 24, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // --- Falling particles (ambient candy dust) ---
  const particleCount = 20;
  for (let i = 0; i < particleCount; i++) {
    const seed = i * 137.5;
    const px = (seed * 7.3) % w;
    const speed = 0.3 + (seed % 5) * 0.15;
    const py = ((time * speed * 0.05 + seed * 3.1) % (h + 40)) - 20;
    const size = 1.5 + (seed % 3);
    const pAlpha = Math.min(1, t * 3) * (0.2 + (seed % 4) * 0.1);
    ctx.globalAlpha = pAlpha;
    ctx.fillStyle = INTRO_COLORS[i % 5];
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // --- "FALLING CANDY" — letters drop in one by one ---
  const title = 'FALLING CANDY';
  const titleSize = Math.min(38, w * 0.085);
  ctx.font = `700 ${titleSize}px ${F_TITLE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const titleY = h * 0.30;
  const titleW = ctx.measureText(title).width;
  const startX = cx - titleW / 2;

  // Letters reveal from t=0.15 to t=0.55 (staggered)
  const letterDelay = 0.03;
  const letterDrop = 60; // px drop distance

  for (let i = 0; i < title.length; i++) {
    const letterStart = 0.15 + i * letterDelay;
    const letterT = Math.max(0, Math.min(1, (t - letterStart) / 0.12));

    if (letterT <= 0) continue;

    // Elastic ease-out for the drop
    const ease = letterT < 1
      ? 1 - Math.pow(1 - letterT, 3) * Math.cos(letterT * Math.PI * 1.5)
      : 1;
    const yOff = (1 - ease) * -letterDrop;

    // Accumulate x position
    let xPos = startX;
    for (let j = 0; j < i; j++) xPos += ctx.measureText(title[j]).width;
    const charW = ctx.measureText(title[i]).width;
    const lx = xPos + charW / 2;
    const ly = titleY + yOff;

    // Letter alpha
    const lAlpha = Math.min(1, letterT * 2);
    ctx.globalAlpha = lAlpha;

    // Candy glow behind letter
    if (letterT > 0.3) {
      const glowAlpha = Math.min(0.4, (letterT - 0.3) * 0.6);
      ctx.shadowColor = INTRO_COLORS[i % 5];
      ctx.shadowBlur = 15 + Math.sin(time * 0.005 + i) * 5;
      ctx.globalAlpha = glowAlpha;
      ctx.fillStyle = INTRO_COLORS[i % 5];
      ctx.fillText(title[i], lx, ly);
      ctx.shadowBlur = 0;
    }

    // Shadow
    ctx.globalAlpha = lAlpha * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(title[i], lx + 2, ly + 3);

    // Letter
    ctx.globalAlpha = lAlpha;
    ctx.fillStyle = INTRO_COLORS[i % 5];
    ctx.fillText(title[i], lx, ly);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // --- "INFINITY" — scales up from center ---
  const subStart = 0.50;
  const subT = Math.max(0, Math.min(1, (t - subStart) / 0.18));
  if (subT > 0) {
    const subSize = titleSize * 1.4;
    ctx.font = `700 ${subSize}px ${F_TITLE}`;
    const subY = titleY + titleSize * 2.2;

    // Scale: starts small, overshoots, settles
    const scale = subT < 1
      ? subT * (2 - subT) * (1 + 0.15 * Math.sin(subT * Math.PI * 2))
      : 1;
    const subAlpha = Math.min(1, subT * 3);

    ctx.save();
    ctx.translate(cx, subY);
    ctx.scale(scale, scale);

    // Rainbow shimmer
    const hue = (time * 0.15) % 360;

    // Glow
    ctx.shadowColor = `hsl(${hue}, 80%, 60%)`;
    ctx.shadowBlur = 20 + Math.sin(time * 0.008) * 8;
    ctx.globalAlpha = subAlpha * 0.5;
    ctx.fillStyle = `hsl(${hue}, 80%, 70%)`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('INFINITY', 0, 0);

    // Shadow
    ctx.shadowBlur = 0;
    ctx.globalAlpha = subAlpha * 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText('INFINITY', 2, 3);

    // Main text
    ctx.globalAlpha = subAlpha;
    ctx.fillStyle = `hsl(${hue}, 70%, 72%)`;
    ctx.fillText('INFINITY', 0, 0);

    ctx.restore();
    ctx.shadowBlur = 0;

    // Sparkle burst at the moment of reveal
    if (subT > 0.15 && subT < 0.5) {
      const sparkT = (subT - 0.15) / 0.35;
      const sparkCount = 12;
      for (let i = 0; i < sparkCount; i++) {
        const angle = (i / sparkCount) * Math.PI * 2 + sparkT * 0.8;
        const dist = sparkT * w * 0.25;
        const sx = cx + Math.cos(angle) * dist;
        const sy = subY + Math.sin(angle) * dist * 0.5;
        const sparkSize = 3 * (1 - sparkT);
        ctx.globalAlpha = (1 - sparkT) * 0.7;
        ctx.fillStyle = INTRO_COLORS[i % 5];
        // Star
        ctx.beginPath();
        ctx.moveTo(sx, sy - sparkSize);
        ctx.lineTo(sx + sparkSize * 0.3, sy - sparkSize * 0.3);
        ctx.lineTo(sx + sparkSize, sy);
        ctx.lineTo(sx + sparkSize * 0.3, sy + sparkSize * 0.3);
        ctx.lineTo(sx, sy + sparkSize);
        ctx.lineTo(sx - sparkSize * 0.3, sy + sparkSize * 0.3);
        ctx.lineTo(sx - sparkSize, sy);
        ctx.lineTo(sx - sparkSize * 0.3, sy - sparkSize * 0.3);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  // --- "Tap to skip" hint (appears after 1s) ---
  if (t > 0.35 && t < 0.9) {
    const hintAlpha = Math.min(1, (t - 0.35) / 0.15) * 0.4;
    ctx.globalAlpha = hintAlpha;
    ctx.fillStyle = '#666666';
    const hintSize = Math.max(11, titleSize * 0.3);
    ctx.font = `400 ${hintSize}px ${F_UI}`;
    ctx.textAlign = 'center';
    ctx.fillText('Tap to skip', cx, h * 0.88);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  // --- Fade out at end → crossfade to menu ---
  if (t >= 1 - INTRO_FADE_OUT / INTRO_DURATION) {
    const fadeT = (t - (1 - INTRO_FADE_OUT / INTRO_DURATION)) / (INTRO_FADE_OUT / INTRO_DURATION);
    ctx.fillStyle = `rgba(14, 6, 24, ${Math.min(1, fadeT)})`;
    ctx.fillRect(0, 0, w, h);
  }

  return t < 1;
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
