/**
 * Settings mixin — Settings modal, dark mode, SW registration, loading overlay.
 * Mixed into JaviAlertApp.prototype at startup.
 */
import { startAmbientSound, stopAmbientSound, setAmbientVolume, setAmbientTrack, preloadAlertAudio, playAlertSound } from '../audio.js';
import { CHANGELOG } from '../changelog.js';
import { SAFETY_TIPS, JAVI_MESSAGES } from '../messages.js';
import { CONFIG, PEIS_LABELS } from '../api-utils.js';

export const settingsMixin = {
  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-mode', this.isDarkMode);
    localStorage.setItem('javiDarkMode', this.isDarkMode);
    this._switchMapTiles();
  },

  _setNotifSound(sound) {
    this.notifSound = sound;
    localStorage.setItem('javiNotifSound', sound);
    if (sound !== 'silent') {
      this.soundEnabled = true;
      localStorage.setItem('javiSoundEnabled', 'true');
    }
    this._updateSettingsUI();
  },

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
      utterance.lang = 'en-US'; utterance.rate = 0.9; utterance.pitch = 1.1; utterance.volume = this.volumeLevel;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  },

  _speakGenericAlert(alertType) {
    if (!this.soundEnabled) return;
    try {
      if (!window.speechSynthesis) return;
      const msg = alertType === 'danger'
        ? 'Danger! Strong earthquake detected! Drop, cover, and hold on!'
        : 'Earthquake detected. Please check the app for details.';
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'en-US'; utterance.rate = 0.9; utterance.pitch = 1.1; utterance.volume = this.volumeLevel;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  },

  _setupSettingsModal() {
    document.getElementById('settingsModalClose').addEventListener('click', () => {
      document.getElementById('settingsModal').classList.add('hidden');
    });
    document.getElementById('settingsModalGotIt').addEventListener('click', () => {
      document.getElementById('settingsModal').classList.add('hidden');
    });
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
    });

    document.getElementById('settingsDarkToggle').addEventListener('click', () => {
      this.toggleDarkMode();
      this._updateSettingsUI();
    });

    document.getElementById('settingsSafetyTipsToggle').addEventListener('click', () => {
      this.safetyTipsShown = !this.safetyTipsShown;
      localStorage.setItem('javiSafetyTipsShown', this.safetyTipsShown);
      if (this.safetyTipsShown) { this.showSafetyTip(); }
      else {
        const card = document.getElementById('safetyCard');
        if (card) card.classList.add('hidden');
        if (this._tipInterval) { clearInterval(this._tipInterval); this._tipInterval = null; }
      }
      this._updateSettingsUI();
    });

    // Notification sound dropdown
    (() => {
      const self = this;
      const trigger = document.getElementById('notifSoundSelectTrigger');
      const optionsEl = document.getElementById('notifSoundSelectOptions');
      const textEl = document.getElementById('notifSoundSelectText');
      const labels = { alarm: 'Alarm', voice: 'Voice', silent: 'Silent' };
      if (trigger && optionsEl) {
        if (textEl) textEl.textContent = labels[self.notifSound] || 'Alarm';
        optionsEl.classList.add('hidden');
        trigger.addEventListener('click', (e) => { e.stopPropagation(); optionsEl.classList.toggle('hidden'); });
        optionsEl.querySelectorAll('.custom-select-option').forEach(btn => {
          btn.addEventListener('click', () => {
            const sound = btn.dataset.sound || 'alarm';
            self._setNotifSound(sound);
            if (textEl) textEl.textContent = labels[sound] || 'Alarm';
            optionsEl.classList.add('hidden');
          });
        });
        document.addEventListener('click', (e) => {
          if (!e.target.closest('#notifSoundSelect')) optionsEl.classList.add('hidden');
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

    // Push notification toggle
    document.getElementById('settingsNotifToggle').addEventListener('click', async () => {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        if (this._pushDisabled) {
          this._pushDisabled = false;
          localStorage.setItem('javiPushDisabled', 'false');
          await this._setupPushNotifications();
          this._updateSettingsUI();
          this._showNotifToast('safe', { mag: 0, dist: 0, place: 'Push notifications turned ON' });
        } else {
          try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
              await subscription.unsubscribe();
              await fetch('/api/push-subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) }).catch(() => {});
            }
          } catch (_) {}
          this._pushReady = false; this._pushDisabled = true;
          localStorage.setItem('javiPushDisabled', 'true');
          this._updateSettingsUI();
          this._showNotifToast('safe', { mag: 0, dist: 0, place: 'Push notifications turned OFF' });
        }
        return;
      }
      if (Notification.permission === 'denied') {
        this._showNotifToast('warning', { mag: 0, dist: 0, place: 'Enable notifications in your browser/device site settings' });
        return;
      }
      try {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
          this._pushDisabled = false;
          localStorage.setItem('javiPushDisabled', 'false');
          await this._setupPushNotifications();
          this._updateSettingsUI();
          this._showNotifToast('safe', { mag: 0, dist: 0, place: 'Push notifications are now active!' });
        } else if (result === 'denied') {
          this._showNotifToast('warning', { mag: 0, dist: 0, place: 'Enable notifications in your browser/device site settings' });
        }
      } catch (_) {}
    });

    // Track picker
    document.querySelectorAll('.track-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const track = opt.dataset.track || '';
        this.ambientTrack = track;
        localStorage.setItem('javiAmbientTrack', track);
        if (this.ambientEnabled && this.ambientActive) setAmbientTrack(track);
        this._updateSettingsUI();
      });
    });

    // Auto-refresh toggle
    document.getElementById('settingsAutoRefreshToggle').addEventListener('click', () => {
      this.autoRefresh = !this.autoRefresh;
      localStorage.setItem('javiAutoRefresh', this.autoRefresh);
      if (this.autoRefresh) {
        if (!this.refreshTimer) this.refreshTimer = setInterval(() => this.loadData(), CONFIG.AUTO_REFRESH_MS);
      } else {
        if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
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

    // Update Logs
    document.getElementById('updateLogsRow').addEventListener('click', () => {
      const body = document.getElementById('updateLogsBody');
      if (!body) return;
      if (!body.dataset.populated) {
        body.dataset.populated = '1';
        body.innerHTML = CHANGELOG.map(entry => `
          <div class="update-log-entry">
            <div class="update-log-ver">${entry.ver}<span class="update-log-date">${entry.date}</span></div>
            <ul class="update-log-items">${entry.items.map(i => `<li>${i}</li>`).join('')}</ul>
          </div>
        `).join('');
      }
      document.getElementById('updateLogsModal').classList.remove('hidden');
    });

    // Language dropdown
    const langTrigger = document.getElementById('langSelectTrigger');
    const langOptionsEl = document.getElementById('langSelectOptions');
    const langTextEl = document.getElementById('langSelectText');
    const langLabels = { en: 'English', tl: 'Tagalog', ceb: 'Cebuano' };
    if (langTrigger && langOptionsEl) {
      const savedLang = (() => { try { return localStorage.getItem('javiLang') || 'tl'; } catch(_) { return 'tl'; } })();
      if (langTextEl) langTextEl.textContent = langLabels[savedLang] || 'Tagalog';
      langOptionsEl.classList.add('hidden');
      langTrigger.addEventListener('click', (e) => { e.stopPropagation(); langOptionsEl.classList.toggle('hidden'); });
      langOptionsEl.querySelectorAll('.custom-select-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const lang = btn.dataset.lang || 'tl';
          try { localStorage.setItem('javiLang', lang); } catch(_) {}
          if (langTextEl) langTextEl.textContent = langLabels[lang] || 'Tagalog';
          langOptionsEl.classList.add('hidden');
          setTimeout(() => window.location.reload(), 180);
        });
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#languageSelect')) langOptionsEl.classList.add('hidden');
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

    // Test notification button
    document.getElementById('testNotifBtn').addEventListener('click', async () => {
      if (this.notifSound === 'alarm') {
        playAlertSound('warning', this.soundEnabled, this.volumeLevel);
      } else if (this.notifSound === 'voice') {
        try {
          if (window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance('This is a test notification from Javi Alert!');
            utterance.lang = 'en-US'; utterance.rate = 0.9; utterance.pitch = 1.1; utterance.volume = this.volumeLevel;
            window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
          }
        } catch (_) {}
      }
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification('JaviAlert Test', { body: 'This is a test notification! Only you can see this.', icon: 'icons/javi-icon.png' }); } catch (_) {}
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification('JaviAlert Test', { body: 'This is a test notification! Only you can see this.', icon: 'icons/javi-icon.png', tag: 'test-' + Date.now() });
      } catch (_) {}
      this._showNotifToast('safe', { mag: 0, dist: 0, place: 'Test notification sent! (local only, ' + this.notifSound + ' sound)' });
    });
  },

  _registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const doRegister = async () => {
      try {
        const registration = await navigator.serviceWorker.register('sw.js');
        const hadController = !!navigator.serviceWorker.controller;
        const justUpdated = localStorage.getItem('javiJustUpdated');
        const recentUpdate = justUpdated && (Date.now() - parseInt(justUpdated, 10)) < 300000;
        if (justUpdated && !recentUpdate) localStorage.removeItem('javiJustUpdated');

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          if (!hadController) return;
          refreshing = true;
          localStorage.setItem('javiJustUpdated', Date.now());
          window.location.reload();
        });

        const _showUpdateOverlay = () => {
          const overlay = document.getElementById('loadingOverlay');
          if (overlay) {
            overlay.classList.remove('hidden', 'fade-out');
            const lt = document.getElementById('loadingText');
            if (lt) lt.textContent = 'Updating app...';
          }
        };

        const autoUpdate = (sw) => {
          if (!sw) return;
          const ju = localStorage.getItem('javiJustUpdated');
          if (ju && (Date.now() - parseInt(ju, 10)) < 300000) return;
          _showUpdateOverlay();
          sw.postMessage({ action: 'skipWaiting' });
        };

        if (registration.waiting && hadController && !recentUpdate) { autoUpdate(registration.waiting); return; }
        if (registration.installing && hadController && !recentUpdate) {
          _showUpdateOverlay();
          registration.installing.addEventListener('statechange', () => { if (registration.waiting) autoUpdate(registration.waiting); });
        }
        registration.addEventListener('updatefound', () => {
          const newSW = registration.installing;
          if (!newSW || !hadController) return;
          const stillRecent = localStorage.getItem('javiJustUpdated') && (Date.now() - parseInt(localStorage.getItem('javiJustUpdated'), 10)) < 300000;
          if (stillRecent) return;
          _showUpdateOverlay();
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && registration.waiting) autoUpdate(registration.waiting);
          });
        });
      } catch (_) {}
    };
    doRegister();
  },

  _showSettings() {
    this._updateSettingsUI();
    document.getElementById('settingsModal').classList.remove('hidden');
  },

  _dismissLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay || overlay.classList.contains('fade-out')) return;
    overlay.classList.add('fade-out');
    setTimeout(() => { overlay.classList.add('hidden'); }, 500);
  },

  _unlockAudioOnce() {
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      preloadAlertAudio();
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
    document.addEventListener('keydown', unlock);
  },

  _updateSettingsUI() {
    const dt = document.getElementById('settingsDarkToggle');
    if (dt) dt.classList.toggle('active', this.isDarkMode);
    const stt = document.getElementById('settingsSafetyTipsToggle');
    if (stt) stt.classList.toggle('active', this.safetyTipsShown);
    const nst = document.getElementById('notifSoundSelectText');
    if (nst) { const labels = { alarm: 'Alarm', voice: 'Voice', silent: 'Silent' }; nst.textContent = labels[this.notifSound] || 'Alarm'; }
    const at = document.getElementById('settingsAmbientToggle');
    if (at) at.classList.toggle('active', this.ambientEnabled);
    const nt = document.getElementById('settingsNotifToggle');
    if (nt) {
      const canPush = 'Notification' in window && Notification.permission === 'granted';
      nt.classList.toggle('active', canPush && !this._pushDisabled);
      nt.classList.toggle('denied', 'Notification' in window && Notification.permission === 'denied');
    }
    const blockedHelp = document.getElementById('notifBlockedHelp');
    if (blockedHelp) blockedHelp.classList.toggle('hidden', !('Notification' in window) || Notification.permission !== 'denied');
    const art = document.getElementById('settingsAutoRefreshToggle');
    if (art) art.classList.toggle('active', this.autoRefresh);
    document.querySelectorAll('.track-option').forEach(opt => {
      opt.classList.toggle('active', (opt.dataset.track || '') === this.ambientTrack);
    });
    const slider = document.getElementById('settingsVolumeSlider');
    if (slider) slider.value = this.volumeLevel;
    const pct = document.getElementById('settingsVolPct');
    if (pct) pct.textContent = Math.round(this.volumeLevel * 100) + '%';
    try { lucide.createIcons(); } catch (_) {}
    try {
      const textEl = document.getElementById('langSelectText');
      if (textEl) {
        const lang = localStorage.getItem('javiLang') || 'tl';
        const labels = { en: 'English', tl: 'Tagalog', ceb: 'Cebuano' };
        textEl.textContent = labels[lang] || 'Tagalog';
      }
    } catch (_) {}
  },

  // ─── HAPTIC FEEDBACK ────────────────────────────────────
  _hapticAlert(type) {
    if (!type || !navigator.vibrate) return;
    try {
      if (type === 'danger') navigator.vibrate([200, 100, 200, 100, 200]);
      else if (type === 'warning') navigator.vibrate([100, 80, 100]);
    } catch (_) {}
  },

  _showNotifToast(type, quake) {
    const toast = document.getElementById('notifToast');
    if (!toast) return;
    const titleEl = document.getElementById('notifToastTitle');
    const bodyEl = document.getElementById('notifToastBody');
    const iconEl = document.getElementById('notifToastIcon');
    if (!titleEl || !bodyEl) return;

    const emoji = type === 'danger' ? '🚨' : type === 'warning' ? '⚠️' : '🔔';
    if (iconEl) iconEl.textContent = emoji;
    const isPlain = quake.mag === 0 && quake.dist === 0;
    if (!isPlain) {
      const intLabel = PEIS_LABELS[quake.intensity] || '';
      titleEl.textContent = type === 'danger' ? 'DANGER! Strong Earthquake!' : type === 'warning' ? 'Warning — Earthquake Detected' : 'Earthquake Alert';
      bodyEl.textContent = intLabel + ' — ' + (quake.mag || '?').toFixed(1) + ' mag • ' + quake.dist + ' km away • ' + quake.place;
    } else {
      titleEl.textContent = quake.place || 'Notification';
      bodyEl.textContent = '';
    }

    toast.classList.remove('hidden');
    toast.classList.remove('toast-show');
    void toast.offsetWidth;
    toast.classList.add('toast-show');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.classList.add('hidden'), 400);
    }, 6000);
  },

  _spawnSparkles(mood) {
    const container = document.getElementById('javiSparkles');
    if (!container) return;
    container.innerHTML = '';
    const count = mood === 'danger' ? 3 : 6;
    const colors = mood === 'danger' ? ['spark-danger'] : ['spark', 'spark-pink', 'spark-green', 'spark-blue'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'spark ' + colors[Math.floor(Math.random() * colors.length)];
      el.style.left = (20 + Math.random() * 80) + '%';
      el.style.top = (10 + Math.random() * 60) + '%';
      el.style.setProperty('--sx', (Math.random() * 40 - 20) + 'px');
      el.style.setProperty('--sy', (-20 - Math.random() * 30) + 'px');
      el.style.animation = mood === 'danger'
        ? 'sparkDanger ' + (0.6 + Math.random() * 0.4) + 's ease-out forwards'
        : 'sparkFloat ' + (0.6 + Math.random() * 0.4) + 's ease-out forwards';
      el.style.animationDelay = (i * 0.08) + 's';
      container.appendChild(el);
      setTimeout(() => el.remove(), 2000);
    }
  },
};
