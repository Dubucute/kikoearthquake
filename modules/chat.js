/**
 * Chat mixin — Ask Javi AI chat, chat head, message rendering.
 * Mixed into JaviAlertApp.prototype at startup.
 */
import { JAVI_MESSAGES } from '../messages.js';
import { timeSince } from '../api-utils.js';

export const chatMixin = {
  // ─── QUICK REPLY SUGGESTIONS ──────────────────────────────
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
  },

  // ─── CHAT MEMORY (localStorage) ──────────────────────────
  _loadChatMemory() {
    try {
      const saved = localStorage.getItem('javiChatMemory');
      if (saved) {
        const mem = JSON.parse(saved);
        if (mem && mem.timestamp && Date.now() - mem.timestamp < 3600000) {
          return mem;
        }
      }
    } catch (_) { /* ignore */ }
    return null;
  },

  _saveChatMemory(userMessage, aiReply) {
    try {
      const existing = this._loadChatMemory();
      const topics = existing ? existing.topics : [];
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
  },

  _loadChatHistory() {
    try {
      const saved = localStorage.getItem('javiChatHistory');
      const tsRaw = localStorage.getItem('javiChatHistoryTs');
      if (saved && tsRaw) {
        const ts = parseInt(tsRaw, 10);
        if (ts && Date.now() - ts > 86400000) {
          localStorage.removeItem('javiChatHistory');
          localStorage.removeItem('javiChatHistoryTs');
          return [];
        }
      }
      if (saved) {
        const msgs = JSON.parse(saved);
        if (Array.isArray(msgs) && msgs.length > 0) {
          return msgs;
        }
      }
    } catch (_) { /* ignore */ }
    return [];
  },

  _saveChatHistory() {
    try {
      const toSave = this.chatMessages.slice(-30);
      localStorage.setItem('javiChatHistory', JSON.stringify(toSave));
      localStorage.setItem('javiChatHistoryTs', String(Date.now()));
    } catch (_) { /* ignore */ }
  },

  // ─── LANGUAGE DETECTION ──────────────────────────────────
  _detectLanguage(text) {
    const t = text.toLowerCase();
    const cebuanoWords = ['unsa', 'kinsa', 'asa', 'kanus', 'ngano', 'tagpila', 'buntag', 'gabii',
      'adlaw', 'salamat', 'palihug', 'gwapa', 'gwapo', 'maayo', 'kini', 'kana', 'didto', 'dinhi',
      'siya', 'kami', 'og', 'ug', 'hala', 'mao', 'nya', 'bitaw', 'sige', 'lagi', 'kaayo',
      'unya', 'bali', 'imo', 'niya', 'namo', 'nila', 'kita', 'kamo', 'dili', 'wala'];
    const matchesCeb = cebuanoWords.filter(w => t.includes(w)).length;
    const tagalogWords = ['po', 'opo', 'sino', 'ano', 'bakit', 'paano', 'saan', 'kailan',
      'magkano', 'meron', 'mayroon', 'atin', 'amin', 'natin', 'sana', 'kasi', 'kaya', 'pero',
      'daw', 'raw', 'kung', 'ito', 'iyan', 'doon', 'dito', 'ganyan', 'ganoon', 'lang', 'din',
      'nyo', 'namin', 'ninyo', 'aming', 'inyo', 'kanila', 'kanya'];
    const matchesTl = tagalogWords.filter(w => t.includes(w)).length;
    if (matchesCeb >= matchesTl + 2 && matchesCeb >= 4) return 'ceb';
    if (matchesTl >= matchesCeb + 2 && matchesTl >= 4) return 'tl';
    return 'en';
  },

  _fallbackResponse() {
    const mood = this.currentMood || 'safe';
    const pool = JAVI_MESSAGES[mood] || JAVI_MESSAGES.safe;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  // ─── LOCK/UNLOCK BODY SCROLL ────────────────────────────
  _lockBodyScroll() {
    this._scrollPos = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + this._scrollPos + 'px';
    document.body.style.width = '100%';
  },

  _unlockBodyScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, this._scrollPos);
  },

  // ─── CHAT HEAD DRAG ──────────────────────────────────────
  _initChatHeadDrag() {
    const head = document.getElementById('chatHead');
    if (!head) return;
    const size = 56;
    const margin = 12;

    let savedPos = null;
    try { savedPos = JSON.parse(localStorage.getItem('javiChatHeadPos')); } catch (_) {}

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
      e.preventDefault();
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
        try { localStorage.setItem('javiChatHeadPos', JSON.stringify(savedPos)); } catch (_) {}
      } else if (!moved) {
        this._showChat();
      }
    };

    head.addEventListener('pointerdown', onPointerDown);
    head.addEventListener('pointermove', onPointerMove);
    head.addEventListener('pointerup', onPointerUp);
    head.addEventListener('pointercancel', onPointerUp);

    window.addEventListener('resize', () => {
      const x = parseInt(head.style.left, 10) || 0;
      const y = parseInt(head.style.top, 10) || 0;
      if (x + size > window.innerWidth - margin || y + size > window.innerHeight - margin) {
        const newX = Math.min(x, window.innerWidth - size - margin);
        const newY = Math.min(y, window.innerHeight - size - margin);
        head.style.left = Math.max(margin, newX) + 'px';
        head.style.top = Math.max(margin, newY) + 'px';
        savedPos = { x: parseInt(head.style.left, 10), y: parseInt(head.style.top, 10) };
        try { localStorage.setItem('javiChatHeadPos', JSON.stringify(savedPos)); } catch (_) {}
      }
    });
  },

  _updateChatHeadBadge() {
    const badge = document.getElementById('chatHeadBadge');
    if (!badge) return;
    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount > 99 ? '99+' : String(this.unreadCount);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  },

  _showChatHeadNotif(title, body) {
    const notif = document.getElementById('chatHeadNotif');
    const titleEl = document.getElementById('chatHeadNotifTitle');
    const bodyEl = document.getElementById('chatHeadNotifBody');
    if (!notif || !titleEl || !bodyEl) return;

    titleEl.textContent = title || 'Javi';
    bodyEl.textContent = body || '';

    notif.classList.remove('hidden');
    notif.classList.remove('chat-head-notif-left', 'chat-head-notif-right');
    void notif.offsetWidth;

    const head = document.getElementById('chatHead');
    if (head) {
      const rect = head.getBoundingClientRect();
      const headCenterX = rect.left + rect.width / 2;
      const showLeft = headCenterX > window.innerWidth / 2;
      notif.classList.add(showLeft ? 'chat-head-notif-left' : 'chat-head-notif-right');
    } else {
      notif.classList.add('chat-head-notif-left');
    }

    if (this._notifTimer) clearTimeout(this._notifTimer);
    this._notifTimer = setTimeout(() => {
      notif.classList.add('hidden');
    }, 5000);
  },

  _pushProactiveAlert(quake, alertType) {
    const mag = quake.mag.toFixed(1);
    const place = quake.place;
    const dist = quake.dist;
    const depth = quake.depth !== null ? quake.depth + ' km depth' : 'unknown depth';

    let advice = '';
    if (alertType === 'danger') {
      advice = '🚨 DANGER! ' + mag + ' magnitude earthquake near ' + place + ' (' + dist + ' km away, ' + depth + ')! DROP, COVER, and HOLD ON right now! Protect your head and stay under cover until the shaking stops.';
    } else if (alertType === 'warning') {
      advice = '⚠️ Warning! ' + mag + ' magnitude earthquake detected near ' + place + ' (' + dist + ' km away, ' + depth + '). Stay alert and be ready! Secure loose items and check your emergency kit.';
    }

    const chatMsg = advice + '\n\n' + (alertType === 'danger'
      ? 'Remember: Drop, Cover, and Hold On! 🛡️'
      : 'Stay safe and check your surroundings! 🙏');

    const lastMsgs = this.chatMessages.slice(-2).map(m => m.content).join(' ');
    if (!lastMsgs.includes(quake.id) && !lastMsgs.includes(mag + ' magnitude')) {
      this.chatMessages.push({ role: 'assistant', content: chatMsg, _quakeId: quake.id });
      this._saveChatHistory();

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
  },

  // ─── ASK JAVI — CHAT ─────────────────────────────────────
  _showChat() {
    const modal = document.getElementById('chatModal');
    if (!modal) return;

    this.unreadCount = 0;
    this._pendingClose = false;
    this._updateChatHeadBadge();

    const notif = document.getElementById('chatHeadNotif');
    if (notif) notif.classList.add('hidden');
    if (this._notifTimer) clearTimeout(this._notifTimer);

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

    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.scrollTop = 0;

    modal.classList.remove('hidden');
    this._lockBodyScroll();
    this._renderChatMessages();

    setTimeout(() => {
      const input = document.getElementById('chatInput');
      if (input) input.focus();
    }, 300);
  },

  async _sendChatMessage() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');
    const text = input ? input.value.trim() : '';
    if (!text || this.chatLoading) return;

    input.value = '';

    const detected = this._detectLanguage(text);
    if (detected !== 'en') {
      try { localStorage.setItem('javiLang', detected); } catch (_) {}
    }

    this.chatMessages.push({ role: 'user', content: text });
    this._renderChatMessages();

    const typing = document.getElementById('chatTyping');
    if (typing) typing.classList.remove('hidden');

    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;

    this.chatLoading = true;
    if (sendBtn) sendBtn.disabled = true;
    if (input) input.disabled = true;

    try {
      const quakeContext = this._buildQuakeContext();
      let streamEl = null;
      let hasReceivedToken = false;

      const response = await this._callHuggingFace(this.chatMessages, quakeContext, detected, (token, full) => {
        if (!hasReceivedToken) {
          hasReceivedToken = true;
          this.chatMessages.push({ role: 'assistant', content: '' });
          const container = document.getElementById('chatMessages');
          const div = document.createElement('div');
          div.className = 'chat-bubble chat-bubble-bot';
          div.innerHTML = '<div class="chat-avatar-wrap"><img class="chat-avatar" src="icons/javi-avatar.png" alt="Javi"></div><div class="chat-bubble-inner"></div>';
          const typingEl = document.getElementById('chatTyping');
          if (typingEl) {
            container.insertBefore(div, typingEl);
          } else {
            container.appendChild(div);
          }
          if (typing) typing.classList.add('hidden');
          streamEl = div.querySelector('.chat-bubble-inner');
        }
        if (streamEl) {
          streamEl.innerHTML = this._formatBotMessage(full);
        }
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      });

      if (hasReceivedToken) {
        this.chatMessages[this.chatMessages.length - 1].content = response;
        if (streamEl) {
          streamEl.innerHTML = this._formatBotMessage(response);
        }
        this._saveChatMemory(text, response);
        this._saveChatHistory();
      } else {
        if (typing) typing.classList.add('hidden');
      }

      const chatModal = document.getElementById('chatModal');
      const chatHidden = !chatModal || chatModal.classList.contains('hidden');
      if (chatHidden || this._pendingClose) {
        this.unreadCount++;
        this._updateChatHeadBadge();
        const preview = response.length > 80 ? response.slice(0, 80) + '…' : response;
        this._showChatHeadNotif('Javi replied', preview);
      }
      this._pendingClose = false;
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    } catch (err) {
      console.error('Chat error:', err);
      if (typing) typing.classList.add('hidden');

      const fallback = this._fallbackResponse();
      this.chatMessages.push({ role: 'assistant', content: fallback });
      this._renderChatMessages(true);
      this._saveChatMemory(text, fallback);
      this._saveChatHistory();

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
  },

  _buildQuakeContext() {
    const quakes = this.allQuakes || [];
    if (!quakes.length) return 'No recent earthquake data available.';

    const latest = quakes.reduce((a, b) => a.time > b.time ? a : b);
    const nearest = quakes.reduce((a, b) => a.dist < b.dist ? a : b);
    const strongest = quakes.reduce((a, b) => a.mag > b.mag ? a : b);

    const fmt = (q) =>
      (q.mag || 0).toFixed(1) + ' mag at ' + q.place +
      ' (' + q.dist + ' km ' + q.dir + ')' +
      (q.depth !== null ? ', depth ' + q.depth + ' km' : '') +
      ' - ' + timeSince(q.time);

    const significant = quakes.filter(q => q.mag >= 3).sort((a, b) => b.time - a.time);
    const quakeList = significant.length
      ? significant.map((q, i) => (i + 1) + '. ' + fmt(q)).join('\n')
      : 'None';

    return [
      'Latest earthquake: ' + fmt(latest),
      'Nearest earthquake: ' + fmt(nearest),
      'Strongest earthquake: ' + fmt(strongest),
      'Total earthquakes detected: ' + quakes.length,
      '',
      'Significant quakes (mag 3+):',
      quakeList,
    ].join('\n');
  },

  async _callHuggingFace(messages, quakeContext, detectedLang, onToken) {
    const res = await fetch('/api/ask-javi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, quakeContext, lang: detectedLang || 'en' })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'API returned ' + res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          try {
            const parsed = JSON.parse(data);
            if (parsed.done) return fullResponse;
            const token = parsed.token || '';
            if (token) {
              fullResponse += token;
              if (onToken) onToken(token, fullResponse);
            }
          } catch (_) {}
        }
      }
    }
    return fullResponse;
  },

  _renderChatMessages(animateLastBot) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (!this.chatMessages.length) {
      container.innerHTML = '' +
        '<div class="chat-bubble chat-bubble-bot chat-welcome" id="chatWelcome">' +
          '<div class="chat-avatar-wrap"><img class="chat-avatar" src="icons/javi-avatar.png" alt="Javi"></div>' +
          '<div class="chat-bubble-inner">👋 Hi! I\'m Javi, your earthquake safety buddy. Ask me anything about earthquakes, safety tips, or preparedness!</div>' +
        '</div>' +
        '<div class="chat-bubble chat-bubble-bot chat-typing hidden" id="chatTyping">' +
          '<div class="chat-avatar-wrap"><img class="chat-avatar" src="icons/javi-avatar.png" alt="Javi"></div>' +
          '<div class="chat-typing-dots">' +
            '<div class="chat-typing-dot"></div>' +
            '<div class="chat-typing-dot"></div>' +
            '<div class="chat-typing-dot"></div>' +
          '</div>' +
        '</div>';
      return;
    }

    const typingEl = container.querySelector('#chatTyping');
    container.innerHTML = '';

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

    if (animateLastBot && lastIdx >= 0) {
      const lastMsg = this.chatMessages[lastIdx];
      if (lastMsg.role === 'assistant') {
        const div = document.createElement('div');
        div.className = 'chat-bubble chat-bubble-bot chat-bubble-typing';
        div.innerHTML = '<div class="chat-avatar-wrap"><img class="chat-avatar" src="icons/javi-avatar.png" alt="Javi"></div><div class="chat-bubble-inner" id="chatTypingText"></div>';
        container.appendChild(div);
        const textEl = document.getElementById('chatTypingText');
        const fullText = this._formatBotMessage(lastMsg.content);
        let idx = 0;
        const speed = 12;
        const type = () => {
          if (idx < fullText.length) {
            textEl.innerHTML = fullText.slice(0, idx + 1);
            idx++;
            setTimeout(type, speed);
          } else {
            div.classList.remove('chat-bubble-typing');
            this._addQuickReplies(container);
          }
        };
        type();
      }
    } else {
      const lastMsg = this.chatMessages[this.chatMessages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        this._addQuickReplies(container);
      }
    }

    if (!typingEl) {
      const typingDiv = document.createElement('div');
      typingDiv.className = 'chat-bubble chat-bubble-bot chat-typing hidden';
      typingDiv.id = 'chatTyping';
      typingDiv.innerHTML = '<div class="chat-avatar-wrap"><img class="chat-avatar" src="icons/javi-avatar.png" alt="Javi"></div>' +
        '<div class="chat-typing-dots"><div class="chat-typing-dot"></div><div class="chat-typing-dot"></div><div class="chat-typing-dot"></div></div>';
      container.appendChild(typingDiv);
    } else {
      container.appendChild(typingEl);
    }
  },

  _addQuickReplies(container) {
    const existing = container.querySelector('.chat-quick-replies');
    if (existing) existing.remove();
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
    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  },

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

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
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
    html = html.replace(/\n/g, '<br>');
    return html;
  },
};
