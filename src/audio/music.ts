/**
 * Music engine — plays a looping MP3 track.
 * Keeps the same public API so the rest of the game is unchanged.
 */
export class MusicEngine {
  private audio: HTMLAudioElement | null = null;
  private running = false;
  enabled = true;

  start(): void {
    if (this.running || !this.enabled) return;

    const el = new Audio('/music.mp3');
    el.loop = true;
    el.volume = 0.45;
    el.play().catch(() => {
      // Autoplay blocked — will retry on next user interaction
      const resume = () => {
        el.play().catch(() => {});
        document.removeEventListener('pointerdown', resume);
        document.removeEventListener('keydown', resume);
      };
      document.addEventListener('pointerdown', resume, { once: true });
      document.addEventListener('keydown', resume, { once: true });
    });

    this.audio = el;
    this.running = true;
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
      this.audio.src = '';
      this.audio = null;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.running) {
      this.stop();
    }
  }
}
