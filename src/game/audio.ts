import type { RadioStation } from './types';

export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private skidGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private radioGain: GainNode | null = null;
  private radioTimer: number | null = null;
  private radioStep = 0;

  private muted = false;
  private station: RadioStation = 'vice-wave';
  private initialized = false;

  public unlock() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.45;
      this.masterGain.connect(this.ctx.destination);

      // Engine synth
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;

      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.value = 28;

      this.engineOsc.connect(engineFilter);
      this.engineSubOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();
      this.engineSubOsc.start();

      // Tire skid noise
      const bufferSize = this.ctx.sampleRate * 1.5;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const skidFilter = this.ctx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 1400;
      skidFilter.Q.value = 4.5;

      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.value = 0;

      noiseSource.connect(skidFilter);
      skidFilter.connect(this.skidGain);
      this.skidGain.connect(this.masterGain);
      noiseSource.start();

      // Police siren
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 640;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.masterGain);
      this.sirenOsc.start();

      // Radio bus
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0.22;
      this.radioGain.connect(this.masterGain);

      this.initialized = true;
      this.startRadioLoop();
    } catch {
      // Audio unavailable
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.45, this.ctx.currentTime, 0.04);
    }
  }

  public setStation(station: RadioStation) {
    this.station = station;
  }

  public updateContinuous(
    inVehicle: boolean,
    speedNorm: number,
    drifting: boolean,
    policeNear: number,
    elapsed: number,
    started: boolean,
  ) {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.engineGain && this.engineOsc && this.engineSubOsc) {
      const targetGain = inVehicle && started ? 0.14 + speedNorm * 0.12 : 0;
      const baseFreq = 46 + speedNorm * 120;
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.06);
      this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
      this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
    }

    if (this.skidGain) {
      const targetSkid = inVehicle && drifting && speedNorm > 0.2 ? 0.11 : 0;
      this.skidGain.gain.setTargetAtTime(targetSkid, now, 0.05);
    }

    if (this.sirenGain && this.sirenOsc) {
      const targetSiren = started && policeNear > 0.05 ? Math.min(0.11, policeNear * 0.11) : 0;
      const wail = 660 + Math.sin(elapsed * 5.8) * 210;
      this.sirenGain.gain.setTargetAtTime(targetSiren, now, 0.08);
      this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.04);
    }

    if (this.radioGain) {
      const radioActive = started && inVehicle && this.station !== 'off';
      this.radioGain.gain.setTargetAtTime(radioActive ? 0.2 : 0, now, 0.15);
    }
  }

  public playImpact(intensity = 0.7) {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.18);
    gain.gain.setValueAtTime(Math.min(0.45, intensity * 0.4), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playDoorChime() {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playCashChime() {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.25);
    });
  }

  private startRadioLoop() {
    if (this.radioTimer !== null) return;
    // 116 BPM eighth-note synthwave / Leonida bass sequencer
    const stepMs = 130;
    const viceWaveBass = [110, 110, 130.81, 146.83, 164.81, 146.83, 130.81, 98];
    const viceWaveLead = [440, 0, 523.25, 659.25, 587.33, 0, 523.25, 392];
    const leonidaBass = [82.41, 82.41, 98, 82.41, 110, 98, 82.41, 73.42];
    const leonidaPluck = [329.63, 392, 0, 493.88, 440, 0, 392, 329.63];

    this.radioTimer = window.setInterval(() => {
      if (!this.ctx || !this.radioGain || this.muted || this.station === 'off') return;
      if (this.radioGain.gain.value < 0.01) return;

      const idx = this.radioStep % 8;
      this.radioStep++;

      const bassFreq =
        this.station === 'vice-wave' ? viceWaveBass[idx] : leonidaBass[idx];
      const leadFreq =
        this.station === 'vice-wave' ? viceWaveLead[idx] : leonidaPluck[idx];

      const now = this.ctx.currentTime;

      // Bass pulse
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = this.station === 'vice-wave' ? 'sawtooth' : 'triangle';
      bOsc.frequency.setValueAtTime(bassFreq, now);
      const bFilter = this.ctx.createBiquadFilter();
      bFilter.type = 'lowpass';
      bFilter.frequency.value = 480;
      bGain.gain.setValueAtTime(0.22, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      bOsc.connect(bFilter);
      bFilter.connect(bGain);
      bGain.connect(this.radioGain);
      bOsc.start(now);
      bOsc.stop(now + 0.13);

      // Lead synth
      if (leadFreq > 0) {
        const lOsc = this.ctx.createOscillator();
        const lGain = this.ctx.createGain();
        lOsc.type = this.station === 'vice-wave' ? 'square' : 'sine';
        lOsc.frequency.setValueAtTime(leadFreq, now);
        const lFilter = this.ctx.createBiquadFilter();
        lFilter.type = 'lowpass';
        lFilter.frequency.value = 1600;
        lGain.gain.setValueAtTime(0.09, now);
        lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        lOsc.connect(lFilter);
        lFilter.connect(lGain);
        lGain.connect(this.radioGain);
        lOsc.start(now);
        lOsc.stop(now + 0.2);
      }
    }, stepMs);
  }

  public dispose() {
    if (this.radioTimer !== null) {
      clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
    try {
      this.engineOsc?.stop();
      this.engineSubOsc?.stop();
      this.sirenOsc?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
  }
}
