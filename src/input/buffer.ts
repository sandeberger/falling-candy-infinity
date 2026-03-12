import { INPUT_BUFFER_MAX } from '../config.js';
import { InputAction } from '../core/state.js';

export class InputBuffer {
  private actions: InputAction[] = [];

  push(action: InputAction): void {
    if (this.actions.length < INPUT_BUFFER_MAX) {
      this.actions.push(action);
    }
  }

  consume(): InputAction | null {
    return this.actions.shift() ?? null;
  }

  consumeAll(): InputAction[] {
    const all = this.actions.slice();
    this.actions.length = 0;
    return all;
  }

  clear(): void {
    this.actions.length = 0;
  }

  get length(): number {
    return this.actions.length;
  }
}
