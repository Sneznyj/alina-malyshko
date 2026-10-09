/* Карточка человека — общая для астропроцессора на сайте (astro.html, «Мои карты») и кабинета Алины (карточка клиента).
   Вкладки: Натал · Прогноз · Числа · Гороскоп · Совместимость. Расчёты бесплатны; толкования, транзиты по датам, соляр,
   прогрессии, небо на дату и гороскоп на неделю/месяц — в премиуме (закрытые модули natal-pro, synastry-pro,
   numerology-pro, pro-texts и person-pro — js/premium.js; Алине открыто всё).
   Хозяин страницы рисует шапку и полосу вкладок, а тело вкладки берёт отсюда:
     PersonView.body(вкладка, ctx) → разметка · PersonView.after(вкладка, блок, ctx) — оживить · PersonView.handle(событие, ctx) → true, если обработано.
   ctx: { person: { id, name, birth, fullName }, chart, state, save(patch), partners() → [{ key, name, birth }], partner() → { key, name, birth } | null,
          setPartner(key), newPartner(), links: { natal, forecast, numerology, synastry(partnerKey) }, redraw() } */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI, CV = window.ChartView, W = window.Wheel;
  const { esc, fmt, icon } = UI;
  const ROMAN = CV.ROMAN;
  const gl = (id) => `<span class="glyph cc-g">${T.planets[id] ? T.planets[id].glyph : ''}</span>`;
  const sg = (sign) => `<span class="glyph" style="color:var(--gold)">${T.signs[sign].glyph}</span>`;
  const pn = (id) => (T.planets[id] ? T.planets[id].name : id);
  const nature = (type) => (type === 'conj' ? 'conj' : ['trine', 'sextile'].includes(type) ? 'soft' : 'hard');
  const colorOf = (type) => (type === 'conj' ? 'var(--conj-asp)' : nature(type) === 'soft' ? 'var(--soft-asp)' : 'var(--hard-asp)');
  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
  const now = () => new Date();
  const open = () => { try { return !!(window.Premium && window.Premium.isOpen()); } catch (e) { return false; } };
  const MODULES = ['natal-pro', 'synastry-pro', 'numerology-pro', 'pro-texts', 'person-pro'];
  let ensureP = null;
  /** Подгрузить премиум-модули, если доступ есть (Алина или код). */
  function ensure() { return ensureP || (ensureP = (window.Premium ? window.Premium.ensure(MODULES) : Promise.resolve(false)).catch(() => false)); }
  document.addEventListener('premiumchange', () => { ensureP = null; });
  const locked = (title, meta) => (window.Premium && window.Premium.locked ? window.Premium.locked(esc(title), { lines: 3, meta: meta || 'премиум' }) : '');
  const paywall = (feature, title) => (window.Premium && window.Premium.paywall ? window.Premium.paywall({ feature, compact: true, title }) : '');
  const noChart = () => `<div class="notice">${icon('info')}<span>Нужны данные рождения — дата, время и город.</span></div>`;

  // ---------- расчёты, которые нужны и бесплатной части ----------
  const memo = {};
  function cached(key, fn) { if (memo[key] === undefined) { try { memo[key] = fn(); } catch (e) { console.error(e); memo[key] = null; } } return memo[key]; }
  function invalidate() { for (const k of Object.keys(memo)) delete memo[k]; }
  const cacheKey = (ctx, k) => `${k}:${ctx.person.id}:${JSON.stringify(ctx.person.birth)}`;
  /** Транзиты медленных планет к карте за период (для превью и для премиум-списка). */
  function transitEvents(ctx, months) {
    const ch = ctx.chart, n = now();
    const start = new Date(n.getFullYear(), n.getMonth(), 1), end = new Date(n.getFullYear(), n.getMonth() + months, 0, 23, 59);
    return cached(cacheKey(ctx, 'tr' + months), () => AC.transits(ch, start, end, { transiting: ['mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'node'], natal: ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'asc', 'mc'].filter((id) => ch.byId[id] && (ch.timeKnown || !['asc', 'mc', 'moon'].includes(id))) })
      .filter((e) => !(e.transiting === 'node' && !['conj', 'opp', 'square'].includes(e.type)))) || [];
  }
  /** Точные медленные транзиты на ближайшие days дней (для обзора и гороскопа на месяц). */
  function upcoming(ctx, days) {
    const ch = ctx.chart, n = now();
    return cached(cacheKey(ctx, 'up' + days), () => {
      const ev = AC.transits(ch, n, addDays(n, days), { transiting: ['mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'], natal: ['sun', 'moon', 'mercury', 'venus', 'mars', 'asc', 'mc'].filter((id) => ch.byId[id]) });
      const out = [];
      for (const e of ev) for (const d of e.exact) if (d >= n) out.push({ date: d, text: `${T.planets[e.transiting].name} ${T.aspects[e.type].glyph} ${T.planets[e.natal].name}`, e });
      return out.sort((a, b) => a.date - b.date);
    }) || [];
  }
  /** Медленные транзиты, которые действуют сейчас (для обзора). */
  function nowTransits(ctx) {
    return cached(cacheKey(ctx, 'now'), () => AC.transitSnapshot(ctx.chart, now(), CV.chartOpts()).aspects.filter((x) => ['mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].includes(x.a) && ['conj', 'opp', 'square', 'trine', 'sextile'].includes(x.type) && ['sun', 'moon', 'mercury', 'venus', 'mars', 'asc', 'mc', 'jupiter', 'saturn'].includes(x.b)).slice(0, 5)) || [];
  }
  /** Личные аспекты дня: Луна (по часам) и быстрые планеты к точкам карты. */
  function dayAspects(ch, day) {
    const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const pts = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'asc', 'mc'].filter((id) => ch.byId[id]);
    const L = (id, t) => AC.body(id, t).lon;
    const out = [];
    for (const tid of ['moon', 'sun', 'mercury', 'venus', 'mars']) for (const nid of pts) for (const ang of [0, 60, 90, 120, 180]) for (const sgn of (ang === 0 || ang === 180 ? [1] : [1, -1])) {
      const target = AC.norm(ch.byId[nid].lon + sgn * ang);
      const type = ({ 0: 'conj', 60: 'sextile', 90: 'square', 120: 'trine', 180: 'opp' })[ang];
      const step = tid === 'moon' ? 2 : 24;
      let prevT = d0, prev = AC.d180(L(tid, d0) - target);
      for (let h = step; h <= 24; h += step) {
        const t = new Date(d0.getTime() + h * 3600000), v = AC.d180(L(tid, t) - target);
        if ((prev < 0) !== (v < 0) && Math.abs(v - prev) < 30) {
          let a = prevT.getTime(), b = t.getTime(), fa = prev;
          for (let i = 0; i < 24; i++) { const m = (a + b) / 2, fm = AC.d180(L(tid, new Date(m)) - target); if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m; }
          out.push({ t: tid, n: nid, type, date: new Date((a + b) / 2) });
        }
        prev = v; prevT = t;
      }
      if (tid !== 'moon') { const o = Math.abs(AC.d180(L(tid, new Date(d0.getTime() + 12 * 3600000)) - target)); if (o < 1 && !out.some((x) => x.t === tid && x.n === nid)) out.push({ t: tid, n: nid, type, date: null, orb: o }); }
    }
    return out.sort((a, b) => (a.date || d0) - (b.date || d0));
  }

  // ---------- Натал ----------
  const NATAL_SUB = [['wheel', 'Колесо'], ['interp', 'Толкование'], ['aspects', 'Аспекты'], ['tables', 'Таблицы и баланс'], ['pro', 'Профи']];
  function natal(ctx) {
    const ch = ctx.chart;
    if (!ch) return noChart();
    const s = ctx.state.natal || 'wheel';
    let body = '';
    if (s === 'wheel') body = `<div class="wheel-box" id="pvWheel">${W.svg(ch, { animate: false, minor: UI.settings.minor })}</div>${CV.legend()}<p class="tiny muted center" style="margin:6px 0 0">Наведите на линию аспекта, планету или номер дома — подсказка; нажмите — толкование.</p><div style="margin-top:18px">${CV.big3(ch)}</div>`;
    if (s === 'interp') body = window.NatalPro && open() ? window.NatalPro.interpretation(ch) : CV.interpretation(ch) + `<div style="margin-top:16px">${locked('Планеты в домах, управитель карты, кармические точки, призвание (MC) и ключевые аспекты')}${paywall('natal', 'Натальная карта полностью — в премиум-доступе')}</div>`;
    if (s === 'aspects') body = `${CV.aspectGrid(ch)}<div style="margin-top:18px">${CV.aspectList(ch)}</div>${window.NatalPro && open() ? window.NatalPro.aspects(ch) : `<div style="margin-top:16px">${locked('Толкование всех аспектов карты')}</div>`}`;
    if (s === 'tables') body = `<h4>Планеты и точки</h4>${CV.planetTable(ch)}<h4 style="margin-top:20px">Куспиды домов</h4>${CV.housesTable(ch)}<div style="margin-top:20px">${CV.balance(ch)}</div>`;
    if (s === 'pro') body = '<div id="pvPro"></div>';
    return `<div class="row between cc-subbar"><div class="seg" role="group">${NATAL_SUB.map(([k, t]) => `<button type="button" data-pv-sub="natal:${k}" aria-pressed="${k === s}">${t}</button>`).join('')}</div>
        <div class="row" style="gap:6px"><button class="btn btn-ghost btn-xs" type="button" data-pv-act="png">${icon('download')} PNG</button><button class="btn btn-ghost btn-xs" type="button" data-pv-act="story">${icon('sparkle')} Сторис</button>${ctx.links && ctx.links.natal ? `<a class="btn btn-ghost btn-xs" href="${ctx.links.natal}">${icon('external-link')} На странице</a>` : ''}</div></div>
      <div class="cc-body" data-sub="${s}">${body}</div>`;
  }

  // ---------- Прогноз ----------
  const FC_SUB = [['transits', 'Транзиты'], ['solar', 'Соляр'], ['prog', 'Прогрессии'], ['methods', 'Дирекции и др.'], ['sky', 'Небо на дату']];
  function forecastLocked(ctx, s) {
    if (s === 'transits') {
      const ev = transitEvents(ctx, 6);
      const by = {};
      for (const e of ev) (by[e.transiting] = by[e.transiting] || 0), by[e.transiting]++;
      return `<p class="small">За ближайшие 6 месяцев — <b>${ev.length} ${fmt.plural(ev.length, 'транзит', 'транзита', 'транзитов')}</b> медленных планет к карте${ev.length ? ': ' + Object.entries(by).map(([id, n]) => `${pn(id)} — ${n}`).join(', ') : ''}.</p>
        ${locked('Транзиты по месяцам: точные даты, окна действия и толкования')}${paywall('forecast', 'Личный прогноз — в премиум-доступе')}`;
    }
    const titles = { solar: 'Соляр: карта года, Асцендент и Солнце года, город дня рождения', prog: 'Прогрессии и профекция: внутренние темы года и хозяин года', sky: 'Небо на любую дату: двойное колесо и точные аспекты дня' };
    return `${locked(titles[s])}${paywall('forecast', 'Личный прогноз — в премиум-доступе')}`;
  }
  function forecast(ctx) {
    const ch = ctx.chart;
    if (!ch) return noChart();
    const s = ctx.state.forecast || 'transits';
    const pro = window.PersonPro && open();
    let body;
    if (s === 'methods') body = '<div id="pvMethods"></div>';
    else if (pro) body = window.PersonPro[s](ctx, { transitEvents, ROMAN, gl, sg, pn, colorOf, nature });
    else body = forecastLocked(ctx, s);
    return `<div class="row between cc-subbar"><div class="seg" role="group">${FC_SUB.map(([k, t]) => `<button type="button" data-pv-sub="forecast:${k}" aria-pressed="${k === s}">${t}${k !== 'methods' && !pro ? ' 🔒' : ''}</button>`).join('')}</div>${ctx.links && ctx.links.forecast ? `<a class="btn btn-ghost btn-xs" href="${ctx.links.forecast}">${icon('external-link')} Полный прогноз</a>` : ''}</div><div class="cc-body" data-sub="${s}">${body}</div>`;
  }

  // ---------- Числа ----------
  function numbers(ctx) {
    const N = window.Numerology, TX = window.NUMEROLOGY_TEXTS;
    if (!N || !TX) return '<p class="muted">Нумерология не загрузилась — обновите страницу.</p>';
    const b = ctx.person.birth;
    if (!b) return noChart();
    const n = now(), full = ctx.person.fullName || '';
    const lp = N.lifePath(b.y, b.mo, b.d), bd = N.birthday(b.d), py = N.personalYear(b.mo, b.d, n.getFullYear());
    const nm = full.trim().split(/\s+/).length >= 2 ? N.nameNumbers(full) : null;
    const sq = N.pythagoras(b.y, b.mo, b.d);
    ctx.state.numR = { name: full || ctx.person.name, iso: `${b.y}-${String(b.mo).padStart(2, '0')}-${String(b.d).padStart(2, '0')}`, y: b.y, m: b.mo, d: b.d, lp, bd, nm, py, pyNext: N.personalYear(b.mo, b.d, n.getFullYear() + 1), sq, year: n.getFullYear(), month: n.getMonth() + 1 };
    const tile = (label, v, sub) => `<div class="cc-num"><span class="num-orb m${TX.numbers[v] && TX.numbers[v].master ? ' master' : ''}">${v}</span><div><span class="eyebrow">${label}</span><b>${esc(TX.numbers[v] ? TX.numbers[v].name : '')}</b><span class="small muted">${esc(sub || (TX.numbers[v] ? TX.numbers[v].keys : ''))}</span></div></div>`;
    const cell = (d) => `<div class="cc-sqc"><b>${sq.counts[d] ? String(d).repeat(sq.counts[d]) : '—'}</b><small>${esc(TX.cells[d] ? TX.cells[d].title : '')}</small></div>`;
    const L = TX.numbers[lp.value];
    return `<div class="row between cc-subbar"><div class="field" style="flex:1;max-width:420px"><label for="pvFull">ФИО при рождении <small class="muted">— для чисел имени</small></label><input class="input" id="pvFull" value="${esc(full)}" placeholder="Как в свидетельстве о рождении"></div>${ctx.links && ctx.links.numerology ? `<a class="btn btn-ghost btn-xs" href="${ctx.links.numerology}">${icon('external-link')} На странице</a>` : ''}</div>
      <div class="cc-nums">${tile('Жизненный путь', lp.value)}${tile('День рождения', bd.value)}${nm ? tile('Число имени', nm.expression.value) + (nm.soul ? tile('Душа', nm.soul.value) : '') + (nm.personality ? tile('Личность', nm.personality.value) : '') : ''}${tile(`Личный год ${n.getFullYear()}`, py.value, TX.years[py.value] ? TX.years[py.value].title : '')}</div>
      <div class="interp" style="margin-top:14px"><article class="interp-item"><div class="ig">${lp.value}</div><div><h4>Жизненный путь ${lp.value} — ${esc(L.name)}</h4><p>${esc(L.essence || '')}</p>${L.strengths ? `<p class="small"><b>Сильные стороны:</b> ${esc([].concat(L.strengths).join(', '))}</p>` : ''}</div></article>
        ${TX.years[py.value] ? `<article class="interp-item"><div class="ig">${py.value}</div><div><h4>${n.getFullYear()} — ${esc(TX.years[py.value].title)}</h4><p>${esc(TX.years[py.value].text || '')}</p></div></article>` : ''}</div>
      <h4 style="margin-top:18px">Квадрат Пифагора</h4><div class="cc-sq">${[1, 4, 7, 2, 5, 8, 3, 6, 9].map(cell).join('')}</div>
      <p class="tiny muted">Рабочие числа: ${sq.work.join(' · ')}</p>
      <div id="pvNumPro">${window.NumerologyPro && open() ? '' : `<div style="margin-top:14px">${locked('Личные месяцы, календарь личных дней и следующий личный год')}</div>`}</div>`;
  }

  // ---------- Гороскоп ----------
  const HORO_SUB = [['today', 'Сегодня'], ['tomorrow', 'Завтра'], ['week', 'Неделя'], ['month', 'Месяц']];
  function horo(ctx) {
    const ch = ctx.chart;
    if (!ch) return noChart();
    const s = ctx.state.horo || 'today', n = now();
    const H = window.HoroscopeCore;
    const day = s === 'tomorrow' ? addDays(n, 1) : n;
    const sunSi = ch.byId.sun.signIndex, ascSi = ch.byId.asc ? ch.byId.asc.signIndex : null;
    const pro = window.PersonPro && open();
    let personal = '';
    if (s === 'today' || s === 'tomorrow') {
      const asp = dayAspects(ch, day);
      const moon = AC.body('moon', new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12));
      const mh = ch.houses ? AC.houseOf(moon.lon, ch.houses.cusps) : null;
      personal = `${mh ? `<div class="horo-block"><h4><span class="gl">☽&#xFE0E;</span> Луна в ${ROMAN[mh - 1]} доме карты — ${esc(T.houses[mh].title.toLowerCase())}</h4><p>Фокус дня — «${esc(T.houses[mh].topic)}». ${esc(T.houses[mh].about)}</p></div>` : ''}
        ${asp.length ? `<div class="horo-block"><h4><span class="gl">✦</span> Личные аспекты дня</h4>${asp.map((x) => `<p><b>${x.date ? fmt.time(x.date) + ' · ' : ''}${pn(x.t)} ${T.aspects[x.type].glyph} ${pn(x.n)}</b> — ${esc((T.transitNature[x.t] || T.transitNature.sun)[nature(x.type)])}</p>`).join('')}</div>` : '<div class="horo-block"><p>Личных аспектов нет — день течёт ровно, по общему фону.</p></div>'}`;
    } else if (pro) personal = window.PersonPro[s === 'week' ? 'horoWeek' : 'horoMonth'](ctx, { dayAspects, upcoming, pn, nature });
    else personal = `${locked(s === 'week' ? 'Неделя по дням: личные аспекты и самые лёгкие и напряжённые дни' : 'Месяц: личные транзиты по датам')}${paywall('forecast', 'Личный гороскоп на неделю и месяц — в премиум-доступе')}`;
    const gen = (si) => (s === 'month' ? H.monthBlock(si) : s === 'week' ? '' : H.dayBlock(day, si));
    return `<div class="row between cc-subbar"><div class="seg" role="group">${HORO_SUB.map(([k, t]) => `<button type="button" data-pv-sub="horo:${k}" aria-pressed="${k === s}">${t}${(k === 'week' || k === 'month') && !pro ? ' 🔒' : ''}</button>`).join('')}</div><button class="btn btn-gold btn-xs" type="button" data-pv-act="horoCopy">${icon('copy')} Скопировать текст</button></div>
      <div class="grid grid-2 cc-horo" style="align-items:start"><div><h3 style="margin-top:0">Личный — по карте</h3>${personal}</div>
      <div><h3 style="margin-top:0">По знаку: ${sg(AC.SIGNS[sunSi])} ${esc(T.signs[AC.SIGNS[sunSi]].name)}</h3>${s === 'week' ? '<p class="small muted">Общий гороскоп знака — на вкладках «Сегодня», «Завтра», «Месяц».</p>' : gen(sunSi)}
      ${ascSi != null && ascSi !== sunSi && s !== 'week' ? `<details class="details-adv" style="margin-top:10px"><summary>По Асценденту: ${esc(T.signs[AC.SIGNS[ascSi]].name)} — часто точнее</summary>${gen(ascSi)}</details>` : ''}</div></div>`;
  }
  function horoText(ctx) {
    const ch = ctx.chart, s = ctx.state.horo || 'today', n = now(), day = s === 'tomorrow' ? addDays(n, 1) : n;
    const first = (ctx.person.name || '').split(' ')[0];
    if (s !== 'month') {
      const asp = dayAspects(ch, day);
      const moon = AC.body('moon', new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12));
      const mh = ch.houses ? AC.houseOf(moon.lon, ch.houses.cusps) : null;
      return `${first ? first + ', в' : 'В'}аш личный прогноз на ${s === 'tomorrow' ? 'завтра' : 'сегодня'}, ${fmt.dm(day)} ✨\n${mh ? `Фокус дня — ${T.houses[mh].topic}.\n` : ''}${asp.slice(0, 4).map((x) => `• ${x.date ? fmt.time(x.date) + ' — ' : ''}${(T.transitNature[x.t] || T.transitNature.sun)[nature(x.type)]}`).join('\n')}`;
    }
    return `${first ? first + ', г' : 'Г'}лавные даты ближайших недель ✨\n${upcoming(ctx, 60).slice(0, 5).map((x) => `• ${fmt.dm(x.date)} — ${(T.transitNature[x.e.transiting] || T.transitNature.sun)[nature(x.e.type)]}`).join('\n')}`;
  }

  // ---------- Совместимость ----------
  function syn(ctx) {
    const ch = ctx.chart;
    if (!ch) return noChart();
    const list = (ctx.partners ? ctx.partners() : []).filter((x) => x.birth);
    const p = ctx.partner ? ctx.partner() : null;
    const pick = `<div class="row" style="gap:8px;align-items:flex-end"><div class="field" style="min-width:220px"><label for="pvPartner">Партнёр</label><select class="select" id="pvPartner"><option value="">— выбрать —</option>${list.map((o) => `<option value="${esc(o.key)}"${p && p.key === o.key ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>
      ${ctx.newPartner ? `<button class="btn btn-ghost btn-sm" type="button" data-pv-act="partnerNew">${icon('user-plus')} Ввести данные партнёра</button>` : ''}${ctx.partnerExtra || ''}</div>`;
    if (!p || !p.birth) return `${pick}<p class="muted" style="margin-top:14px">Выберите партнёра — появятся оценка пары по пяти сферам, аспекты, двойное колесо и композит.</p>`;
    const B = cached('pc:' + JSON.stringify(p.birth), () => AC.chart(Object.assign({}, p.birth, { name: p.name }), CV.chartOpts()));
    if (!B) return `${pick}<p class="notice" style="margin-top:12px">Не получилось построить карту партнёра — проверьте данные.</p>`;
    const S = AC.synastry(ch, B);
    ctx.state.syn = { A: ch, B, S, nA: (ctx.person.name || 'Карта 1').split(' ')[0], nB: (p.name || 'Карта 2').split(' ')[0] };
    return `${pick}
      <div class="grid grid-2" style="margin-top:16px;align-items:center"><div class="cc-score"><span class="cc-score-n">${S.total}</span><span class="small muted">из 100 · ${esc(ctx.state.syn.nA)} и ${esc(ctx.state.syn.nB)}</span></div>
        <div class="bars">${Object.entries(S.spheres).map(([k, v]) => `<div class="bar"><span>${T.synSpheres[k].name}</span><span class="track"><span class="fill" data-w="${v}" style="width:${v}%;background:linear-gradient(90deg,var(--lav),var(--rose-strong))"></span></span><span class="pct">${v}</span></div>`).join('')}</div></div>
      <div id="pvSynPro">${window.SynastryPro && open() ? '' : `<div style="margin-top:14px">${locked(`Аспекты пары с толкованием (${S.aspects.length}), двойное колесо, композит и сравнение карт`)}${paywall('synastry', 'Подробная совместимость — в премиум-доступе')}</div>`}</div>
      ${ctx.links && ctx.links.synastry ? `<p class="small" style="margin-top:12px"><a href="${ctx.links.synastry(p.key)}">${icon('external-link')} Открыть совместимость на странице</a></p>` : ''}`;
  }

  const BODY = { natal, forecast, numbers, horo, syn };
  function body(tab, ctx) { return BODY[tab] ? BODY[tab](ctx) : ''; }
  function after(tab, box, ctx) {
    UI.enhanceDob(box);
    for (const el of box.querySelectorAll('.wheel-box[id]')) W.attach(el);
    const s = ctx.state;
    if (tab === 'natal' && s.natal === 'pro' && window.ProView) window.ProView.natal(box.querySelector('#pvPro'), ctx.chart, ctx.person.birth);
    if (tab === 'natal' && s.natal === 'tables') CV.animateBars(box);
    if (tab === 'forecast' && s.forecast === 'methods' && window.ProView) window.ProView.forecast(box.querySelector('#pvMethods'), ctx.chart, ctx.person.birth);
    if (tab === 'forecast' && window.PersonPro && open() && window.PersonPro.after) window.PersonPro.after(s.forecast, box, ctx);
    if (tab === 'numbers' && window.NumerologyPro && open() && s.numR) { const np = box.querySelector('#pvNumPro'); if (np) { window.NumerologyPro.reset(); np.innerHTML = window.NumerologyPro.html(s.numR); window.NumerologyPro.bind(np, () => s.numR); } }
    if (tab === 'syn' && s.syn && window.SynastryPro && open()) { const sp = box.querySelector('#pvSynPro'); if (sp) window.SynastryPro.render(sp, s.syn); }
  }
  /** Общие обработчики: подвкладки, ФИО, партнёр, PNG/сторис/текст. Возвращает true, если событие обработано. */
  async function handle(e, ctx) {
    if (e.type === 'click') {
      const sb = e.target.closest('[data-pv-sub]');
      if (sb) { const [tab, k] = sb.dataset.pvSub.split(':'); ctx.state[tab] = k; ctx.redraw(); return true; }
      if (window.PersonPro && window.PersonPro.handle && open() && window.PersonPro.handle(e, ctx)) return true;
      const a = e.target.closest('[data-pv-act]');
      if (!a) return false;
      const k = a.dataset.pvAct, ch = ctx.chart, p = ctx.person;
      if (k === 'png' && ch) W.exportPNG(ch, { minor: UI.settings.minor, caption: `${p.name || 'Натальная карта'} · ${fmt.birth(p.birth)} · ${p.birth.place || ''}` }, `natal-${(p.name || 'chart').replace(/\s+/g, '_')}.png`);
      if (k === 'story' && ch && window.Cards) { const cv = await window.Cards.storyNatal(ch, Object.assign({}, p.birth, { name: p.name }), { showName: !!p.name }); window.Cards.show(cv, 'natalnaya-karta.png', 'Карточка для сторис', 'Только знаки и колесо — без даты, времени и места рождения.'); }
      if (k === 'horoCopy' && ch) { if (await UI.copyText(horoText(ctx))) UI.toast('Текст гороскопа скопирован', 'check'); }
      if (k === 'partnerNew' && ctx.newPartner) ctx.newPartner();
      return true;
    }
    if (e.type === 'change') {
      if (e.target.id === 'pvPartner') { ctx.setPartner(e.target.value); ctx.state.syn = null; ctx.redraw(); return true; }
      if (e.target.id === 'pvFull') { ctx.save({ fullName: e.target.value.trim() }); ctx.redraw(); return true; }
      if (window.PersonPro && window.PersonPro.handle && open() && window.PersonPro.handle(e, ctx)) return true;
    }
    return false;
  }
  window.PersonView = { body, after, handle, ensure, invalidate, open, upcoming, nowTransits, dayAspects, transitEvents, TABS: [['natal', 'Натал', 'chart'], ['forecast', 'Прогноз', 'crystal-ball'], ['numbers', 'Числа', 'numerology'], ['horo', 'Гороскоп', 'sun-moon'], ['syn', 'Совместимость', 'hearts']] };
})();
