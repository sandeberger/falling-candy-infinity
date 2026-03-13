export interface DifficultyProfile {
  fallSpeed: number;
  colorCount: number;
  buildTicks: number;
  pressureTicks: number;
  breakTicks: number;
  specialRate: number;   // chance for any special candy
  bombRate: number;      // chance specifically for bomb
  lockedRate: number;    // chance specifically for locked
  stickyRate: number;    // chance specifically for sticky
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

// --- Milestone system ---
export type MilestoneType = 'bomb_rush' | 'lockdown' | 'sticky_swamp' | 'cracked_gauntlet';

const MILESTONE_CYCLE: MilestoneType[] = [
  'bomb_rush',
  'lockdown',
  'sticky_swamp',
  'cracked_gauntlet',
];

export function getMilestone(stage: number): MilestoneType | null {
  if (stage < 5 || stage % 5 !== 0) return null;
  const idx = (Math.floor(stage / 5) - 1) % MILESTONE_CYCLE.length;
  return MILESTONE_CYCLE[idx];
}

export function getMilestoneName(type: MilestoneType): string {
  switch (type) {
    case 'bomb_rush': return 'BOMB RUSH';
    case 'lockdown': return 'LOCKDOWN';
    case 'sticky_swamp': return 'STICKY SWAMP';
    case 'cracked_gauntlet': return 'CRACKED GAUNTLET';
  }
}

export function getDifficulty(stage: number): DifficultyProfile {
  const milestone = getMilestone(stage);

  const base: DifficultyProfile = {
    fallSpeed: clamp(1.0 + stage * 0.15, 1.0, 8.0),
    colorCount: stage < 3 ? 4 : 5,
    buildTicks: Math.max(600 - stage * 20, 300),
    pressureTicks: Math.min(300 + stage * 15, 600),
    breakTicks: Math.max(200 - stage * 5, 100),
    specialRate: clamp(0.05 + stage * 0.02, 0.05, 0.35),
    bombRate: clamp(stage * 0.01, 0, 0.1),
    lockedRate: clamp((stage - 3) * 0.01, 0, 0.08),
    stickyRate: 0,
  };

  // Apply milestone modifiers
  if (milestone === 'bomb_rush') {
    base.bombRate = clamp(base.bombRate * 5, 0.1, 0.3);
  } else if (milestone === 'sticky_swamp') {
    base.stickyRate = 0.25;
    base.specialRate = Math.max(base.specialRate, 0.3);
  }

  return base;
}

export type StagePhase = 'build' | 'pressure' | 'break';

export function getPhaseSpeed(baseFallSpeed: number, phase: StagePhase): number {
  switch (phase) {
    case 'build': return baseFallSpeed;
    case 'pressure': return baseFallSpeed * 1.5;
    case 'break': return baseFallSpeed * 0.7;
  }
}
