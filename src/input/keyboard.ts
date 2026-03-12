import { InputAction, type GameState } from '../core/state.js';
import type { InputBuffer } from './buffer.js';

export function setupKeyboard(buffer: InputBuffer, getState?: () => GameState): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        buffer.push(InputAction.MOVE_LEFT);
        break;
      case 'ArrowRight':
        e.preventDefault();
        buffer.push(InputAction.MOVE_RIGHT);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (getState) {
          getState().softDropActive = true;
        } else {
          buffer.push(InputAction.SOFT_DROP);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        buffer.push(InputAction.ROTATE);
        break;
      case ' ':
        e.preventDefault();
        buffer.push(InputAction.HARD_DROP);
        break;
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' && getState) {
      getState().softDropActive = false;
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
