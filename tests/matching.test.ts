import { describe, it, expect } from 'vitest';
import { createBoard, findMatches, removeMatches, setCell, getCell } from '../src/core/board.js';
import { CandyColor, CandyType } from '../src/core/state.js';
import { TOTAL_ROWS, COLS } from '../src/config.js';

let nextId = 0;
function candy(color: CandyColor, row: number, col: number) {
  return { id: nextId++, color, type: CandyType.STANDARD, row, col, visualRow: row, visualCol: col };
}

describe('findMatches', () => {
  it('returns empty on empty board', () => {
    const board = createBoard();
    expect(findMatches(board)).toEqual([]);
  });

  it('no match for 2 adjacent same color', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 1;
    setCell(board, r, 0, candy(CandyColor.RED, r, 0));
    setCell(board, r, 1, candy(CandyColor.RED, r, 1));
    expect(findMatches(board)).toEqual([]);
  });

  it('matches 3 horizontal', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 1;
    setCell(board, r, 0, candy(CandyColor.RED, r, 0));
    setCell(board, r, 1, candy(CandyColor.RED, r, 1));
    setCell(board, r, 2, candy(CandyColor.RED, r, 2));
    const groups = findMatches(board);
    expect(groups.length).toBe(1);
    expect(groups[0].length).toBe(3);
  });

  it('matches 3 vertical', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 3;
    setCell(board, r, 0, candy(CandyColor.BLUE, r, 0));
    setCell(board, r + 1, 0, candy(CandyColor.BLUE, r + 1, 0));
    setCell(board, r + 2, 0, candy(CandyColor.BLUE, r + 2, 0));
    const groups = findMatches(board);
    expect(groups.length).toBe(1);
    expect(groups[0].length).toBe(3);
  });

  it('matches L-shape as one group of 5', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 3;
    // Vertical part
    setCell(board, r, 0, candy(CandyColor.GREEN, r, 0));
    setCell(board, r + 1, 0, candy(CandyColor.GREEN, r + 1, 0));
    setCell(board, r + 2, 0, candy(CandyColor.GREEN, r + 2, 0));
    // Horizontal extension
    setCell(board, r + 2, 1, candy(CandyColor.GREEN, r + 2, 1));
    setCell(board, r + 2, 2, candy(CandyColor.GREEN, r + 2, 2));
    const groups = findMatches(board);
    expect(groups.length).toBe(1);
    expect(groups[0].length).toBe(5);
  });

  it('finds separate groups', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 1;
    // Group 1: 3 red
    setCell(board, r, 0, candy(CandyColor.RED, r, 0));
    setCell(board, r, 1, candy(CandyColor.RED, r, 1));
    setCell(board, r, 2, candy(CandyColor.RED, r, 2));
    // Group 2: 3 blue (separated by gap)
    setCell(board, r, 5, candy(CandyColor.BLUE, r, 5));
    setCell(board, r, 6, candy(CandyColor.BLUE, r, 6));
    setCell(board, r, 7, candy(CandyColor.BLUE, r, 7));
    const groups = findMatches(board);
    expect(groups.length).toBe(2);
  });

  it('does not match different colors', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 1;
    setCell(board, r, 0, candy(CandyColor.RED, r, 0));
    setCell(board, r, 1, candy(CandyColor.BLUE, r, 1));
    setCell(board, r, 2, candy(CandyColor.RED, r, 2));
    expect(findMatches(board)).toEqual([]);
  });
});

describe('removeMatches', () => {
  it('removes matched candies and returns count', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 1;
    const c0 = candy(CandyColor.RED, r, 0);
    const c1 = candy(CandyColor.RED, r, 1);
    const c2 = candy(CandyColor.RED, r, 2);
    setCell(board, r, 0, c0);
    setCell(board, r, 1, c1);
    setCell(board, r, 2, c2);
    const groups = findMatches(board);
    const removed = removeMatches(board, groups);
    expect(removed).toBe(3);
    expect(getCell(board, r, 0)).toBeNull();
    expect(getCell(board, r, 1)).toBeNull();
    expect(getCell(board, r, 2)).toBeNull();
  });
});
