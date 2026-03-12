export interface DifficultyProfile {
  fallSpeed: number;
  colorCount: number;
  buildTicks: number;
  pressureTicks: number;
  breakTicks: number;
  specialRate: number;   // chance for any special candy
  bombRate: number;      // chance specifically for bomb
  lockedRate: number;    // chance specifically for locked
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function getDifficulty(stage: number): DifficultyProfile {
  return {
    fallSpeed: clamp(1.0 + stage * 0.15, 1.0, 8.0),
    colorCount: stage < 3 ? 4 : 5,
    buildTicks: Math.max(600 - stage * 20, 300),
    pressureTicks: Math.min(300 + stage * 15, 600),
    breakTicks: Math.max(200 - stage * 5, 100),
    specialRate: clamp(0.05 + stage * 0.02, 0.05, 0.35),
    bombRate: clamp(stage * 0.01, 0, 0.1),
    lockedRate: clamp((stage - 3) * 0.01, 0, 0.08),
  };
}

export type StagePhase = 'build' | 'pressure' | 'break';

export function getPhaseSpeed(baseFallSpeed: number, phase: StagePhase): number {
  switch (phase) {
    case 'build': return baseFallSpeed;
    case 'pressure': return baseFallSpeed * 1.5;
    case 'break': return baseFallSpeed * 0.7;
  }
}
