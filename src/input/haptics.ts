let enabled = true;

export function setHapticsEnabled(e: boolean): void {
  enabled = e;
}

function vibrate(pattern: number | number[]): void {
  if (!enabled) return;
  try {
    navigator?.vibrate?.(pattern);
  } catch {
    // Not supported
  }
}

export function hapticDrop(): void {
  vibrate(15);
}

export function hapticMatch(): void {
  vibrate([10, 30, 10]);
}

export function hapticChain(depth: number): void {
  vibrate([15, 20, 15, 20, Math.min(depth * 10, 50)]);
}

export function hapticBomb(): void {
  vibrate([30, 15, 40]);
}

export function hapticAbility(): void {
  vibrate([10, 10, 10, 10, 30]);
}

export function hapticGameOver(): void {
  vibrate([50, 30, 80]);
}
