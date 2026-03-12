import { COLS, SPAWN_ROWS, TOTAL_ROWS } from '../config.js';
import { randomInt } from './rng.js';
import { CandyColor, CandyType, createCandy, type Candy, type Formation, type GameState } from './state.js';
import { getCell } from './board.js';
import { getDifficulty } from './difficulty.js';

const FORMATION_TEMPLATES = [
  // PAIR_V
  [{ dRow: 0, dCol: 0 }, { dRow: 1, dCol: 0 }],
  // PAIR_H
  [{ dRow: 0, dCol: 0 }, { dRow: 0, dCol: 1 }],
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

function pickCandyType(rng: () => number, stage: number): CandyType {
  const diff = getDifficulty(stage);
  const roll = rng();

  if (roll < diff.bombRate) return CandyType.BOMB;
  if (roll < diff.bombRate + diff.lockedRate) return CandyType.LOCKED;
  if (roll < diff.specialRate) {
    // Pick from special types (not bomb/locked, handled above)
    const specials = [CandyType.JELLY, CandyType.STICKY, CandyType.CRACKED];
    // Prism is rare
    if (rng() < 0.15) return CandyType.PRISM;
    return specials[randomInt(rng, 0, specials.length - 1)];
  }

  return CandyType.STANDARD;
}

export function spawnFormation(rng: () => number, colorCount: number, state: GameState): Formation {
  const templateIdx = randomInt(rng, 0, FORMATION_TEMPLATES.length - 1);
  const template = FORMATION_TEMPLATES[templateIdx];

  const cells = template.map((offset) => {
    const color = randomInt(rng, 0, colorCount - 1) as CandyColor;
    const type = pickCandyType(rng, state.stage);
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

  if (canPlace(board, rotated)) return rotated;

  const kickRight: Formation = { ...rotated, pivotCol: rotated.pivotCol + 1 };
  if (canPlace(board, kickRight)) return kickRight;

  const kickLeft: Formation = { ...rotated, pivotCol: rotated.pivotCol - 1 };
  if (canPlace(board, kickLeft)) return kickLeft;

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
