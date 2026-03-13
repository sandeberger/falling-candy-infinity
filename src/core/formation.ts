import { COLS, SPAWN_ROWS, TOTAL_ROWS } from '../config.js';
import { randomInt } from './rng.js';
import { CandyColor, CandyType, createCandy, type Candy, type Formation, type GameState } from './state.js';
import { getCell } from './board.js';
import { getDifficulty } from './difficulty.js';

const PAIR_TEMPLATES = [
  // PAIR_V
  [{ dRow: 0, dCol: 0 }, { dRow: 1, dCol: 0 }],
  // PAIR_H
  [{ dRow: 0, dCol: 0 }, { dRow: 0, dCol: 1 }],
];

const TRIO_TEMPLATES = [
  // LINE_3 (vertical line, rotates to horizontal)
  [{ dRow: -1, dCol: 0 }, { dRow: 0, dCol: 0 }, { dRow: 1, dCol: 0 }],
  // L_SHAPE (L pointing right)
  [{ dRow: -1, dCol: 0 }, { dRow: 0, dCol: 0 }, { dRow: 0, dCol: 1 }],
  // J_SHAPE (L pointing left, mirror of L)
  [{ dRow: -1, dCol: 0 }, { dRow: 0, dCol: 0 }, { dRow: 0, dCol: -1 }],
];

function applyRotation(dRow: number, dCol: number, rotation: number): [number, number] {
  switch (rotation % 4) {
    case 0: return [dRow, dCol];
    case 1: return [dCol, -dRow];
    case 2: return [-dRow, -dCol];
    case 3: return [-dCol, dRow];
    default: return [dRow, dCol];
  }
}

export function getAbsoluteCells(formation: Formation): { row: number; col: number; candy: Candy }[] {
  return formation.cells.map((cell) => {
    const [dr, dc] = applyRotation(cell.dRow, cell.dCol, formation.rotation);
    return {
      row: Math.round(formation.pivotRow) + dr,
      col: formation.pivotCol + dc,
      candy: cell.candy,
    };
  });
}

export function canPlace(board: (Candy | null)[], formation: Formation): boolean {
  const cells = getAbsoluteCells(formation);
  for (const { row, col } of cells) {
    if (row < 0 || row >= TOTAL_ROWS || col < 0 || col >= COLS) return false;
    if (getCell(board, row, col) !== null) return false;
  }
  return true;
}

function pickCandyType(rng: () => number, stage: number, dangerLevel: number = 0): CandyType {
  const diff = getDifficulty(stage);

  // At high danger, suppress negative specials (bombs, locked) and boost prism chance
  const dangerSuppress = dangerLevel > 0.5 ? Math.min(0.8, (dangerLevel - 0.5) * 1.6) : 0;
  const effectiveBombRate = diff.bombRate * (1 - dangerSuppress);
  const effectiveLockedRate = diff.lockedRate * (1 - dangerSuppress);
  const effectiveSpecialRate = diff.specialRate * (1 - dangerSuppress * 0.5);
  const effectiveStickyRate = diff.stickyRate * (1 - dangerSuppress * 0.3);

  const roll = rng();

  if (roll < effectiveBombRate) return CandyType.BOMB;
  if (roll < effectiveBombRate + effectiveLockedRate) return CandyType.LOCKED;
  // Milestone sticky override — checked before general special pool
  if (effectiveStickyRate > 0 && roll < effectiveBombRate + effectiveLockedRate + effectiveStickyRate) {
    return CandyType.STICKY;
  }
  if (roll < effectiveSpecialRate) {
    const specials = [CandyType.JELLY, CandyType.STICKY, CandyType.CRACKED];
    const prismChance = 0.15 + dangerSuppress * 0.25;
    if (rng() < prismChance) return CandyType.PRISM;
    return specials[randomInt(rng, 0, specials.length - 1)];
  }

  return CandyType.STANDARD;
}

/**
 * Pick a color biased toward what's already on the board (mercy spawning).
 * At high danger, strongly prefer colors present in the top rows to
 * give the player matchable pieces. The bias is subtle at moderate danger
 * and strong near game over.
 */
function pickMercyColor(rng: () => number, colorCount: number, state: GameState): CandyColor {
  const danger = state.dangerLevel;

  // Below 0.4 danger: fully random
  if (danger < 0.4) {
    return randomInt(rng, 0, colorCount - 1) as CandyColor;
  }

  // Count colors in the top 6 visible rows (rows SPAWN_ROWS to SPAWN_ROWS+5)
  const colorCounts = new Array(colorCount).fill(0);
  for (let row = SPAWN_ROWS; row < SPAWN_ROWS + 6; row++) {
    for (let col = 0; col < COLS; col++) {
      const candy = getCell(state.board, row, col);
      if (candy && candy.color < colorCount) {
        colorCounts[candy.color]++;
      }
    }
  }

  const total = colorCounts.reduce((a: number, b: number) => a + b, 0);
  if (total === 0) {
    return randomInt(rng, 0, colorCount - 1) as CandyColor;
  }

  // Mercy strength: 0 at danger=0.4, 0.7 at danger=1.0
  const mercyStrength = Math.min(0.7, (danger - 0.4) / 0.6 * 0.7);

  // Blend between uniform distribution and board-weighted distribution
  if (rng() < mercyStrength) {
    // Weighted pick — favor colors that exist on the board
    let roll = rng() * total;
    for (let c = 0; c < colorCount; c++) {
      roll -= colorCounts[c];
      if (roll <= 0) return c as CandyColor;
    }
    return (colorCount - 1) as CandyColor;
  }

  return randomInt(rng, 0, colorCount - 1) as CandyColor;
}

export function spawnFormation(rng: () => number, colorCount: number, state: GameState): Formation {
  // 3-piece formations appear from stage 3+, increasing chance with stage
  const trioChance = state.stage >= 3 ? Math.min(0.5, (state.stage - 2) * 0.1) : 0;
  const useTrio = rng() < trioChance;
  const pool = useTrio ? TRIO_TEMPLATES : PAIR_TEMPLATES;
  const templateIdx = randomInt(rng, 0, pool.length - 1);
  const template = pool[templateIdx];

  const cells = template.map((offset) => {
    const color = pickMercyColor(rng, colorCount, state);
    const type = pickCandyType(rng, state.stage, state.dangerLevel);
    return {
      dRow: offset.dRow,
      dCol: offset.dCol,
      candy: createCandy(color, type, 0, 0, state),
    };
  });

  return {
    cells,
    pivotRow: SPAWN_ROWS - 2,
    pivotCol: Math.floor(COLS / 2) - 1,
    rotation: 0,
  };
}

export function rotateFormation(board: (Candy | null)[], formation: Formation): Formation {
  const nextRotation = ((formation.rotation + 1) % 4) as 0 | 1 | 2 | 3;
  const rotated: Formation = { ...formation, rotation: nextRotation };

  // Try no kick first
  if (canPlace(board, rotated)) return rotated;

  // Wall kicks: try horizontal shifts ±1, ±2
  for (const dx of [1, -1, 2, -2]) {
    const kicked: Formation = { ...rotated, pivotCol: rotated.pivotCol + dx };
    if (canPlace(board, kicked)) return kicked;
  }

  // Floor kick: try shifting up by 1 (for pieces near bottom)
  const kickUp: Formation = { ...rotated, pivotRow: rotated.pivotRow - 1 };
  if (canPlace(board, kickUp)) return kickUp;

  return formation;
}

export function moveFormation(board: (Candy | null)[], formation: Formation, dCol: number): Formation {
  const moved: Formation = { ...formation, pivotCol: formation.pivotCol + dCol };
  if (canPlace(board, moved)) return moved;
  return formation;
}

export function moveFormationDown(board: (Candy | null)[], formation: Formation): { formation: Formation; landed: boolean } {
  const moved: Formation = { ...formation, pivotRow: formation.pivotRow + 1 };
  if (canPlace(board, moved)) {
    return { formation: moved, landed: false };
  }
  return { formation, landed: true };
}

export function hardDrop(board: (Candy | null)[], formation: Formation): Formation {
  let current = formation;
  for (;;) {
    const next: Formation = { ...current, pivotRow: current.pivotRow + 1 };
    if (!canPlace(board, next)) return current;
    current = next;
  }
}

export function getGhostPosition(board: (Candy | null)[], formation: Formation): number {
  return hardDrop(board, formation).pivotRow;
}

export function placeFormation(board: (Candy | null)[], formation: Formation): void {
  const cells = getAbsoluteCells(formation);
  for (const { row, col, candy } of cells) {
    candy.row = row;
    candy.col = col;
    candy.visualRow = row;
    candy.visualCol = col;
    board[row * COLS + col] = candy;
  }
}

export function canSpawn(board: (Candy | null)[], formation: Formation): boolean {
  return canPlace(board, formation);
}
