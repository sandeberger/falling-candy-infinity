export class AudioManager {
  private ctx: AudioContext | null = null;
  sfxEnabled = true;

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

  pop(chain: number): void {
    const baseFreq = 440 + chain * 80;
    this.playTone(baseFreq, 0.1, 0.15, 'sine');
    this.playTone(baseFreq * 1.5, 0.08, 0.1, 'sine');
  }

  drop(): void {
    this.playTone(120, 0.08, 0.12, 'triangle');
  }

  chain(depth: number): void {
    const freq = 520 + depth * 100;
    this.playTone(freq, 0.15, 0.2, 'square');
    setTimeout(() => this.playTone(freq * 1.25, 0.12, 0.15, 'square'), 60);
  }

  move(): void {
    this.playTone(300, 0.03, 0.05, 'square');
  }

  rotate(): void {
    this.playTone(400, 0.04, 0.06, 'sine');
  }

  gameOver(): void {
    this.playTone(200, 0.3, 0.2, 'sawtooth');
    setTimeout(() => this.playTone(150, 0.4, 0.15, 'sawtooth'), 200);
    setTimeout(() => this.playTone(100, 0.5, 0.12, 'sawtooth'), 400);
  }

  stageUp(): void {
    this.playTone(600, 0.1, 0.15, 'sine');
    setTimeout(() => this.playTone(800, 0.1, 0.15, 'sine'), 80);
    setTimeout(() => this.playTone(1000, 0.15, 0.12, 'sine'), 160);
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
    this.playTone(400, 0.1, 0.2, 'sine');
    setTimeout(() => this.playTone(600, 0.1, 0.18, 'sine'), 60);
    setTimeout(() => this.playTone(800, 0.1, 0.16, 'sine'), 120);
    setTimeout(() => this.playTone(1200, 0.2, 0.2, 'sine'), 180);
  }

  abilityReady(): void {
    this.playTone(880, 0.08, 0.12, 'sine');
    setTimeout(() => this.playTone(880, 0.08, 0.12, 'sine'), 120);
  }

  danger(): void {
    this.playTone(150, 0.2, 0.1, 'square');
    setTimeout(() => this.playTone(150, 0.2, 0.1, 'square'), 300);
  }

  destroy(): void {
    this.ctx?.close();
    this.ctx = null;
  }
}
