/* Свободное время Алины по её расписанию — только для кабинета (Заявки → «Предложить время», Расписание).
   Клиенты календаря не видят: они присылают анкету, а время Алина предлагает сама, уже по часам клиента.
   BookingCore — расчёт (без страницы, проверяется в Node: _dev/test_schedule.js), Booking — подписи для кабинета. */
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

  // ===================== подписи для кабинета =====================
  const UI = G.UI, BC = G.BookingCore;
  const { fmt } = UI;
  const TZ_ALIAS = { 'Europe/Kyiv': 'Europe/Kiev', 'Asia/Calcutta': 'Asia/Kolkata' };
  const TZ_CITY = {};
  for (const c of UI.CITIES) if (!TZ_CITY[c.tz]) TZ_CITY[c.tz] = c.name;

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
  const dayTitle = (key) => { const [, m, d] = key.split('-').map(Number); const w = fmt.DOW_LONG[BC.dowOf(key)]; return `${w[0].toUpperCase() + w.slice(1)}, ${d} ${fmt.MONTHS_GEN[m - 1]}`; };

  G.Booking = { tzCity, tzLabel, durLabel, dayTitle, durationOf };
})();
