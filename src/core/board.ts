import { COLS, TOTAL_ROWS, BOARD_SIZE, MIN_MATCH_SIZE } from '../config.js';
import { CandyType, type Candy } from './state.js';

export function createBoard(): (Candy | null)[] {
  return new Array(BOARD_SIZE).fill(null);
}

export function getIndex(row: number, col: number): number {
  return row * COLS + col;
}

export function getRowCol(index: number): [number, number] {
  return [(index / COLS) | 0, index % COLS];
}

export function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < TOTAL_ROWS && col >= 0 && col < COLS;
}

export function getCell(board: (Candy | null)[], row: number, col: number): Candy | null {
  if (!isInBounds(row, col)) return null;
  return board[getIndex(row, col)];
}

export function setCell(board: (Candy | null)[], row: number, col: number, candy: Candy | null): void {
  if (!isInBounds(row, col)) return;
  board[getIndex(row, col)] = candy;
}

function colorsMatch(a: Candy, b: Candy): boolean {
  if (a.type === CandyType.PRISM || b.type === CandyType.PRISM) return true;
  return a.color === b.color;
}

function isMatchable(candy: Candy): boolean {
  if (candy.locked) return false;
  if (candy.type === CandyType.BOMB) return false;
  return true;
}

export function findMatches(board: (Candy | null)[]): Candy[][] {
  const visited = new Uint8Array(BOARD_SIZE);
  const groups: Candy[][] = [];

  for (let i = 0; i < BOARD_SIZE; i++) {
    const candy = board[i];
    if (!candy || visited[i] || !isMatchable(candy)) continue;

    const group: Candy[] = [];
    const stack: number[] = [i];

    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (visited[idx]) continue;

      const c = board[idx];
      if (!c || !isMatchable(c) || !colorsMatch(c, candy)) continue;

      visited[idx] = 1;
      group.push(c);

      const row = (idx / COLS) | 0;
      const col = idx % COLS;

      if (col > 0) stack.push(idx - 1);
      if (col < COLS - 1) stack.push(idx + 1);
      if (row > 0) stack.push(idx - COLS);
      if (row < TOTAL_ROWS - 1) stack.push(idx + COLS);
    }

    if (group.length >= MIN_MATCH_SIZE) {
      groups.push(group);
    }
  }

  return groups;
}

export interface MatchResult {
  removed: number;
  jellyCleared: number;
  unlockedCount: number;
  crackedCount: number;
  bombsTriggered: Candy[];
}

/**
 * Remove matched groups and process special candy effects.
 * Returns details about what happened for scoring/events.
 */
export function removeMatchesWithEffects(board: (Candy | null)[], groups: Candy[][]): MatchResult {
  const result: MatchResult = {
    removed: 0,
    jellyCleared: 0,
    unlockedCount: 0,
    crackedCount: 0,
    bombsTriggered: [],
  };

  const toRemove = new Set<number>();
  const adjacentCells = new Set<number>();

  // Collect all cells to remove + their adjacent cells
  for (const group of groups) {
    for (const candy of group) {
      const idx = getIndex(candy.row, candy.col);
      toRemove.add(idx);

      // Collect adjacent cells for special effects
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = candy.row + dr;
        const nc = candy.col + dc;
        if (isInBounds(nr, nc)) {
          adjacentCells.add(getIndex(nr, nc));
        }
      }

      // Jelly: also clear candies directly above and below
      if (candy.type === CandyType.JELLY) {
        const dirs2 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs2) {
          const nr = candy.row + dr;
          const nc = candy.col + dc;
          if (isInBounds(nr, nc) && board[getIndex(nr, nc)]) {
            toRemove.add(getIndex(nr, nc));
            result.jellyCleared++;
          }
        }
      }
    }
  }

  // Process adjacent effects on non-removed candies
  for (const adjIdx of adjacentCells) {
    if (toRemove.has(adjIdx)) continue;
    const adj = board[adjIdx];
    if (!adj) continue;

    // Unlock locked candies adjacent to matches
    if (adj.type === CandyType.LOCKED && adj.locked) {
      adj.locked = false;
      adj.type = CandyType.STANDARD; // becomes standard once unlocked
      result.unlockedCount++;
    }

    // Crack cracked candies adjacent to matches
    if (adj.type === CandyType.CRACKED && adj.crackHits !== undefined) {
      adj.crackHits--;
      result.crackedCount++;
      if (adj.crackHits <= 0) {
        toRemove.add(adjIdx);
      }
    }

    // Trigger bombs adjacent to matches
    if (adj.type === CandyType.BOMB) {
      result.bombsTriggered.push(adj);
    }
  }

  // Actually remove candies
  for (const idx of toRemove) {
    if (board[idx]) {
      board[idx] = null;
      result.removed++;
    }
  }

  return result;
}

/**
 * Explode a bomb: clear 3x3 area around it.
 * Returns number of candies destroyed.
 */
export function explodeBomb(board: (Candy | null)[], bomb: Candy): number {
  let destroyed = 0;
  // Remove the bomb itself
  const bombIdx = getIndex(bomb.row, bomb.col);
  if (board[bombIdx] === bomb) {
    board[bombIdx] = null;
    destroyed++;
  }
  // 3x3 area
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = bomb.row + dr;
      const c = bomb.col + dc;
      if (isInBounds(r, c)) {
        const idx = getIndex(r, c);
        if (board[idx]) {
          board[idx] = null;
          destroyed++;
        }
      }
    }
  }
  return destroyed;
}

/**
 * Decrement bomb timers. Returns bombs that reached 0.
 */
export function tickBombs(board: (Candy | null)[]): Candy[] {
  const expired: Candy[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const candy = board[i];
    if (candy && candy.type === CandyType.BOMB && candy.bombTimer !== undefined) {
      candy.bombTimer--;
      if (candy.bombTimer <= 0) {
        expired.push(candy);
      }
    }
  }
  return expired;
}

/**
 * Update sticky bonds: connect to adjacent same-type candies.
 */
export function updateStickyBonds(board: (Candy | null)[]): void {
  for (let i = 0; i < BOARD_SIZE; i++) {
    const candy = board[i];
    if (!candy || candy.type !== CandyType.STICKY) continue;

    let bonds = 0;
    const row = (i / COLS) | 0;
    const col = i % COLS;

    // UP=1, RIGHT=2, DOWN=4, LEFT=8
    if (row > 0 && board[i - COLS]?.type === CandyType.STICKY) bonds |= 1;
    if (col < COLS - 1 && board[i + 1]?.type === CandyType.STICKY) bonds |= 2;
    if (row < TOTAL_ROWS - 1 && board[i + COLS]?.type === CandyType.STICKY) bonds |= 4;
    if (col > 0 && board[i - 1]?.type === CandyType.STICKY) bonds |= 8;

    candy.stickyBonds = bonds;
  }
}

// Keep legacy removeMatches for backward compat (tests)
export function removeMatches(board: (Candy | null)[], groups: Candy[][]): number {
  return removeMatchesWithEffects(board, groups).removed;
}

export function applyGravity(board: (Candy | null)[]): boolean {
  let moved = false;

  for (let col = 0; col < COLS; col++) {
    let writeRow = TOTAL_ROWS - 1;

    for (let row = TOTAL_ROWS - 1; row >= 0; row--) {
      const candy = board[getIndex(row, col)];
      if (candy) {
        if (row !== writeRow) {
          board[getIndex(row, col)] = null;
          candy.row = writeRow;
          candy.col = col;
          board[getIndex(writeRow, col)] = candy;
          moved = true;
        }
        writeRow--;
      }
    }
  }

  return moved;
}

/**
 * Calculate danger level: 0.0 (safe) to 1.0 (imminent game over).
 * Based on highest occupied row in visible area.
 */
export function calculateDangerLevel(board: (Candy | null)[]): number {
  // Find highest occupied row
  for (let row = 0; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (board[getIndex(row, col)]) {
        // Row 4 (just at spawn boundary) = danger 1.0
        // Row 17 (bottom) = danger 0.0
        const visibleRow = row - 4; // 0 = top of visible, 13 = bottom
        if (visibleRow < 0) return 1.0;
        return Math.max(0, 1 - visibleRow / 6); // danger zone is top 6 rows
      }
    }
  }
  return 0;
}
