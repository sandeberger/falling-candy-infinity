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
