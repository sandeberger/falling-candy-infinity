import type { SaveData } from '../save/persistence.js';

export interface SettingsButton {
  label: string;
  key: keyof SaveData;
  x: number;
  y: number;
  w: number;
  h: number;
}

let buttons: SettingsButton[] = [];

export function getSettingsButtons(): SettingsButton[] {
  return buttons;
}

export function drawSettings(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  save: SaveData,
  showInstall: boolean,
): void {
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const s = Math.min(22, w * 0.05);
  const btnW = Math.min(220, w * 0.55);
  const btnH = s * 2.2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title
  ctx.fillStyle = '#ffdd44';
  ctx.font = `bold ${s * 1.4}px monospace`;
  ctx.fillText('SETTINGS', cx, h * 0.15);

  buttons = [];
  let y = h * 0.28;
  const gap = btnH + s * 0.6;

  // Toggle buttons
  const toggles: { label: string; key: keyof SaveData }[] = [
    { label: 'Sound FX', key: 'sfxEnabled' },
    { label: 'Music', key: 'musicEnabled' },
    { label: 'Haptics', key: 'hapticsEnabled' },
  ];

  for (const toggle of toggles) {
    const enabled = save[toggle.key] as boolean;
    const bx = cx - btnW / 2;
    const by = y - btnH / 2;

    // Button background
    ctx.fillStyle = enabled ? 'rgba(68,221,68,0.2)' : 'rgba(255,68,68,0.15)';
    ctx.strokeStyle = enabled ? '#44dd44' : '#ff4444';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, btnW, btnH, 8);
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = `${s * 0.75}px monospace`;
    ctx.fillText(`${toggle.label}: ${enabled ? 'ON' : 'OFF'}`, cx, y);

    buttons.push({ label: toggle.label, key: toggle.key, x: bx, y: by, w: btnW, h: btnH });
    y += gap;
  }

  // Install button (only if available)
  if (showInstall && !save.installPromptDismissed) {
    y += gap * 0.3;
    const bx = cx - btnW / 2;
    const by = y - btnH / 2;

    ctx.fillStyle = 'rgba(68,136,255,0.2)';
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, btnW, btnH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4488ff';
    ctx.font = `bold ${s * 0.75}px monospace`;
    ctx.fillText('INSTALL APP', cx, y);

    // Use 'installPromptDismissed' key as a sentinel for install button
    buttons.push({ label: 'Install', key: 'installPromptDismissed', x: bx, y: by, w: btnW, h: btnH });
    y += gap;
  }

  // Close hint
  ctx.fillStyle = '#666666';
  ctx.font = `${s * 0.6}px monospace`;
  ctx.fillText('Tap outside or press Esc to close', cx, h * 0.88);

  ctx.textAlign = 'left';
}

export function hitTestSettings(px: number, py: number): SettingsButton | null {
  for (const btn of buttons) {
    if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
      return btn;
    }
  }
  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
}
