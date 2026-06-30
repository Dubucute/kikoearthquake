(function() {
  'use strict';

  // ─── API & CONFIG ────────────────────────────────────────────
  const API = {
    USGS: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
    NOMINATIM: 'https://nominatim.openstreetmap.org/reverse',
    NOMINATIM_SEARCH: 'https://nominatim.openstreetmap.org/search'
  };

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

  // ─── JAVI MESSAGES ───────────────────────────────────────────
  const JAVI_MESSAGES = {
    safe: [
      "Safe tayo dito, walang malakas na lindol sa paligid natin.",
      "Okay lang dito sa area natin, walang malakas na pagyanig.",
      "Wala akong nakitang malakas na lindol malapit sa atin.",
      "Relax lang, safe naman tayo ngayon.",
      "Walang malakas na earthquake na malapit sa atin.",
      "Tahimik ang lupa sa paligid natin ngayon.",
      "Safe ang pakiramdam ko dito, walang malakas na lindol.",
      "Wala akong na-detect na malakas na pagyanig sa area natin.",
      "Panatag ang loob ko, walang malakas na lindol ngayon.",
      "Good news! Walang malakas na earthquake na malapit.",
      "Kalmado ang lupa ngayon, safe tayo.",
      "Walang dapat ipag-alala, walang malakas na pagyanig.",
      "Maaliwalas ang monitoring ko, walang malakas na lindol.",
      "Safe ang paligid natin ngayon, relax lang.",
      "Wala akong nakikitang threat na lindol sa ngayon.",
      "Okay ang lahat, walang malakas na earthquake na malapit.",
      "Tahimik ang seismic activity sa area natin.",
      "Walang malakas na pagyanig na na-detect, safe tayo.",
      "Maganda ang balita, walang malakas na lindol ngayon.",
      "Safe zone tayo ngayon, walang malakas na earthquake."
    ],
    warning: [
      "May naramdaman akong katamtamang pagyanig, mag-ingat tayo.",
      "Alert, may moderate na lindol sa malapit, stay aware.",
      "Medyo may galaw ang lupa, ingat lang tayo sa mga susunod.",
      "May nakitang pagyanig na katamtaman, huwag maging kampante.",
      "Ingat, may moderate earthquake na na-detect ako malapit.",
      "May naramdaman akong yanig, stay alert lang tayo.",
      "Katamtamang lindol ang na-detect ko, mag-ingat palagi.",
      "Alert tayo, may moderate na pagyanig na malapit sa atin.",
      "May naramdaman akong paggalaw ng lupa, ingat tayo.",
      "Moderate na lindol ang na-detect ko, maging handa tayo.",
      "Alert level, may katamtamang pagyanig sa malapit.",
      "May nakitang pagyanig, stay vigilant tayo.",
      "Ingat, may naramdaman akong yanig sa area natin.",
      "Moderate earthquake alert, mag-ingat sa mga susunod na oras.",
      "May pagyanig na na-detect, huwag balewalain.",
      "Alert tayo, may moderate seismic activity malapit.",
      "Nakaramdam ako ng yanig, mag-ingat sa paligid.",
      "May katamtamang lindol, stay safe at alerto.",
      "Warning, may moderate na pagyanig, maging handa.",
      "May nakitang paggalaw ng lupa, ingat tayo sa aftershocks."
    ],
    danger: [
      "MALAKAS na lindol! Kailangan nating mag-ingat at sumilong!",
      "Emergency! May malakas na pagyanig, manatiling kalmado at safe.",
      "Malakas na lindol ang na-detect ko! Stay safe at mag-ingat.",
      "Danger! May malakas na earthquake, mag-ingat tayo.",
      "Malakas na pagyanig! Sumilong at manatiling safe.",
      "Alert! May malakas na lindol, kailangan nating maging handa.",
      "Malakas na lindol ang na-detect ko! Stay calm at mag-ingat.",
      "Emergency! Malakas na pagyanig, ingat at manatiling safe.",
      "MALAKAS na earthquake! DROP, COVER, and HOLD ON!",
      "Mapanganib na lindol! Lumayo sa mga bintana at sumilong!",
      "Malakas na pagyanig! Iwasan ang mga falling objects!",
      "DANGER! Malakas na lindol, manatili sa safe spot!",
      "Malakas na earthquake! Sumilong sa ilalim ng matibay na mesa!",
      "Emergency alert! Malakas na pagyanig, protektahan ang sarili!",
      "Malakas na lindol! Huwag tumakbo sa labas, sumilong sa loob!",
      "Danger! May malakas na pagyanig, DROP COVER HOLD ON!",
      "Malakas na earthquake! Manatiling kalmado at sumilong agad!",
      "Alert! Malakas na lindol, lumayo sa mga pader at bintana!",
      "Mapanganib na pagyanig! Gamitin ang safety position!",
      "Malakas na lindol! Manatili sa loob hanggang tumigil ang pagyanig!"
    ]
  };

  // ─── EARTHQUAKE SAFETY TIPS ──────────────────────────────────
  const SAFETY_TIPS = [
    "DROP, COVER, and HOLD ON! Dapa, sumilong sa ilalim ng matibay na mesa, at hawakan ito.",
    "Lumayo sa mga bintana, salamin, at mga pwedeng mahulog na bagay.",
    "Kung nasa loob ng bahay, manatili sa loob. Huwag tumakbo sa labas habang umuuga.",
    "Kung nasa labas, lumayo sa mga gusali, poste, at wires.",
    "Kung nasa sasakyan, huminto sa safe na lugar at manatili sa loob.",
    "Pagkatapos ng lindol, mag-ingat sa aftershocks at suriin ang paligid.",
    "Maghanda ng emergency kit: tubig, pagkain, flashlight, at first aid.",
    "Alamin ang safe spots sa bahay niyo — ilalim ng matibay na mesa o pinto.",
    "Huwag gumamit ng elevator pagkatapos ng lindol, baka mawalan ng kuryente.",
    "Kung may gas leak, patayin ang gas at buksan ang mga bintana.",
    "Suriin ang pamilya at mga kasama pagkatapos ng lindol.",
    "Mag-identify ng evacuation route sa inyong lugar.",
    "Itago ang importanteng dokumento sa waterproof container.",
    "Magkaroon ng emergency plan kasama ang pamilya.",
    "Kung nasa beach at malakas ang lindol, lumayo sa coast dahil baka may tsunami.",
    "Huwag maniwala sa false rumors, makinig lang sa official announcements.",
    "Mag-stock ng extra batteries at power bank para sa communication.",
    "Alamin kung saan ang pinakamalapit na evacuation center.",
    "Turuan ang mga bata kung ano ang gagawin kapag may lindol.",
    "Manatiling kalmado at huwag mag-panic — makatutulong ito sa malinaw na pag-iisip."
  ];

  const JAVI_REACTIONS = [
    "Hoy! 'wag mo 'kong pindot-pindot! 😤",
    "Aray! Masakit yun! 🥲",
    "Haha, ano 'yun? 😄",
    "Ingat lagi, bes! 🫶",
    "Earthquake? Ako na bahala! 💪",
    "Bakit? Miss mo 'ko? 😏",
    "Sige, isa pa! Pindot ulit! 😆",
    "Busy ako mag-monitor ng lindol! 📡",
    "Loko-loko ka! 😂",
    "Alam mo ba kung gaano kahirap maging bantay-lindol? 🥹",
    "Wag kang mag-alala, nandito lang ako! 🫡",
    "Salamat sa pagpindot! Sana masarap ulam mo! 🍽️",
    "Pindot ka nang pindot, wala namang lindol! 🤷",
    "Javi, laging handa! 🦸",
    "Mahal kita pero 'wag mong saktan! 💔",
    "Okay lang 'yan, nandito si Javi! 🌟",
    "Hoy! Respeto naman sa character ko! 😤",
    "Ang cute ko diba? 🥰",
    "Sige lang, kaya pa 'to! 💪",
    "Bakit ka nandito? May lindol ba? 🌍",
    "Ang kulit mo! 😆",
    "Tama na please! 🥺",
    "Hoy bantay! May lindol kaya ako! 🚨",
    "Seryoso ka ba? 😅",
    "Ang saya saya! 🎉",
    "Miss na kita! 🥹",
    "Sana all masaya! ✨",
    "Wag kang maingay! 🤫",
    "Javi is watching you! 👀",
    "Ang init init! 🥵",
    "Penge naman ice cream! 🍦",
    "Sana bumagyo na! 🌧️",
    "Ang boring naman! 😴",
    "Gising gising! ☕",
    "Kape muna bago lindol! ☕",
    "Sana walang lindol today! 🙏",
    "Ingat sa byahe! 🚗",
    "Mahal kita! 💕",
    "Sana masarap ulam mo lagi! 🍛",
    "Ang galing mo mag-pindot! 👏",
    "Isa pa ulit! 🔄",
    "Hoy tawa naman dyan! 😁",
    "Ang cute ng araw na 'to! 🌤️",
    "Sana happy ka! 😊",
    "Javi loves you! 💖",
    "Wag kang mag-alala, andito ako! 🤗",
    "Ang sarap ng buhay! 🌈",
    "Sana all may Javi! 😎",
    "Ang galing ko diba? 🏆",
    "Salamat sa support! 🙌",
    "Laban lang! 🥊",
    "Kaya mo yan! 💪",
    "Wag kang susuko! 🔥",
    "Ang ganda ng araw! ☀️",
    "Sana masarap tulog mo! 🛌",
    "Good vibes lang! ✌️",
    "Ang saya ng pindot! 🎯",
    "Hoy ingat sa lindol! ⚠️",
    "Javi alert lagi! 📢",
    "Sana all naka-ready! 🎒",
    "Ang bilis ng kamay mo! 🏃",
    "Hoy bakit ka napadpad dito? 🗺️",
    "Ang galing ng app na 'to! 📱",
    "Sana all may earthquake app! 📲",
    "Javi number one! 🥇",
    "Ang saya ng buhay! 🎈",
    "Sana all naka-install! 📥",
    "Wag kalimutan mag-ready! 🧰",
    "Ang galing ng team natin! 🤝",
    "Sana all safe! 🛡️",
    "Ingat palagi! 💝",
    "Mahal ko kayo! 💗",
    "Salamat sa pag-download! 📂",
    "Ang galing ng Quake Buddy! 🎊",
    "Sana all may emergency kit! 🧳",
    "Hoy mag-stock ng tubig! 💧",
    "Sana all may flashlight! 🔦",
    "Ang galing ng preparation! 📋",
    "Javi approved! ✅",
    "Sana all naka-charge! 🔋",
    "Wag kalimutan ang power bank! 🔌",
    "Ang galing ng community natin! 🌍",
    "Sana all may plano! 📝",
    "Ingat sa aftershock! 🌊",
    "Javi nandito lang! 🏠",
    "Sana all may first aid kit! 🩹",
    "Ang galing ng teamwork! 🤗",
    "Mahal ko kayo lahat! 💞",
    "Salamat sa tiwala! 🙏",
    "Ang saya ng pamilyang 'to! 👨‍👩‍👧‍👦",
    "Sana all may JaviAlert! 📡",
    "Hoy magdasal tayo! 🙏",
    "Ang galing ng Diyos! ✝️",
    "Sana all blessed! 🌟",
    "Javi, out! 🎤",
    // ─── PICKUP LINES ─────────────────────────────────────────
    "Are you an earthquake? Kasi you shook my world! 🌍💓",
    "Bes, ang ganda/gwapo mo naman! 😍",
    "May mapa ka ba? Kasi naliligaw ako sa mata mo! 🗺️👀",
    "Are you a fault line? Kasi I'm falling for you! 💘",
    "Sakit ka sa ulo… pero gusto pa rin kita! 🤕💕",
    "Ang init mo… parang lindol sa puso ko! 🌋❤️",
    "Are you a tsunami? Kasi wave after wave ng feelings ko! 🌊💗",
    "Pwede ba kitang i-rescue? Kasi nakulong ako sa smile mo! 🦸💖",
    "Earthquake ka ba? Kasi ginigiba mo ang mundo ko! 💔😍",
    "Bes, may number ka ba? Kasi I'd like to call you mine! 📞💕",
    "Ang galing mo mag-pindot… pindotin mo rin puso ko! ❤️😏",
    "Are you a 7.0? Kasi malakas tama mo sa akin! 💥😍",
    "Penge namang time mo, kahit aftershock lang! ⏱️💗",
    "Ang cute mo… parang safe zone sa puso ko! 🛡️🥰",
    "Are you a PHIVOLCS? Kasi lagi kitang mino-monitor! 📡💕",
    "Bes, may first aid ka ba? Kasi nasaktan ako sa ganda mo! 🩹😍",
    "Ang galing ng epicenter mo… nasa puso ko! 🎯💖",
    "Pwede ba maging emergency contact mo? Para laging tawag ka lang! 📞💕",
    "Are you a red alert? Kasi you make my heart race! 🚨💓",
    "Bes, mag-evacuate na tayo… sa puso ko! 🏠💗",
    // ─── MORE YARN FUNNY ───────────────────────────────────────
    "Ano yarn? May lindol yarn? 🌍",
    "Bakit mo ko pinindot yarn? May kailangan ka ba yarn? 🤔",
    "Ang random mo yarn 😆",
    "Sabi ko nga ba at may magpi-pindot yarn 😏",
    "Javi yarn? Nandito lang yarn 🏠",
    "Lindol yarn? Saan yarn? 🌍",
    "Seryoso yarn? Haha 😄",
    "Ang saya ko yarn kasi pinindot mo ko 🎉",
    "Salamat yarn! Sana all may pumipindot 🙏",
    "Ang boring ng araw ko yarn pero naging masaya 🌈",
    "Earthquake yarn? Alert yarn! 🚨",
    "Ready yarn? Laging ready yarn ✅",
    "Safe yarn?",
    "Ingat yarn?",
    "Mahal yarn?",
    "Bakit yarn?",
    "Ano ba yarn? 😅",
    "Kaya yarn! 💪",
    "Galing yarn! 🏆",
    "Saya yarn? 🎉",
    "Cute yarn? 🥰",
    "Ganda yarn? ✨",
    "Pogi yarn? Javi yarn! 😎",
    "Yarn yarn yarn! 🧶",
    "Yarnception yarn 🌀",
    "Ang daming yarn sa mundo yarn 🌍",
    "Yarn is life yarn 💯",
    "Yarn lang yarn 😌",
    "Wag kang mag-yarn yarn 🤫",
    "Yarn mo yarn, yarn ko yarn 🔄",
    "Ang gulo ng yarn yarn 😵",
    "Yarn yarn yarn yarn 🧶",
    "Sabi ko yarn e 🙃",
    "Yarn na yarn 💀",
    "Yarn yarn yarn yarn yarn 🧶",
  ];

  const EMERGENCY_CONTACTS = [
    { name: "NDRRMC (National Disaster)",      num: "911" },
    { name: "Red Cross 24/7 Hotline",          num: "143" },
    { name: "Philippine National Police (PNP)", num: "117" },
    { name: "PNP Text Hotline",                num: "0917-847-5757" },
    { name: "Bureau of Fire Protection (BFP)",  num: "160" },
    { name: "BFP Emergency",                   num: "02-8426-3819" },
    { name: "Philippine Coast Guard",          num: "527-8480" },
    { name: "Coast Guard Emergency",           num: "0917-724-3682" },
    { name: "MMDA (Metro Manila)",             num: "136" },
    { name: "MMDA Text Hotline",               num: "0917-550-8877" },
    { name: "DOH (Department of Health)",      num: "02-8651-7800" },
    { name: "DOH Emergency",                   num: "1555" },
    { name: "National Emergency Hotline",      num: "8888" },
    { name: "Smart Emergency",                 num: "0918-944-4444" },
    { name: "Globe Emergency",                 num: "0917-555-1212" },
  ];

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
      this.isDarkMode = localStorage.getItem('javiDarkMode') === 'true';
      this.soundEnabled = localStorage.getItem('javiSoundEnabled') !== 'false';
      this.moodHistory = this._loadMoodHistory();
      this.magFilter = 0;

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

      // Dark mode
      if (this.isDarkMode) {
        document.body.classList.add('dark-mode');
        const icon = document.getElementById('darkModeIcon');
        if (icon) icon.setAttribute('data-lucide', 'sun');
      }
      document.getElementById('darkModeBtn').addEventListener('click', this.toggleDarkMode);

      // Sound toggle
      this._updateSoundIcon();
      document.getElementById('soundToggleBtn').addEventListener('click', this.toggleSound);

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

      // Pull-to-refresh (mobile)
      this._setupPullToRefresh();

      // Set default Javi icon to the app icon
      const kidGif = document.getElementById('kidGif');
      if (kidGif) {
        kidGif.style.backgroundImage = "url('icons/javi-icon.png')";
      }

      // Lucide
      try { lucide.createIcons(); } catch (_) { /* ignore */ }

      // Detect location then load
      await this.detectLocation();
      await this.loadData();

      // Auto-refresh
      this.refreshTimer = setInterval(() => this.loadData(), CONFIG.AUTO_REFRESH_MS);
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

    // ─── ALERT SOUND (Web Audio API) ───────────────────────────
    _playAlertSound(type) {
      if (!this.soundEnabled) return;
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
            // Sweep from 880Hz down to 440Hz over 0.3s
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
          new Notification(title, { body, icon: 'icons/javi-icon.png' });
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

    // ─── JAVI TAP INTERACTION ─────────────────────────────────
    onJaviTap() {
      const bubble = document.getElementById('bubble');
      const wrap = document.getElementById('kidWrap');

      // Brief shake animation on tap
      wrap.classList.remove('shake');
      void wrap.offsetWidth;
      wrap.classList.add('shake');
      setTimeout(() => wrap.classList.remove('shake'), 500);

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

    // ─── TOGGLE DARK MODE ─────────────────────────────────────
    toggleDarkMode() {
      this.isDarkMode = !this.isDarkMode;
      document.body.classList.toggle('dark-mode', this.isDarkMode);
      localStorage.setItem('javiDarkMode', this.isDarkMode);
      const icon = document.getElementById('darkModeIcon');
      if (icon) {
        icon.setAttribute('data-lucide', this.isDarkMode ? 'sun' : 'moon');
        try { lucide.createIcons(); } catch (_) { /* ignore */ }
      }
    }

    // ─── TOGGLE SOUND ─────────────────────────────────────────
    toggleSound() {
      this.soundEnabled = !this.soundEnabled;
      localStorage.setItem('javiSoundEnabled', this.soundEnabled);
      this._updateSoundIcon();
    }
    _updateSoundIcon() {
      const icon = document.getElementById('soundToggleIcon');
      if (icon) {
        icon.setAttribute('data-lucide', this.soundEnabled ? 'volume-2' : 'volume-x');
        try { lucide.createIcons(); } catch (_) { /* ignore */ }
      }
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
      const shareBtn = document.getElementById('detailShare');

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
      shareBtn.onclick = () => this._shareQuake(q);

      // Show modal
      modal.classList.remove('hidden');
    }

    // ─── SHARE QUAKE ──────────────────────────────────────────
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
  }

  // ─── START ───────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const app = new JaviAlertApp();
    app.init();
  });

})();
