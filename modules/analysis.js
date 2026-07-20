/**
 * Analysis mixin — "Am I Safe?" safety analysis modal.
 * Mixed into JaviAlertApp.prototype at startup.
 */
import { CONFIG, intensityClass } from '../api-utils.js';

export const analysisMixin = {
  _showAnalysis() {
    const modal = document.getElementById('analysisModal');
    const loading = document.getElementById('analysisLoading');
    const body = document.getElementById('analysisBody');
    const msgEl = document.getElementById('analysisJaviMsg');
    const breakdown = document.getElementById('analysisBreakdown');
    const icon = document.getElementById('analysisModalIcon');
    if (!modal) return;

    loading.classList.remove('hidden');
    body.classList.add('hidden');
    modal.classList.remove('hidden');

    const moodIcon = this.currentMood === 'danger' ? 'alert-octagon'
      : this.currentMood === 'warning' ? 'alert-triangle' : 'shield-check';
    if (icon) icon.setAttribute('data-lucide', moodIcon);
    try { lucide.createIcons(); } catch (_) {}

    setTimeout(() => {
      const result = this._runAnalysis();
      loading.classList.add('hidden');
      body.classList.remove('hidden');
      msgEl.innerHTML = this._formatAnalysisMessage(result);
      breakdown.innerHTML = this._renderAnalysisBreakdown(result);
      try { lucide.createIcons(); } catch (_) {}
    }, 600);
  },

  _runAnalysis() {
    const quakes = this.allQuakes;
    const now = Date.now();

    if (!quakes || quakes.length === 0) {
      return {
        verdict: 'safe', score: 100, factors: [],
        message: 'No earthquakes detected near you. You\'re all good!'
      };
    }

    let nearestDist = Infinity, nearestMag = 0;
    let strongestMag = 0, strongestRawMag = 0, strongestDepth = null, strongestDist = Infinity;
    let recentCount = 0, dangerCount = 0, warningCount = 0;
    const ANALYSIS_WINDOW = 7 * 86400000;

    quakes.forEach(q => {
      const dist = q.dist || 0;
      const mag = q.mag || 0;
      const age = now - new Date(q.time).getTime();
      let effectiveMag = mag;
      if (q.depth !== null) {
        if (q.depth < CONFIG.SHALLOW_DEPTH_KM) effectiveMag += 0.5;
        else if (q.depth > CONFIG.DEEP_DEPTH_KM) effectiveMag -= 0.5;
      }
      if (age > ANALYSIS_WINDOW) return;
      if (dist < nearestDist) { nearestDist = dist; nearestMag = mag; }
      if (effectiveMag > strongestMag) {
        strongestMag = effectiveMag; strongestRawMag = mag;
        strongestDepth = q.depth; strongestDist = dist;
      }
      if (age < 86400000) {
        recentCount++;
        if (effectiveMag >= CONFIG.DANGER_THRESHOLD) dangerCount++;
        else if (effectiveMag >= CONFIG.WARNING_THRESHOLD) warningCount++;
      }
    });

    let score = 100;
    if (nearestDist < 50) score -= Math.max(0, 30 - nearestDist * 0.5);
    if (nearestDist < 10) score -= 15;
    if (strongestMag >= 5) score -= 35;
    else if (strongestMag >= 4) score -= 20;
    else if (strongestMag >= 3) score -= 10;
    if (dangerCount > 0) score -= 25;
    if (warningCount > 0) score -= 15;
    if (nearestDist < 100 && strongestMag >= 4) score -= 10;
    score = Math.max(0, Math.min(100, score));

    let verdict;
    if (score >= 80) verdict = 'safe';
    else if (score >= 50) verdict = 'warning';
    else verdict = 'danger';

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
      factors.push({ icon: 'safe', label: 'Recent activity', detail: 'No significant quakes in the past 7 days' });
    }
    factors.push({
      icon: dangerCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'safe',
      label: 'Recent activity (24h)',
      detail: recentCount + ' quake' + (recentCount !== 1 ? 's' : '') + ' in 24h' +
        (dangerCount > 0 ? ' (' + dangerCount + ' dangerous)' : '')
    });

    return { verdict, score, factors, nearestDist, strongestMag, dangerCount, warningCount };
  },

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
  },

  _renderAnalysisBreakdown(result) {
    const scoreColor = result.score >= 80 ? '#00b894' : result.score >= 50 ? '#fdcb6e' : '#e17055';
    const scoreEmoji = result.score >= 80 ? '🟢' : result.score >= 50 ? '🟡' : '🔴';
    const statusText = result.verdict === 'safe' ? 'Safe'
      : result.verdict === 'warning' ? 'Caution' : 'Danger';

    let html = '<div class="analysis-factor" style="padding: 12px 14px; margin-bottom: 4px;">' +
      '<div class="analysis-factor-icon ' + result.verdict + '" style="font-size: 18px;">' + scoreEmoji + '</div>' +
      '<div class="analysis-factor-text"><strong>Safety Score</strong><span>' + result.score + '% — <strong>' + statusText + '</strong></span></div></div>';

    html += '<div style="height: 10px; background: #dfe6e9; border-radius: 6px; margin: 0 14px 10px; overflow: hidden; border: 1.5px solid ' + (this.isDarkMode ? '#555' : '#2d3436') + ';">' +
      '<div style="height: 100%; width: ' + result.score + '%; background: ' + scoreColor + '; border-radius: 6px; transition: width .6s ease;"></div></div>';

    result.factors.forEach(f => {
      html += '<div class="analysis-factor">' +
        '<div class="analysis-factor-icon ' + f.icon + '">' +
          (f.icon === 'safe' ? '<i data-lucide="shield-check" style="width: 14px; height: 14px;"></i>' :
           f.icon === 'warning' ? '<i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i>' :
           '<i data-lucide="alert-octagon" style="width: 14px; height: 14px;"></i>') +
        '</div>' +
        '<div class="analysis-factor-text"><strong>' + f.label + '</strong><span>' + f.detail + '</span></div></div>';
    });
    return html;
  },
};
