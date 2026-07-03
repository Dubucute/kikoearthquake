/**
 * Play an alert sound using the Web Audio API.
 * @param {'warning'|'danger'|null} type — alert severity
 * @param {boolean} soundEnabled — whether sound is allowed
 * @param {number} [volume=0.3] — volume level (0-1)
 */
export function playAlertSound(type, soundEnabled, volume = 0.3) {
  if (!soundEnabled) return;
  if (!type) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    if (type === 'warning') {
      // Gentle two-tone alert: 660Hz then 880Hz, 0.15s each
      [660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume * 0.7, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.15);
      });
    } else if (type === 'danger') {
      // Urgent descending siren: 880Hz → 440Hz sweep, 4 cycles, sawtooth for harshness
      for (let c = 0; c < 4; c++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        const t = now + c * 0.35;
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.3);
        gain.gain.setValueAtTime(volume * 0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      }
    }
  } catch (_) { /* audio not supported */ }
}

// ─── AMBIENT SOUND (Gentle Melody) ──────────────────────────
let _ambientCtx = null;
let _ambientGain = null;
let _ambientNodes = [];
let _ambientVolume = 0.2; // default — louder on mobile

/**
 * Update the ambient volume (0-1).
 * @param {number} vol
 */
export function setAmbientVolume(vol) {
  _ambientVolume = Math.max(0, Math.min(1, vol));
  if (_ambientGain) {
    _ambientGain.gain.setValueAtTime(_ambientVolume, _ambientCtx.currentTime);
  }
}

/**
 * Start a gentle music-box melody loop.
 * Uses pentatonic scale with soft sine waves for a calming effect.
 */
export function startAmbientSound() {
  try {
    // Clean up any existing ambient
    stopAmbientSound();

    _ambientCtx = new (window.AudioContext || window.webkitAudioContext)();
    const sampleRate = _ambientCtx.sampleRate;

    // Pentatonic melody: C4 D4 E4 G4 A4 C5 A4 G4 E4 D4 C4
    const melody = [
      { freq: 261.63, dur: 0.45 }, // C4
      { freq: 293.66, dur: 0.35 }, // D4
      { freq: 329.63, dur: 0.45 }, // E4
      { freq: 392.00, dur: 0.35 }, // G4
      { freq: 440.00, dur: 0.45 }, // A4
      { freq: 523.25, dur: 0.55 }, // C5
      { freq: 440.00, dur: 0.35 }, // A4
      { freq: 392.00, dur: 0.35 }, // G4
      { freq: 329.63, dur: 0.45 }, // E4
      { freq: 293.66, dur: 0.35 }, // D4
      { freq: 261.63, dur: 0.55 }, // C4
      // Add a gentle rest/pause
      { freq: null, dur: 0.30 },
      // Repeat slightly varied — a soft higher phrase
      { freq: 392.00, dur: 0.35 }, // G4
      { freq: 440.00, dur: 0.45 }, // A4
      { freq: 523.25, dur: 0.35 }, // C5
      { freq: 587.33, dur: 0.45 }, // D5
      { freq: 523.25, dur: 0.35 }, // C5
      { freq: 440.00, dur: 0.45 }, // A4
      { freq: 392.00, dur: 0.35 }, // G4
      { freq: 329.63, dur: 0.55 }, // E4
    ];

    // Calculate total loop duration
    const totalDur = melody.reduce((sum, n) => sum + n.dur, 0);
    const length = Math.ceil(sampleRate * totalDur);
    const buffer = _ambientCtx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Render the melody into the buffer
    let cursor = 0;
    melody.forEach(note => {
      if (note.freq) {
        const period = sampleRate / note.freq;
        const nsamples = Math.floor(sampleRate * note.dur);
        // Soft attack (first 10ms) and release (last 30ms)
        const attackSamples = Math.min(Math.floor(sampleRate * 0.01), nsamples);
        const releaseSamples = Math.min(Math.floor(sampleRate * 0.03), nsamples);
        for (let i = 0; i < nsamples && (cursor + i) < length; i++) {
          // Sine wave with soft harmonic for warmth
          let val = Math.sin(2 * Math.PI * i / period) * 0.45
                  + Math.sin(2 * Math.PI * i / (period / 2)) * 0.12
                  + Math.sin(2 * Math.PI * i / (period / 3)) * 0.05;
          // Envelope: attack + sustain + release
          let env = 1;
          if (i < attackSamples) env = i / attackSamples;
          else if (i > nsamples - releaseSamples) env = (nsamples - i) / releaseSamples;
          data[cursor + i] = val * env * 0.35;
        }
      }
      cursor += Math.floor(sampleRate * note.dur);
    });

    // Create buffer source and loop
    const source = _ambientCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Master gain
    _ambientGain = _ambientCtx.createGain();
    _ambientGain.gain.value = _ambientVolume;

    // Connect and start
    source.connect(_ambientGain);
    _ambientGain.connect(_ambientCtx.destination);
    source.start();

    _ambientNodes = [source, _ambientGain];
  } catch (_) { /* ambient audio not supported */ }
}

/**
 * Stop the ambient sound.
 */
export function stopAmbientSound() {
  try {
    _ambientNodes.forEach(n => {
      try { n.disconnect(); } catch (_) {}
    });
    _ambientNodes = [];
    if (_ambientCtx) {
      try { _ambientCtx.close(); } catch (_) {}
      _ambientCtx = null;
    }
    _ambientGain = null;
  } catch (_) { /* ignore */ }
}
