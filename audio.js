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
let _playbackMode = localStorage.getItem('javiPlaybackMode') || 'shuffle-all'; // 'loop-one' | 'play-once' | 'shuffle-all'

const AMBIENT_FILES = [
  'sounds/Alerto sa Sakuna.mp3',
  'sounds/Ligtas.mp3',
  'sounds/Javilerto.mp3'
];
const OPENING_FILE = 'sounds/Sabay_sabay_Tayong_Bida.mp3';

/** Pretty name for track display */
function _trackLabel(path) {
  if (!path) return '—';
  // Extract "Alerto sa Sakuna" from "sounds/Alerto sa Sakuna.mp3"
  const name = path.split('/').pop().replace(/\.mp3$/i, '');
  return name;
}

// Callback when track changes — set by app.js for "Now Playing" UI
let _trackChangeCallback = null;
export function setOnTrackChange(fn) {
  _trackChangeCallback = fn;
}

function _notifyTrack(path) {
  if (_trackChangeCallback) _trackChangeCallback(path || '');
}

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
  const track = _trackQueue.pop();
  _ambientAudio.src = track;
  _ambientAudio.volume = _ambientVolume;
  _ambientAudio.loop = (_playbackMode === 'loop-one');
  _ambientAudio.play().catch(() => {});
  _notifyTrack(track);
}

function _applyPlaybackMode() {
  if (!_ambientAudio) return;
  if (_playbackMode === 'loop-one') {
    _ambientAudio.loop = true;
    _ambientAudio.removeEventListener('ended', _playNextAmbient);
  } else if (_playbackMode === 'play-once') {
    _ambientAudio.loop = false;
    _ambientAudio.removeEventListener('ended', _playNextAmbient);
  } else { // shuffle-all
    _ambientAudio.loop = false;
    // Avoid duplicate listeners
    _ambientAudio.removeEventListener('ended', _playNextAmbient);
    _ambientAudio.addEventListener('ended', _playNextAmbient);
  }
}

export function getPlaybackMode() {
  return _playbackMode;
}

export function setPlaybackMode(mode) {
  _playbackMode = mode;
  localStorage.setItem('javiPlaybackMode', mode);
  _applyPlaybackMode();
}

export function nextTrack() {
  if (!_ambientAudio) return;
  if (_playbackMode === 'shuffle-all') {
    // Skip to next track in the shuffled queue
    _ambientAudio.removeEventListener('ended', _playNextAmbient);
    _playNextAmbient();
    _ambientAudio.addEventListener('ended', _playNextAmbient);
  } else {
    // Restart current track
    _ambientAudio.currentTime = 0;
    _ambientAudio.play().catch(() => {});
  }
}

export function setAmbientVolume(vol) {
  _ambientVolume = Math.max(0, Math.min(1, vol));
  if (_ambientAudio) _ambientAudio.volume = _ambientVolume;
}

/**
 * Preload ambient audio early so it's buffered by the time user taps.
 * Call this as early as possible — creates the Audio element and starts loading.
 * @param {string} [track] — optional specific track; default is opening file
 */
export function preloadAmbient(track) {
  if (_ambientAudio) return; // already created
  try {
    _ambientAudio = new Audio();
    _ambientAudio.preload = 'auto';
    _ambientAudio.src = track || OPENING_FILE;
    _ambientAudio.volume = _ambientVolume;
    // Don't play — autoplay is blocked. Just let it buffer.
  } catch (_) {}
}

/**
 * Start background music — opening track first, then shuffled ambient.
 * If a specific track is given, loops that track.
 * If the audio element was already preloaded, reuses it.
 * @param {string} [track] — specific file path to loop, or empty for opening→shuffle
 */
export function startAmbientSound(track) {
  try {
    // If already playing stop/clean up, BUT keep the audio element if preloaded
    if (_ambientAudio) {
      _ambientAudio.pause();
      _ambientAudio.removeEventListener('ended', _playNextAmbient);
      // Don't null it — if preloaded, we want to keep the buffer
    }

    if (!_ambientAudio) {
      _ambientAudio = new Audio();
      _ambientAudio.preload = 'auto';
    }
    _ambientAudio.loop = (_playbackMode === 'loop-one');

    if (track) {
      // Specific track chosen — loop it
      _ambientAudio.src = track;
      _ambientAudio.volume = _ambientVolume;
      _ambientAudio.play().catch(() => {});
      _applyPlaybackMode();
      _notifyTrack(track);
    } else {
      // No specific track — opening first, then shuffled ambient
      _trackQueue = _shuffle(AMBIENT_FILES);
      _ambientAudio.src = OPENING_FILE;
      _ambientAudio.volume = _ambientVolume;
      _ambientAudio.play().catch(() => {});
      // When opening ends, play shuffled ambient
      _ambientAudio.addEventListener('ended', _playNextAmbient);
      _applyPlaybackMode();
    }
  } catch (_) {}
}

export function stopAmbientSound() {
  try {
    if (_ambientAudio) {
      _ambientAudio.pause();
      _ambientAudio.removeEventListener('ended', _playNextAmbient);
      _ambientAudio.src = '';
      _ambientAudio = null;
    }
    _trackQueue = [];
    _notifyTrack('');
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
 * Only one audio element exists — just play it.
 */
export function resumeAmbient() {
  if (_ambientAudio && _ambientAudio.paused && _ambientAudio.src) {
    _ambientAudio.play().catch(() => {});
    // Show what's now playing
    _notifyTrack(_ambientAudio.src);
  }
}
