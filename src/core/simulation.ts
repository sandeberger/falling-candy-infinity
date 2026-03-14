import { SIM_DT, LOCK_DELAY_MS, CLEAR_DURATION_MS, SOFT_DROP_MULTIPLIER, COLS, BOARD_SIZE, SPAWN_ROWS, TOTAL_ROWS } from '../config.js';
import { PlayState, AppState, InputAction, CandyColor, CandyType, createCandy, type GameState, type GameEvent, type Formation } from './state.js';
import { findMatches, removeMatchesWithEffects, applyGravity, explodeBomb, tickBombs, updateStickyBonds, calculateDangerLevel } from './board.js';
import {
  spawnFormation,
  canSpawn,
  moveFormation,
  moveFormationDown,
  rotateFormation,
  hardDrop,
  placeFormation,
  canPlace,
  getAbsoluteCells,
} from './formation.js';
import { getDifficulty, getPhaseSpeed, getMilestone, getMilestoneName } from './difficulty.js';
import type { InputBuffer } from '../input/buffer.js';

function emit(state: GameState, event: GameEvent): void {
  state.events.push(event);
}

export function simulateTick(state: GameState, input: InputBuffer): void {
  if (state.appState !== AppState.PLAYING) return;

  state.events.length = 0;
  const dt = SIM_DT;
  state.playTimeMs += dt;

  // Decay screen shake
  if (state.screenShake > 0) {
    state.screenShake = Math.max(0, state.screenShake - dt);
  }

  // Update danger level
  const prevDanger = state.dangerLevel;
  state.dangerLevel = calculateDangerLevel(state.board);
  if (state.dangerLevel > 0.5 && prevDanger <= 0.5) {
    emit(state, { type: 'danger' });
  }

  // Decay post-chain relief
  if (state.reliefTimer > 0) {
    state.reliefTimer = Math.max(0, state.reliefTimer - dt);
    // Ease back to normal: smooth ramp from reliefMultiplier → 1.0
    const reliefT = state.reliefTimer > 0 ? state.reliefTimer / (state.reliefTimer + 500) : 0;
    state.reliefMultiplier = 1.0 - (1.0 - state.reliefMultiplier) * reliefT;
    if (state.reliefTimer <= 0) state.reliefMultiplier = 1.0;
  }

  // Survival bonus: every 10 seconds, award points based on stage
  const prevSec = Math.floor((state.playTimeMs - dt) / 10000);
  const currSec = Math.floor(state.playTimeMs / 10000);
  if (currSec > prevSec) {
    const survivalBonus = 5 * (state.stage + 1);
    state.score += survivalBonus;
  }

  // Stage tick counter + phase transitions
  state.ticksInStage++;
  updateStagePhase(state);

  // Ability active state
  if (state.playState === PlayState.ABILITY_ACTIVE) {
    handleAbilityActive(state, dt);
    return;
  }

  switch (state.playState) {
    case PlayState.SPAWNING:
      handleSpawning(state, input);
      break;
    case PlayState.FALLING:
      handleFalling(state, input, dt);
      break;
    case PlayState.LOCKING:
      handleLocking(state, input, dt);
      break;
    case PlayState.MATCHING:
      handleMatching(state);
      break;
    case PlayState.CLEARING:
      handleClearing(state, dt);
      break;
    case PlayState.CASCADING:
      handleCascading(state);
      break;
  }
}

function updateStagePhase(state: GameState): void {
  const diff = getDifficulty(state.stage);
  const phaseTicks =
    state.stagePhase === 'build' ? diff.buildTicks :
    state.stagePhase === 'pressure' ? diff.pressureTicks :
    diff.breakTicks;

  if (state.ticksInStage >= phaseTicks) {
    state.ticksInStage = 0;
    if (state.stagePhase === 'build') {
      state.stagePhase = 'pressure';
      emit(state, { type: 'phase_change', text: 'pressure' });
    } else if (state.stagePhase === 'pressure') {
      state.stagePhase = 'break';
      emit(state, { type: 'phase_change', text: 'break' });
    } else {
      state.stage++;
      state.stagePhase = 'build';
      const newDiff = getDifficulty(state.stage);
      state.colorCount = newDiff.colorCount;
      emit(state, { type: 'stage_up' });

      // Check for milestone stage
      const milestone = getMilestone(state.stage);
      if (milestone) {
        emit(state, { type: 'milestone', text: getMilestoneName(milestone) });
        applyMilestoneBoard(state, milestone);
      }
    }
    const d = getDifficulty(state.stage);
    state.fallSpeed = getPhaseSpeed(d.fallSpeed, state.stagePhase);
  }
}

function handleSpawning(state: GameState, input: InputBuffer): void {
  input.clear();
  state.softDropActive = false;

  // Tick bomb timers on each spawn cycle
  const expiredBombs = tickBombs(state.board);
  for (const bomb of expiredBombs) {
    const destroyed = explodeBomb(state.board, bomb);
    state.score += destroyed * 20;
    state.screenShake = 200;
    emit(state, { type: 'bomb_explode', row: bomb.row, col: bomb.col, count: destroyed });
  }
  if (expiredBombs.length > 0) {
    // After bomb explosions, need gravity + matching
    applyGravity(state.board);
  }

  // Update sticky bonds
  updateStickyBonds(state.board);

  state.active = state.next;
  state.next = spawnFormation(state.rng, state.colorCount, state);

  if (!canSpawn(state.board, state.active)) {
    state.appState = AppState.GAME_OVER;
    state.active = null;
    emit(state, { type: 'game_over' });
    return;
  }

  state.prevPivotRow = state.active.pivotRow;
  state.fallAccumulator = 0;
  state.playState = PlayState.FALLING;
}

function processInput(state: GameState, input: InputBuffer): boolean {
  if (!state.active) return false;

  const actions = input.consumeAll();
  for (const action of actions) {
    if (!state.active) return true;
    switch (action) {
      case InputAction.MOVE_LEFT: {
        const prev: Formation | null = state.active;
        state.active = moveFormation(state.board, state.active, -1);
        if (state.active !== prev) emit(state, { type: 'move' });
        break;
      }
      case InputAction.MOVE_RIGHT: {
        const prev: Formation | null = state.active;
        state.active = moveFormation(state.board, state.active, 1);
        if (state.active !== prev) emit(state, { type: 'move' });
        break;
      }
      case InputAction.ROTATE: {
        const prev: Formation | null = state.active;
        state.active = rotateFormation(state.board, state.active);
        if (state.active !== prev) emit(state, { type: 'rotate' });
        break;
      }
      case InputAction.HARD_DROP: {
        const startRow = state.active.pivotRow;
        state.active = hardDrop(state.board, state.active);
        const rowsDropped = state.active.pivotRow - startRow;
        // Precision drop bonus: 2 points per row skipped
        if (rowsDropped > 0) {
          const dropBonus = rowsDropped * 2;
          state.score += dropBonus;
          emit(state, { type: 'drop', row: state.active.pivotRow, col: state.active.pivotCol, count: dropBonus });
        }
        emitDrop(state);
        placeFormation(state.board, state.active);
        state.active = null;
        state.playState = PlayState.MATCHING;
        state.screenShake = 100;
        return true;
      }
      case InputAction.SOFT_DROP:
        state.softDropActive = true;
        break;
      case InputAction.ABILITY:
        if (state.abilityReady) {
          activateAbility(state);
          return true;
        }
        break;
    }
  }
  return false;
}

function handleFalling(state: GameState, input: InputBuffer, dt: number): void {
  if (!state.active) return;

  if (processInput(state, input)) return;
  if (!state.active) return;

  const baseSpeed = state.fallSpeed * state.reliefMultiplier;
  const speed = state.softDropActive ? baseSpeed * SOFT_DROP_MULTIPLIER : baseSpeed;
  state.fallAccumulator += speed * (dt / 1000);

  while (state.active && state.fallAccumulator >= 1) {
    state.fallAccumulator -= 1;
    state.prevPivotRow = state.active.pivotRow;
    const result = moveFormationDown(state.board, state.active);
    state.active = result.formation;
    if (result.landed) {
      state.fallAccumulator = 0;
      state.lockTimer = LOCK_DELAY_MS;
      state.playState = PlayState.LOCKING;
      return;
    }
  }
}

function handleLocking(state: GameState, input: InputBuffer, dt: number): void {
  if (!state.active) return;

  if (processInput(state, input)) return;
  if (!state.active) return;

  // Check if formation now has air under it
  const below = { ...state.active, pivotRow: state.active.pivotRow + 1 };
  if (canPlace(state.board, below)) {
    state.prevPivotRow = state.active.pivotRow;
    state.fallAccumulator = 0;
    state.playState = PlayState.FALLING;
    return;
  }

  state.lockTimer -= dt;
  if (state.lockTimer <= 0) {
    emitDrop(state);
    placeFormation(state.board, state.active);
    state.active = null;
    state.playState = PlayState.MATCHING;
  }
}

function emitDrop(state: GameState): void {
  if (!state.active) return;
  const cells = getAbsoluteCells(state.active);
  for (const { row, col } of cells) {
    emit(state, { type: 'drop', row, col });
  }
}

function handleMatching(state: GameState): void {
  const groups = findMatches(state.board);
  if (groups.length > 0) {
    state.chain++;
    if (state.chain > state.maxChain) state.maxChain = state.chain;
    // Risk multiplier: 1.0 at safe, up to 1.5x at max danger
    const riskMultiplier = 1.0 + Math.max(0, state.dangerLevel - 0.3) * 0.7;
    const groupData: { row: number; col: number; color: CandyColor }[][] = [];
    for (const group of groups) {
      state.score += Math.round(group.length * 10 * state.chain * riskMultiplier);
      groupData.push(group.map(c => ({ row: c.row, col: c.col, color: c.color })));
    }

    const result = removeMatchesWithEffects(state.board, groups);

    // Emit match event
    emit(state, { type: 'pop', chain: state.chain, groups: groupData });
    if (state.chain >= 2) {
      emit(state, { type: 'chain', chain: state.chain });
    }

    // Emit special candy events
    if (result.jellyCleared > 0) {
      emit(state, { type: 'jelly_clear', count: result.jellyCleared });
      state.score += result.jellyCleared * 15;
    }
    if (result.unlockedCount > 0) {
      emit(state, { type: 'unlock', count: result.unlockedCount });
    }
    if (result.crackedCount > 0) {
      emit(state, { type: 'crack', count: result.crackedCount });
    }

    // Process triggered bombs
    for (const bomb of result.bombsTriggered) {
      const destroyed = explodeBomb(state.board, bomb);
      state.score += destroyed * 20;
      state.screenShake = Math.max(state.screenShake, 200);
      emit(state, { type: 'bomb_explode', row: bomb.row, col: bomb.col, count: destroyed });
    }

    // Charge ability from chains
    state.abilityCharge = Math.min(1.0, state.abilityCharge + 0.08 * state.chain);
    if (state.abilityCharge >= 1.0 && !state.abilityReady) {
      state.abilityReady = true;
      emit(state, { type: 'ability_ready' });
    }

    state.clearTimer = CLEAR_DURATION_MS;
    state.playState = PlayState.CLEARING;
    state.screenShake = Math.min(50 + state.chain * 30, 200);

    // Hit stop on big chains: brief slow-motion for dramatic impact
    if (state.chain >= 4) {
      state.hitStopTimer = Math.min(150 + state.chain * 40, 400); // 310ms at 4x, up to 400ms
      state.hitStopScale = Math.max(0.15, 0.4 - state.chain * 0.05); // slower for bigger chains
    }
  } else {
    // Check if board is completely empty — reward with bonus
    if (state.board.every(c => c === null)) {
      const bonus = 500 * state.stage;
      state.score += bonus;
      emit(state, { type: 'board_clear', count: bonus });
    }
    // Grant post-chain relief: bigger chain = longer, stronger relief
    if (state.chain >= 3) {
      state.reliefTimer = Math.min(state.chain * 400, 2000); // up to 2s
      state.reliefMultiplier = Math.max(0.4, 1.0 - state.chain * 0.1); // down to 0.4x speed
    }
    state.chain = 0;
    state.playState = PlayState.SPAWNING;
  }
}

function handleClearing(state: GameState, dt: number): void {
  state.clearTimer -= dt;
  if (state.clearTimer <= 0) {
    state.playState = PlayState.CASCADING;
  }
}

function handleCascading(state: GameState): void {
  applyGravity(state.board);
  updateStickyBonds(state.board);
  state.playState = PlayState.MATCHING;
}

function activateAbility(state: GameState): void {
  state.abilityReady = false;
  state.abilityCharge = 0;
  state.abilityTimer = 400;
  state.playState = PlayState.ABILITY_ACTIVE;

  // Sugar Burst: clear all candies of the most common color
  const colorCounts = new Array(5).fill(0);
  for (let i = 0; i < BOARD_SIZE; i++) {
    const candy = state.board[i];
    if (candy && candy.type !== CandyType.LOCKED) {
      colorCounts[candy.color]++;
    }
  }

  let targetColor = 0;
  let maxCount = 0;
  for (let c = 0; c < 5; c++) {
    if (colorCounts[c] > maxCount) {
      maxCount = colorCounts[c];
      targetColor = c;
    }
  }

  let cleared = 0;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const candy = state.board[i];
    if (candy && candy.color === targetColor && candy.type !== CandyType.LOCKED) {
      state.board[i] = null;
      cleared++;
    }
  }

  state.score += cleared * 25;
  state.screenShake = 250;
  emit(state, { type: 'ability_activate', count: cleared });
}

function handleAbilityActive(state: GameState, dt: number): void {
  state.abilityTimer -= dt;
  if (state.abilityTimer <= 0) {
    applyGravity(state.board);
    state.playState = PlayState.MATCHING;
  }
}

/**
 * Apply board modifications for milestone stages.
 * Lockdown and Cracked Gauntlet pre-fill cells on the board.
 * Bomb Rush and Sticky Swamp modify spawn rates (handled in getDifficulty).
 */
function applyMilestoneBoard(state: GameState, milestone: string): void {
  if (milestone === 'lockdown') {
    // Place 8-12 locked candies across the bottom 2 rows
    const count = 8 + Math.floor(state.rng() * 5);
    const candidates: number[] = [];
    for (let row = TOTAL_ROWS - 2; row < TOTAL_ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col;
        if (!state.board[idx]) candidates.push(idx);
      }
    }
    // Shuffle and pick
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(state.rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const toPlace = Math.min(count, candidates.length);
    for (let i = 0; i < toPlace; i++) {
      const idx = candidates[i];
      const row = Math.floor(idx / COLS);
      const col = idx % COLS;
      const color = Math.floor(state.rng() * state.colorCount) as CandyColor;
      state.board[idx] = createCandy(color, CandyType.LOCKED, row, col, state);
    }
  } else if (milestone === 'cracked_gauntlet') {
    // Place 10-14 cracked candies across the bottom 3 rows
    const count = 10 + Math.floor(state.rng() * 5);
    const candidates: number[] = [];
    for (let row = TOTAL_ROWS - 3; row < TOTAL_ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col;
        if (!state.board[idx]) candidates.push(idx);
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(state.rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const toPlace = Math.min(count, candidates.length);
    for (let i = 0; i < toPlace; i++) {
      const idx = candidates[i];
      const row = Math.floor(idx / COLS);
      const col = idx % COLS;
      const color = Math.floor(state.rng() * state.colorCount) as CandyColor;
      state.board[idx] = createCandy(color, CandyType.CRACKED, row, col, state);
    }
  }
  // bomb_rush and sticky_swamp are handled purely via getDifficulty spawn rates
}
