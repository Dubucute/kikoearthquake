/**
 * Map mixin — Leaflet earthquake map, markers, popups.
 * Mixed into JaviAlertApp.prototype at startup.
 */
import { timeSince, magClass } from '../api-utils.js';

export const mapMixin = {
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

    setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 300);
    this._updateMapMarkers();
  },

  _updateMapMarkers() {
    if (!this.map) return;
    if (this.userMarker && this.userLat && this.userLon) {
      this.userMarker.setLatLng([this.userLat, this.userLon]);
    }
    this.mapMarkers.forEach((m) => this.map.removeLayer(m));
    this.mapMarkers = [];
    if (!this.allQuakes || !this.allQuakes.length) return;

    const mapTimeBtn = document.getElementById('mapTimeFilter');
    const mapMagBtn = document.getElementById('mapMagFilter');
    const mapTimeDays = parseInt(mapTimeBtn?.dataset?.value || '7', 10);
    const mapMagMin = parseFloat(mapMagBtn?.dataset?.value || '0');
    const mapTimeMs = mapTimeDays * 86400000;

    let shown = this.allQuakes.filter((q) =>
      (q.dist <= 300 || q.mag >= 5) &&
      (Date.now() - q.time.getTime()) < mapTimeMs &&
      q.mag >= mapMagMin
    );
    if (this.magFilter > 0) {
      shown = shown.filter((q) => q.mag >= this.magFilter);
    }

    const bounds = [];
    shown.forEach((q) => {
      const color = this._magColor(q.mag);
      const radius = Math.max(6, Math.min(q.mag * 3, 20));
      const marker = L.circleMarker([q.lat, q.lon], {
        radius, color: '#2d3436', weight: 2, fillColor: color, fillOpacity: 0.8,
      });
      const ts = timeSince(q.time);
      const mag = q.mag.toFixed(1);
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

    if (this.userLat && this.userLon) {
      bounds.push([this.userLat, this.userLon]);
    }
    if (bounds.length > 1) {
      try { this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 }); } catch (_) {}
    }
  },

  _setupMapDropdown(containerId, triggerId, optionsId, onChange) {
    const container = document.getElementById(containerId);
    const trigger = document.getElementById(triggerId);
    const optionsEl = document.getElementById(optionsId);
    if (!trigger || !optionsEl) return;
    const textEl = trigger.querySelector('span');
    trigger.dataset.value = optionsEl.querySelector('.selected')?.dataset?.value || '0';

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
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

    document.addEventListener('click', (e) => {
      if (!container || !container.contains(e.target)) {
        optionsEl.classList.add('hidden');
      }
    });
  },

  _magColor(mag) {
    if (mag < 3) return '#00b894';
    if (mag < 4) return '#fdcb6e';
    if (mag < 5) return '#e17055';
    if (mag < 6) return '#d63031';
    return '#6c5ce7';
  },

  _magBgColor(mag) {
    if (mag < 3) return '#00b894';
    if (mag < 4) return '#fdcb6e';
    if (mag < 5) return '#e17055';
    if (mag < 6) return '#d63031';
    return '#6c5ce7';
  },

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
    this.mapTiles = L.tileLayer(tileUrl, { maxZoom: 19, attribution: attr }).addTo(this.map);
  },

  _triggerQuakeRipple() {
    const mapEl = document.getElementById('quakeMap');
    if (!mapEl) return;
    mapEl.classList.remove('map-ripple-active');
    void mapEl.offsetWidth;
    mapEl.classList.add('map-ripple-active');
    setTimeout(() => mapEl.classList.remove('map-ripple-active'), 1500);
  },
};
