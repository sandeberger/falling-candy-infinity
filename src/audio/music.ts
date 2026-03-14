/**
 * Music engine — plays a looping MP3 track.
 * Creates a fresh Audio element inside start() so it's within the
 * user-gesture context that mobile browsers require for autoplay.
 */
export class MusicEngine {
  private audio: HTMLAudioElement | null = null;
  private running = false;
  private src: string;
  enabled = true;

  constructor(src: string) {
    this.src = src;
  }

  start(): void {
    if (this.running || !this.enabled) return;

    // Create element inside user gesture — critical for mobile autoplay
    if (!this.audio) {
      const el = new Audio(this.src);
      el.loop = true;
      el.volume = 0.45;
      this.audio = el;
    }

    const el = this.audio;
    el.play()
      .then(() => { this.running = true; })
      .catch(() => {
        // Not ready yet — retry when buffered enough
        const onReady = () => {
          if (!this.running && this.enabled) {
            el.play()
              .then(() => { this.running = true; })
              .catch(() => {});
          }
        };
        el.addEventListener('canplaythrough', onReady, { once: true });
      });
  }

  update(_dt: number, dangerLevel: number, pressure = false, chain = 0): void {
    if (!this.audio || !this.running) return;

    // Pressure phase: slightly faster playback (1.0 → 1.08)
    const targetRate = pressure ? 1.08 : 1.0;
    this.audio.playbackRate += (targetRate - this.audio.playbackRate) * 0.02;

    // Volume boost at high danger / big combos (base 0.45 → up to 0.65)
    const dangerBoost = Math.max(0, dangerLevel - 0.3) * 0.2;
    const chainBoost = Math.min(chain * 0.03, 0.12);
    const targetVol = Math.min(0.45 + dangerBoost + chainBoost, 0.65);
    this.audio.volume += (targetVol - this.audio.volume) * 0.03;
  }

  pause(): void {
    if (!this.running || !this.audio) return;
    this.audio.pause();
  }

  resume(): void {
    if (!this.running || !this.audio) return;
    this.audio.play().catch(() => {});
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.running) {
      this.stop();
    }
  }
}
