/* Вход Алины: кабинет, личный прогноз и подробная совместимость открываются только по паролю.
   Код этих разделов лежит на сайте зашифрованным (js/locked/*, собирает _dev/lock.js): пароль превращается в ключ
   (PBKDF2-SHA256 → AES-256-GCM), ключ расшифровывает код прямо в браузере. Без пароля код не прочитать.
   «Запомнить на этом устройстве» хранит ключ (не пароль) в localStorage, иначе — до закрытия вкладки. */
(function () {
  'use strict';
  const STORE = 'am_adminKey';
  const UI = window.UI;
  const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const b64e = (u8) => { let s = ''; for (const x of u8) s += String.fromCharCode(x); return btoa(s); };
  let cached = null;
  const ran = {};

  const stored = () => { try { return localStorage.getItem(STORE) || sessionStorage.getItem(STORE); } catch (e) { return null; } };
  function save(raw, remember) { try { (remember ? localStorage : sessionStorage).setItem(STORE, raw); } catch (e) { /* приватный режим */ } }
  function clear() { cached = null; try { localStorage.removeItem(STORE); sessionStorage.removeItem(STORE); } catch (e) { /* нет */ } }
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
  /** Расшифровать и запустить разделы по порядку. */
  async function run(names) {
    const k = await key();
    if (!k) throw new Error('locked');
    const m = await meta();
    for (const n of names) {
      if (ran[n]) continue;
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

  window.Admin = { has: () => !!stored(), key, login, logout, run, page };
})();
