/**
 * Play an alert sound using the NDRRMC alert MP3.
 * Falls back to the ambient audio element if dedicated alert audio is blocked
 * (common on mobile browsers with autoplay restrictions).
 * @param {'warning'|'danger'|null} type — alert severity
 * @param {boolean} soundEnabled — whether sound is allowed
 * @param {number} [volume=0.3] — volume level (0-1)
 */
let _alertAudio = null;
let _audioCtx = null;
let _alertBuffer = null;

/**
 * Pre-create and preload the alert audio buffer.
 * Call during first user interaction to authorize playback on mobile.
 */
export function preloadAlertAudio() {
  if (!_audioCtx && typeof AudioContext !== 'undefined') {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      _audioCtx = null;
    }
  }

  if (_audioCtx && !_alertBuffer) {
    fetch('sounds/NDRRMC-Alert.mp3')
      .then(res => res.arrayBuffer())
      .then(buffer => _audioCtx.decodeAudioData(buffer))
      .then(decoded => { _alertBuffer = decoded; })
      .catch(() => { _alertBuffer = null; });
  }

  if (!_alertAudio) {
    try {
      _alertAudio = new Audio();
      _alertAudio.preload = 'auto';
      _alertAudio.src = 'sounds/NDRRMC-Alert.mp3';
      _alertAudio.load();
    } catch (_) { _alertAudio = null; }
  }
}

export function playAlertSound(type, soundEnabled, volume = 0.3) {
  if (!soundEnabled) return;
  if (!type) return;
  const playSrc = 'sounds/NDRRMC-Alert.mp3';
  const vol = Math.max(0, Math.min(1, volume));

  const resumeAmbientAfter = (wasPlaying, prevSrc, prevVol, prevLoop) => {
    if (!wasPlaying || !_ambientAudio || !prevSrc) return;
    _ambientAudio.src = prevSrc;
    _ambientAudio.volume = prevVol;
    _ambientAudio.loop = prevLoop;
    _ambientAudio.currentTime = 0;
    _ambientAudio.play().catch(() => {});
    if (!prevLoop) {
      _ambientAudio.addEventListener('ended', _playNextAmbient);
    }
    _notifyTrack(prevSrc);
  };

  const pauseAmbientForAlert = () => {
    const wasPlaying = _ambientAudio && !_ambientAudio.paused;
    const prevSrc = _ambientAudio ? _ambientAudio.src : null;
    const prevVol = _ambientAudio ? _ambientAudio.volume : 0;
    const prevLoop = _ambientAudio ? _ambientAudio.loop : false;
    if (wasPlaying && _ambientAudio) {
      _ambientAudio.removeEventListener('ended', _playNextAmbient);
      _ambientAudio.pause();
    }
    return { wasPlaying, prevSrc, prevVol, prevLoop };
  };

  const tryAudioContext = () => {
    if (!_audioCtx || !_alertBuffer) return Promise.reject();
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
    const { wasPlaying, prevSrc, prevVol, prevLoop } = pauseAmbientForAlert();
    const source = _audioCtx.createBufferSource();
    source.buffer = _alertBuffer;
    const gain = _audioCtx.createGain();
    gain.gain.value = vol;
    source.connect(gain).connect(_audioCtx.destination);
    source.onended = () => resumeAmbientAfter(wasPlaying, prevSrc, prevVol, prevLoop);
    source.start(0);
    return Promise.resolve();
  };

  const tryAlertAudio = () => {
    if (!_alertAudio) {
      try {
        _alertAudio = new Audio();
        _alertAudio.preload = 'auto';
      } catch (_) { return Promise.reject(); }
    }
    const { wasPlaying, prevSrc, prevVol, prevLoop } = pauseAmbientForAlert();
    _alertAudio.src = playSrc;
    _alertAudio.volume = vol;
    _alertAudio.currentTime = 0;
    return _alertAudio.play().then(() => {
      _alertAudio.onended = () => {
        _alertAudio.onended = null;
        resumeAmbientAfter(wasPlaying, prevSrc, prevVol, prevLoop);
      };
    });
  };

  const tryAmbientAudio = () => {
    if (!_ambientAudio) return Promise.reject();
    const wasPlaying = !_ambientAudio.paused && !!_ambientAudio.src;
    const prevSrc = _ambientAudio.src;
    const prevVol = _ambientAudio.volume;
    const prevLoop = _ambientAudio.loop;
    _ambientAudio.pause();
    _ambientAudio.removeEventListener('ended', _playNextAmbient);
    _ambientAudio.src = playSrc;
    _ambientAudio.volume = vol;
    _ambientAudio.currentTime = 0;
    _ambientAudio.loop = false;
    return _ambientAudio.play().then(() => {
      _ambientAudio.onended = () => {
        _ambientAudio.onended = null;
        if (wasPlaying && prevSrc && prevSrc !== playSrc) {
          _ambientAudio.src = prevSrc;
          _ambientAudio.volume = prevVol;
          _ambientAudio.loop = prevLoop;
          _ambientAudio.currentTime = 0;
          _ambientAudio.play().catch(() => {});
          if (!prevLoop) {
            _ambientAudio.addEventListener('ended', _playNextAmbient);
          }
          _notifyTrack(prevSrc);
        }
      };
    });
  };

  try {
    tryAudioContext()
      .catch(() => tryAlertAudio())
      .catch(() => tryAmbientAudio())
      .catch(() => {});
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
const OPENING_FILE = null;

/** Pretty name for track display */
function _trackLabel(path) {
  if (!path) return '—';
  // Decode URL-encoded chars (%20 → space) and extract the song name
  // "sounds/Alerto%20sa%20Sakuna.mp3" → "Alerto sa Sakuna"
  const name = decodeURIComponent(path).split('/').pop().replace(/\.mp3$/i, '');
  return name + '  • JaviAlert';
}

// Callback when track changes — set by app.js for "Now Playing" UI
let _trackChangeCallback = null;
export function setOnTrackChange(fn) {
  _trackChangeCallback = fn;
}

function _notifyTrack(path) {
  if (_trackChangeCallback) _trackChangeCallback(path ? _trackLabel(path) : '');
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
    _ambientAudio.src = track || AMBIENT_FILES[0];
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
      _attachProgressListener();
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
      // No specific track — start shuffled ambient immediately
      _trackQueue = _shuffle(AMBIENT_FILES);
      _playNextAmbient();
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
    _notifyTrack(_ambientAudio.src);
  }
}

/** Pause or resume the current ambient track. Returns true if now playing, false if now paused. */
export function toggleAmbient() {
  if (!_ambientAudio || !_ambientAudio.src) return false;
  if (_ambientAudio.paused) {
    _ambientAudio.play().catch(() => {});
    _notifyTrack(_ambientAudio.src);
    return true;
  } else {
    _ambientAudio.pause();
    return false;
  }
}

/** Check if ambient audio exists and is currently playing */
export function isAmbientPlaying() {
  return _ambientAudio && !_ambientAudio.paused && !!_ambientAudio.src;
}

// ─── PROGRESS CALLBACK ──────────────────────────────
let _progressCallback = null;
export function setOnProgress(fn) { _progressCallback = fn; }

function _attachProgressListener() {
  if (!_ambientAudio) return;
  _ambientAudio.removeEventListener('timeupdate', _onTimeUpdate);
  _ambientAudio.addEventListener('timeupdate', _onTimeUpdate);
}

function _onTimeUpdate() {
  if (_progressCallback && _ambientAudio && _ambientAudio.duration) {
    _progressCallback(_ambientAudio.currentTime / _ambientAudio.duration);
  }
}
