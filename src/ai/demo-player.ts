import { COLS, SPAWN_ROWS } from '../config.js';
import { type GameState, type Candy, CandyType } from '../core/state.js';
import { getAbsoluteCells } from '../core/formation.js';
import { InputAction } from '../core/state.js';
import type { InputBuffer } from '../input/buffer.js';

/**
 * Simple AI that plays the game for the attract/demo mode.
 * Deliberately slow and visible — pieces should be seen falling.
 */

let thinkTimer = 0;
let decided = false;
let targetCol = -1;
let targetRot = 0;
let moveTimer = 0;

const THINK_DELAY = 30;    // ticks before deciding where to place
const MOVE_INTERVAL = 8;   // ticks between each move/rotate action

export function resetDemoAI(): void {
  thinkTimer = 0;
  decided = false;
  targetCol = -1;
  targetRot = 0;
  moveTimer = 0;
}

export function demoBotTick(state: GameState, input: InputBuffer): void {
  if (!state.active) {
    // Reset for next piece
    thinkTimer = 0;
    decided = false;
    moveTimer = 0;
    return;
  }

  thinkTimer++;

  // Wait before deciding — let the piece be visible at spawn
  if (!decided && thinkTimer > THINK_DELAY) {
    decided = true;
    const result = pickPlacement(state);
    targetCol = result.col;
    targetRot = result.rot;
    moveTimer = 0;
  }

  if (!decided) return;

  // Act slowly — one action every MOVE_INTERVAL ticks
  moveTimer++;
  if (moveTimer < MOVE_INTERVAL) return;
  moveTimer = 0;

  // Execute rotation first (one step at a time)
  const currentRot = state.active.rotation;
  if (currentRot !== targetRot) {
    input.push(InputAction.ROTATE);
    return;
  }

  // Then move horizontally (one step at a time)
  const currentCol = state.active.pivotCol;
  if (currentCol < targetCol) {
    input.push(InputAction.MOVE_RIGHT);
    return;
  }
  if (currentCol > targetCol) {
    input.push(InputAction.MOVE_LEFT);
    return;
  }

  // In position — just let it fall naturally, no hard drop
  // The piece will land on its own via gravity
}

interface Placement {
  col: number;
  rot: number;
}

function pickPlacement(state: GameState): Placement {
  if (!state.active) return { col: 3, rot: 0 };

  let bestScore = -Infinity;
  let bestCol = state.active.pivotCol;
  let bestRot = 0;

  for (let rot = 0; rot < 4; rot++) {
    for (let col = 0; col < COLS; col++) {
      const score = evaluatePlacement(state, col, rot as 0 | 1 | 2 | 3);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
        bestRot = rot;
      }
    }
  }

  return { col: bestCol, rot: bestRot };
}

function evaluatePlacement(state: GameState, col: number, rot: 0 | 1 | 2 | 3): number {
  if (!state.active) return -1000;

  const testFormation = {
    ...state.active,
    pivotCol: col,
    rotation: rot,
  };

  // Check if formation fits at spawn position
  const cells = getAbsoluteCells(testFormation);
  for (const { row, col: c } of cells) {
    if (row < 0 || row >= 18 || c < 0 || c >= COLS) return -1000;
  }

  // Simulate dropping to find landing position
  let dropRow = testFormation.pivotRow;
  for (let r = dropRow; r < 18; r++) {
    const dropped = { ...testFormation, pivotRow: r + 1 };
    const droppedCells = getAbsoluteCells(dropped);
    let blocked = false;
    for (const { row, col: c } of droppedCells) {
      if (row >= 18 || row < 0 || c < 0 || c >= COLS) { blocked = true; break; }
      if (state.board[row * COLS + c]) { blocked = true; break; }
    }
    if (blocked) {
      dropRow = r;
      break;
    }
  }

  const landedFormation = { ...testFormation, pivotRow: dropRow };
  const landedCells = getAbsoluteCells(landedFormation);

  for (const { row, col: c } of landedCells) {
    if (state.board[row * COLS + c]) return -1000;
  }

  let score = 0;

  // Prefer lower placement
  for (const { row } of landedCells) {
    score += (row - SPAWN_ROWS) * 2;
  }

  // Bonus for adjacent same-color candies
  for (const { row, col: c, candy } of landedCells) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < 18 && nc >= 0 && nc < COLS) {
        const neighbor = state.board[nr * COLS + nc];
        if (neighbor && neighbor.color === candy.color && neighbor.type !== CandyType.LOCKED) {
          score += 15;
        }
      }
    }
  }

  // Penalty for placing high up
  for (const { row } of landedCells) {
    if (row < SPAWN_ROWS + 3) score -= 30;
  }

  // Slight randomness
  score += Math.random() * 5;

  // Prefer columns near center
  const centerDist = Math.abs(col - COLS / 2);
  score -= centerDist * 0.5;

  return score;
}
