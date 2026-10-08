/* Прогноз: транзиты по месяцам, соляр, прогрессии, небо на дату. */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI, CV = window.ChartView, W = window.Wheel;
  const { esc, fmt, icon } = UI;
  let form, natal = null, params = null, events = [], range = null;

  const PW = { pluto: 5, neptune: 4.5, uranus: 4.5, saturn: 4, jupiter: 3, chiron: 2, node: 2, mars: 1.5, sun: 1, venus: 1, mercury: 1 };
  const NW = { sun: 3, moon: 3, asc: 3, mc: 3, venus: 2, mars: 2, mercury: 2, jupiter: 1.2, saturn: 1.2, node: 1, uranus: 0.8, neptune: 0.8, pluto: 0.8 };
  const AW = { conj: 1.2, opp: 1, square: 1, trine: 0.8, sextile: 0.6 };
  const natureOf = (type) => (type === 'conj' ? 'conj' : ['trine', 'sextile'].includes(type) ? 'soft' : 'hard');
  const colorOf = (type) => (type === 'conj' ? 'var(--conj-asp)' : natureOf(type) === 'soft' ? 'var(--soft-asp)' : 'var(--hard-asp)');

  function evItem(e) {
    const tt = T.transitText(e.transiting, e.natal, e.type);
    const asp = T.aspects[e.type];
    const main = e.exact[0] || e.start;
    const exactStr = e.exact.length ? e.exact.map((d) => fmt.dm(d)).join(', ') : '';
    const multi = e.exact.length > 1 ? `<span class="badge rose">${e.exact.length} касания из-за ретроградности</span>` : '';
    return `<article class="tl-item" style="--c:${colorOf(e.type)}">
      <div class="when"><b>${e.exact.length ? fmt.dateShort(main) : '≈'}</b>${e.exact.length ? 'точный аспект' : 'в орбисе'}</div>
      <div>
        <h4><span class="gl">${T.planets[e.transiting].glyph}</span>${T.planets[e.transiting].name} <span class="gl" style="color:${colorOf(e.type)}">${asp.glyph}</span> <span class="gl">${T.planets[e.natal].glyph}</span>${T.planets[e.natal].name} <span class="badge">${asp.name.toLowerCase()}</span>${multi}</h4>
        <p>${tt.text}</p>
        <div class="range">Действует: ${e.openStart ? 'уже идёт' : 'с ' + fmt.dm(e.start)} → ${e.openEnd ? 'дольше периода' : 'до ' + fmt.dm(e.end)}${exactStr ? ' · точно: ' + exactStr : ''}</div>
      </div></article>`;
  }

  function transitsTab() {
    if (!events.length) return '<p class="muted">В этом периоде нет заметных транзитов выбранных планет. Попробуйте увеличить период или включить быстрые планеты.</p>';
    const scored = events.map((e) => ({ e, w: (PW[e.transiting] || 1) * (NW[e.natal] || 1) * (AW[e.type] || 0.5) })).sort((a, b) => b.w - a.w);
    const seenK = new Set();
    const top = scored.filter((x) => { const k = x.e.transiting + x.e.natal + x.e.type; if (seenK.has(k)) return false; seenK.add(k); return true; }).slice(0, 4).map((x) => x.e);
    let html = `<h3>Главные темы периода</h3><div class="grid grid-2" style="margin-bottom:10px">${top.map((e) => {
      const tt = T.transitText(e.transiting, e.natal, e.type);
      return `<div class="card hover" style="border-left:4px solid ${colorOf(e.type)}"><div class="row" style="gap:8px"><span class="glyph" style="font-size:1.5rem;color:var(--lav-strong)">${T.planets[e.transiting].glyph}</span><span class="glyph" style="font-size:1.2rem;color:${colorOf(e.type)}">${T.aspects[e.type].glyph}</span><span class="glyph" style="font-size:1.5rem;color:var(--lav-strong)">${T.planets[e.natal].glyph}</span></div>
        <h4 style="margin:10px 0 4px">${tt.title}</h4><p class="small muted" style="margin:0 0 6px">${e.openStart ? 'уже идёт' : fmt.dm(e.start)} — ${e.openEnd ? 'продолжится' : fmt.dm(e.end)}</p><p class="small" style="margin:0">${(T.transitNature[e.transiting] || T.transitNature.sun)[natureOf(e.type)]}</p></div>`;
    }).join('')}</div>`;
    // по месяцам
    const byMonth = {};
    for (const e of events) {
      const d = e.exact[0] || (e.start < range.start ? range.start : e.start);
      const k = d.getFullYear() * 12 + d.getMonth();
      (byMonth[k] = byMonth[k] || []).push(e);
    }
    html += '<div class="row between" style="margin-top:18px"><h3 style="margin:0">Календарь транзитов</h3><div class="legend"><span><i style="background:var(--soft-asp)"></i>гармоничные</span><span><i style="background:var(--hard-asp)"></i>напряжённые</span><span><i style="background:var(--conj-asp)"></i>соединения</span></div></div><div class="timeline">';
    for (const k of Object.keys(byMonth).map(Number).sort((a, b) => a - b)) {
      html += `<div class="tl-month">${fmt.MONTHS[k % 12]} ${Math.floor(k / 12)}</div>`;
      html += byMonth[k].sort((a, b) => (a.exact[0] || a.start) - (b.exact[0] || b.start)).map(evItem).join('');
    }
    return html + '</div>';
  }

  function solarTab(year, cityIdx) {
    const place = cityIdx === '' || cityIdx == null ? null : UI.CITIES[+cityIdx];
    const sr = AC.solarReturn(natal, year, place ? { lat: place.lat, lon: place.lon, zone: place.tz } : null, CV.chartOpts());
    const asc = sr.byId.asc, sun = sr.byId.sun, moon = sr.byId.moon;
    const local = new Date(sr.returnDate);
    const cityOpts = `<option value="">Место рождения</option>` + UI.CITIES.map((c, i) => `<option value="${i}"${String(i) === String(cityIdx) ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
    const yNow = new Date().getFullYear();
    return `
      <div class="row" style="margin-bottom:16px">
        <div class="field" style="min-width:140px"><label for="srYear">Год</label><select class="select" id="srYear">${[yNow - 1, yNow, yNow + 1, yNow + 2].map((y) => `<option${y === year ? ' selected' : ''}>${y}</option>`).join('')}</select></div>
        <div class="field" style="min-width:220px"><label for="srCity">Где вы встречаете день рождения</label><select class="select" id="srCity">${cityOpts}</select></div>
      </div>
      <p class="muted small">Соляр — карта на момент, когда Солнце возвращается в точку вашего рождения. Она описывает темы года — от дня рождения до следующего. Солнце вернётся: <b>${fmt.dateTime(local)}</b> (ваше местное время браузера).</p>
      <div class="wheel-box" id="srWheel">${W.svg(sr, {})}</div>
      <div class="interp" style="margin-top:18px">
        <article class="interp-item"><div class="ig glyph">${T.signs[asc.sign].glyph}</div><div><h4>Асцендент года ${T.signs[asc.sign].loc}</h4><p>Тон года: вы будете действовать ${T.signs[asc.sign].trait}. Ключевые темы: ${T.signs[asc.sign].keys}.</p></div></article>
        <article class="interp-item"><div class="ig glyph">☉&#xFE0E;</div><div><h4>Солнце года в ${CV.ROMAN[sun.house - 1]} доме — ${T.houses[sun.house].title.toLowerCase()}</h4><p>Главная сцена года — сфера «${T.houses[sun.house].topic}». ${T.sunSolarHouse[sun.house].replace('Месяц', 'Год').replace('месяц', 'год')}</p></div></article>
        <article class="interp-item"><div class="ig glyph">☽&#xFE0E;</div><div><h4>Луна года ${T.signs[moon.sign].loc}, ${CV.ROMAN[moon.house - 1]} дом</h4><p>Эмоциональные потребности года связаны со сферой «${T.houses[moon.house].topic}»; душевный комфорт дают ${T.moonInSign[moon.sign].good}.</p></div></article>
      </div>`;
  }

  function progTab() {
    const now = new Date();
    const pr = AC.progressed(natal, now, CV.chartOpts());
    const ps = pr.byId.sun, pm = pr.byId.moon;
    const rows = pr.points.map((p) => `<tr><td><span class="g glyph">${T.planets[p.id].glyph}</span> ${T.planets[p.id].name}</td><td>${AC.fmtDeg(p.lon)} ${T.signs[p.sign].glyph} ${T.signs[p.sign].name}</td><td>${natal.byId[p.id] ? AC.fmtDeg(natal.byId[p.id].lon) + ' ' + T.signs[natal.byId[p.id].sign].name : ''}</td><td>${p.house ? CV.ROMAN[p.house - 1] : ''}</td></tr>`).join('');
    const asp = pr.aspects.filter((x) => ['sun', 'moon', 'mercury', 'venus', 'mars', 'asc', 'mc'].includes(x.a) && ['conj', 'opp', 'square', 'trine', 'sextile'].includes(x.type)).slice(0, 8);
    const moonSignChange = (30 - pm.lon % 30) / 13.2 * 12; // ≈ месяцев до смены знака прогрессивной Луной
    const pf = AC.profection(natal, now);
    const lordNow = AC.body(pf.lord, now);
    return `
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--gold-2)"><span class="eyebrow" style="margin-bottom:6px">Профекция года · ${pf.age} ${fmt.plural(pf.age, 'год', 'года', 'лет')}</span>
        <h4 style="margin:0 0 6px">Год ${CV.ROMAN[pf.house - 1]} дома — ${T.houses[pf.house].title.toLowerCase()}</h4>
        <p class="small" style="margin:0 0 6px">До следующего дня рождения «включена» сфера «${T.houses[pf.house].topic}» (знак ${T.signs[pf.sign].name}${pf.fromSun ? ', отсчёт от Солнца — время рождения неизвестно' : ''}). Хозяин года — <b>${T.planets[pf.lord].name}</b>: его транзиты и положение в карте особенно важны в этом году. Сейчас ${T.planets[pf.lord].name} ${T.signs[AC.signOf(lordNow.lon)].loc}${lordNow.retro ? ', ретроградный' : ''}.</p>
        <p class="tiny muted" style="margin:0">Метод годовых профекций — классическая техника: каждый год жизни соответствует следующему дому от Асцендента.</p></div>
      <p class="muted small">Вторичные прогрессии: один день после рождения соответствует одному году жизни. Показывают внутреннее созревание — медленные, но глубокие перемены.</p>
      <div class="grid grid-2">
        <div class="card"><h4>Прогрессивное Солнце ${T.signs[ps.sign].loc}</h4><p class="small">${ps.sign !== natal.byId.sun.sign ? 'Ваше Солнце «переехало» в новый знак: к врождённым качествам добавились черты знака — ' + T.signs[ps.sign].keys + '.' : 'Прогрессивное Солнце ещё в знаке рождения: вы углубляете свою природу.'} Сейчас оно на ${AC.fmtDeg(ps.lon)}.</p></div>
        <div class="card"><h4>Прогрессивная Луна ${T.signs[pm.sign].loc}</h4><p class="small">Эмоциональный фокус этих двух с половиной лет: ${T.moonInSign[pm.sign].good}. Примерно через ${Math.max(1, Math.round(moonSignChange))} ${fmt.plural(Math.round(moonSignChange), 'месяц', 'месяца', 'месяцев')} Луна перейдёт в следующий знак. Фаза прогрессий: <b>${T.moonPhase8[pr.moonPhase].name.toLowerCase()}</b>.</p></div>
      </div>
      ${asp.length ? `<h4 style="margin-top:18px">Точные прогрессивные аспекты</h4><div class="interp">${asp.map((x) => `<article class="interp-item"><div class="ig glyph">${T.aspects[x.type].glyph}</div><div><h4>Прогр. ${T.planets[x.a].name} ${T.aspects[x.type].phrase} ${T.aspects[x.type].caseKey === 'ins' ? T.planets[x.b].ins : T.planets[x.b].dat} (натал)</h4><p>Орбис ${x.orb.toFixed(2)}° — тема активна в ближайшие 1–2 года. Затрагивает ${T.natalTheme[x.b] || T.planets[x.b].keys}.</p></div></article>`).join('')}</div>` : ''}
      <h4 style="margin-top:18px">Положения на ${fmt.date(now)}</h4>
      <div class="table-wrap"><table class="table"><thead><tr><th>Планета</th><th>Прогрессия</th><th>Натал</th><th>Дом</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function skyTab(date) {
    const snap = AC.transitSnapshot(natal, date, CV.chartOpts());
    const outer = { points: snap.points };
    return `<div class="row" style="margin-bottom:12px"><div class="field"><label for="skyDate">Дата</label><input class="input" type="date" id="skyDate" value="${fmt.ymd(date)}"></div></div>
      <p class="muted small center">Внутри — ваша карта, снаружи — положение планет на ${fmt.date(date)}.</p>
      <div class="wheel-box" id="skyWheel">${W.svg(natal, { outer, aspects: snap.aspects, labelB: 'транзит' })}</div>
      ${CV.legend()}
      <h4 style="margin-top:18px">Точные аспекты этого дня</h4>
      ${snap.aspects.filter((x) => ['conj', 'opp', 'square', 'trine', 'sextile'].includes(x.type)).slice(0, 10).map((x) => `<p class="small" style="margin:0 0 6px"><span class="glyph" style="color:var(--lav-strong)">${T.planets[x.a].glyph}</span> ${T.planets[x.a].name} ${T.aspects[x.type].glyph} ${T.planets[x.b].name} <span class="muted">(${x.orb.toFixed(1)}°)</span> — ${(T.transitNature[x.a] || T.transitNature.sun)[natureOf(x.type)]}</p>`).join('') || '<p class="muted small">Точных аспектов нет.</p>'}`;
  }

  function render() {
    const box = document.getElementById('result');
    const tabs = [['tab-transits', 'Транзиты'], ['tab-solar', 'Соляр'], ['tab-prog', 'Прогрессии'], ['tab-sky', 'Небо на дату']];
    box.innerHTML = `
      <div class="card">
        <div class="result-head"><div><span class="eyebrow" style="margin-bottom:8px">Прогноз</span><h2>${esc(params.name || 'Ваш прогноз')}</h2>
          <p class="muted small" style="margin:6px 0 0">${fmt.date(range.start)} — ${fmt.date(range.end)} · ${events.length} ${fmt.plural(events.length, 'транзит', 'транзита', 'транзитов')}</p></div></div>
        ${!natal.timeKnown ? `<div class="notice" style="margin-bottom:14px">${icon('clock')}<span>Без времени рождения транзиты к Асценденту, MC и Луне не учитываются точно.</span></div>` : ''}
        <div class="tabs" role="tablist">${tabs.map(([id, t], i) => `<button role="tab" id="${id}-btn" aria-controls="${id}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${t}</button>`).join('')}</div>
        <div style="margin-top:22px">
          <div class="tab-panel" role="tabpanel" id="tab-transits">${transitsTab()}</div>
          <div class="tab-panel" role="tabpanel" id="tab-solar" hidden></div>
          <div class="tab-panel" role="tabpanel" id="tab-prog" hidden></div>
          <div class="tab-panel" role="tabpanel" id="tab-sky" hidden></div>
        </div>
      </div>
      <div class="card note-card" style="margin-top:20px">${UI.alinaNote('Транзиты — как прогноз погоды: важно не только «что», но и «как этим воспользоваться». Соберу для вас план года с датами и подсказками.', '<button class="btn btn-primary btn-sm" type="button" data-book="forecast">Хочу прогноз на год</button>')}</div>`;
    UI.tabs(box);
    const tl = box.querySelector('[role=tablist]');
    tl.addEventListener('tabchange', (e) => {
      const id = e.detail, panel = document.getElementById(id);
      if (panel.dataset.ready) return;
      panel.dataset.ready = '1';
      if (id === 'tab-solar') { if (!natal.timeKnown) { panel.innerHTML = '<p class="muted">Для соляра нужно время рождения.</p>'; return; } drawSolar(new Date().getFullYear(), ''); }
      if (id === 'tab-prog') panel.innerHTML = progTab();
      if (id === 'tab-sky') drawSky(new Date());
    });
  }
  function drawSolar(year, city) {
    const panel = document.getElementById('tab-solar');
    panel.innerHTML = solarTab(year, city);
    W.attach(document.getElementById('srWheel'));
    panel.querySelector('#srYear').addEventListener('change', (e) => drawSolar(+e.target.value, panel.querySelector('#srCity').value));
    panel.querySelector('#srCity').addEventListener('change', (e) => drawSolar(+panel.querySelector('#srYear').value, e.target.value));
  }
  function drawSky(date) {
    const panel = document.getElementById('tab-sky');
    panel.innerHTML = skyTab(date);
    W.attach(document.getElementById('skyWheel'));
    panel.querySelector('#skyDate').addEventListener('change', (e) => { const v = e.target.value; if (v) { const [y, m, d] = v.split('-').map(Number); drawSky(new Date(y, m - 1, d, 12)); } });
  }

  function calc(p) {
    params = p || form.get(); if (!params) return;
    natal = AC.chart(params, CV.chartOpts());
    const sm = document.getElementById('startMonth').value;
    const [y, m] = (sm || fmt.ymd(new Date()).slice(0, 7)).split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const months = +document.getElementById('period').value;
    const end = new Date(y, m - 1 + months, 0, 23, 59);
    range = { start, end };
    const tIds = ['mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'node', 'chiron'].concat(document.getElementById('fastToggle').checked ? ['sun', 'mercury', 'venus'] : []);
    const nIds = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'asc', 'mc'].concat(months <= 6 ? [] : []);
    const btn = document.getElementById('calcBtn');
    btn.disabled = true; btn.textContent = 'Считаю…';
    setTimeout(() => {
      try {
        events = AC.transits(natal, start, end, { transiting: tIds, natal: natal.timeKnown ? nIds : nIds.filter((x) => !['asc', 'mc', 'moon'].includes(x)) })
          .filter((e) => !(e.transiting === e.natal && ['node', 'chiron'].includes(e.transiting)))
          .filter((e) => !(['node', 'chiron'].includes(e.transiting) && !['conj', 'opp', 'square'].includes(e.type)));
        UI.recent.add(params);
        render();
        if (window.innerWidth < 1000) document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
      } catch (err) { console.error(err); UI.toast('Не получилось рассчитать прогноз', 'info'); }
      btn.disabled = false; btn.textContent = 'Рассчитать прогноз';
    }, 30);
  }

  document.addEventListener('DOMContentLoaded', () => {
    form = UI.birthForm(document.getElementById('birthForm'));
    document.getElementById('startMonth').value = fmt.ymd(new Date()).slice(0, 7);
    document.getElementById('calcBtn').addEventListener('click', () => calc());
    const q = new URLSearchParams(location.search);
    const cid = q.get('client');
    const c = cid && UI.clients.get(cid);
    if (c && c.birth) { form.set(c.birth); calc(c.birth); } else { const r = UI.recent.list(); if (r[0]) form.set(r[0]); }
  });
})();
