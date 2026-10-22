/* Колесо натальной карты (SVG): зодиак, дома, планеты, аспекты; двойное колесо для синастрии и транзитов. */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS;
  const VS = '︎';

  // цвета — как у колеса Saliastro (22.10.2026, Алина, доска №50: «внешний вид карт как на нашем сайте saliastro»): белый круг,
  // пастельный пояс знаков, чёрные значки, оси AC красная / IC салатовая / DC синяя / MC жёлтая; аспекты: гармония (трин, секстиль) —
  // красная, напряжение (квадрат, оппозиция) — чёрная, соединение — синее, малые — сиреневые пунктиром
  const PAL = {
    light: { paper: '#ffffff', inner: '#ffffff', line2: '#c9beda', tick: '#b7aacb', ink: '#111018', sign: '#111018', plbg: '#ffffff', deg: '#2e2640', retro: '#e0605a',
      cusp: '#8f84a6', cuspInk: '#3a3050', ringIn: '#ebe1fa', ringLine: '#9c8cc0', planet2: '#6b3fb8', deg2: '#4b2f8c', aspBg: '#ffffff',
      ax: { asc: ['#e2312a', '#c42a23'], ic: ['#7cc241', '#3f8a12'], dsc: ['#2b67d9', '#2257bc'], mc: ['#edb400', '#a87a00'] },
      band: { fire: '#f5b7aa', earth: '#c6e2b8', air: '#cbcdf3', water: '#b3deec' },
      soft: '#d7332b', hard: '#111018', conj: '#2563d6', minor: '#9a86d8' },
    dark: { paper: '#0e0a18', inner: '#0b0814', line2: '#6e6299', tick: '#8d82b5', ink: '#ffffff', sign: '#ffffff', plbg: '#1a1430', deg: '#eee8ff', retro: '#ff8a80',
      cusp: '#9a90c4', cuspInk: '#eee8ff', ringIn: '#221a3e', ringLine: '#8c7fc0', planet2: '#e2c9ff', deg2: '#e2c9ff', aspBg: '#0b0814',
      ax: { asc: ['#ff5a50', '#ff8a82'], ic: ['#9be35e', '#b6f08a'], dsc: ['#5c8fff', '#93b5ff'], mc: ['#ffd23f', '#ffe07a'] },
      band: { fire: '#7a3a3a', earth: '#355437', air: '#3e3f7e', water: '#245466' },
      soft: '#ff8a80', hard: '#f1edff', conj: '#7fa8ff', minor: '#c2b0ff' },
  };
  const theme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  const ELEM = ['fire', 'earth', 'air', 'water'];
  const MINOR = ['quincunx', 'semisextile', 'semisquare', 'sesquisquare', 'quintile'];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const FONT_G = "'Noto Sans Symbols 2','Noto Sans Symbols','Segoe UI Symbol','Apple Symbols','DejaVu Sans',sans-serif";
  const FONT_T = "Manrope,'Segoe UI',system-ui,sans-serif";

  const glyphOf = (id) => (T.planets[id] ? T.planets[id].glyph : '');
  const f1 = (n) => Math.round(n * 10) / 10;

  function spread(items, minSep) {
    // items: [{lon, ang}] — раздвигаем по кругу, сохраняя порядок
    const n = items.length;
    if (n < 2) return items;
    items.sort((a, b) => a.ang - b.ang);
    for (let it = 0; it < 80; it++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        const a = items[i], b = items[(i + 1) % n];
        let gap = b.ang - a.ang; if (i === n - 1) gap += 360;
        if (gap < minSep) { const push = (minSep - gap) / 2 + 0.01; a.ang -= push; b.ang += push; moved = true; }
      }
      if (!moved) break;
    }
    return items;
  }

  /**
   * chart — результат AstroCore.chart; opts: { outer: {points}, aspects, size, animate, labelA, labelB }
   */
  // последние нарисованные карты: колесо → данные для подсказок и окна с толкованием (W.attach находит их по data-wk)
  const REG = new Map();
  let regN = 0;
  function register(chart, opts) {
    const id = 'wk' + (++regN);
    REG.set(id, { chart, opts });
    if (REG.size > 40) REG.delete(REG.keys().next().value);
    return id;
  }
  const escA = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ширина подписи куспида (Manrope 800) в долях кегля — подпись встаёт снаружи пояса на продолжении линии и не наезжает на него
  const CW = { I: 0.3, V: 0.66, X: 0.64, A: 0.7, C: 0.68, D: 0.72, M: 0.86 };
  const textW = (str, fs) => [...String(str)].reduce((w, ch) => w + (CW[ch] || 0.6) * fs, 0);
  const extR = (a, w, h) => { const t = a * Math.PI / 180; return Math.abs(Math.cos(t)) * w / 2 + Math.abs(Math.sin(t)) * h / 2; };
  const SOFT_A = ['trine', 'sextile'];

  /** Колесо в стиле Saliastro: белый круг, узкий пастельный пояс знаков, крупные значки планет с градусом под ними,
      куспиды графитом с номером и градусом снаружи пояса, оси цветом, значок аспекта на середине линии.
      Двойное (синастрия, транзиты): внутренний круг — натал на сиреневом, внешний — вторая карта фиолетовым. */
  function svg(chart, opts) {
    opts = opts || {};
    const P = PAL[opts.theme || theme()];
    const bi = !!opts.outer;
    const wk = register(chart, opts);
    const mode = opts.mode || (bi ? (opts.labelB === 'транзит' ? 'transit' : 'synastry') : 'natal');
    const C = 300;
    const R = bi
      ? { zodOut: 280, zodIn: 257, ring: 198, pl: 176, plDeg: 151, asp: 132, opl: 228, oplDeg: 207, hNum: 122 }
      : { zodOut: 267, zodIn: 243, pl: 209, plDeg: 179, asp: 158 };
    const GS = bi ? { in: 23, out: 22.5, deg: 11.5, bg: 12.5, sign: 13.5, hl: 13, hd: 10 } : { in: 26, deg: 12.5, bg: 14, sign: 15, hl: 13.5, hd: 10 };
    const asc = chart.houses ? chart.houses.asc : 0;
    const ang = (lon) => 180 + (lon - asc);
    const xy = (r, a) => [C + r * Math.cos(a * Math.PI / 180), C - r * Math.sin(a * Math.PI / 180)];
    const pt = (r, a) => { const [x, y] = xy(r, a); return `${f1(x)} ${f1(y)}`; };
    const line = (ra, rb, a, attrs) => { const [x0, y0] = xy(ra, a), [x1, y1] = xy(rb, a); return `<line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}" ${attrs}/>`; };
    const anim = opts.animate !== false;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 648 648" role="img" aria-label="Карта ${escA(chart.params && chart.params.name ? chart.params.name : '')}" data-wk="${wk}" data-mode="${mode}">`;
    s += `<g class="${anim ? 'w-rot' : ''}">`;
    // поле внутри пояса; у двойного внутренний круг (натал) — сиреневый
    s += `<circle cx="${C}" cy="${C}" r="${R.zodIn}" fill="${P.paper}"/>`;
    if (bi) s += `<circle cx="${C}" cy="${C}" r="${R.ring}" fill="${P.ringIn}" stroke="${P.ringLine}" stroke-width="1.4"/>`;
    s += `<circle cx="${C}" cy="${C}" r="${R.asp}" fill="${P.inner}" stroke="${bi ? P.ringLine : P.line2}" stroke-width="${bi ? 1.2 : 1}"/>`;
    // пояс знаков: пастельные сектора с просветами, значки знаков — чёрные
    for (let i = 0; i < 12; i++) {
      const a0 = ang(i * 30) + 0.35, a1 = ang(i * 30 + 30) - 0.35;
      const el = ELEM[i % 4], sid = AC.SIGNS[i];
      s += `<path d="M${pt(R.zodOut, a0)} A${R.zodOut} ${R.zodOut} 0 0 0 ${pt(R.zodOut, a1)} L${pt(R.zodIn, a1)} A${R.zodIn} ${R.zodIn} 0 0 1 ${pt(R.zodIn, a0)}Z" fill="${P.band[el]}"/>`;
      const [gx, gy] = xy((R.zodOut + R.zodIn) / 2, ang(i * 30 + 15));
      s += `<text x="${f1(gx)}" y="${f1(gy + 0.5)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_G}" font-size="${GS.sign}" font-weight="700" fill="${P.sign}"><title>${T.signs[sid].name}</title>${T.signs[sid].glyph}${VS}</text>`;
    }
    // шкала градусов по внутреннему краю пояса
    let ticks = '';
    for (let d = 0; d < 360; d++) { const len = d % 10 === 0 ? 8 : d % 5 === 0 ? 5 : 2.5; ticks += `M${pt(R.zodIn, ang(d))}L${pt(R.zodIn - len, ang(d))}`; }
    s += `<path d="${ticks}" stroke="${P.tick}" stroke-width=".7" fill="none"/>`;
    s += `<circle cx="${C}" cy="${C}" r="${R.zodIn}" fill="none" stroke="${P.line2}" stroke-width=".8"/>`;
    // дома: линии графитом в своём круге, оси цветом; номер (римский) и градус куспида — снаружи пояса
    let axes = '', hnum = '';
    if (chart.houses) {
      const cu = chart.houses.cusps;
      const AX = { 0: ['AC', P.ax.asc], 3: ['IC', P.ax.ic], 6: ['DC', P.ax.dsc], 9: ['MC', P.ax.mc] };
      const rEnd = bi ? R.ring : R.zodIn;
      for (let i = 0; i < 12; i++) {
        const a = ang(cu[i]), ax = AX[i];
        const hit = line(R.asp, rEnd, a, 'stroke="#000" stroke-opacity="0" stroke-width="10"');
        if (ax) axes += `<g class="w-cusp" data-cusp="${i + 1}">${line(R.asp, rEnd, a, `stroke="${ax[1][0]}" stroke-width="2.8" stroke-linecap="round"`)}${hit}</g>`;
        else s += `<g class="w-cusp" data-cusp="${i + 1}">${line(R.asp, rEnd, a, `stroke="${P.cusp}" stroke-width="1"`)}${hit}</g>`;
        const label = ax ? ax[0] : ROMAN[i], dg = String(Math.floor(AC.norm(cu[i]) % 30));
        const w = textW(label, GS.hl) + textW(dg, GS.hd) + 1;
        const [hx, hy] = xy(R.zodOut + (ax ? 7 : 5) + extR(a, w, GS.hl), a);
        s += `<text class="w-cusp" data-cusp="${i + 1}" x="${f1(hx)}" y="${f1(hy)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_T}" font-size="${GS.hl}" font-weight="800" fill="${ax ? ax[1][1] : P.cuspInk}">${label}<tspan font-size="${GS.hd}" font-weight="800" dy="-5">${dg}</tspan></text>`;
        if (bi) { // номер дома — внутри круга аспектов, посередине дома
          const mid = cu[i] + AC.norm(cu[(i + 1) % 12] - cu[i]) / 2;
          const [nx, ny] = xy(R.hNum, ang(mid));
          hnum += `<text class="w-cusp" data-cusp="${i + 1}" x="${f1(nx)}" y="${f1(ny)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_T}" font-size="9.5" font-weight="800" fill="${P.cuspInk}" stroke="${P.inner}" stroke-width="3" paint-order="stroke">${i + 1}</text>`;
        }
      }
    }
    s += axes + '</g>';

    // аспекты: линия по кругу аспектов, значок на середине (у соединения — у края круга между точками)
    const pointsA = chart.points.filter((p) => !(opts.hide || []).includes(p.id));
    const lonOf = {};
    for (const p of pointsA) lonOf['a:' + p.id] = p.lon;
    if (bi) for (const p of opts.outer.points) lonOf['b:' + p.id] = p.lon;
    const aspList = (opts.aspects || chart.aspects).filter((x) => opts.minor || !MINOR.includes(x.type));
    const marks = [];
    let k = 0, gly = '';
    s += '<g class="w-asps">';
    for (const x of aspList) {
      const la = lonOf['a:' + x.a], lb = bi ? lonOf['b:' + x.b] : lonOf['a:' + x.b];
      if (la == null || lb == null) continue;
      if (['fortune'].includes(x.a) || ['fortune'].includes(x.b)) continue;
      const [x1, y1] = xy(R.asp, ang(la)), [x2, y2] = xy(R.asp, ang(lb));
      const minor = MINOR.includes(x.type);
      const col = P[x.type === 'conj' ? 'conj' : minor ? 'minor' : SOFT_A.includes(x.type) ? 'soft' : 'hard'];
      const st = x.strength != null ? x.strength : 0.6;
      const ag = T.aspects[x.type] ? T.aspects[x.type].glyph : '';
      const data = `data-asp="${x.a}|${x.b}|${x.type}|${x.orb != null ? x.orb.toFixed(3) : ''}|${x.applying == null ? '' : x.applying ? 1 : 0}"`;
      if (x.type === 'conj') {
        const a1 = ang(la), am = a1 + AC.d180(ang(lb) - a1) / 2, rb = 7;
        let rr = R.asp - rb - 4, [gx, gy] = xy(rr, am);
        for (let n = 0; n < 5 && marks.some(([a, b]) => Math.hypot(a - gx, b - gy) < 2 * rb + 1); n++) { rr -= 2 * rb + 1; [gx, gy] = xy(rr, am); }
        marks.push([gx, gy]);
        gly += `<g class="w-aspg w-conj" ${data}><circle class="w-asp-hit" cx="${f1(gx)}" cy="${f1(gy)}" r="${rb + 5}" fill="#000" fill-opacity="0"/><g class="w-asp-mark"><circle cx="${f1(gx)}" cy="${f1(gy)}" r="${rb}" fill="${P.aspBg}" stroke="${col}" stroke-width="1.3"/><text x="${f1(gx)}" y="${f1(gy + 0.5)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_G}" font-size="10" font-weight="700" fill="${col}">${ag}${VS}</text></g></g>`;
        continue;
      }
      let tt = x.type === 'opp' ? 0.3 : 0.5, mx = x1 + (x2 - x1) * tt, my = y1 + (y2 - y1) * tt;
      for (const q of [0.38, 0.62, 0.3, 0.7]) { if (!marks.some(([a, b]) => Math.hypot(a - mx, b - my) < 14)) break; tt = q; mx = x1 + (x2 - x1) * tt; my = y1 + (y2 - y1) * tt; }
      const long = Math.hypot(x2 - x1, y2 - y1) > 58;
      if (long) marks.push([mx, my]);
      s += `<g class="w-aspg" ${data}>`
        + `<line class="w-asp-v${anim ? ' w-asp' : ''}" style="animation-delay:${(0.9 + k * 0.03).toFixed(2)}s" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${col}" stroke-width="${f1(0.8 + st * 1.2)}" stroke-opacity="${f1(0.55 + st * 0.45)}"${minor ? ' stroke-dasharray="4 3"' : ''}/>`
        + `<line class="w-asp-hit" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="#000" stroke-opacity="0" stroke-width="12" pointer-events="stroke"/>`
        + `<g class="w-asp-mark" pointer-events="none"${long ? '' : ' opacity="0"'}><circle cx="${f1(mx)}" cy="${f1(my)}" r="6.5" fill="${P.aspBg}" stroke="${col}" stroke-width="1"/><text x="${f1(mx)}" y="${f1(my + 0.5)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_G}" font-size="8.5" fill="${col}">${ag}${VS}</text></g>`
        + '</g>';
      k++;
    }
    s += gly + '</g>' + hnum;

    // планеты: засечка у пояса, точка на круге аспектов, значок на подложке, градус под значком (R — ретро)
    function drawPlanets(points, ring, degR, isB, tickFrom, tickTo) {
      const items = points.filter((p) => !['asc', 'mc'].includes(p.id) || isB).map((p) => ({ p, ang: ang(p.lon), base: ang(p.lon) }));
      spread(items, bi ? (isB ? 7 : 8.2) : 7.8);
      const ink = isB ? P.planet2 : P.ink, gSize = isB ? GS.out : GS.in, bg = !bi ? P.plbg : isB ? P.paper : P.ringIn;
      let out = '';
      items.forEach((it, i) => {
        const p = it.p;
        const sign = T.signs[AC.signOf(p.lon)];
        const tip = `${T.planets[p.id] ? T.planets[p.id].name : p.id} · ${AC.fmtDeg(p.lon)} ${sign.name}${p.house ? ' · ' + p.house + ' дом' : ''}${p.retro ? ' · ретроградный' : ''}${isB && opts.labelB ? ' · ' + opts.labelB : ''}`;
        out += `<g class="w-hover ${anim ? 'w-planet' : ''}" style="animation-delay:${(0.35 + i * 0.05).toFixed(2)}s" data-tip="${escA(tip)}" data-pid="${p.id}" data-side="${isB ? 'b' : 'a'}" tabindex="0" role="button" aria-label="${escA(tip)}">`;
        out += line(tickFrom, tickTo, it.base, `stroke="${ink}" stroke-width="2"`);
        if (Math.abs(it.ang - it.base) > 1.2) { const [lx, ly] = xy(tickTo, it.base), [gx2, gy2] = xy(ring + GS.bg - 1, it.ang); out += `<line x1="${f1(lx)}" y1="${f1(ly)}" x2="${f1(gx2)}" y2="${f1(gy2)}" stroke="${P.line2}" stroke-width=".8"/>`; }
        if (!isB) { const [px, py] = xy(R.asp, it.base); out += `<circle cx="${f1(px)}" cy="${f1(py)}" r="2.3" fill="${ink}"/>`; }
        const [gx, gy] = xy(ring, it.ang);
        const g = glyphOf(p.id);
        out += `<circle class="pbg" cx="${f1(gx)}" cy="${f1(gy)}" r="${GS.bg}" fill="${bg}" stroke="${ink}" stroke-opacity="0"/>`;
        out += /^[A-Z]{2}$/.test(g) ? `<text x="${f1(gx)}" y="${f1(gy)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_T}" font-size="${bi ? 10 : 11}" font-weight="800" fill="${ink}">${g}</text>`
          : `<text x="${f1(gx)}" y="${f1(gy + 0.5)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_G}" font-size="${gSize}" font-weight="700" fill="${ink}">${g}${VS}</text>`;
        const [dx, dy] = xy(degR, it.ang);
        out += `<text x="${f1(dx)}" y="${f1(dy)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_T}" font-size="${GS.deg}" font-weight="800" fill="${isB ? P.deg2 : P.deg}">${Math.floor(AC.norm(p.lon) % 30)}°${p.retro ? `<tspan fill="${P.retro}" font-size="${f1(GS.deg - 2.5)}" font-weight="800">R</tspan>` : ''}</text>`;
        out += '</g>';
      });
      return out;
    }
    const inPts = pointsA.filter((p) => p.id !== 'fortune' || opts.fortune !== false);
    if (bi) {
      s += drawPlanets(inPts, R.pl, R.plDeg, false, R.ring, R.ring - 7);
      s += drawPlanets(opts.outer.points.filter((p) => !['fortune', 'lilith'].includes(p.id)), R.opl, R.oplDeg, true, R.zodIn, R.zodIn - 7);
    } else s += drawPlanets(inPts, R.pl, R.plDeg, false, R.zodIn, R.zodIn - 10);
    s += '</svg>';
    return s;
  }

  // ---------- подсказки при наведении и окно с толкованием по клику ----------
  const SOFT = ['trine', 'sextile', 'semisextile', 'quintile'];
  const natureOf = (type) => (type === 'conj' ? 'conj' : SOFT.includes(type) ? 'soft' : 'hard');
  const NATURE_WORD = { conj: 'слияние', soft: 'гармоничный', hard: 'напряжённый' };
  const ANGLE = { conj: 0, sextile: 60, square: 90, trine: 120, opp: 180, quincunx: 150, semisextile: 30, semisquare: 45, sesquisquare: 135, quintile: 72 };
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pn = (id) => (T.planets[id] ? T.planets[id].name : id);
  const orbStr = (o) => { if (o == null || o === '' || isNaN(o)) return ''; const d = Math.floor(o); let m = Math.round((o - d) * 60); return `${m === 60 ? d + 1 : d}°${String(m === 60 ? 0 : m).padStart(2, '0')}′`; };
  const premiumOpen = () => { try { return !!(window.Premium && window.Premium.isOpen()); } catch (e) { return false; } };
  const firstSentence = (t) => { const m = /^(.+?[.!?])(\s|$)/.exec(String(t || '')); return m ? m[1] : String(t || ''); };

  function ctxOf(box) {
    const el = box.querySelector('svg[data-wk]');
    const reg = el && REG.get(el.dataset.wk);
    return { mode: el ? el.dataset.mode : 'natal', chart: reg && reg.chart, opts: (reg && reg.opts) || {} };
  }
  function parseAsp(str) {
    const [a, b, type, orb, app] = String(str || '').split('|');
    return { a, b, type, orb: orb === '' || orb == null ? null : +orb, applying: app === '' || app == null ? null : app === '1' };
  }
  /** Подписи сторон двойного колеса: натал/транзит, имена пары. Для обычной карты — null. */
  function sides(c) {
    if (c.mode === 'transit') return [c.opts.labelA || 'натал', c.opts.labelB || 'транзит'];
    if (c.mode === 'synastry') return [c.opts.labelA || 'Карта 1', c.opts.labelB || 'Карта 2'];
    return null;
  }
  function aspTitle(x, c) {
    const asp = T.aspects[x.type];
    if (c.mode === 'transit') return `${glyphOf(x.b)} ${pn(x.b)} (транзит) ${asp.glyph} ${glyphOf(x.a)} ${pn(x.a)} (натал)`;
    const sd = sides(c);
    if (sd) return `${pn(x.a)} (${sd[0]}) ${asp.glyph} ${pn(x.b)} (${sd[1]})`;
    return `${glyphOf(x.a)} ${pn(x.a)} ${asp.glyph} ${glyphOf(x.b)} ${pn(x.b)}`;
  }
  function aspSub(x) {
    const asp = T.aspects[x.type];
    return [asp.name, ANGLE[x.type] != null ? ANGLE[x.type] + '°' : '', x.orb != null ? 'орбис ' + orbStr(x.orb) : '', x.applying == null ? '' : x.applying ? 'сходящийся' : 'расходящийся'].filter(Boolean).join(' · ');
  }
  function aspTip(x, c) {
    const asp = T.aspects[x.type];
    if (!asp) return '';
    return `<b class="wt-t">${esc(aspTitle(x, c))}</b><span class="wt-s"><i style="background:${asp.color}"></i>${esc(aspSub(x))}</span><span class="wt-a">${esc(firstSentence(asp.about))}</span><span class="wt-h">${c.chart ? 'Нажмите — толкование' : ''}</span>`;
  }
  function pointOf(c, id, side) {
    if (!c.chart) return null;
    if (side === 'b') { const o = c.opts.outer; return o ? (o.byId ? o.byId[id] : (o.points || []).find((p) => p.id === id)) : null; }
    return c.chart.byId ? c.chart.byId[id] : null;
  }
  function posLine(p) {
    if (!p) return '';
    const sign = T.signs[AC.signOf(p.lon)];
    return `${AC.fmtDeg(p.lon)} ${sign.name}${p.house ? ' · ' + ROMAN[p.house - 1] + ' дом' : ''}${p.retro ? ' · ретроградный' : ''}`;
  }
  function planetTip(g, c) {
    const id = g.dataset.pid, side = g.dataset.side;
    const p = pointOf(c, id, side);
    const sd = sides(c);
    const pl = T.planets[id];
    if (!p || !pl) return `<b class="wt-t">${esc(g.dataset.tip)}</b>`;
    return `<b class="wt-t">${glyphOf(id)} ${esc(pl.name)}${sd ? ' · ' + esc(sd[side === 'b' ? 1 : 0]) : ''}</b><span class="wt-s">${esc(posLine(p))}</span>${pl.keys ? `<span class="wt-a">${esc(pl.keys)}</span>` : ''}<span class="wt-h">Нажмите — подробнее</span>`;
  }
  function cuspTip(n, c) {
    const h = c.chart && c.chart.houses;
    const th = T.houses[n];
    if (!h || !th) return '';
    const lon = h.cusps[n - 1], sg = AC.signOf(lon), ruler = AC.RULER[sg];
    return `<b class="wt-t">${ROMAN[n - 1]} дом · ${esc(th.title)}</b><span class="wt-s">куспид ${AC.fmtDeg(lon)} ${esc(T.signs[sg].name)} · управитель ${esc(pn(ruler))}</span><span class="wt-a">${esc(th.about)}</span>`;
  }

  // ----- окно с подробностями: аспект, планета или дом -----
  function lockedText(title) {
    if (!(window.Premium && window.Premium.locked)) return '';
    return window.Premium.locked(esc(title), { lines: 3, meta: 'премиум' }) + `<p class="small" style="margin:10px 0 0"><a href="premium.html">${window.UI ? window.UI.icon('crown') : ''} Полное толкование — в премиум-доступе</a></p>`;
  }
  function aspText(x, c) {
    if (c.mode === 'transit') return T.transitText(x.b, x.a, x.type).text;
    if (c.mode === 'synastry') { const sd = sides(c); return T.synastryText(x.a, x.b, x.type, sd[0], sd[1]); }
    return T.aspectText(x.a, x.b, x.type);
  }
  function aspDetail(x, c) {
    const asp = T.aspects[x.type];
    if (!asp || !T.planets[x.a] || !T.planets[x.b]) return '';
    const sd = sides(c);
    const pa = pointOf(c, x.a, 'a'), pb = pointOf(c, x.b, sd ? 'b' : 'a');
    const card = (id, p, label) => `<div class="am-pl"><span class="glyph">${glyphOf(id)}</span><div><b>${esc(pn(id))}${label ? ` <small class="muted">· ${esc(label)}</small>` : ''}</b><small>${esc(posLine(p))}</small><span>${esc(T.planets[id].keys || '')}</span></div></div>`;
    const tags = [`<span class="badge" style="color:${asp.color}">${esc(asp.name)}${ANGLE[x.type] != null ? ' · ' + ANGLE[x.type] + '°' : ''}</span>`, x.orb != null ? `<span class="badge">орбис ${orbStr(x.orb)}</span>` : '', x.applying == null ? '' : `<span class="badge ${x.applying ? 'gold' : ''}">${x.applying ? 'сходящийся — набирает силу' : 'расходящийся — ослабевает'}</span>`, `<span class="badge">${NATURE_WORD[natureOf(x.type)]}</span>`].join('');
    // на открытой натальной карте полный текст — в премиуме; двойные колёса и так открываются только в премиуме
    const open = premiumOpen() || (c.mode !== 'natal' && c.mode !== 'free');
    const tr = c.mode === 'transit';
    const A = tr ? x.b : x.a, B = tr ? x.a : x.b;
    const head = `${pn(A)} ${asp.phrase} ${asp.caseKey === 'ins' ? T.planets[B].ins : T.planets[B].dat}`;
    return `<div class="am">
      <div class="am-glyphs"><span class="glyph">${glyphOf(A)}</span><span class="glyph" style="color:${asp.color}">${asp.glyph}</span><span class="glyph">${glyphOf(B)}</span></div>
      <h3>${esc(head)}</h3>
      <div class="tags">${tags}</div>
      <p class="am-about">${esc(asp.about)}</p>
      <div class="am-pls">${tr ? card(x.b, pb, 'транзит') + card(x.a, pa, 'натал') : card(x.a, pa, sd ? sd[0] : '') + card(x.b, pb, sd ? sd[1] : '')}</div>
      <h4>Толкование</h4>
      ${open ? `<p>${esc(aspText(x, c))}</p>` : lockedText(`Как ${pn(x.a)} и ${pn(x.b)} работают вместе в вашей карте`)}
    </div>`;
  }
  function planetDetail(id, side, c) {
    const p = pointOf(c, id, side), pl = T.planets[id];
    if (!p || !pl) return '';
    const sign = AC.signOf(p.lon), sd = sides(c);
    const open = premiumOpen() || (c.mode !== 'natal' && c.mode !== 'free');
    const all = (c.opts.aspects || (c.chart && c.chart.aspects) || []).filter((x) => T.aspects[x.type] && x.a !== 'fortune' && x.b !== 'fortune' && (c.opts.minor || !MINOR.includes(x.type)));
    const list = all.filter((x) => (sd ? (side === 'b' ? x.b === id : x.a === id) : (x.a === id || x.b === id)));
    const tags = [`<span class="badge">${AC.fmtDeg(p.lon)} ${esc(T.signs[sign].name)}</span>`, p.house ? `<span class="badge gold">${ROMAN[p.house - 1]} дом · ${esc(T.houses[p.house].title)}</span>` : '', p.dignity ? `<span class="badge ${p.dignity === 'domicile' || p.dignity === 'exaltation' ? 'ok' : 'warn'}">${esc(T.dignity[p.dignity])}</span>` : '', p.retro ? '<span class="badge rose">ретроградный</span>' : ''].join('');
    const inSign = T.planetInSign(id, sign), inHouse = p.house ? T.planetInHouse(id, p.house) : '';
    return `<div class="am">
      <div class="am-glyphs"><span class="glyph">${glyphOf(id)}</span><span class="glyph" style="color:var(--gold)">${T.signs[sign].glyph}</span></div>
      <h3>${esc(pl.name)} ${esc(T.signs[sign].loc)}${sd ? ` <small class="muted">· ${esc(sd[side === 'b' ? 1 : 0])}</small>` : ''}</h3>
      <div class="tags">${tags}</div>
      ${pl.about ? `<p class="am-about">${esc(pl.about)}</p>` : ''}
      ${inSign ? `<h4>${esc(pl.name)} ${esc(T.signs[sign].loc)}</h4><p>${esc(inSign)}</p>` : ''}
      ${inHouse ? `<h4>В ${ROMAN[p.house - 1]} доме</h4>${open ? `<p>${esc(inHouse)}</p>` : lockedText(`${pl.name} в ${ROMAN[p.house - 1]} доме — в какой сфере жизни проявляется`)}` : ''}
      ${list.length ? `<h4>Аспекты <small class="muted">— нажмите, чтобы открыть</small></h4><div class="am-asps">${list.map((x) => { const a = T.aspects[x.type]; const other = sd ? (side === 'b' ? x.a : x.b) : (x.a === id ? x.b : x.a); return `<button type="button" class="chip" data-am-asp="${x.a}|${x.b}|${x.type}|${x.orb != null ? x.orb.toFixed(3) : ''}|${x.applying == null ? '' : x.applying ? 1 : 0}"><span class="glyph" style="color:${a.color}">${a.glyph}</span> ${glyphOf(other)} ${esc(pn(other))} <small class="muted">${orbStr(x.orb)}</small></button>`; }).join('')}</div>` : ''}
    </div>`;
  }
  function cuspDetail(n, c) {
    const h = c.chart && c.chart.houses, th = T.houses[n];
    if (!h || !th) return '';
    const lon = h.cusps[n - 1], sg = AC.signOf(lon), ruler = AC.RULER[sg], rp = c.chart.byId[ruler];
    const inside = (c.chart.points || []).filter((p) => p.house === n && AC.PLANETS.concat(['node', 'chiron', 'lilith']).includes(p.id));
    return `<div class="am">
      <div class="am-glyphs"><span class="am-roman">${ROMAN[n - 1]}</span></div>
      <h3>${ROMAN[n - 1]} дом · ${esc(th.title)}</h3>
      <div class="tags"><span class="badge">куспид ${AC.fmtDeg(lon)} ${esc(T.signs[sg].name)}</span><span class="badge gold">управитель ${esc(pn(ruler))}${rp && rp.house ? ' · в ' + ROMAN[rp.house - 1] + ' доме' : ''}</span></div>
      <p class="am-about">${esc(th.about)}</p>
      <p class="small">${inside.length ? 'В доме: ' + inside.map((p) => `${glyphOf(p.id)} ${esc(pn(p.id))}`).join(', ') : 'Планет в доме нет — о теме дома рассказывает его управитель.'}</p>
    </div>`;
  }
  function openDetail(html, box) {
    if (!html || !window.UI) return;
    const m = window.UI.modal(html, { cls: 'am-modal' });
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-am-asp]'); if (!b) return;
      const body = m.el.querySelector('.am');
      if (!body) return;
      const html2 = aspDetail(parseAsp(b.dataset.amAsp), ctxOf(box));
      if (!html2) return;
      body.outerHTML = html2;
      if (window.UI.fadeIn) window.UI.fadeIn(m.el.querySelector('.am'), 4);
    });
  }

  function attach(box) {
    if (!box) return;
    // подсказка — один элемент в блоке колеса; если колесо перерисовали через innerHTML, создаётся заново
    const tipEl = () => {
      let t = box.querySelector(':scope > .wheel-tip');
      if (!t) { t = document.createElement('div'); t.className = 'wheel-tip'; t.setAttribute('role', 'tooltip'); box.appendChild(t); }
      return t;
    };
    tipEl();
    if (box.dataset.wAttached) return; // обработчики уже стоят — колесо внутри перерисовали
    box.dataset.wAttached = '1';
    const touch = () => { try { return matchMedia('(hover: none)').matches; } catch (e) { return false; } };
    function place(x, y) {
      const tip = tipEl();
      const r = box.getBoundingClientRect();
      tip.style.left = '0px'; tip.style.top = '0px';
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let lx = x - r.left - w / 2, ly = y - r.top - h - 16;
      lx = Math.max(8 - r.left, Math.min(lx, window.innerWidth - r.left - w - 8));
      if (ly + r.top < 8) ly = y - r.top + 20; // сверху не помещается — показываем под курсором
      tip.style.left = Math.round(lx) + 'px'; tip.style.top = Math.round(ly) + 'px';
    }
    function focusOn(pred) {
      box.classList.add('wf');
      box.querySelectorAll('.w-aspg').forEach((g) => g.classList.toggle('on', pred(parseAsp(g.dataset.asp))));
    }
    function clear() { tipEl().classList.remove('show'); box.classList.remove('wf'); box.querySelectorAll('.w-aspg.on').forEach((g) => g.classList.remove('on')); }
    let lastT = null;
    function showFor(t, x, y) {
      const c = ctxOf(box);
      let html = '';
      if (t.matches('.w-aspg')) {
        const a = parseAsp(t.dataset.asp);
        html = aspTip(a, c);
        if (lastT !== t) box.querySelectorAll('.w-aspg').forEach((g) => g.classList.toggle('on', g === t));
        box.classList.add('wf');
      } else if (t.matches('[data-pid]')) {
        const id = t.dataset.pid, side = t.dataset.side, bi = !!sides(c);
        html = planetTip(t, c);
        if (lastT !== t) focusOn((o) => (bi ? (side === 'b' ? o.b === id : o.a === id) : (o.a === id || o.b === id)));
        const gr = t.getBoundingClientRect(); x = gr.left + gr.width / 2; y = gr.top;
      } else if (t.matches('[data-cusp]')) { html = cuspTip(+t.dataset.cusp, c); box.classList.remove('wf'); }
      if (!html) { clear(); return; }
      const tip = tipEl();
      if (lastT !== t || !tip.innerHTML) { tip.innerHTML = html; lastT = t; }
      tip.classList.add('show');
      if (x == null) { const gr = t.getBoundingClientRect(); x = gr.left + gr.width / 2; y = gr.top; }
      place(x, y);
    }
    const target = (e) => (e.target && e.target.closest ? e.target.closest('.w-aspg, [data-pid], [data-cusp]') : null);
    box.addEventListener('mousemove', (e) => { if (touch()) return; const t = target(e); if (t) showFor(t, e.clientX, e.clientY); else { lastT = null; clear(); } });
    box.addEventListener('mouseleave', () => { lastT = null; clear(); });
    box.addEventListener('focusin', (e) => { const t = target(e); if (t) { lastT = null; showFor(t); } });
    box.addEventListener('focusout', () => { lastT = null; clear(); });
    box.addEventListener('click', (e) => {
      const t = target(e);
      if (!t) { lastT = null; clear(); return; }
      const c = ctxOf(box);
      if (!c.chart || c.opts.static) { lastT = null; showFor(t, e.clientX, e.clientY); return; }
      lastT = null; clear();
      if (t.matches('.w-aspg')) openDetail(aspDetail(parseAsp(t.dataset.asp), c), box);
      else if (t.matches('[data-pid]')) openDetail(planetDetail(t.dataset.pid, t.dataset.side, c), box);
      else if (t.matches('[data-cusp]')) openDetail(cuspDetail(+t.dataset.cusp, c), box);
    });
    box.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-pid]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  }

  /** Сохранить колесо картинкой PNG (2000×2000). */
  function exportPNG(chart, opts, filename) {
    const th = theme();
    const src = svg(chart, Object.assign({}, opts, { animate: false, theme: th }));
    const size = 2000;
    const img = new Image();
    const blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = size; cv.height = size + 160;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = th === 'dark' ? '#140f28' : '#fbf8ff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 60, 60, size - 120, size - 120);
      ctx.fillStyle = th === 'dark' ? '#e2c48c' : '#8a6a3a';
      ctx.font = '600 44px Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillText(opts && opts.caption ? opts.caption : '', size / 2, size + 40);
      ctx.font = '32px Georgia, serif'; ctx.fillStyle = th === 'dark' ? '#b9afd8' : '#6b6388';
      ctx.fillText((window.SITE ? window.SITE.name + ' · астролог' : ''), size / 2, size + 100);
      URL.revokeObjectURL(url);
      cv.toBlob((b) => window.UI.download(filename || 'natal-chart.png', b), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); window.UI.toast('Не удалось сохранить картинку', 'info'); };
    img.src = url;
  }

  window.Wheel = { svg, attach, exportPNG, PAL, aspDetail, planetDetail, cuspDetail, openDetail, parseAsp };
})();
