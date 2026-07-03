import { JAVI_MESSAGES, JAVI_REACTIONS, SAFETY_TIPS, EMERGENCY_CONTACTS } from './messages.js';
import { playAlertSound, startAmbientSound, stopAmbientSound, setAmbientVolume, resumeAmbient, playOpeningMusic, stopOpeningMusic } from './audio.js';
import { API, CONFIG, timeSince, getCompassDir, getDistance, parsePlaceName, magClass } from './api-utils.js';

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
      this.moodHistory = this._loadMoodHistory();
      this.magFilter = 0;
      this._pushReady = false;
      this.map = null;
      this.mapMarkers = [];
      this.userMarker = null;
      this.mapTiles = null;
      this.ambientEnabled = localStorage.getItem('javiAmbientEnabled') === 'true';
      this.ambientActive = false;
      this.volumeLevel = parseFloat(localStorage.getItem('javiVolume') || '0.5');
      this.autoRefresh = localStorage.getItem('javiAutoRefresh') !== 'false';

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
      this.toggleSound = this.toggleSound.bind(this);
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
    }

    // ─── INIT ──────────────────────────────────────────────────
    async init() {
      // Register SW with auto-update during loading screen
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('sw.js');
          const hadController = !!navigator.serviceWorker.controller;

          // Cooldown flag — prevents infinite reload loop after auto-update
          const justUpdated = localStorage.getItem('javiJustUpdated');
          const recentUpdate = justUpdated && (Date.now() - parseInt(justUpdated, 10)) < 300000;
          if (justUpdated && !recentUpdate) {
            localStorage.removeItem('javiJustUpdated');
          }

          // Reload when a new SW takes over (auto-update via skipWaiting in SW install)
          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            localStorage.setItem('javiJustUpdated', Date.now());
            window.location.reload();
          });

          // Helper: trigger auto-update by activating the waiting SW
          const autoUpdate = (sw) => {
            if (!sw) return;
            // Live cooldown check (in case updatefound fires much later)
            const justUpdated = localStorage.getItem('javiJustUpdated');
            if (justUpdated && (Date.now() - parseInt(justUpdated, 10)) < 300000) return;
            document.getElementById('loadingText').textContent = 'Updating app...';
            sw.postMessage({ action: 'skipWaiting' });
          };

          // Case 1: A new SW is already waiting (e.g. previous update found but not activated)
          if (registration.waiting && hadController && !recentUpdate) {
            autoUpdate(registration.waiting);
            return; // controllerchange will reload
          }

          // Case 2: A new SW is currently installing (mid-update when register resolved)
          if (registration.installing && hadController && !recentUpdate) {
            document.getElementById('loadingText').textContent = 'Updating app...';
            registration.installing.addEventListener('statechange', () => {
              if (registration.waiting) autoUpdate(registration.waiting);
            });
          }

          // Case 3: Future update detected while app runs
          registration.addEventListener('updatefound', () => {
            const newSW = registration.installing;
            if (!newSW || !hadController) return;
            // Ignore if cooldown is still active
            const stillRecent = localStorage.getItem('javiJustUpdated') &&
              (Date.now() - parseInt(localStorage.getItem('javiJustUpdated'), 10)) < 300000;
            if (stillRecent) return;
            document.getElementById('loadingText').textContent = 'Updating app...';
            newSW.addEventListener('statechange', () => {
              if (newSW.state === 'installed' && registration.waiting) {
                autoUpdate(registration.waiting);
              }
            });
          });
        } catch (_) { /* SW not supported */ }
      }

      // Request notification permission + setup push
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          Notification.requestPermission().then(result => {
            if (result === 'granted') this._setupPushNotifications();
          });
        } catch (_) { /* ignore */ }
      } else if ('Notification' in window && Notification.permission === 'granted') {
        this._setupPushNotifications();
      }

      // Javi tap interaction
      document.getElementById('kidWrap').addEventListener('click', () => this.onJaviTap());

      // Setup UI
      document.getElementById('refreshBtn').addEventListener('click', () => this.loadData());
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

      // Sound icon saved in localStorage
      this._updateSoundIcon();

      // Settings button
      document.getElementById('settingsBtn').addEventListener('click', this._showSettings);
      this._setupSettingsModal();

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

      // Listen for postMessage from service worker (notification click → play sound)
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.action === 'playAlertSound') {
          playAlertSound(e.data.alertType, this.soundEnabled, this.volumeLevel);
        }
      });

      // Pull-to-refresh (mobile)
      this._setupPullToRefresh();

      // Set default Javi icon to the app icon
      const kidGif = document.getElementById('kidGif');
      if (kidGif) {
        kidGif.style.backgroundImage = "url('icons/javi-icon.png')";
      }

      // Lucide
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Play opening theme during loading screen
      playOpeningMusic();

      // Safety timeout — dismiss loading after 8s no matter what
      const safetyTimer = setTimeout(() => this._dismissLoading(), 8000);

      // Detect location then load
      document.getElementById('loadingText').textContent = 'Detecting location...';
      await this.detectLocation();
      document.getElementById('loadingText').textContent = 'Fetching earthquakes...';
      await this.loadData();

      // Init map (needs userLat/Lon from location)
      this._initMap();

      // Auto-refresh (respect setting)
      if (this.autoRefresh) {
        this.refreshTimer = setInterval(() => this.loadData(), CONFIG.AUTO_REFRESH_MS);
      }

      // Hide loading overlay (cancel safety timer first)
      clearTimeout(safetyTimer);
      this._dismissLoading();

      // Auto-start ambient if enabled
      if (this.ambientEnabled && this.currentMood !== 'danger') {
        startAmbientSound();
        setAmbientVolume(this.volumeLevel);
        this.ambientActive = true;
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

      // Throttle safety tip rotation when tab is hidden
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // Tab hidden — pause tip rotation
          if (this._tipInterval) {
            clearInterval(this._tipInterval);
            this._tipInterval = null;
          }
        } else {
          // Tab visible again — resume tip rotation
          if (this.currentMood !== 'safe') {
            this.showSafetyTip();
          }
        }
      });
    }

    // ─── LOCATION DETECTION (improved) ─────────────────────────
    async detectLocation() {
      const LOCATION_TTL_MS = 24 * 60 * 60 * 1000; // re-check once a day

      // 1) Try cached location, but only trust it if still fresh
      const stored = this._readStoredLocation();
      if (stored) {
        this.userLat = stored.lat;
        this.userLon = stored.lon;
        this.userPlace = stored.place || '';
        if (this.userPlace) document.getElementById('locInput').value = this.userPlace;

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
          lat: this.userLat, lon: this.userLon, place: this.userPlace
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
          url: props.url || ''
        };
      });

      // Sort by distance (nearest first)
      const quakesByDist = quakes.sort((a, b) => a.dist - b.dist);

      return {
        quakes: quakesByDist,
        todayCount: quakes.filter((q) => (Date.now() - q.time.getTime()) < CONFIG.TODAY_WINDOW_MS).length,
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

      // Determine mood
      let mood = 'safe';
      const now = Date.now();
      for (const q of quakes) {
        if (q.mag >= CONFIG.DANGER_THRESHOLD && (now - q.time.getTime()) < CONFIG.DANGER_WINDOW_MS) {
          mood = 'danger';
          break;
        }
        if (q.mag >= CONFIG.WARNING_THRESHOLD && (now - q.time.getTime()) < CONFIG.WARNING_WINDOW_MS) {
          mood = 'warning';
        }
      }
      this.setMood(mood);

      // Render quake list with current sort
      this.applySortAndRender();

      // Update map markers
      this._updateMapMarkers();

      // Last update
      document.getElementById('lastUpdate').textContent = 'Updated ' + new Date().toLocaleTimeString();

      // Refresh icon
      const ico = document.getElementById('refreshIcon');
      ico.classList.remove('spin');
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

        const mapsUrl = 'https://www.google.com/maps?q=' + q.lat + ',' + q.lon;

        html += '<div class="quake-item' + (isTsunamiRisk ? ' tsunami-risk' : '') + '" data-id="' + q.id + '">' +
          '<div class="mag-badge ' + cls + '">' + mag + '</div>' +
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

      // GIF
      const gif = document.getElementById('kidGif');
      const ext = this.isIOS ? 'png' : 'gif';
      const shakeWrap = document.getElementById('kidWrap');
      shakeWrap.classList.remove('shake');

      if (mood === 'safe') {
        // Pick random safe GIF 1-3 (but iOS only has 1-2 since safe3.png missing)
        const maxSafe = this.isIOS ? 2 : 3;
        const n = Math.floor(Math.random() * maxSafe) + 1;
        gif.style.backgroundImage = "url('javi/safe" + n + "." + ext + "')";
        pillText.textContent = 'Safe';
      } else if (mood === 'warning') {
        const n = Math.floor(Math.random() * 2) + 1;
        gif.style.backgroundImage = "url('javi/warning" + n + "." + ext + "')";
        pillText.textContent = 'Warning';
      } else {
        const n = Math.floor(Math.random() * 2) + 1;
        gif.style.backgroundImage = "url('javi/danger" + n + "." + ext + "')";
        pillText.textContent = 'DANGER';
        shakeWrap.classList.add('shake');
      }

      // Record mood for history
      this._recordMood(mood);

      // Ambient sound: stop in danger, auto-start in safe/warning if enabled
      if (mood === 'danger') {
        if (this.ambientActive) {
          stopAmbientSound();
          this.ambientActive = false;
        }
      } else {
        if (this.ambientEnabled && !this.ambientActive) {
          startAmbientSound();
          setAmbientVolume(this.volumeLevel);
          this.ambientActive = true;
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

      bubble.className = 'bubble loading';
      bubble.innerHTML = '<i data-lucide="search" aria-hidden="true"></i> Checking for earthquakes...';
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      ico.classList.add('spin');

      // Show skeleton loaders in the quake list
      if (quakeContainer) {
        quakeContainer.innerHTML = this._getSkeletonHTML();
      }

      try {
        const features = await this.fetchEarthquakeData();
        const data = this.processQuakeData(features);

        // Detect new earthquakes
        const newQuakes = this._detectNewQuakes(data.quakes);
        if (newQuakes.length > 0) {
          this._alertNewQuakes(newQuakes);
        }

        // Update known IDs
        this._saveKnownQuakeIds(data.quakes);

        await this.updateUI(data);
      } catch (err) {
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
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch (_) {
        return new Set();
      }
    }

    _saveKnownQuakeIds(quakes) {
      const ids = new Set(quakes.map((q) => q.id));
      try {
        localStorage.setItem('javiKnownQuakeIds', JSON.stringify([...ids]));
      } catch (_) { /* ignore */ }
      this.knownQuakeIds = ids;
    }

    _detectNewQuakes(quakes) {
      // On first load, knownQuakeIds is empty — treat all as known, no alerts
      if (this.knownQuakeIds.size === 0) return [];
      return quakes.filter((q) => !this.knownQuakeIds.has(q.id));
    }

    _alertNewQuakes(newQuakes) {
      // Determine alert level from biggest quake
      const biggest = newQuakes.reduce((a, b) => a.mag > b.mag ? a : b);
      const alertType = biggest.mag >= CONFIG.DANGER_THRESHOLD ? 'danger' :
                        biggest.mag >= CONFIG.WARNING_THRESHOLD ? 'warning' : null;

      // Play alert sound
      if (alertType) {
        playAlertSound(alertType, this.soundEnabled, this.volumeLevel);
      }

      // Haptic feedback on alert
      this._hapticAlert(alertType);

      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const count = newQuakes.length;
        const title = count === 1 ? 'New earthquake detected!' : count + ' new earthquakes detected!';
        const body = biggest.mag.toFixed(1) + ' mag at ' + biggest.place + ' (' + biggest.dist + ' km away)';
        try {
          new Notification(title, { body, icon: 'icons/javi-icon.png' });
        } catch (_) { /* ignore */ }
      }

      // Trigger server-side push for background delivery
      this._triggerServerPush(biggest, newQuakes.length);

      // Trigger map ripple effect
      this._triggerQuakeRipple();

      // Update bubble message
      const bubble = document.getElementById('bubble');
      const count = newQuakes.length;
      const msg = count === 1
        ? 'May bago akong na-detect na lindol! ' + biggest.mag.toFixed(1) + ' mag sa ' + biggest.place
        : count + ' na bagong lindol ang na-detect ko! Pinakamalakas: ' + biggest.mag.toFixed(1) + ' mag';
      bubble.className = 'bubble';
      bubble.innerHTML = '<i data-lucide="bell" aria-hidden="true"></i> ' + msg;
      try { lucide.createIcons(); } catch (_) { /* ignore */ }
    }

    // ─── PUSH NOTIFICATIONS ────────────────────────────────────
    async _setupPushNotifications() {
      if (!('PushManager' in window)) return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          const publicKey = await this._fetchVapidPublicKey();
          if (!publicKey) return;
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this._urlBase64ToUint8Array(publicKey)
          });
        }
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON())
        });
        this._pushReady = true;
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

    async _triggerServerPush(biggest, count) {
      if (!this._pushReady) return;
      const alertType = biggest.mag >= CONFIG.DANGER_THRESHOLD ? 'danger'
        : biggest.mag >= CONFIG.WARNING_THRESHOLD ? 'warning'
        : null;
      try {
        const title = count === 1 ? 'New earthquake detected!'
          : count + ' new earthquakes!';
        const body = biggest.mag.toFixed(1) + ' mag \u2014 ' +
          biggest.place + ' (' + biggest.dist + ' km away)';
        await fetch('/api/push-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '\uD83C\uDF0D ' + title,
            body: body,
            url: '/',
            tag: 'quake-' + Date.now(),
            alertType: alertType
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

      // If warning or danger, show a safety tip instead of jokes
      if (this.currentMood === 'warning' || this.currentMood === 'danger') {
        const tip = SAFETY_TIPS[Math.floor(Math.random() * SAFETY_TIPS.length)];
        const prefix = this.currentMood === 'danger'
          ? '🚨 DANGER! '
          : '⚠️ Warning! ';
        bubble.className = 'bubble';
        bubble.innerHTML = prefix + tip;
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

      // Determine which quakes to show (respects mag filter)
      let shown = this.allQuakes;
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

    // ─── TOGGLE SOUND ─────────────────────────────────────────
    toggleSound() {
      this.soundEnabled = !this.soundEnabled;
      localStorage.setItem('javiSoundEnabled', this.soundEnabled);
      this._updateSoundIcon();
    }
    _updateSoundIcon() {
      // Sound state updates handled in _updateSettingsUI
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
      body.innerHTML =
        '<div class="detail-mag-row">' +
          '<div class="detail-mag-badge ' + cls + '">' + mag + '</div>' +
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
      const javiIcon = await this._loadImage('icons/javi-icon.png');

      // Build a canvas card and show share overlay
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const w = 600, h = 420;
      canvas.width = w * 2; canvas.height = h * 2;
      ctx.scale(2, 2); // retina

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      const dark = this.isDarkMode;
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
        const cx = [80, 200, 420, 520][i];
        const cy = [40, 80, 30, 70][i];
        const r = [50, 40, 60, 35][i];
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.7, cy - r * 0.3, r * 0.7, 0, Math.PI * 2);
        ctx.arc(cx + r * 1.2, cy, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Rounded card area
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = dark ? '#2a2a3e' : 'rgba(255,255,255,0.92)';
      this._roundRect(ctx, 20, 20, w - 40, h - 40, 16);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Border
      ctx.strokeStyle = dark ? '#555' : '#2d3436';
      ctx.lineWidth = 2.5;
      this._roundRect(ctx, 20, 20, w - 40, h - 40, 16);
      ctx.stroke();

      // ── Javi icon (top-right area) ──
      if (javiIcon) {
        // Circular mask
        ctx.save();
        ctx.beginPath();
        ctx.arc(w - 64, 54, 22, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(javiIcon, w - 86, 32, 44, 44);
        ctx.restore();
        // Circle border
        ctx.strokeStyle = dark ? '#555' : '#2d3436';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w - 64, 54, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Header: JaviAlert
      ctx.fillStyle = dark ? '#e0e0e0' : '#2d3436';
      ctx.font = 'bold 22px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('JaviAlert', 44, 58);

      // Separator line
      ctx.strokeStyle = dark ? '#444' : '#dfe6e9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(36, 72);
      ctx.lineTo(w - 36, 72);
      ctx.stroke();

      // ── Magnitude badge (fixed: no more overlap) ──
      const mag = q.mag.toFixed(1);
      const cls = magClass(q.mag);
      const badgeColor = cls === 'danger' ? '#e17055' : cls === 'warning' ? '#fdcb6e' : '#00b894';
      const badgeW = 80, badgeH = 62, badgeX = 44, badgeY = 90;
      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      this._roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 12);
      ctx.fill();

      // "MAGNITUDE" label
      ctx.fillStyle = cls === 'warning' ? '#2d3436' : '#fff';
      ctx.font = 'bold 10px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MAGNITUDE', badgeX + badgeW / 2, badgeY + 18);

      // Magnitude number
      ctx.fillStyle = cls === 'warning' ? '#2d3436' : '#fff';
      ctx.font = 'bold 34px Fredoka, sans-serif';
      ctx.fillText(mag, badgeX + badgeW / 2, badgeY + 52);

      // ── Place name ──
      ctx.fillStyle = dark ? '#e0e0e0' : '#2d3436';
      ctx.font = 'bold 17px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      const placeLabel = q.dist + ' km ' + q.dir + ' of ' + q.place;
      this._wrapText(ctx, placeLabel, 142, 110, w - 200, 20, 2);

      // ── Info rows ──
      const infoY = 172;
      const infoData = [
        { label: 'Time', value: timeSince(q.time) },
        { label: 'Depth', value: q.depth !== null ? q.depth + ' km' : '--' },
        { label: 'Coordinates', value: q.lat.toFixed(2) + ', ' + q.lon.toFixed(2) },
      ];
      infoData.forEach((item, i) => {
        const x = 52;
        const y = infoY + i * 38;
        ctx.fillStyle = dark ? '#999' : '#636e72';
        ctx.font = '11px Fredoka, sans-serif';
        ctx.fillText(item.label, x, y);
        ctx.fillStyle = dark ? '#e0e0e0' : '#2d3436';
        ctx.font = 'bold 16px Fredoka, sans-serif';
        ctx.fillText(item.value, x + 74, y);
      });

      // ── Small map pin indicating location ──
      const pinX = w - 90, pinY = 150;
      ctx.fillStyle = '#e17055';
      ctx.beginPath();
      ctx.arc(pinX, pinY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📍', pinX, pinY + 5);

      // Pin label
      ctx.fillStyle = dark ? '#999' : '#636e72';
      ctx.font = '9px Fredoka, sans-serif';
      ctx.fillText(q.lat.toFixed(1) + ', ' + q.lon.toFixed(1), pinX, pinY + 28);

      // ── Javi character quote at bottom ──
      ctx.fillStyle = dark ? '#555' : '#e8f4f8';
      this._roundRect(ctx, 44, h - 126, w - 88, 32, 10);
      ctx.fill();
      ctx.fillStyle = dark ? '#999' : '#636e72';
      ctx.font = '12px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      const quote = this._getRandomQuote();
      ctx.fillText(quote, w / 2, h - 106);

      // Footer: earthquake alert from Javi
      ctx.fillStyle = dark ? '#777' : '#999';
      ctx.font = '11px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Brought to you by JaviAlert', w / 2, h - 76);

      // Raw place
      ctx.fillStyle = dark ? '#555' : '#bbb';
      ctx.font = '10px Fredoka, sans-serif';
      ctx.fillText(q.rawPlace, w / 2, h - 60);

      // Show overlay
      this._showShareImageOverlay(canvas, q);
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

      // Sound toggle
      document.getElementById('settingsSoundToggle').addEventListener('click', () => {
        this.toggleSound();
        this._updateSettingsUI();
      });

      // Ambient toggle
      document.getElementById('settingsAmbientToggle').addEventListener('click', () => {
        this.ambientEnabled = !this.ambientEnabled;
        localStorage.setItem('javiAmbientEnabled', this.ambientEnabled);
        if (this.ambientEnabled) {
          startAmbientSound();
          setAmbientVolume(this.volumeLevel);
          this.ambientActive = true;
        } else {
          stopAmbientSound();
          this.ambientActive = false;
        }
        this._updateSettingsUI();
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
    }

    _showSettings() {
      this._updateSettingsUI();
      document.getElementById('settingsModal').classList.remove('hidden');
    }

    _dismissLoading() {
      const overlay = document.getElementById('loadingOverlay');
      if (!overlay || overlay.classList.contains('fade-out')) return; // already dismissing
      stopOpeningMusic();
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 500);
    }

    /** Resume ambient AudioContext on first click/tap — browser blocks autoplay */
    _unlockAudioOnce() {
      let unlocked = false;
      const unlock = () => {
        if (unlocked) return;
        unlocked = true;
        resumeAmbient();
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

      // Sound toggle
      const st = document.getElementById('settingsSoundToggle');
      if (st) st.classList.toggle('active', this.soundEnabled);

      // Ambient toggle
      const at = document.getElementById('settingsAmbientToggle');
      if (at) at.classList.toggle('active', this.ambientEnabled);

      // Auto-refresh toggle
      const art = document.getElementById('settingsAutoRefreshToggle');
      if (art) art.classList.toggle('active', this.autoRefresh);

      // Volume slider + percentage
      const slider = document.getElementById('settingsVolumeSlider');
      if (slider) slider.value = this.volumeLevel;
      const pct = document.getElementById('settingsVolPct');
      if (pct) pct.textContent = Math.round(this.volumeLevel * 100) + '%';

      // Update Lucide icons
      try { lucide.createIcons(); } catch (_) { /* ignore */ }
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
      let strongestDist = Infinity;
      let recentCount = 0;
      let dangerCount = 0;
      let warningCount = 0;

      const ANALYSIS_WINDOW = 7 * 86400000; // 7 days — ignore ancient history

      quakes.forEach(q => {
        const dist = q.dist || 0;
        const mag = q.mag || 0;
        const age = now - new Date(q.time).getTime();

        // Skip quakes older than the analysis window
        if (age > ANALYSIS_WINDOW) return;

        // Nearest (only within window)
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestMag = mag;
        }

        // Strongest (only within window)
        if (mag > strongestMag) {
          strongestMag = mag;
          strongestDist = dist;
        }

        // Recent (last 24h)
        if (age < 86400000) {
          recentCount++;
          if (mag >= CONFIG.DANGER_THRESHOLD) dangerCount++;
          else if (mag >= CONFIG.WARNING_THRESHOLD) warningCount++;
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
        factors.push({
          icon: strongestMag >= CONFIG.DANGER_THRESHOLD ? 'danger' : strongestMag >= CONFIG.WARNING_THRESHOLD ? 'warning' : 'safe',
          label: 'Strongest quake (7d)',
          detail: strongestMag.toFixed(1) + ' mag at ' + strongestDist.toFixed(1) + ' km away'
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
  }

  // ─── START ───────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const app = new JaviAlertApp();
    app.init();
  });

