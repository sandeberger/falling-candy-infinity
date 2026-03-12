import { describe, it, expect } from 'vitest';
import { createBoard, findMatches, removeMatchesWithEffects, setCell, getCell, explodeBomb, tickBombs, applyGravity } from '../src/core/board.js';
import { CandyColor, CandyType, type Candy } from '../src/core/state.js';
import { TOTAL_ROWS, COLS } from '../src/config.js';

let nextId = 1000;
function candy(color: CandyColor, type: CandyType, row: number, col: number): Candy {
  const c: Candy = { id: nextId++, color, type, row, col, visualRow: row, visualCol: col };
  if (type === CandyType.BOMB) c.bombTimer = 3;
  if (type === CandyType.CRACKED) c.crackHits = 2;
  if (type === CandyType.LOCKED) c.locked = true;
  return c;
}

describe('Prism (wildcard) matching', () => {
  it('prism matches adjacent any-color candies', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 1;
    setCell(board, r, 0, candy(CandyColor.RED, CandyType.STANDARD, r, 0));
    setCell(board, r, 1, candy(CandyColor.BLUE, CandyType.PRISM, r, 1));
    setCell(board, r, 2, candy(CandyColor.RED, CandyType.STANDARD, r, 2));
    const groups = findMatches(board);
    expect(groups.length).toBe(1);
    expect(groups[0].length).toBe(3);
  });
});

describe('Locked candy', () => {
  it('locked candy is not matched', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 1;
    setCell(board, r, 0, candy(CandyColor.RED, CandyType.STANDARD, r, 0));
    setCell(board, r, 1, candy(CandyColor.RED, CandyType.LOCKED, r, 1));
    setCell(board, r, 2, candy(CandyColor.RED, CandyType.STANDARD, r, 2));
    const groups = findMatches(board);
    expect(groups.length).toBe(0);
  });

  it('locked candy is unlocked when adjacent match clears', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 1;
    // 3 reds horizontally
    setCell(board, r, 0, candy(CandyColor.RED, CandyType.STANDARD, r, 0));
    setCell(board, r, 1, candy(CandyColor.RED, CandyType.STANDARD, r, 1));
    setCell(board, r, 2, candy(CandyColor.RED, CandyType.STANDARD, r, 2));
    // Locked blue adjacent
    const locked = candy(CandyColor.BLUE, CandyType.LOCKED, r, 3);
    setCell(board, r, 3, locked);

    const groups = findMatches(board);
    expect(groups.length).toBe(1);
    const result = removeMatchesWithEffects(board, groups);
    expect(result.unlockedCount).toBe(1);
    expect(locked.locked).toBe(false);
    expect(locked.type).toBe(CandyType.STANDARD);
  });
});

describe('Cracked candy', () => {
  it('cracked candy takes 2 hits to break', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 1;
    // 3 reds
    setCell(board, r, 0, candy(CandyColor.RED, CandyType.STANDARD, r, 0));
    setCell(board, r, 1, candy(CandyColor.RED, CandyType.STANDARD, r, 1));
    setCell(board, r, 2, candy(CandyColor.RED, CandyType.STANDARD, r, 2));
    // Cracked adjacent
    const cracked = candy(CandyColor.GREEN, CandyType.CRACKED, r, 3);
    setCell(board, r, 3, cracked);

    const groups = findMatches(board);
    const result = removeMatchesWithEffects(board, groups);
    expect(result.crackedCount).toBe(1);
    expect(cracked.crackHits).toBe(1);
    // Cracked candy should still be on board (1 hit remaining)
    expect(getCell(board, r, 3)).toBe(cracked);
  });
});

describe('Bomb candy', () => {
  it('tickBombs decrements timer and returns expired', () => {
    const board = createBoard();
    const bomb = candy(CandyColor.RED, CandyType.BOMB, TOTAL_ROWS - 1, 0);
    bomb.bombTimer = 1;
    setCell(board, TOTAL_ROWS - 1, 0, bomb);

    const expired = tickBombs(board);
    expect(expired.length).toBe(1);
    expect(expired[0]).toBe(bomb);
  });

  it('explodeBomb clears 3x3 area', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 2;
    const c = 4;
    // Fill 3x3 around bomb position
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        setCell(board, r + dr, c + dc, candy(CandyColor.RED, CandyType.STANDARD, r + dr, c + dc));
      }
    }
    const bomb = candy(CandyColor.RED, CandyType.BOMB, r, c);
    setCell(board, r, c, bomb);

    const destroyed = explodeBomb(board, bomb);
    expect(destroyed).toBe(9);
    // All 3x3 should be null
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        expect(getCell(board, r + dr, c + dc)).toBeNull();
      }
    }
  });
});

describe('Jelly candy', () => {
  it('jelly clears adjacent candies when matched', () => {
    const board = createBoard();
    const r = TOTAL_ROWS - 1;
    // 3 jelly reds
    setCell(board, r, 0, candy(CandyColor.RED, CandyType.JELLY, r, 0));
    setCell(board, r, 1, candy(CandyColor.RED, CandyType.JELLY, r, 1));
    setCell(board, r, 2, candy(CandyColor.RED, CandyType.JELLY, r, 2));
    // Adjacent candy that should also be cleared by jelly
    setCell(board, r, 3, candy(CandyColor.BLUE, CandyType.STANDARD, r, 3));
    setCell(board, r - 1, 0, candy(CandyColor.GREEN, CandyType.STANDARD, r - 1, 0));

    const groups = findMatches(board);
    const result = removeMatchesWithEffects(board, groups);
    expect(result.jellyCleared).toBeGreaterThan(0);
    expect(result.removed).toBeGreaterThan(3);
  });
});
