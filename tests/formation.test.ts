import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng.js';
import { CandyColor, CandyType, type Formation, type GameState, PlayState, AppState } from '../src/core/state.js';
import { createBoard, setCell } from '../src/core/board.js';
import {
  spawnFormation,
  getAbsoluteCells,
  canPlace,
  rotateFormation,
  moveFormation,
  moveFormationDown,
  hardDrop,
  placeFormation,
  canSpawn,
} from '../src/core/formation.js';
import { COLS, TOTAL_ROWS, SPAWN_ROWS, INITIAL_FALL_SPEED, INITIAL_COLOR_COUNT } from '../src/config.js';

function makeState(): GameState {
  const rng = createRng(42);
  return {
    board: createBoard(),
    active: null,
    next: null!,
    playState: PlayState.SPAWNING,
    appState: AppState.PLAYING,
    score: 0,
    chain: 0,
    fallSpeed: INITIAL_FALL_SPEED,
    colorCount: INITIAL_COLOR_COUNT,
    lockTimer: 0,
    clearTimer: 0,
    fallAccumulator: 0,
    rng,
    nextCandyId: 0,
    prevPivotRow: 0,
    softDropActive: false,
    screenShake: 0,
    stage: 0,
    stagePhase: 'build',
    ticksInStage: 0,
    events: [],
    abilityCharge: 0,
    abilityReady: false,
    abilityTimer: 0,
    dangerLevel: 0,
    maxChain: 0,
    playTimeMs: 0,
  };
}

function candy(color: CandyColor, row: number, col: number) {
  return { id: row * 100 + col, color, type: CandyType.STANDARD, row, col, visualRow: row, visualCol: col };
}

describe('spawnFormation', () => {
  it('creates a valid formation within spawn zone', () => {
    const state = makeState();
    const f = spawnFormation(state.rng, 4, state);
    expect(f.cells.length).toBeGreaterThanOrEqual(2);
    expect(f.pivotRow).toBeLessThan(SPAWN_ROWS);
    expect(f.pivotCol).toBeGreaterThanOrEqual(0);
    expect(f.pivotCol).toBeLessThan(COLS);
    expect(f.rotation).toBe(0);
  });
});

describe('getAbsoluteCells', () => {
  it('returns correct positions for rotation 0', () => {
    const state = makeState();
    const f: Formation = {
      cells: [
        { dRow: 0, dCol: 0, candy: candy(CandyColor.RED, 0, 0) },
        { dRow: 1, dCol: 0, candy: candy(CandyColor.BLUE, 0, 0) },
      ],
      pivotRow: 5,
      pivotCol: 3,
      rotation: 0,
    };
    const cells = getAbsoluteCells(f);
    expect(cells[0]).toMatchObject({ row: 5, col: 3 });
    expect(cells[1]).toMatchObject({ row: 6, col: 3 });
  });
});

describe('rotation', () => {
  it('rotates through all 4 states', () => {
    const board = createBoard();
    const f: Formation = {
      cells: [
        { dRow: 0, dCol: 0, candy: candy(CandyColor.RED, 0, 0) },
        { dRow: 1, dCol: 0, candy: candy(CandyColor.BLUE, 0, 0) },
      ],
      pivotRow: 10,
      pivotCol: 4,
      rotation: 0,
    };

    let r = rotateFormation(board, f);
    expect(r.rotation).toBe(1);
    r = rotateFormation(board, r);
    expect(r.rotation).toBe(2);
    r = rotateFormation(board, r);
    expect(r.rotation).toBe(3);
    r = rotateFormation(board, r);
    expect(r.rotation).toBe(0);
  });

  it('applies wall kick when rotation blocked at left wall', () => {
    const board = createBoard();
    // PAIR_H at left wall, rotation would put cell at col -1
    const f: Formation = {
      cells: [
        { dRow: 0, dCol: 0, candy: candy(CandyColor.RED, 0, 0) },
        { dRow: 0, dCol: 1, candy: candy(CandyColor.BLUE, 0, 0) },
      ],
      pivotRow: 10,
      pivotCol: 0,
      rotation: 0,
    };
    const r = rotateFormation(board, f);
    // Should succeed with a kick
    expect(r.rotation).not.toBe(0);
  });
});

describe('moveFormation', () => {
  it('moves left and right', () => {
    const board = createBoard();
    const f: Formation = {
      cells: [
        { dRow: 0, dCol: 0, candy: candy(CandyColor.RED, 0, 0) },
      ],
      pivotRow: 10,
      pivotCol: 4,
      rotation: 0,
    };
    const left = moveFormation(board, f, -1);
    expect(left.pivotCol).toBe(3);
    const right = moveFormation(board, f, 1);
    expect(right.pivotCol).toBe(5);
  });

  it('blocks move into wall', () => {
    const board = createBoard();
    const f: Formation = {
      cells: [
        { dRow: 0, dCol: 0, candy: candy(CandyColor.RED, 0, 0) },
      ],
      pivotRow: 10,
      pivotCol: 0,
      rotation: 0,
    };
    const blocked = moveFormation(board, f, -1);
    expect(blocked.pivotCol).toBe(0);
  });

  it('blocks move into existing candy', () => {
    const board = createBoard();
    setCell(board, 10, 5, candy(CandyColor.GREEN, 10, 5));
    const f: Formation = {
      cells: [
        { dRow: 0, dCol: 0, candy: candy(CandyColor.RED, 0, 0) },
      ],
      pivotRow: 10,
      pivotCol: 4,
      rotation: 0,
    };
    const blocked = moveFormation(board, f, 1);
    expect(blocked.pivotCol).toBe(4);
  });
});

describe('moveFormationDown', () => {
  it('moves down when space available', () => {
    const board = createBoard();
    const f: Formation = {
      cells: [
        { dRow: 0, dCol: 0, candy: candy(CandyColor.RED, 0, 0) },
      ],
      pivotRow: 10,
      pivotCol: 4,
      rotation: 0,
    };
    const { formation, landed } = moveFormationDown(board, f);
    expect(landed).toBe(false);
    expect(formation.pivotRow).toBe(11);
  });

  it('lands at floor', () => {
    const board = createBoard();
    const f: Formation = {
      cells: [
        { dRow: 0, dCol: 0, candy: candy(CandyColor.RED, 0, 0) },
      ],
      pivotRow: TOTAL_ROWS - 1,
      pivotCol: 4,
      rotation: 0,
    };
    const { formation, landed } = moveFormationDown(board, f);
    expect(landed).toBe(true);
    expect(formation.pivotRow).toBe(TOTAL_ROWS - 1);
  });
});

describe('hardDrop', () => {
  it('drops to bottom of empty board', () => {
    const board = createBoard();
    const f: Formation = {
      cells: [
        { dRow: 0, dCol: 0, candy: candy(CandyColor.RED, 0, 0) },
      ],
      pivotRow: 0,
      pivotCol: 4,
      rotation: 0,
    };
    const dropped = hardDrop(board, f);
    expect(dropped.pivotRow).toBe(TOTAL_ROWS - 1);
  });

  it('stops above existing candy', () => {
    const board = createBoard();
    setCell(board, TOTAL_ROWS - 1, 4, candy(CandyColor.GREEN, TOTAL_ROWS - 1, 4));
    const f: Formation = {
      cells: [
        { dRow: 0, dCol: 0, candy: candy(CandyColor.RED, 0, 0) },
      ],
      pivotRow: 0,
      pivotCol: 4,
      rotation: 0,
    };
    const dropped = hardDrop(board, f);
    expect(dropped.pivotRow).toBe(TOTAL_ROWS - 2);
  });
});

describe('placeFormation', () => {
  it('writes candies to board', () => {
    const board = createBoard();
    const f: Formation = {
      cells: [
        { dRow: 0, dCol: 0, candy: candy(CandyColor.RED, 0, 0) },
        { dRow: 1, dCol: 0, candy: candy(CandyColor.BLUE, 0, 0) },
      ],
      pivotRow: 10,
      pivotCol: 4,
      rotation: 0,
    };
    placeFormation(board, f);
    expect(board[10 * COLS + 4]).not.toBeNull();
    expect(board[11 * COLS + 4]).not.toBeNull();
  });
});

describe('canSpawn', () => {
  it('returns true on empty board', () => {
    const board = createBoard();
    const state = makeState();
    const f = spawnFormation(state.rng, 4, state);
    expect(canSpawn(board, f)).toBe(true);
  });

  it('returns false when spawn zone is blocked', () => {
    const board = createBoard();
    // Fill entire spawn zone
    for (let r = 0; r < SPAWN_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        setCell(board, r, c, candy(CandyColor.RED, r, c));
      }
    }
    const state = makeState();
    const f = spawnFormation(state.rng, 4, state);
    expect(canSpawn(board, f)).toBe(false);
  });
});
