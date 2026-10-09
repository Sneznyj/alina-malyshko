/* Профессиональные расчёты (как в астропроцессорах Sotis и Chronos): только числа и таблицы, без толкований.
   Толкования к ним — в премиуме (_private/pro-texts.js → window.ProTexts). Показ — js/pro-view.js.
   Всё считается в браузере: AstroCore (js/astro.js) + astronomy-engine (window.Astronomy). */
(function (root) {
  'use strict';
  const AC = root.AstroCore, Astro = root.Astronomy;
  const { norm, d180, signIndex } = AC;
  const SIGNS = AC.SIGNS;
  const SEVEN = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const TEN = AC.PLANETS;
  const CHALDEAN = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];
  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
  const lon = (id, d) => AC.body(id, d).lon;

  // ---------- 1. Эссенциальные достоинства (Птолемей, Лилли) ----------
  const TRAD = AC.TRAD_RULER;
  const EXALT = { sun: 'aries', moon: 'taurus', mercury: 'virgo', venus: 'pisces', mars: 'capricorn', jupiter: 'cancer', saturn: 'libra' };
  const EXALT_BY_SIGN = Object.fromEntries(Object.entries(EXALT).map(([p, s]) => [s, p]));
  // триплицитеты по Доротею: [днём, ночью, соуправитель]
  const TRIP = { fire: ['sun', 'jupiter', 'saturn'], earth: ['venus', 'moon', 'mars'], air: ['saturn', 'mercury', 'jupiter'], water: ['venus', 'mars', 'moon'] };
  // египетские термы: [управитель, до градуса]
  const TERMS = [
    [['jupiter', 6], ['venus', 12], ['mercury', 20], ['mars', 25], ['saturn', 30]],
    [['venus', 8], ['mercury', 14], ['jupiter', 22], ['saturn', 27], ['mars', 30]],
    [['mercury', 6], ['jupiter', 12], ['venus', 17], ['mars', 24], ['saturn', 30]],
    [['mars', 7], ['venus', 13], ['mercury', 19], ['jupiter', 26], ['saturn', 30]],
    [['jupiter', 6], ['venus', 11], ['saturn', 18], ['mercury', 24], ['mars', 30]],
    [['mercury', 7], ['venus', 17], ['jupiter', 21], ['mars', 28], ['saturn', 30]],
    [['saturn', 6], ['mercury', 14], ['jupiter', 21], ['venus', 28], ['mars', 30]],
    [['mars', 7], ['venus', 11], ['mercury', 19], ['jupiter', 24], ['saturn', 30]],
    [['jupiter', 12], ['venus', 17], ['mercury', 21], ['saturn', 26], ['mars', 30]],
    [['mercury', 7], ['jupiter', 14], ['venus', 22], ['saturn', 26], ['mars', 30]],
    [['mercury', 7], ['venus', 13], ['jupiter', 20], ['mars', 25], ['saturn', 30]],
    [['venus', 12], ['jupiter', 16], ['mercury', 19], ['mars', 28], ['saturn', 30]],
  ];
  const FACE_ORDER = ['mars', 'sun', 'venus', 'mercury', 'moon', 'saturn', 'jupiter'];
  const termOf = (l) => { const si = signIndex(l), d = norm(l) % 30; return TERMS[si].find(([, to]) => d < to)[0]; };
  const faceOf = (l) => FACE_ORDER[Math.floor(norm(l) / 10) % 7];
  const tripOf = (si, day) => { const t = TRIP[AC.ELEMENT[si % 4]]; return day === false ? t[1] : t[0]; };
  /** Таблица достоинств семи планет. day — дневная карта (true/false/null — неизвестно, берём дневного управителя). */
  function dignities(chart) {
    const day = chart.houses ? chart.houses.dayChart : null;
    return SEVEN.map((id) => {
      const p = chart.byId[id], si = p.signIndex, sign = SIGNS[si];
      const rows = [];
      let score = 0;
      if (TRAD[sign] === id) { score += 5; rows.push('domicile'); }
      if (EXALT[id] === sign) { score += 4; rows.push('exaltation'); }
      const tr = TRIP[AC.ELEMENT[si % 4]];
      if ((day !== false && tr[0] === id) || (day === false && tr[1] === id)) { score += 3; rows.push('triplicity'); }
      if (termOf(p.lon) === id) { score += 2; rows.push('term'); }
      if (faceOf(p.lon) === id) { score += 1; rows.push('face'); }
      const detr = TRAD[SIGNS[(si + 6) % 12]] === id, fall = EXALT[id] === SIGNS[(si + 6) % 12];
      if (detr) { score -= 5; rows.push('detriment'); }
      if (fall) { score -= 4; rows.push('fall'); }
      const peregrine = !rows.some((r) => ['domicile', 'exaltation', 'triplicity', 'term', 'face'].includes(r));
      if (peregrine) score -= 5;
      return { id, lon: p.lon, sign, ruler: TRAD[sign], exaltation: EXALT_BY_SIGN[sign] || null, triplicity: tripOf(si, day), term: termOf(p.lon), face: faceOf(p.lon), has: rows, peregrine, score, retro: !!p.retro };
    });
  }
  /** Рецепции по обителям (традиционные управители): взаимная — две планеты в знаках друг друга. */
  function receptions(chart) {
    const out = [];
    for (let i = 0; i < SEVEN.length; i++) for (let j = i + 1; j < SEVEN.length; j++) {
      const a = chart.byId[SEVEN[i]], b = chart.byId[SEVEN[j]];
      if (TRAD[a.sign] === b.id && TRAD[b.sign] === a.id) out.push({ a: a.id, b: b.id, kind: 'domicile' });
      else if (EXALT_BY_SIGN[a.sign] === b.id && EXALT_BY_SIGN[b.sign] === a.id) out.push({ a: a.id, b: b.id, kind: 'exaltation' });
    }
    return out;
  }

  // ---------- 2. Диспозиторы ----------
  /** Цепочки управителей (по современным управителям AC.RULER, как в большинстве программ). */
  function dispositors(chart, traditional) {
    const R = traditional ? TRAD : AC.RULER;
    const ids = traditional ? SEVEN : TEN;
    const next = (id) => R[chart.byId[id].sign];
    const chains = ids.map((id) => {
      const path = [id];
      let cur = id;
      for (let k = 0; k < 12; k++) { const n = next(cur); if (path.includes(n)) { path.push(n); break; } path.push(n); cur = n; }
      return path;
    });
    const self = ids.filter((id) => next(id) === id); // в своей обители
    // конечный диспозитор: одна планета в обители, к которой сходятся все цепочки
    const ends = new Set(chains.map((c) => { const last = c[c.length - 1]; return next(last) === last ? last : null; }));
    const final = ends.size === 1 && !ends.has(null) ? [...ends][0] : null;
    // петли (взаимная рецепция и длиннее)
    const loops = [];
    for (const c of chains) {
      const last = c[c.length - 1], i = c.indexOf(last);
      if (i < c.length - 1 && next(last) !== last) { const loop = c.slice(i, c.length - 1); const key = [...loop].sort().join(','); if (!loops.some((l) => [...l].sort().join(',') === key)) loops.push(loop); }
    }
    return { chains, self, final, loops };
  }

  // ---------- 3. Фигуры аспектов и форма карты ----------
  const PAT_ORB = { 0: 8, 60: 5, 90: 7, 120: 7, 150: 2.5, 180: 8 };
  function angleBetween(a, b) { return Math.abs(d180(b - a)); }
  function isAsp(a, b, ang) { return Math.abs(angleBetween(a, b) - ang) <= PAT_ORB[ang]; }
  /** Большой трин, тау-квадрат, большой крест, йод, воздушный змей, мистический прямоугольник, стеллиумы. */
  function patterns(chart) {
    const ids = TEN.filter((id) => chart.byId[id]);
    const L = (id) => chart.byId[id].lon;
    const out = [];
    const add = (type, planets, extra) => { const key = type + ':' + [...planets].sort().join(','); if (!out.some((x) => x.key === key)) out.push(Object.assign({ type, planets, key }, extra || {})); };
    const n = ids.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
      const a = ids[i], b = ids[j], c = ids[k];
      if (isAsp(L(a), L(b), 120) && isAsp(L(b), L(c), 120) && isAsp(L(a), L(c), 120)) add('grandTrine', [a, b, c], { element: AC.ELEMENT[chart.byId[a].signIndex % 4] });
      for (const [x, y, z] of [[a, b, c], [a, c, b], [b, c, a]]) {
        if (isAsp(L(x), L(y), 180) && isAsp(L(x), L(z), 90) && isAsp(L(y), L(z), 90)) add('tSquare', [x, y, z], { apex: z });
        if (isAsp(L(x), L(y), 60) && isAsp(L(x), L(z), 150) && isAsp(L(y), L(z), 150)) add('yod', [x, y, z], { apex: z });
      }
    }
    // крест и прямоугольник/змей — из пар оппозиций
    const opps = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (isAsp(L(ids[i]), L(ids[j]), 180)) opps.push([ids[i], ids[j]]);
    for (let i = 0; i < opps.length; i++) for (let j = i + 1; j < opps.length; j++) {
      const [a, b] = opps[i], [c, d] = opps[j];
      if (new Set([a, b, c, d]).size < 4) continue;
      if (isAsp(L(a), L(c), 90) && isAsp(L(a), L(d), 90) && isAsp(L(b), L(c), 90) && isAsp(L(b), L(d), 90)) add('grandCross', [a, b, c, d]);
      const tri = (p, q) => isAsp(L(p), L(q), 120), sex = (p, q) => isAsp(L(p), L(q), 60);
      if ((tri(a, c) && sex(a, d) && sex(b, c) && tri(b, d)) || (sex(a, c) && tri(a, d) && tri(b, c) && sex(b, d))) add('mysticRectangle', [a, b, c, d]);
    }
    for (const gt of out.filter((x) => x.type === 'grandTrine')) {
      for (const id of ids) {
        if (gt.planets.includes(id)) continue;
        for (const p of gt.planets) {
          const others = gt.planets.filter((x) => x !== p);
          if (isAsp(L(id), L(p), 180) && others.every((o) => isAsp(L(id), L(o), 60))) add('kite', gt.planets.concat(id), { apex: id, base: p });
        }
      }
    }
    for (const s of chart.summary.stelliums) add('stellium', s.planets, { where: s.where, kind: s.kind });
    return out.map(({ key, ...x }) => x);
  }
  /** Форма карты по Марку Джонсу: связка, чаша, ведро, локомотив, качели, веер, брызги. */
  function jonesShape(chart) {
    const ls = TEN.map((id) => ({ id, lon: chart.byId[id].lon })).sort((a, b) => a.lon - b.lon);
    const gaps = ls.map((p, i) => ({ after: p.id, before: ls[(i + 1) % ls.length].id, size: norm(ls[(i + 1) % ls.length].lon - p.lon) || 360 }));
    const sorted = gaps.slice().sort((a, b) => b.size - a.size);
    const max = sorted[0].size;
    const occupied = new Set(ls.map((p) => signIndex(p.lon))).size;
    let shape, extra = {};
    if (max >= 240) shape = 'bundle';
    else if (max >= 180) shape = 'bowl';
    else {
      // ведро: если убрать одну планету, остальные укладываются в 180° и эта планета — по другую сторону
      for (const p of ls) {
        const rest = ls.filter((x) => x !== p);
        const rg = rest.map((x, i) => norm(rest[(i + 1) % rest.length].lon - x.lon) || 360);
        const m = Math.max(...rg);
        if (m >= 180) {
          const i = rg.indexOf(m), from = rest[i].lon, to = rest[(i + 1) % rest.length].lon;
          if (norm(p.lon - from) > 30 && norm(to - p.lon) > 30) { shape = 'bucket'; extra = { handle: p.id }; break; }
        }
      }
      if (!shape && max >= 120) shape = 'locomotive', extra = { leader: sorted[0].before };
      if (!shape && sorted[1].size >= 60 && sorted[0].size >= 60) {
        const g1 = gaps.indexOf(sorted[0]), g2 = gaps.indexOf(sorted[1]);
        const between = Math.abs(g1 - g2);
        if (between >= 2 && ls.length - between >= 2) shape = 'seesaw';
      }
      if (!shape) shape = occupied >= 7 && max <= 60 ? 'splash' : 'splay';
    }
    return Object.assign({ shape, maxGap: max, occupied }, extra);
  }
  /** Сила домов: планеты в доме, достоинство и угловость управителя, угловые дома. */
  function houseStrength(chart) {
    if (!chart.houses) return null;
    const W = { sun: 3, moon: 3, mercury: 2, venus: 2, mars: 2, jupiter: 1.5, saturn: 1.5, uranus: 1, neptune: 1, pluto: 1, node: 0.5 };
    const dig = Object.fromEntries(dignities(chart).map((d) => [d.id, d.score]));
    const out = [];
    for (let h = 1; h <= 12; h++) {
      const cusp = chart.houses.cusps[h - 1], sign = SIGNS[signIndex(cusp)];
      const ruler = AC.RULER[sign], rp = chart.byId[ruler];
      const inside = Object.keys(W).filter((id) => chart.byId[id] && chart.byId[id].house === h);
      let score = inside.reduce((s, id) => s + W[id], 0);
      if ([1, 4, 7, 10].includes(h)) score += 1.5; else if ([2, 5, 8, 11].includes(h)) score += 0.5;
      const rd = dig[TRAD[sign]] != null ? dig[TRAD[sign]] : 0;
      score += Math.max(-2, Math.min(3, rd / 3));
      if (rp && [1, 4, 7, 10].includes(rp.house)) score += 1;
      out.push({ house: h, sign, ruler, rulerHouse: rp ? rp.house : null, planets: inside, score: Math.round(score * 10) / 10 });
    }
    const by = out.slice().sort((a, b) => b.score - a.score);
    return { list: out, strong: by.slice(0, 3).map((x) => x.house), weak: by.slice(-3).reverse().map((x) => x.house) };
  }

  // ---------- 4. Мидпоинты (Гамбургская школа / космобиология) ----------
  const MID_IDS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'node', 'asc', 'mc'];
  function midpoints(chart, orb) {
    orb = orb || 1.5;
    const ids = MID_IDS.filter((id) => chart.byId[id]);
    const list = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = chart.byId[ids[i]].lon, b = chart.byId[ids[j]].lon;
      list.push({ a: ids[i], b: ids[j], lon: norm(a + d180(b - a) / 2) });
    }
    // «планетарные картинки»: планета на мидпоинте в круге 90° (соединение, квадрат, оппозиция)
    const pictures = [];
    for (const m of list) for (const id of ids) {
      if (id === m.a || id === m.b) continue;
      const diff = Math.abs(d180(chart.byId[id].lon - m.lon));
      const o = Math.min(diff, Math.abs(diff - 90), Math.abs(diff - 180));
      if (o <= orb) pictures.push({ planet: id, a: m.a, b: m.b, orb: o, angle: diff < 45 ? 0 : diff < 135 ? 90 : 180 });
    }
    pictures.sort((p, q) => p.orb - q.orb);
    return { list: list.sort((p, q) => p.lon - q.lon), pictures };
  }

  // ---------- 5. Неподвижные звёзды ----------
  // тропические долготы на эпоху J2000; прецессия ≈ 50.29″ в год
  const STARS = [
    ['algol', 'Алголь', 56.17], ['alcyone', 'Альциона (Плеяды)', 60.0], ['aldebaran', 'Альдебаран', 69.78], ['rigel', 'Ригель', 76.83], ['bellatrix', 'Беллатрикс', 80.95],
    ['capella', 'Капелла', 81.85], ['betelgeuse', 'Бетельгейзе', 88.75], ['sirius', 'Сириус', 104.08], ['castor', 'Кастор', 110.23], ['pollux', 'Поллукс', 113.22],
    ['procyon', 'Процион', 115.79], ['regulus', 'Регул', 149.83], ['denebola', 'Денебола', 171.62], ['vindemiatrix', 'Виндемиатрикс', 189.93], ['spica', 'Спика', 203.84],
    ['arcturus', 'Арктур', 204.23], ['alphecca', 'Альфекка', 222.3], ['zubenelgenubi', 'Зубен Эльгенуби', 225.08], ['zubeneschamali', 'Зубен Эшемали', 229.37], ['antares', 'Антарес', 249.77],
    ['rasalhague', 'Рас Альхаге', 262.45], ['vega', 'Вега', 285.32], ['altair', 'Альтаир', 301.78], ['fomalhaut', 'Фомальгаут', 333.87], ['deneb_adige', 'Денеб', 335.33],
    ['achernar', 'Ахернар', 345.32], ['markab', 'Маркаб', 353.48], ['scheat', 'Шеат', 359.37],
  ];
  function starLon(base, date) { const years = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / (365.2422 * 86400000); return norm(base + years * 50.29 / 3600); }
  function fixedStars(chart, orb) {
    orb = orb || 1.5;
    const ids = TEN.concat(['node', 'asc', 'mc']).filter((id) => chart.byId[id]);
    const out = [];
    for (const [key, name, base] of STARS) {
      const sl = starLon(base, chart.date);
      for (const id of ids) {
        const o = Math.abs(d180(chart.byId[id].lon - sl));
        const lim = ['sun', 'moon', 'asc', 'mc'].includes(id) ? orb : orb * 0.7;
        if (o <= lim) out.push({ star: key, name, starLon: sl, planet: id, orb: o });
      }
    }
    return out.sort((a, b) => a.orb - b.orb);
  }

  // ---------- 6. Фирдарии ----------
  const FIRD_DAY = [['sun', 10], ['venus', 8], ['mercury', 13], ['moon', 9], ['saturn', 11], ['jupiter', 12], ['mars', 7], ['node', 3], ['southNode', 2]];
  const FIRD_NIGHT = [['moon', 9], ['saturn', 11], ['jupiter', 12], ['mars', 7], ['sun', 10], ['venus', 8], ['mercury', 13], ['node', 3], ['southNode', 2]];
  const addYears = (d, y) => new Date(d.getTime() + y * 365.2422 * 86400000);
  /** Периоды фирдарий от рождения (75 лет, потом по кругу) с подпериодами (7 равных, халдейский порядок от управителя). */
  function firdaria(chart, now) {
    now = now || new Date();
    const day = chart.houses ? chart.houses.dayChart : null;
    const seq = day === false ? FIRD_NIGHT : FIRD_DAY;
    const out = [];
    let start = chart.date;
    for (let cycle = 0; cycle < 2; cycle++) {
      for (const [id, years] of seq) {
        const end = addYears(start, years);
        const subs = [];
        if (id !== 'node' && id !== 'southNode') {
          const i0 = CHALDEAN.indexOf(id);
          for (let k = 0; k < 7; k++) { const s = addYears(start, (years / 7) * k), e = addYears(start, (years / 7) * (k + 1)); subs.push({ id: CHALDEAN[(i0 + k) % 7], start: s, end: e, current: now >= s && now < e }); }
        }
        out.push({ id, years, start, end, subs, current: now >= start && now < end });
        start = end;
      }
    }
    return { day, periods: out.filter((p) => p.start < addYears(chart.date, 100)), unknownTime: day == null };
  }

  // ---------- 7. Дирекции солнечной дуги ----------
  const DIR_IDS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'asc', 'mc'];
  /** Дуга на возраст (лет): прогрессивное Солнце − натальное. */
  function arcAt(chart, years) { return norm(lon('sun', addDays(chart.date, years)) - chart.byId.sun.lon); }
  function yearsAt(chart, date) { return (date - chart.date) / (365.2422 * 86400000); }
  /** Дирекции, точные в окне [from, to] (даты), орбис 0 — точная дата; плюс что «в силе» сейчас (орбис 1°). */
  function solarArc(chart, from, to, now) {
    now = now || new Date();
    const y0 = Math.max(0, yearsAt(chart, from)), y1 = Math.max(y0 + 0.1, yearsAt(chart, to));
    const arc0 = arcAt(chart, y0), arc1 = arcAt(chart, y1);
    const ids = DIR_IDS.filter((id) => chart.byId[id]);
    const events = [];
    for (const dId of ids) for (const nId of ids) {
      if (dId === nId) continue;
      for (const ang of [0, 60, 90, 120, 180]) for (const sg of (ang === 0 || ang === 180 ? [1] : [1, -1])) {
        const need = norm(chart.byId[nId].lon + sg * ang - chart.byId[dId].lon); // нужная дуга
        // дуга растёт ~1° в год: ищем момент, когда она проходит need
        let a = y0, b = y1;
        const f = (y) => d180(arcAt(chart, y) - need);
        if (!((arc0 <= need && need <= arc1) || (arc1 < arc0 && (need >= arc0 || need <= arc1)))) continue;
        let fa = f(a);
        for (let it = 0; it < 30; it++) { const m = (a + b) / 2, fm = f(m); if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m; }
        const date = addYears(chart.date, (a + b) / 2);
        if (date >= from && date <= to) events.push({ directed: dId, natal: nId, angle: ang, type: ({ 0: 'conj', 60: 'sextile', 90: 'square', 120: 'trine', 180: 'opp' })[ang], date });
      }
    }
    const arcNow = arcAt(chart, yearsAt(chart, now));
    return { arcNow, events: events.sort((p, q) => p.date - q.date) };
  }

  // ---------- 8. Лунар ----------
  /** Ближайшее возвращение Луны в натальную точку после даты (или до неё, если before). */
  function lunarReturnDate(chart, after) {
    const target = chart.byId.moon.lon;
    let t = after;
    let prev = d180(lon('moon', t) - target);
    for (let h = 6; h <= 28 * 24; h += 6) {
      const t2 = new Date(after.getTime() + h * 3600000);
      const v = d180(lon('moon', t2) - target);
      if (prev < 0 && v >= 0 && Math.abs(v - prev) < 30) {
        let a = t.getTime(), b = t2.getTime();
        for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (d180(lon('moon', new Date(m)) - target) < 0) a = m; else b = m; }
        return new Date((a + b) / 2);
      }
      prev = v; t = t2;
    }
    return null;
  }
  function lunarReturn(chart, after, place, opts) {
    const date = lunarReturnDate(chart, after);
    const p = place || { lat: chart.params.lat, lon: chart.params.lon, zone: chart.params.zone };
    const c = AC.chart({ date, lat: p.lat, lon: p.lon, zone: p.zone || p.tz, timeKnown: true }, opts || chart.opts);
    c.returnDate = date;
    return c;
  }

  // ---------- 9. Управители дня и часа (планетные часы) ----------
  const DAY_RULER = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn']; // вс … сб
  function sunEvent(dir, from, lat, lng) {
    const obs = new Astro.Observer(lat, lng, 0);
    const r = Astro.SearchRiseSet(Astro.Body.Sun, obs, dir, from, 2);
    return r ? r.date : null;
  }
  /** Часы планет на сутки, в которые попадает date (сутки — от восхода до восхода). weekday — по дате восхода в tz. */
  function planetaryHours(date, lat, lng, tz) {
    date = date || new Date();
    let rise = sunEvent(+1, new Date(date.getTime() - 26 * 3600000), lat, lng);
    if (!rise) return null; // полярный день/ночь
    // последний восход не позже date
    for (let k = 0; k < 3; k++) { const n = sunEvent(+1, new Date(rise.getTime() + 3600000), lat, lng); if (n && n <= date) rise = n; else break; }
    const set = sunEvent(-1, rise, lat, lng), next = sunEvent(+1, new Date(rise.getTime() + 3600000), lat, lng);
    if (!set || !next) return null;
    let wd;
    try { wd = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(rise) + 'T12:00:00Z').getUTCDay(); } catch (e) { wd = rise.getDay(); }
    const dayRuler = DAY_RULER[wd];
    const i0 = CHALDEAN.indexOf(dayRuler);
    const hours = [];
    const dh = (set - rise) / 12, nh = (next - set) / 12;
    for (let k = 0; k < 24; k++) {
      const s = k < 12 ? new Date(rise.getTime() + dh * k) : new Date(set.getTime() + nh * (k - 12));
      const e = k < 12 ? new Date(rise.getTime() + dh * (k + 1)) : new Date(set.getTime() + nh * (k - 11));
      hours.push({ n: k + 1, day: k < 12, ruler: CHALDEAN[(i0 + k) % 7], start: s, end: e, current: date >= s && date < e });
    }
    return { dayRuler, rise, set, next, hours, current: hours.find((h) => h.current) || null };
  }

  // ---------- 10. Хорар: показатели карты момента ----------
  /** Последний и следующий аспекты Луны в текущем знаке, Луна без курса, ограничения (strictures). */
  /** opts.modern — учитывать и высшие планеты (как лунный календарь сайта); по умолчанию — классика хорара (Лилли, Sotis):
      аспекты Луны только к семи видимым планетам. */
  function horary(chart, hoursInfo, opts) {
    opts = opts || {};
    const date = chart.date;
    const moonLon = chart.byId.moon.lon;
    const si = signIndex(moonLon);
    const ing = AC.ingresses('moon', addDays(date, -3), addDays(date, 3), 0.25);
    const enter = ing.filter((x) => x.date <= date).pop(), leave = ing.find((x) => x.date > date);
    const ids = ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].concat(opts.modern ? ['uranus', 'neptune', 'pluto'] : []);
    const hits = [];
    const from = enter ? enter.date : addDays(date, -2.5), to = leave ? leave.date : addDays(date, 2.5);
    const step = 3600000;
    for (const id of ids) for (const ang of [0, 60, 90, 120, 180]) for (const sg of (ang === 0 || ang === 180 ? [1] : [1, -1])) {
      let prevT = from, prev = d180(lon('moon', from) - lon(id, from) - sg * ang);
      for (let t = from.getTime() + step; t <= to.getTime() + step; t += step) {
        const tt = new Date(Math.min(t, to.getTime()));
        const v = d180(lon('moon', tt) - lon(id, tt) - sg * ang);
        if ((prev < 0) !== (v < 0) && Math.abs(v - prev) < 30) {
          let a = prevT.getTime(), b = tt.getTime(), fa = prev;
          for (let i = 0; i < 30; i++) { const m = (a + b) / 2, fm = d180(lon('moon', new Date(m)) - lon(id, new Date(m)) - sg * ang); if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m; }
          hits.push({ id, angle: ang, type: ({ 0: 'conj', 60: 'sextile', 90: 'square', 120: 'trine', 180: 'opp' })[ang], date: new Date((a + b) / 2) });
        }
        prev = v; prevT = tt;
        if (t >= to.getTime()) break;
      }
    }
    hits.sort((a, b) => a.date - b.date);
    const last = hits.filter((h) => h.date <= date).pop() || null, next = hits.find((h) => h.date > date) || null;
    const voc = !next;
    const asc = chart.byId.asc;
    const strictures = [];
    if (asc) {
      const d = asc.lon % 30;
      if (d < 3) strictures.push('ascEarly');
      if (d > 27) strictures.push('ascLate');
      const sat = chart.byId.saturn;
      if (sat.house === 1 || sat.house === 7) strictures.push('saturnAngle' + sat.house);
    }
    const ml = moonLon;
    if (ml >= 195 && ml <= 225) strictures.push('viaCombusta');
    if (ml % 30 > 27) strictures.push('moonLate');
    // радикальность: управитель часа и управитель ASC — одна планета или одна стихия
    let radical = null;
    if (asc && hoursInfo && hoursInfo.current) {
      const ascRuler = TRAD[asc.sign], hr = hoursInfo.current.ruler;
      const tripPl = (pl) => Object.entries(TRIP).filter(([, v]) => v.includes(pl)).map(([k]) => k);
      radical = ascRuler === hr || tripPl(hr).includes(AC.ELEMENT[asc.signIndex % 4]) ? { ok: true, ascRuler, hourRuler: hr } : { ok: false, ascRuler, hourRuler: hr };
    }
    // последний аспект Луны в этом знаке — после него Луна «без курса» до смены знака (как показывает Sotis)
    const final = hits.length ? hits[hits.length - 1] : null;
    return { moonSign: SIGNS[si], enter: enter ? enter.date : null, leave: leave ? leave.date : null, nextSign: leave ? leave.to : null, last, next, voc, vocFrom: final ? final.date : (enter ? enter.date : null), final, aspects: hits, strictures, radical };
  }

  // ---------- 11. Релокация и астрокартография ----------
  /** Карта на тот же момент для другого места (релокация): меняются только дома и углы. */
  function relocate(chart, place, opts) {
    return AC.chart({ date: chart.date, offset: chart.offset, lat: place.lat, lon: place.lon, zone: place.tz || place.zone, timeKnown: true, name: chart.params.name }, opts || chart.opts);
  }
  /** Города, где планеты рождения стоят на углах (линии ASC/DSC/MC/IC астрокартографии) с орбисом orb°. */
  function angularCities(chart, cities, orb) {
    orb = orb || 3;
    const out = [];
    for (const c of cities) {
      let hs;
      try { hs = AC.houses(chart.date, c.lat, c.lon, 'porphyry'); } catch (e) { continue; }
      const angles = { asc: hs.asc, dsc: norm(hs.asc + 180), mc: hs.mc, ic: norm(hs.mc + 180) };
      for (const id of TEN) {
        const pl = chart.byId[id].lon;
        for (const [k, a] of Object.entries(angles)) {
          const o = Math.abs(d180(pl - a));
          if (o <= orb) out.push({ city: c, planet: id, angle: k, orb: o });
        }
      }
    }
    return out.sort((a, b) => a.orb - b.orb);
  }

  // ---------- 12. Проверка времени рождения ----------
  /** Как меняются ASC, MC и Луна, если время рождения сдвинуть на ±range минут: границы смены знаков. */
  function timeWindow(params, range, opts) {
    range = range || 120;
    const base = AC.chart(Object.assign({}, params, { timeKnown: true }), opts);
    const rows = [];
    let prev = null;
    const changes = [];
    for (let m = -range; m <= range; m += 4) {
      const date = new Date(base.date.getTime() + m * 60000);
      const hs = AC.houses(date, params.lat, params.lon, (opts && opts.houseSystem) || 'placidus');
      const moon = lon('moon', date);
      const row = { min: m, date, asc: hs.asc, mc: hs.mc, moon, ascSign: SIGNS[signIndex(hs.asc)], mcSign: SIGNS[signIndex(hs.mc)], moonSign: SIGNS[signIndex(moon)] };
      if (prev) for (const k of ['ascSign', 'mcSign', 'moonSign']) if (row[k] !== prev[k]) changes.push({ what: k.replace('Sign', ''), from: prev[k], to: row[k], min: m, date });
      rows.push(row); prev = row;
    }
    return { rows, changes, base };
  }

  // ---------- 13. Эфемериды ----------
  const EPH_IDS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'node'];
  /** Положения планет на 0:00 UT каждого дня месяца (как в таблицах эфемерид). */
  function ephemeris(year, month) {
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const rows = [];
    for (let d = 1; d <= days; d++) {
      const date = new Date(Date.UTC(year, month - 1, d));
      rows.push({ d, date, pts: EPH_IDS.map((id) => { const b = AC.body(id, date); return { id, lon: b.lon, retro: b.retro, speed: b.speed }; }) });
    }
    return rows;
  }

  // ---------- 14. Динамика транзитов ----------
  const DYN_W = { pluto: 5, neptune: 4.5, uranus: 4.5, saturn: 4, jupiter: 3, mars: 1.2 };
  const DYN_N = { sun: 3, moon: 3, asc: 3, mc: 3, venus: 2, mars: 2, mercury: 2, jupiter: 1.2, saturn: 1.2, node: 1, uranus: 0.8, neptune: 0.8, pluto: 0.8 };
  /** Напряжение и поддержка по неделям: сумма активных медленных транзитов (ближе к точному — сильнее). */
  function dynamics(chart, start, weeks) {
    const end = addDays(start, weeks * 7);
    const events = AC.transits(chart, start, end, { transiting: ['mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] });
    const series = [];
    for (let w = 0; w < weeks; w++) {
      const t = addDays(start, w * 7 + 3.5);
      let hard = 0, soft = 0;
      for (const e of events) {
        if (t < e.start || t > e.end) continue;
        const span = Math.max(1, (e.end - e.start) / 86400000);
        const near = e.exact.length ? Math.min(...e.exact.map((x) => Math.abs(x - t) / 86400000)) : span / 2;
        const k = 0.45 + 0.55 * Math.max(0, 1 - near / Math.max(3, span / 2));
        const v = (DYN_W[e.transiting] || 1) * (DYN_N[e.natal] || 1) * k;
        if (['trine', 'sextile'].includes(e.type)) soft += v;
        else if (e.type === 'conj') { if (['jupiter'].includes(e.transiting)) soft += v; else hard += v * 0.8; }
        else hard += v;
      }
      series.push({ start: addDays(start, w * 7), hard, soft });
    }
    return { series, events };
  }

  root.ProAstro = {
    SEVEN, TEN, TRAD, EXALT, TRIP, TERMS, FACE_ORDER, STARS, CHALDEAN, DAY_RULER, termOf, faceOf, starLon,
    dignities, receptions, dispositors, patterns, jonesShape, houseStrength, midpoints, fixedStars, firdaria,
    solarArc, arcAt, lunarReturn, lunarReturnDate, planetaryHours, horary, relocate, angularCities, timeWindow, ephemeris, dynamics,
  };
})(typeof window !== 'undefined' ? window : globalThis);
