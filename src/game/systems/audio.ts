import type { GameSettings } from "../types";

export class AudioDirector {
  private context: AudioContext | null = null;
  private settings: GameSettings;
  private ambience: OscillatorNode[] = [];

  constructor(settings: GameSettings) {
    this.settings = settings;
  }

  update(settings: GameSettings) {
    this.settings = settings;
  }

  unlock() {
    if (!this.context && typeof window !== "undefined") {
      this.context = new AudioContext();
    }
    void this.context?.resume();
  }

  tone(frequency: number, duration = 0.09, volume = 0.08, type: OscillatorType = "square") {
    this.unlock();
    const ctx = this.context;
    if (!ctx || this.settings.effects <= 0) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume * this.settings.effects, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }

  step() { this.tone(72, 0.025, 0.018, "triangle"); }
  interact() { this.tone(420, 0.08, 0.05); }
  pickup() { this.tone(520, 0.06, 0.06); setTimeout(() => this.tone(760, 0.1, 0.05), 55); }
  denied() { this.tone(120, 0.13, 0.055, "sawtooth"); }
  attack() { this.tone(165, 0.08, 0.06, "sawtooth"); }
  success() { [392, 523, 659].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 0.055), i * 90)); }
  hurt() { this.tone(84, 0.22, 0.09, "sawtooth"); }

  stop() {
    this.ambience.forEach((node) => node.stop());
    this.ambience = [];
  }
}
