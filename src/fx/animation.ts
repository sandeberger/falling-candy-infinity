export type FXType = 'pop' | 'squash' | 'combo_text' | 'score_pop' | 'sparkle';

export interface FX {
  type: FXType;
  x: number;
  y: number;
  age: number;
  duration: number;
  color: string;
  text?: string;
  value?: number;
}

export class FXManager {
  private effects: FX[] = [];

  addPop(x: number, y: number, color: string): void {
    this.effects.push({ type: 'pop', x, y, age: 0, duration: 300, color });
  }

  addSquash(x: number, y: number, color: string): void {
    this.effects.push({ type: 'squash', x, y, age: 0, duration: 200, color });
  }

  addComboText(x: number, y: number, text: string): void {
    this.effects.push({ type: 'combo_text', x, y, age: 0, duration: 1200, color: '#ffdd44', text });
  }

  addScorePop(x: number, y: number, points: number): void {
    this.effects.push({ type: 'score_pop', x, y, age: 0, duration: 800, color: '#ffffff', value: points });
  }

  addSparkle(x: number, y: number, color: string): void {
    this.effects.push({ type: 'sparkle', x, y, age: 0, duration: 400, color });
  }

  update(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].age += dt;
      if (this.effects[i].age >= this.effects[i].duration) {
        this.effects.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const fx of this.effects) {
      const t = fx.age / fx.duration;
      switch (fx.type) {
        case 'pop': this.renderPop(ctx, fx, t); break;
        case 'squash': this.renderSquash(ctx, fx, t); break;
        case 'combo_text': this.renderComboText(ctx, fx, t); break;
        case 'score_pop': this.renderScorePop(ctx, fx, t); break;
        case 'sparkle': this.renderSparkle(ctx, fx, t); break;
      }
    }
  }

  private renderPop(ctx: CanvasRenderingContext2D, fx: FX, t: number): void {
    const alpha = 1 - t * t; // ease out

    // Expanding ring
    const radius = 6 + t * 28;
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 3 * (1 - t);
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner flash
    if (t < 0.15) {
      ctx.globalAlpha = (1 - t / 0.15) * 0.4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 8 * (1 - t / 0.15), 0, Math.PI * 2);
      ctx.fill();
    }

    // Burst particles
    const count = 8;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + t * 0.5;
      const dist = t * 30 + Math.sin(t * Math.PI) * 5;
      const px = fx.x + Math.cos(angle) * dist;
      const py = fx.y + Math.sin(angle) * dist;
      const size = 4 * (1 - t);
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = i % 2 === 0 ? fx.color : '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderSquash(ctx: CanvasRenderingContext2D, fx: FX, t: number): void {
    // Elastic bounce: wide+short → overshoot → settle
    const bounce = Math.sin(t * Math.PI * 2.5) * Math.exp(-t * 4);
    const scaleX = 1 + bounce * 0.4;
    const scaleY = 1 - bounce * 0.3;

    ctx.globalAlpha = 0.5 * (1 - t);
    ctx.fillStyle = fx.color;
    ctx.save();
    ctx.translate(fx.x, fx.y);
    ctx.scale(scaleX, scaleY);
    ctx.fillRect(-14, -14, 28, 28);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private renderComboText(ctx: CanvasRenderingContext2D, fx: FX, t: number): void {
    // Pop in, float up, fade out
    const fadeIn = Math.min(t / 0.1, 1);
    const fadeOut = t > 0.4 ? 1 - (t - 0.4) / 0.6 : 1;
    const alpha = fadeIn * fadeOut;
    const yOff = -t * 60;

    // Scale: pop in big then settle
    const scale = t < 0.1 ? 0.3 + 3 * (t / 0.1) : 1 + 0.15 * Math.sin((t - 0.1) * 4);

    ctx.globalAlpha = Math.max(0, alpha);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = `bold ${Math.round(22 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fx.text ?? '', fx.x + 2, fx.y + yOff + 2);

    // Main text
    ctx.fillStyle = fx.color;
    ctx.fillText(fx.text ?? '', fx.x, fx.y + yOff);

    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  private renderScorePop(ctx: CanvasRenderingContext2D, fx: FX, t: number): void {
    const alpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
    const yOff = -t * 35;

    ctx.globalAlpha = Math.max(0, alpha * 0.9);
    ctx.fillStyle = fx.color;
    ctx.font = `bold 14px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${fx.value ?? 0}`, fx.x, fx.y + yOff);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  private renderSparkle(ctx: CanvasRenderingContext2D, fx: FX, t: number): void {
    const alpha = 1 - t;
    const count = 4;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + t * Math.PI;
      const dist = 4 + t * 18;
      const px = fx.x + Math.cos(angle) * dist;
      const py = fx.y + Math.sin(angle) * dist;

      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = fx.color;

      // Star shape
      const size = 3 * (1 - t * 0.5);
      ctx.beginPath();
      ctx.moveTo(px, py - size);
      ctx.lineTo(px + size * 0.3, py - size * 0.3);
      ctx.lineTo(px + size, py);
      ctx.lineTo(px + size * 0.3, py + size * 0.3);
      ctx.lineTo(px, py + size);
      ctx.lineTo(px - size * 0.3, py + size * 0.3);
      ctx.lineTo(px - size, py);
      ctx.lineTo(px - size * 0.3, py - size * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.effects.length = 0;
  }

  get count(): number {
    return this.effects.length;
  }
}
