import { SIM_DT } from './config.js';
import { AppState, InputAction, createInitialGameState, type GameState } from './core/state.js';
import { simulateTick } from './core/simulation.js';
import { InputBuffer } from './input/buffer.js';
import { GestureDetector } from './input/gesture.js';
import { setupKeyboard } from './input/keyboard.js';
import { Canvas2DRenderer } from './render/canvas2d.js';
import { AudioManager } from './audio/audio-manager.js';
import { MusicEngine } from './audio/music.js';
import { FXManager } from './fx/animation.js';
import { loadSave, writeSave, updateHighScores, type SaveData } from './save/persistence.js';
import { drawMenu, drawIntro, drawOnboarding, drawInstallBanner, hitTestInstallBanner, loadLogo } from './ui/menu.js';
import { drawSettings, hitTestSettings } from './ui/settings.js';
import { hapticDrop, hapticMatch, hapticChain, hapticBomb, hapticAbility, hapticGameOver, setHapticsEnabled } from './input/haptics.js';
import { registerSW, setupInstallPrompt, canInstall, triggerInstall } from './pwa/install-prompt.js';
import { demoBotTick, resetDemoAI } from './ai/demo-player.js';

// --- PWA ---
registerSW();
let installAvailable = false;
setupInstallPrompt(() => { installAvailable = true; });

// --- Load logo ---
loadLogo();

// --- Init ---
const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Canvas2DRenderer();
renderer.init(canvas);

const audio = new AudioManager();
const music = new MusicEngine();
const fx = new FXManager();
renderer.setFX(fx);

const inputBuffer = new InputBuffer();
const save: SaveData = loadSave();

audio.sfxEnabled = save.sfxEnabled;
music.setEnabled(save.musicEnabled);
setHapticsEnabled(save.hapticsEnabled);

let state: GameState = createInitialGameState(Date.now());
state.appState = AppState.BOOT;

let menuTime = 0;
let introTime = 0;
let introStingPlayed = false;
let onboardingAge = -1;
let gameOverScoreSaved = false;
let settingsOpen = false;
let installBannerTime = 0;
let showInstallBanner = false;
let shareButtonRect = { x: 0, y: 0, w: 0, h: 0 };

// --- Demo mode state ---
let demoState: GameState = createInitialGameState(Date.now() + 1);
const demoInput = new InputBuffer();
let demoAccumulator = 0;
const demoFx = new FXManager();

function resetDemo(): void {
  demoState = createInitialGameState(Date.now());
  demoState.stage = 20; // start high for faster, more interesting demo
  demoState.colorCount = 5;
  demoInput.clear();
  demoAccumulator = 0;
  demoFx.clear();
  resetDemoAI();
}
resetDemo();

// --- Input setup ---
const gesture = new GestureDetector(
  canvas,
  inputBuffer,
  () => renderer.getCamera().cellSize,
  () => state,
);
const cleanupKeyboard = setupKeyboard(inputBuffer, () => state);

// Ability: 'a' key
window.addEventListener('keydown', (e) => {
  if (e.key === 'a' || e.key === 'A') {
    inputBuffer.push(InputAction.ABILITY);
  }
  if (state.appState === AppState.BOOT) {
    if (!introStingPlayed) {
      audio.introSting();
      introStingPlayed = true;
    }
    state.appState = AppState.MENU;
    menuTime = 0;
    return;
  }
  if (state.appState === AppState.MENU) {
    if (e.key === 's' || e.key === 'S') {
      settingsOpen = !settingsOpen;
    }
  }
  if (e.key === 'Escape' && settingsOpen) {
    settingsOpen = false;
  }
  // Pause/unpause during gameplay
  if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && !settingsOpen) {
    if (state.appState === AppState.PLAYING) {
      state.appState = AppState.PAUSED;
      music.pause();
      audio.updateDangerAlarm(0);
    } else if (state.appState === AppState.PAUSED) {
      state.appState = AppState.PLAYING;
      music.resume();
    }
  }
});

// Primary tap/click handler
canvas.addEventListener('pointerdown', (e) => {
  const cam = renderer.getCamera();
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (cam.logicalW / rect.width);
  const py = (e.clientY - rect.top) * (cam.logicalH / rect.height);

  if (settingsOpen) {
    const hit = hitTestSettings(px, py);
    if (hit) {
      if (hit.label === 'Install') {
        triggerInstall();
        installAvailable = false;
      } else {
        (save as unknown as Record<string, unknown>)[hit.key] = !(save[hit.key] as boolean);
        applySettings();
        writeSave(save);
      }
    } else {
      settingsOpen = false;
    }
    return;
  }

  if (state.appState === AppState.BOOT) {
    // Skip intro on tap — play sting on first interaction (unlocks AudioContext)
    if (!introStingPlayed) {
      audio.introSting();
      introStingPlayed = true;
    }
    state.appState = AppState.MENU;
    menuTime = 0;
    return;
  }
  if (state.appState === AppState.MENU) {
    // Install banner interaction
    if (showInstallBanner) {
      const hit = hitTestInstallBanner(px, py);
      if (hit === 'install') {
        triggerInstall();
        installAvailable = false;
        showInstallBanner = false;
        return;
      }
      if (hit === 'dismiss') {
        save.installPromptDismissed = true;
        writeSave(save);
        showInstallBanner = false;
        return;
      }
    }

    const gearSize = Math.min(30, cam.logicalW * 0.07);
    if (px >= cam.logicalW - gearSize - 10 && py <= gearSize + 10) {
      settingsOpen = true;
      return;
    }
    startGame();
    return;
  }
  if (state.appState === AppState.PLAYING) {
    if (renderer.hitTestPauseButton(px, py)) {
      state.appState = AppState.PAUSED;
      music.pause();
      audio.updateDangerAlarm(0);
      return;
    }
    if (renderer.hitTestAbilityButton(px, py)) {
      inputBuffer.push(InputAction.ABILITY);
      return;
    }
  }
  if (state.appState === AppState.PAUSED) {
    state.appState = AppState.PLAYING;
    music.resume();
    return;
  }
  if (state.appState === AppState.GAME_OVER) {
    // Check if share button was tapped
    if (hitRect(px, py, shareButtonRect)) {
      shareScore(state);
      return;
    }
    state.appState = AppState.MENU;
    menuTime = 0;
    resetDemo();
    return;
  }
});

function applySettings(): void {
  audio.sfxEnabled = save.sfxEnabled;
  music.setEnabled(save.musicEnabled);
  setHapticsEnabled(save.hapticsEnabled);
}

function startGame(): void {
  inputBuffer.clear();
  fx.clear();
  state = createInitialGameState(Date.now());
  gameOverScoreSaved = false;

  if (!save.onboardingComplete) {
    onboardingAge = 0;
    save.onboardingComplete = true;
    writeSave(save);
  } else {
    onboardingAge = -1;
  }

  music.start();
}

// Resize
window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight);
});

// --- Event processing ---
const COLOR_HEX: Record<number, string> = {
  0: '#ff4444', 1: '#4488ff', 2: '#44dd44', 3: '#ffdd44', 4: '#cc44ff',
};

function processEvents(): void {
  for (const event of state.events) {
    switch (event.type) {
      case 'pop':
        audio.pop(event.chain ?? 1);
        hapticMatch();
        if (event.groups) {
          let totalPoints = 0;
          for (const group of event.groups) {
            totalPoints += group.length * 10 * (event.chain ?? 1);
            for (const cell of group) {
              const pos = renderer.cellToScreen(cell.row, cell.col);
              fx.addPop(pos.x, pos.y, COLOR_HEX[cell.color] ?? '#ffffff');
              if (group.length >= 4) fx.addSparkle(pos.x, pos.y, '#ffffff');
            }
          }
          if (event.groups.length > 0) {
            const g = event.groups[0];
            const mid = g[Math.floor(g.length / 2)];
            const pos = renderer.cellToScreen(mid.row, mid.col);
            fx.addScorePop(pos.x, pos.y - 10, totalPoints);
          }
          if ((event.chain ?? 0) >= 2 && event.groups.length > 0) {
            const g = event.groups[0];
            const mid = g[Math.floor(g.length / 2)];
            const pos = renderer.cellToScreen(mid.row, mid.col);
            fx.addComboText(pos.x, pos.y - 30, `${event.chain}x CHAIN!`);
          }
        }
        break;
      case 'drop':
        audio.drop();
        hapticDrop();
        if (event.row !== undefined && event.col !== undefined) {
          const pos = renderer.cellToScreen(event.row, event.col);
          fx.addSquash(pos.x, pos.y, 'rgba(255,255,255,0.6)');
          // Precision drop bonus popup
          if (event.count && event.count > 0) {
            fx.addScorePop(pos.x, pos.y - 15, event.count);
          }
        }
        break;
      case 'chain':
        audio.chain(event.chain ?? 2);
        hapticChain(event.chain ?? 2);
        break;
      case 'move':
        audio.move();
        break;
      case 'rotate':
        audio.rotate();
        break;
      case 'game_over':
        audio.gameOver();
        hapticGameOver();
        audio.updateDangerAlarm(0);
        music.stop();
        if (!gameOverScoreSaved) {
          updateHighScores(save, state.score, state.stage, state.maxChain);
          gameOverScoreSaved = true;
        }
        break;
      case 'stage_up':
        audio.stageUp();
        renderer.triggerStageFlash();
        {
          const cam = renderer.getCamera();
          fx.addComboText(cam.logicalW / 2, cam.logicalH / 2 - 40, `STAGE ${state.stage + 1}!`);
          for (let i = 0; i < 6; i++) {
            fx.addSparkle(
              cam.logicalW / 2 + (Math.random() - 0.5) * 120,
              cam.logicalH / 2 + (Math.random() - 0.5) * 80,
              '#ffdd44',
            );
          }
        }
        break;
      case 'bomb_explode':
        audio.bombExplode();
        hapticBomb();
        if (event.row !== undefined && event.col !== undefined) {
          const pos = renderer.cellToScreen(event.row, event.col);
          fx.addPop(pos.x, pos.y, '#ff6600');
          fx.addPop(pos.x, pos.y, '#ffaa00');
          fx.addComboText(pos.x, pos.y - 20, 'BOOM!');
          for (let i = 0; i < 4; i++) {
            fx.addSparkle(
              pos.x + (Math.random() - 0.5) * 40,
              pos.y + (Math.random() - 0.5) * 40,
              '#ff8800',
            );
          }
        }
        break;
      case 'jelly_clear':
        audio.jellyClear();
        break;
      case 'unlock':
        audio.unlock();
        break;
      case 'crack':
        audio.crack();
        break;
      case 'ability_activate':
        audio.abilityActivate();
        hapticAbility();
        if (event.count) {
          const cam = renderer.getCamera();
          fx.addComboText(cam.logicalW / 2, cam.logicalH / 2, 'SUGAR BURST!');
          for (let i = 0; i < 8; i++) {
            fx.addSparkle(
              cam.logicalW / 2 + (Math.random() - 0.5) * 100,
              cam.logicalH / 2 + (Math.random() - 0.5) * 100,
              '#44ffaa',
            );
          }
        }
        break;
      case 'ability_ready':
        audio.abilityReady();
        break;
      case 'danger':
        audio.danger();
        break;
      case 'phase_change':
        if (event.text === 'pressure') {
          audio.phasePressure();
          renderer.triggerPhaseFlash('pressure');
          {
            const cam = renderer.getCamera();
            fx.addComboText(cam.logicalW / 2, cam.logicalH / 2 - 20, 'PRESSURE!');
          }
        } else if (event.text === 'break') {
          audio.phaseBreak();
          renderer.triggerPhaseFlash('break');
          {
            const cam = renderer.getCamera();
            fx.addComboText(cam.logicalW / 2, cam.logicalH / 2 - 20, 'BREAK!');
          }
        }
        break;
      case 'milestone':
        // Dramatic milestone announcement
        audio.chain(5); // strong chain sound as fanfare
        hapticBomb();
        {
          const cam = renderer.getCamera();
          const milestoneColors: Record<string, string> = {
            'BOMB RUSH': '#ff6600',
            'LOCKDOWN': '#8888ff',
            'STICKY SWAMP': '#ff88cc',
            'CRACKED GAUNTLET': '#ffaa44',
          };
          const color = milestoneColors[event.text ?? ''] ?? '#ff4444';
          fx.addComboText(cam.logicalW / 2, cam.logicalH / 2 + 20, event.text ?? 'MILESTONE');
          state.screenShake = 300;
          for (let i = 0; i < 12; i++) {
            fx.addSparkle(
              cam.logicalW / 2 + (Math.random() - 0.5) * 160,
              cam.logicalH / 2 + (Math.random() - 0.5) * 100,
              color,
            );
          }
          for (let i = 0; i < 4; i++) {
            fx.addPop(
              cam.logicalW / 2 + (Math.random() - 0.5) * 100,
              cam.logicalH / 2 + 20 + (Math.random() - 0.5) * 60,
              color,
            );
          }
        }
        break;
    }
  }
}

// --- Demo event processing (visual only, no audio/haptics) ---
function processDemoEvents(): void {
  for (const event of demoState.events) {
    switch (event.type) {
      case 'pop':
        if (event.groups) {
          for (const group of event.groups) {
            for (const cell of group) {
              const pos = renderer.cellToScreen(cell.row, cell.col);
              demoFx.addPop(pos.x, pos.y, COLOR_HEX[cell.color] ?? '#ffffff');
            }
          }
        }
        break;
      case 'drop':
        if (event.row !== undefined && event.col !== undefined) {
          const pos = renderer.cellToScreen(event.row, event.col);
          demoFx.addSquash(pos.x, pos.y, 'rgba(255,255,255,0.4)');
        }
        break;
      case 'game_over':
        // Restart demo on game over
        resetDemo();
        break;
    }
  }
}

// --- Game loop ---
let accumulator = 0;
let lastTime = performance.now();

function loop(now: number): void {
  const frameTime = Math.min(now - lastTime, 100);
  lastTime = now;

  const cam = renderer.getCamera();
  const ctx = (canvas.getContext('2d'))!;

  if (state.appState === AppState.BOOT) {
    introTime += frameTime;
    const dpr = cam.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const still = drawIntro(ctx, cam.logicalW, cam.logicalH, introTime);
    if (!still) {
      // Intro finished — play sting and transition to menu
      if (!introStingPlayed) {
        audio.introSting();
        introStingPlayed = true;
      }
      state.appState = AppState.MENU;
      menuTime = 0;
    }
  } else if (state.appState === AppState.MENU) {
    menuTime += frameTime;

    // --- Run demo simulation in background ---
    demoAccumulator += frameTime;
    while (demoAccumulator >= SIM_DT) {
      if (demoState.appState === AppState.PLAYING) {
        demoBotTick(demoState, demoInput);
        simulateTick(demoState, demoInput);
        processDemoEvents();
      } else if (demoState.appState === AppState.GAME_OVER) {
        resetDemo();
      }
      demoAccumulator -= SIM_DT;
    }
    demoFx.update(frameTime);

    // Render demo board behind menu (no HUD/overlays)
    const demoAlpha = demoAccumulator / SIM_DT;
    renderer.render(demoState, demoAlpha, frameTime, true);

    // Dim overlay so menu is readable
    const dpr = cam.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(26,10,46,0.5)';
    ctx.fillRect(0, 0, cam.logicalW, cam.logicalH);

    // Demo FX (rendered above dim but below menu text)
    ctx.save();
    demoFx.render(ctx);
    ctx.restore();

    // Menu UI on top
    drawMenu(ctx, cam.logicalW, cam.logicalH, save, menuTime);

    // Gear icon
    drawGearIcon(ctx, cam.logicalW, cam.logicalH);

    // Install banner — show after 3+ runs, if installable, not dismissed
    if (installAvailable && canInstall() && !save.installPromptDismissed && save.totalRuns >= 3 && !settingsOpen) {
      if (!showInstallBanner) {
        showInstallBanner = true;
        installBannerTime = 0;
      }
      installBannerTime += frameTime;
      drawInstallBanner(ctx, cam.logicalW, cam.logicalH, installBannerTime);
    } else {
      showInstallBanner = false;
    }

    // Settings overlay
    if (settingsOpen) {
      drawSettings(ctx, cam.logicalW, cam.logicalH, save, installAvailable && canInstall());
    }
  } else if (state.appState === AppState.PAUSED) {
    // Render the frozen game state (no simulation)
    fx.update(frameTime);
    renderer.render(state, 0, frameTime);

    // Pause overlay
    const dpr = cam.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderer.drawPauseOverlay(ctx, cam);
  } else if (state.appState === AppState.PLAYING || state.appState === AppState.GAME_OVER) {
    // Apply hit stop time dilation
    let effectiveFrameTime = frameTime;
    if (state.hitStopTimer > 0) {
      effectiveFrameTime = frameTime * state.hitStopScale;
      state.hitStopTimer -= frameTime; // decay in real-time, not dilated
      if (state.hitStopTimer <= 0) {
        state.hitStopTimer = 0;
        state.hitStopScale = 1.0;
      }
    }
    accumulator += effectiveFrameTime;

    while (accumulator >= SIM_DT) {
      if (state.appState === AppState.PLAYING) {
        simulateTick(state, inputBuffer);
        processEvents();
      }
      accumulator -= SIM_DT;
    }

    music.update(frameTime, state.dangerLevel);
    audio.updateDangerAlarm(state.dangerLevel);
    fx.update(frameTime);

    const alpha = accumulator / SIM_DT;
    renderer.render(state, alpha, frameTime);

    // Onboarding overlay
    if (onboardingAge >= 0) {
      const dpr = cam.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const showing = drawOnboarding(ctx, cam.logicalW, cam.logicalH, now, onboardingAge);
      onboardingAge += frameTime;
      if (!showing) onboardingAge = -1;
    }

    // Game over overlay with stats
    if (state.appState === AppState.GAME_OVER) {
      drawGameOverStats(ctx, cam, state);
    }
  }

  requestAnimationFrame(loop);
}

function drawGearIcon(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const size = Math.min(24, w * 0.055);
  const x = w - size - 12;
  const y = 12;

  ctx.save();
  ctx.fillStyle = '#666666';
  ctx.font = `${size}px monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('\u2699', x + size, y);
  ctx.restore();
}

function drawGameOverStats(ctx: CanvasRenderingContext2D, cam: ReturnType<typeof renderer.getCamera>, gs: GameState): void {
  const dpr = cam.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, cam.logicalW, cam.logicalH);

  const cx = cam.logicalW / 2;
  const cy = cam.logicalH / 2;
  const s = Math.min(24, cam.logicalW * 0.05);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ff4444';
  ctx.font = `700 ${s * 1.8}px Bangers, cursive`;
  ctx.fillText('GAME OVER', cx, cy - s * 4);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${s * 1.2}px Fredoka, sans-serif`;
  ctx.fillText(`${gs.score}`, cx, cy - s * 2);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = `400 ${s * 0.7}px Fredoka, sans-serif`;

  const time = Math.floor(gs.playTimeMs / 1000);
  const mins = Math.floor(time / 60);
  const secs = time % 60;

  ctx.fillText(`Stage ${gs.stage + 1}  \u00b7  Best Chain: ${gs.maxChain}x`, cx, cy);
  ctx.fillText(`Time: ${mins}:${secs.toString().padStart(2, '0')}`, cx, cy + s * 1.2);

  if (gs.score >= save.highScore && gs.score > 0) {
    ctx.fillStyle = '#ffdd44';
    ctx.font = `700 ${s * 0.9}px Bangers, cursive`;
    ctx.fillText('NEW HIGH SCORE!', cx, cy + s * 2.5);
  }

  // Share button
  const shareBtnW = s * 5;
  const shareBtnH = s * 1.6;
  const shareBtnX = cx - shareBtnW / 2;
  const shareBtnY = cy + s * 3.5;
  shareButtonRect = { x: shareBtnX, y: shareBtnY, w: shareBtnW, h: shareBtnH };

  const shareGrad = ctx.createLinearGradient(shareBtnX, shareBtnY, shareBtnX, shareBtnY + shareBtnH);
  shareGrad.addColorStop(0, '#4488ff');
  shareGrad.addColorStop(1, '#2266cc');
  ctx.fillStyle = shareGrad;
  roundRectFill(ctx, shareBtnX, shareBtnY, shareBtnW, shareBtnH, 8);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${s * 0.75}px Fredoka, sans-serif`;
  ctx.fillText('SHARE', cx, shareBtnY + shareBtnH / 2);

  ctx.fillStyle = '#666666';
  ctx.font = `400 ${s * 0.65}px Fredoka, sans-serif`;
  ctx.fillText('Tap to continue', cx, shareBtnY + shareBtnH + s * 1.2);

  ctx.textAlign = 'left';
}

function hitRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function roundRectFill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  if (w <= 0 || h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

async function shareScore(gs: GameState): Promise<void> {
  const time = Math.floor(gs.playTimeMs / 1000);
  const mins = Math.floor(time / 60);
  const secs = time % 60;
  const text = `Falling Candy Infinity\nScore: ${gs.score} | Stage ${gs.stage + 1} | Chain: ${gs.maxChain}x | ${mins}:${secs.toString().padStart(2, '0')}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Falling Candy Infinity', text });
    } catch { /* user cancelled */ }
  } else {
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* clipboard unavailable */ }
  }
}

requestAnimationFrame(loop);
