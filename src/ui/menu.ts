import type { SaveData } from '../save/persistence.js';

const F_TITLE = 'Bangers, cursive';
const F_UI = 'Fredoka, sans-serif';

// --- Logo image ---
let logoImg: HTMLImageElement | null = null;
let logoLoaded = false;

export function loadLogo(): void {
  const img = new Image();
  img.src = '/logo.png';
  img.onload = () => {
    logoImg = img;
    logoLoaded = true;
  };
}

/** Draw the logo image centered at (cx, cy), fitting within maxW x maxH, with optional scale */
function drawLogoAt(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  scale: number,
  alpha: number,
): void {
  if (!logoImg || !logoLoaded) return;
  const aspect = logoImg.width / logoImg.height;
  let drawW = maxW;
  let drawH = drawW / aspect;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH * aspect;
  }
  drawW *= scale;
  drawH *= scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(logoImg, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  ctx.globalAlpha = 1;
}

export function drawMenu(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  save: SaveData,
  time: number,
): void {
  const cx = w / 2;

  // Logo with gentle breathing pulse — large
  const pulse = 1 + Math.sin(time * 0.002) * 0.02;
  const logoMaxW = Math.min(w * 0.95, 720);
  const logoMaxH = h * 0.40;
  const logoY = h * 0.28;
  drawLogoAt(ctx, cx, logoY, logoMaxW, logoMaxH, pulse, 1);

  // Play button
  const titleSize = Math.min(72, w * 0.16);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const btnY = logoY + logoMaxH * 0.5 + titleSize * 0.6;
  const btnPulse = (Math.sin(time * 0.004) + 1) * 0.5;
  const btnAlpha = 0.7 + btnPulse * 0.3;
  ctx.globalAlpha = btnAlpha;
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.max(40, titleSize * 0.65)}px ${F_UI}`;
  ctx.fillText('TAP TO PLAY', cx, btnY);
  ctx.globalAlpha = 1;

  // High score
  if (save.highScore > 0) {
    const statY = btnY + titleSize * 0.9;
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
const INTRO_FADE_OUT = 400;
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
  const cy = h * 0.35;

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

  // --- Logo image fades in and scales up ---
  const logoRevealStart = 0.1;
  const logoRevealEnd = 0.55;
  const logoT = Math.max(0, Math.min(1, (t - logoRevealStart) / (logoRevealEnd - logoRevealStart)));

  if (logoT > 0 && logoLoaded) {
    // Ease-out elastic scale
    const scaleRaw = logoT < 1
      ? logoT * (2 - logoT) * (1 + 0.08 * Math.sin(logoT * Math.PI * 2.5))
      : 1;
    // Add gentle breathing pulse once fully revealed
    const breathe = logoT >= 1 ? Math.sin(time * 0.003) * 0.015 : 0;
    const scale = scaleRaw + breathe;
    const alpha = Math.min(1, logoT * 2.5);

    const maxW = Math.min(w * 0.95, 720);
    const maxH = h * 0.40;
    drawLogoAt(ctx, cx, cy, maxW, maxH, scale, alpha);
  }

  ctx.globalAlpha = 1;

  // --- "Tap to skip" hint ---
  if (t > 0.35 && t < 0.9) {
    const hintAlpha = Math.min(1, (t - 0.35) / 0.15) * 0.4;
    ctx.globalAlpha = hintAlpha;
    ctx.fillStyle = '#666666';
    const hintSize = Math.max(11, w * 0.03);
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
