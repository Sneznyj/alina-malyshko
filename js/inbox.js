/* Ящик заявок: анкета с сайта шифруется прямо в браузере клиента открытым ключом Алины и уходит на сервер
   (адрес — content.js → api.url). Сервер хранит только шифр; прочитать анкету может только кабинет Алины.
   Схема: ECDH P-256 (одноразовый ключ клиента + ключ Алины) → HKDF-SHA256 → AES-256-GCM.
   Открытый ключ Алины — в js/locked/meta.js (api.pub), закрытый — там же, но зашифрован паролем кабинета.
   Загружается по требованию (UI.bindBooking), в кабинете — сразу. */
(function () {
  'use strict';
  const SITE = window.SITE || {};
  const INFO = new TextEncoder().encode('alina-inbox-v1');
  const b64u = (u8) => { let s = ''; for (const x of new Uint8Array(u8)) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
  const apiUrl = () => String((SITE.api || {}).url || '').replace(/\/+$/, '');
  const can = () => !!(window.crypto && crypto.subtle && window.fetch && apiUrl());

  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('load ' + src)); document.body.appendChild(s); }); }
  async function meta() {
    if (window.Admin && window.Admin.meta) return window.Admin.meta();
    if (!window.LOCKED_META) await loadScript('js/locked/meta.js?m=' + Math.floor(Date.now() / 60000));
    return window.LOCKED_META;
  }
  async function aesKey(priv, pubJwk, usage) {
    const pub = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: pubJwk.x, y: pubJwk.y, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256);
    const hk = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: INFO }, hk, { name: 'AES-GCM', length: 256 }, false, [usage]);
  }
  /** Короткий номер анкеты: 5 знаков без похожих букв (для сверки с сообщением в Telegram). */
  function code() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(5); crypto.getRandomValues(a);
    return Array.from(a, (x) => A[x % 32]).join('');
  }
  /** Зашифровать и отправить. payload — любой JSON. → { ok, id } или бросает ошибку (тогда сайт предложит Telegram). */
  async function send(payload, opts) {
    opts = opts || {};
    if (!can()) throw new Error('no-api');
    const m = await meta();
    if (!m || !m.api || !m.api.pub) throw new Error('no-key');
    const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const epk = await crypto.subtle.exportKey('jwk', eph.publicKey);
    const key = await aesKey(eph.privateKey, m.api.pub, 'encrypt');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
    const ctl = window.AbortController ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), opts.timeout || 9000);
    try {
      const r = await fetch(apiUrl() + '/v1/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: 1, kid: m.api.kid || 1, epk: { x: epk.x, y: epk.y }, iv: b64u(iv), ct: b64u(ct), hp: opts.hp || '' }), signal: ctl ? ctl.signal : undefined, mode: 'cors', credentials: 'omit' });
      if (!r.ok) throw new Error('http ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }
  /** Расшифровать анкету из ящика (кабинет): body — то, что вернул сервер, priv — закрытый ключ Алины (Admin.api()). */
  async function open(body, priv) {
    const key = await aesKey(priv, body.epk, 'decrypt');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(body.iv) }, key, unb64u(body.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }
  window.Inbox = { send, open, code, can, apiUrl, b64u, unb64u };
})();
