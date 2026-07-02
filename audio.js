/**
 * Play an alert sound using the Web Audio API.
 * @param {'warning'|'danger'|null} type — alert severity
 * @param {boolean} soundEnabled — whether sound is allowed
 */
export function playAlertSound(type, soundEnabled) {
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
        gain.gain.setValueAtTime(0.3, now + i * 0.15);
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
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      }
    }
  } catch (_) { /* audio not supported */ }
}

// ─── AMBIENT SOUND ──────────────────────────────────────────
let _ambientCtx = null;
let _ambientGain = null;
let _ambientNoise = null;
let _ambientNodes = [];

/**
 * Start a gentle ambient wind-like sound.
 * Uses filtered pink noise for a subtle, calming effect.
 */
export function startAmbientSound() {
  try {
    // Clean up any existing ambient
    stopAmbientSound();

    _ambientCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Create pink noise buffer
    const sampleRate = _ambientCtx.sampleRate;
    const duration = 4; // 4-second loop
    const length = sampleRate * duration;
    const buffer = _ambientCtx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Pink noise approximation (fill with random, then filter)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }

    _ambientNoise = _ambientCtx.createBufferSource();
    _ambientNoise.buffer = buffer;
    _ambientNoise.loop = true;

    // Low-pass filter to make it sound like gentle wind
    const filter = _ambientCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 0.5;

    // Another bandpass to shape it
    const filter2 = _ambientCtx.createBiquadFilter();
    filter2.type = 'bandpass';
    filter2.frequency.value = 200;
    filter2.Q.value = 0.8;

    // Master gain — very quiet
    _ambientGain = _ambientCtx.createGain();
    _ambientGain.gain.value = 0.08;

    // Connect: noise → filter → filter2 → gain → destination
    _ambientNoise.connect(filter);
    filter.connect(filter2);
    filter2.connect(_ambientGain);
    _ambientGain.connect(_ambientCtx.destination);

    _ambientNoise.start();
    _ambientNodes = [_ambientNoise, filter, filter2, _ambientGain];
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
    if (_ambientNoise) {
      try { _ambientNoise.stop(); } catch (_) {}
      _ambientNoise = null;
    }
    if (_ambientCtx) {
      try { _ambientCtx.close(); } catch (_) {}
      _ambientCtx = null;
    }
    _ambientGain = null;
  } catch (_) { /* ignore */ }
}
