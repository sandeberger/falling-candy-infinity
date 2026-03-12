import type { GameState } from '../core/state.js';

export interface Renderer {
  init(canvas: HTMLCanvasElement): void;
  resize(width: number, height: number): void;
  render(state: GameState, alpha: number, frameDt: number, demoMode?: boolean): void;
  destroy(): void;
}
