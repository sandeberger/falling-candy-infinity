import { SIM_DT } from '../config.js';
import { ChallengePhase, AppState, type GameState, type GameEvent } from '../core/state.js';
import { simulateTick } from '../core/simulation.js';
import type { InputBuffer } from '../input/buffer.js';
import { LEVELS } from './level-data.js';

function emit(state: GameState, event: GameEvent): void {
  state.events.push(event);
}

export function challengeTick(state: GameState, input: InputBuffer): void {
  const ch = state.challenge;
  if (!ch) return;

  switch (ch.phase) {
    case ChallengePhase.COUNTDOWN:
      // Clear any buffered input during countdown
      input.clear();
      state.softDropActive = false;
      state.events.length = 0;
      ch.countdownTimer -= SIM_DT;
      if (ch.countdownTimer <= 0) {
        ch.phase = ChallengePhase.PLAYING;
        ch.countdownTimer = 0;
      }
      return;

    case ChallengePhase.PLAYING:
      ch.elapsedMs += SIM_DT;
      simulateTick(state, input);

      // Check if game ended (topped out)
      if (state.appState === AppState.GAME_OVER) {
        ch.phase = ChallengePhase.FAILED;
        return;
      }

      updateChallengeState(state);
      return;

    case ChallengePhase.VICTORY:
    case ChallengePhase.LEVEL_RESULTS:
    case ChallengePhase.FAILED:
      // Frozen — clear input, no simulation
      input.clear();
      state.events.length = 0;
      return;
  }
}

function updateChallengeState(state: GameState): void {
  const ch = state.challenge;
  if (!ch) return;

  // Count remaining target candies on the board
  let remaining = 0;
  for (const id of ch.targetCandyIds) {
    let found = false;
    for (let i = 0; i < state.board.length; i++) {
      const candy = state.board[i];
      if (candy && candy.id === id) {
        found = true;
        break;
      }
    }
    if (found) remaining++;
  }
  ch.remainingTargets = remaining;

  // Victory check
  if (remaining === 0) {
    ch.phase = ChallengePhase.VICTORY;

    // Calculate stars
    const level = LEVELS[ch.levelIndex];
    if (level) {
      const [s3, s2, s1] = level.starThresholds;
      if (ch.elapsedMs <= s3) {
        ch.stars = 3;
      } else if (ch.elapsedMs <= s2) {
        ch.stars = 2;
      } else if (ch.elapsedMs <= s1) {
        ch.stars = 1;
      } else {
        ch.stars = 1; // always at least 1 star for clearing
      }
    } else {
      ch.stars = 1;
    }

    emit(state, { type: 'level_clear', count: ch.stars });
  }
}
