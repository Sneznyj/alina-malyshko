/* Общий интерфейс сайта: шапка, подвал, тема, звёзды, формы, город, запись, хранилище. */
(function () {
  'use strict';
  const SITE = window.SITE, T = window.ASTRO_TEXTS, AC = window.AstroCore;

  // ---------- иконки ----------
  const ICONS = window.ICONS || {}, ICONS_F = window.ICONS_FILLED || {};
  const icon = (n, cls) => (ICONS_F[n]
    ? `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS_F[n]}</svg>`
    : `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`);

  // ---------- хранилище (безопасно: в приватном режиме может не работать) ----------
  const store = {
    get(k, def) { try { const v = localStorage.getItem('am_' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem('am_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem('am_' + k); } catch (e) { /* ничего */ } },
  };

  const settings = Object.assign({ houseSystem: 'placidus', meanNode: false, minor: false, orbMult: 1 }, store.get('settings', {}));
  function saveSettings(s) { Object.assign(settings, s); store.set('settings', settings); }

  // ---------- формат ----------
  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const DOW_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = {
    date: (d) => `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`,
    dateShort: (d) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`,
    dm: (d) => `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`,
    time: (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    dateTime: (d) => `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    dmTime: (d) => `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    ymd: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    birth: (p) => `${p.d} ${MONTHS_GEN[p.mo - 1]} ${p.y}` + (p.timeKnown !== false ? `, ${pad(p.h)}:${pad(p.mi)}` : ', время неизвестно'),
    money: (n) => (n ? n.toLocaleString('ru-RU') + ' ' + (SITE.currency || '₽') : ''),
    plural: (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; },
    deg: (lon) => AC.fmtDeg(lon),
    pos: (lon) => `${AC.fmtDeg(lon)} ${T.signs[AC.signOf(lon)].glyph}`,
    posText: (lon) => `${AC.fmtDeg(lon)} ${T.signs[AC.signOf(lon)].loc}`,
    MONTHS, MONTHS_GEN, MONTHS_SHORT, DOW, DOW_LONG, pad,
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const glyph = (id) => (T.planets[id] ? T.planets[id].glyph : T.signs[id] ? T.signs[id].glyph : '');
  const pname = (id) => (T.planets[id] ? T.planets[id].name : id);

  // ---------- движение ----------
  const reduceMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)', EASE_IN_OUT = 'cubic-bezier(.4,0,.2,1)';
  /** Мягкое появление блока после смены содержимого (урок, знак, день календаря, раздел кабинета). */
  function fadeIn(el, dy) {
    if (!el || !el.animate || reduceMotion()) return;
    el.animate({ opacity: [0, 1], translate: ['0 ' + (dy == null ? 10 : dy) + 'px', '0 0'] }, { duration: 460, easing: EASE_OUT });
  }

  // ---------- тема ----------
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    store.set('theme', t);
    $$('.theme-toggle').forEach((b) => { b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon'); b.setAttribute('aria-label', t === 'dark' ? 'Светлая тема' : 'Ночная тема'); });
    document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  }
  const savedTheme = store.get('theme', null);
  let sysDark = false;
  try { sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { /* нет */ }
  document.documentElement.setAttribute('data-theme', savedTheme || (sysDark ? 'dark' : 'light'));
  /** Переключение темы: новая тема раскрывается кругом от кнопки; без View Transitions — плавно перетекает. */
  function switchTheme(btn) {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    if (reduceMotion()) { applyTheme(next); return; }
    if (document.startViewTransition && root.animate) {
      const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const rad = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.classList.add('theme-vt');
      try {
        const vt = document.startViewTransition(() => applyTheme(next));
        vt.ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] }, { duration: 720, easing: EASE_IN_OUT, pseudoElement: '::view-transition-new(root)' })).catch(() => {});
        vt.finished.catch(() => {}).then(() => root.classList.remove('theme-vt'));
        return;
      } catch (e) { root.classList.remove('theme-vt'); }
    }
    root.classList.add('theme-fade');
    applyTheme(next);
    setTimeout(() => root.classList.remove('theme-fade'), 560);
  }

  // ---------- шапка и подвал ----------
  const TOOLS = [
    ['natal.html', 'Натальная карта', 'planet', 'ваша карта рождения'],
    ['synastry.html', 'Совместимость', 'heart-handshake', 'синастрия пары'],
    ['forecast.html', 'Личный прогноз', 'crystal-ball', 'транзиты, соляр'],
    ['horoscope.html', 'Гороскоп', 'sparkle', 'на сегодня и месяц'],
    ['moon.html', 'Лунный календарь', 'moon-stars', 'лунные сутки'],
    ['sky.html', 'Астрособытия', 'telescope', 'ретро, затмения'],
  ];
  const NAV = TOOLS.concat([['academy.html', 'Уроки', 'school', 'мини-курс']]);
  const isPreview = !!SITE.draft || location.protocol === 'file:' || /^(localhost|127\.|192\.168\.|\[::1\])/.test(location.hostname);

  /** Действующая акция или null (после даты окончания — исчезает сама). */
  function promoInfo() {
    const p = SITE.promo;
    if (!p || !p.enabled || !p.until) return null;
    const end = new Date(p.until + 'T23:59:59');
    const now = new Date();
    if (isNaN(end) || now > end) return null;
    return Object.assign({}, p, { end, days: Math.max(1, Math.ceil((end - now) / 86400000)) });
  }
  // ---------- валюта по стране посетителя (по часовому поясу браузера) ----------
  const CUR = SITE.currencies || { RUB: SITE.currency || '₽' };
  const browserTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } })();
  function currencyForZone(tz) {
    for (const [code, zones] of SITE.currencyRules || []) if (zones.some((z) => tz === z || (z.endsWith('/') && String(tz).startsWith(z)))) return code;
    return SITE.currencyFallback || 'RUB';
  }
  function currency() { const c = store.get('currency', null); return c && CUR[c] ? c : (CUR[currencyForZone(browserTz)] ? currencyForZone(browserTz) : 'RUB'); }
  function setCurrency(code) { if (!CUR[code]) return; store.set('currency', code); document.dispatchEvent(new CustomEvent('currencychange', { detail: code })); }
  const CUR_NAMES = { RUB: ['Рубли', 'рублях'], USD: ['Доллары', 'долларах'], EUR: ['Евро', 'евро'] };
  // любой элемент с data-cur (шапка, переключатель над ценами) меняет валюту
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-cur]');
    if (!b || b.dataset.cur === currency()) return;
    setCurrency(b.dataset.cur);
    if (b.closest('.cur-panel') && !document.getElementById('servicesGrid')) toast(`Цены на сайте — в ${(CUR_NAMES[b.dataset.cur] || ['', b.dataset.cur])[1]}`, 'money');
  });
  /** Цена объекта в текущей валюте: price — рубли, prices.USD / prices.EUR — другие валюты. Нет цены в валюте — рубли. */
  function priceOf(o, field) {
    const code = currency();
    const rub = +(o && o[field || 'price']) || 0;
    const other = o && o[field ? field + 'Prices' : 'prices'];
    if (code !== 'RUB' && other && other[code] != null) return { n: +other[code], code };
    return { n: rub, code: 'RUB' };
  }
  function money(n, code) { return n || n === 0 ? `${Math.round(n).toLocaleString('ru-RU')} ${CUR[code || currency()] || '₽'}` : ''; }

  /** Цена услуги с учётом акции (в текущей валюте). */
  function priceFor(svc) {
    const pr = promoInfo();
    const { n, code } = priceOf(svc);
    if (pr && n && (pr.services || []).includes(svc.id)) {
      const step = code === 'RUB' ? 100 : 1;
      return { now: Math.round((n * (1 - pr.percent / 100)) / step) * step, old: n, percent: pr.percent, code };
    }
    return { now: n, code };
  }
  const minPrice = () => Math.min(...SITE.services.filter((x) => x.price).map((x) => priceFor(x).now));
  /** Город по часовому поясу посетителя (для лунного календаря и «Неба сегодня»). */
  function cityForZone() {
    const def = CITIES.find((c) => c.name === SITE.defaultCity);
    if (def && def.tz === browserTz) return def;
    return CITIES.find((c) => c.tz === browserTz) || null;
  }

  function contactLinks() {
    const c = SITE.contacts || {};
    const out = [];
    if (c.telegram) out.push({ k: 'telegram', label: 'Telegram', href: 'https://t.me/' + c.telegram.replace(/^@/, '') });
    if (c.telegramChannel) out.push({ k: 'telegram', label: 'Telegram-канал', href: 'https://t.me/' + c.telegramChannel.replace(/^@/, '') });
    if (c.telegramBot) out.push({ k: 'message-heart', label: 'Telegram-бот: гороскоп и Луна дня', href: botHref('src_site') });
    if (c.whatsapp) out.push({ k: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/' + c.whatsapp.replace(/\D/g, '') });
    if (c.instagram) out.push({ k: 'instagram', label: 'Instagram', href: 'https://instagram.com/' + c.instagram.replace(/^@/, '') });
    if (c.tiktok) out.push({ k: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@' + c.tiktok.replace(/^@/, '') });
    if (c.vk) out.push({ k: 'vk', label: 'ВКонтакте', href: 'https://vk.com/' + c.vk });
    if (c.youtube) out.push({ k: 'youtube', label: 'YouTube', href: c.youtube });
    if (c.email) out.push({ k: 'mail', label: c.email, href: 'mailto:' + c.email });
    if (c.phone) out.push({ k: 'phone', label: c.phone, href: 'tel:' + c.phone.replace(/[^\d+]/g, '') });
    return out;
  }

  /** Ссылка на Telegram-бота Алины с меткой (start=src_site__natal и т. п.). Пусто, если бот не указан. */
  function botHref(payload) {
    const b = (SITE.contacts || {}).telegramBot;
    return b ? `https://t.me/${b.replace(/^@/, '')}${payload ? '?start=' + payload : ''}` : '';
  }
  /** Плашка «получать в Telegram» под инструментом. */
  function botCta(payload, text) {
    const href = botHref(payload);
    return href ? `<a class="bot-cta" href="${esc(href)}" target="_blank" rel="noopener">${icon('telegram')}<span>${text}</span><span class="arr">→</span></a>` : '';
  }

  // ---------- Яндекс Метрика (только на опубликованном сайте) ----------
  const metrikaId = SITE.analytics && String(SITE.analytics.metrikaId || '').trim();
  if (metrikaId && !isPreview && !window.ARTIFACT_PREVIEW) {
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = 1 * new Date();
    const s = document.createElement('script');
    s.async = true; s.src = 'https://mc.yandex.ru/metrika/tag.js';
    document.head.appendChild(s);
    window.ym(+metrikaId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }
  function goal(name) { try { if (metrikaId && window.ym) window.ym(+metrikaId, 'reachGoal', name); } catch (e) { /* без аналитики */ } }
  document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href^="https://t.me/"]'); if (a) goal('telegram'); });

  /** Записка от Алины с фото — для страниц-инструментов. */
  function alinaNote(text, cta) {
    return `<div class="alina-note"><img src="assets/img/alina-avatar.webp" alt="Алина" width="56" height="56" loading="lazy"><div class="bubble"><span class="note-who">Алина</span><p>${text}</p>${cta ? `<div class="row" style="gap:10px">${cta}</div>` : ''}</div></div>`;
  }

  function renderChrome() {
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const onTool = TOOLS.some(([h]) => h === page);
    const showCur = page !== 'cabinet.html' && Object.keys(CUR).length > 1;
    const pr = promoInfo();
    let closedPromo = false; try { closedPromo = sessionStorage.getItem('am_promo_closed') === '1'; } catch (e) { /* нет */ }
    if (pr && !closedPromo && page !== 'cabinet.html') {
      const bar = document.createElement('div');
      bar.className = 'promo-bar';
      bar.innerHTML = `<div class="container promo-inner">
          <span class="promo-flame">${icon('flame-filled')}</span>
          <span class="promo-text"><b>−${pr.percent}%</b> ${esc(pr.short)} <span class="promo-until">до ${pr.end.getDate()} ${fmt.MONTHS_GEN[pr.end.getMonth()]} · осталось ${pr.days} ${fmt.plural(pr.days, 'день', 'дня', 'дней')}</span></span>
          <button class="promo-btn" type="button" data-book>Записаться</button>
          <button class="promo-x" type="button" aria-label="Скрыть">${icon('close')}</button></div>`;
      document.body.prepend(bar);
      bar.querySelector('.promo-x').addEventListener('click', () => {
        try { sessionStorage.setItem('am_promo_closed', '1'); } catch (e) { /* нет */ }
        if (reduceMotion() || !bar.animate) { bar.remove(); return; }
        // полоса плавно складывается, страница не дёргается
        bar.style.overflow = 'hidden';
        bar.animate({ height: [bar.offsetHeight + 'px', '0px'], opacity: [1, 0] }, { duration: 420, easing: EASE_IN_OUT }).onfinish = () => bar.remove();
      });
    }
    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `
      <div class="container header-inner">
        <a class="brand" href="index.html" aria-label="${esc(SITE.name)} — на главную">
          <span class="brand-mark"><img src="assets/img/alina-avatar.webp" alt="" width="40" height="40"></span>
          <span><span class="brand-name">${esc(SITE.name)}</span><span class="brand-role">${esc(SITE.role)}</span></span>
        </a>
        <nav class="nav" aria-label="Основное меню">
          <a href="index.html#services">Консультации</a>
          <div class="nav-drop">
            <button type="button" class="nav-drop-btn${onTool ? ' active' : ''}" aria-expanded="false" aria-haspopup="true">Бесплатно ${icon('chevron-down', 'chev')}</button>
            <div class="nav-panel" role="menu">
              ${TOOLS.map(([h, t, ic, d]) => `<a role="menuitem" href="${h}"${page === h ? ' aria-current="page"' : ''}><span class="np-ic">${icon(ic)}</span><span><b>${t}</b><small>${d}</small></span></a>`).join('')}
            </div>
          </div>
          <a href="academy.html"${page === 'academy.html' ? ' aria-current="page"' : ''}>Уроки</a>
          <a href="index.html#about">Обо мне</a>
          <a href="index.html#reviews">Отзывы</a>
        </nav>
        <div class="header-actions">
          ${SITE.media && SITE.media.ambientSound ? `<button class="icon-btn sound-toggle" type="button" aria-pressed="false" aria-label="Включить фоновый звук" title="Фоновый звук">${icon('volume-off')}</button>` : ''}
          ${showCur ? `<div class="cur-drop">
            <button type="button" class="cur-btn" aria-haspopup="menu" aria-expanded="false" title="Валюта цен"><span class="cur-sign"></span><span class="cur-code"></span>${icon('chevron-down', 'chev')}</button>
            <div class="cur-panel" role="menu" aria-label="Валюта цен">
              <div class="cur-title">Показывать цены в</div>
              ${Object.keys(CUR).map((code) => `<button type="button" role="menuitemradio" aria-checked="false" data-cur="${code}" tabindex="-1"><span class="cs">${CUR[code]}</span><span>${(CUR_NAMES[code] || [code])[0]}</span>${icon('check', 'ck')}</button>`).join('')}
            </div>
          </div>` : ''}
          <button class="icon-btn theme-toggle" type="button"></button>
          <button class="btn btn-primary btn-sm" type="button" data-book>Записаться</button>
          <button class="icon-btn burger" type="button" aria-label="Меню" aria-expanded="false">${icon('menu')}</button>
        </div>
      </div>`;
    const promoBar = document.querySelector('.promo-bar');
    if (promoBar) promoBar.after(header); else document.body.prepend(header);
    const skip = document.createElement('a');
    skip.className = 'skip-link'; skip.href = '#main'; skip.textContent = 'К содержанию';
    document.body.prepend(skip);

    // фоновый звук — только по нажатию
    const snd = header.querySelector('.sound-toggle');
    if (snd) {
      let audio = null, fadeT = null;
      const set = (on) => { snd.setAttribute('aria-pressed', String(on)); snd.innerHTML = icon(on ? 'volume' : 'volume-off'); snd.setAttribute('aria-label', on ? 'Выключить фоновый звук' : 'Включить фоновый звук'); };
      snd.addEventListener('click', () => {
        const on = snd.getAttribute('aria-pressed') !== 'true';
        if (!audio) { audio = new Audio(SITE.media.ambientSound); audio.loop = true; audio.volume = 0; }
        clearInterval(fadeT);
        if (on) { audio.play().catch(() => set(false)); fadeT = setInterval(() => { audio.volume = Math.min(0.28, audio.volume + 0.02); if (audio.volume >= 0.28) clearInterval(fadeT); }, 80); }
        else { fadeT = setInterval(() => { audio.volume = Math.max(0, audio.volume - 0.03); if (audio.volume <= 0) { clearInterval(fadeT); audio.pause(); } }, 60); }
        set(on);
      });
    }

    const drop = header.querySelector('.nav-drop'), dropBtn = header.querySelector('.nav-drop-btn');
    const setDrop = (o) => { drop.classList.toggle('open', o); dropBtn.setAttribute('aria-expanded', String(o)); };
    dropBtn.addEventListener('click', (e) => { e.stopPropagation(); setDrop(!drop.classList.contains('open')); });
    document.addEventListener('click', (e) => { if (!drop.contains(e.target)) setDrop(false); });
    drop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setDrop(false); dropBtn.focus(); } });

    // валюта справа сверху
    const cur = header.querySelector('.cur-drop');
    if (cur) {
      const cBtn = cur.querySelector('.cur-btn'), opts = $$('[data-cur]', cur);
      const sync = () => {
        const c = currency();
        cur.querySelector('.cur-sign').textContent = CUR[c];
        cur.querySelector('.cur-code').textContent = c;
        cBtn.setAttribute('aria-label', `Валюта цен: ${(CUR_NAMES[c] || [c])[0].toLowerCase()}`);
        opts.forEach((o) => o.setAttribute('aria-checked', String(o.dataset.cur === c)));
      };
      const setCur = (o, focus) => {
        cur.classList.toggle('open', o); cBtn.setAttribute('aria-expanded', String(o));
        if (o && focus) (opts.find((x) => x.getAttribute('aria-checked') === 'true') || opts[0]).focus();
      };
      sync();
      document.addEventListener('currencychange', sync);
      cBtn.addEventListener('click', (e) => setCur(!cur.classList.contains('open'), e.detail === 0));
      document.addEventListener('click', (e) => { if (!cur.contains(e.target)) setCur(false); }, true);
      cur.querySelector('.cur-panel').addEventListener('click', (e) => { if (e.target.closest('[data-cur]')) { setCur(false); cBtn.focus(); } });
      cur.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { setCur(false); cBtn.focus(); return; }
        if (e.target === cBtn) { if (e.key === 'ArrowDown') { e.preventDefault(); setCur(true, true); } return; }
        const i = opts.indexOf(document.activeElement);
        if (i < 0) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); opts[(i + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length].focus(); }
        if (e.key === 'Tab') setCur(false);
      });
    }

    const mm = document.createElement('div');
    mm.className = 'mobile-menu'; mm.setAttribute('role', 'dialog'); mm.setAttribute('aria-label', 'Меню');
    mm.innerHTML = `
      <div class="close-row">
        <a class="brand" href="index.html"><span class="brand-mark"><img src="assets/img/alina-avatar.webp" alt="" width="40" height="40"></span><span class="brand-name">${esc(SITE.name)}</span></a>
        <button class="icon-btn" type="button" data-close-menu aria-label="Закрыть меню">${icon('close')}</button>
      </div>
      <nav class="mm-main">${[['index.html', 'Главная'], ['index.html#services', 'Консультации и цены'], ['index.html#about', 'Обо мне'], ['index.html#reviews', 'Отзывы'], ['academy.html', 'Уроки астрологии']].map(([h, t], i) => `<a href="${h}" style="transition-delay:${0.04 * i}s">${t}</a>`).join('')}</nav>
      <p class="mm-label">Бесплатно на сайте</p>
      <div class="mm-tools">${TOOLS.map(([h, t, ic]) => `<a href="${h}">${icon(ic)}<span>${t}</span></a>`).join('')}</div>
      <div style="margin-top:22px;display:grid;gap:10px">
        <button class="btn btn-primary btn-block" type="button" data-book>Записаться на консультацию</button>
        ${pr ? `<p class="small center" style="margin:0"><span class="sticker sm">−${pr.percent}%</span> ${esc(pr.short)} до ${pr.end.getDate()} ${fmt.MONTHS_GEN[pr.end.getMonth()]}</p>` : ''}
      </div>
      <a class="mm-cabinet" href="cabinet.html">${icon('lock')} Кабинет астролога</a>`;
    document.body.appendChild(mm);
    const burger = $('.burger', header);
    const openMenu = (o) => { mm.classList.toggle('open', o); burger.setAttribute('aria-expanded', String(o)); document.body.style.overflow = o ? 'hidden' : ''; };
    burger.addEventListener('click', () => openMenu(true));
    $('[data-close-menu]', mm).addEventListener('click', () => openMenu(false));
    mm.addEventListener('click', (e) => { if (e.target.closest('a') || e.target.closest('[data-book]')) openMenu(false); });

    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    // закреплённая кнопка записи на телефоне
    if (page !== 'cabinet.html') {
      const cta = document.createElement('div');
      cta.className = 'mobile-cta';
      cta.innerHTML = `<img src="assets/img/alina-avatar.webp" alt="" width="40" height="40"><div class="mc-text"><b>Консультация с Алиной</b><small>${pr ? `<span class="sticker xs">−${pr.percent}%</span> ${esc(pr.short)}` : 'онлайн из любой страны'}</small></div><button class="btn btn-primary btn-sm" type="button" data-book>Записаться</button>`;
      document.body.appendChild(cta);
      const toggleCta = () => {
        const bk = document.getElementById('booking');
        const nearBooking = bk && bk.getBoundingClientRect().top < window.innerHeight && bk.getBoundingClientRect().bottom > 0;
        const footerEl = document.querySelector('.site-footer');
        const nearFooter = footerEl && footerEl.getBoundingClientRect().top < window.innerHeight;
        cta.classList.toggle('show', window.scrollY > 520 && !nearBooking && !nearFooter);
      };
      window.addEventListener('scroll', toggleCta, { passive: true }); toggleCta();
    }

    const links = contactLinks();
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <a class="brand" href="index.html"><span class="brand-mark"><img src="assets/img/alina-avatar.webp" alt="" width="40" height="40" loading="lazy"></span><span><span class="brand-name">${esc(SITE.name)}</span><span class="brand-role">${esc(SITE.role)}</span></span></a>
            <p class="hand-sign">${esc(SITE.about && SITE.about.signature ? SITE.about.signature : '')}</p>
            <p class="muted small" style="max-width:34ch">${esc(SITE.tagline)}. Консультации онлайн из любой точки мира.</p>
            <div class="socials">${links.map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener" aria-label="${esc(l.label)}" title="${esc(l.label)}">${icon(l.k)}</a>`).join('')}</div>
            ${(SITE.contacts || {}).instagram ? '<p class="tiny muted" style="max-width:34ch;margin-top:10px">*Instagram принадлежит компании Meta, деятельность которой запрещена в России как экстремистская.</p>' : ''}
          </div>
          <div><h4>Бесплатно</h4>${TOOLS.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</div>
          <div><h4>Консультации</h4>${SITE.services.slice(0, 6).map((s) => `<a href="index.html#services">${esc(s.title)}</a>`).join('')}</div>
          <div><h4>Сайт</h4><a href="academy.html">Уроки астрологии</a><a href="index.html#about">Обо мне</a><a href="index.html#faq">Вопросы и ответы</a><a href="index.html#booking">Запись</a><a href="privacy.html">Политика конфиденциальности</a><a href="cabinet.html" class="muted">Кабинет астролога</a></div>
        </div>
        <p class="disclaimer">Астрология — инструмент самопознания. Она не заменяет медицинскую, психологическую, юридическую или финансовую помощь. Расчёты: тропический зодиак, эфемериды astronomy-engine и NASA JPL; точность положений — около угловой минуты.</p>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(SITE.name)}</span><span>Иконки — Tabler Icons</span></div>
      </div>`;
    document.body.appendChild(footer);

    if (SITE.draft) { const pill = document.createElement('div'); pill.className = 'draft-pill'; pill.innerHTML = icon('writing') + 'Черновик сайта'; pill.title = 'Демо-версия: контакты, цены и отзывы ещё уточняются'; document.body.appendChild(pill); }
    if (window.ARTIFACT_PREVIEW) document.documentElement.classList.add('in-artifact');

    $$('.theme-toggle').forEach((b) => b.addEventListener('click', () => switchTheme(b)));
    applyTheme(document.documentElement.getAttribute('data-theme'));
  }

  // ---------- звёздное небо ----------
  function starfield() {
    const wrap = document.createElement('div'); wrap.className = 'sky-bg'; wrap.setAttribute('aria-hidden', 'true');
    const cv = document.createElement('canvas'); wrap.appendChild(cv);
    const au = document.createElement('div'); au.className = 'aurora'; au.setAttribute('aria-hidden', 'true'); au.innerHTML = '<i></i><i></i><i></i>';
    document.body.prepend(wrap); document.body.prepend(au);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, stars = [], shoot = null, last = 0, color = '#fff';
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((W * H) / 9000);
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      stars = Array.from({ length: n }, () => ({ x: rnd() * W, y: rnd() * H, r: rnd() < 0.08 ? 1.6 + rnd() * 0.8 : 0.4 + rnd() * 0.9, p: rnd() * Math.PI * 2, s: 0.4 + rnd() * 1.4, cross: rnd() < 0.05 }));
      color = getComputedStyle(document.documentElement).getPropertyValue('--star').trim() || '#fff';
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      for (const s of stars) {
        const a = reduce ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 1000 * s.s + s.p));
        ctx.globalAlpha = a * (dark ? 1 : 0.28);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        if (s.cross && s.r > 1.2) { ctx.globalAlpha *= 0.6; ctx.fillRect(s.x - s.r * 3, s.y - 0.3, s.r * 6, 0.6); ctx.fillRect(s.x - 0.3, s.y - s.r * 3, 0.6, s.r * 6); }
      }
      if (!reduce && dark) {
        if (!shoot && t - last > 7000 && Math.random() < 0.02) { shoot = { x: Math.random() * W * 0.7 + W * 0.2, y: Math.random() * H * 0.3, l: 0 }; last = t; }
        if (shoot) {
          shoot.l += 14; const len = 120;
          const g = ctx.createLinearGradient(shoot.x - shoot.l, shoot.y + shoot.l * 0.45, shoot.x - shoot.l + len, shoot.y + shoot.l * 0.45 - len * 0.45);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,245,225,0.9)');
          ctx.globalAlpha = Math.max(0, 1 - shoot.l / 600); ctx.strokeStyle = g; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(shoot.x - shoot.l, shoot.y + shoot.l * 0.45); ctx.lineTo(shoot.x - shoot.l + len, shoot.y + shoot.l * 0.45 - len * 0.45); ctx.stroke();
          if (shoot.l > 600) shoot = null;
        }
      }
      ctx.globalAlpha = 1;
      if (!reduce && !document.hidden) requestAnimationFrame(draw);
    }
    resize(); window.addEventListener('resize', resize);
    document.addEventListener('themechange', () => { color = getComputedStyle(document.documentElement).getPropertyValue('--star').trim(); if (reduce) draw(0); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !reduce) requestAnimationFrame(draw); });
    requestAnimationFrame(draw);
  }

  // ---------- появление при прокрутке ----------
  // Один наблюдатель на всю страницу; блоки, добавленные позже (результаты, вкладки, кабинет), подхватываются сами.
  // threshold 0: даже очень высокий блок не останется невидимым.
  const revealIO = ('IntersectionObserver' in window) && !reduceMotion()
    ? new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); } }), { threshold: 0, rootMargin: '0px 0px -40px 0px' })
    : null;
  if (revealIO) document.documentElement.classList.add('reveal-on');
  function reveal(root) {
    const els = $$('.reveal:not(.in)', root);
    if (root && root.matches && root.matches('.reveal:not(.in)')) els.push(root);
    if (!revealIO) { els.forEach((e) => e.classList.add('in')); return; }
    els.forEach((e) => revealIO.observe(e));
  }
  function watchReveal() {
    if (!revealIO || !('MutationObserver' in window)) return;
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) reveal(n);
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.addEventListener('beforeprint', () => $$('.reveal:not(.in)').forEach((e) => e.classList.add('in')));

  // ---------- плавные аккордеоны (<details>) ----------
  // Браузер открывает <details> мгновенно; здесь высота плавно меняется, а содержимое проявляется.
  // Работает для всех details на сайте (вопросы, инструкции, «координаты вручную», настройки расчёта).
  function detailsHeight(d, open) { const was = d.open; d.open = open; const h = d.getBoundingClientRect().height; d.open = was; return h; }
  function toggleDetails(d) {
    const st = d._acc;
    const target = !(st ? st.target : d.open);
    const from = d.getBoundingClientRect().height;
    const kids = Array.from(d.children).filter((k) => k.tagName !== 'SUMMARY');
    const kidOp = kids.map((k) => +getComputedStyle(k).opacity);
    if (st) { st.anim.onfinish = null; st.anim.cancel(); st.fades.forEach((a) => a.cancel()); }
    d.open = true;
    const to = target ? d.getBoundingClientRect().height : detailsHeight(d, false);
    d.classList.toggle('is-closing', !target);
    d.style.overflow = 'hidden';
    const dur = Math.round(Math.min(620, Math.max(300, 240 + Math.abs(to - from) * 0.55)));
    const anim = d.animate({ height: [from + 'px', to + 'px'] }, { duration: dur, easing: target ? EASE_OUT : EASE_IN_OUT });
    const fades = kids.map((k, i) => k.animate(
      target ? { opacity: [st ? kidOp[i] : 0, 1], translate: [st ? '0 0' : '0 -6px', '0 0'] } : { opacity: [kidOp[i], 0] },
      { duration: target ? dur : Math.round(dur * 0.55), easing: 'ease', fill: 'forwards' }));
    d._acc = { target, anim, fades };
    anim.onfinish = () => {
      d._acc = null;
      if (!target) d.open = false;
      fades.forEach((a) => a.cancel());
      d.classList.remove('is-closing');
      d.style.overflow = '';
    };
  }
  document.addEventListener('click', (e) => {
    const s = e.target.closest && e.target.closest('summary');
    if (!s || e.defaultPrevented) return;
    const d = s.parentElement;
    if (!d || d.tagName !== 'DETAILS' || d.querySelector(':scope > summary') !== s || !d.animate || reduceMotion()) return;
    e.preventDefault();
    toggleDetails(d);
  });

  // ---------- тосты и модалки ----------
  function toast(msg, ic) {
    let box = $('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = icon(ic || 'sparkle') + `<span>${esc(msg)}</span>`;
    box.appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 380); }, 3200);
  }
  function modal(html, opts) {
    opts = opts || {};
    const back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><button class="icon-btn x" type="button" aria-label="Закрыть">${icon('close')}</button>${html}</div>`;
    document.body.appendChild(back);
    const prevFocus = document.activeElement;
    requestAnimationFrame(() => back.classList.add('open'));
    const close = () => { back.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => back.remove(), 300); if (prevFocus && prevFocus.focus) prevFocus.focus(); if (opts.onClose) opts.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    $('.x', back).addEventListener('click', close);
    setTimeout(() => { const f = $('input, select, textarea, button:not(.x)', back); if (f) f.focus(); }, 60);
    return { el: $('.modal', back), close };
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } ta.remove(); return ok;
    }
  }
  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- Луна: рисунок фазы ----------
  let moonUid = 0;
  function moonSVG(angle, opts) {
    opts = opts || {};
    const r = 45, cx = 50, cy = 50, id = 'mg' + (++moonUid);
    const a = ((angle % 360) + 360) % 360;
    const k = (1 - Math.cos(a * Math.PI / 180)) / 2;
    const rx = Math.abs(Math.cos(a * Math.PI / 180)) * r;
    const waxing = a < 180;
    let path;
    if (k < 0.01) path = '';
    else if (k > 0.99) path = `M${cx},${cy - r}A${r},${r} 0 1,1 ${cx - 0.01},${cy - r}Z`;
    else if (waxing) path = `M${cx},${cy - r}A${r},${r} 0 0,1 ${cx},${cy + r}A${rx},${r} 0 0,${k < 0.5 ? 0 : 1} ${cx},${cy - r}Z`;
    else path = `M${cx},${cy - r}A${r},${r} 0 0,0 ${cx},${cy + r}A${rx},${r} 0 0,${k < 0.5 ? 1 : 0} ${cx},${cy - r}Z`;
    const dark = opts.darkColor || (document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(10, 8, 25, 0.55)' : 'rgba(92, 74, 160, 0.26)');
    return `<svg xmlns="http://www.w3.org/2000/svg" class="${opts.cls || ''}" viewBox="0 0 100 100" role="img" aria-label="Фаза Луны: освещено ${Math.round(k * 100)}%">
      <defs><radialGradient id="${id}" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#fffaf0"/><stop offset=".65" stop-color="#f6e7c8"/><stop offset="1" stop-color="#e4cfa4"/></radialGradient></defs>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${dark}" stroke="rgba(184,147,90,.6)" stroke-width="1.5"/>
      ${path ? `<path d="${path}" fill="url(#${id})"/>` : ''}
      ${k > 0.15 ? `<g fill="#c9b48a" opacity="${0.18 * Math.min(1, k * 1.5)}" clip-path="none"><circle cx="40" cy="38" r="7"/><circle cx="60" cy="56" r="9"/><circle cx="47" cy="66" r="4.5"/><circle cx="64" cy="33" r="4"/></g>` : ''}
    </svg>`;
  }

  // ---------- города ----------
  const CITIES = [
    ['Москва', 'Россия', 55.7558, 37.6173, 'Europe/Moscow'], ['Санкт-Петербург', 'Россия', 59.9386, 30.3141, 'Europe/Moscow'], ['Новосибирск', 'Россия', 55.0302, 82.9204, 'Asia/Novosibirsk'],
    ['Екатеринбург', 'Россия', 56.8389, 60.6057, 'Asia/Yekaterinburg'], ['Казань', 'Россия', 55.7963, 49.1088, 'Europe/Moscow'], ['Нижний Новгород', 'Россия', 56.3269, 44.0059, 'Europe/Moscow'],
    ['Челябинск', 'Россия', 55.1644, 61.4368, 'Asia/Yekaterinburg'], ['Самара', 'Россия', 53.1959, 50.1002, 'Europe/Samara'], ['Омск', 'Россия', 54.9885, 73.3242, 'Asia/Omsk'],
    ['Ростов-на-Дону', 'Россия', 47.2357, 39.7015, 'Europe/Moscow'], ['Уфа', 'Россия', 54.7388, 55.9721, 'Asia/Yekaterinburg'], ['Красноярск', 'Россия', 56.0153, 92.8932, 'Asia/Krasnoyarsk'],
    ['Воронеж', 'Россия', 51.6608, 39.2003, 'Europe/Moscow'], ['Пермь', 'Россия', 58.0105, 56.2502, 'Asia/Yekaterinburg'], ['Волгоград', 'Россия', 48.708, 44.5133, 'Europe/Volgograd'],
    ['Краснодар', 'Россия', 45.0355, 38.9753, 'Europe/Moscow'], ['Саратов', 'Россия', 51.5336, 46.0343, 'Europe/Saratov'], ['Тюмень', 'Россия', 57.153, 65.5343, 'Asia/Yekaterinburg'],
    ['Тольятти', 'Россия', 53.5303, 49.3461, 'Europe/Samara'], ['Ижевск', 'Россия', 56.8526, 53.2045, 'Europe/Samara'], ['Барнаул', 'Россия', 53.3606, 83.7546, 'Asia/Barnaul'],
    ['Ульяновск', 'Россия', 54.3142, 48.4031, 'Europe/Ulyanovsk'], ['Иркутск', 'Россия', 52.2896, 104.2806, 'Asia/Irkutsk'], ['Хабаровск', 'Россия', 48.4802, 135.0719, 'Asia/Vladivostok'],
    ['Ярославль', 'Россия', 57.6261, 39.8845, 'Europe/Moscow'], ['Владивосток', 'Россия', 43.1155, 131.8855, 'Asia/Vladivostok'], ['Махачкала', 'Россия', 42.9849, 47.5047, 'Europe/Moscow'],
    ['Томск', 'Россия', 56.4846, 84.9476, 'Asia/Tomsk'], ['Оренбург', 'Россия', 51.7682, 55.0969, 'Asia/Yekaterinburg'], ['Кемерово', 'Россия', 55.3547, 86.0873, 'Asia/Novokuznetsk'],
    ['Новокузнецк', 'Россия', 53.7596, 87.1216, 'Asia/Novokuznetsk'], ['Рязань', 'Россия', 54.6292, 39.7364, 'Europe/Moscow'], ['Астрахань', 'Россия', 46.3497, 48.0408, 'Europe/Astrakhan'],
    ['Набережные Челны', 'Россия', 55.7436, 52.3958, 'Europe/Moscow'], ['Пенза', 'Россия', 53.1959, 45.0183, 'Europe/Moscow'], ['Киров', 'Россия', 58.6036, 49.668, 'Europe/Kirov'],
    ['Липецк', 'Россия', 52.6031, 39.5708, 'Europe/Moscow'], ['Чебоксары', 'Россия', 56.1322, 47.2519, 'Europe/Moscow'], ['Калининград', 'Россия', 54.7104, 20.4522, 'Europe/Kaliningrad'],
    ['Тула', 'Россия', 54.193, 37.6178, 'Europe/Moscow'], ['Курск', 'Россия', 51.7304, 36.1926, 'Europe/Moscow'], ['Сочи', 'Россия', 43.5855, 39.7231, 'Europe/Moscow'],
    ['Ставрополь', 'Россия', 45.0428, 41.9734, 'Europe/Moscow'], ['Улан-Удэ', 'Россия', 51.8335, 107.5841, 'Asia/Irkutsk'], ['Тверь', 'Россия', 56.8587, 35.9176, 'Europe/Moscow'],
    ['Магнитогорск', 'Россия', 53.4072, 58.9791, 'Asia/Yekaterinburg'], ['Иваново', 'Россия', 57.0004, 40.9739, 'Europe/Moscow'], ['Брянск', 'Россия', 53.2434, 34.3654, 'Europe/Moscow'],
    ['Белгород', 'Россия', 50.5997, 36.5983, 'Europe/Moscow'], ['Сургут', 'Россия', 61.254, 73.3962, 'Asia/Yekaterinburg'], ['Владимир', 'Россия', 56.1291, 40.4066, 'Europe/Moscow'],
    ['Чита', 'Россия', 52.0515, 113.4712, 'Asia/Chita'], ['Архангельск', 'Россия', 64.5393, 40.5187, 'Europe/Moscow'], ['Нижний Тагил', 'Россия', 57.9101, 59.9813, 'Asia/Yekaterinburg'],
    ['Калуга', 'Россия', 54.5293, 36.2754, 'Europe/Moscow'], ['Симферополь', 'Крым', 44.9521, 34.1024, 'Europe/Simferopol'], ['Севастополь', 'Крым', 44.6167, 33.5254, 'Europe/Simferopol'],
    ['Смоленск', 'Россия', 54.7826, 32.0453, 'Europe/Moscow'], ['Якутск', 'Россия', 62.0355, 129.6755, 'Asia/Yakutsk'], ['Саранск', 'Россия', 54.1874, 45.1839, 'Europe/Moscow'],
    ['Череповец', 'Россия', 59.1222, 37.9033, 'Europe/Moscow'], ['Курган', 'Россия', 55.4408, 65.3411, 'Asia/Yekaterinburg'], ['Вологда', 'Россия', 59.2181, 39.8886, 'Europe/Moscow'],
    ['Орёл', 'Россия', 52.9703, 36.0635, 'Europe/Moscow'], ['Владикавказ', 'Россия', 43.0205, 44.6819, 'Europe/Moscow'], ['Грозный', 'Россия', 43.3178, 45.6949, 'Europe/Moscow'],
    ['Мурманск', 'Россия', 68.9585, 33.0827, 'Europe/Moscow'], ['Тамбов', 'Россия', 52.7212, 41.4523, 'Europe/Moscow'], ['Петрозаводск', 'Россия', 61.7849, 34.3469, 'Europe/Moscow'],
    ['Кострома', 'Россия', 57.7677, 40.9264, 'Europe/Moscow'], ['Нижневартовск', 'Россия', 60.9344, 76.5531, 'Asia/Yekaterinburg'], ['Новороссийск', 'Россия', 44.7235, 37.7686, 'Europe/Moscow'],
    ['Йошкар-Ола', 'Россия', 56.6343, 47.8999, 'Europe/Moscow'], ['Сыктывкар', 'Россия', 61.6688, 50.8364, 'Europe/Moscow'], ['Нальчик', 'Россия', 43.4853, 43.6071, 'Europe/Moscow'],
    ['Южно-Сахалинск', 'Россия', 46.9591, 142.738, 'Asia/Sakhalin'], ['Петропавловск-Камчатский', 'Россия', 53.0444, 158.6508, 'Asia/Kamchatka'], ['Магадан', 'Россия', 59.5682, 150.8085, 'Asia/Magadan'],
    ['Норильск', 'Россия', 69.3558, 88.1893, 'Asia/Krasnoyarsk'], ['Псков', 'Россия', 57.8136, 28.3496, 'Europe/Moscow'], ['Великий Новгород', 'Россия', 58.5228, 31.2698, 'Europe/Moscow'],
    ['Абакан', 'Россия', 53.7212, 91.4424, 'Asia/Krasnoyarsk'], ['Благовещенск', 'Россия', 50.2907, 127.5272, 'Asia/Yakutsk'],
    ['Минск', 'Беларусь', 53.9006, 27.559, 'Europe/Minsk'], ['Гомель', 'Беларусь', 52.4345, 30.9754, 'Europe/Minsk'], ['Брест', 'Беларусь', 52.0976, 23.7341, 'Europe/Minsk'],
    ['Киев', 'Украина', 50.4501, 30.5234, 'Europe/Kiev'], ['Харьков', 'Украина', 49.9935, 36.2304, 'Europe/Kiev'], ['Одесса', 'Украина', 46.4825, 30.7233, 'Europe/Kiev'],
    ['Днепр', 'Украина', 48.4647, 35.0462, 'Europe/Kiev'], ['Львов', 'Украина', 49.8397, 24.0297, 'Europe/Kiev'],
    ['Алматы', 'Казахстан', 43.2389, 76.8897, 'Asia/Almaty'], ['Астана', 'Казахстан', 51.1694, 71.4491, 'Asia/Almaty'], ['Караганда', 'Казахстан', 49.8047, 73.1094, 'Asia/Almaty'],
    ['Шымкент', 'Казахстан', 42.3417, 69.5901, 'Asia/Almaty'], ['Ташкент', 'Узбекистан', 41.2995, 69.2401, 'Asia/Tashkent'], ['Самарканд', 'Узбекистан', 39.6542, 66.9597, 'Asia/Samarkand'],
    ['Бишкек', 'Киргизия', 42.8746, 74.5698, 'Asia/Bishkek'], ['Душанбе', 'Таджикистан', 38.5598, 68.787, 'Asia/Dushanbe'], ['Ашхабад', 'Туркменистан', 37.9601, 58.3261, 'Asia/Ashgabat'],
    ['Баку', 'Азербайджан', 40.4093, 49.8671, 'Asia/Baku'], ['Ереван', 'Армения', 40.1792, 44.4991, 'Asia/Yerevan'], ['Тбилиси', 'Грузия', 41.7151, 44.8271, 'Asia/Tbilisi'],
    ['Батуми', 'Грузия', 41.6168, 41.6367, 'Asia/Tbilisi'], ['Кутаиси', 'Грузия', 42.2679, 42.6946, 'Asia/Tbilisi'], ['Кишинёв', 'Молдова', 47.0105, 28.8638, 'Europe/Chisinau'],
    ['Рига', 'Латвия', 56.9496, 24.1052, 'Europe/Riga'], ['Вильнюс', 'Литва', 54.6872, 25.2797, 'Europe/Vilnius'], ['Таллин', 'Эстония', 59.437, 24.7536, 'Europe/Tallinn'],
    ['Стамбул', 'Турция', 41.0082, 28.9784, 'Europe/Istanbul'], ['Анталья', 'Турция', 36.8969, 30.7133, 'Europe/Istanbul'], ['Берлин', 'Германия', 52.52, 13.405, 'Europe/Berlin'],
    ['Прага', 'Чехия', 50.0755, 14.4378, 'Europe/Prague'], ['Варшава', 'Польша', 52.2297, 21.0122, 'Europe/Warsaw'], ['Белград', 'Сербия', 44.7866, 20.4489, 'Europe/Belgrade'],
    ['Будапешт', 'Венгрия', 47.4979, 19.0402, 'Europe/Budapest'], ['Вена', 'Австрия', 48.2082, 16.3738, 'Europe/Vienna'], ['Лондон', 'Великобритания', 51.5074, -0.1278, 'Europe/London'],
    ['Париж', 'Франция', 48.8566, 2.3522, 'Europe/Paris'], ['Рим', 'Италия', 41.9028, 12.4964, 'Europe/Rome'], ['Мадрид', 'Испания', 40.4168, -3.7038, 'Europe/Madrid'],
    ['Барселона', 'Испания', 41.3851, 2.1734, 'Europe/Madrid'], ['Лиссабон', 'Португалия', 38.7223, -9.1393, 'Europe/Lisbon'], ['Хельсинки', 'Финляндия', 60.1699, 24.9384, 'Europe/Helsinki'],
    ['Амстердам', 'Нидерланды', 52.3676, 4.9041, 'Europe/Amsterdam'], ['Цюрих', 'Швейцария', 47.3769, 8.5417, 'Europe/Zurich'], ['Лимассол', 'Кипр', 34.7071, 33.0226, 'Asia/Nicosia'],
    ['Тель-Авив', 'Израиль', 32.0853, 34.7818, 'Asia/Jerusalem'], ['Дубай', 'ОАЭ', 25.2048, 55.2708, 'Asia/Dubai'], ['Бангкок', 'Таиланд', 13.7563, 100.5018, 'Asia/Bangkok'],
    ['Пхукет', 'Таиланд', 7.8804, 98.3923, 'Asia/Bangkok'], ['Денпасар (Бали)', 'Индонезия', -8.6705, 115.2126, 'Asia/Makassar'], ['Пекин', 'Китай', 39.9042, 116.4074, 'Asia/Shanghai'],
    ['Нью-Йорк', 'США', 40.7128, -74.006, 'America/New_York'], ['Майами', 'США', 25.7617, -80.1918, 'America/New_York'], ['Лос-Анджелес', 'США', 34.0522, -118.2437, 'America/Los_Angeles'],
    ['Торонто', 'Канада', 43.6532, -79.3832, 'America/Toronto'],
  ].map(([name, country, lat, lon, tz]) => ({ name, country, lat, lon, tz }));
  const normName = (s) => s.toLowerCase().replace(/ё/g, 'е').trim();
  /** Город по умолчанию: выбранный посетителем, иначе из content.js (Минск). */
  function defaultCity() { return store.get('moonCity', null) || cityForZone() || CITIES.find((c) => c.name === SITE.defaultCity) || CITIES[0]; }
  const geoCache = {};
  async function searchCities(q) {
    const nq = normName(q);
    const local = CITIES.filter((c) => normName(c.name).startsWith(nq)).slice(0, 6);
    let remote = [];
    if (nq.length >= 2) {
      try {
        if (!geoCache[nq]) {
          const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=8&language=ru&format=json&name=' + encodeURIComponent(q.trim()));
          const j = await r.json();
          geoCache[nq] = (j.results || []).filter((x) => x.timezone).map((x) => ({ name: x.name, country: [x.admin1, x.country].filter(Boolean).join(', '), lat: x.latitude, lon: x.longitude, tz: x.timezone }));
        }
        remote = geoCache[nq];
      } catch (e) { remote = []; }
    }
    const seen = new Set(local.map((c) => normName(c.name) + Math.round(c.lat)));
    return local.concat(remote.filter((c) => !seen.has(normName(c.name) + Math.round(c.lat)))).slice(0, 10);
  }
  let tzList = null;
  function timeZones() {
    if (tzList) return tzList;
    try { tzList = Intl.supportedValuesOf('timeZone'); } catch (e) { tzList = Array.from(new Set(CITIES.map((c) => c.tz))).sort(); }
    if (!tzList.includes('Europe/Moscow')) tzList.push('Europe/Moscow');
    return tzList;
  }
  const fmtCoord = (lat, lon) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'с. ш.' : 'ю. ш.'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'в. д.' : 'з. д.'}`;

  // ---------- форма данных рождения ----------
  let formUid = 0;
  function birthForm(container, opts) {
    opts = opts || {};
    const u = 'bf' + (++formUid);
    container.innerHTML = `
      <div class="form" data-bf>
        ${opts.title ? `<h3 style="margin:0">${opts.title}</h3>` : ''}
        <div class="field"><label for="${u}n">Имя</label><input class="input" id="${u}n" autocomplete="off" placeholder="${opts.namePlaceholder || 'Как вас зовут?'}"></div>
        <div class="form-row">
          <div class="field"><label for="${u}d">Дата рождения</label><input class="input" id="${u}d" type="date" min="1900-01-01" max="2099-12-31" required></div>
          <div class="field"><label for="${u}t">Время</label><input class="input" id="${u}t" type="time" value="12:00"></div>
        </div>
        <label class="check"><input type="checkbox" id="${u}u"> Не знаю время рождения</label>
        <div class="field">
          <label for="${u}c">Место рождения</label>
          <input class="input" id="${u}c" autocomplete="off" placeholder="Начните вводить город" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="${u}l">
          <div class="ac-list" id="${u}l" role="listbox"></div>
          <div class="place-meta" id="${u}m"></div>
        </div>
        <details class="details-adv">
          <summary>Координаты и часовой пояс вручную</summary>
          <div class="form-row" style="margin-top:6px">
            <div class="field"><label for="${u}la">Широта</label><input class="input" id="${u}la" inputmode="decimal" placeholder="55.75"></div>
            <div class="field"><label for="${u}lo">Долгота</label><input class="input" id="${u}lo" inputmode="decimal" placeholder="37.62"></div>
          </div>
          <div class="field" style="margin-top:12px"><label for="${u}z">Часовой пояс</label><select class="select" id="${u}z">${timeZones().map((z) => `<option>${z}</option>`).join('')}</select>
          <span class="hint">История перехода на летнее и декретное время учитывается автоматически.</span></div>
        </details>
      </div>`;
    const el = (s) => container.querySelector('#' + u + s);
    const city = el('c'), list = el('l'), meta = el('m'), unk = el('u'), time = el('t');
    let place = null, items = [], active = -1, timer = null;
    el('z').value = defaultCity().tz;
    unk.addEventListener('change', () => { time.disabled = unk.checked; });
    function setPlace(p) {
      place = p;
      city.value = p.name;
      el('la').value = (+p.lat).toFixed(4); el('lo').value = (+p.lon).toFixed(4);
      if (timeZones().includes(p.tz)) el('z').value = p.tz; else { const o = document.createElement('option'); o.textContent = p.tz; el('z').appendChild(o); el('z').value = p.tz; }
      meta.textContent = `${p.country ? p.country + ' · ' : ''}${fmtCoord(+p.lat, +p.lon)} · ${p.tz}`;
      list.classList.remove('open'); city.setAttribute('aria-expanded', 'false'); city.classList.remove('invalid');
    }
    function renderList() {
      list.innerHTML = items.length ? items.map((c, i) => `<div class="ac-item${i === active ? ' active' : ''}" role="option" data-i="${i}"><span>${esc(c.name)}</span><small>${esc(c.country)}</small></div>`).join('') : '<div class="ac-item"><small>Не нашли город? Укажите координаты вручную ниже</small></div>';
      list.classList.add('open'); city.setAttribute('aria-expanded', 'true');
    }
    city.addEventListener('input', () => {
      place = null; meta.textContent = '';
      clearTimeout(timer);
      const q = city.value;
      if (q.trim().length < 1) { list.classList.remove('open'); return; }
      timer = setTimeout(async () => { items = await searchCities(q); active = -1; if (city.value === q) renderList(); }, 220);
    });
    city.addEventListener('keydown', (e) => {
      if (!list.classList.contains('open')) return;
      if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); renderList(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); renderList(); e.preventDefault(); }
      if (e.key === 'Enter' && items[active >= 0 ? active : 0]) { setPlace(items[active >= 0 ? active : 0]); e.preventDefault(); }
      if (e.key === 'Escape') list.classList.remove('open');
    });
    list.addEventListener('mousedown', (e) => { const it = e.target.closest('[data-i]'); if (it) { e.preventDefault(); setPlace(items[+it.dataset.i]); } });
    city.addEventListener('blur', () => setTimeout(() => list.classList.remove('open'), 150));

    const api = {
      get() {
        const ds = el('d').value;
        if (!ds) { el('d').classList.add('invalid'); el('d').focus(); toast('Укажите дату рождения', 'calendar'); return null; }
        el('d').classList.remove('invalid');
        const [y, mo, d] = ds.split('-').map(Number);
        const tk = !unk.checked;
        const [h, mi] = (time.value || '12:00').split(':').map(Number);
        const lat = parseFloat(String(el('la').value).replace(',', '.')), lon = parseFloat(String(el('lo').value).replace(',', '.'));
        if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
          city.classList.add('invalid'); city.focus(); toast('Выберите город из списка или укажите координаты', 'pin'); return null;
        }
        return { name: el('n').value.trim(), y, mo, d, h: tk ? h : 12, mi: tk ? mi : 0, timeKnown: tk, lat, lon, zone: el('z').value, place: city.value.trim() || fmtCoord(lat, lon) };
      },
      set(p) {
        if (!p) return;
        el('n').value = p.name || '';
        el('d').value = `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
        unk.checked = p.timeKnown === false; time.disabled = unk.checked;
        time.value = `${pad(p.h != null ? p.h : 12)}:${pad(p.mi || 0)}`;
        setPlace({ name: p.place || '', country: '', lat: p.lat, lon: p.lon, tz: p.zone });
      },
      focus() { el('n').focus(); },
    };
    return api;
  }

  // недавние карты
  const recent = {
    list: () => store.get('recent', []),
    add(p) {
      const key = (x) => [x.name, x.y, x.mo, x.d, x.h, x.mi, x.lat].join('|');
      const l = recent.list().filter((x) => key(x) !== key(p));
      l.unshift(p); store.set('recent', l.slice(0, 8));
    },
  };
  // клиенты (кабинет)
  const clients = {
    all: () => store.get('clients', []),
    save(list) { store.set('clients', list); },
    add(c) {
      const list = clients.all();
      c.id = c.id || 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      c.created = c.created || new Date().toISOString();
      list.unshift(c); clients.save(list); return c;
    },
    get: (id) => clients.all().find((c) => c.id === id),
  };

  // ---------- запись на консультацию ----------
  function serviceOptions() {
    return SITE.services.map((s) => ({ id: s.id, title: s.title })).concat([{ id: 'lessons', title: 'Индивидуальные уроки астрологии' }, { id: 'course', title: 'Курс «Астрология с нуля»' }, { id: 'gift', title: 'Подарочный сертификат' }, { id: 'other', title: 'Другое / пока не знаю' }]);
  }
  function bookingFormHTML(prefix, preset) {
    const u = prefix;
    return `
      <form class="form" data-booking novalidate>
        <div class="form-row">
          <div class="field"><label for="${u}name">Ваше имя *</label><input class="input" id="${u}name" name="name" required autocomplete="given-name"></div>
          <div class="field"><label for="${u}contact">Telegram, WhatsApp или телефон *</label><input class="input" id="${u}contact" name="contact" required placeholder="@ник или +7…" autocomplete="tel"></div>
        </div>
        <div class="field"><label for="${u}service">Что вас интересует</label><select class="select" id="${u}service" name="service">${serviceOptions().map((s) => `<option value="${s.id}"${preset === s.id ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select></div>
        <div class="form-row three">
          <div class="field"><label for="${u}bd">Дата рождения</label><input class="input" id="${u}bd" name="bdate" type="date" min="1900-01-01" max="2099-12-31"></div>
          <div class="field"><label for="${u}bt">Время</label><input class="input" id="${u}bt" name="btime" type="time"></div>
          <div class="field"><label for="${u}bp">Город рождения</label><input class="input" id="${u}bp" name="bplace"></div>
        </div>
        <div class="field"><label for="${u}q">Ваш вопрос или запрос</label><textarea class="textarea" id="${u}q" name="question" placeholder="Что сейчас важно? Можно коротко."></textarea></div>
        <label class="check"><input type="checkbox" name="consent" required> <span>Даю согласие на обработку персональных данных согласно <a href="privacy.html" target="_blank">политике конфиденциальности</a></span></label>
        <button class="btn btn-primary btn-block" type="submit">${icon('sparkle')} Отправить заявку</button>
        <p class="tiny muted center" style="margin:0">Отвечаю в течение дня. Время встречи подберём по вашему часовому поясу${browserTz ? ' (' + esc(browserTz.replace(/_/g, ' ')) + ')' : ''}. Данные рождения можно прислать и позже.</p>
      </form>`;
  }
  function bindBooking(form, onDone) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const name = (f.get('name') || '').trim(), contact = (f.get('contact') || '').trim();
      if (!name) { form.querySelector('[name=name]').classList.add('invalid'); form.querySelector('[name=name]').focus(); return; }
      if (!contact) { form.querySelector('[name=contact]').classList.add('invalid'); form.querySelector('[name=contact]').focus(); return; }
      if (!f.get('consent')) { toast('Отметьте согласие на обработку данных', 'info'); return; }
      goal('booking');
      const svc = serviceOptions().find((s) => s.id === f.get('service'));
      const bd = f.get('bdate');
      const lines = [
        `Здравствуйте, Алина! Хочу записаться ✨`,
        `Имя: ${name}`,
        `Связь: ${contact}`,
        `Услуга: ${svc ? svc.title : ''}`,
        bd ? `Дата рождения: ${bd.split('-').reverse().join('.')}${f.get('btime') ? ', ' + f.get('btime') : ''}${f.get('bplace') ? ', ' + f.get('bplace') : ''}` : '',
        f.get('question') ? `Запрос: ${f.get('question')}` : '',
        browserTz ? `Мой часовой пояс: ${browserTz}` : '',
      ].filter(Boolean);
      const text = lines.join('\n');
      if (SITE.bookingEndpoint) {
        try {
          const r = await fetch(SITE.bookingEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name, contact, service: svc && svc.title, birth: bd, time: f.get('btime'), place: f.get('bplace'), question: f.get('question'), message: text }) });
          if (r.ok) { form.reset(); if (onDone) onDone(); thanks(); return; }
        } catch (err) { /* упадём в мессенджеры */ }
      }
      chooseChannel(text);
      if (onDone) onDone();
    });
    form.addEventListener('input', (e) => e.target.classList && e.target.classList.remove('invalid'));
  }
  function thanks() {
    modal(`<div class="center"><div style="font-size:3rem;color:var(--gold)">✦</div><h3>Спасибо! Заявка отправлена</h3><p class="muted">Я свяжусь с вами в ближайшее время. А пока можно построить свою карту на сайте.</p><a class="btn btn-primary" href="natal.html">Моя натальная карта</a></div>`);
  }
  function chooseChannel(text) {
    const c = SITE.contacts || {};
    const btns = [];
    if (c.telegram) btns.push(`<button class="btn btn-primary btn-block" data-ch="tg">${icon('telegram')} Отправить в Telegram</button>`);
    if (c.whatsapp) btns.push(`<a class="btn btn-ghost btn-block" target="_blank" rel="noopener" href="https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}">${icon('whatsapp')} Отправить в WhatsApp</a>`);
    if (c.email) btns.push(`<a class="btn btn-ghost btn-block" href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Запись на консультацию')}&body=${encodeURIComponent(text)}">${icon('mail')} Отправить на почту</a>`);
    const m = modal(`
      <h3>Почти готово ✨</h3>
      <p class="muted">Выберите, куда отправить заявку — текст уже составлен.</p>
      <pre style="white-space:pre-wrap;background:var(--bg-2);border:1px solid var(--line);border-radius:12px;padding:14px;font:inherit;font-size:.9rem;max-height:220px;overflow:auto">${esc(text)}</pre>
      <div style="display:grid;gap:10px;margin-top:14px">${btns.join('')}<button class="btn btn-gold btn-block" data-ch="copy">${icon('copy')} Скопировать текст</button></div>
      ${btns.length ? '' : '<p class="notice info" style="margin-top:14px">' + icon('info') + '<span>Контакты для связи ещё не указаны на сайте (файл js/content.js). Скопируйте текст заявки.</span></p>'}`);
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ch]'); if (!b) return;
      if (b.dataset.ch === 'copy') { if (await copyText(text)) toast('Текст заявки скопирован', 'check'); }
      if (b.dataset.ch === 'tg') { await copyText(text); toast('Текст скопирован — вставьте его в чат', 'check'); window.open('https://t.me/' + c.telegram.replace(/^@/, ''), '_blank', 'noopener'); }
    });
  }
  function openBooking(preset) {
    const pr = promoInfo();
    const m = modal(`<div class="booking-head"><img src="assets/img/alina-avatar.webp" alt="" width="64" height="64"><div><span class="eyebrow" style="margin:0">запись</span><h3 style="margin:2px 0 0">Консультация с Алиной</h3></div></div>
      <p class="muted small">Оставьте контакты — я напишу сама и подберу удобное время.</p>
      ${pr ? `<div class="promo-inline"><span class="sticker">−${pr.percent}%</span><span><b>${esc(pr.title)}</b><br><small>действует до ${pr.end.getDate()} ${fmt.MONTHS_GEN[pr.end.getMonth()]}</small></span></div>` : ''}
      ${bookingFormHTML('bm', preset)}`, { wide: false });
    bindBooking(m.el.querySelector('form'), () => m.close());
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-book]');
    if (b) { e.preventDefault(); openBooking(b.dataset.book || ''); }
  });

  // ---------- вкладки ----------
  function tabs(root) {
    $$('[role="tablist"]', root).forEach((tl) => {
      const btns = $$('[role="tab"]', tl);
      const show = (b) => {
        btns.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; const p = document.getElementById(x.getAttribute('aria-controls')); if (p) p.hidden = !on; });
        tl.dispatchEvent(new CustomEvent('tabchange', { detail: b.getAttribute('aria-controls') }));
      };
      btns.forEach((b, i) => {
        b.addEventListener('click', () => show(b));
        b.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length]; n.focus(); show(n); } });
      });
    });
  }

  // ---------- небо сейчас ----------
  function skyNow(date) {
    date = date || new Date();
    const ms = AC.moonState(date);
    const pts = AC.PLANETS.map((id) => AC.body(id, date));
    const retro = pts.filter((p) => p.retro).map((p) => p.id);
    const sunSign = AC.signOf(pts[0].lon);
    return { date, moon: ms, sunSign, retro, pts };
  }

  window.UI = { currency, setCurrency, priceOf, money, browserTz, botHref, botCta, goal, defaultCity, promoInfo, priceFor, minPrice, alinaNote, isPreview, TOOLS, icon, store, settings, saveSettings, fmt, esc, $, $$, glyph, pname, toast, modal, copyText, download, moonSVG, birthForm, recent, clients, openBooking, bookingFormHTML, bindBooking, reveal, fadeIn, reduceMotion, tabs, skyNow, contactLinks, CITIES, fmtCoord, timeZones };

  document.addEventListener('DOMContentLoaded', () => {
    $$('[data-ic]').forEach((el) => { el.outerHTML = icon(el.dataset.ic); });
    $$('[data-note]').forEach((el) => { el.innerHTML = alinaNote(esc(el.dataset.note), el.dataset.noteCta || ''); });
    renderChrome();
    starfield();
    reveal();
    watchReveal();
    tabs();
  });
})();
