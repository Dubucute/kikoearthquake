/**
 * Share mixin — Share earthquake as text or image.
 * Mixed into JaviAlertApp.prototype at startup.
 */
import { timeSince, magClass, PEIS_SHORT, PEIS_LABELS, intensityClass } from '../api-utils.js';

export const shareMixin = {
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
    const embedUrl = 'https://maps.google.com/maps?q=' + q.lat + ',' + q.lon + '&z=10&output=embed&maptype=satellite';

    mapFrame.src = embedUrl;

    const intLabel = PEIS_LABELS[q.intensity] || '—';
    const intCls = intensityClass(q.intensity);
    body.innerHTML =
      '<div class="detail-mag-row">' +
        '<div class="detail-mag-badge ' + cls + '">' + mag + '</div>' +
        '<div class="detail-intensity-badge ' + intCls + '">' + intLabel + '</div>' +
        '<div class="detail-mag-label">Magnitude<strong>' + cls.charAt(0).toUpperCase() + cls.slice(1) + '</strong></div>' +
      '</div>' +
      '<div class="detail-place">' + q.place + '</div>' +
      '<div class="detail-raw-place">' + q.rawPlace + '</div>' +
      '<div class="detail-info-grid">' +
        '<div class="detail-info-item"><div class="label">Distance</div><div class="value">' + q.dist + ' km ' + q.dir + '</div></div>' +
        '<div class="detail-info-item"><div class="label">Coordinates</div><div class="value">' + q.lat.toFixed(2) + ', ' + q.lon.toFixed(2) + '</div></div>' +
        '<div class="detail-info-item"><div class="label">Time</div><div class="value">' + timeStr + '</div></div>' +
        '<div class="detail-info-item"><div class="label">Depth</div><div class="value">' + (q.depth !== null ? q.depth + ' km' : '--') + '</div></div>' +
      '</div>';

    this._detailQuake = q;
    viewBtn.onclick = () => window.open(mapsUrl, '_blank', 'noopener');
    shareBtn.onclick = () => this._shareQuakeAsImage(q);
    modal.classList.remove('hidden');
  },

  _shareQuake(q) {
    const mapsUrl = 'https://www.google.com/maps?q=' + q.lat + ',' + q.lon;
    const text = '🌍 Magnitude ' + q.mag.toFixed(1) + ' earthquake\n' +
      '📍 ' + q.dist + ' km ' + q.dir + ' of ' + q.place + '\n' +
      '🕐 ' + timeSince(q.time) + '\n' +
      '🗺️ View on Google Maps: ' + mapsUrl;
    if (navigator.share) {
      navigator.share({ title: 'Earthquake Alert — Mag ' + q.mag.toFixed(1), text, url: mapsUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  },

  async _shareQuakeAsImage(q) {
    const javiIcon = await this._loadImage('icons/javi-avatar.png');
    const mapTiles = await this._loadMapTiles(q.lat, q.lon, 7, 3);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = 600, h = 420;
    canvas.width = w * 2; canvas.height = h * 2;
    ctx.scale(2, 2);

    const dark = this.isDarkMode;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    if (dark) { grad.addColorStop(0, '#1a1a2e'); grad.addColorStop(1, '#302b63'); }
    else { grad.addColorStop(0, '#4facfe'); grad.addColorStop(1, '#a8edea'); }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.12; ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      const cx = [80, 250, 480, 620][i], cy = [35, 75, 25, 65][i], r = [50, 40, 60, 35][i];
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.7, cy - r * 0.3, r * 0.7, 0, Math.PI * 2);
      ctx.arc(cx + r * 1.2, cy, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
    ctx.fillStyle = dark ? '#2a2a3e' : 'rgba(255,255,255,0.95)';
    this._roundRect(ctx, 16, 16, w - 32, h - 32, 18); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = dark ? '#555' : '#2d3436'; ctx.lineWidth = 2.5;
    this._roundRect(ctx, 16, 16, w - 32, h - 32, 18); ctx.stroke();

    const cardL = 16, cardR = w - 16, cardT = 16;
    const mapX = 320, mapY = cardT + 10, mapW = cardR - mapX - 10, mapH = 230;
    ctx.save();
    ctx.beginPath(); this._roundRect(ctx, mapX, mapY, mapW, mapH, 18); ctx.clip();
    if (mapTiles) {
      ctx.drawImage(mapTiles, mapX, mapY, mapW, mapH);
      ctx.fillStyle = dark ? 'rgba(26,26,46,0.12)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(mapX, mapY, mapW, mapH);
    } else {
      ctx.fillStyle = dark ? '#3a3a5e' : '#dfe6e9';
      ctx.fillRect(mapX, mapY, mapW, mapH);
    }
    ctx.restore();
    ctx.strokeStyle = dark ? '#444' : '#dfe6e9'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mapX, mapY + 12); ctx.lineTo(mapX, mapY + mapH - 12); ctx.stroke();

    // Epicenter pin
    const tileN = Math.pow(2, 7);
    const tileXf = (q.lon + 180) / 360 * tileN;
    const tileYf = (1 - Math.log(Math.tan(q.lat * Math.PI / 180) + 1 / Math.cos(q.lat * Math.PI / 180)) / Math.PI) / 2 * tileN;
    const epicFracX = tileXf - Math.floor(tileXf);
    const epicFracY = tileYf - Math.floor(tileYf);
    const gridTotal = 256 * 3;
    const epicPxX = 256 + epicFracX * 256;
    const epicPxY = 256 + epicFracY * 256;
    const pinCX = mapX + (epicPxX / gridTotal) * mapW;
    const pinCY = mapY + (epicPxY / gridTotal) * mapH;
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#e17055';
    ctx.beginPath(); ctx.arc(pinCX, pinCY, 20, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.arc(pinCX, pinCY, 12, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#e17055';
    ctx.beginPath(); ctx.arc(pinCX, pinCY, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(pinCX, pinCY, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pinCX, pinCY, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = dark ? '#888' : '#636e72'; ctx.font = '10px Fredoka, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(q.lat.toFixed(2) + '°N  ' + q.lon.toFixed(2) + '°E', mapX + mapW / 2, mapY + mapH + 16);

    if (javiIcon) {
      ctx.save(); ctx.beginPath(); ctx.arc(w - 56, 42, 18, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.fillRect(w - 74, 24, 36, 36);
      ctx.drawImage(javiIcon, w - 74, 24, 36, 36); ctx.restore();
      ctx.strokeStyle = dark ? '#555' : '#2d3436'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w - 56, 42, 18, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.fillStyle = dark ? '#e0e0e0' : '#2d3436'; ctx.font = 'bold 20px Fredoka, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('JaviAlert', 40, 44);
    ctx.fillStyle = dark ? '#aaa' : '#636e72'; ctx.font = 'bold 11px Fredoka, sans-serif';
    ctx.fillText('EARTHQUAKE ALERT', 40, 60);
    ctx.strokeStyle = dark ? '#444' : '#dfe6e9'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(32, 72); ctx.lineTo(mapX - 16, 72); ctx.stroke();

    const mag = q.mag.toFixed(1);
    const cls = magClass(q.mag);
    const badgeColor = cls === 'danger' ? '#e17055' : cls === 'warning' ? '#fdcb6e' : '#00b894';
    const badgeX = 40, badgeY = 84, badgeW = 80, badgeH = 64;
    ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = badgeColor;
    ctx.beginPath(); this._roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 12); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 2.5;
    ctx.beginPath(); this._roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 12); ctx.stroke();
    ctx.fillStyle = cls === 'warning' ? '#2d3436' : '#fff'; ctx.font = 'bold 10px Fredoka, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('MAGNITUDE', badgeX + badgeW / 2, badgeY + 18);
    ctx.font = 'bold 34px Fredoka, sans-serif';
    ctx.fillText(mag, badgeX + badgeW / 2, badgeY + 54);

    if (q.intensity) {
      const intX = badgeX + badgeW + 16, intY = badgeY + 4;
      const intLabel = PEIS_SHORT[q.intensity] || '';
      const intColor = q.intensity <= 2 ? '#74b9ff' : q.intensity <= 4 ? '#fdcb6e' : q.intensity <= 6 ? '#e17055' : '#d63031';
      ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      ctx.fillStyle = intColor;
      ctx.beginPath(); this._roundRect(ctx, intX, intY, 40, 34, 8); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 2;
      ctx.beginPath(); this._roundRect(ctx, intX, intY, 40, 34, 8); ctx.stroke();
      ctx.fillStyle = q.intensity <= 2 ? '#2d3436' : '#fff'; ctx.font = 'bold 10px Fredoka, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('INT', intX + 20, intY + 13);
      ctx.font = 'bold 16px Fredoka, sans-serif';
      ctx.fillText(intLabel, intX + 20, intY + 29);
    }

    ctx.fillStyle = dark ? '#e0e0e0' : '#2d3436'; ctx.font = 'bold 15px Fredoka, sans-serif'; ctx.textAlign = 'left';
    const placeLabel = q.dist + ' km ' + q.dir + ' of ' + q.place;
    this._wrapText(ctx, placeLabel, 40, 174, 320, 18, 3);

    const infoY = 238;
    [{ icon: '🕐', label: timeSince(q.time) },
     { icon: '📏', label: q.depth !== null ? q.depth + ' km depth' : '--' },
     { icon: '📍', label: q.lat.toFixed(2) + ', ' + q.lon.toFixed(2) }].forEach((item, i) => {
      const y = infoY + i * 30;
      ctx.fillStyle = dark ? '#aaa' : '#636e72'; ctx.font = '13px Fredoka, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(item.icon + '  ' + item.label, 44, y);
    });

    const barY = h - 105;
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    this._roundRect(ctx, 32, barY, mapX - 44, 28, 10); ctx.fill();
    ctx.fillStyle = dark ? '#999' : '#636e72'; ctx.font = '12px Fredoka, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('💬 ' + this._getRandomQuote(), 32 + (mapX - 44) / 2, barY + 19);

    ctx.fillStyle = dark ? '#666' : '#b2bec3'; ctx.font = '10px Fredoka, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('JaviAlert  •  ' + q.rawPlace, 32 + (mapX - 44) / 2, h - 58);
    ctx.fillStyle = dark ? '#555' : '#b2bec3'; ctx.font = '9px Fredoka, sans-serif';
    ctx.fillText('javi-alert.vercel.app', 32 + (mapX - 44) / 2, h - 42);

    this._showShareImageOverlay(canvas, q);
  },

  _loadMapTiles(lat, lon, zoom, grid) {
    return new Promise((resolve) => {
      const tileSize = 256;
      const half = Math.floor(grid / 2);
      const totalSize = tileSize * grid;
      const canvas = document.createElement('canvas');
      canvas.width = totalSize; canvas.height = totalSize;
      const ctx = canvas.getContext('2d');
      const n = Math.pow(2, zoom);
      const xFloat = (lon + 180) / 360 * n;
      const yFloat = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
      const tileX = Math.floor(xFloat);
      const tileY = Math.floor(yFloat);
      let loaded = 0;
      const total = grid * grid;
      let failed = false;
      const timeout = setTimeout(() => resolve(null), 8000);
      const done = () => { loaded++; if (loaded >= total) { clearTimeout(timeout); resolve(failed ? null : canvas); } };
      for (let gy = 0; gy < grid; gy++) {
        for (let gx = 0; gx < grid; gx++) {
          const tx = tileX + gx - half, ty = tileY + gy - half;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => { try { ctx.drawImage(img, gx * tileSize, gy * tileSize, tileSize, tileSize); } catch (_) {} done(); };
          img.onerror = () => { failed = true; done(); };
          img.src = 'https://tile.openstreetmap.org/' + zoom + '/' + tx + '/' + ty + '.png';
        }
      }
    });
  },

  _loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  },

  _getRandomQuote() {
    const quotes = ['Ingat palagi, pare!', 'Laging handa, hindi balahura!', 'Mag-ingat sa lindol!',
      'Safety first lagi!', 'Keep calm and Javi on!', 'Alagaan ang sarili!', 'Dapat laging handa!'];
    return quotes[Math.floor(Math.random() * quotes.length)];
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  _wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split(' ');
    let line = '', lines = 0;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y); line = word; y += lineHeight; lines++;
        if (lines >= maxLines) { ctx.fillText(line.slice(0, -3) + '...', x, y); return; }
      } else { line = test; }
    }
    ctx.fillText(line, x, y);
  },

  _showShareImageOverlay(canvas, q) {
    const existing = document.querySelector('.share-img-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'share-img-overlay';
    overlay.innerHTML =
      '<div class="share-img-card">' +
        '<canvas width="' + canvas.width + '" height="' + canvas.height + '"></canvas>' +
        '<div class="share-img-actions">' +
          '<button class="share-img-btn" id="shareImgDownload"><i data-lucide="download" aria-hidden="true"></i> Save</button>' +
          '<button class="share-img-btn" id="shareImgShare"><i data-lucide="share-2" aria-hidden="true"></i> Share</button>' +
          '<button class="share-img-btn" id="shareImgClose"><i data-lucide="x" aria-hidden="true"></i> Close</button>' +
        '</div></div>';
    document.body.appendChild(overlay);
    const visCanvas = overlay.querySelector('canvas');
    visCanvas.getContext('2d').drawImage(canvas, 0, 0);
    try { lucide.createIcons(); } catch (_) {}

    document.getElementById('shareImgDownload').onclick = () => {
      const link = document.createElement('a');
      link.download = 'javi-alert-' + q.mag.toFixed(1) + 'mag.png';
      link.href = visCanvas.toDataURL('image/png');
      link.click();
    };
    document.getElementById('shareImgShare').onclick = () => {
      visCanvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], 'javi-alert-' + q.mag.toFixed(1) + 'mag.png', { type: 'image/png' });
        if (navigator.share) {
          navigator.share({ title: 'Earthquake Alert — Mag ' + q.mag.toFixed(1), text: q.dist + ' km ' + q.dir + ' of ' + q.place, files: [file] }).catch(() => {});
        } else {
          const link = document.createElement('a');
          link.download = file.name; link.href = URL.createObjectURL(blob);
          link.click(); URL.revokeObjectURL(link.href);
        }
      });
    };
    document.getElementById('shareImgClose').onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === e.currentTarget) overlay.remove(); });
  },
};
