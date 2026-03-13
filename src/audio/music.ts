/**
 * Music engine — plays a looping MP3 track.
 * Preloads the audio on construction so it's ready when start() is called.
 */
export class MusicEngine {
  private audio: HTMLAudioElement;
  private running = false;
  private wantPlay = false; // true if start() was called but audio wasn't ready
  enabled = true;

  constructor(src: string) {
    const el = new Audio(src);
    el.loop = true;
    el.volume = 0.45;
    el.preload = 'auto';
    // When audio becomes playable, auto-start if we were waiting
    el.addEventListener('canplaythrough', () => {
      if (this.wantPlay && !this.running) {
        this.tryPlay();
      }
    }, { once: true });
    this.audio = el;
  }

  start(): void {
    if (this.running || !this.enabled) return;
    this.wantPlay = true;
    this.tryPlay();
  }

  private tryPlay(): void {
    if (this.running) return;
    this.audio.play()
      .then(() => {
        this.running = true;
        this.wantPlay = false;
      })
      .catch(() => {
        // Autoplay blocked or not loaded yet — retry on next user interaction
        const retry = () => {
          if (this.wantPlay && !this.running) {
            this.audio.play()
              .then(() => {
                this.running = true;
                this.wantPlay = false;
              })
              .catch(() => {});
          }
          document.removeEventListener('pointerdown', retry);
          document.removeEventListener('keydown', retry);
        };
        document.addEventListener('pointerdown', retry, { once: true });
        document.addEventListener('keydown', retry, { once: true });
      });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_dt: number, _dangerLevel: number): void {
    // Nothing to do — the <audio> element loops on its own
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
    if (!this.running && !this.wantPlay) return;
    this.running = false;
    this.wantPlay = false;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && (this.running || this.wantPlay)) {
      this.stop();
    }
  }
}
