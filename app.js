import { JAVI_MESSAGES, JAVI_REACTIONS, SAFETY_TIPS, EMERGENCY_CONTACTS, CHANGELOG } from './messages.js';
import { playAlertSound, startAmbientSound, stopAmbientSound, setAmbientVolume, setAmbientTrack, setOnTrackChange, getPlaybackMode, setPlaybackMode, nextTrack, toggleAmbient, isAmbientPlaying, preloadAlertAudio, setOnProgress } from './audio.js';
import { API, CONFIG, timeSince, getCompassDir, getDistance, parsePlaceName, magClass, getPHIVOLCSIntensity, intensityClass, shouldShowQuake, PEIS_LABELS, PEIS_SHORT } from './api-utils.js';
import { QUIZ_QUESTIONS } from './quiz-questions.js';

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

    // ─── CHAT MEMORY (localStorage) ──────────────────────────
    /** Load past chat context so Javi remembers the user */
    _loadChatMemory() {
      try {
        const saved = localStorage.getItem('javiChatMemory');
        if (saved) {
          const mem = JSON.parse(saved);
          // Only use memory if it's less than 1 hour old
          if (mem && mem.timestamp && Date.now() - mem.timestamp < 3600000) {
            return mem;
          }
        }
      } catch (_) { /* ignore */ }
      return null;
    }

    /** Save a short summary after each AI reply */
    _saveChatMemory(userMessage, aiReply) {
      try {
        const existing = this._loadChatMemory();
        const topics = existing ? existing.topics : [];
        // Keep last 3 topics
        topics.push(userMessage.slice(0, 60));
        if (topics.length > 3) topics.shift();

        const mem = {
          timestamp: Date.now(),
          lastUserMsg: userMessage.slice(0, 100),
          lastAiSummary: aiReply.slice(0, 100),
          topics,
        };
        localStorage.setItem('javiChatMemory', JSON.stringify(mem));
      } catch (_) { /* ignore */ }
    }

    /** Load full chat history from localStorage */
    _loadChatHistory() {
      try {
        const saved = localStorage.getItem('javiChatHistory');
        if (saved) {
          const msgs = JSON.parse(saved);
          if (Array.isArray(msgs) && msgs.length > 0) {
            // Only restore if less than 24h old (check first message timestamp)
            return msgs;
          }
        }
      } catch (_) { /* ignore */ }
      return [];
    }

    /** Save full chat history to localStorage (last 30 messages) */
    _saveChatHistory() {
      try {
        const toSave = this.chatMessages.slice(-30);
        localStorage.setItem('javiChatHistory', JSON.stringify(toSave));
      } catch (_) { /* ignore */ }
    }

    /** Detect language from text: 'tl', 'ceb', or 'en' */
    _detectLanguage(text) {
      const t = text.toLowerCase();
      // Cebuano markers — unique Cebuano words that DON'T appear in Tagalog
      const cebuanoWords = ['unsa', 'kinsa', 'asa', 'kanus', 'ngano', 'tagpila', 'buntag', 'gabii',
        'adlaw', 'salamat', 'palihug', 'gwapa', 'gwapo', 'maayo', 'kini', 'kana', 'didto', 'dinhi',
        'siya', 'kami', 'og', 'ug', 'hala', 'mao', 'nya', 'bitaw', 'sige', 'lagi', 'kaayo',
        'unya', 'bali', 'imo', 'niya', 'namo', 'nila', 'kita', 'kamo', 'dili', 'wala'];
      const matchesCeb = cebuanoWords.filter(w => t.includes(w)).length;

      // Tagalog markers — unique Tagalog words that DON'T appear in Cebuano
      const tagalogWords = ['po', 'opo', 'sino', 'ano', 'bakit', 'paano', 'saan', 'kailan',
        'magkano', 'meron', 'mayroon', 'atin', 'amin', 'natin', 'sana', 'kasi', 'kaya', 'pero',
        'daw', 'raw', 'kung', 'ito', 'iyan', 'doon', 'dito', 'ganyan', 'ganoon', 'lang', 'din',
        'nyo', 'namin', 'ninyo', 'aming', 'aming', 'inyo', 'kanila', 'kanya'];
      const matchesTl = tagalogWords.filter(w => t.includes(w)).length;

      if (matchesCeb >= matchesTl + 2 && matchesCeb >= 4) return 'ceb';
      if (matchesTl >= matchesCeb + 2 && matchesTl >= 4) return 'tl';
      return 'en';
    }

    /** Pick a fallback Javi response when AI is unavailable */
    _fallbackResponse() {
      const mood = this.currentMood || 'safe';
      const pool = JAVI_MESSAGES[mood] || JAVI_MESSAGES.safe;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    /** Quick reply suggestions shown below each bot message */
    _quickReply() {
      const lang = this._quizLang();
      if (lang === 'ceb') {
        return [
          { text: 'Unsa ang linog?', msg: 'Unsa ang linog? Ipaliwang sa ako.' },
          { text: 'Mga safety tips', msg: 'Unsa ang akong buhaton kung maglinog?' },
          { text: 'Andam ba ko?', msg: 'Giunsa pagkahibalo kung handa ko sa linog?' },
        ];
      } else if (lang === 'tl') {
        return [
          { text: 'Ano ang lindol?', msg: 'Ano ang lindol? Ipaliwanag mo sa akin.' },
          { text: 'Mga safety tips', msg: 'Ano ang dapat kong gawin kapag may lindol?' },
          { text: 'Handa ba ako?', msg: 'Paano malalaman kung handa ako sa lindol?' },
        ];
      }
      return [
        { text: 'What is an earthquake?', msg: 'What is an earthquake? Explain it to me.' },
        { text: 'Safety tips', msg: 'What should I do during an earthquake?' },
        { text: 'Am I ready?', msg: 'How do I know if I\'m prepared for an earthquake?' },
      ];
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

      // Pull-to-refresh (mobile)
      this._setupPullToRefresh();

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

    /** Update the unread badge on the chat head */
    _updateChatHeadBadge() {
      const badge = document.getElementById('chatHeadBadge');
      if (!badge) return;
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount > 99 ? '99+' : String(this.unreadCount);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    /** Show a notification popup — left of head when head is on right side, right of head when on left side */
    _showChatHeadNotif(title, body) {
      const notif = document.getElementById('chatHeadNotif');
      const titleEl = document.getElementById('chatHeadNotifTitle');
      const bodyEl = document.getElementById('chatHeadNotifBody');
      if (!notif || !titleEl || !bodyEl) return;

      titleEl.textContent = title || 'Javi';
      bodyEl.textContent = body || '';

      // Remove hidden FIRST so offsetWidth works for reflow
      notif.classList.remove('hidden');
      notif.classList.remove('chat-head-notif-left', 'chat-head-notif-right');

      // Force reflow so browser registers the class removal before adding new class
      void notif.offsetWidth;

      // Determine position: if head is on RIGHT half → popup LEFT; if on LEFT half → popup RIGHT
      const head = document.getElementById('chatHead');
      if (head) {
        const rect = head.getBoundingClientRect();
        const headCenterX = rect.left + rect.width / 2;
        const showLeft = headCenterX > window.innerWidth / 2;
        notif.classList.add(showLeft ? 'chat-head-notif-left' : 'chat-head-notif-right');
      } else {
        notif.classList.add('chat-head-notif-left');
      }

      // Auto-hide after 5 seconds
      if (this._notifTimer) clearTimeout(this._notifTimer);
      this._notifTimer = setTimeout(() => {
        notif.classList.add('hidden');
      }, 5000);
    }

    /** Lock body scrolling when a modal is open */
    _lockBodyScroll() {
      this._scrollPos = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + this._scrollPos + 'px';
      document.body.style.width = '100%';
    }

    /** Restore body scrolling */
    _unlockBodyScroll() {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, this._scrollPos);
    }

    /** Make the chat head draggable like Messenger — snap to nearest edge */
    _initChatHeadDrag() {
      const head = document.getElementById('chatHead');
      if (!head) return;
      const size = 56; // icon size in px
      const margin = 12;

      // Load saved position or default to bottom-right
      let savedPos = null;
      try { savedPos = JSON.parse(localStorage.getItem('javiChatHeadPos')); } catch (_) {} // prettier-ignore

      const setInitialPos = () => {
        if (savedPos) {
          head.style.left = savedPos.x + 'px';
          head.style.top = savedPos.y + 'px';
        } else {
          head.style.left = (window.innerWidth - size - 24) + 'px';
          head.style.top = (window.innerHeight - size - 24) + 'px';
        }
      };
      setInitialPos();

      let isDragging = false;
      let startX, startY, origLeft, origTop;
      let moved = false;

      const onPointerDown = (e) => {
        if (e.button !== 0) return;
        // Prevent default to stop scroll/click — we handle everything via pointer events
        e.preventDefault();
        // Hide notification popup when dragging
        const notif = document.getElementById('chatHeadNotif');
        if (notif && !notif.classList.contains('hidden')) {
          notif.classList.add('hidden');
          if (this._notifTimer) clearTimeout(this._notifTimer);
        }
        isDragging = false;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = head.getBoundingClientRect();
        origLeft = rect.left;
        origTop = rect.top;
        head.setPointerCapture(e.pointerId);
        head.classList.add('grabbing');
      };

      const onPointerMove = (e) => {
        if (!head.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          isDragging = true;
          moved = true;
        }
        if (isDragging) {
          // Prevent page scroll while dragging
          e.preventDefault();
          let newX = origLeft + dx;
          let newY = origTop + dy;
          newX = Math.max(0, Math.min(window.innerWidth - size, newX));
          newY = Math.max(0, Math.min(window.innerHeight - size, newY));
          head.style.left = newX + 'px';
          head.style.top = newY + 'px';
        }
      };

      const onPointerUp = (e) => {
        head.classList.remove('grabbing');
        if (isDragging) {
          const rect = head.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const snapLeft = centerX < window.innerWidth / 2;
          const snapX = snapLeft ? margin : window.innerWidth - size - margin;
          const snapY = Math.max(margin, Math.min(window.innerHeight - size - margin, parseInt(head.style.top, 10)));
          head.style.left = snapX + 'px';
          head.style.top = snapY + 'px';
          savedPos = { x: snapX, y: snapY };
          try { localStorage.setItem('javiChatHeadPos', JSON.stringify(savedPos)); } catch (_) {} // prettier-ignore
        } else if (!moved) {
          // Treat as a tap — open chat
          this._showChat();
        }
      };

      head.addEventListener('pointerdown', onPointerDown);
      head.addEventListener('pointermove', onPointerMove);
      head.addEventListener('pointerup', onPointerUp);
      head.addEventListener('pointercancel', onPointerUp);

      // Handle window resize — keep within bounds
      window.addEventListener('resize', () => {
        const x = parseInt(head.style.left, 10) || 0;
        const y = parseInt(head.style.top, 10) || 0;
        if (x + size > window.innerWidth - margin || y + size > window.innerHeight - margin) {
          const newX = Math.min(x, window.innerWidth - size - margin);
          const newY = Math.min(y, window.innerHeight - size - margin);
          head.style.left = Math.max(margin, newX) + 'px';
          head.style.top = Math.max(margin, newY) + 'px';
          savedPos = { x: parseInt(head.style.left, 10), y: parseInt(head.style.top, 10) };
          try { localStorage.setItem('javiChatHeadPos', JSON.stringify(savedPos)); } catch (_) {} // prettier-ignore
        }
      });
    }

    /** Push a proactive earthquake alert into the chat */
    _pushProactiveAlert(quake, alertType) {
      const mag = quake.mag.toFixed(1);
      const place = quake.place;
      const dist = quake.dist;
      const depth = quake.depth !== null ? quake.depth + ' km depth' : 'unknown depth';
      const timeAgo = timeSince(quake.time);

      let advice = '';
      if (alertType === 'danger') {
        advice = '🚨 DANGER! ' + mag + ' magnitude earthquake near ' + place + ' (' + dist + ' km away, ' + depth + ')! DROP, COVER, and HOLD ON right now! Protect your head and stay under cover until the shaking stops.';
      } else if (alertType === 'warning') {
        advice = '⚠️ Warning! ' + mag + ' magnitude earthquake detected near ' + place + ' (' + dist + ' km away, ' + depth + '). Stay alert and be ready! Secure loose items and check your emergency kit.';
      }

      const chatMsg = advice + '\n\n' + (alertType === 'danger'
        ? 'Remember: Drop, Cover, and Hold On! 🛡️'
        : 'Stay safe and check your surroundings! 🙏');

      // Push to chat if it's not a duplicate (check last 2 messages)
      const lastMsgs = this.chatMessages.slice(-2).map(m => m.content).join(' ');
      if (!lastMsgs.includes(quake.id) && !lastMsgs.includes(mag + ' magnitude')) {
        this.chatMessages.push({ role: 'assistant', content: chatMsg, _quakeId: quake.id });
        this._saveChatHistory();

        // If chat is closed, show notification popup on chat head
        const chatModal = document.getElementById('chatModal');
        const chatHidden = !chatModal || chatModal.classList.contains('hidden');
        if (chatHidden) {
          this.unreadCount++;
          this._updateChatHeadBadge();
          const shortMsg = alertType === 'danger'
            ? '🚨 ' + mag + ' mag earthquake near ' + place + '!'
            : '⚠️ ' + mag + ' mag quake near ' + place;
          this._showChatHeadNotif('⚠️ Earthquake Alert', shortMsg);
        }
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

    _showQuiz() {
      const modal = document.getElementById('quizModal');
      if (!modal) return;
      this._resetQuiz();
      modal.classList.remove('hidden');
    }

    _resetQuiz() {
      this.quizState.current = 0;
      this.quizState.score = 0;
      this.quizState.selected = null;
      this.quizState.completed = false;
      this.quizState.order = QUIZ_QUESTIONS.map((_, index) => index);
      for (let i = this.quizState.order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.quizState.order[i], this.quizState.order[j]] = [this.quizState.order[j], this.quizState.order[i]];
      }
      // Only show 20 random questions per quiz
      this.quizState.order = this.quizState.order.slice(0, 20);
      this._renderQuizQuestion();
    }

    _renderQuizQuestion() {
      const questionLabel = document.getElementById('quizQuestionLabel');
      const progressFill = document.getElementById('quizProgressFill');
      const scoreDisplay = document.getElementById('quizScore');
      const questionText = document.getElementById('quizQuestionText');
      const options = document.getElementById('quizOptions');
      const nextBtn = document.getElementById('quizNextBtn');
      const total = this.quizState.order.length;
      const current = this.quizState.current;

      // Always English UI
      const TXT = {
        score: 'Score:',
        completed: 'Quiz completed',
        summary: 'Test your earthquake knowledge. Choose the correct answer and find out if you\'re ready!',
        correct: 'Correct answer:',
        close: 'Close',
        question: 'Question',
        of: 'of',
        submit: 'Submit',
        next: 'Next',
      };
      const t = TXT;

      if (scoreDisplay) {
        scoreDisplay.textContent = t.score + ' ' + this.quizState.score + ' / ' + total;
      }

      if (current >= total) {
        this.quizState.completed = true;
        questionLabel.textContent = t.completed;
        progressFill.style.width = '100%';
        questionText.innerHTML = '<p>' + t.summary + '</p>';

        const answersHtml = this.quizState.order.map((questionIndex, index) => {
          const item = QUIZ_QUESTIONS[questionIndex];
          const correctText = item.choices[item.answer];
          return '<div class="quiz-review"><strong>' + (index + 1) + '. ' + item.question + '</strong>' +
            '<div class="quiz-review-answer">' + t.correct + ' ' + correctText + '</div></div>';
        }).join('');

        options.innerHTML = answersHtml;
        nextBtn.textContent = t.close;
        nextBtn.disabled = false;
        return;
      }

      const question = QUIZ_QUESTIONS[this.quizState.order[current]];
      questionLabel.textContent = t.question + ' ' + (current + 1) + ' ' + t.of + ' ' + total;
      progressFill.style.width = Math.round((current / total) * 100) + '%';
      questionText.textContent = question.question;

      const shuffledChoices = question.choices.map((choice, index) => ({
        text: choice,
        originalIndex: index
      }));

      for (let i = shuffledChoices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledChoices[i], shuffledChoices[j]] = [shuffledChoices[j], shuffledChoices[i]];
      }

      this.quizState.currentChoices = shuffledChoices;
      options.innerHTML = shuffledChoices.map((choice) =>
        '<button class="quiz-option" type="button" data-index="' + choice.originalIndex + '">' + choice.text + '</button>'
      ).join('');

      this.quizState.selected = null;
      nextBtn.textContent = current === total - 1 ? t.submit : t.next;
      nextBtn.disabled = true;

      // Update restart button
      const restartBtn = document.getElementById('quizRestartBtn');
      if (restartBtn) {
        restartBtn.textContent = 'Restart';
      }

      options.querySelectorAll('.quiz-option').forEach((btn) => {
        btn.addEventListener('click', () => this._selectQuizOption(btn));
      });
    }

    _selectQuizOption(button) {
      if (this.quizState.completed) return;
      if (this.quizState.selected !== null) return; // lock after first selection
      const selected = parseInt(button.dataset.index, 10);
      const current = this.quizState.current;
      const questionIndex = this.quizState.order[current];
      const correct = QUIZ_QUESTIONS[questionIndex].answer;
      const optionButtons = document.querySelectorAll('#quizOptions .quiz-option');

      this.quizState.selected = selected;
      optionButtons.forEach((btn) => {
        const idx = parseInt(btn.dataset.index, 10);
        btn.classList.remove('selected', 'correct', 'incorrect');
      });

      optionButtons.forEach((btn) => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx === selected) {
          btn.classList.add('selected');
        }
        if (idx === correct) {
          btn.classList.add('correct');
        } else if (idx === selected) {
          btn.classList.add('incorrect');
        }
      });

      const nextBtn = document.getElementById('quizNextBtn');
      if (nextBtn) nextBtn.disabled = false;
    }

    _nextQuizQuestion() {
      const total = this.quizState.order.length;
      if (this.quizState.completed) {
        document.getElementById('quizModal').classList.add('hidden');
        return;
      }

      const current = this.quizState.current;
      const selected = this.quizState.selected;
      if (selected === null) return;

      const questionIndex = this.quizState.order[current];
      const correct = QUIZ_QUESTIONS[questionIndex].answer;
      if (selected === correct) {
        this.quizState.score += 1;
      }

      this.quizState.current += 1;
      this.quizState.selected = null;
      this._renderQuizQuestion();
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

    // ─── MAP ──────────────────────────────────────────────────
    _initMap() {
      const el = document.getElementById('quakeMap');
      if (!el) return;
      if (this.map) {
        this.map.invalidateSize();
        return;
      }

      const dark = this.isDarkMode;
      const tileUrl = dark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const attr = dark
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

      this.map = L.map(el, {
        center: [this.userLat || 14.5995, this.userLon || 120.9842],
        zoom: 7,
        zoomControl: true,
        attributionControl: true,
      });

      this.mapTiles = L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution: attr,
      }).addTo(this.map);

      // User location marker
      const userIcon = L.divIcon({
        className: '',
        html: '<div class="user-loc-marker"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      this.userMarker = L.marker([this.userLat || 14.5995, this.userLon || 120.9842], {
        icon: userIcon,
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(this.map);

      // Invalidate size after a short delay to ensure the map renders properly
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 300);

      // Re-render markers now that the map exists
      this._updateMapMarkers();
    }

    _updateMapMarkers() {
      if (!this.map) return;

      // Update user marker position
      if (this.userMarker && this.userLat && this.userLon) {
        this.userMarker.setLatLng([this.userLat, this.userLon]);
      }

      // Clear existing quake markers
      this.mapMarkers.forEach((m) => this.map.removeLayer(m));
      this.mapMarkers = [];

      if (!this.allQuakes || !this.allQuakes.length) return;

      // Map filters: read from custom dropdown data-value attributes
      const mapTimeBtn = document.getElementById('mapTimeFilter');
      const mapMagBtn = document.getElementById('mapMagFilter');
      const mapTimeDays = parseInt(mapTimeBtn?.dataset?.value || '7', 10);
      const mapMagMin = parseFloat(mapMagBtn?.dataset?.value || '0');
      const mapTimeMs = mapTimeDays * 86400000;

      // Determine which quakes to show on the map
      // Mag >= 5 shown at any distance, smaller quakes only within 300km
      let shown = this.allQuakes.filter((q) =>
        (q.dist <= 300 || q.mag >= 5) &&
        (Date.now() - q.time.getTime()) < mapTimeMs &&
        q.mag >= mapMagMin
      );
      if (this.magFilter > 0) {
        shown = shown.filter((q) => q.mag >= this.magFilter);
      }

      // Fit bounds to include all markers
      const bounds = [];

      shown.forEach((q) => {
        const color = this._magColor(q.mag);
        const radius = Math.max(6, Math.min(q.mag * 3, 20));

        const marker = L.circleMarker([q.lat, q.lon], {
          radius,
          color: '#2d3436',
          weight: 2,
          fillColor: color,
          fillOpacity: 0.8,
        });

        const ts = timeSince(q.time);
        const mag = q.mag.toFixed(1);
        const cls = magClass(q.mag);
        const badgeColor = this._magBgColor(q.mag);

        marker.bindPopup(
          '<div class="quake-popup">' +
            '<div><span class="popup-mag" style="background:' + badgeColor + '">' + mag + '</span>' +
            '<span class="popup-place">' + q.place + '</span></div>' +
            '<div class="popup-meta">' +
              '<span>📍 ' + q.dist + ' km ' + q.dir + '</span>' +
              '<span>🕐 ' + ts + '</span>' +
              (q.depth !== null ? '<span>📏 ' + q.depth + ' km</span>' : '') +
            '</div>' +
            '<a class="popup-link" data-quake-id="' + q.id + '">🔍 View details</a>' +
          '</div>',
          { className: 'quake-popup', maxWidth: 260 }
        );

        marker.on('popupopen', () => {
          // Attach click handler to the "View details" link after popup opens
          setTimeout(() => {
            const link = document.querySelector('.quake-popup .popup-link[data-quake-id="' + q.id + '"]');
            if (link) {
              link.addEventListener('click', (e) => {
                e.preventDefault();
                this.map.closePopup();
                this._showQuakeDetail(q);
              });
            }
          }, 50);
        });

        marker.addTo(this.map);
        this.mapMarkers.push(marker);
        bounds.push([q.lat, q.lon]);
      });

      // Add user location to bounds
      if (this.userLat && this.userLon) {
        bounds.push([this.userLat, this.userLon]);
      }

      // Fit map to bounds if there are markers
      if (bounds.length > 1) {
        try {
          this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
        } catch (_) { /* ignore bounds errors */ }
      }
    }

    _setupMapDropdown(containerId, triggerId, optionsId, onChange) {
      const container = document.getElementById(containerId);
      const trigger = document.getElementById(triggerId);
      const optionsEl = document.getElementById(optionsId);
      if (!trigger || !optionsEl) return;

      const textEl = trigger.querySelector('span');
      trigger.dataset.value = optionsEl.querySelector('.selected')?.dataset?.value || '0';

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other map dropdowns
        document.querySelectorAll('.map-filter-wrap .custom-select-options').forEach(el => {
          if (el !== optionsEl) el.classList.add('hidden');
        });
        optionsEl.classList.toggle('hidden');
      });

      optionsEl.querySelectorAll('.custom-select-option').forEach(btn => {
        btn.addEventListener('click', () => {
          optionsEl.querySelectorAll('.custom-select-option').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          trigger.dataset.value = btn.dataset.value;
          if (textEl) textEl.textContent = btn.textContent;
          optionsEl.classList.add('hidden');
          if (onChange) onChange();
        });
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!container || !container.contains(e.target)) {
          optionsEl.classList.add('hidden');
        }
      });
    }

    _magColor(mag) {
      if (mag < 3) return '#00b894';
      if (mag < 4) return '#fdcb6e';
      if (mag < 5) return '#e17055';
      if (mag < 6) return '#d63031';
      return '#6c5ce7';
    }

    _magBgColor(mag) {
      if (mag < 3) return '#00b894';
      if (mag < 4) return '#fdcb6e';
      if (mag < 5) return '#e17055';
      if (mag < 6) return '#d63031';
      return '#6c5ce7';
    }

    // ─── TOGGLE DARK MODE ─────────────────────────────────────
    toggleDarkMode() {
      this.isDarkMode = !this.isDarkMode;
      document.body.classList.toggle('dark-mode', this.isDarkMode);
      localStorage.setItem('javiDarkMode', this.isDarkMode);

      // Switch map tiles for dark mode
      this._switchMapTiles();
    }

    _switchMapTiles() {
      if (!this.map || !this.mapTiles) return;
      const dark = this.isDarkMode;
      const tileUrl = dark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const attr = dark
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

      this.map.removeLayer(this.mapTiles);
      this.mapTiles = L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution: attr,
      }).addTo(this.map);
    }

    // ─── NOTIFICATION SOUND ────────────────────────────────────
    _setNotifSound(sound) {
      this.notifSound = sound;
      localStorage.setItem('javiNotifSound', sound);
      // If user picks a sound option, ensure sound is enabled
      if (sound !== 'silent') {
        this.soundEnabled = true;
        localStorage.setItem('javiSoundEnabled', 'true');
      }
      this._updateSettingsUI();
    }

    /** Speak earthquake alert using Web Speech API (Javi voice) */
    _speakAlert(quake, alertType) {
      if (!this.soundEnabled) return;
      try {
        if (!window.speechSynthesis) return;
        const mag = quake.mag.toFixed(1);
        const place = quake.place;
        const dist = quake.dist;
        const msg = alertType === 'danger'
          ? 'Danger! ' + mag + ' magnitude earthquake near ' + place + ', ' + dist + ' kilometers away. Drop, cover, and hold on!'
          : 'Warning. ' + mag + ' magnitude earthquake detected near ' + place + ', ' + dist + ' kilometers away. Stay alert.';
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        utterance.volume = this.volumeLevel;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (_) { /* speech not supported */ }
    }

    /** Speak generic alert from SW notification (no quake details available) */
    _speakGenericAlert(alertType) {
      if (!this.soundEnabled) return;
      try {
        if (!window.speechSynthesis) return;
        const msg = alertType === 'danger'
          ? 'Danger! Strong earthquake detected! Drop, cover, and hold on!'
          : 'Earthquake detected. Please check the app for details.';
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        utterance.volume = this.volumeLevel;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (_) { /* speech not supported */ }
    }

    // ─── PULL-TO-REFRSH ────────────────────────────────────────
    _setupPullToRefresh() {
      const indicator = document.getElementById('pullIndicator');
      const pullText = document.getElementById('pullText');
      if (!indicator) return;

      let startY = 0;
      let pulling = false;
      let indicatorShown = false;
      let suppressClick = false;
      const THRESHOLD = 80; // px to trigger refresh
      const SHOW_AFTER = 10; // px of pull before indicator appears

      // Find the list card top position to know the boundary
      const getListCardTop = () => {
        const listCard = document.querySelector('.list-card');
        return listCard ? listCard.getBoundingClientRect().top : 300;
      };

      const onTouchStart = (e) => {
        // Only activate if at the very top of the page
        if (window.scrollY > 2) return;
        // Only activate if touch is above the list card (in the header/character area)
        const touchY = e.touches[0].clientY;
        if (touchY >= getListCardTop()) return;
        startY = touchY;
        pulling = true;
        indicatorShown = false;
        suppressClick = false;
      };

      const onTouchMove = (e) => {
        if (!pulling) return;
        const deltaY = e.touches[0].clientY - startY;
        if (deltaY <= 0) {
          if (indicatorShown) {
            indicator.classList.remove('visible', 'pull-ready');
            indicatorShown = false;
          }
          pulling = false;
          return;
        }
        // Only show indicator after a minimum pull distance
        if (!indicatorShown && deltaY >= SHOW_AFTER) {
          indicatorShown = true;
          indicator.classList.add('visible');
          indicator.classList.remove('pull-ready');
          pullText.textContent = 'Pull to refresh';
        }
        if (indicatorShown) {
          if (deltaY >= THRESHOLD) {
            indicator.classList.add('pull-ready');
            pullText.textContent = 'Release to refresh';
          } else {
            indicator.classList.remove('pull-ready');
            pullText.textContent = 'Pull to refresh';
          }
        }
      };

      const onTouchEnd = (e) => {
        if (!pulling) return;
        pulling = false;
        const deltaY = e.changedTouches[0].clientY - startY;
        if (indicatorShown) {
          indicator.classList.remove('visible', 'pull-ready');
          indicatorShown = false;
        }
        if (deltaY >= THRESHOLD) {
          suppressClick = true;
          pullText.textContent = 'Refreshing…';
          this.loadData();
          // Suppress any click that might follow this touch gesture
          setTimeout(() => { suppressClick = false; }, 500);
        }
      };

      // Suppress click events after a pull-to-refresh gesture
      document.addEventListener('click', (e) => {
        if (suppressClick) {
          e.stopPropagation();
          e.preventDefault();
          suppressClick = false;
        }
      }, true);

      document.addEventListener('touchstart', onTouchStart, { passive: true });
      document.addEventListener('touchmove', onTouchMove, { passive: true });
      document.addEventListener('touchend', onTouchEnd, { passive: true });
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

    // ─── SHOW QUAKE DETAIL MODAL ──────────────────────────────
    _showQuakeDetail(q) {
      const modal = document.getElementById('quakeDetailModal');
      const mapFrame = document.getElementById('detailMap');
      const body = document.getElementById('detailBody');
      const viewBtn = document.getElementById('detailViewMap');
      const shareBtn = document.getElementById('detailShareImg');

      const mag = q.mag.toFixed(1);
      const cls = magClass(q.mag);
      const timeStr = timeSince(q.time);
      const mapsUrl = 'https://www.google.com/maps?q=' + q.lat + ',' + q.lon;
      const embedUrl = 'https://maps.google.com/maps?q=' + q.lat + ',' + q.lon +
        '&z=10&output=embed&maptype=satellite';

      // Set map iframe
      mapFrame.src = embedUrl;

      // Build info body
      const intLabel = PEIS_LABELS[q.intensity] || '—';
      const intCls = intensityClass(q.intensity);
      body.innerHTML =
        '<div class="detail-mag-row">' +
          '<div class="detail-mag-badge ' + cls + '">' + mag + '</div>' +
          '<div class="detail-intensity-badge ' + intCls + '">' + intLabel + '</div>' +
          '<div class="detail-mag-label">' +
            'Magnitude<strong>' + cls.charAt(0).toUpperCase() + cls.slice(1) + '</strong>' +
          '</div>' +
        '</div>' +
        '<div class="detail-place">' + q.place + '</div>' +
        '<div class="detail-raw-place">' + q.rawPlace + '</div>' +
        '<div class="detail-info-grid">' +
          '<div class="detail-info-item">' +
            '<div class="label">Distance</div>' +
            '<div class="value">' + q.dist + ' km ' + q.dir + '</div>' +
          '</div>' +
          '<div class="detail-info-item">' +
            '<div class="label">Coordinates</div>' +
            '<div class="value">' + q.lat.toFixed(2) + ', ' + q.lon.toFixed(2) + '</div>' +
          '</div>' +
          '<div class="detail-info-item">' +
            '<div class="label">Time</div>' +
            '<div class="value">' + timeStr + '</div>' +
          '</div>' +
          '<div class="detail-info-item">' +
            '<div class="label">Depth</div>' +
            '<div class="value">' + (q.depth !== null ? q.depth + ' km' : '--') + '</div>' +
          '</div>' +
        '</div>';

      // Store current quake for share button
      this._detailQuake = q;

      // Button actions
      viewBtn.onclick = () => window.open(mapsUrl, '_blank', 'noopener');
      shareBtn.onclick = () => this._shareQuakeAsImage(q);

      // Show modal
      modal.classList.remove('hidden');
    }

    // ─── SHARE QUAKE (text fallback) ──────────────────────────
    _shareQuake(q) {
      const mapsUrl = 'https://www.google.com/maps?q=' + q.lat + ',' + q.lon;
      const text = '🌍 Magnitude ' + q.mag.toFixed(1) + ' earthquake\n' +
        '📍 ' + q.dist + ' km ' + q.dir + ' of ' + q.place + '\n' +
        '🕐 ' + timeSince(q.time) + '\n' +
        '🗺️ View on Google Maps: ' + mapsUrl;
      if (navigator.share) {
        navigator.share({ title: 'Earthquake Alert — Mag ' + q.mag.toFixed(1), text, url: mapsUrl }).catch(() => {});
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(text).catch(() => {});
      }
    }

    // ─── SHARE QUAKE AS IMAGE ─────────────────────────────────
    async _shareQuakeAsImage(q) {
      // Load Javi icon for the card
      const javiIcon = await this._loadImage('icons/javi-avatar.png');

      // ── Load static map tiles ──
      const mapTiles = await this._loadMapTiles(q.lat, q.lon, 7, 3);

      // Build a canvas card and show share overlay
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const w = 600, h = 420;
      canvas.width = w * 2; canvas.height = h * 2;
      ctx.scale(2, 2); // retina

      const dark = this.isDarkMode;

      // ── Background gradient ──
      const grad = ctx.createLinearGradient(0, 0, w, h);
      if (dark) {
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(1, '#302b63');
      } else {
        grad.addColorStop(0, '#4facfe');
        grad.addColorStop(1, '#a8edea');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // ── Decorative clouds ──
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) {
        const cx = [80, 250, 480, 620][i];
        const cy = [35, 75, 25, 65][i];
        const r = [50, 40, 60, 35][i];
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.7, cy - r * 0.3, r * 0.7, 0, Math.PI * 2);
        ctx.arc(cx + r * 1.2, cy, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── Rounded card ──
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = dark ? '#2a2a3e' : 'rgba(255,255,255,0.95)';
      this._roundRect(ctx, 16, 16, w - 32, h - 32, 18);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Card border
      ctx.strokeStyle = dark ? '#555' : '#2d3436';
      ctx.lineWidth = 2.5;
      this._roundRect(ctx, 16, 16, w - 32, h - 32, 18);
      ctx.stroke();

      // ── Map tiles (right side, contained within card) ──
      const cardL = 16, cardR = w - 16, cardT = 16, cardB = h - 16;
      const mapX = 320, mapY = cardT + 10, mapW = cardR - mapX - 10, mapH = 230;
      ctx.save();
      // Clip map to card's right side with rounded top-right and bottom-right corners
      ctx.beginPath();
      this._roundRect(ctx, mapX, mapY, mapW, mapH, 18);
      ctx.clip();
      if (mapTiles) {
        ctx.drawImage(mapTiles, mapX, mapY, mapW, mapH);
        // Subtle overlay
        ctx.fillStyle = dark ? 'rgba(26,26,46,0.12)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(mapX, mapY, mapW, mapH);
      } else {
        ctx.fillStyle = dark ? '#3a3a5e' : '#dfe6e9';
        ctx.fillRect(mapX, mapY, mapW, mapH);
      }
      ctx.restore();
      // Divider line between info and map
      ctx.strokeStyle = dark ? '#444' : '#dfe6e9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mapX, mapY + 12);
      ctx.lineTo(mapX, mapY + mapH - 12);
      ctx.stroke();

      // ── Epicenter pin on map (accurate position from lat/lon) ──
      // Recalculate fractional tile position to place pin accurately
      const tileN = Math.pow(2, 7); // zoom 7
      const tileXf = (q.lon + 180) / 360 * tileN;
      const tileYf = (1 - Math.log(Math.tan(q.lat * Math.PI / 180) + 1 / Math.cos(q.lat * Math.PI / 180)) / Math.PI) / 2 * tileN;
      const epicFracX = tileXf - Math.floor(tileXf); // 0..1 within tile
      const epicFracY = tileYf - Math.floor(tileYf);
      const gridTotal = 256 * 3; // 3x3 grid, 256px tiles = 768px
      const epicPxX = 256 + epicFracX * 256; // pixel on tile canvas (half=1 → starts at 256)
      const epicPxY = 256 + epicFracY * 256;
      const pinCX = mapX + (epicPxX / gridTotal) * mapW;
      const pinCY = mapY + (epicPxY / gridTotal) * mapH;
      // Pulsing ring
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#e17055';
      ctx.beginPath();
      ctx.arc(pinCX, pinCY, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(pinCX, pinCY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Pin dot
      ctx.fillStyle = '#e17055';
      ctx.beginPath();
      ctx.arc(pinCX, pinCY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pinCX, pinCY, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Pin border
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pinCX, pinCY, 7, 0, Math.PI * 2);
      ctx.stroke();
      // Coordinates label at bottom of map
      ctx.fillStyle = dark ? '#888' : '#636e72';
      ctx.font = '10px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(q.lat.toFixed(2) + '°N  ' + q.lon.toFixed(2) + '°E', mapX + mapW / 2, mapY + mapH + 16);

      // ── Javi icon (top-right) ──
      if (javiIcon) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(w - 56, 42, 18, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#fff';
        ctx.fillRect(w - 74, 24, 36, 36);
        ctx.drawImage(javiIcon, w - 74, 24, 36, 36);
        ctx.restore();
        ctx.strokeStyle = dark ? '#555' : '#2d3436';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w - 56, 42, 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Header ──
      ctx.fillStyle = dark ? '#e0e0e0' : '#2d3436';
      ctx.font = 'bold 20px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('JaviAlert', 40, 44);

      // Subheader: EARTHQUAKE ALERT
      ctx.fillStyle = dark ? '#aaa' : '#636e72';
      ctx.font = 'bold 11px Fredoka, sans-serif';
      ctx.fillText('EARTHQUAKE ALERT', 40, 60);

      // Separator
      ctx.strokeStyle = dark ? '#444' : '#dfe6e9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(32, 72);
      ctx.lineTo(mapX - 16, 72);
      ctx.stroke();

      // ── Magnitude badge ──
      const mag = q.mag.toFixed(1);
      const cls = magClass(q.mag);
      const badgeColor = cls === 'danger' ? '#e17055' : cls === 'warning' ? '#fdcb6e' : '#00b894';
      const badgeX = 40, badgeY = 84, badgeW = 80, badgeH = 64;
      // Badge shadow
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      this._roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 12);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      // Badge border
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      this._roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 12);
      ctx.stroke();
      // Badge shadow (cartoon style)
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2.5;
      this._roundRect(ctx, badgeX + 3, badgeY + 3, badgeW, badgeH, 12);
      ctx.stroke();
      // MAGNITUDE label
      ctx.fillStyle = cls === 'warning' ? '#2d3436' : '#fff';
      ctx.font = 'bold 10px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MAGNITUDE', badgeX + badgeW / 2, badgeY + 18);
      // Number
      ctx.font = 'bold 34px Fredoka, sans-serif';
      ctx.fillText(mag, badgeX + badgeW / 2, badgeY + 54);

      // ── Intensity badge ──
      if (q.intensity) {
        const intX = badgeX + badgeW + 16, intY = badgeY + 4;
        const intLabel = PEIS_SHORT[q.intensity] || '';
        const intColor = q.intensity <= 2 ? '#74b9ff' : q.intensity <= 4 ? '#fdcb6e' : q.intensity <= 6 ? '#e17055' : '#d63031';
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = intColor;
        ctx.beginPath();
        this._roundRect(ctx, intX, intY, 40, 34, 8);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#2d3436';
        ctx.lineWidth = 2;
        ctx.beginPath();
        this._roundRect(ctx, intX, intY, 40, 34, 8);
        ctx.stroke();
        ctx.fillStyle = q.intensity <= 2 ? '#2d3436' : '#fff';
        ctx.font = 'bold 10px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('INT', intX + 20, intY + 13);
        ctx.font = 'bold 16px Fredoka, sans-serif';
        ctx.fillText(intLabel, intX + 20, intY + 29);
      }

      // ── Place name ──
      ctx.fillStyle = dark ? '#e0e0e0' : '#2d3436';
      ctx.font = 'bold 15px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      const placeLabel = q.dist + ' km ' + q.dir + ' of ' + q.place;
      this._wrapText(ctx, placeLabel, 40, 174, 320, 18, 3);

      // ── Info rows ──
      const infoY = 238;
      const infoData = [
        { icon: '🕐', label: timeSince(q.time) },
        { icon: '📏', label: q.depth !== null ? q.depth + ' km depth' : '--' },
        { icon: '📍', label: q.lat.toFixed(2) + ', ' + q.lon.toFixed(2) },
      ];
      infoData.forEach((item, i) => {
        const y = infoY + i * 30;
        ctx.fillStyle = dark ? '#aaa' : '#636e72';
        ctx.font = '13px Fredoka, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(item.icon + '  ' + item.label, 44, y);
      });

      // ── Quote bar at bottom (left side only) ──
      const barY = h - 105;
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
      this._roundRect(ctx, 32, barY, mapX - 44, 28, 10);
      ctx.fill();
      ctx.fillStyle = dark ? '#999' : '#636e72';
      ctx.font = '12px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      const quote = this._getRandomQuote();
      ctx.fillText('💬 ' + quote, 32 + (mapX - 44) / 2, barY + 19);

      // ── Footer (left side) ──
      ctx.fillStyle = dark ? '#666' : '#b2bec3';
      ctx.font = '10px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('JaviAlert  •  ' + q.rawPlace, 32 + (mapX - 44) / 2, h - 58);

      // ── App URL at bottom-left ──
      ctx.fillStyle = dark ? '#555' : '#b2bec3';
      ctx.font = '9px Fredoka, sans-serif';
      ctx.fillText('javi-alert.vercel.app', 32 + (mapX - 44) / 2, h - 42);

      // Show overlay
      this._showShareImageOverlay(canvas, q);
    }

    // ── Load static OSM map tiles onto canvas ──
    _loadMapTiles(lat, lon, zoom, grid) {
      return new Promise((resolve) => {
        const tileSize = 256;
        const half = Math.floor(grid / 2);
        const totalSize = tileSize * grid;
        const canvas = document.createElement('canvas');
        canvas.width = totalSize;
        canvas.height = totalSize;
        const ctx = canvas.getContext('2d');

        // Convert lat/lon to fractional tile coords
        const n = Math.pow(2, zoom);
        const xFloat = (lon + 180) / 360 * n;
        const yFloat = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
        const tileX = Math.floor(xFloat);
        const tileY = Math.floor(yFloat);
        const fracX = xFloat - tileX;
        const fracY = yFloat - tileY;

        // Pixel position of epicenter on our tile canvas
        const epicX = half * tileSize + fracX * tileSize;
        const epicY = half * tileSize + fracY * tileSize;

        let loaded = 0;
        const total = grid * grid;
        let failed = false;
        const timeout = setTimeout(() => resolve(null), 8000);

        const done = () => {
          loaded++;
          if (loaded >= total) {
            clearTimeout(timeout);
            resolve(failed ? null : canvas);
          }
        };

        for (let gy = 0; gy < grid; gy++) {
          for (let gx = 0; gx < grid; gx++) {
            const tx = tileX + gx - half;
            const ty = tileY + gy - half;
            const drawX = gx * tileSize;
            const drawY = gy * tileSize;

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              try { ctx.drawImage(img, drawX, drawY, tileSize, tileSize); } catch (_) {}
              done();
            };
            img.onerror = () => { failed = true; done(); };
            img.src = 'https://tile.openstreetmap.org/' + zoom + '/' + tx + '/' + ty + '.png';
          }
        }
      });
    }

    _loadImage(src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    }

    _getRandomQuote() {
      const quotes = [
        'Ingat palagi, pare!',
        'Laging handa, hindi balahura!',
        'Mag-ingat sa lindol!',
        'Safety first lagi!',
        'Keep calm and Javi on!',
        'Alagaan ang sarili!',
        'Dapat laging handa!',
      ];
      return quotes[Math.floor(Math.random() * quotes.length)];
    }

    _roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    _wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
      const words = text.split(' ');
      let line = '';
      let lines = 0;
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        const m = ctx.measureText(test);
        if (m.width > maxWidth && line) {
          ctx.fillText(line, x, y);
          line = word;
          y += lineHeight;
          lines++;
          if (lines >= maxLines) {
            ctx.fillText(line.slice(0, -3) + '...', x, y);
            return;
          }
        } else {
          line = test;
        }
      }
      ctx.fillText(line, x, y);
    }

    _showShareImageOverlay(canvas, q) {
      const existing = document.querySelector('.share-img-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.className = 'share-img-overlay';
      overlay.innerHTML =
        '<div class="share-img-card">' +
          '<canvas width="' + (canvas.width) + '" height="' + (canvas.height) + '"></canvas>' +
          '<div class="share-img-actions">' +
            '<button class="share-img-btn" id="shareImgDownload"><i data-lucide="download" aria-hidden="true"></i> Save</button>' +
            '<button class="share-img-btn" id="shareImgShare"><i data-lucide="share-2" aria-hidden="true"></i> Share</button>' +
            '<button class="share-img-btn" id="shareImgClose"><i data-lucide="x" aria-hidden="true"></i> Close</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      // Draw canvas onto the visible canvas
      const visCanvas = overlay.querySelector('canvas');
      const visCtx = visCanvas.getContext('2d');
      visCtx.drawImage(canvas, 0, 0);

      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Handle save
      document.getElementById('shareImgDownload').onclick = () => {
        const link = document.createElement('a');
        link.download = 'javi-alert-' + q.mag.toFixed(1) + 'mag.png';
        link.href = visCanvas.toDataURL('image/png');
        link.click();
      };

      // Handle share (Web Share API)
      document.getElementById('shareImgShare').onclick = () => {
        visCanvas.toBlob((blob) => {
          if (!blob) return;
          const file = new File([blob], 'javi-alert-' + q.mag.toFixed(1) + 'mag.png', { type: 'image/png' });
          if (navigator.share) {
            navigator.share({
              title: 'Earthquake Alert — Mag ' + q.mag.toFixed(1),
              text: q.dist + ' km ' + q.dir + ' of ' + q.place,
              files: [file]
            }).catch(() => {});
          } else {
            // Fallback: download
            const link = document.createElement('a');
            link.download = file.name;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
          }
        });
      };

      // Close
      document.getElementById('shareImgClose').onclick = () => overlay.remove();
      overlay.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) overlay.remove();
      });
    }

    // ─── SETTINGS MODAL ───────────────────────────────────────
    _setupSettingsModal() {
      // Close buttons
      document.getElementById('settingsModalClose').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('hidden');
      });
      document.getElementById('settingsModalGotIt').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('hidden');
      });
      document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
      });

      // Dark mode toggle
      document.getElementById('settingsDarkToggle').addEventListener('click', () => {
        this.toggleDarkMode();
        this._updateSettingsUI();
      });

      // Safety Tips toggle
      document.getElementById('settingsSafetyTipsToggle').addEventListener('click', () => {
        this.safetyTipsShown = !this.safetyTipsShown;
        localStorage.setItem('javiSafetyTipsShown', this.safetyTipsShown);
        if (this.safetyTipsShown) {
          this.showSafetyTip();
        } else {
          const card = document.getElementById('safetyCard');
          if (card) card.classList.add('hidden');
          if (this._tipInterval) {
            clearInterval(this._tipInterval);
            this._tipInterval = null;
          }
        }
        this._updateSettingsUI();
      });

      // Notification sound dropdown (Alarm / Voice / Silent)
      (() => {
        const self = this;
        const trigger = document.getElementById('notifSoundSelectTrigger');
        const optionsEl = document.getElementById('notifSoundSelectOptions');
        const textEl = document.getElementById('notifSoundSelectText');
        const labels = { alarm: 'Alarm', voice: 'Voice', silent: 'Silent' };
        if (trigger && optionsEl) {
          if (textEl) textEl.textContent = labels[self.notifSound] || 'Alarm';
          optionsEl.classList.add('hidden');
          trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            optionsEl.classList.toggle('hidden');
          });
          optionsEl.querySelectorAll('.custom-select-option').forEach(btn => {
            btn.addEventListener('click', () => {
              const sound = btn.dataset.sound || 'alarm';
              self._setNotifSound(sound);
              if (textEl) textEl.textContent = labels[sound] || 'Alarm';
              optionsEl.classList.add('hidden');
            });
          });
          document.addEventListener('click', (e) => {
            if (!e.target.closest('#notifSoundSelect')) {
              optionsEl.classList.add('hidden');
            }
          });
        }
      })();

      // Ambient toggle
      document.getElementById('settingsAmbientToggle').addEventListener('click', () => {
        this.ambientEnabled = !this.ambientEnabled;
        localStorage.setItem('javiAmbientEnabled', this.ambientEnabled);
        if (this.ambientEnabled) {
          startAmbientSound(this.ambientTrack || undefined);
          setAmbientVolume(this.volumeLevel);
          this.ambientActive = true;
        } else {
          stopAmbientSound();
          this.ambientActive = false;
        }
        this._updateSettingsUI();
      });

      // Push notification toggle (user gesture required on mobile)
      document.getElementById('settingsNotifToggle').addEventListener('click', async () => {
        if (!('Notification' in window)) return;

        // ── GRANTED — toggle on/off ──
        if (Notification.permission === 'granted') {
          if (this._pushDisabled) {
            // Re-enable: subscribe again
            this._pushDisabled = false;
            localStorage.setItem('javiPushDisabled', 'false');
            await this._setupPushNotifications();
            this._updateSettingsUI();
            this._showNotifToast('safe', {
              mag: 0, dist: 0,
              place: 'Push notifications turned ON'
            });
          } else {
            // Disable: unsubscribe
            try {
              const registration = await navigator.serviceWorker.ready;
              const subscription = await registration.pushManager.getSubscription();
              if (subscription) {
                await subscription.unsubscribe();
                await fetch('/api/push-subscribe', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(subscription.toJSON())
                }).catch(() => {});
              }
            } catch (_) { /* ignore unsubscribe errors */ }
            this._pushReady = false;
            this._pushDisabled = true;
            localStorage.setItem('javiPushDisabled', 'true');
            this._updateSettingsUI();
            this._showNotifToast('safe', {
              mag: 0, dist: 0,
              place: 'Push notifications turned OFF'
            });
          }
          return;
        }

        // ── DENIED — show guidance ──
        if (Notification.permission === 'denied') {
          this._showNotifToast('warning', {
            mag: 0, dist: 0,
            place: 'Enable notifications in your browser/device site settings'
          });
          return;
        }

        // ── DEFAULT — request permission ──
        try {
          const result = await Notification.requestPermission();
          if (result === 'granted') {
            this._pushDisabled = false;
            localStorage.setItem('javiPushDisabled', 'false');
            await this._setupPushNotifications();
            this._updateSettingsUI();
            this._showNotifToast('safe', {
              mag: 0, dist: 0,
              place: 'Push notifications are now active!'
            });
          } else if (result === 'denied') {
            this._showNotifToast('warning', {
              mag: 0, dist: 0,
              place: 'Enable notifications in your browser/device site settings'
            });
          }
        } catch (_) { /* permission request failed */ }
      });

      // Track picker
      document.querySelectorAll('.track-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const track = opt.dataset.track || '';
          this.ambientTrack = track;
          localStorage.setItem('javiAmbientTrack', track);
          if (this.ambientEnabled && this.ambientActive) {
            setAmbientTrack(track);
          }
          this._updateSettingsUI();
        });
      });

      // Auto-refresh toggle
      document.getElementById('settingsAutoRefreshToggle').addEventListener('click', () => {
        this.autoRefresh = !this.autoRefresh;
        localStorage.setItem('javiAutoRefresh', this.autoRefresh);
        if (this.autoRefresh) {
          if (!this.refreshTimer) {
            this.refreshTimer = setInterval(() => this.loadData(), CONFIG.AUTO_REFRESH_MS);
          }
        } else {
          if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
          }
        }
        this._updateSettingsUI();
      });

      // Volume slider
      const slider = document.getElementById('settingsVolumeSlider');
      slider.value = this.volumeLevel;
      slider.addEventListener('input', (e) => {
        this.volumeLevel = parseFloat(e.target.value);
        localStorage.setItem('javiVolume', this.volumeLevel);
        setAmbientVolume(this.volumeLevel);
        const pct = document.getElementById('settingsVolPct');
        if (pct) pct.textContent = Math.round(this.volumeLevel * 100) + '%';
      });

      // Update Logs — open separate modal
      document.getElementById('updateLogsRow').addEventListener('click', () => {
        const body = document.getElementById('updateLogsBody');
        if (!body) return;
        // Populate on first open
        if (!body.dataset.populated) {
          body.dataset.populated = '1';
          body.innerHTML = CHANGELOG.map(entry => `
            <div class="update-log-entry">
              <div class="update-log-ver">
                ${entry.ver}
                <span class="update-log-date">${entry.date}</span>
              </div>
              <ul class="update-log-items">
                ${entry.items.map(i => `<li>${i}</li>`).join('')}
              </ul>
            </div>
          `).join('');
        }
        document.getElementById('updateLogsModal').classList.remove('hidden');
      });

      // Custom language dropdown — same pattern as sort dropdown
      const trigger = document.getElementById('langSelectTrigger');
      const optionsEl = document.getElementById('langSelectOptions');
      const textEl = document.getElementById('langSelectText');
      const langLabels = { en: 'English', tl: 'Tagalog', ceb: 'Cebuano' };
      if (trigger && optionsEl) {
        const savedLang = (() => { try { return localStorage.getItem('javiLang') || 'tl'; } catch(_) { return 'tl'; } })();
        if (textEl) textEl.textContent = langLabels[savedLang] || 'Tagalog';
        optionsEl.classList.add('hidden');
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          optionsEl.classList.toggle('hidden');
        });
        optionsEl.querySelectorAll('.custom-select-option').forEach(btn => {
          btn.addEventListener('click', () => {
            const lang = btn.dataset.lang || 'tl';
            try { localStorage.setItem('javiLang', lang); } catch(_) {}
            if (textEl) textEl.textContent = langLabels[lang] || 'Tagalog';
            optionsEl.classList.add('hidden');
            setTimeout(() => window.location.reload(), 180);
          });
        });
        document.addEventListener('click', (e) => {
          if (!e.target.closest('#languageSelect')) {
            optionsEl.classList.add('hidden');
          }
        });
      }

      // Update Logs modal close
      document.getElementById('updateLogsClose').addEventListener('click', () => {
        document.getElementById('updateLogsModal').classList.add('hidden');
      });
      document.getElementById('updateLogsGotIt').addEventListener('click', () => {
        document.getElementById('updateLogsModal').classList.add('hidden');
      });
      document.getElementById('updateLogsModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
      });

      // Test notification button (debug) — local only, does NOT send to all users
      document.getElementById('testNotifBtn').addEventListener('click', async () => {
        // Play sound based on user's notifSound preference
        if (this.notifSound === 'alarm') {
          playAlertSound('warning', this.soundEnabled, this.volumeLevel);
        } else if (this.notifSound === 'voice') {
          try {
            if (window.speechSynthesis) {
              const utterance = new SpeechSynthesisUtterance('This is a test notification from Javi Alert!');
              utterance.lang = 'en-US';
              utterance.rate = 0.9;
              utterance.pitch = 1.1;
              utterance.volume = this.volumeLevel;
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(utterance);
            }
          } catch (_) { /* speech not supported */ }
        }
        // Show local browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('JaviAlert Test', {
              body: 'This is a test notification! Only you can see this.',
              icon: 'icons/javi-icon.png'
            });
          } catch (_) { /* ignore */ }
        }
        // Also try via Service Worker (local only)
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('JaviAlert Test', {
            body: 'This is a test notification! Only you can see this.',
            icon: 'icons/javi-icon.png',
            tag: 'test-' + Date.now()
          });
        } catch (_) { /* ignore */ }
        // Show in-app toast
        this._showNotifToast('safe', {
          mag: 0, dist: 0,
          place: 'Test notification sent! (local only, ' + this.notifSound + ' sound)'
        });
      });
    }

    /** Register Service Worker in background — doesn't block startup */
    _registerServiceWorker() {
      if (!('serviceWorker' in navigator)) return;
      // Run async but DON'T await — in-app browsers (Messenger, etc.) can hang
      const doRegister = async () => {
        try {
          const registration = await navigator.serviceWorker.register('sw.js');
          const hadController = !!navigator.serviceWorker.controller;

          // Cooldown flag — prevents infinite reload loop after auto-update
          const justUpdated = localStorage.getItem('javiJustUpdated');
          const recentUpdate = justUpdated && (Date.now() - parseInt(justUpdated, 10)) < 300000;
          if (justUpdated && !recentUpdate) {
            localStorage.removeItem('javiJustUpdated');
          }

          // Reload when a new SW takes over (skip if this is the first-ever install)
          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            if (!hadController) return; // First install — no double-load needed
            refreshing = true;
            localStorage.setItem('javiJustUpdated', Date.now());
            window.location.reload();
          });

          // Helper: show the loading overlay so user sees the update message
          const _showUpdateOverlay = () => {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
              overlay.classList.remove('hidden', 'fade-out');
              const lt = document.getElementById('loadingText');
              if (lt) lt.textContent = 'Updating app...';
            }
          };

          // Helper: trigger auto-update by activating the waiting SW
          const autoUpdate = (sw) => {
            if (!sw) return;
            const justUpdated = localStorage.getItem('javiJustUpdated');
            if (justUpdated && (Date.now() - parseInt(justUpdated, 10)) < 300000) return;
            _showUpdateOverlay();
            sw.postMessage({ action: 'skipWaiting' });
          };

          // Case 1: A new SW is already waiting
          if (registration.waiting && hadController && !recentUpdate) {
            autoUpdate(registration.waiting);
            return;
          }

          // Case 2: A new SW is currently installing
          if (registration.installing && hadController && !recentUpdate) {
            _showUpdateOverlay();
            registration.installing.addEventListener('statechange', () => {
              if (registration.waiting) autoUpdate(registration.waiting);
            });
          }

          // Case 3: Future update detected
          registration.addEventListener('updatefound', () => {
            const newSW = registration.installing;
            if (!newSW || !hadController) return;
            const stillRecent = localStorage.getItem('javiJustUpdated') &&
              (Date.now() - parseInt(localStorage.getItem('javiJustUpdated'), 10)) < 300000;
            if (stillRecent) return;
            _showUpdateOverlay();
            newSW.addEventListener('statechange', () => {
              if (newSW.state === 'installed' && registration.waiting) {
                autoUpdate(registration.waiting);
              }
            });
          });
        } catch (_) { /* SW not supported — proceed without it */ }
      };
      doRegister();
    }

    _showSettings() {
      this._updateSettingsUI();
      document.getElementById('settingsModal').classList.remove('hidden');
    }

    _dismissLoading() {
      const overlay = document.getElementById('loadingOverlay');
      if (!overlay || overlay.classList.contains('fade-out')) return; // already dismissing
      // Music will resume on first user tap via _unlockAudioOnce.
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 500);
    }

    /** Pre-authorize alert audio on first click/tap — browser blocks autoplay */
    _unlockAudioOnce() {
      let unlocked = false;
      const unlock = () => {
        if (unlocked) return;
        unlocked = true;
        // Pre-authorize alert audio for mobile browsers that block new Audio().play()
        preloadAlertAudio();
        // Remove all listeners after first interaction
        document.removeEventListener('click', unlock);
        document.removeEventListener('touchstart', unlock);
        document.removeEventListener('keydown', unlock);
      };
      document.addEventListener('click', unlock);
      document.addEventListener('touchstart', unlock);
      document.addEventListener('keydown', unlock);
    }

    _updateSettingsUI() {
      // Dark mode toggle
      const dt = document.getElementById('settingsDarkToggle');
      if (dt) dt.classList.toggle('active', this.isDarkMode);

      // Safety Tips toggle
      const stt = document.getElementById('settingsSafetyTipsToggle');
      if (stt) stt.classList.toggle('active', this.safetyTipsShown);

      // Notification sound dropdown text
      const nst = document.getElementById('notifSoundSelectText');
      if (nst) {
        const labels = { alarm: 'Alarm', voice: 'Voice', silent: 'Silent' };
        nst.textContent = labels[this.notifSound] || 'Alarm';
      }

      // Ambient toggle
      const at = document.getElementById('settingsAmbientToggle');
      if (at) at.classList.toggle('active', this.ambientEnabled);

      // Notification toggle
      const nt = document.getElementById('settingsNotifToggle');
      if (nt) {
        const canPush = 'Notification' in window && Notification.permission === 'granted';
        nt.classList.toggle('active', canPush && !this._pushDisabled);
        nt.classList.toggle('denied', 'Notification' in window && Notification.permission === 'denied');
      }
      // Notification blocked help text
      const blockedHelp = document.getElementById('notifBlockedHelp');
      if (blockedHelp) {
        blockedHelp.classList.toggle('hidden', !('Notification' in window) || Notification.permission !== 'denied');
      }

      // Auto-refresh toggle
      const art = document.getElementById('settingsAutoRefreshToggle');
      if (art) art.classList.toggle('active', this.autoRefresh);

      // Track picker
      document.querySelectorAll('.track-option').forEach(opt => {
        opt.classList.toggle('active', (opt.dataset.track || '') === this.ambientTrack);
      });

      // Volume slider + percentage
      const slider = document.getElementById('settingsVolumeSlider');
      if (slider) slider.value = this.volumeLevel;
      const pct = document.getElementById('settingsVolPct');
      if (pct) pct.textContent = Math.round(this.volumeLevel * 100) + '%';

      // Update Lucide icons
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Reflect chosen language in settings UI
      // Reflect chosen language in settings UI
      try {
        const textEl = document.getElementById('langSelectText');
        if (textEl) {
          const lang = localStorage.getItem('javiLang') || 'tl';
          const labels = { en: 'English', tl: 'Tagalog', ceb: 'Cebuano' };
          textEl.textContent = labels[lang] || 'Tagalog';
        }
      } catch (_) {}
    }

    // ─── AM I SAFE? ANALYSIS ──────────────────────────────────
    _showAnalysis() {
      const modal = document.getElementById('analysisModal');
      const loading = document.getElementById('analysisLoading');
      const body = document.getElementById('analysisBody');
      const msgEl = document.getElementById('analysisJaviMsg');
      const breakdown = document.getElementById('analysisBreakdown');
      const icon = document.getElementById('analysisModalIcon');

      if (!modal) return;

      // Reset
      loading.classList.remove('hidden');
      body.classList.add('hidden');
      modal.classList.remove('hidden');

      // Determine mood icon
      const moodIcon = this.currentMood === 'danger' ? 'alert-octagon'
        : this.currentMood === 'warning' ? 'alert-triangle' : 'shield-check';
      if (icon) icon.setAttribute('data-lucide', moodIcon);
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Run analysis (async with small delay for UX)
      setTimeout(() => {
        const result = this._runAnalysis();
        loading.classList.add('hidden');
        body.classList.remove('hidden');
        msgEl.innerHTML = this._formatAnalysisMessage(result);
        breakdown.innerHTML = this._renderAnalysisBreakdown(result);
        try { lucide.createIcons(); } catch (_) { /* ignore */ }
      }, 600);
    }

    _runAnalysis() {
      const quakes = this.allQuakes;
      const lat = this.userLat;
      const lon = this.userLon;
      const now = Date.now();

      if (!quakes || quakes.length === 0) {
        return {
          verdict: 'safe',
          score: 100,
          factors: [],
          message: 'No earthquakes detected near you. You\'re all good!'
        };
      }

      // Calculate factors
      let nearestDist = Infinity;
      let nearestMag = 0;
      let strongestMag = 0;
      let strongestRawMag = 0;
      let strongestDepth = null;
      let strongestDist = Infinity;
      let recentCount = 0;
      let dangerCount = 0;
      let warningCount = 0;

      const ANALYSIS_WINDOW = 7 * 86400000; // 7 days — ignore ancient history

      quakes.forEach(q => {
        const dist = q.dist || 0;
        const mag = q.mag || 0;
        const age = now - new Date(q.time).getTime();

        // Effective magnitude adjusted by depth
        let effectiveMag = mag;
        if (q.depth !== null) {
          if (q.depth < CONFIG.SHALLOW_DEPTH_KM) effectiveMag += 0.5;
          else if (q.depth > CONFIG.DEEP_DEPTH_KM) effectiveMag -= 0.5;
        }

        // Skip quakes older than the analysis window
        if (age > ANALYSIS_WINDOW) return;

        // Nearest (only within window)
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestMag = mag;
        }

        // Strongest by effective magnitude (depth-adjusted)
        if (effectiveMag > strongestMag) {
          strongestMag = effectiveMag;
          strongestRawMag = mag;
          strongestDepth = q.depth;
          strongestDist = dist;
        }

        // Recent (last 24h) — use effective magnitude for thresholds
        if (age < 86400000) {
          recentCount++;
          if (effectiveMag >= CONFIG.DANGER_THRESHOLD) dangerCount++;
          else if (effectiveMag >= CONFIG.WARNING_THRESHOLD) warningCount++;
        }
      });

      // Score calculation (100 = perfectly safe, 0 = extremely dangerous)
      let score = 100;

      // Deduct for nearest quake
      if (nearestDist < 50) score -= Math.max(0, 30 - nearestDist * 0.5);
      if (nearestDist < 10) score -= 15;

      // Deduct for magnitude
      if (strongestMag >= 5) score -= 35;
      else if (strongestMag >= 4) score -= 20;
      else if (strongestMag >= 3) score -= 10;

      // Deduct for recency
      if (dangerCount > 0) score -= 25;
      if (warningCount > 0) score -= 15;

      // Deduct for near + strong combo
      if (nearestDist < 100 && strongestMag >= 4) score -= 10;

      score = Math.max(0, Math.min(100, score));

      // Verdict
      let verdict;
      if (score >= 80) verdict = 'safe';
      else if (score >= 50) verdict = 'warning';
      else verdict = 'danger';

      // Build factors
      const factors = [];
      if (nearestDist < Infinity) {
        factors.push({
          icon: nearestDist < 50 ? (nearestMag >= CONFIG.DANGER_THRESHOLD ? 'danger' : nearestMag >= CONFIG.WARNING_THRESHOLD ? 'warning' : 'safe') : 'safe',
          label: 'Nearest quake (7d)',
          detail: nearestDist.toFixed(1) + ' km away at ' + nearestMag.toFixed(1) + ' mag'
        });
      }
      if (strongestMag > 0 && strongestDist < Infinity) {
        const depthNote = strongestDepth !== null
          ? (strongestDepth < CONFIG.SHALLOW_DEPTH_KM ? ' (shallow)' : strongestDepth > CONFIG.DEEP_DEPTH_KM ? ' (deep)' : '')
          : '';
        factors.push({
          icon: strongestMag >= CONFIG.DANGER_THRESHOLD ? 'danger' : strongestMag >= CONFIG.WARNING_THRESHOLD ? 'warning' : 'safe',
          label: 'Strongest quake (7d)',
          detail: strongestRawMag.toFixed(1) + ' mag at ' + strongestDist.toFixed(1) + ' km away' + depthNote
        });
      }
      if (nearestDist === Infinity) {
        factors.push({
          icon: 'safe',
          label: 'Recent activity',
          detail: 'No significant quakes in the past 7 days'
        });
      }
      factors.push({
        icon: dangerCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'safe',
        label: 'Recent activity (24h)',
        detail: recentCount + ' quake' + (recentCount !== 1 ? 's' : '') + ' in 24h' +
          (dangerCount > 0 ? ' (' + dangerCount + ' dangerous)' : '')
      });

      return { verdict, score, factors, nearestDist, strongestMag, dangerCount, warningCount };
    }

    _formatAnalysisMessage(result) {
      const name = this.userPlace || 'dito';
      if (result.verdict === 'danger') {
        const msgs = [
          '⚠️ <strong>Not safe, friend!</strong> May malakas na lindol na malapit sa ' + name + '. Kailangan maging handa! Sundin ang safety tips at makinig sa balita.',
          '🚨 <strong>Delikado!</strong> May malapit na malakas na lindol sa ' + name + '. Ihanda ang emergency kit at maging alerto!'
        ];
        return msgs[Math.floor(Math.random() * msgs.length)];
      } else if (result.verdict === 'warning') {
        const msgs = [
          '🤔 <strong>Medyo hindi sigurado.</strong> May mga lindol malapit sa ' + name + ', pero hindi naman sobrang lakas. Mag-ingat ka pa rin!',
          '👀 <strong>Nakatutok ako.</strong> May nararamdaman akong galaw malapit sa ' + name + '. Hindi naman sobrang lakas, pero alerto tayo!'
        ];
        return msgs[Math.floor(Math.random() * msgs.length)];
      } else {
        const msgs = [
          '✅ <strong>Safe ka dito, pare!</strong> Walang malapit na malakas na lindol sa ' + name + '. Relax lang!',
          '😊 <strong>Wala kang dapat ipag-alala.</strong> Lahat ng lindol ay malayo at mahihina lang. Enjoy your day!'
        ];
        return msgs[Math.floor(Math.random() * msgs.length)];
      }
    }

    _renderAnalysisBreakdown(result) {
      const scoreColor = result.score >= 80 ? '#00b894' : result.score >= 50 ? '#fdcb6e' : '#e17055';
      const scoreEmoji = result.score >= 80 ? '🟢' : result.score >= 50 ? '🟡' : '🔴';
      const statusText = result.verdict === 'safe' ? 'Safe'
        : result.verdict === 'warning' ? 'Caution' : 'Danger';

      let html = '';

      // Score bar
      html +=
        '<div class="analysis-factor" style="padding: 12px 14px; margin-bottom: 4px;">' +
          '<div class="analysis-factor-icon ' + result.verdict + '" style="font-size: 18px;">' + scoreEmoji + '</div>' +
          '<div class="analysis-factor-text">' +
            '<strong>Safety Score</strong>' +
            '<span>' + result.score + '% — <strong>' + statusText + '</strong></span>' +
          '</div>' +
        '</div>';

      // Score bar visual
      html +=
        '<div style="height: 10px; background: #dfe6e9; border-radius: 6px; margin: 0 14px 10px; overflow: hidden; border: 1.5px solid ' + (this.isDarkMode ? '#555' : '#2d3436') + ';">' +
          '<div style="height: 100%; width: ' + result.score + '%; background: ' + scoreColor + '; border-radius: 6px; transition: width .6s ease;"></div>' +
        '</div>';

      // Factors
      result.factors.forEach(f => {
        html +=
          '<div class="analysis-factor">' +
            '<div class="analysis-factor-icon ' + f.icon + '">' +
              (f.icon === 'safe' ? '<i data-lucide="shield-check" style="width: 14px; height: 14px;"></i>' :
               f.icon === 'warning' ? '<i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i>' :
               '<i data-lucide="alert-octagon" style="width: 14px; height: 14px;"></i>') +
            '</div>' +
            '<div class="analysis-factor-text">' +
              '<strong>' + f.label + '</strong>' +
              '<span>' + f.detail + '</span>' +
            '</div>' +
          '</div>';
      });

      return html;
    }

    // ─── HAPTIC FEEDBACK ON ALERT ────────────────────────────
    _hapticAlert(type) {
      if (!type) return;
      if (!navigator.vibrate) return;
      try {
        if (type === 'danger') {
          // Three strong bursts
          navigator.vibrate([200, 100, 200, 100, 200]);
        } else if (type === 'warning') {
          // Two gentler bursts
          navigator.vibrate([100, 80, 100]);
        }
      } catch (_) { /* vibration not supported */ }
    }

    /** Show in-app notification toast (works on all mobile browsers) */
    _showNotifToast(type, quake) {
      const toast = document.getElementById('notifToast');
      if (!toast) return;
      const titleEl = document.getElementById('notifToastTitle');
      const bodyEl = document.getElementById('notifToastBody');
      const iconEl = document.getElementById('notifToastIcon');
      if (!titleEl || !bodyEl) return;

      // Set content
      const emoji = type === 'danger' ? '🚨' : type === 'warning' ? '⚠️' : '🔔';
      if (iconEl) iconEl.textContent = emoji;

      // If mag is exactly 0 AND dist is 0, treat as a plain message (test/blocked/etc.)
      const isPlain = quake.mag === 0 && quake.dist === 0;

      if (!isPlain) {
        // Real earthquake data — show intensity + mag + distance
        const intLabel = PEIS_LABELS[quake.intensity] || '';
        titleEl.textContent = type === 'danger' ? 'DANGER! Strong Earthquake!'
          : type === 'warning' ? 'Warning — Earthquake Detected'
          : 'Earthquake Alert';
        bodyEl.textContent = intLabel + ' — ' + (quake.mag || '?').toFixed(1) + ' mag • '
          + quake.dist + ' km away • ' + quake.place;
      } else {
        // Plain message (test notifications, blocked help, etc.)
        titleEl.textContent = quake.place || 'Notification';
        bodyEl.textContent = '';
      }

      // Remove hidden, add show class for animation
      toast.classList.remove('hidden');
      // Re-trigger animation by removing then adding
      toast.classList.remove('toast-show');
      void toast.offsetWidth; // force reflow
      toast.classList.add('toast-show');

      // Auto-hide after 6 seconds
      if (this._toastTimer) clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.classList.add('hidden'), 400);
      }, 6000);
    }

    // ─── SPAWN SPARKLES ON JAVI TAP ──────────────────────────
    _spawnSparkles(mood) {
      const container = document.getElementById('javiSparkles');
      if (!container) return;
      // Clear previous
      container.innerHTML = '';
      const count = mood === 'danger' ? 3 : 6;
      const colors = mood === 'danger'
        ? ['spark-danger']
        : ['spark', 'spark-pink', 'spark-green', 'spark-blue'];
      for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        const cls = colors[Math.floor(Math.random() * colors.length)];
        el.className = 'spark ' + cls;
        // Random position around Javi
        el.style.left = (20 + Math.random() * 80) + '%';
        el.style.top = (10 + Math.random() * 60) + '%';
        // Random float direction
        el.style.setProperty('--sx', (Math.random() * 40 - 20) + 'px');
        el.style.setProperty('--sy', (-20 - Math.random() * 30) + 'px');
        el.style.animation = mood === 'danger'
          ? 'sparkDanger ' + (0.6 + Math.random() * 0.4) + 's ease-out forwards'
          : 'sparkFloat ' + (0.6 + Math.random() * 0.4) + 's ease-out forwards';
        el.style.animationDelay = (i * 0.08) + 's';
        container.appendChild(el);
        // Auto-remove
        setTimeout(() => el.remove(), 2000);
      }
    }

    // ─── TRIGGER QUAKE RIPPLE ON MAP ─────────────────────────
    _triggerQuakeRipple() {
      const mapEl = document.getElementById('quakeMap');
      if (!mapEl) return;
      mapEl.classList.remove('map-ripple-active');
      void mapEl.offsetWidth;
      mapEl.classList.add('map-ripple-active');
      setTimeout(() => mapEl.classList.remove('map-ripple-active'), 1500);
    }

    // ─── ASK JAVI — CHAT ───────────────────────────────────────
    _showChat() {
      const modal = document.getElementById('chatModal');
      if (!modal) return;

      // Clear unread badge when opening chat
      this.unreadCount = 0;
      this._pendingClose = false;
      this._updateChatHeadBadge();

      // Hide notification popup
      const notif = document.getElementById('chatHeadNotif');
      if (notif) notif.classList.add('hidden');
      if (this._notifTimer) clearTimeout(this._notifTimer);

      // Load chat memory — only when no user messages yet
      const hasUserMsg = this.chatMessages.some(m => m.role === 'user');
      if (!hasUserMsg) {
        const memory = this._loadChatMemory();
        if (memory && !this.chatMessages.length) {
          const lastTopic = memory.topics && memory.topics.length > 0
            ? memory.topics[memory.topics.length - 1]
            : null;
          const greeting = memory.lastAiSummary
            ? '👋 Welcome back! Last time we talked about "' + this._escapeHtml(lastTopic || 'something') + '". Want to continue or ask something new? 😊'
            : '👋 Welcome back! Nice to see you again! 😊';
          this.chatMessages.push({ role: 'assistant', content: greeting });
        }
      }

      // Reset scroll to top
      const msgs = document.getElementById('chatMessages');
      if (msgs) msgs.scrollTop = 0;

      modal.classList.remove('hidden');

      // Lock body scroll to prevent background scrolling
      this._lockBodyScroll();

      // Re-render existing messages (in case we need to update)
      this._renderChatMessages();

      // Focus input after modal opens
      setTimeout(() => {
        const input = document.getElementById('chatInput');
        if (input) input.focus();
      }, 300);
    }

    async _sendChatMessage() {
      const input = document.getElementById('chatInput');
      const sendBtn = document.getElementById('chatSendBtn');
      const text = input ? input.value.trim() : '';
      if (!text || this.chatLoading) return;

      // Clear input
      input.value = '';

      // Auto-detect language on every message and save it
      const detected = this._detectLanguage(text);
      if (detected !== 'en') {
        try {
          localStorage.setItem('javiLang', detected);
        } catch (_) { /* ignore */ }
      }

      // Add user message
      this.chatMessages.push({ role: 'user', content: text });
      this._renderChatMessages();

      // Show typing indicator
      const typing = document.getElementById('chatTyping');
      if (typing) typing.classList.remove('hidden');

      // Scroll to bottom
      const msgs = document.getElementById('chatMessages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;

      // Disable send
      this.chatLoading = true;
      if (sendBtn) sendBtn.disabled = true;
      if (input) input.disabled = true;

      try {
        // Build earthquake context from latest data
        const quakeContext = this._buildQuakeContext();

        // Call AI API with quake context + detected language
        const response = await this._callHuggingFace(this.chatMessages, quakeContext, detected);

        // Remove typing
        if (typing) typing.classList.add('hidden');

        // Add assistant response
        this.chatMessages.push({ role: 'assistant', content: response });
        this._renderChatMessages(true);

        // Save to memory
        this._saveChatMemory(text, response);
        this._saveChatHistory();

        // If chat was closed while waiting, show notification on chat head
        const chatModal = document.getElementById('chatModal');
        const chatHidden = !chatModal || chatModal.classList.contains('hidden');
        if (chatHidden || this._pendingClose) {
          this.unreadCount++;
          this._updateChatHeadBadge();
          // Show the first few words as preview
          const preview = response.length > 80 ? response.slice(0, 80) + '…' : response;
          this._showChatHeadNotif('Javi replied', preview);
        }
        this._pendingClose = false;

        // Scroll to bottom
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      } catch (err) {
        console.error('Chat error:', err);
        if (typing) typing.classList.add('hidden');

        // Fallback: use built-in response instead of error message
        const fallback = this._fallbackResponse();
        this.chatMessages.push({ role: 'assistant', content: fallback });
        this._renderChatMessages(true);
        this._saveChatMemory(text, fallback);
        this._saveChatHistory();

        // If chat was closed while waiting, notify on chat head
        const chatModal = document.getElementById('chatModal');
        const chatHidden = !chatModal || chatModal.classList.contains('hidden');
        if (chatHidden || this._pendingClose) {
          this.unreadCount++;
          this._updateChatHeadBadge();
          this._showChatHeadNotif('Javi replied', 'Tap to see my response!');
        }
        this._pendingClose = false;

        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      } finally {
        this.chatLoading = false;
        if (sendBtn) sendBtn.disabled = false;
        if (input) {
          input.disabled = false;
          input.focus();
        }
      }
    }

    /** Build a short summary of current earthquake data for AI context */
    _buildQuakeContext() {
      const quakes = this.allQuakes || [];
      if (!quakes.length) return 'No recent earthquake data available.';

      // Get latest by time
      const latest = quakes.reduce((a, b) => a.time > b.time ? a : b);
      // Get nearest
      const nearest = quakes.reduce((a, b) => a.dist < b.dist ? a : b);
      // Get strongest
      const strongest = quakes.reduce((a, b) => a.mag > b.mag ? a : b);

      const fmt = (q) =>
        (q.mag || 0).toFixed(1) + ' mag at ' + q.place +
        ' (' + q.dist + ' km ' + q.dir + ')' +
        (q.depth !== null ? ', depth ' + q.depth + ' km' : '') +
        ' - ' + timeSince(q.time);

      // List all significant quakes (mag >= 3) so Javi knows about major ones
      const significant = quakes.filter(q => q.mag >= 3).sort((a, b) => b.time - a.time);
      const quakeList = significant.length
        ? significant.map((q, i) => (i + 1) + '. ' + fmt(q)).join('\n')
        : 'None';

      let lines = [
        'Latest earthquake: ' + fmt(latest),
        'Nearest earthquake: ' + fmt(nearest),
        'Strongest earthquake: ' + fmt(strongest),
        'Total earthquakes detected: ' + quakes.length,
        '',
        'Significant quakes (mag 3+):',
        quakeList,
      ];
      return lines.join('\n');
    }

    async _callHuggingFace(messages, quakeContext, detectedLang) {
      // Call our own API route — the API keys stay server-side
      const res = await fetch('/api/ask-javi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, quakeContext, lang: detectedLang || 'en' })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'API returned ' + res.status);
      }

      const data = await res.json();

      if (data && data.response) {
        return data.response;
      }

      throw new Error('Unexpected API response format');
    }

    _renderChatMessages(animateLastBot) {
      const container = document.getElementById('chatMessages');
      if (!container) return;

      // Keep the welcome message if no messages
      if (!this.chatMessages.length) {
        container.innerHTML = '' +
          '<div class="chat-bubble chat-bubble-bot chat-welcome" id="chatWelcome">' +
            '<div class="chat-avatar-wrap"><img class="chat-avatar" src="icons/javi-avatar.png" alt="Javi"></div>' +
            '<div class="chat-bubble-inner">👋 Hi! I\'m Javi, your earthquake safety buddy. Ask me anything about earthquakes, safety tips, or preparedness!</div>' +
          '</div>' +
          '<div class="chat-typing hidden" id="chatTyping">' +
            '<div class="chat-typing-dot"></div>' +
            '<div class="chat-typing-dot"></div>' +
            '<div class="chat-typing-dot"></div>' +
          '</div>';
        return;
      }

      // Remove welcome, keep typing indicator
      const typingEl = container.querySelector('#chatTyping');

      container.innerHTML = '';

      // Render all messages except the last one (render last separately for animation)
      const lastIdx = animateLastBot ? this.chatMessages.length - 1 : -1;
      const msgsToRender = animateLastBot ? this.chatMessages.slice(0, -1) : this.chatMessages;

      msgsToRender.forEach((msg) => {
        const div = document.createElement('div');
        div.className = 'chat-bubble chat-bubble-' + (msg.role === 'user' ? 'user' : 'bot');
        if (msg.role === 'user') {
          div.innerHTML = '<div class="chat-bubble-inner">' + this._escapeHtml(msg.content) + '</div>';
        } else {
          div.innerHTML = '<div class="chat-avatar-wrap"><img class="chat-avatar" src="icons/javi-avatar.png" alt="Javi"></div><div class="chat-bubble-inner">' + this._formatBotMessage(msg.content) + '</div>';
        }
        container.appendChild(div);
      });

      // Render the last bot message with typewriter effect
      if (animateLastBot && lastIdx >= 0) {
        const lastMsg = this.chatMessages[lastIdx];
        if (lastMsg.role === 'assistant') {
          const div = document.createElement('div');
          div.className = 'chat-bubble chat-bubble-bot chat-bubble-typing';
          div.innerHTML = '<div class="chat-avatar-wrap"><img class="chat-avatar" src="icons/javi-avatar.png" alt="Javi"></div><div class="chat-bubble-inner" id="chatTypingText"></div>';
          container.appendChild(div);

          // Typewriter animation
          const textEl = document.getElementById('chatTypingText');
          const fullText = this._formatBotMessage(lastMsg.content);
          let idx = 0;
          const speed = 12; // ms per character
          const type = () => {
            if (idx < fullText.length) {
              textEl.innerHTML = fullText.slice(0, idx + 1);
              idx++;
              setTimeout(type, speed);
            } else {
              div.classList.remove('chat-bubble-typing');
              // Add quick reply buttons after typewriter finishes
              this._addQuickReplies(container);
            }
          };
          type();
        }
      } else {
        // No animation — add quick replies only if last message is from bot
        const lastMsg = this.chatMessages[this.chatMessages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          this._addQuickReplies(container);
        }
      }

      // Add typing indicator at the bottom
      if (!typingEl) {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-typing hidden';
        typingDiv.id = 'chatTyping';
        typingDiv.innerHTML = '<div class="chat-typing-dot"></div><div class="chat-typing-dot"></div><div class="chat-typing-dot"></div>';
        container.appendChild(typingDiv);
      } else {
        container.appendChild(typingEl);
      }
    }

    /** Add quick reply suggestion buttons below the last bot message */
    _addQuickReplies(container) {
      // Remove any existing quick reply row
      const existing = container.querySelector('.chat-quick-replies');
      if (existing) existing.remove();

      // Only show if there's at least one bot message
      const botMsgs = container.querySelectorAll('.chat-bubble-bot');
      if (!botMsgs.length) return;

      const row = document.createElement('div');
      row.className = 'chat-quick-replies';

      const btns = this._quickReply();
      btns.forEach((btn) => {
        const el = document.createElement('button');
        el.className = 'chat-quick-btn';
        el.textContent = btn.text;
        el.addEventListener('click', () => {
          if (btn.msg) {
            // Send as a real chat message
            const input = document.getElementById('chatInput');
            if (input) {
              input.value = btn.msg;
              this._sendChatMessage();
            }
          }
        });
        row.appendChild(el);
      });

      container.appendChild(row);

      // Scroll to show quick replies
      const msgs = document.getElementById('chatMessages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

    _escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /** Escape HTML then convert markdown to HTML tags */
    _formatBotMessage(text) {
      const escaped = this._escapeHtml(text);
      const lines = escaped.split('\n');
      const out = [];
      let inBullets = false, inNumbers = false;

      for (const line of lines) {
        const bullet = line.match(/^[-*]\s+(.+)/);
        const number = line.match(/^\d+\.\s+(.+)/);

        if (bullet) {
          if (inNumbers) { out.push('</ol>'); inNumbers = false; }
          if (!inBullets) { out.push('<ul>'); inBullets = true; }
          out.push('<li>' + bullet[1] + '</li>');
        } else if (number) {
          if (inBullets) { out.push('</ul>'); inBullets = false; }
          if (!inNumbers) { out.push('<ol>'); inNumbers = true; }
          out.push('<li>' + number[1] + '</li>');
        } else {
          if (inBullets) { out.push('</ul>'); inBullets = false; }
          if (inNumbers) { out.push('</ol>'); inNumbers = false; }
          out.push(line);
        }
      }
      if (inBullets) out.push('</ul>');
      if (inNumbers) out.push('</ol>');

      let html = out.join('\n');

      // Links
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      // Inline code (before bold/italic so * inside code isn't affected)
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
      // Strikethrough
      html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
      // Bold
      html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      // Italic
      html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
      // Line breaks
      html = html.replace(/\n/g, '<br>');

      return html;
    }
  }

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

