import { InputAction } from '../core/state.js';
import type { InputBuffer } from './buffer.js';
import type { GameState } from '../core/state.js';

export class GestureDetector {
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private currentX = 0;
  private currentY = 0;
  private lastCellX = 0;
  private active = false;
  private decidedAxis = false;
  private primaryAxis: 'h' | 'v' | null = null;
  private cleanup: (() => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private buffer: InputBuffer,
    private getCellWidth: () => number,
    private getState: () => GameState,
  ) {
    this.setup();
  }

  private setup(): void {
    const DEADZONE = 10;

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.currentX = e.clientX;
      this.currentY = e.clientY;
      this.startTime = e.timeStamp;
      this.lastCellX = 0;
      this.active = true;
      this.decidedAxis = false;
      this.primaryAxis = null;
      // Start soft drop tracking on touch
      this.getState().softDropActive = false;
    };

    const onMove = (e: PointerEvent) => {
      if (!this.active) return;
      e.preventDefault();

      this.currentX = e.clientX;
      this.currentY = e.clientY;

      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      // Decide primary axis once we exceed deadzone
      if (!this.decidedAxis) {
        if (adx > DEADZONE || ady > DEADZONE) {
          this.decidedAxis = true;
          this.primaryAxis = adx >= ady ? 'h' : 'v';
        } else {
          return;
        }
      }

      // Horizontal drag: always process cell-step moves
      // Works regardless of primary axis — allows steering during soft drop
      const cellW = this.getCellWidth();
      if (cellW > 0) {
        const cellsMoved = Math.round(dx / cellW);
        const delta = cellsMoved - this.lastCellX;
        if (delta > 0) {
          for (let i = 0; i < delta; i++) this.buffer.push(InputAction.MOVE_RIGHT);
          this.lastCellX = cellsMoved;
        } else if (delta < 0) {
          for (let i = 0; i < -delta; i++) this.buffer.push(InputAction.MOVE_LEFT);
          this.lastCellX = cellsMoved;
        }
      }

      // Vertical: set soft drop flag (not buffered action)
      if (this.primaryAxis === 'v' && dy > DEADZONE) {
        this.getState().softDropActive = true;
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!this.active) return;
      this.active = false;

      // Always stop soft drop
      this.getState().softDropActive = false;

      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      const dt = e.timeStamp - this.startTime;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Tap = rotate
      if (!this.decidedAxis && dt < 250 && dist < 15) {
        this.buffer.push(InputAction.ROTATE);
        return;
      }

      // Fast swipe down = hard drop
      if (this.primaryAxis === 'v' && dy > 40) {
        const velocity = dy / Math.max(dt, 1);
        if (velocity > 0.6) {
          this.buffer.push(InputAction.HARD_DROP);
        }
      }
    };

    this.canvas.addEventListener('pointerdown', onDown, { passive: false });
    this.canvas.addEventListener('pointermove', onMove, { passive: false });
    this.canvas.addEventListener('pointerup', onUp);
    this.canvas.addEventListener('pointercancel', onUp);

    this.cleanup = () => {
      this.canvas.removeEventListener('pointerdown', onDown);
      this.canvas.removeEventListener('pointermove', onMove);
      this.canvas.removeEventListener('pointerup', onUp);
      this.canvas.removeEventListener('pointercancel', onUp);
    };
  }

  destroy(): void {
    this.cleanup?.();
  }
}
