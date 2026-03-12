import { describe, it, expect } from 'vitest';
import { createBoard, getIndex, getRowCol, isInBounds, getCell, setCell, applyGravity } from '../src/core/board.js';
import { CandyColor, CandyType } from '../src/core/state.js';
import { COLS, TOTAL_ROWS, BOARD_SIZE } from '../src/config.js';

function candy(color: CandyColor, row: number, col: number) {
  return { id: row * 100 + col, color, type: CandyType.STANDARD, row, col, visualRow: row, visualCol: col };
}

describe('createBoard', () => {
  it('creates a board of BOARD_SIZE nulls', () => {
    const board = createBoard();
    expect(board.length).toBe(BOARD_SIZE);
    expect(board.every((c) => c === null)).toBe(true);
  });
});

describe('getIndex / getRowCol', () => {
  it('converts row,col to index and back', () => {
    expect(getIndex(0, 0)).toBe(0);
    expect(getIndex(2, 3)).toBe(2 * COLS + 3);
    expect(getRowCol(getIndex(5, 7))).toEqual([5, 7]);
  });
});

describe('isInBounds', () => {
  it('returns true for valid positions', () => {
    expect(isInBounds(0, 0)).toBe(true);
    expect(isInBounds(TOTAL_ROWS - 1, COLS - 1)).toBe(true);
  });
  it('returns false for out-of-bounds', () => {
    expect(isInBounds(-1, 0)).toBe(false);
    expect(isInBounds(0, -1)).toBe(false);
    expect(isInBounds(TOTAL_ROWS, 0)).toBe(false);
    expect(isInBounds(0, COLS)).toBe(false);
  });
});

describe('getCell / setCell', () => {
  it('reads and writes cells', () => {
    const board = createBoard();
    const c = candy(CandyColor.RED, 5, 3);
    setCell(board, 5, 3, c);
    expect(getCell(board, 5, 3)).toBe(c);
  });

  it('returns null for out-of-bounds getCell', () => {
    const board = createBoard();
    expect(getCell(board, -1, 0)).toBeNull();
  });
});

describe('applyGravity', () => {
  it('returns false on empty board', () => {
    const board = createBoard();
    expect(applyGravity(board)).toBe(false);
  });

  it('drops candy to bottom', () => {
    const board = createBoard();
    const c = candy(CandyColor.RED, 5, 3);
    setCell(board, 5, 3, c);
    const moved = applyGravity(board);
    expect(moved).toBe(true);
    expect(getCell(board, 5, 3)).toBeNull();
    expect(getCell(board, TOTAL_ROWS - 1, 3)).toBe(c);
    expect(c.row).toBe(TOTAL_ROWS - 1);
  });

  it('stacks candies properly', () => {
    const board = createBoard();
    const c1 = candy(CandyColor.RED, 0, 0);
    const c2 = candy(CandyColor.BLUE, 5, 0);
    setCell(board, 0, 0, c1);
    setCell(board, 5, 0, c2);
    applyGravity(board);
    expect(getCell(board, TOTAL_ROWS - 1, 0)).toBe(c2);
    expect(getCell(board, TOTAL_ROWS - 2, 0)).toBe(c1);
  });

  it('returns false when already settled', () => {
    const board = createBoard();
    setCell(board, TOTAL_ROWS - 1, 0, candy(CandyColor.RED, TOTAL_ROWS - 1, 0));
    expect(applyGravity(board)).toBe(false);
  });
});
