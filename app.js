import { JAVI_MESSAGES, JAVI_REACTIONS, SAFETY_TIPS, EMERGENCY_CONTACTS, CHANGELOG } from './messages.js';
import { playAlertSound, startAmbientSound, stopAmbientSound, setAmbientVolume, setAmbientTrack, setOnTrackChange, getPlaybackMode, setPlaybackMode, nextTrack, toggleAmbient, isAmbientPlaying, preloadAlertAudio, setOnProgress } from './audio.js';
import { API, CONFIG, timeSince, getCompassDir, getDistance, parsePlaceName, magClass, getPHIVOLCSIntensity, intensityClass, shouldShowQuake, PEIS_LABELS, PEIS_SHORT } from './api-utils.js';
import { QUIZ_QUESTIONS } from './quiz-questions.js';

// ─── Module mixins (split from app.js for maintainability) ──
import { chatMixin } from './modules/chat.js';
import { mapMixin } from './modules/map.js';
import { quizMixin } from './modules/quiz.js';
import { analysisMixin } from './modules/analysis.js';
import { shareMixin } from './modules/share.js';
import { settingsMixin } from './modules/settings.js';

class JaviAlertApp {
    constructor() {
      this.userLat = null;
      this.userLon = null;
      this.userPlace = '';
      this.currentMood = 'safe';
      this.currentPage = 1;
      this.allQuakes = [];
      this.sortMode = 'newest';
      this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      this.isAndroid = /Android/.test(navigator.userAgent);
      this.deferredPrompt = null;
      this.refreshTimer = null;
      this.knownQuakeIds = this._loadKnownQuakeIds();
      this.isDarkMode = localStorage.getItem('javiDarkMode') === 'true';
      this.soundEnabled = localStorage.getItem('javiSoundEnabled') !== 'false';
      this.notifSound = localStorage.getItem('javiNotifSound') || 'alarm';
      this.safetyTipsShown = localStorage.getItem('javiSafetyTipsShown') !== 'false';
      this.moodHistory = this._loadMoodHistory();
      this.magFilter = 0;
      this._pushReady = false;
      this._pushDisabled = localStorage.getItem('javiPushDisabled') === 'true';
      this._toastTimer = null;
      this.map = null;
      this.mapMarkers = [];
      this.userMarker = null;
      this.mapTiles = null;
      this.ambientEnabled = localStorage.getItem('javiAmbientEnabled') !== 'false';
      this.ambientActive = false;
      this.ambientTrack = localStorage.getItem('javiAmbientTrack') || '';
      this.volumeLevel = parseFloat(localStorage.getItem('javiVolume') || '0.5');
      this.autoRefresh = localStorage.getItem('javiAutoRefresh') !== 'false';
      this._lastFetchTime = 0;
      this.quizState = {
        current: 0,
        score: 0,
        selected: null,
        completed: false,
        order: []
      };

      // Chat state
      this.chatMessages = this._loadChatHistory();
      this.chatLoading = false;
      this.unreadCount = 0;
      this._notifTimer = null;
      this._pendingClose = false;
      this._scrollPos = 0;
      this._lastCheckedTimer = null;
      this._fromCronPush = false;

      // Bind
      this.init = this.init.bind(this);
      this.loadData = this.loadData.bind(this);
      this.fetchEarthquakeData = this.fetchEarthquakeData.bind(this);
      this.processQuakeData = this.processQuakeData.bind(this);
      this.updateUI = this.updateUI.bind(this);
      this.renderQuakeList = this.renderQuakeList.bind(this);
      this.setMood = this.setMood.bind(this);
      this.getJaviMessage = this.getJaviMessage.bind(this);
      this.detectLocation = this.detectLocation.bind(this);
      this.fetchLocationName = this.fetchLocationName.bind(this);
      this.setupLocationSearch = this.setupLocationSearch.bind(this);
      this.setupSortDropdown = this.setupSortDropdown.bind(this);
      this.applySortAndRender = this.applySortAndRender.bind(this);
      this.setupPagination = this.setupPagination.bind(this);
      this.showInstallTutorial = this.showInstallTutorial.bind(this);
      this.setupInstallPrompt = this.setupInstallPrompt.bind(this);
      this.toggleDarkMode = this.toggleDarkMode.bind(this);
      this._setNotifSound = this._setNotifSound.bind(this);
      this.setMagFilter = this.setMagFilter.bind(this);
      this._recordMood = this._recordMood.bind(this);
      this._renderMoodHistory = this._renderMoodHistory.bind(this);
      this._updateLastSignificant = this._updateLastSignificant.bind(this);
      this._setupPushNotifications = this._setupPushNotifications.bind(this);
      this._fetchVapidPublicKey = this._fetchVapidPublicKey.bind(this);
      this._triggerServerPush = this._triggerServerPush.bind(this);
      this._initMap = this._initMap.bind(this);
      this._updateMapMarkers = this._updateMapMarkers.bind(this);
      this._showAnalysis = this._showAnalysis.bind(this);
      this._shareQuakeAsImage = this._shareQuakeAsImage.bind(this);
      this._showSettings = this._showSettings.bind(this);
      this._registerServiceWorker = this._registerServiceWorker.bind(this);
      this._showNotifToast = this._showNotifToast.bind(this);
      this._showChat = this._showChat.bind(this);
      this._sendChatMessage = this._sendChatMessage.bind(this);
      this._buildQuakeContext = this._buildQuakeContext.bind(this);
      this._callHuggingFace = this._callHuggingFace.bind(this);
      this._renderChatMessages = this._renderChatMessages.bind(this);
      this._quizLang = this._quizLang.bind(this);
      this._loadChatMemory = this._loadChatMemory.bind(this);
      this._saveChatMemory = this._saveChatMemory.bind(this);
      this._detectLanguage = this._detectLanguage.bind(this);
      this._fallbackResponse = this._fallbackResponse.bind(this);
      this._quickReply = this._quickReply.bind(this);
      this._updateChatHeadBadge = this._updateChatHeadBadge.bind(this);
      this._showChatHeadNotif = this._showChatHeadNotif.bind(this);
      this._initChatHeadDrag = this._initChatHeadDrag.bind(this);
      this._lockBodyScroll = this._lockBodyScroll.bind(this);
      this._unlockBodyScroll = this._unlockBodyScroll.bind(this);
    }

    /** Get current language: tl, en, or ceb */
    _quizLang() {
      try { return localStorage.getItem('javiLang') || 'tl'; } catch (_) { return 'tl'; }
    }

    // ─── INIT ──────────────────────────────────────────────────
    async init() {
      // Register SW in background (non-blocking) — in-app browsers like Messenger's
      // WebView often hang on SW registration; we don't want that to block startup.
      this._registerServiceWorker();

      // Request notification permission + setup push
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          Notification.requestPermission().then(result => {
            if (result === 'granted') this._setupPushNotifications();
          });
        } catch (_) { /* ignore */ }
      } else if ('Notification' in window && Notification.permission === 'granted' && !this._pushDisabled) {
        this._setupPushNotifications();
      }

      // Javi tap interaction
      document.getElementById('kidWrap').addEventListener('click', () => this.onJaviTap());

      // Setup UI
      document.getElementById('refreshBtn').addEventListener('click', () => location.reload());
      document.getElementById('installBanner').addEventListener('click', () => this.showInstallTutorial());
      document.getElementById('modalClose').addEventListener('click', () => {
        document.getElementById('installModal').classList.add('hidden');
      });
      document.getElementById('modalGotIt').addEventListener('click', () => {
        document.getElementById('installModal').classList.add('hidden');
      });

      // Tips modal (What to do)
      document.getElementById('pillTipsBtn').addEventListener('click', () => this.showTipsModal());
      document.getElementById('tipsModalClose').addEventListener('click', () => {
        document.getElementById('tipsModal').classList.add('hidden');
      });
      document.getElementById('tipsModalGotIt').addEventListener('click', () => {
        document.getElementById('tipsModal').classList.add('hidden');
      });
      document.getElementById('tipsModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
      });

      // Contacts modal (Who to call)
      document.getElementById('pillContactsBtn').addEventListener('click', () => this.showContactsModal());
      document.getElementById('contactsModalClose').addEventListener('click', () => {
        document.getElementById('contactsModal').classList.add('hidden');
      });
      document.getElementById('contactsModalGotIt').addEventListener('click', () => {
        document.getElementById('contactsModal').classList.add('hidden');
      });
      document.getElementById('contactsModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
      });

      // Quiz modal
      document.getElementById('pillQuizBtn').addEventListener('click', () => this._showQuiz());
      document.getElementById('quizModalClose').addEventListener('click', () => {
        document.getElementById('quizModal').classList.add('hidden');
      });
      document.getElementById('quizRestartBtn').addEventListener('click', () => this._resetQuiz());
      document.getElementById('quizNextBtn').addEventListener('click', () => this._nextQuizQuestion());
      document.getElementById('quizModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          e.currentTarget.classList.add('hidden');
        }
      });

      // Ask Javi chat modal
      document.getElementById('pillAskJaviBtn').addEventListener('click', () => this._showChat());
      this._initChatHeadDrag();
      document.getElementById('chatModalClose').addEventListener('click', () => {
        document.getElementById('chatModal').classList.add('hidden');
        document.getElementById('chatModalCard').classList.remove('chat-fullscreen');
        this._unlockBodyScroll();
        // If bot is still loading, mark that there may be unread messages
        if (this.chatLoading) {
          this._pendingClose = true;
        }
      });
      document.getElementById('chatModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          e.currentTarget.classList.add('hidden');
          document.getElementById('chatModalCard').classList.remove('chat-fullscreen');
          this._unlockBodyScroll();
          if (this.chatLoading) {
            this._pendingClose = true;
          }
        }
      });
      document.getElementById('chatFullscreenBtn').addEventListener('click', () => {
        const card = document.getElementById('chatModalCard');
        const icon = document.getElementById('chatFullscreenIcon');
        card.classList.toggle('chat-fullscreen');
        const isFull = card.classList.contains('chat-fullscreen');
        icon.setAttribute('data-lucide', isFull ? 'minimize-2' : 'maximize-2');
        try { lucide.createIcons(); } catch (_) {}
        // Re-render messages to fit new size
        this._renderChatMessages();
      });
      document.getElementById('chatSendBtn').addEventListener('click', () => this._sendChatMessage());
      document.getElementById('chatInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._sendChatMessage();
        }
      });

      // Quake detail modal close
      document.getElementById('detailModalClose').addEventListener('click', () => {
        document.getElementById('quakeDetailModal').classList.add('hidden');
        document.getElementById('detailMap').src = 'about:blank';
      });
      document.getElementById('quakeDetailModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          e.currentTarget.classList.add('hidden');
          document.getElementById('detailMap').src = 'about:blank';
        }
      });

      // Use my location button
      document.getElementById('useLocationBtn').addEventListener('click', () => this._requestGeolocation());

      this.setupLocationSearch();
      this.setupSortDropdown();
      this.setupPagination();
      this.setupInstallPrompt();

      // Apply dark mode if previously set
      if (this.isDarkMode) {
        document.body.classList.add('dark-mode');
      }

      // Sync notification sound picker with saved preference
      this._updateSettingsUI();

      // Settings button
      document.getElementById('settingsBtn').addEventListener('click', this._showSettings);
      this._setupSettingsModal();

      // Now Playing track change callback
      setOnTrackChange((trackPath) => {
        const el = document.getElementById('nowPlaying');
        const textEl = document.getElementById('nowPlayingText');
        if (!el || !textEl) return;
        // Always visible — just update the content
        if (!trackPath) {
          textEl.textContent = '♫ Music Player — tap play';
        } else {
          textEl.textContent = '♫ ' + trackPath;
        }
        // Sync play/pause icon
        const icon = document.querySelector('#npPlayPauseIcon');
        if (icon) icon.setAttribute('data-lucide', isAmbientPlaying() ? 'pause' : 'play');
        try { lucide.createIcons(); } catch (_) {}
        // Reset progress bar when stopped
        if (!trackPath) {
          const pb = document.getElementById('npProgressBar');
          if (pb) pb.style.width = '0%';
        }
      });

      // Set initial now-playing state (idle)
      const npText = document.getElementById('nowPlayingText');
      if (npText) npText.textContent = '♫ Music Player — tap play';
      const npIcon = document.querySelector('#npPlayPauseIcon');
      if (npIcon) { npIcon.setAttribute('data-lucide', 'play'); try { lucide.createIcons(); } catch (_) {} }

      // Progress bar — update on audio time
      const progressBar = document.getElementById('npProgressBar');
      setOnProgress((pct) => {
        if (progressBar) progressBar.style.width = Math.min(100, Math.round(pct * 100)) + '%';
      });

      // Now Playing controls
      document.getElementById('npPlaybackMode').addEventListener('click', () => {
        const modes = ['shuffle-all', 'loop-one', 'play-once'];
        const labels = ['shuffle', 'repeat', 'play'];
        const current = getPlaybackMode();
        const idx = (modes.indexOf(current) + 1) % modes.length;
        setPlaybackMode(modes[idx]);
        const icon = document.querySelector('#npModeIcon');
        if (icon) icon.setAttribute('data-lucide', labels[idx]);
        try { lucide.createIcons(); } catch (_) {}
      });
      document.getElementById('npNext').addEventListener('click', nextTrack);
      document.getElementById('npPlayPause').addEventListener('click', () => {
        if (!this.ambientActive) {
          // Nothing loaded — start ambient music
          this.ambientActive = true;
          this.ambientEnabled = true;
          localStorage.setItem('javiAmbientEnabled', 'true');
          startAmbientSound(this.ambientTrack || undefined);
          setAmbientVolume(this.volumeLevel);
          const icon = document.querySelector('#npPlayPauseIcon');
          if (icon) icon.setAttribute('data-lucide', 'pause');
          try { lucide.createIcons(); } catch (_) {}
          this._updateSettingsUI();
        } else {
          const playing = toggleAmbient();
          const icon = document.querySelector('#npPlayPauseIcon');
          if (icon) icon.setAttribute('data-lucide', playing ? 'pause' : 'play');
          try { lucide.createIcons(); } catch (_) {}
        }
      });

      // Initial playback mode icon
      const modeMap = { 'shuffle-all': 'shuffle', 'loop-one': 'repeat', 'play-once': 'play' };
      const modeIcon = document.querySelector('#npModeIcon');
      if (modeIcon) {
        modeIcon.setAttribute('data-lucide', modeMap[getPlaybackMode()] || 'shuffle');
        try { lucide.createIcons(); } catch (_) {}
      }

      // In-app notification toast close
      document.getElementById('notifToastClose').addEventListener('click', () => {
        const toast = document.getElementById('notifToast');
        toast.classList.remove('toast-show');
        setTimeout(() => toast.classList.add('hidden'), 400);
        if (this._toastTimer) clearTimeout(this._toastTimer);
      });

      // Am I Safe? analysis
      document.getElementById('pillAnalysisBtn').addEventListener('click', () => this._showAnalysis());
      document.getElementById('analysisModalClose').addEventListener('click', () => {
        document.getElementById('analysisModal').classList.add('hidden');
      });
      document.getElementById('analysisModalGotIt').addEventListener('click', () => {
        document.getElementById('analysisModal').classList.add('hidden');
      });
      document.getElementById('analysisModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
      });

      // Magnitude filter
      document.getElementById('magFilter').addEventListener('click', (e) => {
        const btn = e.target.closest('.mag-filter-btn');
        if (!btn) return;
        this.setMagFilter(parseFloat(btn.dataset.min));
      });

      // Map filters — custom dropdowns (click to open, click option to select)
      this._setupMapDropdown('mapTimeSelect', 'mapTimeFilter', 'mapTimeOptions', () => this._updateMapMarkers());
      this._setupMapDropdown('mapMagSelect', 'mapMagFilter', 'mapMagOptions', () => this._updateMapMarkers());

      // Offline detection
      window.addEventListener('online', () => {
        document.getElementById('offlineBanner').classList.add('hidden');
        this.loadData();
      });
      window.addEventListener('offline', () => {
        document.getElementById('offlineBanner').classList.remove('hidden');
      });
      if (!navigator.onLine) {
        document.getElementById('offlineBanner').classList.remove('hidden');
      }

      // Listen for postMessage from service worker (notification/cron → play sound + refresh)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (e) => {
          if (e.data && e.data.action === 'playAlertSound') {
            // Skip if we just alerted (within last 10s) — prevents double-play
            // when app is open and user taps the push notification
            if (this._lastAlertTime && Date.now() - this._lastAlertTime < 10000) {
              return;
            }
            if (this.notifSound === 'alarm') {
              playAlertSound(e.data.alertType, this.soundEnabled, this.volumeLevel);
            } else if (this.notifSound === 'voice') {
              // Speak generic alert — no quake details from SW
              this._speakGenericAlert(e.data.alertType);
            }
            this.loadData();
          } else if (e.data && e.data.action === 'newCronData') {
            // Cron found new quakes — refresh data immediately
            // Flag prevents _triggerServerPush from double-sending since cron already pushed
            this._fromCronPush = true;
            this.loadData();
          }
        });
      }

      // Set default Javi icon to the app icon
      const kidGif = document.getElementById('kidGif');
      if (kidGif) {
        kidGif.style.backgroundImage = "url('icons/javi-avatar.png')";
      }

      // Lucide
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Safety timeout — dismiss loading after 8s no matter what
      const safetyTimer = setTimeout(() => this._dismissLoading(), 8000);

      // Ambient preload (buffers MP3) but don't auto-play — user starts via play button
      if (this.ambientEnabled && this.currentMood !== 'danger') {
        // Just mark as ready, user presses play in the now-playing bar to start
        this.ambientActive = false;
      }

      // Detect location then load
      document.getElementById('loadingText').textContent = 'Detecting location...';
      await this.detectLocation();
      document.getElementById('loadingText').textContent = 'Fetching earthquakes...';
      await this.loadData();

      // Init map (needs userLat/Lon from location)
      this._initMap();

// Auto-refresh to stay in sync with server-side cron checks
this.refreshTimer = setInterval(() => this.loadData(), 300000);

      // Hide loading overlay (cancel safety timer first)
      clearTimeout(safetyTimer);
      this._dismissLoading();

      // Check if opened from a notification click with alertType
      const params = new URLSearchParams(location.search);
      const alertFromNotif = params.get('alertType');
      if (alertFromNotif) {
        // Clean URL so refresh doesn't replay
        history.replaceState(null, '', location.pathname);
        this._lastAlertTime = Date.now();
        if (this.notifSound === 'alarm') {
          playAlertSound(alertFromNotif, this.soundEnabled, this.volumeLevel);
        } else if (this.notifSound === 'voice') {
          this._speakGenericAlert(alertFromNotif);
        }
      }

      // Unlock AudioContext on first user interaction (browsers block autoplay)
      this._unlockAudioOnce();

      // Scroll-to-top button visibility
      window.addEventListener('scroll', () => {
        const btn = document.getElementById('scrollTopBtn');
        if (!btn) return;
        if (window.scrollY > 400) {
          btn.classList.add('visible');
        } else {
          btn.classList.remove('visible');
        }
      }, { passive: true });
      document.getElementById('scrollTopBtn').addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      // Refresh data when returning to app (e.g. from a notification)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // Tab hidden — pause tip rotation
          if (this._tipInterval) {
            clearInterval(this._tipInterval);
            this._tipInterval = null;
          }
        } else {
          // Tab visible again — refresh data if stale (>2 min since last fetch)
          const stale = Date.now() - this._lastFetchTime > 120000;
          if (stale) {
            this.loadData();
          }
          // Resume tip rotation
          if (this.currentMood !== 'safe') {
            this.showSafetyTip();
          }
        }
      });
    }

    // ─── LOCATION DETECTION (improved) ─────────────────────────
    async detectLocation() {
      const LOCATION_TTL_MS = 60 * 60 * 1000; // re-check once per hour

      // 1) Try cached location, but only trust it if still fresh
      const stored = this._readStoredLocation();
      if (stored) {
        this.userLat = stored.lat;
        this.userLon = stored.lon;
        this.userPlace = stored.place || '';
        if (this.userPlace) document.getElementById('locInput').value = this.userPlace;

        // Custom address (cachedAt: Infinity) — load it but keep "Use my location" available
        if (stored.cachedAt === Infinity) {
          // Show the GPS button so user can switch back anytime
          if ('geolocation' in navigator) this._showLocationPrompt();
          return;
        }

        const isFresh = Date.now() - (stored.cachedAt || 0) < LOCATION_TTL_MS;
        if (isFresh) return;
        // stale: fall through and try to silently refresh in the background
        // (only if permission is already granted — never prompt unprompted)
      }

      // 2) No geolocation support at all (older browsers, some in-app webviews)
      if (!('geolocation' in navigator)) {
        this._useFallbackLocation('Hindi supported ng browser mo ang location. I-search na lang sa taas.');
        return;
      }

      // 3) Geolocation requires a secure context (https or localhost).
      //    On plain http it will silently fail or never prompt.
      const isSecure = window.isSecureContext ||
        location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if (!isSecure) {
        this._useFallbackLocation('Kailangan ng HTTPS para sa auto-location. I-search na lang ang lugar mo.');
        return;
      }

      // 4) Check current permission state where supported (Chrome/Android/desktop;
      //    Safari/iOS doesn't implement the Permissions API for geolocation reliably,
      //    so treat 'unsupported' the same as 'prompt').
      let permState = 'prompt';
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          permState = status.state; // 'granted' | 'denied' | 'prompt'
        }
      } catch (_) { /* Permissions API not supported (e.g. iOS Safari) — fall through */ }

      if (permState === 'denied') {
        // Don't bother calling getCurrentPosition — it'll just hang/fail again,
        // and on iOS the prompt never reappears once denied.
        this._useFallbackLocation('Naka-block ang location access. Paki-allow sa Settings, o i-search ang lugar mo sa taas.');
        return;
      }

      // 5) If permission isn't already granted, don't auto-prompt on page load —
      //    that's the #1 reason iOS users bounce off geolocation requests.
      //    Show a tappable "Use my location" affordance instead and let
      //    the actual getCurrentPosition call happen from that tap.
      if (permState === 'prompt') {
        this._showLocationPrompt();
        if (!stored) {
          // still give them *something* to look at while they decide
          this._useFallbackLocation(null, { silent: true });
        }
        return;
      }

      // 6) permState === 'granted' → safe to fetch silently (covers the
      //    "stale cache, but already allowed" refresh case too)
      await this._requestGeolocation();
    }

    // Called directly from a user tap (e.g. a "📍 Use my location" button)
    async _requestGeolocation() {
      const btn = document.getElementById('useLocationBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Locating…'; }

      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false, // faster, lower battery cost; fine for this use case
            timeout: 12000,            // iOS can be slow on first fix, give it more room
            maximumAge: 300000
          });
        });
        this.userLat = pos.coords.latitude;
        this.userLon = pos.coords.longitude;
        await this.fetchLocationName();
        this._hideLocationPrompt();
        // Re-load data with new location
        await this.loadData();
      } catch (err) {
        this._handleGeoError(err);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '📍 Use my location'; }
      }
    }

    _handleGeoError(err) {
      let msg;
      switch (err && err.code) {
        case 1: // PERMISSION_DENIED
          msg = 'Hindi pinayagan ang location access. I-search na lang ang lugar mo.';
          break;
        case 2: // POSITION_UNAVAILABLE
          msg = 'Hindi makuha ang location mo ngayon. Subukan ulit o i-search ang lugar.';
          break;
        case 3: // TIMEOUT
          msg = 'Matagal mag-respond ang GPS. Subukan ulit o i-search ang lugar.';
          break;
        default:
          msg = 'Hindi makuha ang location mo. I-search na lang ang lugar mo sa taas.';
      }
      this._useFallbackLocation(msg);
    }

    // Falls back to last-known/Manila so the app is still usable,
    // and optionally surfaces a reason to the user via the bubble.
    _useFallbackLocation(reasonMsg, opts = {}) {
      if (!this.userLat) {
        this.userLat = 14.5995;
        this.userLon = 120.9842;
        this.userPlace = 'Manila, Philippines';
        document.getElementById('locInput').value = this.userPlace;
      }
      if (reasonMsg && !opts.silent) {
        const bubble = document.getElementById('bubble');
        if (bubble) {
          bubble.className = 'bubble';
          bubble.innerHTML = '<i data-lucide="map-pin-off" aria-hidden="true"></i> ' + reasonMsg;
          try { lucide.createIcons(); } catch (_) {}
        }
      }
    }

    _showLocationPrompt() {
      const el = document.getElementById('useLocationBtn');
      if (el) el.classList.remove('hidden');
    }
    _hideLocationPrompt() {
      const el = document.getElementById('useLocationBtn');
      if (el) el.classList.add('hidden');
    }

    _readStoredLocation() {
      try {
        const stored = localStorage.getItem('javiUserLocation');
        return stored ? JSON.parse(stored) : null;
      } catch (_) {
        return null;
      }
    }

    async fetchLocationName() {
      try {
        const url = API.NOMINATIM + '?format=json&lat=' + this.userLat + '&lon=' + this.userLon + '&addressdetails=1';
        const res = await fetch(url, { headers: { 'User-Agent': 'JaviAlert/1.0' } });
        if (!res.ok) throw new Error('Nominatim failed');
        const data = await res.json();
        const a = data.address || {};
        const parts = [];
        if (a.road) parts.push(a.road);
        if (a.suburb) parts.push(a.suburb);
        if (a.neighbourhood) parts.push(a.neighbourhood);
        if (a.district) parts.push(a.district);
        if (a.municipality) parts.push(a.municipality);
        if (a.state) parts.push(a.state);
        if (a.country) parts.push(a.country);
        this.userPlace = parts.join(', ') || data.display_name || '';
        document.getElementById('locInput').value = this.userPlace;
        localStorage.setItem('javiUserLocation', JSON.stringify({
          lat: this.userLat, lon: this.userLon, place: this.userPlace, cachedAt: Date.now()
        }));
      } catch (_) {
        this.userPlace = this.userLat.toFixed(2) + ', ' + this.userLon.toFixed(2);
        document.getElementById('locInput').value = this.userPlace;
        // still cache coords even if reverse geocoding failed, so we don't re-prompt every load
        try {
          localStorage.setItem('javiUserLocation', JSON.stringify({
            lat: this.userLat, lon: this.userLon, place: this.userPlace, cachedAt: Date.now()
          }));
        } catch (_) {}
      }
    }

    // ─── LOCATION SEARCH (Nominatim autocomplete) ──────────────
    setupLocationSearch() {
      const input = document.getElementById('locInput');
      const dropdown = document.getElementById('locDropdown');
      let debounceTimer = null;

      input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const q = input.value.trim();
        if (q.length < 3) {
          dropdown.classList.add('hidden');
          return;
        }
        debounceTimer = setTimeout(async () => {
          try {
            const url = API.NOMINATIM_SEARCH + '?format=json&q=' + encodeURIComponent(q) + '&limit=5';
            const res = await fetch(url, { headers: { 'User-Agent': 'JaviAlert/1.0' } });
            if (!res.ok) throw new Error('Search failed');
            const results = await res.json();
            dropdown.innerHTML = '';
            if (!results.length) {
              dropdown.classList.add('hidden');
              return;
            }
            results.forEach((r) => {
              const div = document.createElement('div');
              div.className = 'loc-dropdown-item';
              div.dataset.lat = r.lat;
              div.dataset.lon = r.lon;
              div.dataset.display = r.display_name;
              const name = r.display_name.split(',')[0] || r.display_name;
              div.innerHTML = '<div>' + name + '</div><div class="ld-sub">' + r.display_name + '</div>';
              dropdown.appendChild(div);
            });
            dropdown.classList.remove('hidden');
          } catch (_) {
            dropdown.classList.add('hidden');
          }
        }, 400);
      });

      // Event delegation on dropdown
      dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.loc-dropdown-item');
        if (!item) return;
        this.userLat = parseFloat(item.dataset.lat);
        this.userLon = parseFloat(item.dataset.lon);
        this.userPlace = item.dataset.display;
        input.value = this.userPlace;
        dropdown.classList.add('hidden');
        localStorage.setItem('javiUserLocation', JSON.stringify({
          lat: this.userLat, lon: this.userLon, place: this.userPlace, cachedAt: Infinity
        }));
        this.loadData();
      });

      // Close dropdown on outside click
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.loc-bar')) {
          dropdown.classList.add('hidden');
        }
      });

      // Keyboard navigation
      input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.loc-dropdown-item');
        if (!items.length) return;
        const active = dropdown.querySelector('.active');
        let idx = Array.from(items).indexOf(active);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          idx = Math.min(idx + 1, items.length - 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          idx = Math.max(idx - 1, 0);
        } else if (e.key === 'Enter' && active) {
          e.preventDefault();
          active.click();
          return;
        } else {
          return;
        }
        items.forEach((el) => el.classList.remove('active'));
        items[idx].classList.add('active');
      });

      // ─── Focus: clear input so user can type right away ─────
      input.addEventListener('focus', () => {
        input.value = '';
      });

      // ─── Blur: if nothing was selected, restore current address ─
      input.addEventListener('blur', () => {
        // Small delay so a dropdown click can fire first
        setTimeout(() => {
          if (dropdown.classList.contains('hidden')) {
            input.value = this.userPlace || '';
          }
        }, 200);
      });
    }

    // ─── SORT DROPDOWN ─────────────────────────────────────────
    setupSortDropdown() {
      const btn = document.getElementById('sortBtn');
      const dd = document.getElementById('sortDropdown');
      const options = dd.querySelectorAll('.sort-option');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dd.classList.toggle('hidden');
      });

      options.forEach((opt) => {
        opt.addEventListener('click', () => {
          options.forEach((o) => o.classList.remove('active'));
          opt.classList.add('active');
          this.sortMode = opt.dataset.sort;
          dd.classList.add('hidden');
          this.currentPage = 1;
          this.applySortAndRender();
        });
      });

      document.addEventListener('click', () => {
        dd.classList.add('hidden');
      });
    }

    applySortAndRender() {
      if (!this.allQuakes.length) return;
      let sorted = [...this.allQuakes];
      if (this.sortMode === 'nearest') {
        sorted.sort((a, b) => a.dist - b.dist);
      } else if (this.sortMode === 'newest') {
        sorted.sort((a, b) => new Date(b.time) - new Date(a.time));
      } else if (this.sortMode === 'strongest') {
        sorted.sort((a, b) => b.mag - a.mag);
      }
      this.renderQuakeList(sorted);
    }

    // ─── PAGINATION ────────────────────────────────────────────
    setupPagination() {
      document.getElementById('prevPage').addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.applySortAndRender();
        }
      });
      document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(this.allQuakes.length / CONFIG.DISPLAY_COUNT);
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.applySortAndRender();
        }
      });
    }

    // ─── FETCH EARTHQUAKE DATA ─────────────────────────────────
    async fetchEarthquakeData() {
      // Primary: PHIVOLCS (more accurate for PH earthquakes)
      try {
        const phivRes = await fetch('/api/phivolcs-quakes');
        const phivData = await phivRes.json();
        if (phivData.features && phivData.features.length > 0) {
          // Filter by tiered distance: mag ≥5 always, smaller mags closer
          return phivData.features.filter(f => {
            const coords = f.geometry ? f.geometry.coordinates : [0, 0];
            const dist = getDistance(this.userLat, this.userLon, coords[1], coords[0]);
            return shouldShowQuake(f.properties.mag, dist);
          });
        }
      } catch (_) {
        // PHIVOLCS failed — fall through to USGS
      }

      // Fallback: USGS
      const degRadius = 500 / 111.2;
      const usgsUrl = API.USGS +
        '?format=geojson' +
        '&latitude=' + this.userLat +
        '&longitude=' + this.userLon +
        '&maxradius=' + degRadius +
        '&minmagnitude=' + CONFIG.MIN_MAGNITUDE +
        '&orderby=time' +
        '&limit=' + CONFIG.QUAKE_LIMIT;

      const res = await fetch(usgsUrl);
      if (!res.ok) throw new Error('USGS returned ' + res.status);
      const data = await res.json();
      return data.features || [];
    }

    // ─── PROCESS QUAKE DATA ────────────────────────────────────
    processQuakeData(features) {
      const quakes = features.map((f) => {
        const props = f.properties || {};
        const coords = f.geometry ? f.geometry.coordinates : [0, 0];
        const lat = coords[1];
        const lon = coords[0];
        const dist = getDistance(this.userLat, this.userLon, lat, lon);
        const dir = getCompassDir(this.userLat, this.userLon, lat, lon);
        const parsed = parsePlaceName(props.place || 'Unknown');
        const depth = coords[2] !== undefined ? Math.round(coords[2]) : null;
        return {
          id: f.id || props.net + props.code,
          mag: props.mag || 0,
          place: parsed.place,
          rawPlace: props.place || 'Unknown',
          time: new Date(props.time),
          lat,
          lon,
          depth,
          dist: Math.round(dist),
          dir,
          parsedDist: parsed.distance,
          parsedDir: parsed.direction,
          url: props.url || '',
          intensity: getPHIVOLCSIntensity(props.mag || 0, Math.round(dist)),
        };
      });

      // Sort by distance (nearest first)
      const quakesByDist = quakes.sort((a, b) => a.dist - b.dist);
      const localMidnight = new Date();
      localMidnight.setHours(0, 0, 0, 0);

      return {
        quakes: quakesByDist,
        todayCount: quakes.filter((q) => q.time >= localMidnight).length,
        latestTime: quakes.length ? quakes.reduce((a, b) => a.time > b.time ? a : b).time : null,
        nearestDist: quakes.length ? quakesByDist[0].dist : null
      };
    }

    // ─── UPDATE UI ─────────────────────────────────────────────
    async updateUI(data) {
      const { quakes, todayCount, latestTime, nearestDist } = data;
      this.allQuakes = quakes;
      this.currentPage = 1;

      // Stats
      document.getElementById('statCount').textContent = todayCount;
      document.getElementById('statLatest').textContent = latestTime ? timeSince(latestTime) : '--';
      document.getElementById('statNearest').textContent = nearestDist ? nearestDist + ' km' : '--';
      this._updateLastSignificant(quakes);

      // Determine mood — based on intensity AND magnitude
      let mood = 'safe';
      const now = Date.now();
      for (const q of quakes) {
        const isRecent = now - q.time.getTime();
        // Danger: intensity ≥ 5 or mag ≥ 5 within danger window
        if ((q.intensity >= 5 || q.mag >= 5) && isRecent < CONFIG.DANGER_WINDOW_MS) {
          mood = 'danger';
          break;
        }
        // Warning: intensity ≥ 3 or mag ≥ 3 within 24h
        if ((q.intensity >= 3 || q.mag >= 3) && isRecent < CONFIG.WARNING_WINDOW_MS) {
          mood = 'warning';
        }
      }
      this.setMood(mood);

      // Render quake list with current sort
      this.applySortAndRender();

      // Update map markers
      this._updateMapMarkers();

      // Last update — show relative time
      this._updateLastChecked();

      // Refresh icon
      const ico = document.getElementById('refreshIcon');
      ico.classList.remove('spin');
    }

    /** Update "Last checked" relative timestamp + start periodic refresher */
    _updateLastChecked() {
      const el = document.getElementById('lastUpdate');
      if (!el) return;
      const now = Date.now();
      const diff = now - this._lastFetchTime;
      if (diff < 60000) {
        el.textContent = 'Updated just now';
      } else if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        el.textContent = 'Updated ' + mins + ' min ago';
      } else {
        const hrs = Math.floor(diff / 3600000);
        el.textContent = 'Updated ' + hrs + 'h ago';
      }
      // Start periodic refresher if not already running
      if (!this._lastCheckedTimer) {
        this._lastCheckedTimer = setInterval(() => this._updateLastChecked(), 30000);
      }
    }

    // ─── RENDER QUAKE LIST ─────────────────────────────────────
    renderQuakeList(quakes) {
      const container = document.getElementById('quakeList');

      // Apply magnitude filter
      if (this.magFilter > 0) {
        quakes = quakes.filter(q => q.mag >= this.magFilter);
      }

      const totalPages = Math.max(1, Math.ceil(quakes.length / CONFIG.DISPLAY_COUNT));
      const start = (this.currentPage - 1) * CONFIG.DISPLAY_COUNT;
      const pageItems = quakes.slice(start, start + CONFIG.DISPLAY_COUNT);

      if (!pageItems.length) {
        container.innerHTML = '<div class="empty"><i data-lucide="search-off" aria-hidden="true"></i> No earthquakes found</div>';
        try { lucide.createIcons(); } catch (_) { /* ignore */ }
        document.getElementById('pagination').classList.add('hidden');
        return;
      }

      document.getElementById('pagination').classList.remove('hidden');

      let html = '';
      pageItems.forEach((q) => {
        const mag = q.mag.toFixed(1);
        const cls = magClass(q.mag);
        const timeStr = timeSince(q.time);
        const distKm = q.dist + ' km';
        const dirStr = q.dir;
        const isTsunamiRisk = q.mag >= 6.5 && q.depth !== null && q.depth < 70;
        const intLabel = PEIS_SHORT[q.intensity] || '—';
        const intCls = intensityClass(q.intensity);

        const mapsUrl = 'https://www.google.com/maps?q=' + q.lat + ',' + q.lon;

        html += '<div class="quake-item' + (isTsunamiRisk ? ' tsunami-risk' : '') + '" data-id="' + q.id + '">' +
          '<div class="mag-badge ' + cls + '">' + mag + '</div>' +
          '<div class="intensity-badge ' + intCls + '">' + intLabel + '</div>' +
          '<div class="q-info">' +
            '<div class="q-top">' +
              '<span class="q-place">' + q.place + '</span>' +
              '<span class="q-dist">' + distKm + '</span>' +
            '</div>' +
            '<div class="q-meta">' + timeStr + ' &middot; ' + dirStr +
              (isTsunamiRisk ? ' <span class="tsunami-badge"><i data-lucide="waves" aria-hidden="true"></i> Tsunami risk</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="q-actions">' +
            '<a class="q-map" href="' + mapsUrl + '" target="_blank" rel="noopener" aria-label="View on Google Maps">' +
              '<i data-lucide="map-pin" aria-hidden="true"></i>' +
            '</a>' +
            '<button class="q-share" data-id="' + q.id + '" aria-label="Share this earthquake">' +
              '<i data-lucide="share-2" aria-hidden="true"></i>' +
            '</button>' +
          '</div>' +
        '</div>';
      });
      container.innerHTML = html;
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Quake item click — open detail modal
      container.querySelectorAll('.quake-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          // Don't open if clicking a button or link inside
          if (e.target.closest('.q-share') || e.target.closest('.q-map')) return;
          const id = item.getAttribute('data-id');
          const q = quakes.find(q => q.id === id);
          if (q) this._showQuakeDetail(q);
        });
      });

      // Share button click handlers
      container.querySelectorAll('.q-share').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const q = quakes.find(q => q.id === id);
          if (q) this._shareQuake(q);
        });
      });

      // Pagination info
      document.getElementById('pageInfo').textContent = 'Page ' + this.currentPage + ' of ' + totalPages;
      document.getElementById('prevPage').disabled = this.currentPage <= 1;
      document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
    }

    // ─── SET MOOD ──────────────────────────────────────────────
    setMood(mood) {
      this.currentMood = mood;

      // Body class
      document.body.classList.remove('safe', 'warning', 'danger');
      if (mood === 'danger') document.body.classList.add('danger');
      else if (mood === 'warning') document.body.classList.add('warning');
      else document.body.classList.add('safe');

      // Status pill
      const pill = document.getElementById('statusPill');
      pill.className = 'status-pill pill-' + mood;
      const pillText = document.getElementById('pillText');

      // Pill icon
      const existingIcon = pill.querySelector('[data-lucide]') || pill.querySelector('i');
      if (existingIcon) existingIcon.remove();

      const newIcon = document.createElement('i');
      newIcon.setAttribute('data-lucide', mood === 'safe' ? 'shield-check' : mood === 'warning' ? 'alert-triangle' : 'alert-octagon');
      newIcon.setAttribute('aria-hidden', 'true');
      pill.insertBefore(newIcon, pillText);

      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Haptic feedback on mood change
      if (mood === 'danger' || mood === 'warning') {
        this._hapticAlert(mood);
      }

      // Safety card visibility — always shown via showSafetyTip() below
      // Just stop rotation when safe so it doesn't keep cycling
      if (mood === 'safe' && this._tipInterval) {
        clearInterval(this._tipInterval);
        this._tipInterval = null;
      }

      // Javi character image (PNG only — no GIFs)
      const gif = document.getElementById('kidGif');
      const ext = 'png';
      const shakeWrap = document.getElementById('kidWrap');
      shakeWrap.classList.remove('shake');

      if (mood === 'safe') {
        const n = Math.floor(Math.random() * 4) + 1;
        gif.style.backgroundImage = "url('javi/safe" + n + "." + ext + "')";
        pillText.textContent = 'Safe';
      } else if (mood === 'warning') {
        const n = Math.floor(Math.random() * 4) + 1;
        gif.style.backgroundImage = "url('javi/warning" + n + "." + ext + "')";
        pillText.textContent = 'Warning';
      } else {
        const n = Math.floor(Math.random() * 4) + 1;
        gif.style.backgroundImage = "url('javi/danger" + n + "." + ext + "')";
        pillText.textContent = 'DANGER';
        shakeWrap.classList.add('shake');
      }

      // Record mood for history
      this._recordMood(mood);

      // Ambient sound: stop in danger, do not auto-start (user plays via now-playing bar)
      if (mood === 'danger') {
        if (this.ambientActive) {
          stopAmbientSound();
          this.ambientActive = false;
        }
      }

      // Show safety tips on every refresh (rotates every 3 sec)
      this.showSafetyTip();

      // Bubble message
      this.getJaviMessage(mood);
    }

    // ─── GET JAVI MESSAGE ──────────────────────────────────────
    async getJaviMessage(mood) {
      const bubble = document.getElementById('bubble');
      bubble.className = 'bubble loading';
      bubble.innerHTML = '<i data-lucide="search" aria-hidden="true"></i> Javi...';
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Pick a random message for the current mood
      const msgs = JAVI_MESSAGES[mood] || JAVI_MESSAGES.safe;
      const msg = msgs[Math.floor(Math.random() * msgs.length)];

      // Type out the message character by character
      bubble.className = 'bubble';
      bubble.innerHTML = '';
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      for (let i = 0; i < msg.length; i++) {
        bubble.innerHTML = msg.slice(0, i + 1);
        await new Promise(r => setTimeout(r, 25));
      }
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

    }

    // ─── SHOW SAFETY TIP ───────────────────────────────────────
    showSafetyTip() {
      const card = document.getElementById('safetyCard');
      const body = document.getElementById('safetyBody');
      if (!card || !body) return;
      if (!this.safetyTipsShown) {
        card.classList.add('hidden');
        return;
      }
      card.classList.remove('hidden');
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Clear any existing rotation
      if (this._tipInterval) {
        clearInterval(this._tipInterval);
      }

      // Show first tip immediately
      let idx = Math.floor(Math.random() * SAFETY_TIPS.length);
      body.textContent = SAFETY_TIPS[idx];

      // Rotate tips every 3 seconds
      this._tipInterval = setInterval(() => {
        idx = (idx + 1) % SAFETY_TIPS.length;
        body.textContent = SAFETY_TIPS[idx];
      }, 3000);
    }

    // ─── LOAD DATA ─────────────────────────────────────────────
    async loadData() {
      const bubble = document.getElementById('bubble');
      const ico = document.getElementById('refreshIcon');
      const quakeContainer = document.getElementById('quakeList');

      console.log('[🔔 NOTIFY] loadData() called — knownQuakeIds size:', this.knownQuakeIds.size);
      // Show cached data instantly (if available)
      const cached = this._loadCachedData();
      if (cached && cached.features) {
        console.log('[🔔 NOTIFY] Cache HIT — showing', cached.features.length, 'cached features instantly');
        // Restore location from cache if localStorage was cleared
        if (cached.lat && cached.lon) {
          if (!this.userLat || !this.userLon) {
            this.userLat = cached.lat;
            this.userLon = cached.lon;
            this.userPlace = cached.place || '';
            if (this.userPlace) document.getElementById('locInput').value = this.userPlace;
          }
        }
        const cData = this.processQuakeData(cached.features);
        this._saveKnownQuakeIds(cData.quakes);
        await this.updateUI(cData);
        // Don't show skeleton — we already have data
      } else {
        console.log('[🔔 NOTIFY] Cache MISS — showing skeleton');
        // No cache — show skeleton loaders
        bubble.className = 'bubble loading';
        bubble.innerHTML = '<i data-lucide="search" aria-hidden="true"></i> Checking for earthquakes...';
        try { lucide.createIcons(); } catch (_) { /* ignore */ }
        if (quakeContainer) quakeContainer.innerHTML = this._getSkeletonHTML();
      }

      ico.classList.add('spin');

      try {
        console.log('[🔔 NOTIFY] Fetching fresh data from server...');
        const features = await this.fetchEarthquakeData();
        console.log('[🔔 NOTIFY] Got', features.length, 'features from server');
        const data = this.processQuakeData(features);
        console.log('[🔔 NOTIFY] Processed', data.quakes.length, 'quakes');

        // Cache the fresh data for next load
        this._saveCachedData(features);

        // Detect NEW quakes BEFORE saving known IDs
        console.log('[🔔 NOTIFY] About to detect new quakes (knownIds:', this.knownQuakeIds.size, ')');
        const newQuakes = this._detectNewQuakes(data.quakes);
        console.log('[🔔 NOTIFY] Detection result:', newQuakes.length, 'new quakes found');

        // Now update known IDs (must come AFTER detection)
        this._saveKnownQuakeIds(data.quakes);

        this._lastFetchTime = Date.now();
        await this.updateUI(data);

        // Alert AFTER mood is determined — fire for any new quake
        if (newQuakes.length > 0) {
          this._alertNewQuakes(newQuakes);
        }
        // Reset cron flag so next manual refresh triggers server push
        this._fromCronPush = false;
      } catch (err) {
        // If fetch fails but we already showed cached data, don't show error
        if (cached && cached.features) {
          ico.classList.remove('spin');
          bubble.className = 'bubble';
          bubble.innerHTML = '<i data-lucide="info" aria-hidden="true"></i> Showing cached data — refresh failed.';
          try { lucide.createIcons(); } catch (_) { /* ignore */ }
          return;
        }
        bubble.className = 'bubble';
        bubble.innerHTML = '<i data-lucide="alert-circle" aria-hidden="true"></i> Could not load data. Check your connection.';
        try { lucide.createIcons(); } catch (_) { /* ignore */ }
        ico.classList.remove('spin');
        console.error('loadData error:', err);

        // Show inline retry button
        if (quakeContainer) {
          quakeContainer.innerHTML =
            '<div class="error-retry">' +
              '<i data-lucide="wifi-off" aria-hidden="true"></i>' +
              '<div class="error-msg">Could not load earthquake data.<br>Check your connection and try again.</div>' +
              '<button class="retry-btn" id="retryLoadBtn">' +
                '<i data-lucide="refresh-cw" aria-hidden="true"></i> Retry' +
              '</button>' +
            '</div>';
          try { lucide.createIcons(); } catch (_) { /* ignore */ }
          const retryBtn = document.getElementById('retryLoadBtn');
          if (retryBtn) {
            retryBtn.addEventListener('click', () => this.loadData());
          }
        }
      }
      // Reset cron flag even on error
      this._fromCronPush = false;
    }

    // ─── CLIENT-SIDE DATA CACHE ──────────────────────────────
    _loadCachedData() {
      try {
        const raw = localStorage.getItem('javiQuakeCache');
        if (!raw) return null;
        const cached = JSON.parse(raw);
        // Cache expires after 30 minutes
        if (Date.now() - (cached.ts || 0) > 1800000) return null;
        return cached;
      } catch (_) { return null; }
    }

    _saveCachedData(features) {
      try {
        localStorage.setItem('javiQuakeCache', JSON.stringify({
          ts: Date.now(),
          features,
          lat: this.userLat,
          lon: this.userLon,
          place: this.userPlace
        }));
      } catch (_) { /* ignore quota errors */ }
    }

    _getSkeletonHTML() {
      const items = Array.from({ length: 5 }, (_, i) =>
        '<div class="skeleton-item' + (i === 4 ? '"' : '"') + '>' +
          '<div class="skeleton-badge"></div>' +
          '<div class="skeleton-lines">' +
            '<div class="skeleton-line"></div>' +
            '<div class="skeleton-line"></div>' +
          '</div>' +
          '<div class="skeleton-icon"></div>' +
          '<div class="skeleton-icon"></div>' +
        '</div>'
      ).join('');
      return '<div class="skeleton-list">' + items + '</div>';
    }

    // ─── NEW QUAKE DETECTION ───────────────────────────────────
    _loadKnownQuakeIds() {
      try {
        const stored = localStorage.getItem('javiKnownQuakeIds');
        const ids = stored ? new Set(JSON.parse(stored)) : new Set();
        console.log('[🔔 NOTIFY] _loadKnownQuakeIds:', ids.size, 'known IDs from localStorage');
        if (ids.size > 0) console.log('[🔔 NOTIFY] Sample IDs:', [...ids].slice(0, 5));
        return ids;
      } catch (_) {
        console.log('[🔔 NOTIFY] _loadKnownQuakeIds: failed to load, returning empty set');
        return new Set();
      }
    }

    _saveKnownQuakeIds(quakes) {
      const ids = new Set(quakes.map((q) => q.id));
      try {
        localStorage.setItem('javiKnownQuakeIds', JSON.stringify([...ids]));
      } catch (_) { /* ignore */ }
      this.knownQuakeIds = ids;
      console.log('[🔔 NOTIFY] _saveKnownQuakeIds: saved', ids.size, 'IDs to localStorage');
    }

    _detectNewQuakes(quakes) {
      console.log('[🔔 NOTIFY] _detectNewQuakes called with', quakes.length, 'quakes');
      console.log('[🔔 NOTIFY] Current knownQuakeIds size:', this.knownQuakeIds.size);
      // On first load, detect ALL quakes from last 24h
      if (this.knownQuakeIds.size === 0) {
        const cutoff = Date.now() - 86400000; // 24h
        const recent = quakes.filter(q => q.time.getTime() > cutoff);
        console.log('[🔔 NOTIFY] FIRST LOAD — returning ALL', recent.length, 'quakes from last 24h');
        return recent;
      }
      const newQuakes = quakes.filter((q) => !this.knownQuakeIds.has(q.id));
      console.log('[🔔 NOTIFY] SUBSEQUENT LOAD — found', newQuakes.length, 'new quakes not in known IDs');
      if (newQuakes.length > 0) {
        newQuakes.forEach(q => console.log('[🔔 NOTIFY] NEW:', q.mag, 'mag', q.place, 'id:', q.id));
      }
      return newQuakes;
    }

    _alertNewQuakes(newQuakes) {
      console.log('[🔔 NOTIFY] _alertNewQuakes called with', newQuakes.length, 'new quakes');
      // Determine the biggest/most significant new quake
      const newest = newQuakes.reduce((a, b) => a.time > b.time ? a : b);
      console.log('[🔔 NOTIFY] Newest:', newest.mag, 'mag', newest.place);
      // Play NDRRMC alarm only for mag >= 3 or intensity >= 3
      const hasAlarm = newest.mag >= 3 || newest.intensity >= 3;
      const alertType = (newest.intensity >= 5 || newest.mag >= 5) ? 'danger' :
                        hasAlarm ? 'warning' : 'info';

      // Play notification sound based on user preference
      if (alertType === 'warning' || alertType === 'danger') {
        this._lastAlertTime = Date.now();
        if (this.notifSound === 'alarm') {
          playAlertSound(alertType, this.soundEnabled, this.volumeLevel);
        } else if (this.notifSound === 'voice') {
          this._speakAlert(newest, alertType);
        }
        // 'silent' = no sound
      }

      // Haptic feedback on significant alerts only
      if (alertType === 'warning' || alertType === 'danger') {
        this._hapticAlert(alertType);
      }

      console.log('[🔔 NOTIFY] alertType:', alertType, '| hasAlarm:', hasAlarm);

      // Show in-app notification toast for ALL new quakes
      this._showNotifToast(alertType, newest);

      // Push to server for background notification (mag 3+ only)
      // Skipped if this refresh was triggered by cron's push (to avoid double notification)
      if ((alertType === 'warning' || alertType === 'danger') && !this._fromCronPush) {
        this._triggerServerPush(newest, newQuakes.length);
      }

      // Trigger map ripple effect
      this._triggerQuakeRipple();

      // Update bubble message
      const bubble = document.getElementById('bubble');
      const count = newQuakes.length;
      const msg = count === 1
        ? 'May bago akong na-detect na lindol! ' + newest.mag.toFixed(1) + ' mag sa ' + newest.place
        : count + ' na bagong lindol ang na-detect ko! Pinakabago: ' + newest.mag.toFixed(1) + ' mag';
      bubble.className = 'bubble';
      bubble.innerHTML = '<i data-lucide="bell" aria-hidden="true"></i> ' + msg;
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Proactive alert: push a personalized message to the chat (only for mag 3+)
      if (alertType === 'warning' || alertType === 'danger') {
        this._pushProactiveAlert(newest, alertType);
      }
    }

    // ─── PUSH NOTIFICATIONS ────────────────────────────────────
    async _setupPushNotifications() {
      if (!('PushManager' in window)) return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        // Fetch current public key from server
        const publicKey = await this._fetchVapidPublicKey();
        if (!publicKey) return;

        // If existing subscription, check if it uses the same VAPID key
        if (subscription) {
          const existingKey = subscription.options.applicationServerKey;
          const newKey = this._urlBase64ToUint8Array(publicKey);
          // Compare keys — if they differ, unsubscribe and re-subscribe
          const existingBase64 = btoa(String.fromCharCode(...new Uint8Array(existingKey)));
          const newBase64 = btoa(String.fromCharCode(...newKey));
          if (existingBase64 !== newBase64) {
            console.log('[Push] VAPID key changed — re-subscribing');
            await subscription.unsubscribe();
            subscription = null;
          }
        }

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this._urlBase64ToUint8Array(publicKey)
          });
        }
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...subscription.toJSON(),
            lat: this.userLat,
            lon: this.userLon
          })
        });
        this._pushReady = true;
        this._pushDisabled = false;
        localStorage.setItem('javiPushDisabled', 'false');
      } catch (_) { /* push not supported */ }
    }

    async _fetchVapidPublicKey() {
      try {
        const res = await fetch('/api/push-public-key');
        if (!res.ok) return null;
        const data = await res.json();
        return data.publicKey;
      } catch (_) {
        return null;
      }
    }

    async _triggerServerPush(newest, count) {
      if (!this._pushReady || this._pushDisabled) return;
      const alertType = newest.mag >= CONFIG.DANGER_THRESHOLD ? 'danger'
        : newest.mag >= CONFIG.WARNING_THRESHOLD ? 'warning'
        : null;
      try {
        const title = 'New earthquake detected';
        const depthInfo = newest.depth > 0 ? ' · ' + newest.depth + 'km deep' : '';
        const body = 'Magnitude ' + newest.mag.toFixed(1) + ' in ' + newest.place + depthInfo;
        await fetch('/api/push-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title,
            body: body,
            url: '/',
            tag: 'quake-' + Date.now(),
            alertType: alertType,
            lat: newest.lat,
            lon: newest.lon
          })
        });
      } catch (_) { /* ignore */ }
    }

    _urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
      const rawData = window.atob(base64);
      return Uint8Array.from([].map.call(rawData, char => char.charCodeAt(0)));
    }

    // ─── INSTALL PROMPT ────────────────────────────────────────
    setupInstallPrompt() {
      const banner = document.getElementById('installBanner');

      // Already installed? Check standalone mode + localStorage flag
      const isInstalled = localStorage.getItem('javiInstalled') === 'true' ||
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches;
      if (isInstalled) {
        banner.classList.add('hidden');
        localStorage.setItem('javiInstalled', 'true');
        return;
      }

      // Listen for appinstalled (fires on Android/Desktop after successful install)
      window.addEventListener('appinstalled', () => {
        banner.classList.add('hidden');
        localStorage.setItem('javiInstalled', 'true');
      });

      // Listen for beforeinstallprompt (Android/Desktop)
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        banner.classList.remove('hidden');
      });

      // On iOS, show banner with instructions if not installed
      if (this.isIOS) {
        banner.classList.remove('hidden');
        banner.querySelector('.install-title').textContent = 'Install on iOS';
        banner.querySelector('.install-desc').textContent = 'Tap Share > Add to Home Screen';
      }
    }

    // ─── JAVI TAP INTERACTION ─────────────────────────────────
    onJaviTap() {
      const bubble = document.getElementById('bubble');
      const wrap = document.getElementById('kidWrap');

      // Brief shake animation on tap
      wrap.classList.remove('shake');
      void wrap.offsetWidth;
      wrap.classList.add('shake');
      setTimeout(() => wrap.classList.remove('shake'), 500);

      // Show sparkles
      this._spawnSparkles(this.currentMood === 'danger' ? 'danger' : 'safe');

      // On mobile, request notification permission on user gesture if not yet decided
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(result => {
          if (result === 'granted') this._setupPushNotifications();
          this._updateSettingsUI();
        }).catch(() => {});
      } else if ('Notification' in window && Notification.permission === 'granted' && !this._pushReady && !this._pushDisabled) {
        // Retry push setup if it failed earlier (only if user hasn't disabled)
        this._setupPushNotifications();
      }

      // If warning or danger, show appropriate message
      if (this.currentMood === 'warning' || this.currentMood === 'danger') {
        let msg;
        if (this.currentMood === 'danger') {
          // Danger — show safety tips
          msg = SAFETY_TIPS[Math.floor(Math.random() * SAFETY_TIPS.length)];
          msg = '🚨 DANGER! ' + msg;
        } else {
          // Warning — show reassuring message (wag kabahan)
          const warns = JAVI_MESSAGES.warning || [];
          msg = warns[Math.floor(Math.random() * warns.length)];
        }
        bubble.className = 'bubble';
        bubble.innerHTML = msg;
        try { lucide.createIcons(); } catch (_) { /* ignore */ }
        return;
      }

      // Safe mood — show random reaction
      const msg = JAVI_REACTIONS[Math.floor(Math.random() * JAVI_REACTIONS.length)];
      bubble.className = 'bubble';
      bubble.innerHTML = '';

      let i = 0;
      const type = () => {
        if (i < msg.length) {
          bubble.innerHTML = msg.slice(0, i + 1);
          i++;
          setTimeout(type, 20);
        }
      };
      type();
      try { lucide.createIcons(); } catch (_) { /* ignore */ }
    }

    // ─── TIPS MODAL (What to do) ──────────────────────────────
    showTipsModal() {
      const modal = document.getElementById('tipsModal');
      const body = document.getElementById('tipsModalBody');
      if (!modal || !body) return;

      const tipsHtml = SAFETY_TIPS.map(t => '<li>' + t + '</li>').join('');

      body.innerHTML =
        '<ul class="tips-list">' + tipsHtml + '</ul>';

      modal.classList.remove('hidden');
      try { lucide.createIcons(); } catch (_) { /* ignore */ }
    }

    // ─── CONTACTS MODAL (Who to call) ─────────────────────────
    showContactsModal() {
      const modal = document.getElementById('contactsModal');
      const body = document.getElementById('contactsModalBody');
      if (!modal || !body) return;

      const contactsHtml = EMERGENCY_CONTACTS.map(c =>
        '<li><strong>' + c.name + '</strong><span class="contact-num">' + c.num + '</span></li>'
      ).join('');

      body.innerHTML =
        '<ul class="contacts-list">' + contactsHtml + '</ul>';

      modal.classList.remove('hidden');
      try { lucide.createIcons(); } catch (_) { /* ignore */ }
    }

    showInstallTutorial() {
      const modal = document.getElementById('installModal');
      const steps = document.getElementById('modalSteps');
      const icon = document.getElementById('modalDeviceIcon');
      const title = document.getElementById('modalTitle');

      modal.classList.remove('hidden');

      if (this.isIOS) {
        icon.setAttribute('data-lucide', 'smartphone');
        title.textContent = 'Install on iOS';
        steps.innerHTML =
          '<div class="modal-step"><div class="modal-step-num">1</div><div class="modal-step-text"><strong>Open in Safari</strong>Use Safari browser for best results</div></div>' +
          '<div class="modal-step"><div class="modal-step-num">2</div><div class="modal-step-text"><strong>Tap Share</strong>Tap the Share button at the bottom of Safari</div></div>' +
          '<div class="modal-step"><div class="modal-step-num">3</div><div class="modal-step-text"><strong>Scroll down</strong>Find and tap "Add to Home Screen"</div></div>' +
          '<div class="modal-step"><div class="modal-step-num">4</div><div class="modal-step-text"><strong>Tap Add</strong>Tap "Add" in the top right corner</div></div>';
      } else if (this.isAndroid) {
        icon.setAttribute('data-lucide', 'smartphone');
        title.textContent = 'Install on Android';
        steps.innerHTML =
          '<div class="modal-step"><div class="modal-step-num">1</div><div class="modal-step-text"><strong>Open in Chrome</strong>Use Chrome browser</div></div>' +
          '<div class="modal-step"><div class="modal-step-num">2</div><div class="modal-step-text"><strong>Tap the menu</strong>Tap the three-dot menu in the top right</div></div>' +
          '<div class="modal-step"><div class="modal-step-num">3</div><div class="modal-step-text"><strong>Tap Install</strong>Tap "Install App" or "Add to Home Screen"</div></div>' +
          '<div class="modal-step"><div class="modal-step-num">4</div><div class="modal-step-text"><strong>Tap Install</strong>Confirm by tapping "Install" in the dialog</div></div>';
      } else {
        icon.setAttribute('data-lucide', 'monitor');
        title.textContent = 'Install on Desktop';
        steps.innerHTML =
          '<div class="modal-step"><div class="modal-step-num">1</div><div class="modal-step-text"><strong>Open in Chrome/Edge</strong>Use Chrome or Edge browser</div></div>' +
          '<div class="modal-step"><div class="modal-step-num">2</div><div class="modal-step-text"><strong>Look for install icon</strong>Click the install icon in the address bar or menu</div></div>' +
          '<div class="modal-step"><div class="modal-step-num">3</div><div class="modal-step-text"><strong>Click Install</strong>Click "Install" in the popup</div></div>' +
          '<div class="modal-step"><div class="modal-step-num">4</div><div class="modal-step-text"><strong>Launch</strong>Open JaviAlert from your desktop or start menu</div></div>';
      }

      try { lucide.createIcons(); } catch (_) { /* ignore */ }
    }

    // ─── MAGNITUDE FILTER ─────────────────────────────────────
    setMagFilter(min) {
      this.magFilter = min;
      document.querySelectorAll('.mag-filter-btn').forEach((btn) => {
        btn.classList.toggle('active', parseFloat(btn.dataset.min) === min);
      });
      this.currentPage = 1;
      this.applySortAndRender();
    }

    // ─── MOOD HISTORY ─────────────────────────────────────────
    _loadMoodHistory() {
      try {
        const stored = localStorage.getItem('javiMoodHistory');
        return stored ? JSON.parse(stored) : [];
      } catch (_) {
        return [];
      }
    }
    _recordMood(mood) {
      const now = Date.now();
      this.moodHistory.push({ mood, time: now });
      // Keep only last 24 hours
      const cutoff = now - 86400000;
      this.moodHistory = this.moodHistory.filter((e) => e.time > cutoff);
      // Keep max 96 entries (one per 15 min)
      if (this.moodHistory.length > 96) {
        this.moodHistory = this.moodHistory.slice(-96);
      }
      try {
        localStorage.setItem('javiMoodHistory', JSON.stringify(this.moodHistory));
      } catch (_) { /* ignore */ }
      this._renderMoodHistory();
    }
    _renderMoodHistory() {
      const container = document.getElementById('moodDots');
      const wrapper = document.getElementById('moodHistory');
      if (!container || !wrapper) return;
      if (!this.moodHistory.length) {
        wrapper.classList.add('hidden');
        return;
      }
      wrapper.classList.remove('hidden');
      container.innerHTML = this.moodHistory.map((e) =>
        '<div class="mood-dot ' + e.mood + '" title="' + new Date(e.time).toLocaleTimeString() + '"></div>'
      ).join('');
    }

    // ─── LAST SIGNIFICANT QUAKE ───────────────────────────────
    _updateLastSignificant(quakes) {
      const el = document.getElementById('statLastSignificant');
      if (!el) return;
      // Find the most recent quake >= WARNING_THRESHOLD
      const significant = quakes
        .filter((q) => q.mag >= CONFIG.WARNING_THRESHOLD)
        .sort((a, b) => b.time - a.time);
      if (!significant.length) {
        el.textContent = '--';
        return;
      }
      const latest = significant[0];
      const diff = Date.now() - new Date(latest.time).getTime();
      const hrs = Math.floor(diff / 3600000);
      if (hrs < 1) {
        const mins = Math.floor(diff / 60000);
        el.textContent = mins + 'm ago';
      } else if (hrs < 24) {
        el.textContent = hrs + 'h ago';
      } else {
        el.textContent = Math.floor(hrs / 24) + 'd ago';
      }
    }
  }

  // ─── Apply module mixins to class prototype ──────────────
  Object.assign(JaviAlertApp.prototype,
    chatMixin, mapMixin, quizMixin, analysisMixin, shareMixin, settingsMixin
  );

  // ─── START ───────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const app = new JaviAlertApp();
    app.init();

    // ─── DEBUG HELPERS (run in browser console) ───────────────
    window.javidebug = {
      /** Show current notification state */
      status() {
        console.log('=== NOTIFICATION DEBUG STATUS ===');
        console.log('knownQuakeIds size:', app.knownQuakeIds.size);
        console.log('Sample known IDs:', [...app.knownQuakeIds].slice(0, 5));
        console.log('lastFetchTime:', app._lastFetchTime ? new Date(app._lastFetchTime).toLocaleString() : 'never');
        console.log('Notification.permission:', Notification.permission);
        console.log('soundEnabled:', app.soundEnabled);
        console.log('volumeLevel:', app.volumeLevel);
        console.log('currentMood:', app.currentMood);
        console.log('userLat:', app.userLat, 'userLon:', app.userLon, 'place:', app.userPlace);
        console.log('=== END STATUS ===');
      },
      /** Reset known IDs so next reload treats all 24h quakes as new (will re-notify) */
      reset() {
        localStorage.removeItem('javiKnownQuakeIds');
        app.knownQuakeIds = new Set();
        console.log('[🔔] Known quake IDs cleared. Reload the page — ALL 24h quakes will notify as new.');
      },
      /** Clear everything and reload fresh */
      clearAll() {
        localStorage.removeItem('javiKnownQuakeIds');
        localStorage.removeItem('javiQuakeCache');
        app.knownQuakeIds = new Set();
        console.log('[🔔] All caches cleared. Reloading...');
        location.reload();
      },
      /** Simulate a test notification */
      testNotif() {
        if (Notification.permission !== 'granted') {
          console.log('[🔔] Notification permission not granted. Current:', Notification.permission);
          return;
        }
        new Notification('JaviAlert Test', {
          body: '4.2 mag 14km away - Davao (Test notification)',
          icon: 'icons/javi-icon.png'
        });
        console.log('[🔔] Test notification sent!');
      }
    };
    console.log('[🔔] Debug helpers loaded! Type: javidebug.status() | javidebug.reset() | javidebug.testNotif()');
  });

