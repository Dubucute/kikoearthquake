(function() {
  'use strict';

  // ─── API & CONFIG ────────────────────────────────────────────
  const API = {
    USGS: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
    NOMINATIM: 'https://nominatim.openstreetmap.org/reverse',
    NOMINATIM_SEARCH: 'https://nominatim.openstreetmap.org/search',
    OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions'
  };
  const OPENROUTER_KEY = ['sk','or','v1','58f7dc74e2b5ffa6940c0241e8a2579f954bf7fe7eaaa7004dad7555e555294a'].join('-');
  const OPENROUTER_MODELS = [
    'meta-llama/llama-3.2-3b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'nvidia/nemotron-nano-12b-v2-vl:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'nvidia/nemotron-3.5-content-safety:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'qwen/qwen3-coder:free',
    'openai/gpt-oss-120b:free',
    'openai/gpt-oss-20b:free',
    'liquid/lfm-2.5-1.2b-thinking:free',
    'liquid/lfm-2.5-1.2b-instruct:free',
    'nousresearch/hermes-3-llama-3.1-405b:free',
    'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
    'poolside/laguna-xs.2:free',
    'poolside/laguna-m.1:free',
    'cohere/north-mini-code:free',
    'google/gemma-4-26b-a4b-it:free',
    'google/gemma-4-31b-it:free'
  ];

  const CONFIG = {
    QUAKE_LIMIT: 25,
    MIN_MAGNITUDE: 1,
    DISPLAY_COUNT: 10,
    AUTO_REFRESH_MS: 300000,
    DANGER_THRESHOLD: 5.0,
    WARNING_THRESHOLD: 3.0,
    DANGER_WINDOW_MS: 21600000,
    WARNING_WINDOW_MS: 86400000,
    TODAY_WINDOW_MS: 86400000
  };

  // ─── AI PROMPTS ──────────────────────────────────────────────
  const MOOD_PROMPTS = {
    safe: [
      "Safe tayo dito, walang malakas na lindol sa paligid natin. Sabihin mo sa casual Taglish na ikaw si Javi.",
      "Okay lang dito sa area natin, walang malakas na pagyanig. Casual Taglish, first person.",
      "Wala akong nakitang malakas na lindol malapit sa atin. Casual Taglish lang.",
      "Relax lang, safe naman tayo ngayon. Casual Taglish, ikaw si Javi.",
      "Walang malakas na earthquake na malapit sa atin. Casual Taglish."
    ],
    warning: [
      "May naramdaman akong katamtamang pagyanig, mag-ingat tayo. Casual Taglish, first person.",
      "Alert, may moderate na lindol sa malapit, stay aware. Casual Taglish.",
      "Medyo may galaw ang lupa, ingat lang tayo. Casual Taglish, ikaw si Javi.",
      "May nakitang pagyanig na katamtaman, huwag maging kampante. Casual Taglish.",
      "Ingat, may moderate earthquake na na-detect ko malapit. Casual Taglish."
    ],
    danger: [
      "MALAKAS na lindol! Kailangan nating mag-ingat at sumilong! Casual Taglish, first person.",
      "Emergency! May malakas na pagyanig, manatiling kalmado at safe. Casual Taglish.",
      "Malakas na lindol ang na-detect ko! Stay safe at mag-ingat. Casual Taglish.",
      "Danger! May malakas na earthquake, mag-ingat tayo. Casual Taglish.",
      "Malakas na pagyanig! Sumilong at manatiling safe. Casual Taglish."
    ]
  };

  // ─── FALLBACK MESSAGES (when AI fails) ───────────────────────
  const FALLBACK_MESSAGES = {
    safe: [
      "Safe tayo dito, walang malakas na lindol sa paligid natin.",
      "Okay lang dito sa area natin, walang malakas na pagyanig.",
      "Wala akong nakitang malakas na lindol malapit sa atin.",
      "Relax lang, safe naman tayo ngayon.",
      "Walang malakas na earthquake na malapit sa atin.",
      "Tahimik ang lupa sa paligid natin ngayon.",
      "Safe ang pakiramdam ko dito, walang malakas na lindol.",
      "Wala akong na-detect na malakas na pagyanig sa area natin."
    ],
    warning: [
      "May naramdaman akong katamtamang pagyanig, mag-ingat tayo.",
      "Alert, may moderate na lindol sa malapit, stay aware.",
      "Medyo may galaw ang lupa, ingat lang tayo sa mga susunod.",
      "May nakitang pagyanig na katamtaman, huwag maging kampante.",
      "Ingat, may moderate earthquake na na-detect ako malapit.",
      "May naramdaman akong yanig, stay alert lang tayo.",
      "Katamtamang lindol ang na-detect ko, mag-ingat palagi.",
      "Alert tayo, may moderate na pagyanig na malapit sa atin."
    ],
    danger: [
      "MALAKAS na lindol! Kailangan nating mag-ingat at sumilong!",
      "Emergency! May malakas na pagyanig, manatiling kalmado at safe.",
      "Malakas na lindol ang na-detect ko! Stay safe at mag-ingat.",
      "Danger! May malakas na earthquake, mag-ingat tayo.",
      "Malakas na pagyanig! Sumilong at manatiling safe.",
      "Alert! May malakas na lindol, kailangan nating maging handa.",
      "Malakas na lindol ang na-detect ko! Stay calm at mag-ingat.",
      "Emergency! Malakas na pagyanig, ingat at manatiling safe."
    ]
  };

  // ─── HELPER FUNCTIONS ────────────────────────────────────────
  function timeSince(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return Math.floor(days / 30) + 'mo ago';
  }

  function getCompassDir(lat1, lon1, lat2, lon2) {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
    const x = Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
              Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
    const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(brng / 22.5) % 16];
  }

  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function parsePlaceName(raw) {
    // USGS format: "20 km SSW of La Paz, Philippines"
    const match = raw.match(/^([\d.]+)\s*km\s+(\w+)\s+of\s+(.+)$/i);
    if (match) {
      return {
        distance: parseFloat(match[1]),
        direction: match[2].toUpperCase(),
        place: match[3].trim()
      };
    }
    return { distance: null, direction: null, place: raw };
  }

  function magClass(mag) {
    if (mag < 3) return 'mag-low';
    if (mag < 4) return 'mag-minor';
    if (mag < 5) return 'mag-moderate';
    if (mag < 6) return 'mag-strong';
    return 'mag-major';
  }

  // ─── JAVIALERT APP ───────────────────────────────────────────
  class JaviAlertApp {
    constructor() {
      this.userLat = null;
      this.userLon = null;
      this.userPlace = '';
      this.currentMood = 'safe';
      this.currentPage = 1;
      this.allQuakes = [];
      this.sortMode = 'nearest';
      this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      this.isAndroid = /Android/.test(navigator.userAgent);
      this.deferredPrompt = null;
      this.refreshTimer = null;
      this.knownQuakeIds = this._loadKnownQuakeIds();

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
    }

    // ─── INIT ──────────────────────────────────────────────────
    async init() {
      // Register SW
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('sw.js');
        } catch (_) { /* ignore */ }
      }

      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          Notification.requestPermission();
        } catch (_) { /* ignore */ }
      }

      // Setup UI
      document.getElementById('refreshBtn').addEventListener('click', () => this.loadData());
      document.getElementById('installBanner').addEventListener('click', () => this.showInstallTutorial());
      document.getElementById('modalClose').addEventListener('click', () => {
        document.getElementById('installModal').classList.add('hidden');
      });
      document.getElementById('modalGotIt').addEventListener('click', () => {
        document.getElementById('installModal').classList.add('hidden');
      });

      this.setupLocationSearch();
      this.setupSortDropdown();
      this.setupPagination();
      this.setupInstallPrompt();

      // Lucide
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Detect location then load
      await this.detectLocation();
      await this.loadData();

      // Auto-refresh
      this.refreshTimer = setInterval(() => this.loadData(), CONFIG.AUTO_REFRESH_MS);
    }

    // ─── LOCATION DETECTION ────────────────────────────────────
    async detectLocation() {
      // Try stored location first
      const stored = localStorage.getItem('javiUserLocation');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          this.userLat = parsed.lat;
          this.userLon = parsed.lon;
          this.userPlace = parsed.place || '';
          if (this.userPlace) {
            document.getElementById('locInput').value = this.userPlace;
          }
          return;
        } catch (_) { /* ignore */ }
      }

      // Geolocation API with timeout
      try {
        const pos = await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('timeout')), 10000);
          navigator.geolocation.getCurrentPosition(
            (p) => { clearTimeout(timeoutId); resolve(p); },
            (e) => { clearTimeout(timeoutId); reject(e); },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
          );
        });
        this.userLat = pos.coords.latitude;
        this.userLon = pos.coords.longitude;
      } catch (_) {
        // Fallback: Manila
        this.userLat = 14.5995;
        this.userLon = 120.9842;
      }

      // Reverse geocode
      await this.fetchLocationName();
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
          lat: this.userLat, lon: this.userLon, place: this.userPlace
        }));
      } catch (_) {
        this.userPlace = this.userLat.toFixed(2) + ', ' + this.userLon.toFixed(2);
        document.getElementById('locInput').value = this.userPlace;
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
        input.value = this.userPlace.split(',')[0] || this.userPlace;
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
        return {
          id: f.id || props.net + props.code,
          mag: props.mag || 0,
          place: parsed.place,
          rawPlace: props.place || 'Unknown',
          time: new Date(props.time),
          lat,
          lon,
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

      // Last update
      document.getElementById('lastUpdate').textContent = 'Updated ' + new Date().toLocaleTimeString();

      // Refresh icon
      const ico = document.getElementById('refreshIcon');
      ico.classList.remove('spin');
    }

    // ─── RENDER QUAKE LIST ─────────────────────────────────────
    renderQuakeList(quakes) {
      const container = document.getElementById('quakeList');
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

        html += '<div class="quake-item">' +
          '<div class="mag-badge ' + cls + '">' + mag + '</div>' +
          '<div class="q-info">' +
            '<div class="q-top">' +
              '<span class="q-place">' + q.place + '</span>' +
              '<span class="q-dist">' + distKm + '</span>' +
            '</div>' +
            '<div class="q-meta">' + timeStr + ' &middot; ' + dirStr + '</div>' +
          '</div>' +
        '</div>';
      });
      container.innerHTML = html;
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Pagination info
      document.getElementById('pageInfo').textContent = 'Page ' + this.currentPage + ' of ' + totalPages;
      document.getElementById('prevPage').disabled = this.currentPage <= 1;
      document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
    }

    // ─── ALERT SOUND (Web Audio API) ───────────────────────────
    _playAlertSound(type) {
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
          // Urgent rapid siren: alternating 440Hz-880Hz, 3 cycles
          for (let c = 0; c < 3; c++) {
            [440, 880].forEach((freq, i) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'square';
              osc.frequency.value = freq;
              const t = now + c * 0.3 + i * 0.15;
              gain.gain.setValueAtTime(0.4, t);
              gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(t);
              osc.stop(t + 0.15);
            });
          }
        }
      } catch (_) { /* audio not supported */ }
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

      // Bubble message
      this.getJaviMessage(mood);
    }

    // ─── GET JAVI MESSAGE (AI or fallback) ─────────────────────
    async getJaviMessage(mood) {
      const bubble = document.getElementById('bubble');
      bubble.className = 'bubble loading';
      bubble.innerHTML = '<i data-lucide="search" aria-hidden="true"></i> Thinking...';
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Try OpenRouter AI with model fallback chain
      const prompts = MOOD_PROMPTS[mood] || MOOD_PROMPTS.safe;
      const prompt = prompts[Math.floor(Math.random() * prompts.length)];

      for (const model of OPENROUTER_MODELS) {
        try {
          const res = await fetch(API.OPENROUTER, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + OPENROUTER_KEY,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'JaviAlert'
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: 'system',
                  content: 'You are Javi, a friendly earthquake safety buddy for the JaviAlert app. You help users stay informed about earthquakes near them. Always respond in casual Tagalog (Tagalog + English mix) in 1 short sentence. Use first person ("ako", "ko", "akin"). Do not use emojis. Be concise and natural.'
                },
                { role: 'user', content: prompt }
              ],
              max_tokens: 60,
              temperature: 0.8
            })
          });

          if (!res.ok) {
            // 429 = rate limited, try next model; other errors also fall through
            throw new Error('AI returned ' + res.status + ' for ' + model);
          }

          const data = await res.json();
          const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';

          if (text && text.length < 200) {
            bubble.className = 'bubble';
            bubble.innerHTML = text;
            try { lucide.createIcons(); } catch (_) { /* ignore */ }
            return;
          }
        } catch (_) {
          // Try next model in the fallback chain
          continue;
        }
      }

      // Fallback (all models failed)
      const msgs = FALLBACK_MESSAGES[mood] || FALLBACK_MESSAGES.safe;
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      bubble.className = 'bubble';
      bubble.innerHTML = msg;
      try { lucide.createIcons(); } catch (_) { /* ignore */ }
    }

    // ─── LOAD DATA ─────────────────────────────────────────────
    async loadData() {
      const bubble = document.getElementById('bubble');
      const ico = document.getElementById('refreshIcon');

      bubble.className = 'bubble loading';
      bubble.innerHTML = '<i data-lucide="search" aria-hidden="true"></i> Checking for earthquakes...';
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      ico.classList.add('spin');

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
      }
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
        this._playAlertSound(alertType);
      }

      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const count = newQuakes.length;
        const title = count === 1 ? 'New earthquake detected!' : count + ' new earthquakes detected!';
        const body = biggest.mag.toFixed(1) + ' mag at ' + biggest.place + ' (' + biggest.dist + ' km away)';
        try {
          new Notification(title, { body, icon: 'icons/icon-192.png' });
        } catch (_) { /* ignore */ }
      }

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

    // ─── INSTALL PROMPT ────────────────────────────────────────
    setupInstallPrompt() {
      // Listen for beforeinstallprompt (Android/Desktop)
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        const banner = document.getElementById('installBanner');
        banner.classList.remove('hidden');
      });

      // On iOS, show banner with instructions
      if (this.isIOS) {
        const banner = document.getElementById('installBanner');
        banner.classList.remove('hidden');
        banner.querySelector('.install-title').textContent = 'Install on iOS';
        banner.querySelector('.install-desc').textContent = 'Tap Share > Add to Home Screen';
      }
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
  }

  // ─── START ───────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const app = new JaviAlertApp();
    app.init();
  });

})();
