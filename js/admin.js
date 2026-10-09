/* Вход Алины и закрытый код сайта.
   Код кабинета лежит на сайте зашифрованным (js/locked/*, собирает _dev/lock.js): пароль превращается в ключ
   (PBKDF2-SHA256 → AES-256-GCM), ключ расшифровывает код прямо в браузере. Без пароля код не прочитать.
   «Запомнить на этом устройстве» хранит ключ (не пароль) в localStorage, иначе — до закрытия вкладки.
   Премиум-разделы (прогноз, подробная совместимость, полная натальная карта, нумерология-прогноз) зашифрованы
   отдельным ключом доступа: Алине он достаётся из meta по её ключу (ей открыто всё), клиентам — из кода доступа (js/premium.js). */
(function () {
  'use strict';
  const STORE = 'am_adminKey';
  const UI = window.UI;
  const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const b64e = (u8) => { let s = ''; for (const x of u8) s += String.fromCharCode(x); return btoa(s); };
  let cached = null, cachedP = null, cachedS = null, cachedA = null;
  const ran = {};

  const stored = () => { try { return localStorage.getItem(STORE) || sessionStorage.getItem(STORE); } catch (e) { return null; } };
  function save(raw, remember) { try { (remember ? localStorage : sessionStorage).setItem(STORE, raw); } catch (e) { /* приватный режим */ } }
  function clear() { cached = null; cachedP = null; cachedS = null; cachedA = null; try { localStorage.removeItem(STORE); sessionStorage.removeItem(STORE); } catch (e) { /* нет */ } }
  const canCrypto = () => !!(window.crypto && crypto.subtle);

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('load ' + src)); document.body.appendChild(s); });
  }
  async function meta() {
    // минута в адресе — чтобы после смены пароля браузер не держал старые параметры дольше минуты
    if (!window.LOCKED_META) await loadScript('js/locked/meta.js?m=' + Math.floor(Date.now() / 60000));
    return window.LOCKED_META;
  }
  async function decrypt(key, blob) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, key, b64d(blob.ct));
    return new TextDecoder().decode(pt);
  }
  /** Ключ из памяти устройства, проверенный (после смены пароля старый ключ не подойдёт — тогда вход заново). */
  async function key() {
    if (cached) return cached;
    const raw = stored();
    if (!raw || !canCrypto()) return null;
    try {
      const m = await meta();
      const k = await crypto.subtle.importKey('raw', b64d(raw), 'AES-GCM', false, ['decrypt']);
      await decrypt(k, m.check);
      return (cached = k);
    } catch (e) { clear(); return null; }
  }
  async function login(password, remember) {
    const m = await meta();
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(password).trim().normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64d(m.salt), iterations: m.iter, hash: 'SHA-256' }, base, 256));
    const k = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt']);
    try { await decrypt(k, m.check); } catch (e) { return false; }
    save(b64e(bits), remember);
    cached = k;
    return true;
  }
  async function exec(code, name) {
    const url = URL.createObjectURL(new Blob([code + '\n//# sourceURL=locked/' + name + '.js'], { type: 'text/javascript' }));
    try { await loadScript(url); } catch (e) { new Function(code)(); } finally { URL.revokeObjectURL(url); }
  }
  // ---------- премиум: ключ доступа и ключ подписи кодов — для Алины лежат в meta, зашифрованные её ключом ----------
  const isPremium = (m, n) => !!(m.premium && (m.premium.names || []).includes(n));
  /** Ключ премиум-разделов по входу Алины (или null). */
  async function premiumKey() {
    if (cachedP) return cachedP;
    const k = await key();
    if (!k) return null;
    const m = await meta();
    if (!m.premium) return null;
    try { cachedP = await crypto.subtle.importKey('raw', b64d(await decrypt(k, m.premium.wrapK)), 'AES-GCM', false, ['decrypt']); } catch (e) { return null; }
    return cachedP;
  }
  /** Ключ подписи кодов доступа — только у Алины (кабинет → «Доступы»). */
  async function signKey() {
    if (cachedS) return cachedS;
    const k = await key();
    if (!k) return null;
    const m = await meta();
    if (!m.premium) return null;
    const jwk = JSON.parse(await decrypt(k, m.premium.wrapS));
    cachedS = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    return cachedS;
  }
  /** Ящик заявок и облако — только у Алины: адрес сервера, токен, закрытый ключ анкет, ключ облака (или null). */
  async function api() {
    if (cachedA) return cachedA;
    const k = await key();
    if (!k) return null;
    const m = await meta();
    if (!m.api || !(window.SITE && window.SITE.api && window.SITE.api.url)) return null;
    try {
      const jwk = JSON.parse(await decrypt(k, m.api.wrapD));
      const priv = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
      const vault = await crypto.subtle.importKey('raw', b64d(await decrypt(k, m.api.wrapV)), 'AES-GCM', false, ['encrypt', 'decrypt']);
      cachedA = { url: String(window.SITE.api.url).replace(/\/+$/, ''), token: await decrypt(k, m.api.wrapT), priv, vault, kid: m.api.kid };
    } catch (e) { console.error(e); return null; }
    return cachedA;
  }
  /** Ключ для раздела: премиум — у Алины или по коду доступа (js/premium.js), остальное — только у Алины. */
  async function keyFor(m, n) {
    if (!isPremium(m, n)) return key();
    return (await premiumKey()) || (window.Premium && window.Premium.contentKey ? await window.Premium.contentKey() : null);
  }
  /** Расшифровать и запустить разделы по порядку. */
  async function run(names) {
    const m = await meta();
    for (const n of names) {
      if (ran[n]) continue;
      const k = await keyFor(m, n);
      if (!k) throw new Error('locked');
      if (!(window.LOCKED || {})[n]) await loadScript(`js/locked/${n}.js?v=${(m.v || {})[n] || ''}`);
      await exec(await decrypt(k, window.LOCKED[n]), n);
      ran[n] = true;
    }
  }
  function logout() { clear(); location.reload(); }

  /**
   * Закрытая страница. opts: names — что запустить; hide — блоки страницы, видимые только после входа;
   * title, text — заголовок формы; visitor — что показать посетителям (например, запись на прогноз), форма тогда свёрнута.
   */
  async function page(opts) {
    const hidden = Array.from(document.querySelectorAll(opts.hide || '[data-private]'));
    const open = async () => { hidden.forEach((el) => { el.hidden = false; }); await run(opts.names); document.documentElement.classList.add('is-alina'); };
    if (await key()) { try { await open(); return; } catch (e) { console.error(e); } }
    const icon = UI.icon, esc = UI.esc;
    const box = document.createElement('section');
    box.className = 'section admin-lock';
    const form = `<form class="form lock-form" novalidate>
        <input type="text" name="username" autocomplete="username" value="alina" hidden>
        <div class="field"><label for="lockPw">Пароль</label>
          <div class="pw-wrap"><input class="input" id="lockPw" name="password" type="password" autocomplete="current-password" required spellcheck="false">
          <button class="pw-eye" type="button" aria-label="Показать пароль" aria-pressed="false">${icon('eye')}</button></div></div>
        <label class="check"><input type="checkbox" id="lockRemember" checked> <span>Запомнить на этом устройстве</span></label>
        <button class="btn btn-primary btn-block" type="submit">${icon('key')} Войти</button>
        <p class="lock-err small center" role="alert"></p>
      </form>`;
    box.innerHTML = `<div class="container"><div class="card lock-card">
        <span class="lock-ic">${icon('lock')}</span>
        <h1>${esc(opts.title || 'Кабинет астролога')}</h1>
        <p class="muted">${opts.text || 'Рабочее место Алины. Вход по паролю.'}</p>
        ${opts.visitor ? `${opts.visitor}<details class="details-adv lock-alina"><summary>Вход для Алины</summary>${form}</details>` : form}
      </div></div>`;
    (document.getElementById('main') || document.body).prepend(box);
    if (!canCrypto()) { box.querySelector('.lock-err').textContent = 'Этот браузер не умеет открывать закрытые разделы — откройте сайт в Chrome, Safari или Firefox.'; return; }
    const f = box.querySelector('form'), pw = box.querySelector('#lockPw'), err = box.querySelector('.lock-err'), btn = f.querySelector('[type=submit]');
    box.querySelector('.pw-eye').addEventListener('click', (e) => { const on = pw.type === 'password'; pw.type = on ? 'text' : 'password'; e.currentTarget.setAttribute('aria-pressed', String(on)); e.currentTarget.setAttribute('aria-label', on ? 'Скрыть пароль' : 'Показать пароль'); pw.focus(); });
    pw.addEventListener('input', () => { err.textContent = ''; pw.classList.remove('invalid'); });
    if (!opts.visitor) setTimeout(() => pw.focus(), 80);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!pw.value.trim()) { pw.classList.add('invalid'); pw.focus(); return; }
      btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = `${icon('refresh')} Проверяю…`;
      let ok = false;
      try { ok = await login(pw.value, box.querySelector('#lockRemember').checked); } catch (er) { console.error(er); }
      btn.disabled = false; btn.innerHTML = label;
      if (!ok) {
        err.textContent = 'Пароль не подошёл. Проверьте раскладку и Caps Lock.';
        pw.classList.add('invalid'); pw.select();
        if (box.animate && !UI.reduceMotion()) box.querySelector('.lock-card').animate({ translate: ['0', '-8px', '8px', '-4px', '0'] }, { duration: 320 });
        return;
      }
      box.remove();
      try { await open(); UI.toast('Добро пожаловать, Алина ✦', 'sparkle'); } catch (er) { console.error(er); UI.toast('Не получилось открыть раздел — обновите страницу', 'info'); }
    });
  }

  window.Admin = { has: () => !!stored(), key, login, logout, run, page, meta, decrypt, premiumKey, signKey, canCrypto, api };

  // Алине на страницах сайта (не в кабинете): в ящике есть новые анкеты — тихая плашка «в кабинет»
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (!stored() || /cabinet\.html$/.test(location.pathname) || window.ARTIFACT_PREVIEW) return;
      const url = ((window.SITE || {}).api || {}).url;
      if (!url || (UI.isPreview && !(UI.localApi && UI.localApi(url)))) return;
      const a = await api(); if (!a) return;
      const r = await fetch(a.url + '/v1/count', { headers: { Authorization: 'Bearer ' + a.token }, cache: 'no-store' });
      if (!r.ok) return;
      const n = (await r.json()).inbox;
      if (!n) return;
      const el = document.createElement('a');
      el.className = 'inbox-chip'; el.href = 'cabinet.html#requests';
      el.innerHTML = `${UI.icon('inbox')}<span>${n === 1 ? 'Новая анкета' : 'Новых анкет: ' + n} — в кабинет</span>`;
      document.body.appendChild(el);
      if (UI.fadeIn) UI.fadeIn(el, 6);
    } catch (e) { /* без сети — ничего не показываем */ }
  });
})();
