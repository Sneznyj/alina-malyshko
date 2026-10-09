/* Запись через календарь: свободное время по расписанию Алины (js/schedule.js) в часовом поясе клиента.
   BookingCore — расчёт (без страницы, проверяется в Node: _dev/test_schedule.js), Booking — окно записи. */
(function () {
  'use strict';
  const G = typeof globalThis !== 'undefined' ? globalThis : window;

  // ===================== расчёт свободного времени =====================
  const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const hm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

  /** '10:30' → 630 минут (до 24:00 включительно), иначе null. */
  function toMin(s) {
    const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(s == null ? '' : s).trim());
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    if (h > 24 || mi > 59 || (h === 24 && mi)) return null;
    return h * 60 + mi;
  }
  /** '10:00-14:00, 16:00-20:00' → [[600, 840], [960, 1200]] (по порядку, пересечения склеены). */
  function parseRanges(str) {
    if (Array.isArray(str)) str = str.join(',');
    const out = [];
    for (const part of String(str || '').split(/[,;]/)) {
      const p = part.trim();
      if (!p) continue;
      const [a, b] = p.split(/\s*[-–—]\s*/);
      const s = toMin(a), e = toMin(b);
      if (s == null || e == null || e <= s) continue;
      out.push([s, e]);
    }
    out.sort((x, y) => x[0] - y[0]);
    const merged = [];
    for (const r of out) {
      const l = merged[merged.length - 1];
      if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r.slice());
    }
    return merged;
  }
  const fmtRanges = (rs) => rs.map(([s, e]) => `${hm(s)}-${hm(e)}`).join(', ');

  const dtfCache = {};
  function validTz(tz) {
    if (!tz) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
  }
  function dtf(tz) {
    return dtfCache[tz] || (dtfCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' }));
  }
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  /** Дата и время момента ms в часовом поясе tz. */
  function partsIn(ms, tz) {
    const o = {};
    for (const p of dtf(tz).formatToParts(new Date(ms))) o[p.type] = p.value;
    const hh = +o.hour === 24 ? 0 : +o.hour;
    return { y: +o.year, m: +o.month, d: +o.day, hh, mi: +o.minute, dow: WD[o.weekday], key: keyOf(+o.year, +o.month, +o.day), min: hh * 60 + +o.minute };
  }
  /** Смещение пояса от UTC в минутах в момент ms (Минск → 180). */
  function offsetMin(ms, tz) {
    const p = partsIn(ms, tz);
    return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mi) - Math.floor(ms / 60000) * 60000) / 60000);
  }
  /** Местные дата key и минуты от полуночи в поясе tz → момент UTC (мс). Учитывает переход на летнее время. */
  function wallToUtc(key, min, tz) {
    const [y, m, d] = key.split('-').map(Number);
    const guess = Date.UTC(y, m - 1, d, 0, min);
    const o1 = offsetMin(guess, tz);
    let t = guess - o1 * 60000;
    const o2 = offsetMin(t, tz);
    if (o2 !== o1) t = guess - o2 * 60000;
    return t;
  }
  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return keyOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  function dowOf(key) { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const numOr = (v, def) => (v === '' || v == null || !isFinite(+v) ? def : +v);

  /** Расписание с подставленными значениями по умолчанию. */
  function norm(raw) {
    const s = Object.assign({ timezone: 'Europe/Minsk', week: {}, daysOff: [], special: {}, busy: [], booked: [], step: 60, gap: 30, minNotice: 12, daysAhead: 30, maxPerDay: 0, durations: {} }, raw || {});
    if (!validTz(s.timezone)) s.timezone = 'Europe/Minsk';
    s.step = clamp(numOr(s.step, 60), 5, 240);
    s.gap = clamp(numOr(s.gap, 0), 0, 240);
    s.minNotice = clamp(numOr(s.minNotice, 0), 0, 24 * 60);
    s.daysAhead = clamp(numOr(s.daysAhead, 30), 1, 365);
    s.maxPerDay = Math.max(0, numOr(s.maxPerDay, 0));
    for (const k of ['daysOff', 'busy', 'booked']) if (!Array.isArray(s[k])) s[k] = [];
    if (!s.special || typeof s.special !== 'object') s.special = {};
    if (!s.week || typeof s.week !== 'object') s.week = {};
    return s;
  }
  /** Выходные и отпуск: ['2026-10-20', '2026-12-28..2027-01-08'] → [[от, до], …]. */
  function offRanges(s) {
    const out = [];
    for (const x of s.daysOff || []) {
      const [a, b] = String(x).split('..').map((t) => t.trim());
      if (!KEY_RE.test(a) || (b && !KEY_RE.test(b))) continue;
      const e = b || a;
      out.push(a <= e ? [a, e] : [e, a]);
    }
    return out;
  }
  const isOff = (s, key) => offRanges(s).some(([a, b]) => key >= a && key <= b);
  const hasSpecial = (s, key) => !!s.special && Object.prototype.hasOwnProperty.call(s.special, key);
  /** Рабочие промежутки Алины в дату key (по её поясу). */
  function hoursFor(raw, key) {
    const s = raw && raw.__norm ? raw : norm(raw);
    if (isOff(s, key)) return [];
    if (hasSpecial(s, key)) return parseRanges(s.special[key]);
    return parseRanges(s.week[DOW_KEYS[dowOf(key)]]);
  }
  /** Что за день: 'off' (выходной/отпуск), 'special' (особые часы), 'weekly-off' (выходной по неделе), 'work'. */
  function dayKind(raw, key) {
    const s = norm(raw);
    if (isOff(s, key)) return 'off';
    if (hasSpecial(s, key)) return parseRanges(s.special[key]).length ? 'special' : 'off';
    return parseRanges(s.week[DOW_KEYS[dowOf(key)]]).length ? 'work' : 'weekly-off';
  }
  const BUSY_RE = /^(\d{4}-\d{2}-\d{2})(?:[ T]+(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2}))?$/;
  /** Занятое время (busy + booked) → [{key, start, end, booked}] в мс UTC. */
  function busyOf(raw) {
    const s = norm(raw), out = [];
    for (const [list, booked] of [[s.busy, false], [s.booked, true]]) {
      for (const x of list || []) {
        const m = BUSY_RE.exec(String(x).trim());
        if (!m) continue;
        const a = m[2] ? toMin(m[2]) : 0, b = m[3] ? toMin(m[3]) : 1440;
        if (a == null || b == null || b <= a) continue;
        out.push({ key: m[1], start: wallToUtc(m[1], a, s.timezone), end: wallToUtc(m[1], b, s.timezone), booked });
      }
    }
    return out;
  }

  /** Свободные начала консультации длительностью duration минут: [{start, end, key, min}], key/min — по поясу Алины. */
  function slots(raw, duration, opts) {
    opts = opts || {};
    duration = +duration || 0;
    if (duration <= 0) return [];
    const s = norm(raw);
    s.__norm = true;
    const tz = s.timezone;
    const now = opts.now != null ? +opts.now : Date.now();
    const earliest = now + s.minNotice * 3600000;
    const last = now + s.daysAhead * 86400000;
    const busy = busyOf(s), gapMs = s.gap * 60000;
    const perDay = {};
    for (const b of busy) if (b.end - b.start < 86400000) perDay[b.key] = (perDay[b.key] || 0) + 1;
    const out = [];
    const endKey = addDays(partsIn(last, tz).key, 1);
    let key = partsIn(now, tz).key;
    for (let i = 0; i < 400 && key <= endKey; i++, key = addDays(key, 1)) {
      if (s.maxPerDay && (perDay[key] || 0) >= s.maxPerDay) continue;
      for (const [a, b] of hoursFor(s, key)) {
        for (let t = a; t + duration <= b; t += s.step) {
          const start = wallToUtc(key, t, tz), end = start + duration * 60000;
          if (start < earliest || start > last) continue;
          if (busy.some((x) => start < x.end + gapMs && end + gapMs > x.start)) continue;
          out.push({ start, end, key, min: t });
        }
      }
    }
    return out;
  }
  /** Слоты по дням в поясе клиента: Map(дата → [слоты с полем local]). */
  function byDay(list, tz) {
    const m = new Map();
    for (const x of list) {
      const p = partsIn(x.start, tz);
      if (!m.has(p.key)) m.set(p.key, []);
      m.get(p.key).push(Object.assign({}, x, { local: p }));
    }
    return m;
  }

  G.BookingCore = { toMin, hm, parseRanges, fmtRanges, validTz, partsIn, offsetMin, wallToUtc, addDays, dowOf, keyOf, norm, offRanges, isOff, hoursFor, dayKind, busyOf, slots, byDay, DOW_KEYS };

  if (typeof document === 'undefined' || !G.UI) return;

  // ===================== окно записи =====================
  const UI = G.UI, SITE = G.SITE, BC = G.BookingCore;
  const { esc, icon, fmt } = UI;
  const DOW_MON = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const DOW_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const TZ_ALIAS = { 'Europe/Kyiv': 'Europe/Kiev', 'Asia/Calcutta': 'Asia/Kolkata' };
  const TZ_CITY = {};
  for (const c of UI.CITIES) if (!TZ_CITY[c.tz]) TZ_CITY[c.tz] = c.name;

  const liveSchedule = () => G.SCHEDULE || null;
  const durationOf = (sched, id) => { const d = (sched && sched.durations) || {}; return Math.max(0, +d[id] || 0); };
  /** Название пояса по-человечески: «Берлин», иначе последняя часть идентификатора. */
  const tzCity = (tz) => TZ_CITY[tz] || TZ_CITY[TZ_ALIAS[tz]] || String(tz).split('/').pop().replace(/_/g, ' ');
  function utcLabel(tz, ms) {
    const o = BC.offsetMin(ms || Date.now(), tz);
    if (!o) return 'UTC';
    const a = Math.abs(o);
    return `UTC${o > 0 ? '+' : '−'}${Math.floor(a / 60)}${a % 60 ? ':' + pad(a % 60) : ''}`;
  }
  const tzLabel = (tz, ms) => `${tzCity(tz)}, ${utcLabel(tz, ms)}`;
  function durLabel(min) {
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return `${m} мин`;
    if (m === 30) return `${h},5 часа`;
    if (!m) return `${h} ${fmt.plural(h, 'час', 'часа', 'часов')}`;
    return `${h} ч ${m} мин`;
  }
  const dmy = (p) => `${pad(p.d)}.${pad(p.m)}.${p.y}`;
  const dayTitle = (key) => { const [y, m, d] = key.split('-').map(Number); const w = fmt.DOW_LONG[BC.dowOf(key)]; return `${w[0].toUpperCase() + w.slice(1)}, ${d} ${fmt.MONTHS_GEN[m - 1]}`; };
  const monthTitle = (ym) => { const [y, m] = ym.split('-').map(Number); return `${fmt.MONTHS[m - 1]} ${y}`; };
  const ymOf = (key) => key.slice(0, 7);
  const addMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`; };
  function clientTz() {
    const saved = UI.store.get('bookTz', null);
    if (saved && BC.validTz(saved)) return saved;
    if (UI.browserTz && BC.validTz(UI.browserTz)) return UI.browserTz;
    return (liveSchedule() || {}).timezone || 'Europe/Moscow';
  }
  /** Подпись услуги: длительность, формат, цена (с учётом акции). */
  function serviceMeta(id, dur) {
    const svc = SITE.services.find((s) => s.id === id);
    const fmtA = ((SITE.academy || {}).formats || []).find((f) => f.service === id);
    let price = '';
    if (svc && svc.price) { const p = UI.priceFor(svc); price = `${p.old ? `<s>${UI.money(p.old, p.code)}</s> ` : ''}<b>${UI.money(p.now, p.code)}</b>`; }
    else if (fmtA && fmtA.price) { const p = UI.priceOf(fmtA); price = `<b>${UI.money(p.n, p.code)}</b>${fmtA.unit ? ' ' + esc(fmtA.unit) : ''}`; }
    const what = dur ? `${durLabel(dur)} · онлайн по видеосвязи` : svc ? esc(svc.duration || '') : id === 'gift' ? 'красивый сертификат на любую услугу' : '';
    return what || price ? `<span class="hint bk-meta">${icon(dur ? 'clock' : 'info')}<span>${what}${what && price ? ' · ' : ''}${price}</span></span>` : '';
  }
  function noSlotText(id) {
    if (id === 'gift') return 'Сертификат — без встречи: напишу, как оформить и вручить.';
    if (id === 'course') return 'Набор в группу скоро — оставьте заявку, напишу первой.';
    if (id === 'other') return 'Напишите, что вас интересует, — подскажу и подберём время.';
    return 'Эта услуга без встречи по времени — ответ пришлю письменно или голосовым. Просто оставьте заявку.';
  }

  let uid = 0;
  /**
   * Запись по шагам: 1) услуга, день и время  2) контакты.
   * opts: preset — услуга; prefix — для id полей; onDone — после отправки;
   *       schedule() — своё расписание (кабинет, предпросмотр); preview — только первый шаг, без отправки.
   */
  function widget(root, opts) {
    opts = opts || {};
    const u = (opts.prefix || 'bk') + (++uid);
    const getSched = () => (opts.schedule ? opts.schedule() : liveSchedule());
    const services = UI.serviceOptions();
    const st = { service: services.some((s) => s.id === opts.preset) ? opts.preset : services[0].id, tz: clientTz(), day: null, month: null, slot: null, step: 1, flex: false, tzOpen: false, list: [], days: new Map(), dur: 0 };
    root.classList.add('bk');

    function compute() {
      const s = getSched();
      const now = Date.now();
      st.now = now;
      st.dur = s ? durationOf(s, st.service) : 0;
      st.list = st.dur ? BC.slots(s, st.dur, { now }) : [];
      st.days = BC.byDay(st.list, st.tz);
      if (st.slot) st.slot = st.list.find((x) => x.start === st.slot.start) || null;
      if (!st.day && st.slot) st.day = BC.partsIn(st.slot.start, st.tz).key;
      if (!st.day || !st.days.has(st.day)) st.day = st.days.size ? st.days.keys().next().value : null;
      const s0 = BC.norm(s);
      st.minYm = ymOf(BC.partsIn(now, st.tz).key);
      st.maxYm = ymOf(BC.partsIn(now + s0.daysAhead * 86400000, st.tz).key);
      if (!st.month || st.month < st.minYm || st.month > st.maxYm) st.month = st.day ? ymOf(st.day) : st.minYm;
    }

    const stepsHTML = () => `<ol class="bk-steps" aria-label="Шаги записи">
        <li class="${st.step === 1 ? 'on' : 'done'}"><span>${st.step > 1 ? icon('check') : '1'}</span>${st.dur ? 'Дата и время' : 'Услуга'}</li>
        <li class="${st.step === 2 ? 'on' : ''}"><span>2</span>Ваши данные</li></ol>`;

    function calHTML() {
      const [y, m] = st.month.split('-').map(Number);
      const startDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
      const nDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const today = BC.partsIn(st.now, st.tz).key;
      let cells = DOW_MON.map((d) => `<span class="dw" aria-hidden="true">${d}</span>`).join('');
      for (let i = 0; i < startDow; i++) cells += '<span></span>';
      for (let d = 1; d <= nDays; d++) {
        const key = BC.keyOf(y, m, d), n = (st.days.get(key) || []).length;
        const cls = [n ? 'av' : '', key === st.day ? 'sel' : '', key === today ? 'today' : '', key < today ? 'past' : ''].filter(Boolean).join(' ');
        cells += `<button type="button" class="bk-d ${cls}" data-day="${key}"${n ? '' : ' disabled'} aria-pressed="${key === st.day}" aria-label="${d} ${fmt.MONTHS_GEN[m - 1]}${n ? ` — свободно ${n} ${fmt.plural(n, 'вариант', 'варианта', 'вариантов')}` : ' — нет времени'}">${d}</button>`;
      }
      return `<div class="bk-cal">
          <div class="bk-cal-head"><button type="button" class="bk-nav" data-bk="prev" aria-label="Предыдущий месяц"${st.month <= st.minYm ? ' disabled' : ''}>${icon('chevron-left')}</button>
            <b aria-live="polite">${monthTitle(st.month)}</b>
            <button type="button" class="bk-nav" data-bk="nextm" aria-label="Следующий месяц"${st.month >= st.maxYm ? ' disabled' : ''}>${icon('chevron-right')}</button></div>
          <div class="bk-grid">${cells}</div>
          <p class="bk-legend tiny muted"><i aria-hidden="true"></i>есть свободное время</p>
        </div>`;
    }
    function timesHTML() {
      const list = st.days.get(st.day) || [];
      if (!st.day || !list.length) return '<div class="bk-times"><p class="muted small">В этом месяце свободных дней нет — переключите месяц.</p></div>';
      const groups = [];
      for (const x of list) {
        const h = x.local.hh;
        const g = h < 5 ? ['moon-2', 'Ночь'] : h < 12 ? ['sunrise', 'Утро'] : h < 17 ? ['sun-high', 'День'] : h < 23 ? ['moon', 'Вечер'] : ['moon-2', 'Ночь'];
        if (!groups.length || groups[groups.length - 1].name !== g[1]) groups.push({ ic: g[0], name: g[1], items: [] });
        groups[groups.length - 1].items.push(x);
      }
      const chosen = st.slot && list.some((x) => x.start === st.slot.start)
        ? `<p class="bk-chosen">${icon('calendar-check')}<span>${BC.hm(BC.partsIn(st.slot.start, st.tz).min)}–${BC.hm(BC.partsIn(st.slot.end, st.tz).min)} · ${durLabel(st.dur)}</span></p>` : '';
      return `<div class="bk-times"><div class="bk-day-title">${dayTitle(st.day)}</div>
        ${groups.map((g) => `<div class="bk-group"><span class="bk-gl">${icon(g.ic)}${g.name}</span><div class="bk-chips">${g.items.map((x) => `<button type="button" class="bk-chip" data-slot="${x.start}" aria-pressed="${!!st.slot && st.slot.start === x.start}">${BC.hm(x.local.min)}</button>`).join('')}</div></div>`).join('')}
        ${chosen}</div>`;
    }
    function tzHTML() {
      return `<div class="bk-tz">${icon('world-pin')}<span>Время показано по вашему часовому поясу: <b>${esc(tzLabel(st.tz, st.now))}</b></span>
        <button type="button" class="bk-link" data-bk="tz" aria-expanded="${st.tzOpen}">${st.tzOpen ? 'готово' : 'изменить'}</button>
        ${st.tzOpen ? `<select class="select" data-bk="tzsel" aria-label="Ваш часовой пояс">${UI.timeZones().concat(UI.timeZones().includes(st.tz) ? [] : [st.tz]).map((z) => `<option${z === st.tz ? ' selected' : ''}>${esc(z)}</option>`).join('')}</select>` : ''}</div>`;
    }
    function step1() {
      const opts1 = services.map((s) => `<option value="${s.id}"${s.id === st.service ? ' selected' : ''}>${esc(s.title)}</option>`).join('');
      let body;
      if (!st.dur) body = `<p class="notice info">${icon('info')}<span>${noSlotText(st.service)}</span></p>`;
      else if (!st.list.length) body = `<p class="notice">${icon('calendar-off')}<span>В ближайшие недели свободного времени в календаре нет. Оставьте заявку — я предложу ближайшее окно.</span></p>`;
      else body = `<div class="bk-pick">${calHTML()}${timesHTML()}</div>${tzHTML()}`;
      const canNext = !st.dur || !st.list.length || !!st.slot;
      return `${stepsHTML()}
        <div class="field"><label for="${u}svc">Что вас интересует</label><select class="select" id="${u}svc" data-bk="service">${opts1}</select>${serviceMeta(st.service, st.dur)}</div>
        <div class="bk-body">${body}</div>
        <div class="bk-actions"><button class="btn btn-primary" type="button" data-bk="next"${canNext ? '' : ' disabled'}>${opts.preview ? 'Далее' : st.dur && st.list.length && !st.slot ? 'Выберите время' : 'Далее'} ${icon('arrow')}</button>
          ${st.dur && st.list.length ? '<button class="bk-link" type="button" data-bk="flex">Нет удобного времени? Подберём вместе</button>' : ''}</div>`;
    }
    function step2() {
      const svc = services.find((s) => s.id === st.service);
      let sum;
      if (st.slot) {
        const a = BC.partsIn(st.slot.start, st.tz), b = BC.partsIn(st.slot.end, st.tz);
        sum = `<b>${dayTitle(a.key)} · ${BC.hm(a.min)}–${BC.hm(b.min)}</b><small>${esc(svc.title)} · время ваше (${esc(tzCity(st.tz))})</small>`;
      } else if (st.dur) sum = `<b>Время подберём вместе</b><small>${esc(svc.title)} · напишу и предложу варианты</small>`;
      else sum = `<b>${esc(svc.title)}</b><small>${esc(noSlotText(st.service))}</small>`;
      return `${stepsHTML()}
        <div class="bk-summary">${icon(st.slot ? 'calendar-check' : st.dur ? 'calendar-time' : 'sparkle')}<div>${sum}</div><button class="btn btn-ghost btn-xs" type="button" data-bk="back">${icon('arrow-left')} Изменить</button></div>
        ${UI.bookingFormHTML(u, st.service, { noService: true, prefer: !st.slot && !!st.dur, note: st.slot ? 'Отвечу в течение дня и подтвержу время. Данные рождения можно прислать и позже.' : 'Отвечаю в течение дня. Данные рождения можно прислать и позже.' })}`;
    }

    /** Строки о времени для текста заявки. */
    function extra(f) {
      const s = BC.norm(getSched());
      const lines = [], data = { clientTz: st.tz };
      if (st.slot) {
        const a = BC.partsIn(st.slot.start, st.tz), b = BC.partsIn(st.slot.end, st.tz);
        const same = BC.offsetMin(st.slot.start, st.tz) === BC.offsetMin(st.slot.start, s.timezone);
        lines.push(`Время: ${DOW_SHORT[a.dow]} ${dmy(a)}, ${BC.hm(a.min)}–${BC.hm(b.min)} — ${same ? 'у нас одинаковое время' : 'моё время'} (${tzLabel(st.tz, st.slot.start)})`);
        if (!same) {
          const A = BC.partsIn(st.slot.start, s.timezone), B = BC.partsIn(st.slot.end, s.timezone);
          lines.push(`По вашему времени (${tzCity(s.timezone)}): ${DOW_SHORT[A.dow]} ${dmy(A)}, ${BC.hm(A.min)}–${BC.hm(B.min)}`);
        }
        data.slotStart = new Date(st.slot.start).toISOString();
        data.slotEnd = new Date(st.slot.end).toISOString();
      } else if (st.dur) {
        lines.push('Время: подберём вместе');
        const pref = String(f.get('prefer') || '').trim();
        if (pref) { lines.push(`Мне удобно: ${pref}`); data.prefer = pref; }
      }
      return { lines, data, tz: st.tz };
    }

    function render(focus) {
      if (st.step === 1) compute();
      root.innerHTML = st.step === 1 ? step1() : step2();
      if (st.step === 2) {
        const form = root.querySelector('form');
        UI.bindBooking(form, opts.onDone, extra);
        if (focus) setTimeout(() => { const n = form.querySelector('[name=name]'); if (n) n.focus({ preventScroll: true }); }, 60);
      }
      if (focus) UI.fadeIn(root, 8);
    }
    function scrollTo(el) { if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: UI.reduceMotion() ? 'auto' : 'smooth' }); }
    function goStep(n) {
      st.step = n;
      render(true);
      const top = root.querySelector('.bk-steps');
      if (opts.scrollTop !== false) scrollTo(top);
    }

    root.addEventListener('click', (e) => {
      const day = e.target.closest('[data-day]');
      if (day && !day.disabled) {
        st.day = day.dataset.day;
        if (st.slot && !(st.days.get(st.day) || []).some((x) => x.start === st.slot.start)) st.slot = null;
        render();
        UI.fadeIn(root.querySelector('.bk-times'), 6);
        if (window.innerWidth < 700) scrollTo(root.querySelector('.bk-times'));
        return;
      }
      const chip = e.target.closest('[data-slot]');
      if (chip) {
        st.slot = st.list.find((x) => x.start === +chip.dataset.slot) || null;
        st.flex = false;
        render();
        scrollTo(root.querySelector('.bk-actions'));
        const nb = root.querySelector('[data-bk="next"]'); if (nb) nb.focus({ preventScroll: true });
        return;
      }
      const b = e.target.closest('[data-bk]');
      if (!b || b.tagName === 'SELECT') return;
      const k = b.dataset.bk;
      if (k === 'prev' || k === 'nextm') {
        st.month = addMonth(st.month, k === 'prev' ? -1 : 1);
        const first = Array.from(st.days.keys()).find((x) => ymOf(x) === st.month);
        if (first) st.day = first;
        render();
        UI.fadeIn(root.querySelector('.bk-pick'), 4);
      }
      if (k === 'tz') { st.tzOpen = !st.tzOpen; render(); if (st.tzOpen) { const s = root.querySelector('[data-bk="tzsel"]'); if (s) s.focus(); } }
      if (k === 'flex') { st.slot = null; st.flex = true; if (opts.preview) { UI.toast('Здесь клиент перейдёт к форме: «время подберём вместе»', 'info'); return; } goStep(2); }
      if (k === 'next') {
        if (opts.preview) { UI.toast(st.slot ? 'Дальше клиент оставит контакты — это предпросмотр' : 'Сначала выберите время', 'info'); return; }
        if (st.dur && st.list.length && !st.slot) { UI.toast('Выберите удобное время', 'clock'); return; }
        goStep(2);
      }
      if (k === 'back') goStep(1);
    });
    root.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.bk === 'service') { st.service = t.value; st.slot = null; st.day = null; st.month = null; render(); UI.fadeIn(root.querySelector('.bk-body'), 6); }
      if (t.dataset.bk === 'tzsel' && BC.validTz(t.value)) { st.tz = t.value; UI.store.set('bookTz', t.value); st.day = null; st.month = null; st.slot = st.slot && { start: st.slot.start }; render(); }
    });

    render();
    return {
      refresh() { if (st.step === 1) render(); },
      setService(id) { if (services.some((s) => s.id === id)) { st.service = id; st.slot = null; st.day = null; st.month = null; st.step = 1; render(); } },
      state: st,
    };
  }

  /** Окно записи поверх страницы (кнопки «Записаться»). */
  function open(preset) {
    const pr = UI.promoInfo();
    const m = UI.modal(`<div class="booking-head"><img src="assets/img/alina-avatar.webp" alt="" width="64" height="64"><div><span class="eyebrow" style="margin:0">запись</span><h3 style="margin:2px 0 0">Консультация с Алиной</h3></div></div>
      <p class="muted small" style="margin:0 0 14px">Выберите удобный день и время — я подтвержу запись сама.</p>
      ${pr ? `<div class="promo-inline"><span class="sticker">−${pr.percent}%</span><span><b>${esc(pr.title)}</b><br><small>действует до ${pr.end.getDate()} ${fmt.MONTHS_GEN[pr.end.getMonth()]}</small></span></div>` : ''}
      <div class="bk-root"></div>`, { cls: 'booking-modal' });
    widget(m.el.querySelector('.bk-root'), { preset, prefix: 'bm', onDone: () => m.close() });
    return m;
  }

  G.Booking = { widget, open, tzCity, tzLabel, durLabel, dayTitle, liveSchedule, durationOf };
})();
