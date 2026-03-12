import { BOARD_SIZE, INITIAL_COLOR_COUNT, INITIAL_FALL_SPEED } from '../config.js';
import { createRng } from './rng.js';
import { spawnFormation } from './formation.js';
import type { StagePhase } from './difficulty.js';

export enum CandyColor {
  RED = 0,
  BLUE = 1,
  GREEN = 2,
  YELLOW = 3,
  PURPLE = 4,
}

export enum CandyType {
  STANDARD = 0,
  JELLY = 1,
  STICKY = 2,
  BOMB = 3,
  PRISM = 4,
  LOCKED = 5,
  CRACKED = 6,
}

export enum AppState {
  BOOT,
  MENU,
  PLAYING,
  GAME_OVER,
}

export enum PlayState {
  SPAWNING,
  FALLING,
  LOCKING,
  MATCHING,
  CLEARING,
  CASCADING,
  ABILITY_ACTIVE,
}

export enum InputAction {
  MOVE_LEFT,
  MOVE_RIGHT,
  ROTATE,
  SOFT_DROP,
  HARD_DROP,
  ABILITY,
}

export interface Candy {
  id: number;
  color: CandyColor;
  type: CandyType;
  row: number;
  col: number;
  visualRow: number;
  visualCol: number;
  bombTimer?: number;    // countdown for BOMB (decrements each spawn cycle)
  crackHits?: number;    // remaining hits for CRACKED (starts at 2)
  locked?: boolean;      // true for LOCKED
  stickyBonds?: number;  // bitmask: UP=1, RIGHT=2, DOWN=4, LEFT=8
}

export interface Formation {
  cells: { dRow: number; dCol: number; candy: Candy }[];
  pivotRow: number;
  pivotCol: number;
  rotation: 0 | 1 | 2 | 3;
}

export type GameEventType =
  | 'pop' | 'drop' | 'chain' | 'move' | 'rotate'
  | 'game_over' | 'stage_up'
  | 'bomb_explode' | 'jelly_clear' | 'unlock' | 'crack'
  | 'ability_activate' | 'ability_ready' | 'danger';

export interface GameEvent {
  type: GameEventType;
  chain?: number;
  groups?: { row: number; col: number; color: CandyColor }[][];
  row?: number;
  col?: number;
  count?: number;
}

export interface GameState {
  board: (Candy | null)[];
  active: Formation | null;
  next: Formation;
  playState: PlayState;
  appState: AppState;
  score: number;
  chain: number;
  fallSpeed: number;
  colorCount: number;
  lockTimer: number;
  clearTimer: number;
  fallAccumulator: number;
  rng: () => number;
  nextCandyId: number;
  prevPivotRow: number;
  softDropActive: boolean;
  screenShake: number;
  stage: number;
  stagePhase: StagePhase;
  ticksInStage: number;
  events: GameEvent[];
  // Ability
  abilityCharge: number;   // 0.0 – 1.0
  abilityReady: boolean;
  abilityTimer: number;    // ms remaining for ability animation
  // Danger
  dangerLevel: number;     // 0.0 – 1.0
  // Stats
  maxChain: number;
  playTimeMs: number;
}

let globalNextId = 0;

export function createCandy(
  color: CandyColor,
  type: CandyType,
  row: number,
  col: number,
  state?: GameState,
): Candy {
  const id = state ? state.nextCandyId++ : globalNextId++;
  const candy: Candy = { id, color, type, row, col, visualRow: row, visualCol: col };
  if (type === CandyType.BOMB) candy.bombTimer = 8;
  if (type === CandyType.CRACKED) candy.crackHits = 2;
  if (type === CandyType.LOCKED) candy.locked = true;
  if (type === CandyType.STICKY) candy.stickyBonds = 0;
  return candy;
}

export function createInitialGameState(seed: number): GameState {
  const rng = createRng(seed);
  const board: (Candy | null)[] = new Array(BOARD_SIZE).fill(null);
  const colorCount = INITIAL_COLOR_COUNT;

  const tempState: GameState = {
    board,
    active: null,
    next: null!,
    playState: PlayState.SPAWNING,
    appState: AppState.PLAYING,
    score: 0,
    chain: 0,
    fallSpeed: INITIAL_FALL_SPEED,
    colorCount,
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

  tempState.next = spawnFormation(rng, colorCount, tempState);

  return tempState;
}
