import { COLS, ROWS, HUD_HEIGHT } from '../config.js';

export interface Camera {
  cellSize: number;
  boardX: number;
  boardY: number;
  dpr: number;
  logicalW: number;
  logicalH: number;
}

const ABILITY_BTN_RESERVE = 56; // space for ability button below board

export function calculateCamera(viewportW: number, viewportH: number): Camera {
  const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
  const cellSize = Math.min(
    Math.floor(viewportW / COLS),
    Math.floor((viewportH - HUD_HEIGHT - ABILITY_BTN_RESERVE) / ROWS),
  );
  const boardW = COLS * cellSize;
  const boardH = ROWS * cellSize;
  const logicalW = viewportW;
  const logicalH = viewportH;
  const boardX = Math.floor((viewportW - boardW) / 2);
  const boardY = HUD_HEIGHT;

  return { cellSize, boardX, boardY, dpr, logicalW, logicalH };
}
