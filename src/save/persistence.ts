const SAVE_KEY = 'candy_save';

export interface SaveData {
  version: number;
  highScore: number;
  bestStage: number;
  bestChain: number;
  totalRuns: number;
  onboardingComplete: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  installPromptDismissed: boolean;
}

const DEFAULT_SAVE: SaveData = {
  version: 1,
  highScore: 0,
  bestStage: 0,
  bestChain: 0,
  totalRuns: 0,
  onboardingComplete: false,
  sfxEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true,
  installPromptDismissed: false,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const data = JSON.parse(raw);
    return { ...DEFAULT_SAVE, ...data };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function updateHighScores(save: SaveData, score: number, stage: number, chain: number): void {
  save.totalRuns++;
  if (score > save.highScore) save.highScore = score;
  if (stage > save.bestStage) save.bestStage = stage;
  if (chain > save.bestChain) save.bestChain = chain;
  writeSave(save);
}
