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
    ['horoscope.html', 'Гороскоп', 'sparkle', 'на сегодня и месяц'],
    ['moon.html', 'Лунный календарь', 'moon-stars', 'лунные сутки'],
    ['sky.html', 'Астрособытия', 'telescope', 'ретро, затмения'],
    ['numerology.html', 'Нумерология', 'numerology', 'числа по дате и имени'],
  ];
  // пункт «Отзывы» в меню — только когда в content.js есть отзывы (иначе блок на главной скрыт)
  const hasReviews = !!(SITE.reviews && SITE.reviews.length);
  // обучение можно скрыть целиком: academy.enabled: false в content.js
  const academyOn = !!(SITE.academy && SITE.academy.enabled !== false);
  // премиум-доступ (платные разделы по коду, js/premium.js): premium.enabled: false в content.js — ссылки не показываются
  const premOn = !!(SITE.premium && SITE.premium.enabled !== false);
  // Алина вошла в кабинет на этом устройстве (ключ хранит js/admin.js) — показываем ей ссылки на кабинет
  const isAlina = () => { try { return !!(localStorage.getItem('am_adminKey') || sessionStorage.getItem('am_adminKey')); } catch (e) { return false; } };
  const isPreview = location.protocol === 'file:' || /^(localhost|127\.|192\.168\.|\[::1\])/.test(location.hostname);

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
          ${premOn ? `<a class="nav-premium" data-premium-link href="premium.html"${page === 'premium.html' ? ' aria-current="page"' : ''}>${icon('crown')}Премиум</a>` : ''}
          ${academyOn ? `<a href="academy.html"${page === 'academy.html' ? ' aria-current="page"' : ''}>Уроки</a>` : ''}
          <a href="index.html#about">Обо мне</a>
          ${hasReviews ? '<a href="index.html#reviews">Отзывы</a>' : ''}
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
      <nav class="mm-main">${[['index.html', 'Главная'], ['index.html#services', 'Консультации и цены'], ['index.html#about', 'Обо мне'], ...(hasReviews ? [['index.html#reviews', 'Отзывы']] : []), ...(academyOn ? [['academy.html', 'Уроки астрологии']] : [])].map(([h, t], i) => `<a href="${h}" style="transition-delay:${0.04 * i}s">${t}</a>`).join('')}</nav>
      <p class="mm-label">Бесплатно на сайте</p>
      <div class="mm-tools">${TOOLS.map(([h, t, ic]) => `<a href="${h}">${icon(ic)}<span>${t}</span></a>`).join('')}</div>
      ${premOn ? `<a class="mm-premium" data-premium-link href="premium.html">${icon('crown')}<span><b>Премиум-доступ</b><small>прогноз по датам и подробные разборы</small></span>${icon('arrow')}</a>` : ''}
      <div style="margin-top:22px;display:grid;gap:10px">
        <button class="btn btn-primary btn-block" type="button" data-book>Записаться на консультацию</button>
        ${pr ? `<p class="small center" style="margin:0"><span class="sticker sm">−${pr.percent}%</span> ${esc(pr.short)} до ${pr.end.getDate()} ${fmt.MONTHS_GEN[pr.end.getMonth()]}</p>` : ''}
      </div>
      ${isAlina() ? `<a class="mm-cabinet" href="cabinet.html">${icon('lock')} Кабинет астролога</a>` : ''}`;
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
          <div><h4>Сайт</h4>${academyOn ? '<a href="academy.html">Уроки астрологии</a>' : ''}<a href="index.html#about">Обо мне</a><a href="index.html#faq">Вопросы и ответы</a><a href="index.html#booking">Запись</a>${premOn ? '<a href="premium.html">Премиум-доступ</a>' : ''}<a href="privacy.html">Политика конфиденциальности</a>${isAlina() ? '<a href="cabinet.html" class="muted">Кабинет астролога</a>' : ''}</div>
        </div>
        <p class="disclaimer">Астрология — инструмент самопознания. Она не заменяет медицинскую, психологическую, юридическую или финансовую помощь. Расчёты: тропический зодиак, эфемериды astronomy-engine и NASA JPL; точность положений — около угловой минуты.</p>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(SITE.name)}</span><span>Иконки — Tabler Icons</span></div>
      </div>`;
    document.body.appendChild(footer);

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
    let W = 0, H = 0, dpr = 1, stars = [], shoot = null, last = 0, prevT = 0, color = '#fff', gold = '#f3d9a0';
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Звёзды — искорки ✦. Каждая форма рисуется один раз в маленький холст-спрайт, а в кадре только копируется:
    // так сотня мерцающих искорок не нагружает телефон.
    const SPR = 64, sprites = {};
    function sparklePath(g, cx, cy, R, pinch) {
      const k = R * (pinch || 0.12); // насколько «втянуты» бока между лучами: меньше — тоньше лучи
      g.beginPath(); g.moveTo(cx, cy - R);
      g.quadraticCurveTo(cx + k, cy - k, cx + R, cy); g.quadraticCurveTo(cx + k, cy + k, cx, cy + R);
      g.quadraticCurveTo(cx - k, cy + k, cx - R, cy); g.quadraticCurveTo(cx - k, cy - k, cx, cy - R);
      g.closePath();
    }
    function sprite(col, big) {
      const key = col + (big ? '*' : '');
      if (sprites[key]) return sprites[key];
      const c = document.createElement('canvas'); c.width = c.height = SPR;
      const g = c.getContext('2d'), m = SPR / 2;
      // Мягкий блюр: искорка рисуется за краем холста, а в спрайт попадает только её размытая «тень».
      // Звёзды остаются фоном и не спорят с текстом; размытие считается один раз, а не каждый кадр.
      const OFF = SPR * 4;
      g.fillStyle = col; g.shadowColor = col; g.shadowOffsetX = OFF;
      if (big) {
        g.shadowBlur = SPR * 0.3; g.globalAlpha = 0.55; sparklePath(g, m - OFF, m, SPR * 0.3, 0.16); g.fill(); // ореол
        g.shadowBlur = SPR * 0.12; g.globalAlpha = 0.9; sparklePath(g, m - OFF, m, SPR * 0.26, 0.12); g.fill();
      } else {
        g.shadowBlur = SPR * 0.13; sparklePath(g, m - OFF, m, SPR * 0.24, 0.2); g.fill();
      }
      return (sprites[key] = c);
    }
    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      color = cs.getPropertyValue('--star').trim() || '#fff';
      gold = cs.getPropertyValue('--star-gold').trim() || '#f3d9a0';
    }
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(38, Math.round((W * H) / 13000));
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      stars = Array.from({ length: n }, () => {
        const r = rnd();
        const big = r < 0.05;
        const size = big ? 18 + rnd() * 9 : r < 0.26 ? 11 + rnd() * 4 : 7.5 + rnd() * 3; // ширина искорки, px (мельче — уже не видно формы)
        return { x: rnd() * W, y: rnd() * H, size, big, gold: rnd() < 0.22, rot: (rnd() - 0.5) * 0.5, p: rnd() * Math.PI * 2, s: 0.4 + rnd() * 1.4 };
      });
      readColors();
    }
    function draw(t) {
      // мерцание медленное — хватает ~30 кадров в секунду (под стеклянными карточками небо размывается, и каждый кадр стоит дороже);
      // падающую звезду рисуем на полной частоте
      if (!reduce && !shoot && t - prevT < 30) { requestAnimationFrame(draw); return; }
      const dt = Math.min(64, t - prevT || 16.7); prevT = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      for (const s of stars) {
        const tw = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(t / 1000 * s.s + s.p); // мерцание 0…1
        ctx.globalAlpha = (0.3 + 0.7 * tw) * (dark ? 0.42 : 0.3); // едва заметные: фон не мешает чтению
        const size = s.size * 1.7 * (reduce ? 1 : 0.85 + 0.25 * tw); // размытый спрайт крупнее — видимый размер тот же
        const a = s.rot + (reduce ? 0 : Math.sin(t / 5000 + s.p) * 0.22); // лёгкое покачивание лучей
        const cos = Math.cos(a) * dpr, sin = Math.sin(a) * dpr;
        ctx.setTransform(cos, sin, -sin, cos, s.x * dpr, s.y * dpr);
        ctx.drawImage(sprite(s.gold ? gold : color, s.big), -size / 2, -size / 2, size, size);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!reduce && dark) {
        if (!shoot && t - last > 7000 && Math.random() < 0.02) { shoot = { x: Math.random() * W * 0.7 + W * 0.2, y: Math.random() * H * 0.3, l: 0 }; last = t; }
        if (shoot) {
          shoot.l += 0.84 * dt; const len = 120;
          const g = ctx.createLinearGradient(shoot.x - shoot.l, shoot.y + shoot.l * 0.45, shoot.x - shoot.l + len, shoot.y + shoot.l * 0.45 - len * 0.45);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,245,225,0.9)');
          ctx.globalAlpha = Math.max(0, 1 - shoot.l / 600) * 0.45; ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(255,245,225,.8)'; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.moveTo(shoot.x - shoot.l, shoot.y + shoot.l * 0.45); ctx.lineTo(shoot.x - shoot.l + len, shoot.y + shoot.l * 0.45 - len * 0.45); ctx.stroke();
          ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
          if (shoot.l > 600) shoot = null;
        }
      }
      ctx.globalAlpha = 1;
      if (!reduce && !document.hidden) requestAnimationFrame(draw);
    }
    resize(); window.addEventListener('resize', resize);
    document.addEventListener('themechange', () => { readColors(); if (reduce) draw(0); });
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
  // ---------- скользящая подсветка у вкладок и переключателей (.tabs, .seg) ----------
  // Под выбранной кнопкой — одна плашка, она переезжает к новой кнопке. Если переключатель перерисовали целиком
  // (гороскоп, валюта, кабинет), плашка стартует с того места, где стояла у прежнего — и тоже едет.
  const sliderMem = {}, sliderBoxes = [];
  const isOn = (b) => b.getAttribute('aria-selected') === 'true' || b.getAttribute('aria-pressed') === 'true';
  function setInd(ind, r, animate) {
    if (!animate) ind.style.transition = 'none';
    ind.style.transform = `translate(${r.x}px, ${r.y}px)`; ind.style.width = r.w + 'px'; ind.style.height = r.h + 'px'; ind.style.opacity = '1';
    if (!animate) { void ind.offsetWidth; ind.style.transition = ''; }
  }
  function placeSlider(box, animate) {
    const ind = box._ind; if (!ind || !box.isConnected) return;
    const btn = Array.from(box.children).find((b) => b.tagName === 'BUTTON' && isOn(b));
    if (!btn || !box.offsetWidth) { ind.style.opacity = '0'; return; }
    const r = { x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight };
    setInd(ind, r, animate && !reduceMotion());
    sliderMem[box._key] = r;
    // в узкой прокручиваемой полосе вкладок выбранная плавно выезжает в центр
    if (animate && box.scrollWidth > box.clientWidth + 2) box.scrollTo({ left: r.x - (box.clientWidth - r.w) / 2, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }
  function initSlider(box) {
    if (box._ind) return;
    const btns = Array.from(box.children).filter((b) => b.tagName === 'BUTTON');
    if (btns.length < 2) return;
    const ind = document.createElement('span'); ind.className = 'tab-ind'; ind.setAttribute('aria-hidden', 'true');
    box.prepend(ind); box._ind = ind; box.classList.add('has-ind'); sliderBoxes.push(box);
    box._key = btns.map((b) => b.textContent.trim()).join('|');
    const mem = sliderMem[box._key];
    if (mem && box.offsetWidth && !reduceMotion()) { setInd(ind, mem, false); requestAnimationFrame(() => placeSlider(box, true)); }
    else placeSlider(box, false);
    new MutationObserver(() => placeSlider(box, true)).observe(box, { attributes: true, subtree: true, attributeFilter: ['aria-selected', 'aria-pressed'] });
    if ('ResizeObserver' in window) {
      box._w = box.offsetWidth;
      new ResizeObserver(() => { const w = box.offsetWidth; if (w === box._w) return; box._w = w; placeSlider(box, false); }).observe(box);
    }
  }
  function sliders(root) {
    if (root && root.matches && root.matches('.tabs, .seg')) initSlider(root);
    $$('.tabs, .seg', root).forEach(initSlider);
  }
  // шрифты догрузились — ширина кнопок могла измениться
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => sliderBoxes.forEach((b) => placeSlider(b, false)));

  // новые блоки на странице (результаты, вкладки, кабинет): появление при прокрутке и подсветка переключателей
  function watchDom() {
    if (!('MutationObserver' in window)) return;
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1 && !n.classList.contains('tab-ind')) { if (revealIO) reveal(n); sliders(n); }
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.addEventListener('beforeprint', () => $$('.reveal:not(.in)').forEach((e) => e.classList.add('in')));

  // ---------- переходы между страницами: запасной вариант ----------
  // Где браузер умеет View Transitions между страницами, всё делает CSS (@view-transition).
  // Иначе (класс pt-fallback ставит скрипт в <head>): по клику содержимое тает, потом открывается новая страница, там — проявляется.
  if (document.documentElement.classList.contains('pt-fallback')) {
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      let url; try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin || !/(\.html|\/)$/.test(url.pathname)) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // якорь на этой же странице — просто прокрутка
      e.preventDefault();
      document.documentElement.classList.add('pt-leave');
      setTimeout(() => { location.href = url.href; }, 240);
    });
    // «Назад» из кэша браузера возвращает страницу как была — снимаем затухание
    window.addEventListener('pageshow', (e) => { if (e.persisted) document.documentElement.classList.remove('pt-leave'); });
  }

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
  // открыто окно — страница под ним не прокручивается (счётчик: окна могут открываться одно за другим)
  let scrollLocks = 0;
  function lockScroll(on) {
    scrollLocks = Math.max(0, scrollLocks + (on ? 1 : -1));
    document.body.classList.toggle('scroll-lock', scrollLocks > 0);
  }
  function modal(html, opts) {
    opts = opts || {};
    const back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''} ${opts.cls || ''}" role="dialog" aria-modal="true"><button class="icon-btn x" type="button" aria-label="Закрыть">${icon('close')}</button>${html}</div>`;
    document.body.appendChild(back);
    const prevFocus = document.activeElement;
    requestAnimationFrame(() => back.classList.add('open'));
    lockScroll(true);
    let closed = false;
    const close = () => { if (closed) return; closed = true; lockScroll(false); back.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => back.remove(), 300); if (prevFocus && prevFocus.focus) prevFocus.focus(); if (opts.onClose) opts.onClose(); };
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

  // ---------- дата рождения: набор цифрами (точки ставятся сами) и выбор «год → месяц → день» ----------
  // Видимое поле — текст «ДД.ММ.ГГГГ»; рядом скрытое <input type="date"> со значением ГГГГ-ММ-ДД: его читают формы
  // (FormData, birthForm), и если записать в него значение с событием input/change — видимое поле обновится само.
  const MONTH_STEMS = ['янв', 'фев', 'мар', 'апр', 'ма', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const SEP = /[.\/\-\s,]/;
  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const MONTHS_LOC = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
  function dobHTML(id, name) {
    return `<div class="dob" data-dob>
      <input class="input dob-text" id="${id}" type="text" inputmode="numeric" autocomplete="bday" placeholder="ДД.ММ.ГГГГ" spellcheck="false" aria-describedby="${id}-h">
      <button class="dob-btn" type="button" aria-label="Выбрать дату в календаре" aria-haspopup="dialog" aria-expanded="false">${icon('calendar')}</button>
      <input class="dob-iso" type="date" ${name ? `name="${name}" ` : ''}hidden tabindex="-1" aria-hidden="true">
      <span class="dob-hint" id="${id}-h" aria-live="polite"></span>
    </div>`;
  }
  /** Разбор того, что вставили целиком: «1997-06-14», «14 июня 1997», «14/6/97». → [д, м, г] или null. */
  function parseLooseDate(s) {
    s = String(s || '').trim().toLowerCase().replace(/ё/g, 'е');
    let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(s);
    if (m) return [+m[3], +m[2], +m[1]];
    m = /^(\d{1,2})\s*([а-я]+)\.?\s*(\d{2,4})/.exec(s);
    if (m) { const i = MONTH_STEMS.findIndex((st) => m[2].startsWith(st)); if (i >= 0) return [+m[1], i + 1, +m[3]]; }
    return null;
  }
  const fullYear = (yy) => (yy >= 100 ? yy : yy + (2000 + yy <= new Date().getFullYear() ? 2000 : 1900));
  /** Проверка даты: { iso, text } или { err }. */
  function checkDate(d, m, y) {
    if (!(m >= 1 && m <= 12)) return { err: 'Месяц — от 01 до 12' };
    if (!(y >= 1900 && y <= 2099)) return { err: 'Год — от 1900 до 2099' };
    if (!(d >= 1 && d <= daysIn(y, m))) return { err: `Такого дня нет: в ${MONTHS_LOC[m - 1]} ${y} года ${daysIn(y, m)} ${fmt.plural(daysIn(y, m), 'день', 'дня', 'дней')}` };
    const dt = new Date(y, m - 1, d), now = new Date();
    let age = now.getFullYear() - y - (now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d) ? 1 : 0);
    const text = `${d} ${MONTHS_GEN[m - 1]} ${y}, ${DOW_LONG[dt.getDay()]}${dt <= now && age >= 0 ? ` · ${age} ${fmt.plural(age, 'год', 'года', 'лет')}` : ''}`;
    return { iso: `${y}-${pad(m)}-${pad(d)}`, text };
  }
  /** Оживить поля даты внутри root (повторный вызов безопасен). */
  function enhanceDob(root) {
    $$('[data-dob]:not([data-ready])', root).forEach((box) => {
      box.dataset.ready = '1';
      const txt = $('.dob-text', box), iso = $('.dob-iso', box), hint = $('.dob-hint', box), btn = $('.dob-btn', box);
      let syncing = false, pop = null;
      const setHint = (t, kind) => { hint.textContent = t || ''; hint.className = 'dob-hint' + (kind ? ' ' + kind : ''); };
      function commit(final) {
        const dg = txt.value.replace(/\D/g, '');
        let res = null;
        if (dg.length === 8) res = checkDate(+dg.slice(0, 2), +dg.slice(2, 4), +dg.slice(4));
        else if (final && dg.length === 6) { const y = fullYear(+dg.slice(4)); txt.value = `${dg.slice(0, 2)}.${dg.slice(2, 4)}.${y}`; res = checkDate(+dg.slice(0, 2), +dg.slice(2, 4), y); }
        else if (final && dg.length) res = { err: 'Введите дату полностью: день, месяц, год — ДД.ММ.ГГГГ' };
        const value = res && res.iso ? res.iso : '';
        if (res && res.iso) setHint(res.text, 'ok');
        else if (res && res.err) setHint(res.err, 'bad');
        else setHint('');
        txt.classList.toggle('invalid', !!(res && res.err));
        txt.setAttribute('aria-invalid', res && res.err ? 'true' : 'false');
        if (iso.value !== value) { syncing = true; iso.value = value; iso.dispatchEvent(new Event('change', { bubbles: true })); syncing = false; }
      }
      function show(isoVal) {
        const [y, m, d] = String(isoVal || '').split('-');
        txt.value = y && m && d ? `${d}.${m}.${y}` : '';
        commit(true);
      }
      txt.addEventListener('input', () => {
        const raw = txt.value, caretEnd = txt.selectionStart >= raw.length;
        const loose = /[а-яё]/i.test(raw) || /^\s*\d{4}[-./]/.test(raw) ? parseLooseDate(raw) : null;
        if (loose) { const [d, m, y] = loose; txt.value = `${pad(d)}.${pad(m)}.${fullYear(y)}`; commit(true); return; }
        // «1.» → «01.», «14.6.» → «14.06.»: день и месяц одной цифрой с точкой
        const r = raw.replace(/^(\d)(?=[.\/\-\s,])/, '0$1').replace(/^(\d\d)[.\/\-\s,]+(\d)(?=[.\/\-\s,])/, '$1.0$2');
        const dg = r.replace(/\D/g, '').slice(0, 8);
        let out = dg.slice(0, 2);
        if (dg.length > 2) out += '.' + dg.slice(2, 4);
        if (dg.length > 4) out += '.' + dg.slice(4);
        if (SEP.test(r.slice(-1)) && (dg.length === 2 || dg.length === 4)) out += '.';
        if (out !== raw) {
          const before = r.slice(0, txt.selectionStart + (r.length - raw.length)).replace(/\D/g, '').length;
          txt.value = out;
          let pos = out.length;
          if (!caretEnd) { pos = 0; let seen = 0; while (pos < out.length && seen < before) { if (/\d/.test(out[pos])) seen++; pos++; } }
          try { txt.setSelectionRange(pos, pos); } catch (e) { /* не во всех браузерах */ }
        }
        commit(false);
      });
      txt.addEventListener('blur', () => commit(true));
      // значение записали в скрытое поле снаружи (недавние карты, клиент, проверки) — показываем его
      iso.addEventListener('input', () => { if (!syncing) show(iso.value); });
      iso.addEventListener('change', () => { if (!syncing) show(iso.value); });

      // ---- выбор в календаре: год и месяц списками, день — сеткой ----
      function closePop() {
        if (!pop) return;
        pop.remove(); pop = null; btn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', onEsc, true);
      }
      function outside(e) { if (pop && !box.contains(e.target)) closePop(); }
      function onEsc(e) { if (e.key === 'Escape' && pop) { e.stopPropagation(); closePop(); btn.focus(); } }
      function renderPop(y, m) {
        const now = new Date();
        const cur = iso.value ? iso.value.split('-').map(Number) : null;
        const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
        let cells = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => `<span class="dw">${d}</span>`).join('');
        for (let i = 0; i < lead; i++) cells += '<span></span>';
        for (let d = 1; d <= daysIn(y, m); d++) {
          const sel = cur && cur[0] === y && cur[1] === m && cur[2] === d;
          const today = now.getFullYear() === y && now.getMonth() === m - 1 && now.getDate() === d;
          cells += `<button type="button" data-d="${d}" class="${sel ? 'sel' : ''}${today ? ' today' : ''}" aria-label="${d} ${MONTHS_GEN[m - 1]} ${y}"${sel ? ' aria-pressed="true"' : ''}>${d}</button>`;
        }
        const years = []; for (let yy = now.getFullYear() + 1; yy >= 1900; yy--) years.push(yy);
        pop.innerHTML = `<div class="dob-pop-head">
            <button type="button" class="dob-nav" data-step="-1" aria-label="Предыдущий месяц">${icon('chevron-left')}</button>
            <select class="select" data-pm aria-label="Месяц">${MONTHS.map((t, i) => `<option value="${i + 1}"${i + 1 === m ? ' selected' : ''}>${t}</option>`).join('')}</select>
            <select class="select" data-py aria-label="Год">${years.map((yy) => `<option${yy === y ? ' selected' : ''}>${yy}</option>`).join('')}</select>
            <button type="button" class="dob-nav" data-step="1" aria-label="Следующий месяц">${icon('chevron-right')}</button>
          </div><div class="dob-grid">${cells}</div>`;
        pop.dataset.y = y; pop.dataset.m = m;
      }
      function openPop() {
        if (pop) { closePop(); return; }
        const cur = iso.value ? iso.value.split('-').map(Number) : null;
        const now = new Date();
        pop = document.createElement('div');
        pop.className = 'dob-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Выбор даты');
        box.appendChild(pop);
        renderPop(cur ? cur[0] : now.getFullYear() - 30, cur ? cur[1] : now.getMonth() + 1);
        // не вылезать за правый край экрана
        const r = box.getBoundingClientRect();
        if (r.left + pop.offsetWidth > window.innerWidth - 8) pop.classList.add('right');
        btn.setAttribute('aria-expanded', 'true');
        document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', onEsc, true);
        fadeIn(pop, -4);
        const f = $(cur ? '.dob-grid .sel' : '[data-py]', pop); if (f) f.focus();
        pop.addEventListener('change', (e) => { if (e.target.matches('[data-pm],[data-py]')) { renderPop(+$('[data-py]', pop).value, +$('[data-pm]', pop).value); const s = $(e.target.matches('[data-pm]') ? '[data-pm]' : '[data-py]', pop); if (s) s.focus(); } });
        pop.addEventListener('click', (e) => {
          const nav = e.target.closest('[data-step]');
          if (nav) { let y = +pop.dataset.y, m = +pop.dataset.m + +nav.dataset.step; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } if (y >= 1900 && y <= new Date().getFullYear() + 1) renderPop(y, m); const n = $(`[data-step="${nav.dataset.step}"]`, pop); if (n) n.focus(); return; }
          const day = e.target.closest('[data-d]');
          if (day) { show(`${pop.dataset.y}-${pad(+pop.dataset.m)}-${pad(+day.dataset.d)}`); closePop(); txt.focus(); }
        });
      }
      btn.addEventListener('click', openPop);
      if (iso.value) show(iso.value);
    });
  }

  // ---------- форма данных рождения ----------
  let formUid = 0;
  function birthForm(container, opts) {
    opts = opts || {};
    const u = 'bf' + (++formUid);
    container.innerHTML = `
      <div class="form" data-bf>
        ${opts.title ? `<h3 style="margin:0">${opts.title}</h3>` : ''}
        <div class="field"><label for="${u}n">Имя</label><input class="input" id="${u}n" autocomplete="off" placeholder="${opts.namePlaceholder || 'Как вас зовут?'}"></div>
        <div class="form-row dob-row">
          <div class="field"><label for="${u}d">Дата рождения</label>${dobHTML(u + 'd')}</div>
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
    enhanceDob(container);
    const dobIso = () => $('.dob-iso', el('d').parentNode);
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
        const ds = dobIso().value;
        if (!ds) { el('d').classList.add('invalid'); el('d').focus(); toast(el('d').value.trim() ? 'Проверьте дату рождения: ДД.ММ.ГГГГ' : 'Укажите дату рождения', 'calendar'); return null; }
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
        const di = dobIso(); di.value = `${p.y}-${pad(p.mo)}-${pad(p.d)}`; di.dispatchEvent(new Event('change'));
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

  // ---------- анкета на консультацию ----------
  // Календаря для клиентов нет: клиент заполняет анкету, она уходит Алине в Telegram готовым сообщением
  // (или в WhatsApp, на почту). Алина отвечает сама, уточняет детали и предлагает время из кабинета («Заявки»).
  const INTAKE = SITE.intake || {};
  function serviceOptions() {
    return SITE.services.map((s) => ({ id: s.id, title: s.title })).concat(academyOn ? [{ id: 'lessons', title: 'Индивидуальные уроки астрологии' }, { id: 'course', title: 'Курс «Астрология с нуля»' }] : [], [{ id: 'numerology', title: 'Нумерология: разбор чисел' }, { id: 'gift', title: 'Подарочный сертификат' }, { id: 'other', title: 'Другое / пока не знаю' }]);
  }
  const intakeOf = (id) => (INTAKE.services || {})[id] || {};
  /** «Берлин, UTC+2»: город по часовому поясу и смещение от UTC сейчас. */
  function tzLabel(tz) {
    if (!tz) return '';
    let off = 0;
    try {
      const o = {};
      for (const p of new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date())) o[p.type] = p.value;
      off = Math.round((Date.UTC(+o.year, o.month - 1, +o.day, +o.hour % 24, +o.minute) - Math.floor(Date.now() / 60000) * 60000) / 60000);
    } catch (e) { return tz; }
    const c = CITIES.find((x) => x.tz === tz);
    const a = Math.abs(off);
    return `${c ? c.name : tz.split('/').pop().replace(/_/g, ' ')}, UTC${off ? (off > 0 ? '+' : '−') + Math.floor(a / 60) + (a % 60 ? ':' + pad(a % 60) : '') : ''}`;
  }
  /** Подпись услуги в анкете: длительность или формат, цена (с учётом акции). */
  function serviceMeta(id) {
    const svc = SITE.services.find((s) => s.id === id);
    const fa = ((SITE.academy || {}).formats || []).find((f) => f.service === id);
    let price = '';
    if (svc && svc.price) { const p = priceFor(svc); price = `${p.old ? `<s>${money(p.old, p.code)}</s> ` : ''}<b>${money(p.now, p.code)}</b>`; }
    else if (fa && fa.price) { const p = priceOf(fa); price = `<b>${money(p.n, p.code)}</b>${fa.unit ? ' ' + esc(fa.unit) : ''}`; }
    const what = svc ? esc(svc.duration || '') : id === 'gift' ? 'красивый сертификат на любую консультацию' : id === 'numerology' ? 'разбор чисел по дате рождения и имени' : '';
    return what || price ? `${icon('info')}<span>${what}${what && price ? ' · ' : ''}${price}</span>` : '';
  }
  /** Анкета — коротко: услуга, вопрос, данные рождения одной строкой, имя и контакт. Остальное Алина уточнит сама. opts.note — подпись под кнопкой. */
  function bookingFormHTML(prefix, preset, opts) {
    const u = prefix;
    opts = opts || {};
    const svcs = serviceOptions();
    const sel = svcs.some((s) => s.id === preset) ? preset : svcs[0].id;
    return `
      <form class="form ix" data-booking novalidate>
        <div class="field"><label for="${u}service">Что вас интересует</label><select class="select" id="${u}service" name="service">${svcs.map((s) => `<option value="${s.id}"${sel === s.id ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select><span class="hint ix-meta" data-ix="meta"></span></div>
        <div class="field"><label for="${u}q"><span data-ix="qlabel">Ваш вопрос</span> <small class="ix-opt">— можно коротко</small></label><textarea class="textarea" id="${u}q" name="question" rows="2" maxlength="1500"></textarea></div>
        <div class="field" data-ix="birth"><label for="${u}b"><span data-ix="birthTitle">Дата, время и город рождения</span> <small class="ix-opt">— можно позже</small></label><input class="input" id="${u}b" name="birth" placeholder="Например: 14.06.1997, 08:30, Минск" autocomplete="off"></div>
        <div class="field" data-ix="partner" hidden><label for="${u}pt">Данные партнёра</label><input class="input" id="${u}pt" name="partner" placeholder="Имя, дата, время и город рождения" autocomplete="off"></div>
        <div class="field" data-ix="fullName" hidden><label for="${u}fn">ФИО при рождении</label><input class="input" id="${u}fn" name="fullname" placeholder="Как в свидетельстве о рождении" autocomplete="off"></div>
        ${(INTAKE.formats || []).length ? `<div class="field" data-ix="formatBox"><span class="label" id="${u}fl">Как удобнее <small class="ix-opt">— необязательно</small></span><div class="ix-chips" role="group" aria-labelledby="${u}fl">${INTAKE.formats.map((f) => `<button type="button" class="ix-chip" data-format="${esc(f.title)}" aria-pressed="false" title="${esc(f.title + (f.text ? ' — ' + f.text : ''))}">${icon(f.icon || 'sparkle')}${esc(f.short || f.title)}</button>`).join('')}</div></div>` : ''}
        <div class="form-row ix-contact">
          <div class="field"><label for="${u}name">Ваше имя *</label><input class="input" id="${u}name" name="name" required autocomplete="given-name"></div>
          <div class="field"><label for="${u}contact">Telegram или телефон *</label><input class="input" id="${u}contact" name="contact" required placeholder="@ник или +7…" autocomplete="tel"></div>
        </div>
        <label class="check ix-consent"><input type="checkbox" name="consent" required> <span>Согласен(на) на <a href="privacy.html" target="_blank">обработку данных</a></span></label>
        <button class="btn btn-primary btn-block" type="submit">${icon('telegram')} Отправить Алине в Telegram</button>
        <p class="tiny muted center" style="margin:0">${opts.note ? esc(opts.note) : `Обязательны только имя и контакт. Отвечу ${esc(INTAKE.replyTime || 'в течение дня')} и сама предложу время.`}</p>
      </form>`;
  }
  /** Показать поля под выбранную услугу: подсказка вопроса, чьи данные рождения, формат — только для встреч. */
  function intakeApply(form) {
    const id = form.querySelector('[name=service]').value, cfg = intakeOf(id);
    const q = (k) => form.querySelector(`[data-ix="${k}"]`);
    const set = (k, on) => { const el = q(k); if (el) el.hidden = !on; };
    q('meta').innerHTML = serviceMeta(id);
    form.querySelector('[name=question]').placeholder = cfg.ask || 'Что сейчас важно?';
    q('qlabel').textContent = id === 'gift' ? 'Кому и что дарите' : 'Ваш вопрос';
    q('birthTitle').textContent = cfg.birthOf ? `Дата, время и город рождения ${cfg.birthOf}` : cfg.partner ? 'Ваши дата, время и город рождения' : 'Дата, время и город рождения';
    set('birth', !cfg.noBirth);
    set('partner', !!cfg.partner);
    set('fullName', !!cfg.fullName);
    set('formatBox', id !== 'gift' && !cfg.written);
  }
  /** Текст анкеты для мессенджера и данные для сервиса форм. */
  function intakeText(form) {
    const f = new FormData(form);
    const g = (k) => String(f.get(k) || '').trim();
    const id = g('service'), cfg = intakeOf(id), svc = serviceOptions().find((s) => s.id === id);
    const fmtB = form.querySelector('[data-format][aria-pressed="true"]');
    const format = fmtB && id !== 'gift' && !cfg.written ? fmtB.dataset.format : '';
    const birth = cfg.noBirth ? '' : g('birth');
    const tz = browserTz;
    const lines = [
      id === 'gift' ? 'Здравствуйте, Алина! Хочу подарочный сертификат ✨' : 'Здравствуйте, Алина! Хочу на консультацию ✨',
      `Имя: ${g('name')}`,
      `Связь: ${g('contact')}`,
      `Услуга: ${svc ? svc.title : ''}`,
      g('question') ? `Запрос: ${g('question')}` : '',
      birth ? `Дата рождения${cfg.birthOf ? ' ' + cfg.birthOf : ''}: ${birth}` : '',
      cfg.partner && g('partner') ? `Партнёр: ${g('partner')}` : '',
      cfg.fullName && g('fullname') ? `ФИО при рождении: ${g('fullname')}` : '',
      format ? `Формат: ${format}` : '',
      tz ? `Мой часовой пояс: ${tz} (${tzLabel(tz)})` : '',
    ].filter(Boolean);
    const data = { name: g('name'), contact: g('contact'), service: svc && svc.title, question: g('question'), birth, partner: g('partner'), fullname: g('fullname'), format, timezone: tz };
    return { text: lines.join('\n'), data };
  }
  /** Анкета: формат одним нажатием, проверка и отправка. */
  function bindBooking(form, onDone) {
    intakeApply(form);
    form.querySelector('[name=service]').addEventListener('change', () => { intakeApply(form); fadeIn(form, 4); });
    form.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-format]');
      if (!chip) return;
      const on = chip.getAttribute('aria-pressed') !== 'true';
      form.querySelectorAll('[data-format]').forEach((b) => b.setAttribute('aria-pressed', String(on && b === chip)));
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      for (const k of ['name', 'contact']) {
        const el = form.querySelector(`[name=${k}]`);
        if (!el.value.trim()) { el.classList.add('invalid'); el.focus(); toast(k === 'name' ? 'Как к вам обращаться?' : 'Оставьте контакт, чтобы я могла ответить', 'user'); return; }
      }
      if (!form.querySelector('[name=consent]').checked) { toast('Отметьте согласие на обработку данных', 'info'); return; }
      goal('booking');
      const { text, data } = intakeText(form);
      if (SITE.bookingEndpoint) {
        try {
          const r = await fetch(SITE.bookingEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.assign({ message: text }, data)) });
          if (r.ok) { form.reset(); if (onDone) onDone(); thanks(); return; }
        } catch (err) { /* упадём в мессенджеры */ }
      }
      chooseChannel(text);
      if (onDone) onDone();
    });
    form.addEventListener('input', (e) => e.target.classList && e.target.classList.remove('invalid'));
  }
  const nextSteps = () => `<ol class="ix-next">
      <li>Я прочитаю анкету и отвечу ${esc(INTAKE.replyTime || 'в течение дня')}.</li>
      <li>Если нужно, уточню пару деталей — так консультация будет точнее.</li>
      <li>Предложу время по вашему часовому поясу и пришлю детали оплаты.</li></ol>`;
  function thanks() {
    modal(`<div class="center"><div style="font-size:3rem;color:var(--gold)">✦</div><h3>Спасибо! Анкета у меня</h3><p class="muted">Что будет дальше:</p></div>${nextSteps()}<div class="center"><a class="btn btn-primary" href="natal.html">Пока — моя натальная карта</a></div>`);
  }
  function chooseChannel(text) {
    const c = SITE.contacts || {};
    const btns = [];
    // ?text= подставляет анкету прямо в поле сообщения, остаётся нажать «Отправить»; на всякий случай текст ещё и копируем
    if (c.telegram) btns.push(`<a class="btn btn-primary btn-block" data-ch="tg" target="_blank" rel="noopener" href="https://t.me/${esc(c.telegram.replace(/^@/, ''))}?text=${encodeURIComponent(text)}">${icon('telegram')} Отправить в Telegram</a>`);
    if (c.whatsapp) btns.push(`<a class="btn btn-ghost btn-block" target="_blank" rel="noopener" href="https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}">${icon('whatsapp')} Отправить в WhatsApp</a>`);
    if (c.email) btns.push(`<a class="btn btn-ghost btn-block" href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Анкета на консультацию')}&body=${encodeURIComponent(text)}">${icon('mail')} Отправить на почту</a>`);
    const m = modal(`
      <h3>Анкета готова ✨</h3>
      <p class="muted">${c.telegram ? 'Нажмите «Отправить в Telegram» — текст уже будет в поле сообщения, останется отправить.' : 'Выберите, куда отправить анкету — текст уже составлен.'}</p>
      <pre class="ix-pre">${esc(text)}</pre>
      <div style="display:grid;gap:10px;margin-top:14px">${btns.join('')}<button class="btn btn-gold btn-block" type="button" data-ch="copy">${icon('copy')} Скопировать текст</button></div>
      ${btns.length ? '' : '<p class="notice info" style="margin-top:14px">' + icon('info') + '<span>Скопируйте текст анкеты и отправьте его Алине удобным способом.</span></p>'}
      <h4 style="margin:20px 0 6px">Что будет дальше</h4>${nextSteps()}`);
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ch]'); if (!b) return;
      if (b.dataset.ch === 'copy') { if (await copyText(text)) toast('Текст анкеты скопирован', 'check'); }
      if (b.dataset.ch === 'tg') { copyText(text); toast('Если поле сообщения пустое — вставьте текст: он скопирован', 'telegram'); }
    });
  }
  function openBooking(preset) {
    const pr = promoInfo();
    const m = modal(`<div class="booking-head"><img src="assets/img/alina-avatar.webp" alt="" width="64" height="64"><div><span class="eyebrow" style="margin:0">анкета</span><h3 style="margin:2px 0 0">Консультация с Алиной</h3></div></div>
      <p class="muted small" style="margin:0 0 14px">Пара строк о вашем вопросе — и анкета придёт мне в Telegram. Отвечу сама, обычно ${esc(INTAKE.replyTime || 'в течение дня')}.</p>
      ${pr ? `<div class="promo-inline"><span class="sticker">−${pr.percent}%</span><span><b>${esc(pr.title)}</b><br><small>действует до ${pr.end.getDate()} ${fmt.MONTHS_GEN[pr.end.getMonth()]}</small></span></div>` : ''}
      ${bookingFormHTML('bm', preset)}`, { cls: 'booking-modal' });
    bindBooking(m.el.querySelector('form'), () => m.close());
    return m;
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

  window.UI = { premOn, currency, setCurrency, priceOf, money, browserTz, botHref, botCta, goal, defaultCity, promoInfo, priceFor, minPrice, alinaNote, isPreview, TOOLS, icon, store, settings, saveSettings, fmt, esc, $, $$, glyph, pname, toast, modal, copyText, download, moonSVG, birthForm, recent, clients, openBooking, serviceOptions, academyOn, isAlina, bookingFormHTML, bindBooking, tzLabel, dobHTML, enhanceDob, reveal, fadeIn, reduceMotion, tabs, skyNow, contactLinks, CITIES, fmtCoord, timeZones };

  // Шапку, подвал и небо рисуем сразу (скрипт стоит в конце <body>, разметка страницы уже есть), а не по DOMContentLoaded:
  // так первый кадр страницы — и плавный переход между страницами — уже с шапкой, без мигания.
  let booted = false;
  function boot() {
    if (booted) return; booted = true;
    $$('[data-ic]').forEach((el) => { el.outerHTML = icon(el.dataset.ic); });
    $$('[data-note]').forEach((el) => { el.innerHTML = alinaNote(esc(el.dataset.note), el.dataset.noteCta || ''); });
    renderChrome();
    starfield();
  }
  if (document.body && document.querySelector('main')) boot();
  document.addEventListener('DOMContentLoaded', () => {
    boot();
    reveal();
    watchDom();
    tabs();
    sliders();
  });
})();
