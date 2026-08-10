/**
 * SFX Module — Interactive sound effects using Web Audio API.
 * Ported from the original app: generates sounds programmatically,
 * no external audio files needed.
 */

class SFXClass {
  private ctx: AudioContext | null = null;
  enabled = true;

  init(): void {
    if (typeof window === 'undefined') return;
    // Use a named handler so it can be removed if needed (prevents duplicate registration)
    const handler = () => {
      if (this.ctx) {
        try {
          this.ctx.close();
        } catch {
          // ignore
        }
        this.ctx = null;
      }
    };
    window.addEventListener('beforeunload', handler);
  }

  /** Lazy-init AudioContext (browsers require user interaction first) */
  private ensureCtx(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        this.ctx = new Ctor();
      } catch {
        return false;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  /** Play a tone with given parameters */
  tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.15,
    when = 0,
  ): void {
    if (!this.enabled || !this.ensureCtx() || !this.ctx) return;

    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  /** Play a chord (multiple tones at once) */
  chord(
    freqs: number[],
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.1,
  ): void {
    freqs.forEach((f) => this.tone(f, duration, type, volume));
  }

  // ===== Sound Effects =====

  /** UI button click */
  click(): void {
    this.tone(800, 0.05, 'sine', 0.08);
  }

  /** Card flip */
  flip(): void {
    if (!this.enabled || !this.ensureCtx() || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /** Correct answer (ascending happy tones) */
  correct(): void {
    this.tone(523.25, 0.1, 'sine', 0.12, 0); // C5
    this.tone(659.25, 0.1, 'sine', 0.12, 0.08); // E5
    this.tone(783.99, 0.15, 'sine', 0.12, 0.16); // G5
  }

  /** Wrong answer (descending buzzer) */
  wrong(): void {
    this.tone(300, 0.08, 'sawtooth', 0.1, 0);
    this.tone(200, 0.12, 'sawtooth', 0.1, 0.07);
  }

  /** Success / completion (fanfare) */
  success(): void {
    this.tone(523.25, 0.12, 'sine', 0.1, 0); // C5
    this.tone(659.25, 0.12, 'sine', 0.1, 0.1); // E5
    this.tone(783.99, 0.12, 'sine', 0.1, 0.2); // G5
    this.tone(1046.5, 0.25, 'sine', 0.12, 0.3); // C6
  }

  /** Check-in celebration */
  checkin(): void {
    this.tone(659.25, 0.1, 'sine', 0.1, 0); // E5
    this.tone(880, 0.1, 'sine', 0.1, 0.08); // A5
    this.tone(1046.5, 0.2, 'sine', 0.12, 0.16); // C6
  }

  /** Navigation tick */
  navigate(): void {
    this.tone(600, 0.04, 'sine', 0.06);
  }

  /** Toggle switch */
  toggle(): void {
    this.tone(500, 0.04, 'square', 0.05);
    this.tone(700, 0.04, 'square', 0.05, 0.03);
  }

  /** Add to wordbook */
  add(): void {
    this.tone(700, 0.06, 'sine', 0.08);
    this.tone(900, 0.08, 'sine', 0.08, 0.05);
  }

  /** Remove from wordbook */
  remove(): void {
    this.tone(400, 0.06, 'sine', 0.08);
    this.tone(300, 0.08, 'sine', 0.08, 0.05);
  }

  /** Error / warning */
  error(): void {
    this.tone(250, 0.15, 'sawtooth', 0.08);
  }

  /** Set enabled state */
  setEnabled(enabled: boolean, playSound = true): void {
    this.enabled = enabled;
    if (enabled && playSound) this.click();
  }
}

export const sfx = new SFXClass();

// Auto-init on browser load
if (typeof window !== 'undefined') {
  sfx.init();
}
