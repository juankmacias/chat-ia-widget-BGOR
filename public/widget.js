(function () {
  'use strict';

  const CONFIG = {
    apiUrl: window.CHAT_WIDGET_API_URL || '/api/chat',
    botName: window.CHAT_WIDGET_BOT_NAME || 'Asesor BGOR',
    botAvatar: window.CHAT_WIDGET_BOT_AVATAR || '/media/image/asesor-bgor.png',
    welcomeMessage:
      window.CHAT_WIDGET_WELCOME || 'Hola, soy el asesor de IA de BGOR 😊. ¿En qué te puedo ayudar?',
    whatsappNumber: window.CHAT_WIDGET_WHATSAPP || '573209216434',
  };

  function getSessionId() {
    let id = localStorage.getItem('chat_widget_session');
    if (!id) {
      id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('chat_widget_session', id);
    }
    return id;
  }

  function timeNow() {
    const d = new Date();
    return d.getHours().toString().padStart(2, '0') + ':' +
           d.getMinutes().toString().padStart(2, '0');
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  }

  function buildWidget() {
    const root = el('div', 'chat-widget');

    // Botón flotante
    const btn = el('button', 'chat-widget__button');
    btn.setAttribute('aria-label', 'Abrir chat');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

    // Ventana
    const win = el('div', 'chat-widget__window');

    // Header
    const header = el('div', 'chat-widget__header');
    const avatar = el('div', 'chat-widget__avatar');
    avatar.style.backgroundImage = 'url(' + CONFIG.botAvatar + ')';
    const info = el('div', 'chat-widget__header-info');
    info.appendChild(el('div', 'chat-widget__name', CONFIG.botName));
    info.appendChild(el('div', 'chat-widget__status', 'en línea'));
    const closeBtn = el('button', 'chat-widget__close', '×');
    closeBtn.setAttribute('aria-label', 'Cerrar chat');
    header.appendChild(avatar);
    header.appendChild(info);
    header.appendChild(closeBtn);

    // Body
    const body = el('div', 'chat-widget__body');

    // Footer
    const footer = el('div', 'chat-widget__footer');
    const input = el('textarea', 'chat-widget__input');
    input.placeholder = 'Escribe un mensaje...';
    input.rows = 1;
    const sendBtn = el('button', 'chat-widget__send');
    sendBtn.setAttribute('aria-label', 'Enviar');
    sendBtn.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    footer.appendChild(input);
    footer.appendChild(sendBtn);

    win.appendChild(header);
    win.appendChild(body);
    win.appendChild(footer);
    root.appendChild(win);
    root.appendChild(btn);
    document.body.appendChild(root);

    return { root, btn, win, body, input, sendBtn, closeBtn };
  }

  function addMessage(body, role, text) {
    const msg = el('div', 'chat-widget__msg chat-widget__msg--' + role);
    msg.textContent = text;
    const time = el('div', 'chat-widget__time', timeNow());
    msg.appendChild(time);
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
    return msg;
  }

  const MEDIA_REGEX = /\[\[(audio|image|video):([a-z0-9-]+)\]\]/g;
  const TOKEN_REGEX = /\[\[(audio|image|video):([a-z0-9-]+)\]\]|\[\[split\]\]/gi;

  function parseResponse(text) {
    const tokens = [];
    let lastIndex = 0;
    let match;
    TOKEN_REGEX.lastIndex = 0;
    while ((match = TOKEN_REGEX.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index).replace(/\s+/g, ' ').trim();
      if (before) tokens.push({ type: 'text', content: before });
      if (match[1]) {
        tokens.push({ type: 'media', mediaType: match[1].toLowerCase(), slug: match[2] });
      }
      lastIndex = match.index + match[0].length;
    }
    const tail = text.slice(lastIndex).replace(/\s+/g, ' ').trim();
    if (tail) tokens.push({ type: 'text', content: tail });
    return tokens;
  }

  const WAVEFORM_BARS = 32;
  const ICON_PLAY = '<svg viewBox="0 0 16 16"><polygon points="4,3 13,8 4,13"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 16 16"><rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/></svg>';
  const ICON_MIC = '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z"/></svg>';

  function waveformHeights(slug) {
    let seed = 0;
    for (let i = 0; i < slug.length; i++) seed = (seed * 31 + slug.charCodeAt(i)) | 0;
    const heights = [];
    for (let i = 0; i < WAVEFORM_BARS; i++) {
      const v = Math.abs(Math.sin((seed + i * 137) * 0.0173));
      heights.push(0.25 + 0.75 * v);
    }
    return heights;
  }

  function formatTime(secs) {
    if (!isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m + ':' + s.toString().padStart(2, '0');
  }

  function buildVoiceNote(url, slug) {
    const wrap = el('div', 'chat-widget__voice');

    const avatar = el('div', 'chat-widget__voice-avatar');
    avatar.style.backgroundImage = 'url(' + CONFIG.botAvatar + ')';
    const mic = el('div', 'chat-widget__voice-mic');
    mic.innerHTML = ICON_MIC;
    avatar.appendChild(mic);
    wrap.appendChild(avatar);

    const playBtn = el('button', 'chat-widget__voice-play');
    playBtn.setAttribute('aria-label', 'Reproducir');
    playBtn.innerHTML = ICON_PLAY;
    wrap.appendChild(playBtn);

    const right = el('div', 'chat-widget__voice-right');
    const waveform = el('div', 'chat-widget__voice-waveform');
    const heights = waveformHeights(slug);
    const bars = heights.map((h) => {
      const bar = el('div', 'chat-widget__voice-bar');
      bar.style.height = (h * 100) + '%';
      waveform.appendChild(bar);
      return bar;
    });
    right.appendChild(waveform);
    const time = el('div', 'chat-widget__voice-time', '0:00');
    right.appendChild(time);
    wrap.appendChild(right);

    const audio = el('audio');
    audio.src = url;
    audio.preload = 'metadata';
    wrap.appendChild(audio);

    let playing = false;
    audio.addEventListener('loadedmetadata', () => {
      time.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('timeupdate', () => {
      const progress = audio.currentTime / (audio.duration || 1);
      bars.forEach((bar, i) => {
        bar.classList.toggle('chat-widget__voice-bar--played', i / bars.length < progress);
      });
      time.textContent = formatTime(audio.duration - audio.currentTime);
    });
    audio.addEventListener('ended', () => {
      playing = false;
      playBtn.innerHTML = ICON_PLAY;
      bars.forEach((b) => b.classList.remove('chat-widget__voice-bar--played'));
      time.textContent = formatTime(audio.duration);
    });
    playBtn.addEventListener('click', () => {
      if (playing) {
        audio.pause();
        playing = false;
        playBtn.innerHTML = ICON_PLAY;
      } else {
        audio.play();
        playing = true;
        playBtn.innerHTML = ICON_PAUSE;
      }
    });

    waveform.addEventListener('click', (e) => {
      if (!isFinite(audio.duration)) return;
      const rect = waveform.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audio.duration;
    });

    return wrap;
  }

  function addMediaMessage(body, role, type, slug) {
    const url = '/media/' + type + '/' + slug;
    if (type === 'audio') {
      const msg = el('div', 'chat-widget__msg chat-widget__msg--' + role + ' chat-widget__msg--voice');
      msg.appendChild(buildVoiceNote(url, slug));
      body.appendChild(msg);
      body.scrollTop = body.scrollHeight;
      return;
    }
    const msg = el('div', 'chat-widget__msg chat-widget__msg--' + role + ' chat-widget__msg--media');
    let media;
    if (type === 'image') {
      media = el('img', 'chat-widget__image');
      media.src = url;
      media.loading = 'lazy';
      media.alt = slug;
    } else if (type === 'video') {
      media = el('video', 'chat-widget__video');
      media.controls = true;
      media.preload = 'metadata';
      media.src = url;
    }
    msg.appendChild(media);
    const time = el('div', 'chat-widget__time', timeNow());
    msg.appendChild(time);
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function addBotResponse(ui, text) {
    const body = ui.body;
    const tokens = parseResponse(text);

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (i > 0) {
        const typing = showTyping(body);
        const delay = t.type === 'text'
          ? 600 + Math.min(t.content.length * 18, 1400)
          : 800;
        await sleep(delay);
        typing.remove();
      }
      if (t.type === 'text') {
        addMessage(body, 'bot', t.content);
      } else {
        addMediaMessage(body, 'bot', t.mediaType, t.slug);
      }
    }
  }

  function addWhatsappCta(body) {
    const msg = el('div', 'chat-widget__msg chat-widget__msg--bot chat-widget__msg--cta');
    const link = document.createElement('a');
    link.className = 'chat-widget__wa-cta';
    link.href = 'https://wa.me/' + CONFIG.whatsappNumber;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Abrir WhatsApp con un asesor humano');
    link.innerHTML =
      '<svg viewBox="0 0 24 24" class="chat-widget__wa-cta-icon"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>' +
      '<span class="chat-widget__wa-cta-label">Haz click aquí para continuar el chat</span>';
    msg.appendChild(link);
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  function showTyping(body) {
    const typing = el('div', 'chat-widget__typing');
    typing.appendChild(el('span'));
    typing.appendChild(el('span'));
    typing.appendChild(el('span'));
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;
    return typing;
  }

  async function sendToBackend(message, sessionId) {
    const res = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error en el servidor');
    }
    return res.json();
  }

  function init() {
    const ui = buildWidget();
    const sessionId = getSessionId();
    let isOpen = false;
    let isSending = false;
    let isLocked = false;

    function lockChat() {
      isLocked = true;
      ui.input.value = '';
      ui.input.placeholder = '';
      ui.input.disabled = true;
      ui.sendBtn.disabled = true;
    }

    // Mensaje de bienvenida
    addMessage(ui.body, 'bot', CONFIG.welcomeMessage);

    function toggleWindow(open) {
      isOpen = open;
      ui.win.classList.toggle('chat-widget__window--open', open);
      if (open) setTimeout(() => ui.input.focus(), 100);
    }

    ui.btn.addEventListener('click', () => toggleWindow(!isOpen));
    ui.closeBtn.addEventListener('click', () => toggleWindow(false));

    // API pública para abrir/cerrar el chat desde la página (botones, CTAs)
    window.ChatWidgetOpen = () => toggleWindow(true);
    window.ChatWidgetClose = () => toggleWindow(false);
    window.ChatWidgetToggle = () => toggleWindow(!isOpen);

    // Autoexpandir textarea
    ui.input.addEventListener('input', () => {
      ui.input.style.height = 'auto';
      ui.input.style.height = Math.min(ui.input.scrollHeight, 100) + 'px';
    });

    async function send() {
      const text = ui.input.value.trim();
      if (!text || isSending || isLocked) return;

      isSending = true;
      ui.sendBtn.disabled = true;
      ui.input.value = '';
      ui.input.style.height = 'auto';

      addMessage(ui.body, 'user', text);
      const typing = showTyping(ui.body);

      try {
        const data = await sendToBackend(text, sessionId);
        typing.remove();
        await addBotResponse(ui, data.reply);
        if (data.limit_reached) {
          const t2 = showTyping(ui.body);
          await sleep(900);
          t2.remove();
          addMessage(ui.body, 'bot', 'Dale click al ícono y te redirijo a un asesor humano para que te atienda 😊');
          await sleep(400);
          addWhatsappCta(ui.body);
          lockChat();
        }
      } catch (err) {
        typing.remove();
        addMessage(ui.body, 'bot', 'Ups, algo falló 😅. Pero no te preocupes, escríbenos directamente al WhatsApp 573209216434 y te atendemos de una.');
        console.error('[chat-widget]', err);
      } finally {
        isSending = false;
        if (!isLocked) ui.sendBtn.disabled = false;
        if (!isLocked) ui.input.focus();
      }
    }

    ui.sendBtn.addEventListener('click', send);
    ui.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
