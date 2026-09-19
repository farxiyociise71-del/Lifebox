/**
 * Audio Feedback and Haptic Vibration Engine for LIFEBOX
 * Built using Web Audio API and Navigator Haptic Vibration API
 */

class SoundAndVibrationManager {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private vibrationEnabled: boolean = true;
  private speechEnabled: boolean = true;

  constructor() {
    // Load persisted preferences if available
    try {
      const s = localStorage.getItem('lifebox_sound_enabled');
      if (s !== null) this.soundEnabled = s === 'true';

      const v = localStorage.getItem('lifebox_vibration_enabled');
      if (v !== null) this.vibrationEnabled = v === 'true';

      const sp = localStorage.getItem('lifebox_speech_enabled');
      if (sp !== null) this.speechEnabled = sp === 'true';
    } catch {
      // Ignore in strict privacy mode
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('lifebox_sound_enabled', String(enabled));
    } catch {}
  }

  public isVibrationEnabled(): boolean {
    return this.vibrationEnabled;
  }

  public setVibrationEnabled(enabled: boolean): void {
    this.vibrationEnabled = enabled;
    try {
      localStorage.setItem('lifebox_vibration_enabled', String(enabled));
    } catch {}
  }

  public isSpeechEnabled(): boolean {
    return this.speechEnabled;
  }

  public setSpeechEnabled(enabled: boolean): void {
    this.speechEnabled = enabled;
    try {
      localStorage.setItem('lifebox_speech_enabled', String(enabled));
    } catch {}
  }

  /**
   * Haptic vibration with hardware trigger and fallback acoustic pulse
   */
  public vibrate(pattern: number | number[] = 30): void {
    if (!this.vibrationEnabled) return;

    // Physical vibration for mobile devices / supporting hardware
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }

    // Acoustic low-frequency vibration resonance (simulates haptics through speakers/headphones)
    if (this.soundEnabled) {
      this.playLowFrequencyHapticTone();
    }
  }

  /**
   * Subtle low-frequency buzz that gives auditory haptic sensation
   */
  private playLowFrequencyHapticTone(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(150, ctx.currentTime);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(65, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  }

  /**
   * Microphone start sound (pleasant rising chime) + crisp haptic pulse
   */
  public playMicStart(): void {
    this.vibrate([40]);
    if (!this.soundEnabled) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.19);
    } catch {}
  }

  /**
   * Microphone stop sound (gentle falling chime) + double haptic pulse
   */
  public playMicStop(): void {
    this.vibrate([25, 30, 25]);
    if (!this.soundEnabled) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.19);
    } catch {}
  }

  /**
   * Voice Command Recognized / Action executed sound + energetic haptic
   */
  public playCommandSuccess(): void {
    this.vibrate([35, 40, 50]);
    if (!this.soundEnabled) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 triad

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.1, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.19);
      });
    } catch {}
  }

  /**
   * Message sent sound (subtle soft pop)
   */
  public playSendSound(): void {
    this.vibrate(25);
    if (!this.soundEnabled) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.07);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {}
  }

  /**
   * Incoming response chime (pleasant double tone)
   */
  public playReceiveSound(): void {
    this.vibrate([30, 40, 40]);
    if (!this.soundEnabled) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.09, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1); // A5
      gain2.gain.setValueAtTime(0.09, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.1);
      osc2.stop(now + 0.27);
    } catch {}
  }

  /**
   * Speak text out loud using Web Speech Synthesis API
   */
  public speakText(text: string, onEnd?: () => void): void {
    if (!this.speechEnabled) {
      if (onEnd) onEnd();
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any pending speech

      // Clean text of markdown characters or links
      const clean = text
        .replace(/[*_~`#>]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\n+/g, ' ')
        .trim();

      if (!clean) {
        if (onEnd) onEnd();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(clean.slice(0, 300));
      utterance.lang = 'en-US';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      if (onEnd) onEnd();
    }
  }

  public stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }
}

export const SoundEngine = new SoundAndVibrationManager();
