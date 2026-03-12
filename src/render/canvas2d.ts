import { COLS, ROWS, SPAWN_ROWS, HUD_HEIGHT } from '../config.js';
import { CandyColor, CandyType, AppState, type GameState, type Candy } from '../core/state.js';
import { getAbsoluteCells, getGhostPosition } from '../core/formation.js';
import { calculateCamera, type Camera } from './camera.js';
import type { Renderer } from './renderer.js';
import type { FXManager } from '../fx/animation.js';

const COLOR_MAP: Record<CandyColor, string> = {
  [CandyColor.RED]: '#ff4444',
  [CandyColor.BLUE]: '#4488ff',
  [CandyColor.GREEN]: '#44dd44',
  [CandyColor.YELLOW]: '#ffdd44',
  [CandyColor.PURPLE]: '#cc44ff',
};

const COLOR_LIGHT: Record<CandyColor, string> = {
  [CandyColor.RED]: '#ff8888',
  [CandyColor.BLUE]: '#88bbff',
  [CandyColor.GREEN]: '#88ff88',
  [CandyColor.YELLOW]: '#ffee88',
  [CandyColor.PURPLE]: '#dd88ff',
};

const COLOR_DARK: Record<CandyColor, string> = {
  [CandyColor.RED]: '#cc2222',
  [CandyColor.BLUE]: '#2266cc',
  [CandyColor.GREEN]: '#22aa22',
  [CandyColor.YELLOW]: '#ccaa22',
  [CandyColor.PURPLE]: '#9922cc',
};

const VISUAL_LERP_SPEED = 0.015;
const F_UI = 'Fredoka, sans-serif';
const F_ACTION = 'Bangers, cursive';

// Ambient background particles
interface BgParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

export class Canvas2DRenderer implements Renderer {
  private ctx!: CanvasRenderingContext2D;
  private canvas!: HTMLCanvasElement;
  private camera!: Camera;
  private fx: FXManager | null = null;
  private dangerPulse = 0;
  private bgParticles: BgParticle[] = [];
  private stageFlash = 0;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize(window.innerWidth, window.innerHeight);
    this.initBgParticles();
  }

  private initBgParticles(): void {
    const colors = ['#ff4444', '#4488ff', '#44dd44', '#ffdd44', '#cc44ff'];
    for (let i = 0; i < 15; i++) {
      this.bgParticles.push({
        x: Math.random() * 600,
        y: Math.random() * 900,
        vx: (Math.random() - 0.5) * 0.15,
        vy: 0.1 + Math.random() * 0.2,
        size: 3 + Math.random() * 5,
        color: colors[i % 5],
        alpha: 0.04 + Math.random() * 0.06,
      });
    }
  }

  setFX(fx: FXManager): void {
    this.fx = fx;
  }

  triggerStageFlash(): void {
    this.stageFlash = 1;
  }

  resize(width: number, height: number): void {
    this.camera = calculateCamera(width, height);
    const { dpr, logicalW, logicalH } = this.camera;
    this.canvas.width = logicalW * dpr;
    this.canvas.height = logicalH * dpr;
    this.canvas.style.width = `${logicalW}px`;
    this.canvas.style.height = `${logicalH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(state: GameState, alpha: number, frameDt: number, demoMode = false): void {
    const ctx = this.ctx;
    const cam = this.camera;
    const { cellSize, boardX, boardY } = cam;

    this.updateVisualPositions(state, frameDt);
    this.dangerPulse += frameDt * 0.004;

    // Decay stage flash
    if (this.stageFlash > 0) {
      this.stageFlash = Math.max(0, this.stageFlash - frameDt * 0.002);
    }

    // Screen shake offset
    let shakeX = 0, shakeY = 0;
    if (state.screenShake > 0) {
      const intensity = state.screenShake / 200;
      shakeX = (Math.random() - 0.5) * 6 * intensity;
      shakeY = (Math.random() - 0.5) * 6 * intensity;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Clear
    ctx.fillStyle = '#1a0a2e';
    ctx.fillRect(-10, -10, cam.logicalW + 20, cam.logicalH + 20);

    // Background ambient particles
    this.updateAndDrawBgParticles(ctx, cam, frameDt);

    // Board background with subtle gradient
    const boardW = COLS * cellSize;
    const boardH = ROWS * cellSize;
    const bgGrad = ctx.createLinearGradient(boardX, boardY, boardX, boardY + boardH);
    bgGrad.addColorStop(0, '#0e0618');
    bgGrad.addColorStop(1, '#150a24');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(boardX, boardY, boardW, boardH);

    // Board border glow
    ctx.strokeStyle = 'rgba(100,60,180,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(boardX - 1, boardY - 1, boardW + 2, boardH + 2);

    // Danger overlay
    if (state.dangerLevel > 0.3) {
      const pulse = (Math.sin(this.dangerPulse * Math.PI) + 1) * 0.5;
      const a = (state.dangerLevel - 0.3) * 0.3 * pulse;
      ctx.fillStyle = `rgba(255,0,0,${a})`;
      ctx.fillRect(boardX, boardY, boardW, boardH);
    }

    // Stage flash overlay
    if (this.stageFlash > 0) {
      ctx.fillStyle = `rgba(255,255,200,${this.stageFlash * 0.15})`;
      ctx.fillRect(boardX, boardY, boardW, boardH);
    }

    // Grid lines — subtle dots at intersections instead of full lines
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let r = 1; r < ROWS; r++) {
      for (let c = 1; c < COLS; c++) {
        const gx = boardX + c * cellSize;
        const gy = boardY + r * cellSize;
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Landed candies
    const pad = 2;
    const innerSize = cellSize - pad * 2;
    for (let r = 0; r < ROWS + SPAWN_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const candy = state.board[r * COLS + c];
        if (!candy) continue;
        const screenRow = candy.visualRow - SPAWN_ROWS;
        if (screenRow < -1 || screenRow > ROWS) continue;
        const x = boardX + candy.visualCol * cellSize + pad;
        const y = boardY + screenRow * cellSize + pad;
        this.drawCandy(ctx, candy, x, y, innerSize);
      }
    }

    // Ghost piece
    if (state.active) {
      const ghostRow = getGhostPosition(state.board, state.active);
      if (ghostRow !== state.active.pivotRow) {
        const ghostFormation = { ...state.active, pivotRow: ghostRow };
        const ghostCells = getAbsoluteCells(ghostFormation);
        for (const { row, col, candy } of ghostCells) {
          if (row < SPAWN_ROWS) continue;
          const x = boardX + col * cellSize + pad;
          const y = boardY + (row - SPAWN_ROWS) * cellSize + pad;
          const r = innerSize * 0.18;
          ctx.globalAlpha = 0.2;
          ctx.strokeStyle = COLOR_MAP[candy.color];
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          this.roundRectStroke(ctx, x + 1, y + 1, innerSize - 2, innerSize - 2, r);
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }
    }

    // Active formation
    if (state.active) {
      const smoothRow = state.active.pivotRow + Math.min(state.fallAccumulator, 0.95);
      const interpFormation = { ...state.active, pivotRow: smoothRow };
      const cells = getAbsoluteCells(interpFormation);
      for (const { row, col, candy } of cells) {
        const screenRow = row - SPAWN_ROWS;
        if (screenRow < -1) continue;
        const x = boardX + col * cellSize + pad;
        const y = boardY + screenRow * cellSize + pad;
        this.drawCandy(ctx, candy, x, y, innerSize);
        // Active piece glow
        const r = innerSize * 0.18;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        this.roundRectStroke(ctx, x, y, innerSize, innerSize, r);
      }
    }

    // FX layer
    this.fx?.render(ctx);

    ctx.restore(); // end screen shake

    if (!demoMode) {
      // HUD (outside shake)
      this.drawHUD(ctx, state, cam);

      // Game over overlay
      if (state.appState === AppState.GAME_OVER) {
        this.drawGameOver(ctx, state, cam);
      }
    }
  }

  private drawCandy(ctx: CanvasRenderingContext2D, candy: Candy, x: number, y: number, size: number): void {
    const baseColor = COLOR_MAP[candy.color];
    const lightColor = COLOR_LIGHT[candy.color];
    const darkColor = COLOR_DARK[candy.color];
    const r = size * 0.18;

    switch (candy.type) {
      case CandyType.STANDARD:
        this.drawStandardCandy(ctx, x, y, size, r, baseColor, lightColor, darkColor);
        break;

      case CandyType.JELLY:
        this.drawJellyCandy(ctx, x, y, size, r, baseColor, lightColor);
        break;

      case CandyType.STICKY:
        this.drawStickyCandy(ctx, x, y, size, r, baseColor, lightColor, darkColor, candy.stickyBonds ?? 0);
        break;

      case CandyType.BOMB:
        this.drawBombCandy(ctx, x, y, size, candy.bombTimer ?? 0);
        break;

      case CandyType.PRISM:
        this.drawPrismCandy(ctx, x, y, size);
        break;

      case CandyType.LOCKED:
        this.drawLockedCandy(ctx, x, y, size, r, baseColor);
        break;

      case CandyType.CRACKED:
        this.drawCrackedCandy(ctx, x, y, size, r, baseColor, lightColor, darkColor, candy.crackHits ?? 2);
        break;
    }
  }

  private drawStandardCandy(
    ctx: CanvasRenderingContext2D, x: number, y: number, size: number, r: number,
    base: string, light: string, dark: string,
  ): void {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    this.roundRectFill(ctx, x + 2, y + 2, size, size, r);

    // Main body
    ctx.fillStyle = base;
    this.roundRectFill(ctx, x, y, size, size, r);

    // Top highlight (gradient)
    const hlGrad = ctx.createLinearGradient(x, y, x, y + size * 0.5);
    hlGrad.addColorStop(0, light);
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = hlGrad;
    this.roundRectFill(ctx, x, y, size, size * 0.5, r);
    ctx.globalAlpha = 1;

    // Bottom edge
    ctx.fillStyle = dark;
    ctx.globalAlpha = 0.4;
    this.roundRectFill(ctx, x, y + size * 0.82, size, size * 0.18, r * 0.5);
    ctx.globalAlpha = 1;

    // Gloss spot
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + size * 0.32, y + size * 0.28, size * 0.15, size * 0.1, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawJellyCandy(
    ctx: CanvasRenderingContext2D, x: number, y: number, size: number, r: number,
    base: string, light: string,
  ): void {
    const jR = size * 0.28;

    // Wobble-effect via slight squash
    const wobble = Math.sin(this.dangerPulse * 3) * 0.03;
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.scale(1 + wobble, 1 - wobble);
    ctx.translate(-(x + size / 2), -(y + size / 2));

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    this.roundRectFill(ctx, x + 2, y + 2, size, size, jR);

    // Body (slightly transparent)
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = base;
    this.roundRectFill(ctx, x + 1, y + 1, size - 2, size - 2, jR);

    // Inner glow
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = light;
    this.roundRectFill(ctx, x + 3, y + 3, size - 6, size - 6, jR - 2);
    ctx.globalAlpha = 1;

    // Gloss
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + size * 0.35, y + size * 0.3, size * 0.18, size * 0.12, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // "J" label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `bold ${Math.max(7, size * 0.22)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('J', x + size / 2, y + size - 2);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  private drawStickyCandy(
    ctx: CanvasRenderingContext2D, x: number, y: number, size: number, r: number,
    base: string, light: string, dark: string, bonds: number,
  ): void {
    // Standard candy base
    this.drawStandardCandy(ctx, x, y, size, r, base, light, dark);

    // Sticky bond indicators — thick colored connectors
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,220,100,0.7)';
    ctx.lineCap = 'round';
    const m = size * 0.25;
    if (bonds & 1) { ctx.beginPath(); ctx.moveTo(x + m, y - 1); ctx.lineTo(x + size - m, y - 1); ctx.stroke(); }
    if (bonds & 2) { ctx.beginPath(); ctx.moveTo(x + size + 1, y + m); ctx.lineTo(x + size + 1, y + size - m); ctx.stroke(); }
    if (bonds & 4) { ctx.beginPath(); ctx.moveTo(x + m, y + size + 1); ctx.lineTo(x + size - m, y + size + 1); ctx.stroke(); }
    if (bonds & 8) { ctx.beginPath(); ctx.moveTo(x - 1, y + m); ctx.lineTo(x - 1, y + size - m); ctx.stroke(); }
    ctx.lineCap = 'butt';
  }

  private drawBombCandy(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, timer: number): void {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const bombR = size * 0.42;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(cx + 2, cy + 2, bombR, 0, Math.PI * 2);
    ctx.fill();

    // Bomb body — dark circle
    const bombGrad = ctx.createRadialGradient(cx - bombR * 0.3, cy - bombR * 0.3, 0, cx, cy, bombR);
    bombGrad.addColorStop(0, '#555555');
    bombGrad.addColorStop(1, '#222222');
    ctx.fillStyle = bombGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, bombR, 0, Math.PI * 2);
    ctx.fill();

    // Orange ring
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, bombR, 0, Math.PI * 2);
    ctx.stroke();

    // Fuse
    ctx.strokeStyle = '#aa8844';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + bombR * 0.5, y + size * 0.12);
    ctx.quadraticCurveTo(cx + bombR * 0.8, y - 2, cx + bombR * 0.3, y - 1);
    ctx.stroke();

    // Fuse spark
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(cx + bombR * 0.3, y - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Timer number
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(10, size * 0.45)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${timer}`, cx, cy + 1);
    ctx.textAlign = 'left';

    // Flash when low
    if (timer <= 2) {
      ctx.globalAlpha = 0.25 * (Math.sin(this.dangerPulse * 8) + 1);
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(cx, cy, bombR + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private drawPrismCandy(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const hue = (this.dangerPulse * 60) % 360;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.save();
    ctx.translate(cx + 2, cy + 2);
    ctx.rotate(Math.PI / 4);
    const ds = size * 0.56;
    ctx.fillRect(-ds / 2, -ds / 2, ds, ds);
    ctx.restore();

    // Diamond body with rainbow gradient
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    const dSize = size * 0.56;
    const prismGrad = ctx.createLinearGradient(-dSize / 2, -dSize / 2, dSize / 2, dSize / 2);
    prismGrad.addColorStop(0, `hsl(${hue}, 80%, 75%)`);
    prismGrad.addColorStop(0.5, '#ffffff');
    prismGrad.addColorStop(1, `hsl(${(hue + 120) % 360}, 80%, 75%)`);
    ctx.fillStyle = prismGrad;
    ctx.fillRect(-dSize / 2, -dSize / 2, dSize, dSize);
    ctx.restore();

    // Outer glow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
    this.roundRectFill(ctx, x + 1, y + 1, size - 2, size - 2, size * 0.15);
    ctx.globalAlpha = 1;

    // Star symbol
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(10, size * 0.4)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2726', cx, cy);
    ctx.textAlign = 'left';
  }

  private drawLockedCandy(
    ctx: CanvasRenderingContext2D, x: number, y: number, size: number, r: number, base: string,
  ): void {
    // Dimmed base
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = base;
    this.roundRectFill(ctx, x, y, size, size, r);
    ctx.globalAlpha = 1;

    // Iron overlay
    const ironGrad = ctx.createLinearGradient(x, y, x, y + size);
    ironGrad.addColorStop(0, 'rgba(120,120,120,0.5)');
    ironGrad.addColorStop(0.5, 'rgba(80,80,80,0.6)');
    ironGrad.addColorStop(1, 'rgba(60,60,60,0.7)');
    ctx.fillStyle = ironGrad;
    this.roundRectFill(ctx, x, y, size, size, r);

    // Cross-hatch pattern
    ctx.strokeStyle = 'rgba(150,150,150,0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const off = i * size * 0.3;
      ctx.beginPath();
      ctx.moveTo(x + off, y);
      ctx.lineTo(x, y + off);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + size - off, y + size);
      ctx.lineTo(x + size, y + size - off);
      ctx.stroke();
    }

    // Lock icon
    const lx = x + size / 2;
    const ly = y + size / 2;
    const ls = size * 0.18;
    ctx.fillStyle = '#aaaaaa';
    // Lock body
    ctx.fillRect(lx - ls, ly, ls * 2, ls * 1.5);
    // Lock arch
    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lx, ly, ls, Math.PI, 0);
    ctx.stroke();
  }

  private drawCrackedCandy(
    ctx: CanvasRenderingContext2D, x: number, y: number, size: number, r: number,
    base: string, light: string, dark: string, hits: number,
  ): void {
    // Normal candy base
    this.drawStandardCandy(ctx, x, y, size, r, base, light, dark);

    // Crack lines
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + size * 0.3, y + size * 0.05);
    ctx.lineTo(x + size * 0.45, y + size * 0.35);
    ctx.lineTo(x + size * 0.55, y + size * 0.5);
    ctx.lineTo(x + size * 0.65, y + size * 0.95);
    ctx.stroke();

    if (hits <= 1) {
      ctx.beginPath();
      ctx.moveTo(x + size * 0.7, y + size * 0.05);
      ctx.lineTo(x + size * 0.55, y + size * 0.3);
      ctx.lineTo(x + size * 0.4, y + size * 0.55);
      ctx.lineTo(x + size * 0.25, y + size * 0.95);
      ctx.stroke();

      // Extra damage: darker overlay
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      this.roundRectFill(ctx, x, y, size, size, r);
    }
    ctx.lineCap = 'butt';

    // Hits badge
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(x + size - 5, y + 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(7, size * 0.22)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${hits}`, x + size - 5, y + 6);
    ctx.textAlign = 'left';
  }

  private updateAndDrawBgParticles(ctx: CanvasRenderingContext2D, cam: Camera, dt: number): void {
    for (const p of this.bgParticles) {
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      if (p.y > cam.logicalH + 10) { p.y = -10; p.x = Math.random() * cam.logicalW; }
      if (p.x < -10) p.x = cam.logicalW + 10;
      if (p.x > cam.logicalW + 10) p.x = -10;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      this.roundRectFill(ctx, p.x, p.y, p.size, p.size, p.size * 0.25);
    }
    ctx.globalAlpha = 1;
  }

  private updateVisualPositions(state: GameState, frameDt: number): void {
    const t = 1 - Math.pow(1 - VISUAL_LERP_SPEED, frameDt);
    for (let i = 0; i < state.board.length; i++) {
      const candy = state.board[i];
      if (!candy) continue;
      candy.visualRow += (candy.row - candy.visualRow) * t;
      candy.visualCol += (candy.col - candy.visualCol) * t;
      if (Math.abs(candy.visualRow - candy.row) < 0.01) candy.visualRow = candy.row;
      if (Math.abs(candy.visualCol - candy.col) < 0.01) candy.visualCol = candy.col;
    }
  }

  private drawHUD(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera): void {
    const { cellSize, boardX } = cam;
    const fontSize = Math.max(14, cellSize * 0.35);
    const boardRight = boardX + COLS * cellSize;

    // Score with subtle shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = `700 ${fontSize}px ${F_UI}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${state.score}`, boardX + 9, HUD_HEIGHT / 2 - 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Score: ${state.score}`, boardX + 8, HUD_HEIGHT / 2 - 8);

    // Stage + phase
    ctx.font = `400 ${fontSize * 0.8}px ${F_UI}`;
    ctx.fillStyle = state.stagePhase === 'pressure' ? '#ff8844' :
                    state.stagePhase === 'break' ? '#44dd44' : '#888888';
    ctx.fillText(`Stage ${state.stage + 1} \u00b7 ${state.stagePhase}`, boardX + 8, HUD_HEIGHT / 2 + 10);

    // Ability meter
    const meterW = 60;
    const meterH = 10;
    const meterX = boardRight - meterW - 80;
    const meterY = HUD_HEIGHT / 2 + 6;

    // Meter background
    ctx.fillStyle = '#222222';
    this.roundRectFill(ctx, meterX, meterY, meterW, meterH, 3);

    // Meter fill
    const fillW = meterW * state.abilityCharge;
    if (fillW > 0) {
      const meterGrad = ctx.createLinearGradient(meterX, meterY, meterX + fillW, meterY);
      if (state.abilityReady) {
        meterGrad.addColorStop(0, '#22cc88');
        meterGrad.addColorStop(1, '#44ffaa');
      } else {
        meterGrad.addColorStop(0, '#2266cc');
        meterGrad.addColorStop(1, '#4488ff');
      }
      ctx.fillStyle = meterGrad;
      this.roundRectFill(ctx, meterX, meterY, fillW, meterH, 3);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    this.roundRectStroke(ctx, meterX, meterY, meterW, meterH, 3);

    if (state.abilityReady) {
      const pulse = 0.7 + Math.sin(this.dangerPulse * 4) * 0.3;
      ctx.fillStyle = `rgba(68,255,170,${pulse})`;
      ctx.font = `700 ${fontSize * 0.7}px ${F_ACTION}`;
      ctx.fillText('BURST!', meterX, meterY - 10);
    } else {
      ctx.fillStyle = '#666666';
      ctx.font = `400 ${fontSize * 0.6}px ${F_UI}`;
      ctx.fillText('ability', meterX, meterY - 10);
    }

    // Next preview
    if (state.next) {
      const previewX = boardRight - cellSize * 2.5;
      const previewY = 6;
      const ps = Math.floor(cellSize * 0.4);

      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      this.roundRectFill(ctx, previewX - 4, previewY - 4, ps * 2 + 14, ps * 2 + 14, 6);

      ctx.fillStyle = '#555555';
      ctx.font = `400 ${fontSize * 0.6}px ${F_UI}`;
      ctx.textAlign = 'left';
      ctx.fillText('NEXT', previewX - 4, previewY + ps * 2 + 16);

      const previewCells = getAbsoluteCells({
        ...state.next,
        pivotRow: 0,
        pivotCol: 0,
      });
      for (const { row, col, candy } of previewCells) {
        const px = previewX + col * ps + 1;
        const py = previewY + row * ps + 1;
        this.drawCandy(ctx, candy, px, py, ps - 2);
      }
    }
  }

  private drawGameOver(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera): void {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, cam.logicalW, cam.logicalH);

    const { cellSize } = cam;
    const cx = cam.logicalW / 2;
    const cy = cam.logicalH / 2;

    ctx.fillStyle = '#ff4444';
    ctx.font = `700 ${Math.max(32, cellSize * 1.0)}px ${F_ACTION}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', cx, cy - 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.max(20, cellSize * 0.55)}px ${F_UI}`;
    ctx.fillText(`${state.score}`, cx, cy);

    ctx.fillStyle = '#888888';
    ctx.font = `400 ${Math.max(13, cellSize * 0.3)}px ${F_UI}`;
    ctx.fillText(`Stage ${state.stage + 1}`, cx, cy + 30);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = `400 ${Math.max(14, cellSize * 0.35)}px ${F_UI}`;
    ctx.fillText('Tap to restart', cx, cy + 65);
    ctx.textAlign = 'left';
  }

  private roundRectFill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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

  private roundRectStroke(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
    ctx.stroke();
  }

  destroy(): void {}

  getCamera(): Camera {
    return this.camera;
  }

  cellToScreen(row: number, col: number): { x: number; y: number } {
    const { cellSize, boardX, boardY } = this.camera;
    return {
      x: boardX + col * cellSize + cellSize / 2,
      y: boardY + (row - SPAWN_ROWS) * cellSize + cellSize / 2,
    };
  }
}
