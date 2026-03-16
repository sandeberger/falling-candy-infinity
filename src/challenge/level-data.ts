import { CandyColor, CandyType } from '../core/state.js';

export interface CellDef {
  row: number;    // 0-13 visible row (internally +SPAWN_ROWS)
  col: number;    // 0-7
  color: CandyColor | 'random';
  type: CandyType;
}

export interface LevelDefinition {
  index: number;
  name: string;
  description: string;
  cells: CellDef[];
  colorCount: number;
  fallSpeed: number;
  starThresholds: [number, number, number]; // ms for 3-star, 2-star, 1-star
  trioChance?: number;
  bombTimerOverride?: number;
}

const R = CandyColor.RED;
const B = CandyColor.BLUE;
const G = CandyColor.GREEN;
const Y = CandyColor.YELLOW;
const P = CandyColor.PURPLE;
const S = CandyType.STANDARD;
const J = CandyType.JELLY;
const K = CandyType.STICKY;
const BM = CandyType.BOMB;
const PR = CandyType.PRISM;
const L = CandyType.LOCKED;
const CR = CandyType.CRACKED;

// Helper: create a standard cell
function c(row: number, col: number, color: CandyColor, type: CandyType = S): CellDef {
  return { row, col, color, type };
}

export const LEVELS: LevelDefinition[] = [
  // Level 1: First Steps — single row, 3 colors, 8 candies
  {
    index: 0,
    name: 'First Steps',
    description: 'Clear a single row of candies.',
    colorCount: 3,
    fallSpeed: 1.0,
    starThresholds: [40000, 75000, 150000],
    cells: [
      c(13, 0, R), c(13, 1, B), c(13, 2, G), c(13, 3, R),
      c(13, 4, B), c(13, 5, G), c(13, 6, R), c(13, 7, B),
    ],
  },

  // Level 2: Two Tiers — two rows, 3 colors, 16 candies
  {
    index: 1,
    name: 'Two Tiers',
    description: 'Two rows of candy to clear.',
    colorCount: 3,
    fallSpeed: 1.0,
    starThresholds: [50000, 100000, 200000],
    cells: [
      c(12, 0, R), c(12, 1, B), c(12, 2, G), c(12, 3, R),
      c(12, 4, B), c(12, 5, G), c(12, 6, R), c(12, 7, B),
      c(13, 0, G), c(13, 1, R), c(13, 2, B), c(13, 3, G),
      c(13, 4, R), c(13, 5, B), c(13, 6, G), c(13, 7, R),
    ],
  },

  // Level 3: The Pyramid — centered pyramid, 4 colors, ~15 candies
  {
    index: 2,
    name: 'The Pyramid',
    description: 'A pyramid of candy awaits.',
    colorCount: 4,
    fallSpeed: 1.2,
    starThresholds: [50000, 100000, 190000],
    cells: [
      // Top row (1 candy)
      c(10, 3, R), c(10, 4, B),
      // Second row (3 candies)
      c(11, 2, G), c(11, 3, Y), c(11, 4, R), c(11, 5, G),
      // Third row (5 candies)
      c(12, 1, B), c(12, 2, Y), c(12, 3, G), c(12, 4, Y), c(12, 5, B), c(12, 6, R),
      // Bottom row (3 candies)
      c(13, 2, R), c(13, 3, B), c(13, 5, Y),
    ],
  },

  // Level 4: Columns — alternating columns, 4 colors, 12 candies
  {
    index: 3,
    name: 'Columns',
    description: 'Alternating candy columns.',
    colorCount: 4,
    fallSpeed: 1.2,
    starThresholds: [45000, 90000, 165000],
    cells: [
      c(11, 1, R), c(11, 3, B), c(11, 5, G), c(11, 7, Y),
      c(12, 1, B), c(12, 3, G), c(12, 5, Y), c(12, 7, R),
      c(13, 1, G), c(13, 3, Y), c(13, 5, R), c(13, 7, B),
    ],
  },

  // Level 5: Checkerboard — 2-color alternating grid, 16 candies
  {
    index: 4,
    name: 'Checkerboard',
    description: 'A two-color alternating pattern.',
    colorCount: 3,
    fallSpeed: 1.3,
    starThresholds: [60000, 115000, 225000],
    cells: [
      c(12, 0, R), c(12, 1, B), c(12, 2, R), c(12, 3, B),
      c(12, 4, R), c(12, 5, B), c(12, 6, R), c(12, 7, B),
      c(13, 0, B), c(13, 1, R), c(13, 2, B), c(13, 3, R),
      c(13, 4, B), c(13, 5, R), c(13, 6, B), c(13, 7, R),
    ],
  },

  // Level 6: The Diamond — diamond shape, 4 colors, 13 candies
  {
    index: 5,
    name: 'The Diamond',
    description: 'A sparkling diamond formation.',
    colorCount: 4,
    fallSpeed: 1.3,
    starThresholds: [50000, 100000, 190000],
    cells: [
      c(9, 3, R), c(9, 4, B),
      c(10, 2, G), c(10, 3, Y), c(10, 4, R), c(10, 5, G),
      c(11, 1, B), c(11, 3, G), c(11, 4, Y), c(11, 6, R),
      c(12, 2, Y), c(12, 5, B),
      c(13, 3, B), c(13, 4, G),
    ],
  },

  // Level 7: Jelly Surprise — introduces JELLY candies
  {
    index: 6,
    name: 'Jelly Surprise',
    description: 'Jelly candies clear their neighbors!',
    colorCount: 4,
    fallSpeed: 1.3,
    starThresholds: [45000, 90000, 175000],
    cells: [
      c(11, 2, R, J), c(11, 5, B, J),
      c(12, 1, G), c(12, 2, B), c(12, 3, R), c(12, 4, G), c(12, 5, R), c(12, 6, B),
      c(13, 0, R), c(13, 1, B), c(13, 2, G), c(13, 3, Y),
      c(13, 4, B), c(13, 5, G), c(13, 6, R), c(13, 7, Y),
    ],
  },

  // Level 8: The Lock Wall — row of LOCKED protecting standard below
  {
    index: 7,
    name: 'The Lock Wall',
    description: 'Unlock the wall to reach candies below.',
    colorCount: 4,
    fallSpeed: 1.4,
    starThresholds: [60000, 120000, 225000],
    cells: [
      c(11, 1, R, L), c(11, 2, B, L), c(11, 3, G, L), c(11, 4, Y, L),
      c(11, 5, R, L), c(11, 6, B, L),
      c(12, 1, G), c(12, 2, Y), c(12, 3, R), c(12, 4, B), c(12, 5, G), c(12, 6, Y),
      c(13, 1, Y), c(13, 2, R), c(13, 3, B), c(13, 4, G), c(13, 5, Y), c(13, 6, R),
    ],
  },

  // Level 9: Cracked Towers — CRACKED columns requiring 2 hits
  {
    index: 8,
    name: 'Cracked Towers',
    description: 'These cracked candies take two hits!',
    colorCount: 4,
    fallSpeed: 1.4,
    starThresholds: [75000, 140000, 250000],
    cells: [
      c(11, 1, R, CR), c(11, 3, B, CR), c(11, 5, G, CR), c(11, 7, Y, CR),
      c(12, 1, B, CR), c(12, 3, G, CR), c(12, 5, Y, CR), c(12, 7, R, CR),
      c(13, 1, G), c(13, 3, Y), c(13, 5, R), c(13, 7, B),
    ],
  },

  // Level 10: Bomb Defusal — pre-placed BOMBS with long timers
  {
    index: 9,
    name: 'Bomb Defusal',
    description: 'Defuse the bombs before they blow!',
    colorCount: 4,
    fallSpeed: 1.5,
    starThresholds: [50000, 100000, 175000],
    bombTimerOverride: 20,
    cells: [
      c(11, 1, R, BM), c(11, 4, B, BM), c(11, 7, G, BM),
      c(12, 0, G), c(12, 1, B), c(12, 2, R), c(12, 3, G),
      c(12, 4, R), c(12, 5, B), c(12, 6, G), c(12, 7, R),
      c(13, 0, B), c(13, 1, G), c(13, 2, Y), c(13, 3, R),
      c(13, 4, G), c(13, 5, Y), c(13, 6, R), c(13, 7, B),
    ],
  },

  // Level 11: Sticky Swamp — STICKY cluster in center
  {
    index: 10,
    name: 'Sticky Swamp',
    description: 'Sticky candies drag their friends along!',
    colorCount: 4,
    fallSpeed: 1.5,
    starThresholds: [60000, 115000, 215000],
    cells: [
      c(11, 3, R, K), c(11, 4, B, K),
      c(12, 2, G, K), c(12, 3, Y, K), c(12, 4, R, K), c(12, 5, G, K),
      c(13, 2, B), c(13, 3, G), c(13, 4, Y), c(13, 5, R),
      c(13, 0, R), c(13, 1, B), c(13, 6, G), c(13, 7, Y),
    ],
  },

  // Level 12: The Heart — heart shape, ~22 candies
  {
    index: 11,
    name: 'The Heart',
    description: 'A candy heart to clear!',
    colorCount: 5,
    fallSpeed: 1.5,
    starThresholds: [75000, 140000, 250000],
    cells: [
      // Top bumps of heart
      c(8, 1, R), c(8, 2, B), c(8, 5, G), c(8, 6, Y),
      c(9, 0, B), c(9, 1, G), c(9, 2, R), c(9, 3, Y),
      c(9, 4, B), c(9, 5, R), c(9, 6, G), c(9, 7, B),
      // Middle
      c(10, 0, Y), c(10, 1, R), c(10, 6, B), c(10, 7, G),
      c(11, 1, G), c(11, 6, Y),
      c(12, 2, B), c(12, 5, R),
      c(13, 3, Y), c(13, 4, G),
    ],
  },

  // Level 13: Castle Walls — LOCKED battlement wall
  {
    index: 12,
    name: 'Castle Walls',
    description: 'Break through the castle defenses!',
    colorCount: 4,
    fallSpeed: 1.6,
    starThresholds: [90000, 150000, 275000],
    cells: [
      // Battlements (locked)
      c(9, 0, R, L), c(9, 2, B, L), c(9, 4, G, L), c(9, 6, Y, L),
      // Wall (locked)
      c(10, 0, B, L), c(10, 1, G, L), c(10, 2, Y, L), c(10, 3, R, L),
      c(10, 4, B, L), c(10, 5, G, L), c(10, 6, Y, L), c(10, 7, R, L),
      // Inside (standard)
      c(11, 1, R), c(11, 3, B), c(11, 5, G), c(11, 7, Y),
      c(12, 0, G), c(12, 2, Y), c(12, 4, R), c(12, 6, B),
      c(13, 1, B), c(13, 3, G), c(13, 5, Y), c(13, 7, R),
    ],
  },

  // Level 14: Prism Cascade — PRISM candies atop mixed columns
  {
    index: 13,
    name: 'Prism Cascade',
    description: 'Prism candies match any color!',
    colorCount: 5,
    fallSpeed: 1.5,
    starThresholds: [45000, 90000, 165000],
    cells: [
      c(10, 1, R, PR), c(10, 3, B, PR), c(10, 5, G, PR), c(10, 7, Y, PR),
      c(11, 1, B), c(11, 3, G), c(11, 5, Y), c(11, 7, R),
      c(12, 0, G), c(12, 1, Y), c(12, 3, R), c(12, 5, B), c(12, 7, G),
      c(13, 0, R), c(13, 1, G), c(13, 3, Y), c(13, 5, R), c(13, 7, B),
    ],
  },

  // Level 15: The Zigzag — staircase pattern, 14 candies
  {
    index: 14,
    name: 'The Zigzag',
    description: 'Follow the zigzag path!',
    colorCount: 4,
    fallSpeed: 1.6,
    starThresholds: [55000, 105000, 200000],
    cells: [
      c(10, 0, R), c(10, 1, B),
      c(11, 2, G), c(11, 3, Y),
      c(12, 4, R), c(12, 5, B),
      c(13, 6, G), c(13, 7, Y),
      c(11, 6, R), c(11, 7, G),
      c(12, 0, B), c(12, 1, Y),
      c(13, 2, R), c(13, 3, G),
    ],
  },

  // Level 16: Bomb Maze — alternating bombs and standards
  {
    index: 15,
    name: 'Bomb Maze',
    description: 'Navigate the bombs carefully!',
    colorCount: 4,
    fallSpeed: 1.7,
    starThresholds: [60000, 120000, 225000],
    bombTimerOverride: 16,
    cells: [
      c(11, 0, R, BM), c(11, 2, B), c(11, 4, G, BM), c(11, 6, Y),
      c(12, 1, G), c(12, 3, R, BM), c(12, 5, B), c(12, 7, G, BM),
      c(13, 0, Y), c(13, 1, R), c(13, 2, G), c(13, 3, B),
      c(13, 4, Y), c(13, 5, R), c(13, 6, G), c(13, 7, B),
    ],
  },

  // Level 17: Lock & Jelly — combined LOCKED + JELLY puzzle
  {
    index: 16,
    name: 'Lock & Jelly',
    description: 'Use jelly to break through locks!',
    colorCount: 4,
    fallSpeed: 1.6,
    starThresholds: [70000, 125000, 240000],
    cells: [
      c(10, 2, R, L), c(10, 3, B, L), c(10, 4, G, L), c(10, 5, Y, L),
      c(11, 1, B, J), c(11, 6, R, J),
      c(12, 0, G), c(12, 1, Y), c(12, 2, R), c(12, 3, G),
      c(12, 4, B), c(12, 5, Y), c(12, 6, G), c(12, 7, R),
      c(13, 0, R), c(13, 1, B), c(13, 2, Y), c(13, 3, R),
      c(13, 4, G), c(13, 5, B), c(13, 6, Y), c(13, 7, G),
    ],
  },

  // Level 18: The Invader — space invader pixel art, ~36 candies
  {
    index: 17,
    name: 'The Invader',
    description: 'Defeat the space invader!',
    colorCount: 5,
    fallSpeed: 1.7,
    starThresholds: [100000, 175000, 300000],
    cells: [
      // Row 6: antennae
      c(6, 2, P), c(6, 5, R),
      // Row 7: head top
      c(7, 1, R), c(7, 2, G), c(7, 3, B), c(7, 4, Y), c(7, 5, G), c(7, 6, B),
      // Row 8: eyes
      c(8, 0, G), c(8, 1, B), c(8, 2, Y), c(8, 3, R), c(8, 4, G), c(8, 5, B), c(8, 6, Y), c(8, 7, R),
      // Row 9: mouth
      c(9, 0, Y), c(9, 1, R), c(9, 3, G), c(9, 4, B), c(9, 6, R), c(9, 7, G),
      // Row 10: body
      c(10, 1, G), c(10, 2, R), c(10, 3, Y), c(10, 4, G), c(10, 5, R), c(10, 6, B),
      // Row 11: legs
      c(11, 0, B), c(11, 2, Y), c(11, 5, P), c(11, 7, G),
      // Row 12: feet
      c(12, 0, Y), c(12, 1, P), c(12, 6, R), c(12, 7, B),
    ],
  },

  // Level 19: Cracked Fortress — CRACKED + LOCKED defensive structure
  {
    index: 18,
    name: 'Cracked Fortress',
    description: 'A fortress of cracked and locked candy!',
    colorCount: 5,
    fallSpeed: 1.8,
    starThresholds: [90000, 165000, 275000],
    cells: [
      // Outer wall: cracked
      c(9, 1, R, CR), c(9, 2, B, CR), c(9, 5, G, CR), c(9, 6, Y, CR),
      c(10, 0, G, CR), c(10, 3, Y, CR), c(10, 4, R, CR), c(10, 7, B, CR),
      // Inner locks
      c(11, 1, B, L), c(11, 2, G, L), c(11, 5, Y, L), c(11, 6, R, L),
      // Core standards
      c(12, 2, R), c(12, 3, B), c(12, 4, G), c(12, 5, Y),
      c(13, 1, Y), c(13, 2, G), c(13, 3, R), c(13, 4, B),
      c(13, 5, G), c(13, 6, B),
    ],
  },

  // Level 20: The Gauntlet — every special type, ~56 candies
  {
    index: 19,
    name: 'The Gauntlet',
    description: 'The ultimate challenge: every candy type!',
    colorCount: 5,
    fallSpeed: 2.0,
    starThresholds: [150000, 250000, 450000],
    bombTimerOverride: 25,
    cells: [
      // Row 5: prism sentinels
      c(5, 0, R, PR), c(5, 7, B, PR),
      // Row 6: cracked wall
      c(6, 1, B, CR), c(6, 2, G, CR), c(6, 3, Y, CR), c(6, 4, R, CR), c(6, 5, B, CR), c(6, 6, G, CR),
      // Row 7: locked wall
      c(7, 0, G, L), c(7, 1, Y, L), c(7, 2, R, L), c(7, 5, B, L), c(7, 6, Y, L), c(7, 7, R, L),
      // Row 8: bombs + standard
      c(8, 0, Y, BM), c(8, 1, R), c(8, 2, B), c(8, 3, G, BM),
      c(8, 4, Y, BM), c(8, 5, R), c(8, 6, G), c(8, 7, B, BM),
      // Row 9: jelly row
      c(9, 0, R, J), c(9, 1, G), c(9, 2, Y, J), c(9, 3, B),
      c(9, 4, R), c(9, 5, G, J), c(9, 6, B), c(9, 7, Y, J),
      // Row 10: sticky cluster
      c(10, 2, B, K), c(10, 3, R, K), c(10, 4, G, K), c(10, 5, Y, K),
      // Row 11: mixed
      c(11, 0, G), c(11, 1, Y), c(11, 2, R), c(11, 3, B),
      c(11, 4, Y), c(11, 5, R), c(11, 6, G), c(11, 7, B),
      // Row 12
      c(12, 0, B), c(12, 1, R), c(12, 2, G), c(12, 3, Y),
      c(12, 4, R), c(12, 5, G), c(12, 6, B), c(12, 7, Y),
      // Row 13
      c(13, 0, Y), c(13, 1, G), c(13, 2, B), c(13, 3, R),
      c(13, 4, G), c(13, 5, B), c(13, 6, Y), c(13, 7, R),
    ],
  },
];
