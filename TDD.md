# Technical Design Document – Falling Candy Infinity

**Version:** 1.0
**Datum:** 2026-03-12
**Baserat på:** PRD v1 (Falling Candy Infinity)

---

## 1. Systemöversikt

```
┌─────────────────────────────────────────────────────────┐
│                      PWA Shell                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │                  Game Runtime                     │  │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │  │
│  │  │  Input   │→│  Engine   │→│    Renderer      │  │  │
│  │  │ Manager  │  │  (Sim)   │  │ (Canvas/WebGL)   │  │  │
│  │  └─────────┘  └──────────┘  └─────────────────┘  │  │
│  │       ↑            ↕              ↕               │  │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │  │
│  │  │  Touch  │  │  State   │  │   Audio          │  │  │
│  │  │ Handler │  │ Machine  │  │   Manager        │  │  │
│  │  └─────────┘  └──────────┘  └─────────────────┘  │  │
│  │                    ↕                              │  │
│  │            ┌──────────────┐                       │  │
│  │            │  Persistence │                       │  │
│  │            │ (LocalStorage│                       │  │
│  │            │  / IndexedDB)│                       │  │
│  │            └──────────────┘                       │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌─────────────────┐  ┌──────────────────────────┐      │
│  │ Service Worker   │  │  Web App Manifest        │      │
│  └─────────────────┘  └──────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### Kärnprinciper

- **Simulation och rendering är separerade.** Spellogik körs i fast tick rate (60 Hz). Rendering körs via `requestAnimationFrame` och interpolerar visuellt tillstånd.
- **Input buffras.** Touch-events samlas i en kö och konsumeras av simulationen en gång per tick.
- **Allt spelrelevant tillstånd lever i en enda `GameState`-struct.** Inga sidoeffekter i simulationssteget.
- **Zero-allocation hot path.** Objektpooler för partiklar, animationer och transienta objekt. Inga `new` i renderingsloopen.

---

## 2. State Machine

### 2.1 Applikationsstater

```
                    ┌──────────┐
                    │  BOOT    │
                    └────┬─────┘
                         │ assets loaded
                         ▼
                    ┌──────────┐
              ┌────→│  MENU    │←───────────────┐
              │     └────┬─────┘                │
              │          │ tap play              │
              │          ▼                       │
              │     ┌──────────┐                │
              │     │ ONBOARD  │ (first run)    │
              │     └────┬─────┘                │
              │          │ complete              │
              │          ▼                       │
              │     ┌──────────┐                │
              │     │ PLAYING  │                │
              │     └──┬───┬───┘                │
              │        │   │                    │
              │  pause │   │ stack overflow     │
              │        ▼   ▼                    │
              │  ┌────────┐ ┌──────────┐        │
              │  │ PAUSED │ │GAME OVER │────────┘
              │  └───┬────┘ └──────────┘
              │      │ resume
              │      ▼
              └──────┘
```

Utöver dessa finns sub-states inom `MENU`:

- `MENU.IDLE` — logotyp, knappar synliga
- `MENU.DEMO` — attract mode spelar självgående demo (triggas efter 5s inaktivitet)
- `MENU.SETTINGS` — overlay med inställningar

### 2.2 Spellogik-stater (inom PLAYING)

```
PLAYING
  ├── SPAWNING      → ny formation skapas i spawn-zon
  ├── FALLING        → aktiv formation faller, spelaren styr
  ├── LOCKING        → formation har landat, kort grace period
  ├── MATCHING       → sök och markera matchgrupper
  ├── CLEARING       → animera borttagning av matchade candies
  ├── CASCADING      → gravitationsfyllning, nya candies faller ner
  │     └──→ MATCHING (loop tills inga fler matchningar)
  ├── ABILITY_ACTIVE → ability-effekt pågår
  └── DANGER         → stack nära toppen, visuell/auditiv varning
```

**Transition-regler:**

| Från | Till | Villkor |
|------|------|---------|
| SPAWNING | FALLING | Formation placerad i spawn-zon |
| FALLING | LOCKING | Formation vilar på annan candy eller botten |
| LOCKING | MATCHING | Grace period (200ms) utgången ELLER hard drop |
| LOCKING | FALLING | Spelaren flyttade formation och den har luft under sig |
| MATCHING | CLEARING | ≥1 matchgrupp hittad |
| MATCHING | SPAWNING | Inga matchningar — nästa formation |
| CLEARING | CASCADING | Borttagningsanimation klar |
| CASCADING | MATCHING | Alla candies har fallit till vila |
| ABILITY_ACTIVE | MATCHING | Ability-effekt avslutad |

### 2.3 State-implementation

```typescript
enum AppState {
  BOOT,
  MENU,
  ONBOARDING,
  PLAYING,
  PAUSED,
  GAME_OVER,
}

enum PlayState {
  SPAWNING,
  FALLING,
  LOCKING,
  MATCHING,
  CLEARING,
  CASCADING,
  ABILITY_ACTIVE,
}

interface StateMachine<S> {
  current: S;
  enter(state: S, context?: any): void;
  update(dt: number): void;
  canTransition(from: S, to: S): boolean;
}
```

---

## 3. Datamodell

### 3.1 Board

```typescript
const COLS = 8;
const ROWS = 14;          // synliga rader
const SPAWN_ROWS = 4;     // dolda rader ovanför
const TOTAL_ROWS = ROWS + SPAWN_ROWS; // 18

// Brädet lagras som flat array, row-major order.
// Index = row * COLS + col.  Row 0 = översta dolda raden.
type BoardArray = (Candy | null)[];
```

### 3.2 Candy

```typescript
enum CandyColor {
  RED    = 0,
  BLUE   = 1,
  GREEN  = 2,
  YELLOW = 3,
  PURPLE = 4,
}

enum CandyType {
  STANDARD = 0,
  JELLY    = 1,
  STICKY   = 2,
  BOMB     = 3,
  PRISM    = 4,  // wildcard
  LOCKED   = 5,
  CRACKED  = 6,
}

interface Candy {
  id: number;           // unikt ID för animationsreferens
  color: CandyColor;
  type: CandyType;
  row: number;
  col: number;

  // Special-state
  bombTimer?: number;   // nedräkning för BOMB
  crackHits?: number;   // kvarvarande träffar för CRACKED (startar på 2)
  locked?: boolean;     // true för LOCKED tills frigjord
  stickyBonds?: number; // bitmask för riktningar (UP=1, RIGHT=2, DOWN=4, LEFT=8)
}

// Globalt löpande ID-räknare. Allokeras aldrig om under en session.
let nextCandyId = 0;
function createCandy(color: CandyColor, type: CandyType, row: number, col: number): Candy {
  return { id: nextCandyId++, color, type, row, col };
}
```

### 3.3 Formation (aktiv fallande enhet)

```typescript
interface Formation {
  // Lokala offset-positioner relativt pivot
  cells: { dRow: number; dCol: number; candy: Candy }[];

  // Pivot-position (float för smooth fall)
  pivotRow: number;
  pivotCol: number;

  // Rotationsstate
  rotation: 0 | 1 | 2 | 3;
}

// Formationsmallar (offsets före rotation)
const FORMATION_TEMPLATES = {
  SINGLE: [{ dRow: 0, dCol: 0 }],
  PAIR_V: [{ dRow: 0, dCol: 0 }, { dRow: 1, dCol: 0 }],
  PAIR_H: [{ dRow: 0, dCol: 0 }, { dRow: 0, dCol: 1 }],
  TRIPLE_L: [{ dRow: 0, dCol: 0 }, { dRow: 1, dCol: 0 }, { dRow: 1, dCol: 1 }],
  TRIPLE_I: [{ dRow: 0, dCol: 0 }, { dRow: 1, dCol: 0 }, { dRow: 2, dCol: 0 }],
};
```

### 3.4 GameState

```typescript
interface GameState {
  board: BoardArray;
  active: Formation | null;
  next: Formation;            // nästa formation (preview)
  playState: PlayState;

  // Progression
  score: number;
  chain: number;              // nuvarande kedjedjup
  maxChain: number;           // session-rekord
  stage: number;
  stagePhase: 'build' | 'pressure' | 'break';
  ticksInStage: number;

  // Difficulty
  fallSpeed: number;          // rader per sekund
  colorCount: number;         // aktiva färger (3–5)
  specialRate: number;        // sannolikhet för specialcandy

  // Ability
  abilityCharge: number;      // 0.0 – 1.0
  abilityReady: boolean;

  // Danger
  dangerLevel: number;        // 0.0 – 1.0 baserat på stackhöjd

  // Timing
  lockTimer: number;          // ms kvar av lock grace
  clearTimer: number;         // ms kvar av clear-animation

  // RNG
  rngSeed: number;            // för determinism/replay
}
```

### 3.5 Matchningsalgoritm (gruppmatch via angränsning)

```typescript
// Flood-fill adjacency matching.
// Returnerar array av grupper, varje grupp ≥ 3 candies.

function findMatches(board: BoardArray): Candy[][] {
  const visited = new Uint8Array(COLS * TOTAL_ROWS);
  const groups: Candy[][] = [];

  for (let i = 0; i < board.length; i++) {
    const candy = board[i];
    if (!candy || visited[i] || candy.locked) continue;

    const group: Candy[] = [];
    const stack: number[] = [i];

    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (visited[idx]) continue;
      visited[idx] = 1;

      const c = board[idx]!;
      if (!colorsMatch(c, candy)) continue;

      group.push(c);

      const row = (idx / COLS) | 0;
      const col = idx % COLS;

      // 4-vägs angränsning
      if (col > 0)        stack.push(idx - 1);
      if (col < COLS - 1) stack.push(idx + 1);
      if (row > 0)        stack.push(idx - COLS);
      if (row < TOTAL_ROWS - 1) stack.push(idx + COLS);
    }

    if (group.length >= 3) {
      groups.push(group);
    }
  }

  return groups;
}

function colorsMatch(a: Candy, b: Candy): boolean {
  if (a.type === CandyType.PRISM || b.type === CandyType.PRISM) return true;
  return a.color === b.color;
}
```

---

## 4. Touch-inputsystem

### 4.1 Arkitektur

```
 Touch Events (pointermove/pointerdown/pointerup)
        │
        ▼
 ┌──────────────────┐
 │  GestureDetector  │  ← klassificerar rå events till gester
 │                    │
 │  deadzone: 12px   │
 │  swipe thresh: 8px │
 │  tap max: 200ms   │
 └────────┬──────────┘
          │
          ▼
 ┌──────────────────┐
 │  InputBuffer      │  ← kö av klassificerade actions
 │                    │
 │  max size: 4      │
 │  consumed per tick │
 └────────┬──────────┘
          │
          ▼
 ┌──────────────────┐
 │  Game Simulation  │  ← konsumerar actions
 └──────────────────┘
```

### 4.2 Gester → Actions

| Gest | Action | Beskrivning |
|------|--------|-------------|
| Horisontell drag ≥ 1 cell-bredd | `MOVE_LEFT` / `MOVE_RIGHT` | Flytta formation. Repeats om fingret fortsätter. |
| Tap (< 200ms, < 12px rörelse) | `ROTATE` | Rotera formation 90° medurs. |
| Snabb vertikal swipe nedåt | `HARD_DROP` | Omedelbar drop till lägsta möjliga position. |
| Hållen vertikal drag nedåt | `SOFT_DROP` | Ökad fallhastighet (×4) under hålltid. |
| Ability-knapp tap | `ABILITY` | Aktiverar ability om laddad. |
| Pause-knapp tap | `PAUSE` | Pausar spelet. |

### 4.3 GestureDetector-implementation

```typescript
interface GestureConfig {
  deadzone: number;         // px, ingen gest registreras under detta
  cellWidth: number;        // px, en kolumnbredd för drag-steg
  tapMaxDuration: number;   // ms
  tapMaxDistance: number;    // px
  swipeMinVelocity: number; // px/ms för hard drop
}

enum GestureType {
  NONE,
  TAP,
  DRAG_H,
  DRAG_V_DOWN,
  SWIPE_DOWN,
}

class GestureDetector {
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private currentX = 0;
  private currentY = 0;
  private lastCellX = 0;
  private active = false;
  private gesture = GestureType.NONE;
  private config: GestureConfig;
  private emit: (action: InputAction) => void;

  constructor(config: GestureConfig, emit: (action: InputAction) => void) {
    this.config = config;
    this.emit = emit;
  }

  onPointerDown(x: number, y: number, time: number): void {
    this.startX = x;
    this.startY = y;
    this.startTime = time;
    this.currentX = x;
    this.currentY = y;
    this.lastCellX = 0;
    this.active = true;
    this.gesture = GestureType.NONE;
  }

  onPointerMove(x: number, y: number, _time: number): void {
    if (!this.active) return;
    this.currentX = x;
    this.currentY = y;

    const dx = x - this.startX;
    const dy = y - this.startY;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (this.gesture === GestureType.NONE) {
      if (adx > this.config.deadzone && adx > ady) {
        this.gesture = GestureType.DRAG_H;
      } else if (ady > this.config.deadzone && dy > 0) {
        this.gesture = GestureType.DRAG_V_DOWN;
      }
    }

    if (this.gesture === GestureType.DRAG_H) {
      const cellsMoved = Math.floor(dx / this.config.cellWidth);
      const delta = cellsMoved - this.lastCellX;
      if (delta !== 0) {
        this.emit(delta > 0 ? InputAction.MOVE_RIGHT : InputAction.MOVE_LEFT);
        this.lastCellX = cellsMoved;
      }
    }

    if (this.gesture === GestureType.DRAG_V_DOWN) {
      this.emit(InputAction.SOFT_DROP);
    }
  }

  onPointerUp(x: number, y: number, time: number): void {
    if (!this.active) return;
    this.active = false;

    const dx = x - this.startX;
    const dy = y - this.startY;
    const dt = time - this.startTime;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.gesture === GestureType.NONE && dt < this.config.tapMaxDuration && dist < this.config.tapMaxDistance) {
      this.emit(InputAction.ROTATE);
      return;
    }

    if (this.gesture === GestureType.DRAG_V_DOWN && dy > 0) {
      const velocity = dy / dt;
      if (velocity > this.config.swipeMinVelocity) {
        this.emit(InputAction.HARD_DROP);
      }
    }
  }
}
```

### 4.4 Input latency-budget

| Steg | Max latens |
|------|-----------|
| Touch event → GestureDetector | 0 ms (synkront) |
| GestureDetector → InputBuffer | 0 ms |
| InputBuffer → Simulation consume | ≤ 16.67 ms (nästa tick) |
| Simulation → Visuell feedback | ≤ 16.67 ms (nästa frame) |
| **Total worst case** | **~33 ms** (2 frames) |

---

## 5. Renderingsarkitektur

### 5.1 Val: Canvas 2D med WebGL-uppgraderingsväg

**Fas 1–2:** Canvas 2D API. Enklare, snabbare iteration, tillräcklig prestanda för sprite-blitting.
**Fas 3+:** Migrering till WebGL om profiling visar behov (partiklar, blend modes, glow).

Arkitekturen abstraherar rendering bakom ett interface så bytet inte kräver spellogikändringar.

### 5.2 Render-pipeline

```
requestAnimationFrame
        │
        ▼
┌────────────────────┐
│  Interpolate State  │  ← blend mellan nuvarande och förra sim-tick
│  (alpha = frameDt   │     för smooth 60fps oavsett sim-rate
│   / simTickDt)      │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐     ┌──────────────────┐
│  Background Layer   │     │  Sprite Atlas     │
│  (static/parallax)  │     │  (TextureCache)   │
└────────┬───────────┘     └─────────┬────────┘
         │                           │
         ▼                           │
┌────────────────────┐               │
│  Board Layer        │←─────────────┘
│  - grid cells       │
│  - landed candies   │
│  - active formation │
│  - ghost piece      │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  FX Layer           │
│  - match explosions │
│  - chain sparks     │
│  - danger pulse     │
│  - screenshake      │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  HUD Layer          │
│  - score            │
│  - combo counter    │
│  - ability meter    │
│  - stage indicator  │
│  - pause button     │
└────────────────────┘
```

### 5.3 Renderer-interface

```typescript
interface Renderer {
  init(canvas: HTMLCanvasElement): void;
  resize(width: number, height: number, dpr: number): void;
  beginFrame(): void;

  drawBackground(parallaxOffset: number): void;
  drawGrid(): void;
  drawCandy(candy: Candy, x: number, y: number, scale: number, alpha: number): void;
  drawGhost(formation: Formation): void;
  drawFX(fx: FXInstance): void;
  drawHUD(hud: HUDState): void;

  endFrame(): void;
  destroy(): void;
}

class Canvas2DRenderer implements Renderer { /* ... */ }
// Framtida: class WebGLRenderer implements Renderer { /* ... */ }
```

### 5.4 Sprite Atlas

```typescript
interface SpriteAtlas {
  image: HTMLImageElement;
  frames: Map<string, SpriteFrame>;
}

interface SpriteFrame {
  x: number;       // position i atlas
  y: number;
  w: number;       // storlek i atlas
  h: number;
  pivotX: number;  // center offset
  pivotY: number;
}

// Atlas-namnkonvention:
// "candy_red_standard"
// "candy_blue_jelly"
// "candy_yellow_bomb_f0" .. "candy_yellow_bomb_f3"  (animerade frames)
// "fx_pop_f0" .. "fx_pop_f7"
// "ui_ability_icon"
```

**Atlas-format:** En enda PNG spritesheet + JSON metadata-fil. Genereras från source-art med texture packer (t.ex. free-tex-packer eller eget script).

### 5.5 Koordinatsystem

```
Canvas-storlek bestäms av:
  gameWidth  = COLS * cellSize
  gameHeight = ROWS * cellSize + HUD_HEIGHT

cellSize beräknas dynamiskt:
  cellSize = min(
    floor(viewportWidth / COLS),
    floor((viewportHeight - HUD_HEIGHT) / ROWS)
  )

Allt ritas relativt game-viewport, centrerat i canvas.
DPR-skalning: canvas.width = gameWidth * devicePixelRatio
```

---

## 6. Spelloop och timing

### 6.1 Huvudloop

```typescript
const SIM_HZ = 60;
const SIM_DT = 1000 / SIM_HZ; // 16.667 ms

class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private running = false;

  constructor(
    private simulate: (dt: number) => void,
    private render: (alpha: number) => void,
  ) {}

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  stop(): void {
    this.running = false;
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    const frameTime = Math.min(now - this.lastTime, 100); // cap vid 100ms
    this.lastTime = now;
    this.accumulator += frameTime;

    while (this.accumulator >= SIM_DT) {
      this.simulate(SIM_DT);
      this.accumulator -= SIM_DT;
    }

    const alpha = this.accumulator / SIM_DT;
    this.render(alpha);

    requestAnimationFrame(this.tick);
  };
}
```

### 6.2 Difficulty-ramp per stage

```typescript
interface DifficultyProfile {
  fallSpeed: number;       // rader/sek
  colorCount: number;      // 3–5
  specialRate: number;     // 0.0–0.5
  formationPool: string[]; // vilka formationstyper
  bombRate: number;
  lockedRate: number;
  phaseTimings: {
    build: number;         // ticks
    pressure: number;
    break: number;
  };
}

function getDifficulty(stage: number): DifficultyProfile {
  return {
    fallSpeed:    clamp(1.0 + stage * 0.15, 1.0, 8.0),
    colorCount:   stage < 3 ? 4 : 5,
    specialRate:  clamp(0.05 + stage * 0.02, 0.05, 0.35),
    formationPool: stage < 5
      ? ['PAIR_V', 'PAIR_H']
      : ['PAIR_V', 'PAIR_H', 'TRIPLE_L', 'TRIPLE_I'],
    bombRate:     clamp(stage * 0.01, 0, 0.1),
    lockedRate:   clamp((stage - 3) * 0.01, 0, 0.08),
    phaseTimings: {
      build:    Math.max(600 - stage * 20, 300),
      pressure: Math.min(300 + stage * 15, 600),
      break:    Math.max(200 - stage * 5, 100),
    },
  };
}
```

---

## 7. Ljud-arkitektur

### 7.1 AudioManager

```typescript
class AudioManager {
  private ctx: AudioContext;
  private buffers: Map<string, AudioBuffer> = new Map();
  private musicLayers: AudioBufferSourceNode[] = [];
  private musicGains: GainNode[] = [];

  // Spelaren kan stänga av ljud/musik separat
  sfxEnabled = true;
  musicEnabled = true;

  async loadSFX(name: string, url: string): Promise<void> { /* ... */ }
  playSFX(name: string, volume?: number, pitch?: number): void { /* ... */ }

  // Adaptiv musik: 3 lager (calm, pulse, intense)
  startMusic(): void { /* startar alla lager, bara calm audible */ }
  setMusicIntensity(level: 0 | 1 | 2): void { /* crossfade lager */ }
  stopMusic(): void { /* ... */ }
}
```

### 7.2 Ljud-trigger-matris

| Event | SFX | Musik-påverkan |
|-------|-----|----------------|
| Candy landar | `drop_soft` | — |
| Match (3) | `pop_1` | — |
| Match (4+) | `pop_2` | — |
| Chain +1 | `chain_N` (pitch ökar) | intensity++ om chain≥3 |
| Danger start | `danger_pulse` | → intense layer |
| Danger slut | — | → calm/pulse layer |
| Ability | `ability_burst` | kort filter sweep |
| Game over | `gameover_sting` | musik fade out |

---

## 8. FX och Animationssystem

### 8.1 Objektpool

```typescript
class Pool<T> {
  private free: T[] = [];
  private active: T[] = [];

  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    initialSize: number,
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.free.push(factory());
    }
  }

  acquire(): T {
    const obj = this.free.pop() ?? this.factory();
    this.active.push(obj);
    return obj;
  }

  release(obj: T): void {
    const idx = this.active.indexOf(obj);
    if (idx >= 0) {
      this.active.splice(idx, 1);
      this.reset(obj);
      this.free.push(obj);
    }
  }

  forEach(fn: (obj: T) => void): void {
    for (const obj of this.active) fn(obj);
  }
}
```

### 8.2 FX-instans

```typescript
interface FXInstance {
  type: 'pop' | 'sparkle' | 'glow' | 'streak' | 'shake' | 'combo_text';
  x: number;
  y: number;
  age: number;     // ms sedan start
  duration: number; // total livstid ms
  params: any;     // typspecifika parametrar
}
```

### 8.3 Timing-specifikation

| Animation | Duration | Easing |
|-----------|----------|--------|
| Candy idle wobble | loop 2000ms | sin |
| Landnings-squash | 150ms | easeOutElastic |
| Match pop | 200ms | easeOutQuad |
| Chain sparkle | 300ms | linear → fade |
| Combo text | 800ms | easeOutBack → fade |
| Screenshake | 200ms | decay |
| Danger pulse | loop 1000ms | sin (rött overlay) |
| Ability burst | 400ms | easeOutExpo |

---

## 9. PWA-setup

### 9.1 manifest.json

```json
{
  "name": "Falling Candy Infinity",
  "short_name": "Candy ∞",
  "description": "Endless falling candy puzzle game",
  "start_url": "/",
  "display": "fullscreen",
  "orientation": "portrait",
  "background_color": "#1a0a2e",
  "theme_color": "#1a0a2e",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["games"],
  "screenshots": [
    { "src": "/screenshots/gameplay.png", "sizes": "1080x1920", "type": "image/png" }
  ]
}
```

### 9.2 Service Worker-strategi

```
┌─────────────────────────────────────────────┐
│  Cache Strategy                              │
│                                              │
│  Shell (HTML, JS, CSS):   Cache-first        │
│  Sprite atlas + audio:    Cache-first        │
│  Manifest + icons:        Cache-first        │
│                                              │
│  Allt cachas vid install-event.              │
│  Versionshantering via cache-namn.           │
│  Uppdatering: ny SW aktiveras vid nästa      │
│  besök, skipWaiting om user accepterar.      │
└─────────────────────────────────────────────┘
```

```typescript
// sw.ts (pseudokod)
const CACHE_NAME = 'candy-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/game.js',
  '/style.css',
  '/atlas/candy.png',
  '/atlas/candy.json',
  '/audio/sfx.mp3',
  '/audio/music_calm.mp3',
  '/audio/music_pulse.mp3',
  '/audio/music_intense.mp3',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(SHELL_ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
```

### 9.3 Install-prompt

```typescript
let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Visa in-game install-knapp efter 2 avslutade runs
  if (getCompletedRuns() >= 2) {
    showInstallBanner();
  }
});

function triggerInstall(): void {
  deferredPrompt?.prompt();
}
```

---

## 10. Persistence

### 10.1 Lokalt lagrade data

```typescript
interface SaveData {
  version: number;
  highScore: number;
  bestStage: number;
  bestChain: number;
  totalRuns: number;
  settings: {
    sfx: boolean;
    music: boolean;
    haptics: boolean;
  };
  onboardingComplete: boolean;
  installPromptDismissed: boolean;
}

// Lagras i localStorage som JSON.
// Migrering via version-nummer om formatet ändras.
const SAVE_KEY = 'candy_save';

function loadSave(): SaveData {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return DEFAULT_SAVE;
  const data = JSON.parse(raw);
  return migrateSave(data);
}

function writeSave(data: SaveData): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}
```

---

## 11. Projektstruktur

```
falling-candy/
├── index.html                  # Shell: canvas + minimal UI
├── manifest.json               # PWA manifest
├── sw.ts                       # Service worker
├── src/
│   ├── main.ts                 # Entry point, bootstrap
│   ├── config.ts               # Konstanter, tuning-värden
│   │
│   ├── core/
│   │   ├── state.ts            # GameState, AppState, typdefinitioner
│   │   ├── board.ts            # Board-operationer (place, remove, gravity, findMatches)
│   │   ├── formation.ts        # Formation spawn, rotation, kollision
│   │   ├── simulation.ts       # Sim-tick: konsumera input, uppdatera state
│   │   ├── difficulty.ts       # Difficulty profiles, stage progression
│   │   ├── scoring.ts          # Poängberäkning, combo-logik
│   │   ├── ability.ts          # Ability-system (Sugar Burst)
│   │   └── rng.ts              # Seeded PRNG för determinism
│   │
│   ├── input/
│   │   ├── gesture.ts          # GestureDetector
│   │   ├── buffer.ts           # InputBuffer
│   │   └── keyboard.ts         # Desktop keyboard-stöd
│   │
│   ├── render/
│   │   ├── renderer.ts         # Renderer interface
│   │   ├── canvas2d.ts         # Canvas 2D implementation
│   │   ├── atlas.ts            # Sprite atlas loader
│   │   ├── camera.ts           # Viewport, scaling, screenshake
│   │   └── interpolation.ts    # State interpolation för smooth render
│   │
│   ├── fx/
│   │   ├── pool.ts             # Generisk objektpool
│   │   ├── particles.ts        # Partikelsystem
│   │   └── fx-manager.ts       # FX lifecycle, spawning, update
│   │
│   ├── audio/
│   │   └── audio-manager.ts    # AudioManager, music layers
│   │
│   ├── ui/
│   │   ├── hud.ts              # In-game HUD rendering
│   │   ├── menu.ts             # Menyskärm / startskärm
│   │   ├── gameover.ts         # Game over-skärm
│   │   ├── onboarding.ts       # Mikro-onboarding overlays
│   │   └── install-prompt.ts   # PWA install-prompt logik
│   │
│   ├── demo/
│   │   └── attract.ts          # Attract mode / självgående demo
│   │
│   └── save/
│       └── persistence.ts      # LocalStorage save/load/migrate
│
├── assets/
│   ├── atlas/
│   │   ├── candy.png           # Spritesheet
│   │   └── candy.json          # Atlas metadata
│   ├── audio/
│   │   ├── sfx/                # Individuella ljudeffekter
│   │   └── music/              # Musiklager
│   └── icons/                  # PWA-ikoner
│
├── tools/
│   └── pack-atlas.ts           # Atlas-packningsscript
│
├── tsconfig.json
├── package.json
└── vite.config.ts              # Bundler (Vite)
```

---

## 12. Build och tooling

### 12.1 Toolchain

| Verktyg | Syfte |
|---------|-------|
| **TypeScript** | Språk |
| **Vite** | Bundler, dev server, HMR |
| **vitest** | Unit tests |
| **esbuild** (via Vite) | Produktion-build |
| **free-tex-packer-core** | Atlas-generering |

### 12.2 Build-kommandon

```bash
npm run dev        # Vite dev server med HMR
npm run build      # Produktion-build → dist/
npm run preview    # Servera dist/ lokalt
npm run test       # Kör vitest
npm run atlas      # Generera spritesheet från assets/source/
```

### 12.3 Produktion-build mål

- **Total bundle ≤ 200 KB** gzipped (exklusive atlas + audio)
- **First paint ≤ 1.5s** på 4G
- **TTI ≤ 2.5s** på mid-range mobil

---

## 13. Sprintplan (MVP)

### Sprint 1: Kärna (1 vecka)

**Mål:** Spelbar grundloop utan grafik.

- [ ] Projektsetup (Vite + TS + vitest)
- [ ] `GameState`, `Board`, `Candy` datastrukturer
- [ ] `findMatches()` med flood fill
- [ ] Formation spawn, rotation, kollision
- [ ] Gravity (candies faller ner efter match)
- [ ] Spelloop med fast tick
- [ ] Grundläggande Canvas 2D-rendering (färgade rektanglar)
- [ ] Touch-input: drag, tap, swipe
- [ ] Game over-detection
- [ ] **Unit tests** för board, matching, gravity, formation

### Sprint 2: Gameloop + Feel (1 vecka)

**Mål:** Faktiskt roligt att spela.

- [ ] Score-system med chain-bonus
- [ ] Lock delay (grace period)
- [ ] Ghost piece (visar var formation landar)
- [ ] Difficulty ramp (fallhastighet + färger)
- [ ] Stage-system (build → pressure → break)
- [ ] Grundläggande ljud (pop, drop, chain)
- [ ] Landnings-squash + match-pop animationer
- [ ] Combo-text feedback
- [ ] Keyboard-stöd (desktop)

### Sprint 3: Special Candies + Ability (1 vecka)

**Mål:** Variation och strategiskt djup.

- [ ] Jelly, Sticky, Bomb candy-typer
- [ ] Prism (wildcard)
- [ ] Locked + Cracked candy
- [ ] Sugar Burst ability + ability meter
- [ ] Danger state (visuell + auditiv varning)
- [ ] Bomb countdown-logik
- [ ] Sticky bond-mekanik

### Sprint 4: Polish + UI (1 vecka)

**Mål:** Ser ut som en riktig produkt.

- [ ] Sprite atlas (template art)
- [ ] Startskärm med logo + play
- [ ] Attract/demo mode
- [ ] Game over-skärm med stats
- [ ] Mikro-onboarding (första spelet)
- [ ] Partikelsystem (pop, sparkle, glow)
- [ ] Screenshake
- [ ] Adaptiv musik (3 lager)
- [ ] Haptik (Vibration API)

### Sprint 5: PWA + Produktionskvalitet (1 vecka)

**Mål:** Installérbar, offline-kapabel, snabb.

- [ ] PWA manifest + ikoner
- [ ] Service worker + offline cache
- [ ] Install-prompt (efter 2 runs)
- [ ] LocalStorage save/load (high scores, settings)
- [ ] Settings-skärm (ljud, musik, vibration)
- [ ] Responsiv layout (mobil + tablet + desktop)
- [ ] Performance profiling + optimering
- [ ] Bundle size audit

---

## 14. Tekniska risker och mitigeringar

| Risk | Sannolikhet | Påverkan | Mitigation |
|------|-------------|----------|------------|
| Touch-input känns segt | Medel | Hög | Sprint 1 prioriterar input. Profilera tidigt. Buffra input, mät latens. |
| Canvas 2D för långsamt med partiklar | Låg | Medel | Objektpool. Begränsa partiklar. WebGL-uppgradering finns som plan B. |
| Ljud på mobil (autoplay-policy) | Hög | Medel | Starta AudioContext vid första user gesture. Alla ljud lazy-loadade. |
| Matchningsalgoritm för långsam | Låg | Låg | Board är 8×18 = 144 celler. Flood fill är O(n). Inget problem. |
| PWA install prompt visas inte | Medel | Medel | Kräver HTTPS + manifest + SW. Fallback: manuell "Lägg till på hemskärm"-instruktion. |
| Sticky candy skapar oväntade edge cases | Medel | Medel | Implementera sist bland specialcandies. Testa med fuzzing. |

---

## 15. Testsstrategi

### Unit tests (vitest)

- `board.test.ts` — placering, borttagning, gravity
- `matching.test.ts` — flood fill, edge cases, prism wildcard
- `formation.test.ts` — rotation, wall kicks, kollision
- `scoring.test.ts` — poängberäkning, chain-multiplikator
- `difficulty.test.ts` — ramp-kurvor, stage-progression
- `rng.test.ts` — determinism, distribution

### Integration tests

- Fullständig match-clear-cascade-loop
- Formation → land → match → chain → score

### Manuell testning

- Touch-feel på riktig mobil (inte bara emulator)
- 60fps-verifiering med Chrome DevTools Performance
- Offline-beteende efter cache
- PWA-installation på iOS Safari + Android Chrome

---

*Dokumentet uppdateras löpande. Nästa steg: Sprint 1 kickoff.*
