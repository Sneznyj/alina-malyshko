/* Профи-инструменты на страницах: натальная карта (вкладка «Профи»), прогноз (дирекции, лунар, фирдарии, динамика),
   небо (эфемериды), лунный календарь (планетные часы), карта момента (хорар). Расчёты — js/pro.js (бесплатно всем);
   толкования к ним — премиум-модуль _private/pro-texts.js (window.ProTexts): Алине и клиентам с кодом доступа.
   Вызовы: ProView.natal(блок, карта, параметры) · ProView.forecast(блок, карта, параметры) · ProView.ephemeris(блок)
   · ProView.hours(блок, город) · ProView.horaryCard(карта, город). */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI, P = window.ProAstro;
  const { esc, fmt, icon } = UI;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const gl = (id) => `<span class="glyph pv-g">${id === 'southNode' ? '☋' : T.planets[id] ? T.planets[id].glyph : ''}</span>`;
  const pn = (id) => (id === 'southNode' ? 'Южный узел' : id === 'node' ? 'Северный узел' : T.planets[id] ? T.planets[id].name : id);
  const sg = (si) => `<span class="glyph" style="color:var(--gold)">${T.signs[typeof si === 'number' ? AC.SIGNS[si] : si].glyph}</span>`;
  const pos = (lon) => `${AC.fmtDeg(lon)} ${sg(AC.signIndex(lon))}`;
  const ASP_W = { conj: 'соединение', sextile: 'секстиль', square: 'квадрат', trine: 'трин', opp: 'оппозиция' };
  const aspG = (t) => `<span class="glyph" style="color:${T.aspects[t].color}">${T.aspects[t].glyph}</span>`;
  const month = (d) => `${fmt.MONTHS[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
  const PT = () => window.ProTexts || null;
  const premiumChip = () => (window.Premium && window.Premium.chip ? window.Premium.chip() : '');

  /** Есть ли доступ к толкованиям: подгружаем премиум-модуль один раз. */
  let textsP = null;
  function loadTexts() {
    if (window.ProTexts) return Promise.resolve(true);
    if (!window.Premium || !window.Premium.ensure) return Promise.resolve(false);
    return textsP || (textsP = window.Premium.ensure(['pro-texts']).then((ok) => !!(ok && window.ProTexts)).catch(() => false));
  }
  /** Блок толкования: с доступом — текст, без доступа — закрытая карточка с названием. */
  function interp(title, text) {
    if (text) return `<div class="pv-interp"><b>${esc(title)}</b><p>${text}</p></div>`;
    return window.Premium && window.Premium.locked ? window.Premium.locked(esc(title), { lines: 2, meta: 'премиум' }) : '';
  }
  const lockNote = () => (PT() ? '' : `<p class="tiny muted pv-note">${icon('crown')} Расчёты открыты всем. Толкования к ним — в <a href="premium.html">премиум-доступе</a>.</p>`);

  // ---------- инструменты натальной карты ----------
  const DIG = { domicile: ['обитель', '+5'], exaltation: ['экзальтация', '+4'], triplicity: ['трипличность', '+3'], term: ['терм', '+2'], face: ['фас', '+1'], detriment: ['изгнание', '−5'], fall: ['падение', '−4'] };
  function dignitiesHTML(c) {
    const rows = P.dignities(c);
    const rec = P.receptions(c);
    const t = PT();
    return `<p class="small muted">Эссенциальные достоинства по Птолемею (баллы по Лилли): насколько планете «удобно» в знаке. Управители — традиционные (без высших планет), трипличности — по Доротею${c.houses ? `, карта ${c.houses.dayChart ? 'дневная' : 'ночная'}` : ' (время неизвестно — берём дневных управителей)'}.</p>
      <div class="table-wrap"><table class="table pv-dig"><thead><tr><th>Планета</th><th>Положение</th><th>Управитель</th><th>Экзальт.</th><th>Трипл.</th><th>Терм</th><th>Фас</th><th>Достоинства</th><th>Балл</th></tr></thead><tbody>
      ${rows.map((d) => `<tr><td>${gl(d.id)} ${pn(d.id)}${d.retro ? ' <span class="retro-mark">R</span>' : ''}</td><td>${pos(d.lon)}</td><td>${gl(d.ruler)}</td><td>${d.exaltation ? gl(d.exaltation) : '—'}</td><td>${gl(d.triplicity)}</td><td>${gl(d.term)}</td><td>${gl(d.face)}</td>
        <td class="wrap">${d.has.map((h) => `<span class="badge ${DIG[h][1][0] === '+' ? 'ok' : 'warn'}">${DIG[h][0]} ${DIG[h][1]}</span>`).join(' ')}${d.peregrine ? '<span class="badge warn">перегрин −5</span>' : ''}</td>
        <td><b class="${d.score > 0 ? 'pv-plus' : d.score < 0 ? 'pv-minus' : ''}">${d.score > 0 ? '+' : ''}${d.score}</b></td></tr>`).join('')}</tbody></table></div>
      ${rec.length ? `<p class="small" style="margin-top:12px"><b>Взаимные рецепции:</b> ${rec.map((r) => `${gl(r.a)} ${pn(r.a)} ↔ ${gl(r.b)} ${pn(r.b)} (${r.kind === 'domicile' ? 'по обителям' : 'по экзальтациям'})`).join('; ')} — планеты «гостят» друг у друга и помогают друг другу.</p>` : ''}
      ${t ? `<div class="pv-interps">${rows.filter((d) => d.score >= 5 || d.score <= -5).map((d) => interp(`${pn(d.id)}: ${d.score > 0 ? 'сильная планета' : 'планете непросто'}`, t.dignity(d))).join('')}</div>` : lockNote()}`;
  }
  function dispositorsHTML(c) {
    const ds = P.dispositors(c), t = PT();
    const chain = (path) => path.map((id, i) => `${i ? '<span class="pv-arr">→</span>' : ''}<span class="pv-ch">${gl(id)}${pn(id)}</span>`).join('');
    return `<p class="small muted">Цепочки управителей: планета → управитель знака, где она стоит → его управитель… Где цепочки сходятся — там «главная» планета карты.</p>
      <div class="pv-chains">${ds.chains.map((p) => `<div>${chain(p)}</div>`).join('')}</div>
      <div class="grid grid-2" style="margin-top:14px">
        <div class="card pv-mini"><span class="eyebrow">Конечный диспозитор</span><h4>${ds.final ? `${gl(ds.final)} ${pn(ds.final)}` : 'нет'}</h4><p class="small muted">${ds.final ? 'Все цепочки сходятся к этой планете — она задаёт общий тон.' : ds.loops.length ? 'Цепочки замыкаются в петлю — несколько равноправных центров.' : 'Несколько планет в своих обителях — у карты несколько опор.'}</p></div>
        <div class="card pv-mini"><span class="eyebrow">В своей обители</span><h4>${ds.self.length ? ds.self.map((id) => `${gl(id)} ${pn(id)}`).join(', ') : '—'}</h4>${ds.loops.length ? `<p class="small muted">Петли: ${ds.loops.map((l) => l.map(pn).join(' ↔ ')).join('; ')}</p>` : ''}</div>
      </div>
      ${t ? interp(ds.final ? `Конечный диспозитор — ${pn(ds.final)}` : 'Несколько центров карты', t.dispositor(ds)) : lockNote()}`;
  }
  const PAT = { grandTrine: ['Большой трин', '△'], tSquare: ['Тау-квадрат', '⊤'], grandCross: ['Большой крест', '✚'], yod: ['Йод («перст судьбы»)', 'Y'], kite: ['Воздушный змей', '◇'], mysticRectangle: ['Мистический прямоугольник', '▭'], stellium: ['Стеллиум', '✦'] };
  const JONES = { bundle: 'Связка', bowl: 'Чаша', bucket: 'Ведро', locomotive: 'Локомотив', seesaw: 'Качели', splay: 'Веер', splash: 'Брызги' };
  const JONES_ABOUT = { bundle: 'все планеты в трети круга', bowl: 'все планеты в половине круга', bucket: 'чаша и одна планета-«ручка» напротив', locomotive: 'планеты в двух третях круга, пустая треть', seesaw: 'две группы планет друг напротив друга', splay: 'несколько неравных групп', splash: 'планеты рассыпаны по всему кругу' };
  function patternsHTML(c) {
    const ps = P.patterns(c), js = P.jonesShape(c), hs = P.houseStrength(c), t = PT();
    return `<div class="grid grid-2">
        <div class="card pv-mini"><span class="eyebrow">Форма карты · по М. Джонсу</span><h4>${JONES[js.shape]}</h4><p class="small muted">${JONES_ABOUT[js.shape]}${js.handle ? ` · ручка — ${gl(js.handle)} ${pn(js.handle)}` : ''}${js.leader ? ` · ведущая планета — ${gl(js.leader)} ${pn(js.leader)}` : ''}</p></div>
        ${hs ? `<div class="card pv-mini"><span class="eyebrow">Сила домов</span><h4>сильные: ${hs.strong.map((h) => ROMAN[h - 1]).join(', ')}</h4><p class="small muted">слабее всего: ${hs.weak.map((h) => ROMAN[h - 1]).join(', ')} · по планетам в доме, силе управителя и угловым домам</p></div>` : '<div class="card pv-mini"><span class="eyebrow">Сила домов</span><p class="small muted">Нужно время рождения.</p></div>'}
      </div>
      <h4 style="margin-top:18px">Фигуры аспектов</h4>
      ${ps.length ? `<div class="pv-pats">${ps.map((p) => `<div class="pv-pat"><span class="pv-pat-i">${PAT[p.type][1]}</span><div><b>${PAT[p.type][0]}</b>${p.element ? ` <span class="badge">${T.elements[p.element].name}</span>` : ''}${p.where ? ` <span class="badge">${p.kind === 'sign' ? T.signs[p.where].loc : ROMAN[p.where - 1] + ' дом'}</span>` : ''}<div class="small">${p.planets.map((id) => `${gl(id)} ${pn(id)}${p.apex === id ? ' <small class="muted">(вершина)</small>' : ''}`).join(' · ')}</div>${t ? `<p class="small pv-pat-t">${t.pattern(p, c)}</p>` : ''}</div></div>`).join('')}</div>` : '<p class="small muted">Больших фигур нет — карта без жёстких «конструкций»: энергия распределена свободнее.</p>'}
      ${hs ? `<details class="details-adv" style="margin-top:14px"><summary>Все дома по силе</summary><div class="table-wrap"><table class="table"><thead><tr><th>Дом</th><th>Куспид</th><th>Управитель</th><th>Планеты</th><th>Сила</th></tr></thead><tbody>${hs.list.map((h) => `<tr><td><b>${ROMAN[h.house - 1]}</b> · ${esc(T.houses[h.house].title)}</td><td>${sg(h.sign)} ${esc(T.signs[h.sign].name)}</td><td>${gl(h.ruler)}${h.rulerHouse ? ' в ' + ROMAN[h.rulerHouse - 1] : ''}</td><td>${h.planets.map(gl).join('') || '—'}</td><td><span class="pv-bar"><i style="width:${Math.max(4, Math.min(100, h.score * 9))}%"></i></span> ${h.score}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
      ${t ? interp(`Форма «${JONES[js.shape]}»`, t.jones(js, c)) + (hs ? interp('Сильные и слабые дома', t.houses(hs, c)) : '') : lockNote()}`;
  }
  function midpointsHTML(c) {
    const mp = P.midpoints(c), t = PT();
    const angW = { 0: 'на мидпоинте', 90: 'квадрат', 180: 'напротив' };
    return `<p class="small muted">Мидпоинты (Гамбургская школа, Эбертин): середина между двумя планетами — чувствительная точка. «Планетарная картинка» A = B/C: планета стоит на мидпоинте (или в квадрате/оппозиции к нему, орбис 1,5°).</p>
      ${mp.pictures.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Картинка</th><th>Как</th><th>Орбис</th>${t ? '<th>Смысл</th>' : ''}</tr></thead><tbody>${mp.pictures.slice(0, 24).map((x) => `<tr><td>${gl(x.planet)} = ${gl(x.a)}/${gl(x.b)} <span class="small muted">${pn(x.planet)} = ${pn(x.a)}/${pn(x.b)}</span></td><td class="small">${angW[x.angle]}</td><td>${x.orb.toFixed(2)}°</td>${t ? `<td class="wrap small">${t.midpoint(x)}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<p class="small muted">Точных картинок нет.</p>'}
      <details class="details-adv" style="margin-top:12px"><summary>Все мидпоинты (${mp.list.length})</summary><div class="pv-mlist">${mp.list.map((m) => `<span>${gl(m.a)}/${gl(m.b)} <b>${pos(m.lon)}</b></span>`).join('')}</div></details>
      ${t ? '' : lockNote()}`;
  }
  function starsHTML(c) {
    const fs = P.fixedStars(c), t = PT();
    return `<p class="small muted">Соединения планет и углов карты с яркими неподвижными звёздами (орбис 1,5° для светил и углов, 1° для планет). Положения звёзд — с учётом прецессии на год рождения.</p>
      ${fs.length ? `<div class="pv-stars">${fs.map((s) => `<div class="pv-star"><span class="pv-star-i">✦</span><div><b>${esc(s.name)}</b> ${gl(s.planet)} ${pn(s.planet)} <span class="small muted">· звезда ${pos(s.starLon)} · орбис ${s.orb.toFixed(2)}°</span>${t ? `<p class="small" style="margin:4px 0 0">${t.star(s.star, s.planet)}</p>` : ''}</div></div>`).join('')}</div>` : '<p class="small muted">Тесных соединений с главными звёздами нет.</p>'}
      ${t ? '' : lockNote()}`;
  }
  function firdariaHTML(c) {
    const fd = P.firdaria(c), t = PT(), now = new Date();
    const cur = fd.periods.find((x) => x.current);
    const sub = cur && cur.subs.find((s) => s.current);
    return `<p class="small muted">Фирдарии — персидская система периодов жизни: каждой планете — свои годы (${fd.day === false ? 'ночная карта: начинает Луна' : 'дневная карта: начинает Солнце'}${fd.unknownTime ? ' — время рождения неизвестно, считаем как дневную' : ''}), внутри — 7 подпериодов.</p>
      ${cur ? `<div class="card pv-now"><span class="eyebrow">Сейчас</span><h4>${gl(cur.id)} Период ${pn(cur.id)}${sub ? ` · подпериод ${gl(sub.id)} ${pn(sub.id)}` : ''}</h4><p class="small muted">${fmt.date(cur.start)} — ${fmt.date(cur.end)}${sub ? ` · подпериод до ${fmt.date(sub.end)}` : ''}</p>${t ? `<p class="small">${t.firdaria(cur.id, sub && sub.id, c)}</p>` : ''}</div>` : ''}
      <div class="pv-fird">${fd.periods.filter((p) => p.end > new Date(now.getFullYear() - 30, 0, 1) && p.start < new Date(now.getFullYear() + 40, 0, 1)).map((p) => `<details class="pv-fp${p.current ? ' cur' : ''}"${p.current ? ' open' : ''}><summary>${gl(p.id)} <b>${pn(p.id)}</b> <span class="small muted">${p.start.getFullYear()}–${p.end.getFullYear()} · ${p.years} ${fmt.plural(p.years, 'год', 'года', 'лет')}</span></summary>${p.subs.length ? `<div class="pv-subs">${p.subs.map((s) => `<span class="${s.current ? 'cur' : ''}">${gl(s.id)} ${fmt.dateShort(s.start)} ${s.start.getFullYear()}</span>`).join('')}</div>` : '<p class="small muted" style="margin:6px 0 0">Узловой период без подпериодов.</p>'}</details>`).join('')}</div>
      ${t ? '' : lockNote()}`;
  }
  function timeHTML(c, params) {
    if (!c.timeKnown) return '<p class="muted">Время рождения не указано — проверять нечего. Если оно примерное («утром», «около 3 ночи»), укажите его — и здесь будет видно, как меняется Асцендент.</p>';
    const tw = P.timeWindow(params, 120, window.ChartView ? window.ChartView.chartOpts() : {});
    const base = tw.base;
    const tz = params.zone;
    const tm = (d) => { try { return new Intl.DateTimeFormat('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d); } catch (e) { return fmt.time(d); } };
    const WHAT = { asc: 'Асцендент', mc: 'MC', moon: 'Луна' };
    const show = tw.rows.filter((r, i) => i % 3 === 0);
    return `<p class="small muted">Если время рождения примерное: как меняются Асцендент, MC и Луна, если сдвинуть время на 2 часа в обе стороны. Помогает понять, насколько важна точность и с чего начинать ректификацию.</p>
      ${tw.changes.length ? `<div class="pv-changes">${tw.changes.map((ch) => `<div class="pv-change"><b>${tm(ch.date)}</b> ${WHAT[ch.what]}: ${sg(ch.from)} ${esc(T.signs[ch.from].name)} → ${sg(ch.to)} ${esc(T.signs[ch.to].name)} <span class="small muted">(${ch.min > 0 ? '+' : '−'}${Math.abs(ch.min)} мин)</span></div>`).join('')}</div>` : `<p class="small"><b>В окне ±2 часа знаки Асцендента, MC и Луны не меняются</b> — для них хватает и примерного времени. Градус Асцендента и куспиды домов всё равно сдвигаются.</p>`}
      <div class="table-wrap" style="margin-top:12px"><table class="table pv-tw"><thead><tr><th>Время</th><th>Асцендент</th><th>MC</th><th>Луна</th></tr></thead><tbody>${show.map((r) => `<tr class="${r.min === 0 ? 'cur' : ''}"><td><b>${tm(r.date)}</b> <small class="muted">${r.min === 0 ? 'указано' : (r.min > 0 ? '+' : '−') + Math.abs(r.min) + ' мин'}</small></td><td>${pos(r.asc)}</td><td>${pos(r.mc)}</td><td>${pos(r.moon)}</td></tr>`).join('')}</tbody></table></div>
      <p class="tiny muted" style="margin-top:8px">Указанное время: ${tm(base.date)} (${esc(tz)}).</p>`;
  }
  function relocHTML(c, params) {
    return `<p class="small muted">Релокация — та же карта рождения, но для другого города: планеты те же, меняются дома и углы. Так смотрят, где человеку жить, работать, отдыхать. Ниже — города, где планеты рождения встают на углы карты (линии астрокартографии ASC, DSC, MC, IC).</p>
      <div id="pvRelocCity" style="max-width:360px"></div><div id="pvReloc" style="margin-top:12px"></div>
      <h4 style="margin-top:18px">Линии планет у городов <small class="muted">— из списка сайта, орбис 3°</small></h4><div id="pvAcg" class="pv-acg"><p class="small muted">Считаю…</p></div>`;
  }
  function relocBind(box, c, params) {
    if (!c.timeKnown) { box.innerHTML = '<p class="muted">Для релокации нужно время рождения.</p>'; return; }
    const draw = (place) => {
      const rc = P.relocate(c, place, window.ChartView ? window.ChartView.chartOpts() : {});
      const el = box.querySelector('#pvReloc');
      const ang = (id) => (rc.byId[id] ? `${sg(rc.byId[id].signIndex)} ${esc(T.signs[rc.byId[id].sign].name)} ${AC.fmtDeg(rc.byId[id].lon)}` : '—');
      const moved = AC.PLANETS.filter((id) => c.byId[id].house && rc.byId[id].house !== c.byId[id].house);
      el.innerHTML = `<div class="grid grid-2"><div class="card pv-mini"><span class="eyebrow">${esc(place.name)}</span><p class="small" style="margin:6px 0 0">Асцендент: <b>${ang('asc')}</b><br>MC: <b>${ang('mc')}</b></p></div>
        <div class="card pv-mini"><span class="eyebrow">Планеты меняют дома</span><p class="small" style="margin:6px 0 0">${moved.length ? moved.map((id) => `${gl(id)} ${ROMAN[c.byId[id].house - 1]} → <b>${ROMAN[rc.byId[id].house - 1]}</b>`).join(' · ') : 'Дома почти те же, что в карте рождения.'}</p></div></div>
        <div class="wheel-box" id="pvRelocWheel" style="max-width:420px;margin-top:12px">${window.Wheel.svg(rc, { animate: false, mode: 'natal' })}</div>`;
      window.Wheel.attach(el.querySelector('#pvRelocWheel'));
    };
    UI.cityField(box.querySelector('#pvRelocCity'), { label: 'Город для релокации', value: null, placeholder: 'Начните вводить город', onPick: draw });
    setTimeout(() => {
      const list = P.angularCities(c, UI.CITIES, 3);
      const byPlanet = {};
      for (const x of list) (byPlanet[x.planet] = byPlanet[x.planet] || []).push(x);
      const A = { asc: 'ASC — восходит', dsc: 'DSC — заходит', mc: 'MC — в зените', ic: 'IC — в надире' };
      box.querySelector('#pvAcg').innerHTML = Object.keys(byPlanet).length ? AC.PLANETS.filter((id) => byPlanet[id]).map((id) => `<div class="pv-acg-row">${gl(id)} <b>${pn(id)}</b> <span class="small">${byPlanet[id].slice(0, 6).map((x) => `${esc(x.city.name)} <small class="muted">${A[x.angle].split(' —')[0]}</small>`).join(' · ')}</span></div>`).join('') : '<p class="small muted">В городах из списка сайта планеты не встают точно на углы — проверьте нужный город выше.</p>';
    }, 30);
  }

  /** Вкладка «Профи» натальной карты. tools — какие показать (по умолчанию все). */
  const NATAL_TOOLS = [['dig', 'Достоинства'], ['disp', 'Диспозиторы'], ['pat', 'Фигуры и дома'], ['mid', 'Мидпоинты'], ['stars', 'Звёзды'], ['fird', 'Фирдарии'], ['time', 'Время рождения'], ['reloc', 'Релокация']];
  function natal(box, c, params, opts) {
    opts = opts || {};
    const tools = NATAL_TOOLS.filter(([k]) => !opts.only || opts.only.includes(k));
    let cur = opts.start || tools[0][0];
    box.innerHTML = `<div class="pv"><div class="row between pv-top"><div class="seg pv-seg" role="group" aria-label="Профи-инструменты">${tools.map(([k, t]) => `<button type="button" data-pv="${k}" aria-pressed="${k === cur}">${t}</button>`).join('')}</div>${premiumChip()}</div><div class="pv-panel"></div></div>`;
    const panel = box.querySelector('.pv-panel');
    const render = () => {
      const html = { dig: dignitiesHTML, disp: dispositorsHTML, pat: patternsHTML, mid: midpointsHTML, stars: starsHTML, fird: firdariaHTML, time: (x) => timeHTML(x, params), reloc: (x) => relocHTML(x, params) }[cur](c);
      panel.innerHTML = html;
      if (cur === 'reloc') relocBind(panel, c, params);
      UI.fadeIn(panel, 4);
    };
    box.querySelector('.pv-seg').addEventListener('click', (e) => { const b = e.target.closest('[data-pv]'); if (!b) return; cur = b.dataset.pv; box.querySelectorAll('[data-pv]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); });
    render();
    loadTexts().then((ok) => { if (ok && box.isConnected) render(); });
  }

  // ---------- прогностика ----------
  function directionsHTML(c) {
    const now = new Date();
    const from = new Date(now.getFullYear() - 1, now.getMonth(), 1), to = new Date(now.getFullYear() + 5, 11, 31);
    const sa = P.solarArc(c, from, to, now);
    const t = PT();
    const near = sa.events.filter((e) => Math.abs(e.date - now) < 365 * 86400000);
    return `<p class="small muted">Дирекции солнечной дуги: все точки карты сдвигаются на дугу прогрессивного Солнца (≈ 1° в год). Когда направленная планета образует точный аспект к натальной — это веха года. Сейчас дуга ${sa.arcNow.toFixed(2)}°. Орбис действия — около года до и после даты.</p>
      ${sa.events.length ? `<div class="pv-dirs">${sa.events.map((e) => `<div class="pv-dir${Math.abs(e.date - now) < 365 * 86400000 ? ' now' : ''}${e.date < now ? ' past' : ''}"><div class="pv-dir-d"><b>${fmt.MONTHS_SHORT[e.date.getMonth()]} ${e.date.getFullYear()}</b></div><div>${gl(e.directed)} дир. ${pn(e.directed)} ${aspG(e.type)} ${gl(e.natal)} натал. ${pn(e.natal)} <span class="badge">${ASP_W[e.type]}</span>${t ? `<p class="small" style="margin:4px 0 0">${t.direction(e, c)}</p>` : ''}</div></div>`).join('')}</div>` : '<p class="small muted">В ближайшие годы точных дирекций нет.</p>'}
      ${!t && near.length ? interp(`Что значат ${near.length} ${fmt.plural(near.length, 'дирекция', 'дирекции', 'дирекций')} этого года`, '') : ''}${t ? '' : lockNote()}`;
  }
  function lunarHTML(c, place) {
    const lr = P.lunarReturn(c, new Date(Date.now() - 2 * 86400000), place, window.ChartView ? window.ChartView.chartOpts() : {});
    const t = PT();
    const asc = lr.byId.asc, moon = lr.byId.moon;
    return `<p class="small muted">Лунар — карта на момент, когда Луна возвращается в натальную точку (раз в ~27,3 дня). Описывает эмоциональный фон и темы ближайшего месяца.</p>
      <div class="grid grid-2" style="align-items:start"><div class="wheel-box" id="pvLunarWheel" style="max-width:420px">${window.Wheel.svg(lr, { animate: false, mode: 'solar' })}</div>
      <div><div class="card pv-mini"><span class="eyebrow">Лунар</span><h4>${fmt.dateTime(lr.returnDate)}</h4><p class="small muted">${esc(place ? place.name : (c.params.place || 'место рождения'))} · до следующего ≈ ${fmt.date(new Date(lr.returnDate.getTime() + 27.32 * 86400000))}</p></div>
        <p class="small" style="margin:12px 0 4px">Асцендент месяца: <b>${sg(asc.signIndex)} ${esc(T.signs[asc.sign].name)}</b></p>
        <p class="small" style="margin:0 0 4px">Луна в ${ROMAN[moon.house - 1]} доме — <b>${esc(T.houses[moon.house].title.toLowerCase())}</b></p>
        <p class="small" style="margin:0">Солнце месяца в ${ROMAN[lr.byId.sun.house - 1]} доме — ${esc(T.houses[lr.byId.sun.house].topic)}</p>
        ${t ? `<div class="pv-interps">${t.lunar(lr, c)}</div>` : interp('Темы месяца по лунару', '')}</div></div>${t ? '' : lockNote()}`;
  }
  function dynamicsHTML(c) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const dy = P.dynamics(c, start, 52);
    const max = Math.max(1, ...dy.series.map((w) => Math.max(w.hard, w.soft)));
    const W = 720, H = 180, bw = W / dy.series.length;
    const bars = dy.series.map((w, i) => { const hs = (w.soft / max) * (H / 2 - 8), hh = (w.hard / max) * (H / 2 - 8); return `<rect x="${(i * bw + 1).toFixed(1)}" y="${(H / 2 - hs).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${hs.toFixed(1)}" rx="2" fill="var(--soft-asp)"><title>${fmt.dm(w.start)}: поддержка ${w.soft.toFixed(1)}</title></rect><rect x="${(i * bw + 1).toFixed(1)}" y="${H / 2}" width="${(bw - 2).toFixed(1)}" height="${hh.toFixed(1)}" rx="2" fill="var(--hard-asp)"><title>${fmt.dm(w.start)}: напряжение ${w.hard.toFixed(1)}</title></rect>`; }).join('');
    const months = dy.series.map((w, i) => (i === 0 || w.start.getDate() <= 7) ? `<text x="${(i * bw + 2).toFixed(1)}" y="${H + 14}" font-size="10" fill="var(--ink-3)">${fmt.MONTHS_SHORT[w.start.getMonth()]}</text>` : '').join('');
    const peaks = dy.series.map((w, i) => ({ w, i })).sort((a, b) => b.w.hard - a.w.hard).slice(0, 3).filter((x) => x.w.hard > 0);
    const best = dy.series.map((w, i) => ({ w, i })).sort((a, b) => (b.w.soft - b.w.hard) - (a.w.soft - a.w.hard)).slice(0, 3);
    return `<p class="small muted">Динамика (как в Sotis): насколько активны медленные транзиты (Марс — Плутон) к карте неделя за неделей на год вперёд. Вверх — гармоничные (поддержка), вниз — напряжённые (вызовы).</p>
      <div class="pv-dyn"><svg viewBox="0 -4 ${W} ${H + 22}" role="img" aria-label="Динамика транзитов на год"><line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="var(--line-2)"/>${bars}${months}</svg></div>
      <div class="grid grid-2" style="margin-top:12px"><div class="card pv-mini"><span class="eyebrow">Самые напряжённые недели</span><p class="small" style="margin:6px 0 0">${peaks.map((x) => `с ${fmt.dm(x.w.start)}`).join(' · ') || '—'}</p></div><div class="card pv-mini"><span class="eyebrow">Самые лёгкие недели</span><p class="small" style="margin:6px 0 0">${best.map((x) => `с ${fmt.dm(x.w.start)}`).join(' · ')}</p></div></div>`;
  }
  const FORECAST_TOOLS = [['dir', 'Дирекции'], ['lunar', 'Лунар'], ['fird', 'Фирдарии'], ['dyn', 'Динамика']];
  function forecast(box, c, params, opts) {
    opts = opts || {};
    let cur = opts.start || 'dir', place = null;
    box.innerHTML = `<div class="pv"><div class="row between pv-top"><div class="seg pv-seg" role="group" aria-label="Методы прогноза">${FORECAST_TOOLS.map(([k, t]) => `<button type="button" data-pv="${k}" aria-pressed="${k === cur}">${t}</button>`).join('')}</div>${premiumChip()}</div><div class="pv-panel"></div></div>`;
    const panel = box.querySelector('.pv-panel');
    const render = () => {
      if (cur === 'lunar' && !c.timeKnown) { panel.innerHTML = '<p class="muted">Для лунара нужно время рождения.</p>'; return; }
      panel.innerHTML = cur === 'dir' ? directionsHTML(c) : cur === 'lunar' ? `<div id="pvLunarCity" style="max-width:360px;margin-bottom:10px"></div><div id="pvLunarBody">${lunarHTML(c, place)}</div>` : cur === 'fird' ? firdariaHTML(c) : dynamicsHTML(c);
      if (cur === 'lunar') {
        window.Wheel.attach(panel.querySelector('#pvLunarWheel'));
        UI.cityField(panel.querySelector('#pvLunarCity'), { label: 'Где человек сейчас (для домов лунара)', value: place, placeholder: 'Пусто — город рождения', onPick: (p) => { place = p; render(); } });
      }
      UI.fadeIn(panel, 4);
    };
    box.querySelector('.pv-seg').addEventListener('click', (e) => { const b = e.target.closest('[data-pv]'); if (!b) return; cur = b.dataset.pv; box.querySelectorAll('[data-pv]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); });
    render();
    loadTexts().then((ok) => { if (ok && box.isConnected) render(); });
  }

  // ---------- хорар (карта момента) ----------
  const STRICT = { ascEarly: 'Асцендент в первых 3° знака — вопрос, возможно, задан рано, ситуация ещё не созрела', ascLate: 'Асцендент в последних 3° знака — вопрос поздний, многое уже решено', saturnAngle1: 'Сатурн в I доме — препятствия со стороны спрашивающего', saturnAngle7: 'Сатурн в VII доме — астрологу стоит быть особенно осторожным в суждении', viaCombusta: 'Луна в «сожжённом пути» (15° Весов — 15° Скорпиона) — ситуация неустойчива', moonLate: 'Луна в последних градусах знака — ситуация меняется' };
  function horaryCard(c, place) {
    let hrs = null;
    try { hrs = place ? P.planetaryHours(c.date, place.lat, place.lon, place.tz || place.zone) : null; } catch (e) { hrs = null; }
    const h = P.horary(c, hrs);
    const t = PT();
    const tz = (place && (place.tz || place.zone)) || undefined;
    const tm = (d) => { try { return new Intl.DateTimeFormat('ru-RU', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d); } catch (e) { return fmt.dmTime(d); } };
    return `<div class="card pv-horary"><div class="row between"><h3 style="margin:0">${icon('message-question')} Хорар: показатели момента</h3>${premiumChip()}</div>
      <div class="grid grid-3" style="margin-top:12px">
        <div class="pv-mini card"><span class="eyebrow">Луна</span><h4>${sg(h.moonSign)} ${esc(T.signs[h.moonSign].loc)}</h4><p class="small muted">${h.voc ? `<b style="color:var(--bad)">без курса</b> до ${tm(h.leave)}` : `в курсе · ближайший аспект: ${aspG(h.next.type)} ${gl(h.next.id)} ${pn(h.next.id)} в ${tm(h.next.date)}`}</p></div>
        <div class="pv-mini card"><span class="eyebrow">Последний аспект Луны</span><h4>${h.last ? `${aspG(h.last.type)} ${gl(h.last.id)} ${pn(h.last.id)}` : '—'}</h4><p class="small muted">${h.last ? tm(h.last.date) + ' — что уже произошло' : 'в этом знаке аспектов ещё не было'}</p></div>
        <div class="pv-mini card"><span class="eyebrow">Управитель дня и часа</span><h4>${hrs ? `${gl(hrs.dayRuler)} ${pn(hrs.dayRuler)} · ${hrs.current ? gl(hrs.current.ruler) + ' ' + pn(hrs.current.ruler) : '—'}` : '—'}</h4><p class="small muted">${h.radical ? (h.radical.ok ? 'управитель часа созвучен Асценденту — карта «радикальна»' : 'управитель часа не созвучен Асценденту') : 'нужен город'}</p></div>
      </div>
      ${h.final && !h.voc ? `<p class="small" style="margin:12px 0 0">Луна без курса начнётся после ${aspG(h.final.type)} ${pn(h.final.id)} — ${tm(h.final.date)}, до смены знака в ${tm(h.leave)}.</p>` : ''}
      ${h.strictures.length ? `<div class="notice" style="margin-top:12px">${icon('info')}<span><b>Предупреждения (Лилли):</b> ${h.strictures.map((s) => esc(STRICT[s])).join('; ')}.</span></div>` : '<p class="small muted" style="margin:12px 0 0">Классических предупреждений нет — карта пригодна для суждения.</p>'}
      <p class="tiny muted" style="margin:10px 0 0">Аспекты Луны — к семи классическим планетам (как в традиционном хораре и Sotis).</p>
      ${t ? interp('Подсказка к суждению', t.horary(h, c)) : ''}</div>`;
  }

  // ---------- планетные часы ----------
  function hours(box, city) {
    const draw = (place) => {
      const ph = P.planetaryHours(new Date(), place.lat, place.lon, place.tz);
      if (!ph) { box.querySelector('.pv-hours-body').innerHTML = '<p class="muted">В этом городе сейчас полярный день или ночь — планетных часов нет.</p>'; return; }
      const tm = (d) => { try { return new Intl.DateTimeFormat('ru-RU', { timeZone: place.tz, hour: '2-digit', minute: '2-digit' }).format(d); } catch (e) { return fmt.time(d); } };
      box.querySelector('.pv-hours-body').innerHTML = `<p class="small">Сегодня день <b>${gl(ph.dayRuler)} ${pn(ph.dayRuler)}</b> · восход ${tm(ph.rise)}, закат ${tm(ph.set)}${ph.current ? ` · сейчас час <b>${gl(ph.current.ruler)} ${pn(ph.current.ruler)}</b> (до ${tm(ph.current.end)})` : ''}</p>
        <div class="pv-hours">${ph.hours.map((h) => `<div class="${h.current ? 'cur' : ''}${h.day ? '' : ' night'}"><small>${tm(h.start)}</small>${gl(h.ruler)}<span>${pn(h.ruler)}</span></div>`).join('')}</div>
        <p class="tiny muted" style="margin:8px 0 0">Сутки — от восхода до восхода; 12 дневных и 12 ночных часов разной длины, халдейский ряд планет. Время — ${esc(place.name)}.</p>`;
    };
    box.innerHTML = `<div class="row between" style="align-items:flex-end;gap:12px"><h3 style="margin:0">${icon('clock-hour-4')} Управители дня и часа</h3><div class="pv-hours-city" style="min-width:220px;max-width:320px;flex:1"></div></div><div class="pv-hours-body" style="margin-top:10px"></div>`;
    UI.cityField(box.querySelector('.pv-hours-city'), { label: 'Город', value: city, onPick: draw });
    draw(city);
  }

  // ---------- эфемериды ----------
  function ephemeris(box) {
    const now = new Date();
    let y = now.getFullYear(), m = now.getMonth() + 1;
    const ids = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'node'];
    const cell = (p) => `${String(Math.floor(p.lon % 30)).padStart(2, '0')}°${String(Math.floor((p.lon % 1) * 60)).padStart(2, '0')}′${T.signs[AC.signOf(p.lon)].glyph}${p.retro ? '<sup class="pv-r">R</sup>' : ''}`;
    const draw = () => {
      const rows = P.ephemeris(y, m);
      box.querySelector('.pv-eph-title').textContent = `${fmt.MONTHS[m - 1]} ${y}`;
      box.querySelector('.pv-eph-body').innerHTML = `<div class="table-wrap pv-eph"><table class="table"><thead><tr><th>День</th>${ids.map((id) => `<th title="${pn(id)}">${gl(id)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr class="${r.d === now.getDate() && m === now.getMonth() + 1 && y === now.getFullYear() ? 'cur' : ''}"><td><b>${r.d}</b> <small class="muted">${fmt.DOW[r.date.getUTCDay()]}</small></td>${r.pts.map((p) => `<td>${cell(p)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    };
    box.innerHTML = `<div class="row between" style="gap:10px"><h3 style="margin:0">${icon('table')} Эфемериды · <span class="pv-eph-title"></span></h3><div class="row" style="gap:6px"><button class="btn btn-ghost btn-xs" type="button" data-eph="-1">${icon('chevron-left')} Месяц</button><button class="btn btn-ghost btn-xs" type="button" data-eph="0">Сейчас</button><button class="btn btn-ghost btn-xs" type="button" data-eph="1">Месяц ${icon('chevron-right')}</button></div></div>
      <p class="small muted" style="margin:6px 0 10px">Положения на 0:00 по Гринвичу (UT) каждого дня, тропический зодиак, истинный узел. R — ретроградное движение.</p><div class="pv-eph-body"></div>`;
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-eph]'); if (!b) return; const k = +b.dataset.eph; if (!k) { y = now.getFullYear(); m = now.getMonth() + 1; } else { m += k; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } } draw(); UI.fadeIn(box.querySelector('.pv-eph-body'), 4); });
    draw();
  }

  window.ProView = { natal, forecast, horaryCard, hours, ephemeris, loadTexts, NATAL_TOOLS, FORECAST_TOOLS };
})();
