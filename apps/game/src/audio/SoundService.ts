/**
 * Áudio procedural via WebAudio (sem assets — placeholders até a arte final).
 * Regra mobile: o contexto só destrava após gesto do usuário — chame
 * `unlock()` no primeiro pointerdown de cada cena.
 */

type ToneType = OscillatorType;

class SoundService {
  private ctx: AudioContext | null = null;
  muted = false;

  unlock(): void {
    try {
      if (!this.ctx && typeof AudioContext !== 'undefined') this.ctx = new AudioContext();
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, duration: number, type: ToneType, gain: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  click(): void {
    this.tone(600, 0.05, 'triangle', 0.15);
  }

  kick(): void {
    this.tone(160, 0.09, 'square', 0.25);
  }

  pass(): void {
    this.tone(440, 0.07, 'triangle', 0.2);
  }

  goal(): void {
    this.tone(523, 0.12, 'triangle', 0.25);
    this.tone(659, 0.12, 'triangle', 0.25, 0.11);
    this.tone(784, 0.22, 'triangle', 0.3, 0.22);
  }

  fail(): void {
    this.tone(220, 0.15, 'sawtooth', 0.18);
    this.tone(150, 0.3, 'sawtooth', 0.18, 0.14);
  }

  perfect(): void {
    this.tone(659, 0.09, 'square', 0.22);
    this.tone(880, 0.09, 'square', 0.22, 0.09);
    this.tone(1175, 0.16, 'square', 0.26, 0.18);
  }
}

export const sound = new SoundService();
