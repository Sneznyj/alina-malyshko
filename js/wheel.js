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
  function svg(chart, opts) {
    opts = opts || {};
    const P = PAL[opts.theme || theme()];
    const bi = !!opts.outer;
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
    s += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 648 648" role="img" aria-label="Карта ${chart.params && chart.params.name ? chart.params.name : ''}">`;
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
        s += `<text x="${f1(hx)}" y="${f1(hy)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_T}" font-size="11" font-weight="600" fill="${P.ink2}" opacity=".8">${ROMAN[i]}</text>`;
      }
      if (!bi) {
        const lbl = [['ASC', cu[0]], ['IC', cu[3]], ['DSC', cu[6]], ['MC', cu[9]]];
        for (const [t, lon] of lbl) {
          const [x, y] = xy(R.bandOut + 22, ang(lon));
          s += `<text x="${f1(x)}" y="${f1(y)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_T}" font-size="12" font-weight="700" fill="${P.gold}">${t}</text>`;
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
    s += '<g>';
    for (const x of aspList) {
      const la = lonOf['a:' + x.a], lb = bi ? lonOf['b:' + x.b] : lonOf['a:' + x.b];
      if (la == null || lb == null) continue;
      if (['fortune'].includes(x.a) || ['fortune'].includes(x.b)) continue;
      const [x1, y1] = xy(R.asp, ang(la)), [x2, y2] = xy(R.asp, ang(lb));
      if (x.type === 'conj') continue;
      const op = 0.3 + 0.65 * (x.strength != null ? x.strength : 0.6);
      s += `<line class="${anim ? 'w-asp' : ''}" style="animation-delay:${(0.9 + k * 0.03).toFixed(2)}s" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${P.asp[x.type] || P.line2}" stroke-width="${x.nature === 'hard' || x.type === 'opp' ? 1.4 : 1.2}" stroke-opacity="${op.toFixed(2)}"${MINOR.includes(x.type) ? ' stroke-dasharray="4 3"' : ''} data-asp="${x.a}|${x.b}|${x.type}"/>`;
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
        out += `<g class="w-hover ${anim ? 'w-planet' : ''}" style="animation-delay:${(0.35 + i * 0.05).toFixed(2)}s" data-tip="${tip}" tabindex="0">`;
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

  function attach(box) {
    let tip = box.querySelector('.wheel-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'wheel-tip'; box.appendChild(tip); }
    const show = (g) => {
      const r = box.getBoundingClientRect(), gr = g.getBoundingClientRect();
      tip.textContent = g.dataset.tip;
      tip.style.left = (gr.left + gr.width / 2 - r.left) + 'px';
      tip.style.top = (gr.top - r.top) + 'px';
      tip.classList.add('show');
    };
    box.addEventListener('mouseover', (e) => { const g = e.target.closest('[data-tip]'); if (g) show(g); });
    box.addEventListener('mouseout', (e) => { if (e.target.closest('[data-tip]')) tip.classList.remove('show'); });
    box.addEventListener('focusin', (e) => { const g = e.target.closest('[data-tip]'); if (g) show(g); });
    box.addEventListener('focusout', () => tip.classList.remove('show'));
    box.addEventListener('click', (e) => { const g = e.target.closest('[data-tip]'); if (g) show(g); else tip.classList.remove('show'); });
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

  window.Wheel = { svg, attach, exportPNG, PAL };
})();
