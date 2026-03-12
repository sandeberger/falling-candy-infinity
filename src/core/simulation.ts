import { SIM_DT, LOCK_DELAY_MS, CLEAR_DURATION_MS, SOFT_DROP_MULTIPLIER, COLS, BOARD_SIZE, SPAWN_ROWS } from '../config.js';
import { PlayState, AppState, InputAction, CandyColor, CandyType, type GameState, type GameEvent, type Formation } from './state.js';
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
import { getDifficulty, getPhaseSpeed } from './difficulty.js';
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
    } else if (state.stagePhase === 'pressure') {
      state.stagePhase = 'break';
    } else {
      state.stage++;
      state.stagePhase = 'build';
      const newDiff = getDifficulty(state.stage);
      state.colorCount = newDiff.colorCount;
      emit(state, { type: 'stage_up' });
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
      case InputAction.HARD_DROP:
        state.active = hardDrop(state.board, state.active);
        emitDrop(state);
        placeFormation(state.board, state.active);
        state.active = null;
        state.playState = PlayState.MATCHING;
        state.screenShake = 100;
        return true;
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

  const speed = state.softDropActive ? state.fallSpeed * SOFT_DROP_MULTIPLIER : state.fallSpeed;
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
    const groupData: { row: number; col: number; color: CandyColor }[][] = [];
    for (const group of groups) {
      state.score += group.length * 10 * state.chain;
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
  } else {
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
