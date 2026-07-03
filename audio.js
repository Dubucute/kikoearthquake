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
    if (ctx.state === 'suspended') ctx.resume();

    if (type === 'warning') {
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

// ─── AMBIENT (BACKGROUND) MUSIC — MP3 PLAYLIST ──────────────
let _ambientAudio = null;
let _ambientVolume = 0.2;
let _trackQueue = [];

const AMBIENT_FILES = [
  'sounds/Alerto sa Sakuna.mp3',
  'sounds/Ligtas.mp3',
  'sounds/Javilerto.mp3'
];

function _shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function _playNextAmbient() {
  if (!_ambientAudio) return;
  if (_trackQueue.length === 0) _trackQueue = _shuffle(AMBIENT_FILES);
  _ambientAudio.src = _trackQueue.pop();
  _ambientAudio.volume = _ambientVolume;
  _ambientAudio.play().catch(() => {});
}

export function setAmbientVolume(vol) {
  _ambientVolume = Math.max(0, Math.min(1, vol));
  if (_ambientAudio) _ambientAudio.volume = _ambientVolume;
}

/**
 * Start background music — plays either a specific track on loop or shuffled playlist.
 * Also stops any opening music since ambient takes over.
 * @param {string} [track] — specific file path to loop, or empty for shuffle all
 */
export function startAmbientSound(track) {
  try {
    stopAmbientSound();
    // Stop opening music — ambient is taking over
    stopOpeningMusic();
    _ambientAudio = new Audio();
    _ambientAudio.preload = 'auto';
    _ambientAudio.loop = !!track; // loop if a specific track is chosen
    if (track) {
      _ambientAudio.src = track;
      _ambientAudio.volume = _ambientVolume;
      _ambientAudio.play().catch(() => {});
    } else {
      _trackQueue = _shuffle(AMBIENT_FILES);
      _ambientAudio.addEventListener('ended', _playNextAmbient);
      _playNextAmbient();
    }
  } catch (_) {}
}

export function stopAmbientSound() {
  try {
    stopOpeningMusic();
    if (_ambientAudio) {
      _ambientAudio.pause();
      _ambientAudio.removeEventListener('ended', _playNextAmbient);
      _ambientAudio.src = '';
      _ambientAudio = null;
    }
    _trackQueue = [];
  } catch (_) {}
}

/**
 * Switch to a different ambient track while keeping music playing.
 * @param {string} track — file path, or empty string for shuffle all
 */
export function setAmbientTrack(track) {
  const wasPlaying = _ambientAudio && !_ambientAudio.paused;
  const wasActive = !!_ambientAudio; // was running at all (even if paused by autoplay)
  stopAmbientSound();
  if (wasActive) {
    startAmbientSound(track || undefined);
  }
}

/**
 * Resume audio after first user gesture (browsers block autoplay).
 * If ambient is enabled, play opening music first then transition to ambient.
 * If ambient is off, do nothing — no music at all.
 */
export function resumeAmbient() {
  // First user gesture — now audio can play
  if (_openingAudio && _openingAudio.src && _openingAudio.paused) {
    // Opening never played (autoplay blocked) — play it now
    _openingAudio.play().catch(() => {});
    // When opening ends, start ambient (if it was created)
    _openingAudio.onended = () => {
      try { _openingAudio = null; } catch (_) {}
      if (_ambientAudio && _ambientAudio.paused && _ambientAudio.src) {
        _ambientAudio.play().catch(() => {});
      }
    };
    return;
  }
  // Opening already playing — just queue ambient after it ends
  if (_openingAudio && _openingAudio.src) {
    _openingAudio.onended = () => {
      try { _openingAudio = null; } catch (_) {}
      if (_ambientAudio && _ambientAudio.paused && _ambientAudio.src) {
        _ambientAudio.play().catch(() => {});
      }
    };
    return;
  }
  // No opening music — just resume ambient
  if (_ambientAudio && _ambientAudio.paused && _ambientAudio.src) {
    _ambientAudio.play().catch(() => {});
  }
}

// ─── OPENING (LOADING SCREEN) MUSIC ─────────────────────────
let _openingAudio = null;
const OPENING_FILE = 'sounds/Sabay_sabay_Tayong_Bida.mp3';

export function playOpeningMusic() {
  try {
    stopOpeningMusic();
    _openingAudio = new Audio();
    _openingAudio.preload = 'auto';
    _openingAudio.src = OPENING_FILE;
    _openingAudio.volume = 0.35;
    _openingAudio.play().catch(() => {});
  } catch (_) {}
}

export function stopOpeningMusic() {
  try {
    if (_openingAudio) {
      _openingAudio.pause();
      _openingAudio.src = '';
      _openingAudio = null;
    }
  } catch (_) {}
}
