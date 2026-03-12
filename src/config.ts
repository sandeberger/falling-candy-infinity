export const COLS = 8;
export const ROWS = 14;
export const SPAWN_ROWS = 4;
export const TOTAL_ROWS = ROWS + SPAWN_ROWS; // 18
export const BOARD_SIZE = TOTAL_ROWS * COLS; // 144

export const SIM_HZ = 60;
export const SIM_DT = 1000 / SIM_HZ;

export const LOCK_DELAY_MS = 200;
export const CLEAR_DURATION_MS = 200;
export const INPUT_BUFFER_MAX = 4;

export const INITIAL_FALL_SPEED = 1.0; // rows per second
export const SOFT_DROP_MULTIPLIER = 4;

export const MIN_MATCH_SIZE = 3;
export const INITIAL_COLOR_COUNT = 4;

export const HUD_HEIGHT = 60;
