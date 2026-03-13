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
// --- Parallax background system ---
interface ParallaxItem {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
  baseSpeed: number; // vertical drift speed
  seed: number;      // for per-item variation
}

interface ParallaxLayer {
  items: ParallaxItem[];
  speedMultiplier: number; // relative to base drift
}

export class Canvas2DRenderer implements Renderer {
  private ctx!: CanvasRenderingContext2D;
  private canvas!: HTMLCanvasElement;
  private camera!: Camera;
  private fx: FXManager | null = null;
  private dangerPulse = 0;
  private parallaxLayers: ParallaxLayer[] = [];
  private parallaxTime = 0;
  private stageFlash = 0;
  private phaseFlash = 0;
  private phaseFlashColor = '255,150,50';
  private leanAngle = 0;       // radians, decays toward 0
  private prevActivePivotCol = -1;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize(window.innerWidth, window.innerHeight);
    this.initParallax();
  }

  private initParallax(): void {
    const colors = ['#ff4444', '#4488ff', '#44dd44', '#ffdd44', '#cc44ff'];
    const dimColors = ['#442244', '#333366', '#224433', '#444422', '#3a2244'];

    // Far layer: large dim hexagonal shapes, very slow
    const farItems: ParallaxItem[] = [];
    for (let i = 0; i < 8; i++) {
      farItems.push({
        x: Math.random() * 800,
        y: Math.random() * 1200,
        size: 50 + Math.random() * 70,
        color: dimColors[i % 5],
        alpha: 0.06 + Math.random() * 0.04,
        baseSpeed: 0.04 + Math.random() * 0.02,
        seed: Math.random() * 1000,
      });
    }

    // Mid layer: bokeh circles, medium speed
    const midItems: ParallaxItem[] = [];
    for (let i = 0; i < 14; i++) {
      midItems.push({
        x: Math.random() * 800,
        y: Math.random() * 1200,
        size: 8 + Math.random() * 18,
        color: colors[i % 5],
        alpha: 0.08 + Math.random() * 0.07,
        baseSpeed: 0.1 + Math.random() * 0.1,
        seed: Math.random() * 1000,
      });
    }

    // Near layer: small sparkles/streaks, fast
    const nearItems: ParallaxItem[] = [];
    for (let i = 0; i < 20; i++) {
      nearItems.push({
        x: Math.random() * 800,
        y: Math.random() * 1200,
        size: 2 + Math.random() * 4,
        color: colors[i % 5],
        alpha: 0.12 + Math.random() * 0.12,
        baseSpeed: 0.2 + Math.random() * 0.25,
        seed: Math.random() * 1000,
      });
    }

    this.parallaxLayers = [
      { items: farItems, speedMultiplier: 0.3 },
      { items: midItems, speedMultiplier: 0.7 },
      { items: nearItems, speedMultiplier: 1.2 },
    ];
  }

  setFX(fx: FXManager): void {
    this.fx = fx;
  }

  triggerStageFlash(): void {
    this.stageFlash = 1;
  }

  triggerPhaseFlash(phase: string): void {
    this.phaseFlash = 1;
    this.phaseFlashColor = phase === 'pressure' ? '255,120,50' : '100,220,150';
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
    // Decay phase flash
    if (this.phaseFlash > 0) {
      this.phaseFlash = Math.max(0, this.phaseFlash - frameDt * 0.003);
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

    // Parallax background layers
    this.updateAndDrawParallax(ctx, cam, frameDt, state.dangerLevel);

    // Board background — semi-transparent so parallax bleeds through
    const boardW = COLS * cellSize;
    const boardH = ROWS * cellSize;
    const bgGrad = ctx.createLinearGradient(boardX, boardY, boardX, boardY + boardH);
    bgGrad.addColorStop(0, 'rgba(14,6,24,0.82)');
    bgGrad.addColorStop(1, 'rgba(21,10,36,0.82)');
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

    // Phase flash overlay
    if (this.phaseFlash > 0) {
      ctx.fillStyle = `rgba(${this.phaseFlashColor},${this.phaseFlash * 0.12})`;
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

    // Active formation — with side-lean on horizontal movement
    if (state.active) {
      // Detect horizontal movement → set lean impulse
      if (this.prevActivePivotCol >= 0 && state.active.pivotCol !== this.prevActivePivotCol) {
        const dir = state.active.pivotCol - this.prevActivePivotCol;
        this.leanAngle = Math.max(-0.18, Math.min(0.18, this.leanAngle + dir * 0.12));
      }
      this.prevActivePivotCol = state.active.pivotCol;
      // Decay lean toward 0
      this.leanAngle *= 0.88;
      if (Math.abs(this.leanAngle) < 0.002) this.leanAngle = 0;

      const smoothRow = state.active.pivotRow + Math.min(state.fallAccumulator, 0.95);
      const interpFormation = { ...state.active, pivotRow: smoothRow };
      const cells = getAbsoluteCells(interpFormation);
      for (const { row, col, candy } of cells) {
        const screenRow = row - SPAWN_ROWS;
        if (screenRow < -1) continue;
        const x = boardX + col * cellSize + pad;
        const y = boardY + screenRow * cellSize + pad;

        // Apply lean rotation around candy center
        if (this.leanAngle !== 0) {
          ctx.save();
          ctx.translate(x + innerSize / 2, y + innerSize / 2);
          ctx.rotate(this.leanAngle);
          ctx.translate(-(x + innerSize / 2), -(y + innerSize / 2));
        }

        this.drawCandy(ctx, candy, x, y, innerSize);
        // Active piece glow
        const r = innerSize * 0.18;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        this.roundRectStroke(ctx, x, y, innerSize, innerSize, r);

        if (this.leanAngle !== 0) {
          ctx.restore();
        }
      }
    } else {
      this.prevActivePivotCol = -1;
      this.leanAngle = 0;
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
        this.drawStandardCandy(ctx, x, y, size, r, baseColor, lightColor, darkColor, candy.color);
        this.drawHighlightDrift(ctx, x, y, size, candy.id, candy.color);
        break;

      case CandyType.JELLY:
        this.drawJellyCandy(ctx, x, y, size, r, baseColor, lightColor);
        break;

      case CandyType.STICKY:
        this.drawStickyCandy(ctx, x, y, size, r, baseColor, lightColor, darkColor, candy.stickyBonds ?? 0, candy.color);
        this.drawHighlightDrift(ctx, x, y, size, candy.id, candy.color);
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
        this.drawCrackedCandy(ctx, x, y, size, r, baseColor, lightColor, darkColor, candy.crackHits ?? 2, candy.color);
        this.drawHighlightDrift(ctx, x, y, size, candy.id, candy.color);
        break;
    }
  }

  private drawStandardCandy(
    ctx: CanvasRenderingContext2D, x: number, y: number, size: number, r: number,
    base: string, light: string, dark: string, color?: CandyColor,
  ): void {
    const cx = x + size / 2;
    const cy = y + size / 2;

    // Dispatch to unique shape per color
    switch (color) {
      case CandyColor.BLUE:
        this.drawDiamondShape(ctx, cx, cy, size, base, light, dark);
        return;
      case CandyColor.GREEN:
        this.drawOvalShape(ctx, cx, cy, size, base, light, dark);
        return;
      case CandyColor.YELLOW:
        this.drawHexShape(ctx, cx, cy, size, base, light, dark);
        return;
      case CandyColor.PURPLE:
        this.drawDropShape(ctx, cx, cy, size, base, light, dark);
        return;
      default:
        // RED and fallback: classic rounded square
        break;
    }

    // RED: rounded square (hard candy)
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

  /** BLUE: diamond/rhombus — crystal candy */
  private drawDiamondShape(
    ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number,
    base: string, light: string, dark: string,
  ): void {
    const hr = size * 0.46; // half-radius
    const softR = size * 0.06; // corner softness

    const diamond = () => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - hr);
      ctx.quadraticCurveTo(cx + softR, cy - hr + softR, cx + hr, cy);
      ctx.quadraticCurveTo(cx + hr - softR, cy + softR, cx, cy + hr);
      ctx.quadraticCurveTo(cx - softR, cy + hr - softR, cx - hr, cy);
      ctx.quadraticCurveTo(cx - hr + softR, cy - softR, cx, cy - hr);
      ctx.closePath();
    };

    // Shadow
    ctx.save();
    ctx.translate(2, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    diamond();
    ctx.fill();
    ctx.restore();

    // Body
    ctx.fillStyle = base;
    diamond();
    ctx.fill();

    // Top-half highlight
    ctx.save();
    diamond();
    ctx.clip();
    const hlGrad = ctx.createLinearGradient(cx, cy - hr, cx, cy);
    hlGrad.addColorStop(0, light);
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = hlGrad;
    ctx.fillRect(cx - hr, cy - hr, hr * 2, hr);
    ctx.restore();
    ctx.globalAlpha = 1;

    // Specular band
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - hr * 0.35, size * 0.08, size * 0.18, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /** GREEN: oval jellybean */
  private drawOvalShape(
    ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number,
    base: string, light: string, dark: string,
  ): void {
    const rx = size * 0.46;
    const ry = size * 0.38;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Top highlight
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    const hlGrad = ctx.createLinearGradient(cx, cy - ry, cx, cy);
    hlGrad.addColorStop(0, light);
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = hlGrad;
    ctx.fillRect(cx - rx, cy - ry, rx * 2, ry);
    ctx.restore();
    ctx.globalAlpha = 1;

    // Translucent jelly gloss
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.25, cy - ry * 0.3, size * 0.14, size * 0.08, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** YELLOW: hexagon — glazed citrus tablet */
  private drawHexShape(
    ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number,
    base: string, light: string, dark: string,
  ): void {
    const hr = size * 0.44;

    const hexPath = (ox = 0, oy = 0) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const hx = cx + ox + Math.cos(angle) * hr;
        const hy = cy + oy + Math.sin(angle) * hr;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
    };

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    hexPath(2, 2);
    ctx.fill();

    // Body
    ctx.fillStyle = base;
    hexPath();
    ctx.fill();

    // Top highlight
    ctx.save();
    hexPath();
    ctx.clip();
    const hlGrad = ctx.createLinearGradient(cx, cy - hr, cx, cy);
    hlGrad.addColorStop(0, light);
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = hlGrad;
    ctx.fillRect(cx - hr, cy - hr, hr * 2, hr);
    ctx.restore();
    ctx.globalAlpha = 1;

    // Golden gloss
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx - hr * 0.2, cy - hr * 0.25, size * 0.12, size * 0.07, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  /** PURPLE: teardrop — grape gummy */
  private drawDropShape(
    ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number,
    base: string, light: string, dark: string,
  ): void {
    const r = size * 0.38;

    const dropPath = (ox = 0, oy = 0) => {
      ctx.beginPath();
      // Bottom circle
      ctx.arc(cx + ox, cy + oy + r * 0.15, r, 0.5, Math.PI - 0.5, false);
      // Narrowing top — quadratic to a point
      ctx.quadraticCurveTo(cx + ox - r * 0.3, cy + oy - r * 0.7, cx + ox, cy + oy - r * 1.1);
      ctx.quadraticCurveTo(cx + ox + r * 0.3, cy + oy - r * 0.7, cx + ox + r * Math.cos(0.5), cy + oy + r * 0.15 + r * Math.sin(0.5));
      ctx.closePath();
    };

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    dropPath(2, 2);
    ctx.fill();

    // Body
    ctx.fillStyle = base;
    dropPath();
    ctx.fill();

    // Top highlight
    ctx.save();
    dropPath();
    ctx.clip();
    const hlGrad = ctx.createLinearGradient(cx, cy - r, cx, cy);
    hlGrad.addColorStop(0, light);
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = hlGrad;
    ctx.fillRect(cx - r, cy - r * 1.1, r * 2, r * 1.1);
    ctx.restore();
    ctx.globalAlpha = 1;

    // Glitter gloss
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.15, cy - r * 0.4, size * 0.1, size * 0.06, -0.4, 0, Math.PI * 2);
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
    base: string, light: string, dark: string, bonds: number, color?: CandyColor,
  ): void {
    // Standard candy base (with unique shape)
    this.drawStandardCandy(ctx, x, y, size, r, base, light, dark, color);

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
    base: string, light: string, dark: string, hits: number, color?: CandyColor,
  ): void {
    // Normal candy base (with unique shape)
    this.drawStandardCandy(ctx, x, y, size, r, base, light, dark, color);

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

  /** Drifting specular highlight clipped inside the actual candy shape */
  private drawHighlightDrift(
    ctx: CanvasRenderingContext2D, x: number, y: number, size: number, candyId: number, color: CandyColor,
  ): void {
    const phase = this.dangerPulse * 0.7 + candyId * 1.618;
    const gx = x + size * (0.5 + Math.sin(phase) * 0.18);
    const gy = y + size * (0.35 + Math.cos(phase * 0.8) * 0.12);
    const alpha = 0.15 + Math.abs(Math.sin(phase)) * 0.15;

    const cx = x + size / 2;
    const cy = y + size / 2;

    ctx.save();
    ctx.beginPath();

    switch (color) {
      case CandyColor.BLUE: {
        // Diamond clip
        const hr = size * 0.46;
        const softR = size * 0.06;
        ctx.moveTo(cx, cy - hr);
        ctx.quadraticCurveTo(cx + softR, cy - hr + softR, cx + hr, cy);
        ctx.quadraticCurveTo(cx + hr - softR, cy + softR, cx, cy + hr);
        ctx.quadraticCurveTo(cx - softR, cy + hr - softR, cx - hr, cy);
        ctx.quadraticCurveTo(cx - hr + softR, cy - softR, cx, cy - hr);
        break;
      }
      case CandyColor.GREEN: {
        // Oval clip
        const rx = size * 0.46;
        const ry = size * 0.38;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        break;
      }
      case CandyColor.YELLOW: {
        // Hex clip
        const hr = size * 0.44;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
          const hx = cx + Math.cos(angle) * hr;
          const hy = cy + Math.sin(angle) * hr;
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        break;
      }
      case CandyColor.PURPLE: {
        // Teardrop clip
        const r = size * 0.38;
        ctx.arc(cx, cy + r * 0.15, r, 0.5, Math.PI - 0.5, false);
        ctx.quadraticCurveTo(cx - r * 0.3, cy - r * 0.7, cx, cy - r * 1.1);
        ctx.quadraticCurveTo(cx + r * 0.3, cy - r * 0.7, cx + r * Math.cos(0.5), cy + r * 0.15 + r * Math.sin(0.5));
        break;
      }
      default: {
        // RED: rounded rect clip
        const r = size * 0.18;
        const m = 2;
        ctx.moveTo(x + m + r, y + m);
        ctx.lineTo(x + size - m - r, y + m);
        ctx.quadraticCurveTo(x + size - m, y + m, x + size - m, y + m + r);
        ctx.lineTo(x + size - m, y + size - m - r);
        ctx.quadraticCurveTo(x + size - m, y + size - m, x + size - m - r, y + size - m);
        ctx.lineTo(x + m + r, y + size - m);
        ctx.quadraticCurveTo(x + m, y + size - m, x + m, y + size - m - r);
        ctx.lineTo(x + m, y + m + r);
        ctx.quadraticCurveTo(x + m, y + m, x + m + r, y + m);
        break;
      }
    }

    ctx.closePath();
    ctx.clip();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(gx, gy, size * 0.13, size * 0.07, phase * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private updateAndDrawParallax(
    ctx: CanvasRenderingContext2D,
    cam: Camera,
    dt: number,
    dangerLevel: number,
  ): void {
    this.parallaxTime += dt;
    // Danger intensifies near layer speed and alpha
    const dangerBoost = Math.max(0, dangerLevel - 0.3) * 1.5;

    for (let li = 0; li < this.parallaxLayers.length; li++) {
      const layer = this.parallaxLayers[li];
      const isNear = li === 2;
      const isFar = li === 0;
      const speedMul = layer.speedMultiplier * (1 + (isNear ? dangerBoost : 0));

      for (const p of layer.items) {
        // Drift upward
        p.y -= p.baseSpeed * speedMul * dt * 0.06;
        // Gentle horizontal sway
        p.x += Math.sin(this.parallaxTime * 0.0005 + p.seed) * 0.02 * dt * 0.06;

        // Wrap around
        if (p.y < -p.size - 10) {
          p.y = cam.logicalH + p.size + Math.random() * 20;
          p.x = Math.random() * cam.logicalW;
        }
        if (p.x < -p.size - 10) p.x = cam.logicalW + p.size;
        if (p.x > cam.logicalW + p.size + 10) p.x = -p.size;

        const alphaBoost = isNear ? dangerBoost * 0.3 : 0;
        ctx.globalAlpha = Math.min(0.25, p.alpha + alphaBoost);
        ctx.fillStyle = p.color;

        if (isFar) {
          // Far layer: hexagonal shapes
          this.drawHexagon(ctx, p.x, p.y, p.size * 0.5);
        } else if (isNear) {
          // Near layer: light streaks
          const streakLen = p.size * (2 + dangerBoost);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.size * 0.3, p.y + streakLen);
          ctx.lineTo(p.x - p.size * 0.3, p.y + streakLen);
          ctx.closePath();
          ctx.fill();
        } else {
          // Mid layer: bokeh circles
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
          // Inner highlight
          ctx.globalAlpha = ctx.globalAlpha * 0.4;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x - p.size * 0.15, p.y - p.size * 0.15, p.size * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
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
    const { cellSize, boardX, boardY } = cam;
    const fontSize = Math.max(14, cellSize * 0.35);
    const boardRight = boardX + COLS * cellSize;
    const boardH = ROWS * cellSize;

    // Pause button — left side of HUD
    const pauseS = Math.max(20, cellSize * 0.5);
    const pauseX = boardX + 4;
    const pauseY = HUD_HEIGHT / 2 - pauseS / 2 - 8;
    this.pauseBtnRect = { x: pauseX - 6, y: pauseY - 6, w: pauseS + 12, h: pauseS + 12 };

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    this.roundRectFill(ctx, pauseX - 6, pauseY - 6, pauseS + 12, pauseS + 12, 6);
    // Two vertical bars
    ctx.fillStyle = '#aaaaaa';
    const barW = pauseS * 0.22;
    const barH = pauseS * 0.7;
    const barY = pauseY + (pauseS - barH) / 2;
    this.roundRectFill(ctx, pauseX + pauseS * 0.22, barY, barW, barH, 2);
    this.roundRectFill(ctx, pauseX + pauseS * 0.56, barY, barW, barH, 2);

    // Score with subtle shadow — to the right of pause button
    const scoreX = pauseX + pauseS + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = `700 ${fontSize}px ${F_UI}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${state.score}`, scoreX + 1, HUD_HEIGHT / 2 - 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Score: ${state.score}`, scoreX, HUD_HEIGHT / 2 - 8);

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
      const ps = Math.floor(cellSize * 0.4);

      // Compute bounding box of the formation to center it in the preview
      const previewCells = getAbsoluteCells({
        ...state.next,
        pivotRow: 0,
        pivotCol: 0,
      });
      let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
      for (const { row, col } of previewCells) {
        if (row < minR) minR = row;
        if (row > maxR) maxR = row;
        if (col < minC) minC = col;
        if (col > maxC) maxC = col;
      }
      const bboxW = (maxC - minC + 1) * ps + 8;
      const bboxH = (maxR - minR + 1) * ps + 8;
      const boxW = Math.max(bboxW, ps * 2 + 14);
      const boxH = Math.max(bboxH, ps * 2 + 14);

      const previewX = meterX + meterW + 12;
      const previewY = 6;

      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      this.roundRectFill(ctx, previewX - 4, previewY - 4, boxW, boxH, 6);

      ctx.fillStyle = '#555555';
      ctx.font = `400 ${fontSize * 0.6}px ${F_UI}`;
      ctx.textAlign = 'left';
      ctx.fillText('NEXT', previewX - 4, previewY + boxH + 4);

      // Center cells within the preview box
      const offsetX = previewX + (boxW - 8 - (maxC - minC + 1) * ps) / 2;
      const offsetY = previewY + (boxH - 8 - (maxR - minR + 1) * ps) / 2;
      for (const { row, col, candy } of previewCells) {
        const px = offsetX + (col - minC) * ps + 1;
        const py = offsetY + (row - minR) * ps + 1;
        this.drawCandy(ctx, candy, px, py, ps - 2);
      }
    }

    // Ability touch button — below the board, centered
    const btnW = Math.min(140, cam.logicalW * 0.35);
    const btnH = 44;
    const btnX = cam.logicalW / 2 - btnW / 2;
    const btnY = boardY + boardH + 8;
    this.abilityBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };

    if (state.abilityReady) {
      // Pulsing glow when ready
      const pulse = 0.7 + Math.sin(this.dangerPulse * 4) * 0.3;
      ctx.fillStyle = `rgba(34,204,136,${0.15 + pulse * 0.1})`;
      this.roundRectFill(ctx, btnX - 3, btnY - 3, btnW + 6, btnH + 6, 12);
      const grad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
      grad.addColorStop(0, '#22cc88');
      grad.addColorStop(1, '#18a070');
      ctx.fillStyle = grad;
      this.roundRectFill(ctx, btnX, btnY, btnW, btnH, 9);
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.max(16, btnH * 0.4)}px ${F_ACTION}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SUGAR BURST', btnX + btnW / 2, btnY + btnH / 2);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      this.roundRectFill(ctx, btnX, btnY, btnW, btnH, 9);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      this.roundRectStroke(ctx, btnX, btnY, btnW, btnH, 9);
      ctx.fillStyle = '#444444';
      ctx.font = `600 ${Math.max(14, btnH * 0.35)}px ${F_UI}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ABILITY', btnX + btnW / 2, btnY + btnH / 2);
    }

    ctx.textAlign = 'left';
  }

  // Ability button hit-test rect (in logical pixels)
  private abilityBtnRect = { x: 0, y: 0, w: 0, h: 0 };
  // Pause button hit-test rect
  private pauseBtnRect = { x: 0, y: 0, w: 0, h: 0 };

  hitTestAbilityButton(px: number, py: number): boolean {
    const r = this.abilityBtnRect;
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  hitTestPauseButton(px: number, py: number): boolean {
    const r = this.pauseBtnRect;
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  drawPauseOverlay(ctx: CanvasRenderingContext2D, cam: Camera): void {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, cam.logicalW, cam.logicalH);

    const cx = cam.logicalW / 2;
    const cy = cam.logicalH / 2;
    const s = Math.min(28, cam.logicalW * 0.06);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${s * 2}px ${F_ACTION}`;
    ctx.fillText('PAUSED', cx, cy - s * 1.5);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = `400 ${s * 0.7}px ${F_UI}`;
    ctx.fillText('Tap to resume', cx, cy + s);

    ctx.textAlign = 'left';
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
