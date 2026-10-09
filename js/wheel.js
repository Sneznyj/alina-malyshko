/* Колесо натальной карты (SVG): зодиак, дома, планеты, аспекты; двойное колесо для синастрии и транзитов. */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS;
  const VS = '︎';

  const PAL = {
    light: { ink: '#2a2342', ink2: '#6b6388', line: '#d3c8ef', line2: '#b4a5e2', inner: 'rgba(255,255,255,0.75)', ring: 'rgba(255,255,255,0.55)', gold: '#b8935a', planet: '#4b3a8f', planetBg: '#ffffff', planetB: '#b0507a', planetBBg: '#fff4f8',
      band: { fire: '#fbe4da', earth: '#e4f1dd', air: '#e6ebfb', water: '#dcecf6' }, sign: { fire: '#d0694f', earth: '#4f8f4f', air: '#5c77c4', water: '#2f87a8' },
      asp: { conj: '#c8a46a', opp: '#d9506a', square: '#e0607e', trine: '#4f8fd8', sextile: '#3fa79a', quincunx: '#9a7fd1', semisextile: '#7cc0b2', semisquare: '#e89aae', sesquisquare: '#e89aae', quintile: '#b39be6' } },
    dark: { ink: '#f2edff', ink2: '#b9afd8', line: '#3d3468', line2: '#5a4d94', inner: 'rgba(28,22,54,0.85)', ring: 'rgba(36,28,68,0.6)', gold: '#e2c48c', planet: '#e6dcff', planetBg: '#251d47', planetB: '#f3a6c8', planetBBg: '#3a2140',
      band: { fire: '#3a2433', earth: '#20332b', air: '#262c4b', water: '#1d3242' }, sign: { fire: '#f39a83', earth: '#9fd09a', air: '#a9bbf3', water: '#8ac8e2' },
      asp: { conj: '#e8c88a', opp: '#f58aa3', square: '#f58aa3', trine: '#7fb2f0', sextile: '#6fd0c0', quincunx: '#b9a3f3', semisextile: '#8fd3c6', semisquare: '#f3b2c2', sesquisquare: '#f3b2c2', quintile: '#c9b8f5' } },
  };
  const theme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  const ELEM = ['fire', 'earth', 'air', 'water'];
  const MINOR = ['quincunx', 'semisextile', 'semisquare', 'sesquisquare', 'quintile'];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const FONT_G = "'Noto Sans Symbols','Noto Sans Symbols 2','Segoe UI Symbol','Apple Symbols','DejaVu Sans',sans-serif";
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

  function svg(chart, opts) {
    opts = opts || {};
    const P = PAL[opts.theme || theme()];
    const bi = !!opts.outer;
    const wk = register(chart, opts);
    const mode = opts.mode || (bi ? (opts.labelB === 'транзит' ? 'transit' : 'synastry') : 'natal');
    const C = 300;
    const R = bi
      ? { out: 296, bandOut: 248, bandIn: 212, planet: 182, deg: 158, house: 124, asp: 112, outerPlanet: 272 }
      : { out: 292, bandOut: 292, bandIn: 250, planet: 214, deg: 186, house: 150, asp: 136 };
    const asc = chart.houses ? chart.houses.asc : 0;
    const ang = (lon) => 180 + (lon - asc);
    const xy = (r, a) => [C + r * Math.cos(a * Math.PI / 180), C - r * Math.sin(a * Math.PI / 180)];
    const arcPath = (r1, r2, a1, a2) => {
      const [x1, y1] = xy(r2, a1), [x2, y2] = xy(r2, a2), [x3, y3] = xy(r1, a2), [x4, y4] = xy(r1, a1);
      const large = a2 - a1 > 180 ? 1 : 0;
      return `M${f1(x1)},${f1(y1)}A${r2},${r2} 0 ${large} 0 ${f1(x2)},${f1(y2)}L${f1(x3)},${f1(y3)}A${r1},${r1} 0 ${large} 1 ${f1(x4)},${f1(y4)}Z`;
    };
    const anim = opts.animate !== false;
    let s = '';
    s += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 648 648" role="img" aria-label="Карта ${escA(chart.params && chart.params.name ? chart.params.name : '')}" data-wk="${wk}" data-mode="${mode}">`;
    s += `<g class="${anim ? 'w-rot' : ''}">`;
    // фоновые круги
    if (bi) s += `<circle cx="${C}" cy="${C}" r="${R.out}" fill="${P.ring}" stroke="${P.line2}" stroke-width="1"/>`;
    s += `<circle cx="${C}" cy="${C}" r="${R.bandOut}" fill="${P.ring}" stroke="${P.line2}" stroke-width="1.2"/>`;
    // зодиакальный пояс
    for (let i = 0; i < 12; i++) {
      const a1 = ang(i * 30), a2 = ang(i * 30 + 30);
      const el = ELEM[i % 4];
      s += `<path d="${arcPath(R.bandIn, R.bandOut, a1, a2)}" fill="${P.band[el]}" stroke="${P.line2}" stroke-width=".8"/>`;
      const [gx, gy] = xy((R.bandIn + R.bandOut) / 2, ang(i * 30 + 15));
      const sid = AC.SIGNS[i];
      s += `<text x="${f1(gx)}" y="${f1(gy)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_G}" font-size="${bi ? 19 : 22}" fill="${P.sign[el]}"><title>${T.signs[sid].name}</title>${T.signs[sid].glyph}</text>`;
    }
    // градусные риски
    for (let d = 0; d < 360; d++) {
      const len = d % 10 === 0 ? 9 : d % 5 === 0 ? 6 : 3;
      const [x1, y1] = xy(R.bandIn, ang(d)), [x2, y2] = xy(R.bandIn - len, ang(d));
      s += `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${P.line2}" stroke-width="${d % 10 === 0 ? 1 : 0.6}"/>`;
    }
    s += `<circle cx="${C}" cy="${C}" r="${R.bandIn}" fill="none" stroke="${P.line2}" stroke-width="1"/>`;
    s += `<circle cx="${C}" cy="${C}" r="${R.asp}" fill="${P.inner}" stroke="${P.line2}" stroke-width="1"/>`;
    // дома
    if (chart.houses) {
      const cu = chart.houses.cusps;
      for (let i = 0; i < 12; i++) {
        const a = ang(cu[i]);
        const angular = i % 3 === 0;
        const [x1, y1] = xy(R.asp, a), [x2, y2] = xy(angular ? R.bandOut + (bi ? 0 : 10) : R.bandIn, a);
        s += `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${angular ? P.gold : P.line2}" stroke-width="${angular ? 1.8 : 0.9}"${angular ? '' : ' stroke-dasharray="3 3"'}/>`;
        const next = cu[(i + 1) % 12];
        const mid = cu[i] + AC.norm(next - cu[i]) / 2;
        const [hx, hy] = xy(R.house, ang(mid));
        s += `<text class="w-cusp" data-cusp="${i + 1}" x="${f1(hx)}" y="${f1(hy)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_T}" font-size="11" font-weight="600" fill="${P.ink2}" opacity=".8">${ROMAN[i]}</text>`;
      }
      if (!bi) {
        const lbl = [['ASC', cu[0]], ['IC', cu[3]], ['DSC', cu[6]], ['MC', cu[9]]];
        for (const [t, lon] of lbl) {
          const [x, y] = xy(R.bandOut + 22, ang(lon));
          s += `<text class="w-cusp" data-cusp="${{ ASC: 1, IC: 4, DSC: 7, MC: 10 }[t]}" x="${f1(x)}" y="${f1(y)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_T}" font-size="12" font-weight="700" fill="${P.gold}">${t}</text>`;
        }
      }
    }
    s += '</g>';

    // аспекты
    const pointsA = chart.points.filter((p) => !(opts.hide || []).includes(p.id));
    const lonOf = {};
    for (const p of pointsA) lonOf['a:' + p.id] = p.lon;
    if (bi) for (const p of opts.outer.points) lonOf['b:' + p.id] = p.lon;
    const aspList = (opts.aspects || chart.aspects).filter((x) => opts.minor || !MINOR.includes(x.type));
    let k = 0;
    s += '<g class="w-asps">';
    for (const x of aspList) {
      const la = lonOf['a:' + x.a], lb = bi ? lonOf['b:' + x.b] : lonOf['a:' + x.b];
      if (la == null || lb == null) continue;
      if (['fortune'].includes(x.a) || ['fortune'].includes(x.b)) continue;
      const [x1, y1] = xy(R.asp, ang(la)), [x2, y2] = xy(R.asp, ang(lb));
      if (x.type === 'conj') continue;
      const op = 0.3 + 0.65 * (x.strength != null ? x.strength : 0.6);
      const col = P.asp[x.type] || P.line2;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const ag = T.aspects[x.type] ? T.aspects[x.type].glyph : '';
      s += `<g class="w-aspg" data-asp="${x.a}|${x.b}|${x.type}|${x.orb != null ? x.orb.toFixed(3) : ''}|${x.applying == null ? '' : x.applying ? 1 : 0}">`
        + `<line class="w-asp-v${anim ? ' w-asp' : ''}" style="animation-delay:${(0.9 + k * 0.03).toFixed(2)}s" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${col}" stroke-width="${x.nature === 'hard' || x.type === 'opp' ? 1.4 : 1.2}" stroke-opacity="${op.toFixed(2)}"${MINOR.includes(x.type) ? ' stroke-dasharray="4 3"' : ''}/>`
        + `<line class="w-asp-hit" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="#000" stroke-opacity="0" stroke-width="12" pointer-events="stroke"/>`
        + `<g class="w-asp-mark" pointer-events="none" opacity="0"><circle cx="${f1(mx)}" cy="${f1(my)}" r="9" fill="${P.planetBg}" stroke="${col}" stroke-width="1.2"/><text x="${f1(mx)}" y="${f1(my + 0.5)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_G}" font-size="11" fill="${col}">${ag}</text></g>`
        + '</g>';
      k++;
    }
    s += '</g>';

    // планеты
    function drawPlanets(points, ring, degR, isB, tickR) {
      const items = points.filter((p) => !['asc', 'mc'].includes(p.id) || isB).map((p) => ({ p, ang: ang(p.lon), base: ang(p.lon) }));
      spread(items, bi ? 8.6 : 7.4);
      let out = '';
      items.forEach((it, i) => {
        const p = it.p;
        const [tx1, ty1] = xy(tickR, it.base), [tx2, ty2] = xy(tickR + (isB ? 8 : -8), it.base);
        out += `<line x1="${f1(tx1)}" y1="${f1(ty1)}" x2="${f1(tx2)}" y2="${f1(ty2)}" stroke="${isB ? P.planetB : P.planet}" stroke-width="1.6"/>`;
        const [gx, gy] = xy(ring, it.ang);
        const [cx2, cy2] = xy(isB ? tickR + 8 : tickR - 8, it.base);
        if (Math.abs(it.ang - it.base) > 0.8) out += `<line x1="${f1(cx2)}" y1="${f1(cy2)}" x2="${f1(xy(ring + (isB ? -14 : 14), it.ang)[0])}" y2="${f1(xy(ring + (isB ? -14 : 14), it.ang)[1])}" stroke="${P.line2}" stroke-width=".7"/>`;
        const sign = T.signs[AC.signOf(p.lon)];
        const tip = `${T.planets[p.id] ? T.planets[p.id].name : p.id} · ${AC.fmtDeg(p.lon)} ${sign.name}${p.house ? ' · ' + p.house + ' дом' : ''}${p.retro ? ' · ретроградный' : ''}${isB && opts.labelB ? ' · ' + opts.labelB : ''}`;
        const g = glyphOf(p.id);
        const txt = /^[A-Z]{2}$/.test(g) ? `<text x="${f1(gx)}" y="${f1(gy)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_T}" font-size="10" font-weight="700" fill="${isB ? P.planetB : P.planet}">${g}</text>`
          : `<text x="${f1(gx)}" y="${f1(gy + 0.5)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_G}" font-size="${bi ? 15 : 17}" fill="${isB ? P.planetB : P.planet}">${g}</text>`;
        out += `<g class="w-hover ${anim ? 'w-planet' : ''}" style="animation-delay:${(0.35 + i * 0.05).toFixed(2)}s" data-tip="${escA(tip)}" data-pid="${p.id}" data-side="${isB ? 'b' : 'a'}" tabindex="0" role="button" aria-label="${escA(tip)}">`;
        out += `<circle class="pbg" cx="${f1(gx)}" cy="${f1(gy)}" r="${bi ? 11.5 : 13.5}" fill="${isB ? P.planetBBg : P.planetBg}" stroke="${isB ? P.planetB : P.planet}" stroke-opacity=".45" stroke-width="1"/>${txt}`;
        if (p.retro) { const rr = bi ? 11.5 : 13.5; out += `<circle cx="${f1(gx + rr * 0.78)}" cy="${f1(gy + rr * 0.78)}" r="5" fill="#c96b8f"/><text x="${f1(gx + rr * 0.78)}" y="${f1(gy + rr * 0.78 + 0.3)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_T}" font-size="6.5" font-weight="800" fill="#fff">R</text>`; }
        if (degR) { const [dx, dy] = xy(degR, it.ang); out += `<text x="${f1(dx)}" y="${f1(dy)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_T}" font-size="${bi ? 9 : 10}" fill="${P.ink2}">${Math.floor(p.lon % 30)}°<tspan font-size="${bi ? 7 : 8}">${String(Math.floor((p.lon % 1) * 60)).padStart(2, '0')}′</tspan></text>`; }
        out += '</g>';
      });
      return out;
    }
    s += drawPlanets(pointsA.filter((p) => p.id !== 'fortune' || opts.fortune !== false), R.planet, R.deg, false, R.bandIn);
    if (bi) s += drawPlanets(opts.outer.points.filter((p) => !['fortune', 'lilith'].includes(p.id)), R.outerPlanet, null, true, R.bandOut);
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
