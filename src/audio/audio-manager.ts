// Preloaded sample buffers keyed by name
const sampleCache = new Map<string, HTMLAudioElement>();

function preload(name: string, url: string): void {
  const el = new Audio(url);
  el.preload = 'auto';
  sampleCache.set(name, el);
}

// Preload all samples on module load
preload('pop', '/sfx/pop.mp3');
preload('swoosh', '/sfx/swoosh.mp3');
preload('jingle', '/sfx/jingle.mp3');
preload('robot-double', '/sfx/robot-double.mp3');
preload('robot-triple', '/sfx/robot-triple.mp3');
preload('robot-amazing', '/sfx/robot-amazing.mp3');
preload('robot-unstoppable', '/sfx/robot-unstoppable.mp3');
preload('robot-levelup', '/sfx/robot-levelup.mp3');
preload('robot-stageclear', '/sfx/robot-stageclear.mp3');
preload('robot-gameover', '/sfx/robot-gameover.mp3');
preload('robot-sugarrush', '/sfx/robot-sugarrush.mp3');
preload('robot-ready', '/sfx/robot-ready.mp3');

export class AudioManager {
  private ctx: AudioContext | null = null;
  sfxEnabled = true;
  private alarmOsc: OscillatorNode | null = null;
  private alarmGain: GainNode | null = null;
  private alarmLfo: OscillatorNode | null = null;
  private alarmLfoGain: GainNode | null = null;
  private alarmActive = false;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(freq: number, duration: number, volume: number, type: OscillatorType = 'square'): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  /** Play a preloaded sample by name. Clones the audio element so overlapping plays work. */
  private playSample(name: string, volume = 0.5): void {
    if (!this.sfxEnabled) return;
    const src = sampleCache.get(name);
    if (!src) return;
    const clone = src.cloneNode(true) as HTMLAudioElement;
    clone.volume = volume;
    clone.play().catch(() => {});
  }

  pop(chain: number): void {
    this.playSample('pop', 0.5);
    // Synth layer — pitch rises with chain
    const baseFreq = 440 + chain * 80;
    this.playTone(baseFreq, 0.08, 0.06, 'sine');
  }

  drop(): void {
    this.playSample('swoosh', 0.4);
    // Synth thud
    this.playTone(120, 0.08, 0.08, 'triangle');
  }

  chain(depth: number): void {
    // Robot voice callout
    if (depth >= 5) {
      this.playSample('robot-unstoppable', 0.6);
    } else if (depth >= 4) {
      this.playSample('robot-amazing', 0.6);
    } else if (depth >= 3) {
      this.playSample('robot-triple', 0.6);
    } else {
      this.playSample('robot-double', 0.6);
    }
    // Synth fanfare layer
    const freq = 520 + depth * 100;
    this.playTone(freq, 0.12, 0.1, 'square');
    setTimeout(() => this.playTone(freq * 1.25, 0.1, 0.08, 'square'), 60);
  }

  move(): void {
    this.playTone(300, 0.03, 0.05, 'square');
  }

  rotate(): void {
    this.playTone(400, 0.04, 0.06, 'sine');
  }

  gameOver(): void {
    this.stopAlarm();
    this.playSample('robot-gameover', 0.7);
    // Synth descend
    this.playTone(200, 0.3, 0.1, 'sawtooth');
    setTimeout(() => this.playTone(150, 0.4, 0.08, 'sawtooth'), 200);
    setTimeout(() => this.playTone(100, 0.5, 0.06, 'sawtooth'), 400);
  }

  stageUp(): void {
    this.playSample('jingle', 0.5);
    setTimeout(() => this.playSample('robot-levelup', 0.6), 500);
    // Synth chime
    this.playTone(600, 0.1, 0.08, 'sine');
    setTimeout(() => this.playTone(800, 0.1, 0.08, 'sine'), 80);
    setTimeout(() => this.playTone(1000, 0.15, 0.06, 'sine'), 160);
  }

  boardClear(): void {
    this.playSample('robot-stageclear', 0.6);
  }

  bombExplode(): void {
    this.playTone(80, 0.3, 0.25, 'sawtooth');
    this.playTone(60, 0.4, 0.2, 'square');
    setTimeout(() => this.playTone(40, 0.3, 0.15, 'sawtooth'), 100);
  }

  jellyClear(): void {
    this.playTone(600, 0.12, 0.12, 'sine');
    setTimeout(() => this.playTone(800, 0.1, 0.1, 'sine'), 50);
  }

  unlock(): void {
    this.playTone(500, 0.08, 0.1, 'triangle');
    this.playTone(700, 0.08, 0.1, 'triangle');
  }

  crack(): void {
    this.playTone(200, 0.06, 0.12, 'sawtooth');
  }

  abilityActivate(): void {
    this.playSample('robot-sugarrush', 0.7);
    // Synth power-up sweep
    this.playTone(400, 0.1, 0.1, 'sine');
    setTimeout(() => this.playTone(600, 0.1, 0.08, 'sine'), 60);
    setTimeout(() => this.playTone(800, 0.1, 0.06, 'sine'), 120);
  }

  abilityReady(): void {
    this.playSample('robot-ready', 0.6);
    // Synth ping
    this.playTone(880, 0.08, 0.06, 'sine');
  }

  danger(): void {
    this.playTone(150, 0.2, 0.1, 'square');
    setTimeout(() => this.playTone(150, 0.2, 0.1, 'square'), 300);
  }

  /** Call every frame — starts/stops a pulsing alarm based on danger level */
  updateDangerAlarm(dangerLevel: number): void {
    if (!this.sfxEnabled) {
      if (this.alarmActive) this.stopAlarm();
      return;
    }

    const shouldAlarm = dangerLevel > 0.5;

    if (shouldAlarm && !this.alarmActive) {
      this.startAlarm(dangerLevel);
    } else if (!shouldAlarm && this.alarmActive) {
      this.stopAlarm();
    } else if (shouldAlarm && this.alarmActive && this.alarmGain) {
      const intensity = (dangerLevel - 0.5) * 2;
      this.alarmGain.gain.value = 0.06 + intensity * 0.08;
    }
  }

  private startAlarm(dangerLevel: number): void {
    const ctx = this.ensureCtx();

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 220;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.value = 3;
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const gain = ctx.createGain();
    const intensity = Math.max(0, (dangerLevel - 0.5) * 2);
    gain.gain.value = 0.06 + intensity * 0.08;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    lfo.start();

    this.alarmOsc = osc;
    this.alarmGain = gain;
    this.alarmLfo = lfo;
    this.alarmLfoGain = lfoGain;
    this.alarmActive = true;
  }

  private stopAlarm(): void {
    try { this.alarmOsc?.stop(); } catch { /* already stopped */ }
    try { this.alarmOsc?.disconnect(); } catch { /* ok */ }
    try { this.alarmLfo?.stop(); } catch { /* already stopped */ }
    try { this.alarmLfo?.disconnect(); } catch { /* ok */ }
    try { this.alarmLfoGain?.disconnect(); } catch { /* ok */ }
    try { this.alarmGain?.disconnect(); } catch { /* ok */ }
    this.alarmOsc = null;
    this.alarmLfo = null;
    this.alarmLfoGain = null;
    this.alarmGain = null;
    this.alarmActive = false;
  }

  phasePressure(): void {
    // Tense rising tone — urgency
    this.playTone(250, 0.12, 0.12, 'sawtooth');
    setTimeout(() => this.playTone(350, 0.12, 0.1, 'sawtooth'), 80);
    setTimeout(() => this.playTone(500, 0.15, 0.08, 'square'), 160);
  }

  phaseBreak(): void {
    // Soft descending chime — relief
    this.playTone(800, 0.15, 0.1, 'sine');
    setTimeout(() => this.playTone(600, 0.15, 0.1, 'sine'), 100);
    setTimeout(() => this.playTone(500, 0.2, 0.08, 'triangle'), 200);
  }

  introSting(): void {
    this.playSample('jingle', 0.5);
    // Synth shimmer
    this.playTone(330, 0.2, 0.06, 'sine');
    setTimeout(() => this.playTone(440, 0.2, 0.06, 'sine'), 100);
    setTimeout(() => this.playTone(660, 0.15, 0.06, 'sine'), 250);
  }

  destroy(): void {
    this.stopAlarm();
    this.ctx?.close();
    this.ctx = null;
  }
}
