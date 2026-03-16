import { BOARD_SIZE, INITIAL_FALL_SPEED, SPAWN_ROWS } from '../config.js';
import { createRng } from '../core/rng.js';
import { spawnFormation } from '../core/formation.js';
import { setCell, applyGravity, updateStickyBonds } from '../core/board.js';
import {
  CandyColor, CandyType, PlayState, AppState, GameMode, ChallengePhase,
  createCandy,
  type Candy, type GameState, type ChallengeState, type LevelResult,
} from '../core/state.js';
import type { LevelDefinition } from './level-data.js';

export function placeLevelCandies(state: GameState, level: LevelDefinition): Set<number> {
  const ids = new Set<number>();

  for (const cell of level.cells) {
    const boardRow = cell.row + SPAWN_ROWS;
    let color: CandyColor;
    if (cell.color === 'random') {
      color = Math.floor(state.rng() * level.colorCount) as CandyColor;
    } else {
      color = cell.color;
    }

    const candy = createCandy(color, cell.type, boardRow, cell.col, state);

    // Override bomb timer if level specifies one
    if (cell.type === CandyType.BOMB && level.bombTimerOverride !== undefined) {
      candy.bombTimer = level.bombTimerOverride;
    }

    setCell(state.board, boardRow, cell.col, candy);
    ids.add(candy.id);
  }

  // Apply gravity to settle candies, then update sticky bonds
  applyGravity(state.board);
  updateStickyBonds(state.board);

  return ids;
}

export function createChallengeGameState(
  seed: number,
  level: LevelDefinition,
  previousResults?: LevelResult[],
): GameState {
  const rng = createRng(seed);
  const board: (Candy | null)[] = new Array(BOARD_SIZE).fill(null);

  const state: GameState = {
    board,
    active: null,
    next: null!,
    playState: PlayState.SPAWNING,
    appState: AppState.PLAYING,
    score: 0,
    chain: 0,
    fallSpeed: level.fallSpeed ?? INITIAL_FALL_SPEED,
    colorCount: level.colorCount,
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
    reliefTimer: 0,
    reliefMultiplier: 1.0,
    hitStopTimer: 0,
    hitStopScale: 1.0,
    maxChain: 0,
    playTimeMs: 0,
  };

  // Place level candies
  const targetIds = placeLevelCandies(state, level);

  // Create challenge state
  const challenge: ChallengeState = {
    mode: GameMode.CHALLENGE,
    levelIndex: level.index,
    phase: ChallengePhase.COUNTDOWN,
    countdownTimer: 3000,
    elapsedMs: 0,
    targetCandyIds: targetIds,
    targetCandyCount: targetIds.size,
    remainingTargets: targetIds.size,
    stars: 0,
    levelResults: previousResults ? [...previousResults] : [],
  };

  state.challenge = challenge;

  // Pre-spawn the first next piece
  state.next = spawnFormation(rng, level.colorCount, state);

  return state;
}
