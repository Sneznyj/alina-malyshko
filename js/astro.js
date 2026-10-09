/*
 * AstroCore — астрологические расчёты сайта.
 * Тропический зодиак, видимые положения на истинное равноденствие даты.
 * Планеты, Солнце, Луна — astronomy-engine (точность ~1′), Хирон — таблица JPL Horizons,
 * дома — Плацидус, Кох, Порфирий, равнодомная, по знакам.
 * Работает и в браузере (window.AstroCore), и в Node (для проверки против Swiss Ephemeris).
 */
(function (root) {
  'use strict';
  const A = root.Astronomy;
  if (!A) throw new Error('astronomy-engine не загружен');

  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const norm = (x) => ((x % 360) + 360) % 360;
  const d180 = (x) => { x = norm(x); return x > 180 ? x - 360 : x; };
  const sind = (x) => Math.sin(x * D2R), cosd = (x) => Math.cos(x * D2R), tand = (x) => Math.tan(x * D2R);
  const atan2d = (y, x) => Math.atan2(y, x) * R2D, asind = (x) => Math.asin(Math.max(-1, Math.min(1, x))) * R2D;

  const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
  const ELEMENT = ['fire', 'earth', 'air', 'water'];
  const MODALITY = ['cardinal', 'fixed', 'mutable'];
  const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  const POINTS = ['node', 'lilith', 'chiron'];
  const AE = { sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto' };

  // Управители (современные) и достоинства
  const RULER = { aries: 'mars', taurus: 'venus', gemini: 'mercury', cancer: 'moon', leo: 'sun', virgo: 'mercury', libra: 'venus', scorpio: 'pluto', sagittarius: 'jupiter', capricorn: 'saturn', aquarius: 'uranus', pisces: 'neptune' };
  const DOMICILE = { sun: [4], moon: [3], mercury: [2, 5], venus: [1, 6], mars: [0, 7], jupiter: [8, 11], saturn: [9, 10], uranus: [10], neptune: [11], pluto: [7] };
  const EXALT = { sun: 0, moon: 1, mercury: 5, venus: 11, mars: 9, jupiter: 3, saturn: 6 };

  const ASPECTS = [
    { id: 'conj', angle: 0, orb: 8, major: true, nature: 'neutral' },
    { id: 'opp', angle: 180, orb: 8, major: true, nature: 'hard' },
    { id: 'trine', angle: 120, orb: 7, major: true, nature: 'soft' },
    { id: 'square', angle: 90, orb: 7, major: true, nature: 'hard' },
    { id: 'sextile', angle: 60, orb: 5, major: true, nature: 'soft' },
    { id: 'quincunx', angle: 150, orb: 3, major: false, nature: 'hard' },
    { id: 'semisextile', angle: 30, orb: 2, major: false, nature: 'soft' },
    { id: 'semisquare', angle: 45, orb: 2, major: false, nature: 'hard' },
    { id: 'sesquisquare', angle: 135, orb: 2, major: false, nature: 'hard' },
    { id: 'quintile', angle: 72, orb: 1.5, major: false, nature: 'soft' },
  ];
  const ORB_FACTOR = { sun: 1.25, moon: 1.25, mercury: 1, venus: 1, mars: 1, jupiter: 0.9, saturn: 0.9, uranus: 0.8, neptune: 0.8, pluto: 0.8, node: 0.5, chiron: 0.5, lilith: 0.4, asc: 0.75, mc: 0.75, fortune: 0.35 };

  // ---------- время ----------
  const toTime = (d) => (d instanceof A.AstroTime ? d : A.MakeTime(d instanceof Date ? d : new Date(d)));
  const jdUT = (d) => toTime(d).ut + 2451545.0;

  /** Смещение часового пояса tz (IANA) в минутах для момента dateUTC — с историей (летнее время, декретное и т. п.). */
  function tzOffsetMin(dateUTC, tz) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = {};
    for (const x of f.formatToParts(dateUTC)) p[x.type] = x.value;
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUTC - dateUTC.getTime()) / 60000);
  }

  /** Местное время → UTC. zone: строка IANA ('Europe/Moscow') или число часов (+3). */
  function localToUTC(y, mo, d, h, mi, zone) {
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    if (typeof zone === 'number') return { date: new Date(guess - zone * 3600000), offset: Math.round(zone * 60) };
    const off1 = tzOffsetMin(new Date(guess), zone);
    let utc = guess - off1 * 60000;
    const off2 = tzOffsetMin(new Date(utc), zone);
    if (off2 !== off1) utc = guess - off2 * 60000;
    return { date: new Date(utc), offset: off2 };
  }

  // ---------- положения тел ----------
  function meanNode(t) {
    const T = t.tt / 36525;
    return norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441 - T ** 4 / 60616000 + A.e_tilt(t).dpsi / 3600);
  }
  function meanLilith(t) { // средний апогей Луны (Чёрная Луна), спроецированный с плоскости орбиты на эклиптику — как в Swiss Ephemeris
    const T = t.tt / 36525;
    const apo = 83.3532465 + 4069.0137287 * T - 0.01032 * T * T - T ** 3 / 80053 + T ** 4 / 18999000 + 180;
    const node = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441 - T ** 4 / 60616000;
    const u = apo - node;
    return norm(node + atan2d(sind(u) * cosd(5.1453964), cosd(u)) + A.e_tilt(t).dpsi / 3600);
  }
  function trueNode(t) { // оскулирующий узел: плоскость орбиты Луны из r × v
    const rot = A.Rotation_EQJ_ECT(t);
    const dt = 0.02;
    const r = A.RotateVector(rot, A.GeoMoon(t));
    const p1 = A.RotateVector(rot, A.GeoMoon(t.AddDays(-dt)));
    const p2 = A.RotateVector(rot, A.GeoMoon(t.AddDays(dt)));
    const v = { x: (p2.x - p1.x) / (2 * dt), y: (p2.y - p1.y) / (2 * dt), z: (p2.z - p1.z) / (2 * dt) };
    const hx = r.y * v.z - r.z * v.y, hy = r.z * v.x - r.x * v.z;
    return norm(atan2d(hx, -hy));
  }

  let chiron = null; // распакованная таблица Хирона
  function chironTable() {
    if (chiron !== null) return chiron;
    const src = root.CHIRON_DATA;
    if (!src) return (chiron = false);
    const parts = src.d.split(',');
    const arr = new Float64Array(parts.length);
    let acc = 0;
    for (let i = 0; i < parts.length; i++) { acc += parseInt(parts[i], 36); arr[i] = acc / src.scale; }
    return (chiron = { jd0: src.jd0, step: src.step, lon: arr });
  }
  function chironLon(t) {
    const c = chironTable();
    if (!c) return null;
    const x = (t.ut + 2451545.0 - c.jd0) / c.step;
    const i = Math.floor(x);
    if (i < 1 || i > c.lon.length - 3) return null;
    const f = x - i;
    const y0 = c.lon[i - 1], y1 = c.lon[i], y2 = c.lon[i + 1], y3 = c.lon[i + 2];
    // Лагранж по 4 точкам (значения уже «развёрнуты» без скачков через 360°)
    const v = y0 * (-f * (f - 1) * (f - 2) / 6) + y1 * ((f + 1) * (f - 1) * (f - 2) / 2) + y2 * (-(f + 1) * f * (f - 2) / 2) + y3 * ((f + 1) * f * (f - 1) / 6);
    return norm(v);
  }

  function rawLon(id, t, opts) {
    switch (id) {
      case 'sun': return A.SunPosition(t).elon;
      case 'moon': return A.EclipticGeoMoon(t).lon;
      case 'node': return (opts && opts.meanNode) ? meanNode(t) : trueNode(t);
      case 'lilith': return meanLilith(t);
      case 'chiron': return chironLon(t);
      default: return A.Ecliptic(A.GeoVector(AE[id], t, true)).elon;
    }
  }

  /** Долгота и скорость (°/сутки). */
  function body(id, date, opts) {
    const t = toTime(date);
    const lon = rawLon(id, t, opts);
    if (lon == null) return null;
    const h = id === 'moon' ? 0.05 : (id === 'node' ? 0.5 : 0.25);
    const a = rawLon(id, t.AddDays(-h), opts), b = rawLon(id, t.AddDays(h), opts);
    const speed = d180(b - a) / (2 * h);
    return { id, lon: norm(lon), speed, retro: speed < 0 && id !== 'node' && id !== 'lilith' };
  }

  // ---------- дома ----------
  function ascFromRamc(ramc, lat, eps) {
    return norm(atan2d(cosd(ramc), -(sind(ramc) * cosd(eps) + tand(lat) * sind(eps))));
  }
  function eclFromRA(ra, eps) { return norm(atan2d(sind(ra), cosd(ra) * cosd(eps))); }

  function placidusCusp(ramc, lat, eps, frac, below) {
    let ra = below ? ramc + 180 - frac * 90 : ramc + frac * 90;
    let lam = 0;
    for (let i = 0; i < 60; i++) {
      lam = eclFromRA(ra, eps);
      const dec = asind(sind(eps) * sind(lam));
      const x = tand(lat) * tand(dec);
      if (Math.abs(x) >= 1) return null;
      const ad = asind(x);
      const next = below ? ramc + 180 - frac * (90 - ad) : ramc + frac * (90 + ad);
      if (Math.abs(d180(next - ra)) < 1e-7) { ra = next; break; }
      ra = next;
    }
    return eclFromRA(ra, eps);
  }

  const HOUSE_SYSTEMS = { placidus: 'Плацидус', koch: 'Кох', porphyry: 'Порфирий', equal: 'Равнодомная', whole: 'По знакам' };

  function houses(date, lat, lon, system) {
    const t = toTime(date);
    const eps = A.e_tilt(t).tobl;
    const ramc = norm(A.SiderealTime(t) * 15 + lon);
    const mc = norm(atan2d(sind(ramc), cosd(ramc) * cosd(eps)));
    const asc = ascFromRamc(ramc, lat, eps);
    let sys = system || 'placidus';
    let cusps = null, fallback = false;
    const polar = Math.abs(lat) >= 90 - eps;

    if (sys === 'placidus' && !polar) {
      const c11 = placidusCusp(ramc, lat, eps, 1 / 3, false), c12 = placidusCusp(ramc, lat, eps, 2 / 3, false);
      const c2 = placidusCusp(ramc, lat, eps, 2 / 3, true), c3 = placidusCusp(ramc, lat, eps, 1 / 3, true);
      if ([c11, c12, c2, c3].every((x) => x != null)) cusps = [asc, c2, c3, norm(mc + 180), norm(c11 + 180), norm(c12 + 180), norm(asc + 180), norm(c2 + 180), norm(c3 + 180), mc, c11, c12];
    } else if (sys === 'koch' && !polar) {
      const dec = asind(sind(eps) * sind(mc));
      const x = tand(lat) * tand(dec);
      if (Math.abs(x) < 1) {
        const ad3 = asind(x) / 3;
        const k = (r) => ascFromRamc(r, lat, eps);
        const c11 = k(ramc - 60 - 2 * ad3), c12 = k(ramc - 30 - ad3), c2 = k(ramc + 30 + ad3), c3 = k(ramc + 60 + 2 * ad3);
        cusps = [asc, c2, c3, norm(mc + 180), norm(c11 + 180), norm(c12 + 180), norm(asc + 180), norm(c2 + 180), norm(c3 + 180), mc, c11, c12];
      }
    } else if (sys === 'equal') {
      cusps = Array.from({ length: 12 }, (_, i) => norm(asc + 30 * i));
    } else if (sys === 'whole') {
      const s0 = Math.floor(asc / 30) * 30;
      cusps = Array.from({ length: 12 }, (_, i) => norm(s0 + 30 * i));
    }
    if (!cusps) { // Порфирий — и как запасной вариант за полярным кругом
      if (sys !== 'porphyry') fallback = true;
      sys = 'porphyry';
      const q1 = norm(asc - mc) / 3, q2 = norm(mc + 180 - asc) / 3;
      const ic = norm(mc + 180);
      cusps = [asc, norm(asc + q2), norm(asc + 2 * q2), ic, norm(ic + q1), norm(ic + 2 * q1), norm(asc + 180), norm(asc + 180 + q2), norm(asc + 180 + 2 * q2), mc, norm(mc + q1), norm(mc + 2 * q1)];
    }
    return { system: sys, requested: system || 'placidus', fallback, cusps, asc, mc, ramc, eps };
  }

  function houseOf(lon, cusps) {
    for (let i = 0; i < 12; i++) {
      const a = cusps[i], b = cusps[(i + 1) % 12];
      if (norm(lon - a) < norm(b - a)) return i + 1;
    }
    return 1;
  }

  // ---------- знаки, достоинства ----------
  const signIndex = (lon) => Math.floor(norm(lon) / 30) % 12;
  const signOf = (lon) => SIGNS[signIndex(lon)];
  const elementOf = (si) => ELEMENT[si % 4];
  const modalityOf = (si) => MODALITY[si % 3];

  function dignity(id, si) {
    if (DOMICILE[id]) {
      if (DOMICILE[id].includes(si)) return 'domicile';
      if (DOMICILE[id].some((s) => (s + 6) % 12 === si)) return 'detriment';
    }
    if (EXALT[id] != null) {
      if (EXALT[id] === si) return 'exaltation';
      if ((EXALT[id] + 6) % 12 === si) return 'fall';
    }
    return null;
  }

  function fmtDeg(lon, withSign) {
    const l = norm(lon);
    const d = Math.floor(l % 30), m = Math.floor(((l % 1) * 60) + 1e-9);
    const s = `${d}°${String(m).padStart(2, '0')}′`;
    return withSign ? `${s} ${withSign(signOf(l))}` : s;
  }

  // ---------- аспекты ----------
  function aspectBetween(a, b, opts) {
    opts = opts || {};
    const list = ASPECTS.filter((x) => (opts.minor ? true : x.major));
    const fa = ORB_FACTOR[a.id] || 1, fb = ORB_FACTOR[b.id] || 1;
    const pointOnly = (x) => ['node', 'lilith', 'fortune', 'chiron'].includes(x.id);
    const mult = opts.orbMult || 1;
    const diff = d180(b.lon - a.lon);
    const sep = Math.abs(diff);
    let best = null;
    for (const asp of list) {
      if (!asp.major && (pointOnly(a) || pointOnly(b))) continue;
      const orbMax = asp.orb * Math.sqrt(fa * fb) * mult;
      const orb = Math.abs(sep - asp.angle);
      if (orb <= orbMax && (!best || orb < best.orb)) best = { type: asp.id, angle: asp.angle, nature: asp.nature, orb, orbMax };
    }
    if (!best) return null;
    // сходящийся (applying) — орбис уменьшается
    if (a.speed != null && b.speed != null) {
      const dsep = Math.sign(diff || 1) * (b.speed - a.speed);
      best.applying = Math.sign(sep - best.angle) * dsep < 0;
    }
    best.a = a.id; best.b = b.id;
    best.strength = 1 - best.orb / best.orbMax;
    return best;
  }

  function aspectsWithin(points, opts) {
    const out = [];
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) {
        if ((points[i].id === 'asc' && points[j].id === 'mc') || (points[i].id === 'mc' && points[j].id === 'asc')) continue;
        if ((points[i].id === 'node' && points[j].id === 'lilith') || (points[i].id === 'lilith' && points[j].id === 'node')) continue;
        const x = aspectBetween(points[i], points[j], opts);
        if (x) out.push(x);
      }
    return out.sort((p, q) => p.orb / p.orbMax - q.orb / q.orbMax);
  }

  function aspectsBetween(pointsA, pointsB, opts) {
    const out = [];
    for (const a of pointsA) for (const b of pointsB) {
      const x = aspectBetween(a, b, opts);
      if (x) out.push(x);
    }
    return out.sort((p, q) => p.orb / p.orbMax - q.orb / q.orbMax);
  }

  // ---------- карта ----------
  /**
   * params: { y, mo, d, h, mi, zone (IANA | часы), lat, lon, timeKnown, name }
   * opts:   { houseSystem, meanNode, minor, orbMult }
   */
  function chart(params, opts) {
    opts = opts || {};
    const timeKnown = params.timeKnown !== false;
    const h = timeKnown ? params.h : 12, mi = timeKnown ? params.mi : 0;
    const conv = params.date ? { date: params.date, offset: params.offset || 0 } : localToUTC(params.y, params.mo, params.d, h, mi, params.zone);
    const date = conv.date;
    const t = toTime(date);
    const pts = [];
    for (const id of PLANETS.concat(POINTS)) {
      const b = body(id, t, opts);
      if (b) pts.push(b);
    }
    let hs = null;
    if (timeKnown && params.lat != null && params.lon != null) {
      hs = houses(t, params.lat, params.lon, opts.houseSystem);
      pts.push({ id: 'asc', lon: hs.asc, speed: null, retro: false });
      pts.push({ id: 'mc', lon: hs.mc, speed: null, retro: false });
      const sun = pts.find((p) => p.id === 'sun'), moon = pts.find((p) => p.id === 'moon');
      const day = houseOf(sun.lon, hs.cusps) >= 7; // Солнце над горизонтом — дневная карта
      const fortune = day ? hs.asc + moon.lon - sun.lon : hs.asc + sun.lon - moon.lon;
      pts.push({ id: 'fortune', lon: norm(fortune), speed: null, retro: false });
      hs.dayChart = day;
    }
    for (const p of pts) {
      p.sign = signOf(p.lon);
      p.signIndex = signIndex(p.lon);
      p.deg = p.lon % 30;
      p.house = hs ? houseOf(p.lon, hs.cusps) : null;
      p.dignity = dignity(p.id, p.signIndex);
    }
    const byId = Object.fromEntries(pts.map((p) => [p.id, p]));
    const aspPts = pts.filter((p) => p.id !== 'fortune' || opts.fortuneAspects);
    const aspects = aspectsWithin(aspPts, opts);
    const c = { params, opts, date, offset: conv.offset, jd: jdUT(t), timeKnown, houses: hs, points: pts, byId, aspects };
    c.summary = summarize(c);
    return c;
  }

  const WEIGHT = { sun: 3, moon: 3, asc: 3, mercury: 2, venus: 2, mars: 2, jupiter: 1.5, saturn: 1.5, uranus: 1, neptune: 1, pluto: 1, mc: 1 };

  function summarize(c) {
    const el = { fire: 0, earth: 0, air: 0, water: 0 }, mo = { cardinal: 0, fixed: 0, mutable: 0 };
    let total = 0;
    for (const p of c.points) {
      const w = WEIGHT[p.id];
      if (!w) continue;
      el[elementOf(p.signIndex)] += w; mo[modalityOf(p.signIndex)] += w; total += w;
    }
    const pct = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round((v / total) * 100)]));
    const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
    // стеллиумы: 3+ планеты в знаке или доме
    const stelliums = [];
    const bySign = {}, byHouse = {};
    for (const p of c.points) {
      if (!PLANETS.includes(p.id)) continue;
      (bySign[p.sign] = bySign[p.sign] || []).push(p.id);
      if (p.house) (byHouse[p.house] = byHouse[p.house] || []).push(p.id);
    }
    for (const [s, l] of Object.entries(bySign)) if (l.length >= 3) stelliums.push({ kind: 'sign', where: s, planets: l });
    for (const [h, l] of Object.entries(byHouse)) if (l.length >= 3) stelliums.push({ kind: 'house', where: +h, planets: l });
    // лунная фаза рождения
    const sun = c.byId.sun, moon = c.byId.moon;
    const elong = norm(moon.lon - sun.lon);
    const phase = Math.floor(((elong + 22.5) % 360) / 45); // 0 новолуние … 7 бальзамическая
    // доминирующая планета: управитель Солнца/Луны/ASC, угловые дома, аспекты, достоинство
    const score = {};
    for (const id of PLANETS) score[id] = 0;
    const add = (id, v) => { if (score[id] != null) score[id] += v; };
    add(RULER[sun.sign], 3); add(RULER[moon.sign], 2);
    if (c.byId.asc) add(RULER[c.byId.asc.sign], 4);
    if (c.byId.mc) add(RULER[c.byId.mc.sign], 2);
    for (const p of c.points) {
      if (!PLANETS.includes(p.id)) continue;
      if (p.house && [1, 10].includes(p.house)) add(p.id, 2.5);
      else if (p.house && [4, 7].includes(p.house)) add(p.id, 1.5);
      if (p.dignity === 'domicile' || p.dignity === 'exaltation') add(p.id, 2);
      if (p.dignity === 'detriment' || p.dignity === 'fall') add(p.id, 0.5);
    }
    for (const a of c.aspects) { add(a.a, 0.6 * a.strength + (a.type === 'conj' ? 0.4 : 0)); add(a.b, 0.6 * a.strength + (a.type === 'conj' ? 0.4 : 0)); }
    if (c.byId.asc) for (const id of PLANETS) { const p = c.byId[id]; if (Math.abs(d180(p.lon - c.byId.asc.lon)) < 6) add(id, 3); if (Math.abs(d180(p.lon - c.byId.mc.lon)) < 6) add(id, 2.5); }
    const dominant = Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
    const retro = c.points.filter((p) => p.retro && PLANETS.includes(p.id)).map((p) => p.id);
    return {
      elements: pct(el), modalities: pct(mo),
      topElement: top(el)[0][0], lowElement: top(el)[3][0], topModality: top(mo)[0][0],
      stelliums, moonPhase: phase, elongation: elong, dominant, retro,
      ascRuler: c.byId.asc ? RULER[c.byId.asc.sign] : null,
    };
  }

  // ---------- поиск событий ----------
  function bisect(fn, t0, t1, iters) { // корень fn между t0 и t1 (Date), fn меняет знак
    let a = t0.getTime(), b = t1.getTime(), fa = fn(new Date(a));
    for (let i = 0; i < (iters || 40); i++) {
      const m = (a + b) / 2, fm = fn(new Date(m));
      if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m;
      if (b - a < 30000) break;
    }
    return new Date((a + b) / 2);
  }
  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
  const lonAt = (id, d, opts) => rawLon(id, toTime(d), opts);

  /** Смены знаков у тела в интервале. */
  function ingresses(id, start, end, stepDays) {
    const step = stepDays || (id === 'moon' ? 0.25 : 1);
    const out = [];
    let prevT = start, prev = signIndex(lonAt(id, start));
    for (let t = addDays(start, step); t <= addDays(end, step); t = addDays(t, step)) {
      const s = signIndex(lonAt(id, t));
      if (s !== prev) {
        const target = s === (prev + 1) % 12 ? s * 30 : prev * 30; // прямое или попятное
        const when = bisect((x) => d180(lonAt(id, x) - target), prevT, t);
        if (when >= start && when <= end) out.push({ id, date: when, from: SIGNS[prev], to: SIGNS[s], retro: s !== (prev + 1) % 12 });
        prev = s;
      }
      prevT = t;
    }
    return out;
  }

  /** Стоянки (ретро/директ) планет за период. */
  function stations(ids, start, end) {
    const out = [];
    const spd = (id, d) => body(id, d).speed;
    for (const id of ids) {
      let prevT = addDays(start, -1), prev = spd(id, prevT);
      for (let t = start; t <= addDays(end, 1); t = addDays(t, 1)) {
        const v = spd(id, t);
        if ((v < 0) !== (prev < 0)) {
          const when = bisect((x) => spd(id, x), prevT, t);
          if (when >= start && when <= end) out.push({ id, date: when, kind: v < 0 ? 'retro' : 'direct', lon: lonAt(id, when) });
        }
        prev = v; prevT = t;
      }
    }
    return out.sort((a, b) => a.date - b.date);
  }

  /** Периоды ретроградности (с тенью для Меркурия/Венеры/Марса) пересекающие [start, end]. */
  function retrogradePeriods(ids, start, end) {
    const st = stations(ids, addDays(start, -200), addDays(end, 200));
    const out = [];
    for (const id of ids) {
      const s = st.filter((x) => x.id === id);
      for (let i = 0; i < s.length; i++) {
        if (s[i].kind !== 'retro') continue;
        const d = s.slice(i + 1).find((x) => x.kind === 'direct');
        if (!d) continue;
        if (d.date < start || s[i].date > end) continue;
        const per = { id, start: s[i].date, end: d.date, lonStart: s[i].lon, lonEnd: d.lon };
        if (['mercury', 'venus', 'mars'].includes(id)) {
          // тень: до ретро — когда планета впервые доходит до градуса директной стоянки; после — когда возвращается к градусу ретро-стоянки
          const pre = findCrossing(id, d.lon, addDays(s[i].date, -60), s[i].date);
          const post = findCrossing(id, s[i].lon, d.date, addDays(d.date, 80));
          per.shadowStart = pre; per.shadowEnd = post;
        }
        out.push(per);
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }

  function findCrossing(id, targetLon, start, end) {
    let prevT = start, prev = d180(lonAt(id, start) - targetLon);
    for (let t = addDays(start, 0.5); t <= end; t = addDays(t, 0.5)) {
      const v = d180(lonAt(id, t) - targetLon);
      if ((v < 0) !== (prev < 0) && Math.abs(v - prev) < 90) return bisect((x) => d180(lonAt(id, x) - targetLon), prevT, t);
      prev = v; prevT = t;
    }
    return null;
  }

  /** Фазы Луны: 0 новолуние, 1 первая четверть, 2 полнолуние, 3 последняя четверть. */
  function moonPhases(start, end) {
    const out = [];
    for (let q = 0; q < 4; q++) {
      let t = toTime(addDays(start, -1));
      for (;;) {
        const r = A.SearchMoonPhase(q * 90, t, 40);
        if (!r || r.date > end) break;
        if (r.date >= start) out.push({ phase: q, date: r.date, lon: lonAt('moon', r.date) });
        t = r.AddDays(1);
      }
    }
    return out.sort((a, b) => a.date - b.date);
  }

  function eclipses(start, end) {
    const out = [];
    let e = A.SearchLunarEclipse(start);
    while (e && e.peak.date <= end) {
      out.push({ type: 'lunar', kind: e.kind, date: e.peak.date, lon: lonAt('moon', e.peak.date), obscuration: e.obscuration });
      e = A.NextLunarEclipse(e.peak);
    }
    let s = A.SearchGlobalSolarEclipse(start);
    while (s && s.peak.date <= end) {
      out.push({ type: 'solar', kind: s.kind, date: s.peak.date, lon: lonAt('sun', s.peak.date), lat: s.latitude, lonGeo: s.longitude });
      s = A.NextGlobalSolarEclipse(s.peak);
    }
    return out.sort((a, b) => a.date - b.date);
  }

  /** Фаза Луны на момент: угол 0…360, освещённость 0…1, название (0…7). */
  function moonState(date) {
    const t = toTime(date);
    const angle = A.MoonPhase(t);
    const illum = (1 - Math.cos(angle * D2R)) / 2;
    const phase8 = Math.floor(((angle + 22.5) % 360) / 45);
    return { angle, illum, phase8, lon: lonAt('moon', date), sign: signOf(lonAt('moon', date)) };
  }

  /** Лунные сутки (традиция: 1-е — от новолуния до первого восхода Луны, далее от восхода до восхода). */
  function lunarDay(date, lat, lon) {
    const t = toTime(date);
    let nm = A.SearchMoonPhase(0, t.AddDays(-31), 31);
    for (;;) { const nx = A.SearchMoonPhase(0, nm.AddDays(1), 31); if (nx && nx.ut <= t.ut) nm = nx; else break; }
    const obs = new A.Observer(lat, lon, 0);
    let n = 1, start = nm, cur = nm;
    for (let guard = 0; guard < 35; guard++) {
      const rise = A.SearchRiseSet(A.Body.Moon, obs, +1, cur, 3);
      if (!rise || rise.ut > t.ut) break;
      n++; start = rise; cur = rise.AddDays(0.02);
    }
    const nextRise = A.SearchRiseSet(A.Body.Moon, obs, +1, t, 3);
    const nextNM = A.SearchMoonPhase(0, t, 31);
    const end = nextNM && (!nextRise || nextNM.ut < nextRise.ut) ? nextNM : nextRise;
    return { day: Math.min(n, 30), start: start.date, end: end ? end.date : null, newMoon: nm.date };
  }

  /** Луна без курса: от последнего точного мажорного аспекта Луны в знаке до выхода из знака. */
  function voidOfCourse(start, end) {
    const ing = ingresses('moon', addDays(start, -3), addDays(end, 3), 0.25);
    const targets = [0, 60, -60, 90, -90, 120, -120, 180];
    const ids = ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    const out = [];
    for (let i = 0; i < ing.length - 1; i++) {
      const a = ing[i].date, b = ing[i + 1].date;
      if (b < start || a > end) continue;
      let last = null, lastWho = null;
      const stepH = 1;
      const n = Math.ceil((b - a) / 3600000 / stepH);
      const prevVals = {};
      for (let k = 0; k <= n; k++) {
        const tk = k === n ? b : new Date(a.getTime() + k * stepH * 3600000);
        const m = lonAt('moon', tk);
        for (const id of ids) {
          const p = lonAt(id, tk);
          for (const tg of targets) {
            const v = d180(m - p - tg);
            const key = id + tg;
            const pv = prevVals[key];
            if (pv && (pv.v < 0) !== (v < 0) && Math.abs(v - pv.v) < 30) {
              const when = bisect((x) => d180(lonAt('moon', x) - lonAt(id, x) - tg), pv.t, tk);
              if (!last || when > last) { last = when; lastWho = { id, angle: Math.abs(tg) }; }
            }
            prevVals[key] = { v, t: tk };
          }
        }
      }
      const from = last || a;
      out.push({ start: from, end: b, sign: ing[i].to, nextSign: ing[i + 1].to, lastAspect: lastWho });
    }
    return out.filter((x) => x.end >= start && x.start <= end);
  }

  // ---------- транзиты ----------
  const TRANSIT_ORB = { sun: 1, mercury: 1, venus: 1, mars: 1.5, jupiter: 2, saturn: 2, uranus: 1.5, neptune: 1.5, pluto: 1.5, node: 1, chiron: 1.5 };

  /**
   * Транзиты к натальной карте: окна действия (вход/выход из орбиса) и точные даты.
   * opts: { transiting: [...ids], natal: [...ids], aspects: [углы], orbMult }
   */
  function transits(natal, start, end, opts) {
    opts = opts || {};
    const tIds = opts.transiting || ['mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    const nIds = (opts.natal || ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'asc', 'mc', 'node']).filter((id) => natal.byId[id]);
    const angles = opts.aspects || [0, 60, 90, 120, 180];
    const mult = opts.orbMult || 1;
    const days = Math.ceil((end - start) / 86400000);
    const step = 1;
    const series = {};
    for (const id of tIds) {
      series[id] = [];
      for (let k = -1; k <= days + 1; k += step) series[id].push(lonAt(id, addDays(start, k)));
    }
    const events = [];
    for (const tid of tIds) {
      const orb = (TRANSIT_ORB[tid] || 1) * mult;
      for (const nid of nIds) {
        const nl = natal.byId[nid].lon;
        for (const ang of angles) {
          for (const sgn of (ang === 0 || ang === 180 ? [1] : [1, -1])) {
            const target = norm(nl + sgn * ang);
            const vals = series[tid].map((l) => d180(l - target));
            let win = null;
            for (let k = 0; k < vals.length; k++) {
              const inOrb = Math.abs(vals[k]) <= orb;
              const day = addDays(start, k - 1);
              if (inOrb && !win) win = { start: day, exact: [], min: Infinity, k0: k };
              if (win) win.min = Math.min(win.min, Math.abs(vals[k]));
              if (win && k > 0 && (vals[k - 1] < 0) !== (vals[k] < 0) && Math.abs(vals[k] - vals[k - 1]) < 20) {
                const when = bisect((x) => d180(lonAt(tid, x) - target), addDays(day, -1), day);
                if (when >= start && when <= end) win.exact.push(when);
              }
              if (win && (!inOrb || k === vals.length - 1)) {
                win.end = inOrb ? day : addDays(day, -1);
                if (win.end >= start && win.start <= end) {
                  events.push({ transiting: tid, natal: nid, angle: ang, type: angleToType(ang), start: win.start, end: win.end, exact: win.exact, minOrb: win.min, openStart: win.k0 <= 1, openEnd: inOrb });
                }
                win = null;
              }
            }
          }
        }
      }
    }
    return events.sort((a, b) => (a.exact[0] || a.start) - (b.exact[0] || b.start));
  }

  function angleToType(a) { return ({ 0: 'conj', 60: 'sextile', 90: 'square', 120: 'trine', 180: 'opp', 150: 'quincunx', 30: 'semisextile', 45: 'semisquare', 135: 'sesquisquare', 72: 'quintile' })[a]; }

  /** Транзитные положения на дату + аспекты к натальной карте (снимок). */
  function transitSnapshot(natal, date, opts) {
    // транзитный Хирон не рассматриваем в прогностике
    const now = PLANETS.concat(['node']).map((id) => body(id, date, opts)).filter(Boolean);
    for (const p of now) { p.sign = signOf(p.lon); p.signIndex = signIndex(p.lon); p.house = natal.houses ? houseOf(p.lon, natal.houses.cusps) : null; }
    const nat = natal.points.filter((p) => p.id !== 'fortune' && p.id !== 'lilith');
    const asp = aspectsBetween(now, nat, { orbMult: 0.3 });
    return { points: now, aspects: asp };
  }

  // ---------- соляр, прогрессии, синастрия ----------
  function solarReturn(natal, year, place, opts) {
    const sunLon = natal.byId.sun.lon;
    const b = natal.date;
    const approx = new Date(Date.UTC(year, b.getUTCMonth(), b.getUTCDate()) - 4 * 86400000);
    const t = A.SearchSunLongitude(sunLon, approx, 10);
    const p = place || natal.params;
    const c = chart({ date: t.date, lat: p.lat, lon: p.lon, timeKnown: true, zone: p.zone }, opts || natal.opts);
    c.returnDate = t.date;
    return c;
  }

  function progressed(natal, targetDate, opts) {
    const ageDays = (targetDate - natal.date) / 86400000;
    const years = ageDays / 365.2422;
    const pDate = addDays(natal.date, years);
    const pts = PLANETS.concat(['node']).map((id) => body(id, pDate, opts || natal.opts)).filter(Boolean);
    if (natal.houses) {
      // MC по солнечной дуге, ASC — из MC для широты рождения
      const arc = d180(pts[0].lon - natal.byId.sun.lon);
      const mc = norm(natal.houses.mc + arc);
      const eps = natal.houses.eps;
      const ramc = norm(atan2d(sind(mc) * cosd(eps), cosd(mc)));
      const asc = ascFromRamc(ramc, natal.params.lat, eps);
      pts.push({ id: 'asc', lon: asc, speed: null }, { id: 'mc', lon: mc, speed: null });
    }
    for (const p of pts) { p.sign = signOf(p.lon); p.signIndex = signIndex(p.lon); p.house = natal.houses ? houseOf(p.lon, natal.houses.cusps) : null; }
    const nat = natal.points.filter((p) => !['fortune', 'lilith', 'chiron'].includes(p.id));
    const aspects = aspectsBetween(pts, nat, { orbMult: 0.15 });
    const moonPhase = Math.floor(((norm(pts[1].lon - pts[0].lon) + 22.5) % 360) / 45);
    return { date: pDate, years, points: pts, byId: Object.fromEntries(pts.map((p) => [p.id, p])), aspects, moonPhase };
  }

  function synastry(a, b, opts) {
    const pick = (c) => c.points.filter((p) => !['fortune', 'lilith'].includes(p.id));
    const asp = aspectsBetween(pick(a), pick(b), Object.assign({ orbMult: 0.75 }, opts || {}));
    // оценки по сферам: ориентир, а не приговор
    const spheres = { attraction: 0, emotion: 0, communication: 0, stability: 0, growth: 0 };
    const weightOf = { attraction: [['venus', 'mars'], ['mars', 'venus'], ['sun', 'venus'], ['venus', 'sun'], ['mars', 'mars'], ['venus', 'pluto'], ['pluto', 'venus'], ['mars', 'pluto'], ['pluto', 'mars'], ['moon', 'mars'], ['mars', 'moon'], ['asc', 'venus'], ['venus', 'asc'], ['asc', 'mars'], ['mars', 'asc']],
      emotion: [['moon', 'moon'], ['sun', 'moon'], ['moon', 'sun'], ['moon', 'venus'], ['venus', 'moon'], ['moon', 'jupiter'], ['jupiter', 'moon'], ['moon', 'asc'], ['asc', 'moon'], ['venus', 'venus']],
      communication: [['mercury', 'mercury'], ['mercury', 'moon'], ['moon', 'mercury'], ['mercury', 'sun'], ['sun', 'mercury'], ['mercury', 'jupiter'], ['jupiter', 'mercury'], ['mercury', 'venus'], ['venus', 'mercury']],
      stability: [['saturn', 'sun'], ['sun', 'saturn'], ['saturn', 'moon'], ['moon', 'saturn'], ['saturn', 'venus'], ['venus', 'saturn'], ['node', 'sun'], ['sun', 'node'], ['node', 'moon'], ['moon', 'node'], ['node', 'venus'], ['venus', 'node'], ['sun', 'sun']],
      growth: [['jupiter', 'sun'], ['sun', 'jupiter'], ['jupiter', 'venus'], ['venus', 'jupiter'], ['jupiter', 'asc'], ['asc', 'jupiter'], ['sun', 'asc'], ['asc', 'sun'], ['chiron', 'sun'], ['sun', 'chiron']] };
    const raw = { attraction: [0, 0], emotion: [0, 0], communication: [0, 0], stability: [0, 0], growth: [0, 0] };
    for (const x of asp) {
      for (const [sph, pairs] of Object.entries(weightOf)) {
        if (!pairs.some(([p, q]) => p === x.a && q === x.b)) continue;
        if (!x.sphere) x.sphere = sph;
        const s = x.strength;
        let v;
        if (sph === 'attraction') v = x.type === 'conj' || x.type === 'opp' ? 1.2 : x.nature === 'hard' ? 0.8 : 0.9; // напряжение тоже «искрит»
        else if (sph === 'stability') v = x.nature === 'soft' ? 1 : x.type === 'conj' ? 0.8 : x.type === 'opp' ? 0.2 : -0.6;
        else v = x.nature === 'soft' ? 1 : x.type === 'conj' ? 0.9 : -0.7;
        raw[sph][0] += v * (0.5 + s);
        raw[sph][1] += 1;
      }
    }
    for (const k of Object.keys(spheres)) {
      const v = raw[k][0];
      spheres[k] = Math.round(100 / (1 + Math.exp(-(v - 0.4) * 1.1)));
    }
    // совпадение стихий Солнца и Луны
    const elem = (c, id) => elementOf(c.byId[id].signIndex);
    const harmony = (e1, e2) => (e1 === e2 ? 1 : ({ fire: 'air', air: 'fire', earth: 'water', water: 'earth' })[e1] === e2 ? 0.8 : 0.35);
    const elemScore = Math.round(100 * (harmony(elem(a, 'sun'), elem(b, 'sun')) * 0.4 + harmony(elem(a, 'moon'), elem(b, 'moon')) * 0.35 + harmony(elem(a, 'sun'), elem(b, 'moon')) * 0.125 + harmony(elem(a, 'moon'), elem(b, 'sun')) * 0.125));
    const total = Math.round(spheres.attraction * 0.22 + spheres.emotion * 0.26 + spheres.communication * 0.18 + spheres.stability * 0.2 + spheres.growth * 0.14);
    return { aspects: asp, spheres, elemScore, total };
  }

  /** Композит по средним точкам (короткая дуга). */
  function composite(a, b) {
    const ids = PLANETS.concat(['node']).concat(a.byId.asc && b.byId.asc ? ['asc', 'mc'] : []);
    const pts = ids.map((id) => {
      const la = a.byId[id].lon, lb = b.byId[id].lon;
      const lon = norm(la + d180(lb - la) / 2);
      return { id, lon, speed: null, sign: signOf(lon), signIndex: signIndex(lon), deg: lon % 30 };
    });
    return { points: pts, byId: Object.fromEntries(pts.map((p) => [p.id, p])), aspects: aspectsWithin(pts, {}) };
  }

  /** Небо на момент: позиции всех тел + Луна. */
  function sky(date, opts) {
    const pts = PLANETS.concat(['node', 'lilith', 'chiron']).map((id) => body(id, date, opts)).filter(Boolean);
    for (const p of pts) { p.sign = signOf(p.lon); p.signIndex = signIndex(p.lon); p.deg = p.lon % 30; p.dignity = dignity(p.id, p.signIndex); }
    return { date, points: pts, byId: Object.fromEntries(pts.map((p) => [p.id, p])), aspects: aspectsWithin(pts.filter((p) => PLANETS.includes(p.id)), { orbMult: 0.5 }), moon: moonState(date) };
  }

  // ---------- профекции ----------
  const TRAD_RULER = Object.assign({}, RULER, { scorpio: 'mars', aquarius: 'saturn', pisces: 'jupiter' });
  /** Годовая профекция: каждый год жизни «включается» следующий дом (по знакам от ASC). */
  function profection(natal, date) {
    const b = natal.date;
    let age = date.getFullYear() - b.getUTCFullYear();
    const bd = new Date(date.getFullYear(), b.getUTCMonth(), b.getUTCDate());
    if (date < bd) age--;
    const house = (age % 12) + 1;
    const ascSign = natal.byId.asc ? natal.byId.asc.signIndex : natal.byId.sun.signIndex;
    const sign = SIGNS[(ascSign + age) % 12];
    return { age, house, sign, lord: TRAD_RULER[sign], fromSun: !natal.byId.asc };
  }

  // ---------- подбор дат (элективная астрология) ----------
  const ELECT = {
    wedding: { name: 'Свадьба, отношения', signs: ['taurus', 'cancer', 'libra', 'pisces', 'leo'], benefic: ['venus', 'jupiter'], retro: ['venus'] },
    contract: { name: 'Договор, сделка, документы', signs: ['gemini', 'virgo', 'capricorn', 'taurus', 'libra'], benefic: ['mercury', 'jupiter'], retro: ['mercury'] },
    business: { name: 'Запуск проекта или бизнеса', signs: ['aries', 'leo', 'sagittarius', 'capricorn', 'taurus'], benefic: ['sun', 'jupiter', 'mars'], retro: ['mercury', 'mars'] },
    move: { name: 'Переезд, покупка жилья', signs: ['taurus', 'cancer', 'virgo', 'capricorn'], benefic: ['venus', 'jupiter', 'saturn'], retro: ['mercury', 'venus'] },
    beauty: { name: 'Красота, покупки, образ', signs: ['taurus', 'libra', 'leo', 'pisces'], benefic: ['venus', 'jupiter'], retro: ['venus'] },
    travel: { name: 'Путешествие', signs: ['sagittarius', 'gemini', 'aquarius', 'aries'], benefic: ['jupiter', 'mercury'], retro: ['mercury'] },
    study: { name: 'Учёба, экзамен, выступление', signs: ['gemini', 'virgo', 'sagittarius', 'aquarius', 'leo'], benefic: ['mercury', 'jupiter', 'sun'], retro: ['mercury'] },
  };
  const INS = { sun: 'Солнцем', mercury: 'Меркурием', venus: 'Венерой', mars: 'Марсом', jupiter: 'Юпитером', saturn: 'Сатурном' };
  const RETRO_NAME = { mercury: 'Ретроградный Меркурий', venus: 'Ретроградная Венера', mars: 'Ретроградный Марс' };
  /**
   * Оценка дней для начинания. dayStartFn(i) → Date местной полуночи i-го дня.
   * Окно дня — 9:00–21:00 местного времени.
   */
  function electional(purpose, startLocalMidnight, days, dayStartFn) {
    const P = ELECT[purpose] || ELECT.business;
    const end = addDays(startLocalMidnight, days + 1);
    let voc = [];
    try { voc = voidOfCourse(addDays(startLocalMidnight, -1), end); } catch (e) { voc = []; }
    const ecl = eclipses(addDays(startLocalMidnight, -4), addDays(end, 4));
    const rp = retrogradePeriods(['mercury', 'venus', 'mars'], addDays(startLocalMidnight, -1), end);
    const out = [];
    for (let i = 0; i < days; i++) {
      const d0 = dayStartFn ? dayStartFn(i) : addDays(startLocalMidnight, i);
      const w0 = new Date(d0.getTime() + 9 * 3600000), w1 = new Date(d0.getTime() + 21 * 3600000);
      const noon = new Date(d0.getTime() + 13 * 3600000);
      const reasons = [];
      let score = 0;
      const ms = moonState(noon);
      if (ms.angle < 12 || ms.angle > 348) { score -= 2; reasons.push(['-', 'Новолуние: энергия на нуле, лучше намечать, чем начинать']); }
      else if (ms.angle < 168) { score += 2; reasons.push(['+', 'Растущая Луна — дело будет расти']); }
      else if (ms.angle < 192) { score -= 1; reasons.push(['-', 'Полнолуние: эмоции на пике']); }
      else { score -= 1; reasons.push(['-', 'Убывающая Луна — лучше для завершения, чем для старта']); }
      const msign = ms.sign;
      if (P.signs.includes(msign)) { score += 2; reasons.push(['+', 'Луна в подходящем знаке']); }
      if (msign === 'scorpio' || msign === 'capricorn') { score -= 1; reasons.push(['-', 'Луна в ослабленном знаке']); }
      let vocMin = 0;
      for (const v of voc) { const a = Math.max(v.start, w0), b = Math.min(v.end, w1); if (b > a) vocMin += (b - a) / 60000; }
      if (vocMin >= 600) { score -= 3; reasons.push(['-', 'Почти весь день Луна без курса']); }
      else if (vocMin > 60) { score -= 1; reasons.push(['-', 'Часть дня Луна без курса — выбирайте время вне этого периода']); }
      else { score += 1; reasons.push(['+', 'Днём Луна не без курса']); }
      for (const r of rp) if (P.retro.includes(r.id) && noon >= r.start && noon <= r.end) { score -= 3; reasons.push(['-', RETRO_NAME[r.id]]); }
      for (const e of ecl) if (Math.abs(e.date - noon) < 3.5 * 86400000) { score -= 2; reasons.push(['-', 'Рядом затмение']); break; }
      const m0 = lonAt('moon', w0), m1 = lonAt('moon', w1);
      for (const id of ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']) {
        const pl = lonAt(id, noon);
        for (const [ang, nat] of [[0, 'conj'], [60, 'soft'], [120, 'soft'], [90, 'hard'], [180, 'hard']]) {
          for (const sg of ang === 0 || ang === 180 ? [1] : [1, -1]) {
            const target = norm(pl + sg * ang);
            const a = d180(m0 - target), b = d180(m1 - target);
            if ((a < 0) !== (b < 0) && Math.abs(a - b) < 30) {
              if (P.benefic.includes(id) && (nat === 'soft' || (nat === 'conj' && id !== 'saturn' && id !== 'mars'))) { score += 1; reasons.push(['+', 'Луна в гармонии с ' + INS[id]]); }
              if ((id === 'saturn' || id === 'mars') && nat === 'hard') { score -= 1; reasons.push(['-', 'Напряжённый аспект Луны с ' + INS[id]]); }
            }
          }
        }
      }
      out.push({ date: d0, score, reasons, moonSign: msign, phase: ms.phase8, vocMin: Math.round(vocMin) });
    }
    return out;
  }

  root.AstroCore = {
    SIGNS, ELEMENT, MODALITY, PLANETS, POINTS, ASPECTS, RULER, HOUSE_SYSTEMS, TRANSIT_ORB,
    norm, d180, signOf, signIndex, elementOf, modalityOf, dignity, fmtDeg, jdUT, addDays,
    tzOffsetMin, localToUTC, body, houses, houseOf, chart, aspectsWithin, aspectsBetween, aspectBetween,
    ingresses, stations, retrogradePeriods, moonPhases, eclipses, moonState, lunarDay, voidOfCourse,
    transits, transitSnapshot, solarReturn, progressed, synastry, composite, sky, profection, electional, ELECT, TRAD_RULER,
    _internals: { meanNode, trueNode, meanLilith, chironLon, ascFromRamc },
  };
})(typeof window !== 'undefined' ? window : globalThis);
