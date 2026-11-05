export class AudioManager {
  private ctx: AudioContext | null = null;
  public masterVolume = 0.7;
  public sfxVolume = 0.8;
  public bgmVolume = 0.4;
  public isMuted = false;

  private currentStageBgmInterval: any = null;
  private currentStageIndex = -1;

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const raw = localStorage.getItem('beast-evo-audio');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.masterVolume === 'number') this.masterVolume = parsed.masterVolume;
        if (typeof parsed.sfxVolume === 'number') this.sfxVolume = parsed.sfxVolume;
        if (typeof parsed.bgmVolume === 'number') this.bgmVolume = parsed.bgmVolume;
        if (typeof parsed.isMuted === 'boolean') this.isMuted = parsed.isMuted;
      }
    } catch {}
  }

  public saveSettings() {
    try {
      localStorage.setItem(
        'beast-evo-audio',
        JSON.stringify({
          masterVolume: this.masterVolume,
          sfxVolume: this.sfxVolume,
          bgmVolume: this.bgmVolume,
          isMuted: this.isMuted
        })
      );
    } catch {}
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public resume() {
    this.initContext();
  }

  private getEffectiveSfxVolume(): number {
    if (this.isMuted) return 0;
    return this.masterVolume * this.sfxVolume;
  }

  private getEffectiveBgmVolume(): number {
    if (this.isMuted) return 0;
    return this.masterVolume * this.bgmVolume;
  }

  // --- SOUND EFFECTS SYNTHESIZERS ---

  // 1. Taotie Bite (Low snap & crunch)
  public playBite() {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.12);

    gain.gain.setValueAtTime(vol * 0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  // 2. Nine-Tail Flame (Whoosh and sizzle)
  public playFire() {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.22);

    gain.gain.setValueAtTime(vol * 0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  // 3. Kui Thunder Strike (Deep crash & crackle)
  public playThunder() {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Sub oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.35);

    gain.gain.setValueAtTime(vol * 1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);

    // High zap transient
    const zap = this.ctx.createOscillator();
    const zapGain = this.ctx.createGain();
    zap.type = 'square';
    zap.frequency.setValueAtTime(880, t);
    zap.frequency.exponentialRampToValueAtTime(140, t + 0.12);

    zapGain.gain.setValueAtTime(vol * 0.4, t);
    zapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    zap.connect(zapGain);
    zapGain.connect(this.ctx.destination);
    zap.start(t);
    zap.stop(t + 0.15);
  }

  // 4. Dash Whoosh
  public playDash() {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.18);

    gain.gain.setValueAtTime(vol * 0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  // 5. Soul Crystal Absorption (Harmonious pentatonic chime)
  public playSoulPickup() {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const freq = notes[Math.floor(Math.random() * notes.length)];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(vol * 0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  // 6. Level Up Fanfare
  public playLevelUp() {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const chords = [440, 554.37, 659.25, 880]; // A major arpeggio
    chords.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = t + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, st);

      gain.gain.setValueAtTime(vol * 0.5, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(st);
      osc.stop(st + 0.4);
    });
  }

  // 7. Boss Alert Horn
  public playBossAlert() {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.8);

    gain.gain.setValueAtTime(vol * 0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.95);
  }

  // 8. Player Hit
  public playHit() {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);

    gain.gain.setValueAtTime(vol * 0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  // --- AMBIENT PROCEDURAL BACKGROUND MUSIC DRONE ---
  public setStageBgm(stageIndex: number) {
    if (this.currentStageIndex === stageIndex) return;
    this.currentStageIndex = stageIndex;
    this.stopStageBgm();

    const bgmVol = this.getEffectiveBgmVolume();
    if (bgmVol <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const baseFrequencies = stageIndex === 0
      ? [196, 261.63, 329.63, 392] // G3, C4, E4, G4 (Qingqiu mystic flute)
      : stageIndex === 1
        ? [130.81, 155.56, 196, 261.63] // C3, Eb3, G3, C4 (Yanhuo volcanic dark drone)
        : [110, 138.59, 164.81, 220]; // A2, C#3, E3, A3 (Qiongqi omen)

    const playHarmonicDrone = () => {
      if (!this.ctx || this.getEffectiveBgmVolume() <= 0) return;
      const t = this.ctx.currentTime;
      const freq = baseFrequencies[Math.floor(Math.random() * baseFrequencies.length)];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = stageIndex === 1 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(stageIndex === 1 ? 400 : 700, t);

      const dur = 4.0;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(this.getEffectiveBgmVolume() * 0.28, t + 1.5);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + dur + 0.1);
    };

    playHarmonicDrone();
    this.currentStageBgmInterval = setInterval(playHarmonicDrone, 3200);
  }

  public stopStageBgm() {
    if (this.currentStageBgmInterval) {
      clearInterval(this.currentStageBgmInterval);
      this.currentStageBgmInterval = null;
    }
  }
}

export const audio = new AudioManager();
