/**
 * Procedural adaptive music: 3 layers that crossfade based on intensity.
 * Layer 0 (calm): soft pad
 * Layer 1 (pulse): rhythmic arpeggios
 * Layer 2 (intense): driving bass + high synth
 */
export class MusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private layers: { osc: OscillatorNode; gain: GainNode }[] = [];
  private running = false;
  private intensity = 0; // 0=calm, 1=pulse, 2=intense
  private targetVolumes = [0.06, 0, 0];
  private stepTimer = 0;
  private step = 0;
  enabled = true;

  // Pentatonic scale notes for pleasant arpeggios
  private readonly NOTES = [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63];

  start(): void {
    if (this.running || !this.enabled) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);

    // Layer 0: Calm pad
    this.addLayer('sine', 130.81, 0.06);
    // Layer 1: Pulse arp
    this.addLayer('triangle', 196.00, 0);
    // Layer 2: Intense bass
    this.addLayer('sawtooth', 65.41, 0);

    this.running = true;
  }

  private addLayer(type: OscillatorType, freq: number, vol: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    this.layers.push({ osc, gain });
  }

  update(dt: number, dangerLevel: number): void {
    if (!this.running || !this.ctx) return;

    // Set intensity from danger
    if (dangerLevel > 0.6) {
      this.intensity = 2;
    } else if (dangerLevel > 0.3) {
      this.intensity = 1;
    } else {
      this.intensity = 0;
    }

    // Target volumes per layer
    this.targetVolumes[0] = 0.06;
    this.targetVolumes[1] = this.intensity >= 1 ? 0.04 : 0;
    this.targetVolumes[2] = this.intensity >= 2 ? 0.03 : 0;

    // Smooth crossfade
    const fadeSpeed = 0.002 * dt;
    for (let i = 0; i < this.layers.length; i++) {
      const current = this.layers[i].gain.gain.value;
      const target = this.targetVolumes[i];
      const diff = target - current;
      this.layers[i].gain.gain.value = current + diff * fadeSpeed;
    }

    // Arpeggio stepping for layer 1
    this.stepTimer += dt;
    if (this.stepTimer > 250) {
      this.stepTimer = 0;
      this.step = (this.step + 1) % this.NOTES.length;
      if (this.layers[1]) {
        this.layers[1].osc.frequency.value = this.NOTES[this.step];
      }
      // Layer 2: octave down pattern
      if (this.layers[2] && this.intensity >= 2) {
        this.layers[2].osc.frequency.value = this.NOTES[this.step % 4] * 0.5;
      }
    }
  }

  pause(): void {
    if (!this.running || !this.ctx) return;
    this.ctx.suspend();
  }

  resume(): void {
    if (!this.running || !this.ctx) return;
    this.ctx.resume();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    for (const layer of this.layers) {
      layer.osc.stop();
      layer.osc.disconnect();
      layer.gain.disconnect();
    }
    this.layers = [];
    this.masterGain?.disconnect();
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.running) {
      this.stop();
    }
  }
}
