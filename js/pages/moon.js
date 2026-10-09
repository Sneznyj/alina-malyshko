/* Лунный календарь: сегодня + месяц, всё во времени выбранного города. */
(function () {
  'use strict';
  const A = window.Astronomy, AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI;
  const { esc, fmt, icon } = UI;
  let city = UI.defaultCity();
  let view = null, data = null, selected = null;

  // ---- время в часовом поясе города ----
  const partsCache = {};
  function tzParts(d, tz) {
    const f = partsCache[tz] || (partsCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', weekday: 'short' }));
    const p = {}; for (const x of f.formatToParts(d)) p[x.type] = x.value;
    return { y: +p.year, m: +p.month, d: +p.day, hh: p.hour, mm: p.minute };
  }
  const hm = (d) => { const p = tzParts(d, city.tz); return `${p.hh}:${p.mm}`; };
  const dayKey = (d) => { const p = tzParts(d, city.tz); return `${p.y}-${p.m}-${p.d}`; };
  const localMidnight = (y, m, d) => AC.localToUTC(y, m, d, 0, 0, city.tz).date;
  /** «14:20, 12 окт» — время, а дата только если это не тот день, о котором речь. */
  const hmd = (t, ref) => hm(t) + (dayKey(t) !== dayKey(ref) ? ` ${tzParts(t, city.tz).d} ${fmt.MONTHS_SHORT[tzParts(t, city.tz).m - 1]}` : '');

  // ---- Луна без курса: часы ----
  const ASPECT = { 0: ['соединение', '☌'], 60: ['секстиль', '⚹'], 90: ['квадрат', '□'], 120: ['трин', '△'], 180: ['оппозиция', '☍'] };
  function dur(ms) {
    const m = Math.max(1, Math.round(ms / 60000)), h = Math.floor(m / 60), r = m % 60;
    return h ? `${h} ч${r ? ' ' + r + ' мин' : ''}` : `${r} мин`;
  }
  /** Часть периода без курса внутри суток d: подпись «14:20–18:05», «до 06:15», «с 21:40» или «весь день» и доли суток для шкалы. */
  function vocPart(v, d) {
    const s = Math.max(v.start, d.d0), e = Math.min(v.end, d.d1), len = d.d1 - d.d0;
    const fromPrev = v.start <= d.d0, toNext = v.end >= d.d1;
    const label = fromPrev && toNext ? 'весь день' : fromPrev ? `до ${hm(v.end)}` : toNext ? `с ${hm(v.start)}` : `${hm(v.start)}–${hm(v.end)}`;
    return { label, a: (s - d.d0) / len, b: (e - d.d0) / len, ms: e - s };
  }
  /** Полоска-шкала суток с отрезками без курса. */
  function vocBar(d, cls) {
    return `<span class="${cls || 'voc-bar'}" aria-hidden="true">${d.voc.map((v) => { const p = vocPart(v, d); return `<i style="left:${(p.a * 100).toFixed(2)}%;width:${Math.max(1.5, (p.b - p.a) * 100).toFixed(2)}%"></i>`; }).join('')}</span>`;
  }
  /** Откуда берётся период: последний аспект Луны в знаке и переход в следующий знак. */
  function vocWhy(v) {
    const asp = v.lastAspect && ASPECT[v.lastAspect.angle];
    const pl = asp && T.planets[v.lastAspect.id];
    const start = asp ? `после последнего аспекта Луны в этом знаке — ${asp[0]} <span class="glyph">☽ ${asp[1]} ${pl ? pl.glyph : ''}</span>${pl ? ' (' + pl.name + ')' : ''} в ${hm(v.start)}` : 'с входа Луны в знак — аспектов в этом знаке она не делает';
    return `Начинается ${start}. Заканчивается в ${hm(v.end)}, когда Луна переходит в новый знак: дальше Луна ${T.signs[v.nextSign].loc}.`;
  }

  function monthData(y, m) {
    const start = localMidnight(y, m, 1);
    const end = localMidnight(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1);
    const days = Math.round((end - start) / 86400000);
    const ing = AC.ingresses('moon', AC.addDays(start, -3), AC.addDays(end, 1), 0.25);
    const phases = AC.moonPhases(AC.addDays(start, -1), AC.addDays(end, 1));
    const ecl = AC.eclipses(AC.addDays(start, -2), AC.addDays(end, 1));
    let voc = [];
    try { voc = AC.voidOfCourse(start, end); } catch (e) { voc = []; }
    // лунные сутки: новолуния + восходы Луны
    const obs = new A.Observer(city.lat, city.lon, 0);
    const nms = phases.filter((p) => p.phase === 0).map((p) => p.date);
    let prevNM = A.SearchMoonPhase(0, A.MakeTime(AC.addDays(start, -31)), 31);
    while (true) { const nx = A.SearchMoonPhase(0, prevNM.AddDays(1), 31); if (nx && nx.date < start) prevNM = nx; else break; }
    const marks = [{ type: 'nm', date: prevNM.date }].concat(nms.filter((d) => d > prevNM.date).map((d) => ({ type: 'nm', date: d })));
    let t = prevNM;
    for (let i = 0; i < 70; i++) {
      const r = A.SearchRiseSet(A.Body.Moon, obs, +1, t, 3);
      if (!r || r.date > end) break;
      marks.push({ type: 'rise', date: r.date }); t = r.AddDays(0.02);
    }
    marks.sort((a, b) => a.date - b.date);
    const ldStarts = []; let n = 0;
    for (const mk of marks) { n = mk.type === 'nm' ? 1 : Math.min(30, n + 1); ldStarts.push({ n, date: mk.date }); }
    const out = [];
    for (let i = 0; i < days; i++) {
      const p = tzParts(AC.addDays(start, i + 0.5), city.tz);
      const d0 = localMidnight(p.y, p.m, p.d), d1 = localMidnight(...nextDay(p.y, p.m, p.d));
      const noon = new Date((d0.getTime() + d1.getTime()) / 2);
      const ms = AC.moonState(noon);
      const active = ldStarts.filter((x) => x.date < d0).slice(-1).concat(ldStarts.filter((x) => x.date >= d0 && x.date < d1));
      out.push({
        y: p.y, m: p.m, d: p.d, d0, d1, noon, ms,
        signStart: AC.signOf(AC.body('moon', d0).lon),
        ingress: ing.filter((x) => x.date >= d0 && x.date < d1),
        phases: phases.filter((x) => x.date >= d0 && x.date < d1),
        eclipses: ecl.filter((x) => x.date >= d0 && x.date < d1),
        voc: voc.filter((v) => v.start < d1 && v.end > d0),
        lunar: active,
      });
    }
    return { y, m, start, end, days: out, voc };
  }
  function nextDay(y, m, d) { const x = new Date(Date.UTC(y, m - 1, d + 1)); return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()]; }

  const PHASE_NAMES = ['Новолуние', 'Первая четверть', 'Полнолуние', 'Последняя четверть'];
  const PHASE_ANG = [0, 90, 180, 270];

  function renderToday() {
    const now = new Date();
    const ms = AC.moonState(now);
    const ph = T.moonPhaseNow[ms.phase8];
    let ld = null; try { ld = AC.lunarDay(now, city.lat, city.lon); } catch (e) { ld = null; }
    const ingNext = AC.ingresses('moon', now, AC.addDays(now, 3), 0.25)[0];
    let vocs = []; try { vocs = AC.voidOfCourse(AC.addDays(now, -1), AC.addDays(now, 3)); } catch (e) { vocs = []; }
    const vocNow = vocs.find((v) => v.start <= now && v.end > now);
    const vocNext = vocs.find((v) => v.start > now);
    const ldt = ld ? T.lunarDays[ld.day] : null;
    const mis = T.moonInSign[ms.sign];
    document.getElementById('today').innerHTML = `
      <div class="moon-today">
        <div class="moon-big">${UI.moonSVG(ms.angle)}</div>
        <div>
          <span class="eyebrow" style="margin-bottom:8px">Сегодня · ${fmt.date(now)}</span>
          <h2 style="margin-bottom:6px">${ph.name} <span class="muted" style="font-size:.55em;font-family:var(--ff-body)">· ${Math.round(ms.illum * 100)}%</span></h2>
          <p class="lead" style="margin-bottom:14px">${ph.tip}</p>
          <div class="row" style="gap:10px;margin-bottom:14px">
            <span class="chip"><span class="glyph" style="color:var(--lav-strong);font-size:1.1rem">${T.signs[ms.sign].glyph}</span>Луна ${T.signs[ms.sign].loc}${ingNext ? ' до ' + hm(ingNext.date) + (dayKey(ingNext.date) !== dayKey(now) ? ' (' + fmt.dateShort(ingNext.date) + ')' : '') : ''}</span>
            ${ld ? `<span class="chip"><b style="color:var(--gold)">${ld.day}</b> лунный день · ${ldt.sym}</span>` : ''}
            ${vocNow ? `<span class="chip voc-chip now">${icon('moon-off')}Луна без курса сейчас: до ${hmd(vocNow.end, now)} · ещё ${dur(vocNow.end - now)}</span>` : vocNext ? `<span class="chip voc-chip">${icon('moon-off')}Луна без курса: ${hmd(vocNext.start, now)} – ${hmd(vocNext.end, vocNext.start)} · ${dur(vocNext.end - vocNext.start)}</span>` : ''}
          </div>
          <div class="grid grid-2">
            ${ldt ? `<div><h4>${ld.day} лунные сутки — «${ldt.sym}»</h4><p class="small" style="margin-bottom:6px">${ldt.text}</p><p class="small muted" style="margin:0">Начались ${hm(ld.start)}${dayKey(ld.start) !== dayKey(now) ? ' ' + fmt.dateShort(ld.start) : ''}${ld.end ? ', продлятся до ' + hm(ld.end) + (dayKey(ld.end) !== dayKey(now) ? ' ' + fmt.dateShort(ld.end) : '') : ''}.</p></div>` : ''}
            <div><button class="btn btn-primary btn-sm" type="button" id="moonStory" style="margin-bottom:14px">${icon('sparkle')} Сторис «Луна сегодня»</button><h4>Луна ${T.signs[ms.sign].loc}</h4><p class="small" style="margin-bottom:4px"><b style="color:var(--ok)">Хорошо:</b> ${mis.good}${ldt ? ', ' + ldt.good : ''}.</p><p class="small" style="margin:0"><b style="color:var(--rose-strong)">Лучше отложить:</b> ${mis.avoid}${ldt ? ', ' + ldt.avoid : ''}.</p></div>
          </div>
          ${UI.botCta('src_site__moon', 'Получать «Луну дня» каждое утро в Telegram')}
        </div>
      </div>`;
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('#moonStory'); if (!b) return;
    b.disabled = true;
    try { const cv = await window.Cards.storyMoon(new Date(), city); await window.Cards.show(cv, 'luna-segodnya.png', 'Сторис «Луна сегодня»', 'Фаза, знак, лунные сутки и советы на день — для города ' + city.name + '.'); } catch (err) { console.error(err); UI.toast('Не получилось нарисовать карточку', 'info'); }
    b.disabled = false;
  });

  function renderMonth() {
    const { y, m } = view;
    document.getElementById('monthTitle').textContent = `${fmt.MONTHS[m - 1]} ${y}`;
    const cal = document.getElementById('cal');
    const had = !!cal.querySelector('.day');
    if (had) cal.classList.add('busy');
    else cal.innerHTML = '<div class="small muted" style="grid-column:1/-1;text-align:center;padding:40px">Считаю месяц…</div>';
    setTimeout(() => {
      data = monthData(y, m);
      const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
      const lead = (first + 6) % 7;
      const todayK = dayKey(new Date());
      let h = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => `<div class="dow">${d}</div>`).join('');
      for (let i = 0; i < lead; i++) h += '<div></div>';
      data.days.forEach((d, i) => {
        const k = `${d.y}-${d.m}-${d.d}`;
        const ev = d.eclipses.length ? (d.eclipses[0].type === 'solar' ? 'Солн. затмение' : 'Лун. затмение') : d.phases.length ? PHASE_NAMES[d.phases[0].phase] : '';
        const lds = d.lunar.map((x) => x.n);
        const vl = d.voc.map((v) => vocPart(v, d).label);
        h += `<button class="day${k === todayK ? ' today' : ''}${selected === i ? ' sel' : ''}" type="button" data-i="${i}" aria-label="${d.d} ${fmt.MONTHS_GEN[d.m - 1]}${vl.length ? ', Луна без курса ' + vl.join(' и ') : ''}">
          <span class="dn">${d.d}<span style="width:22px;height:22px;display:inline-block">${UI.moonSVG(d.ms.angle)}</span></span>
          <span class="ms">${T.signs[d.signStart].glyph}${d.ingress.length ? ` <small style="font-family:var(--ff-body);font-size:.7rem;color:var(--ink-3)">→</small> ${T.signs[d.ingress[0].to].glyph}<small style="font-family:var(--ff-body);font-size:.66rem;color:var(--ink-3)"> ${hm(d.ingress[0].date)}</small>` : ''}</span>
          <span class="ld">${lds.length ? lds.filter((v, j, a) => a.indexOf(v) === j).join('–') + ' л. д.' : ''}</span>
          ${ev ? `<span class="ev">${ev}</span>` : ''}
          ${vl.length ? `<span class="voc"><i>без курса </i>${vl.map((x) => esc(x).replace('–', '–<wbr>')).join(', ')}</span>${vocBar(d)}` : ''}
        </button>`;
      });
      cal.innerHTML = h;
      cal.classList.remove('busy');
      if (!had) UI.fadeIn(cal, 6);
      const todayIdx = data.days.findIndex((d) => `${d.y}-${d.m}-${d.d}` === todayK);
      showDay(selected != null && data.days[selected] ? selected : todayIdx >= 0 ? todayIdx : 0);
      renderVocList();
    }, 20);
  }

  function showDay(i) {
    selected = i;
    document.querySelectorAll('.cal .day').forEach((b) => b.classList.toggle('sel', +b.dataset.i === i));
    const d = data.days[i];
    const rows = [];
    for (const x of d.lunar) {
      const lt = T.lunarDays[x.n];
      rows.push(`<div class="interp-item"><div class="ig" style="font:600 1.3rem var(--ff-display);color:var(--gold)">${x.n}</div><div><h4>${x.n} лунные сутки — «${lt.sym}» <span class="muted small">${x.date >= d.d0 ? 'с ' + hm(x.date) : 'с прошлого дня'}</span></h4><p>${lt.text}</p><p class="small muted">Хорошо: ${lt.good}. Избегайте: ${lt.avoid}.</p></div></div>`);
    }
    const signs = [d.signStart].concat(d.ingress.map((x) => x.to));
    const ingTxt = d.ingress.length ? ` → ${T.signs[d.ingress[0].to].loc} с ${hm(d.ingress[0].date)}` : '';
    const mis = T.moonInSign[signs[signs.length - 1]];
    const dd = document.getElementById('dayDetail');
    dd.innerHTML = `
      <div class="row between"><h3 style="margin:0">${d.d} ${fmt.MONTHS_GEN[d.m - 1]} ${d.y}, ${fmt.DOW_LONG[new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay()]}</h3><span class="small muted">${esc(city.name)} · ${esc(city.tz)}</span></div>
      <div class="row" style="gap:10px;margin:14px 0">
        <span class="chip"><span class="glyph" style="color:var(--lav-strong);font-size:1.1rem">${T.signs[d.signStart].glyph}</span>Луна ${T.signs[d.signStart].loc}${ingTxt}</span>
        <span class="chip">освещено ${Math.round(d.ms.illum * 100)}% · ${T.moonPhaseNow[d.ms.phase8].name.toLowerCase()}</span>
        ${d.phases.map((p) => `<span class="chip" style="color:var(--gold)">${PHASE_NAMES[p.phase]} в ${hm(p.date)} · ${T.signs[AC.signOf(p.lon)].loc}</span>`).join('')}
        ${d.eclipses.map((e) => `<span class="chip" style="color:var(--rose-strong)">${e.type === 'solar' ? 'Солнечное' : 'Лунное'} затмение (${T.eclipseKind[e.kind] || e.kind}) в ${hm(e.date)}</span>`).join('')}
      </div>
      ${vocDayHTML(d)}
      <div class="grid grid-2">
        <div class="interp">${rows.join('')}</div>
        <div>
          <div class="card" style="box-shadow:none"><h4>Луна ${T.signs[signs[signs.length - 1]].loc}</h4><p class="small"><b style="color:var(--ok)">Благоприятно:</b> ${mis.good}.</p><p class="small" style="margin:0"><b style="color:var(--rose-strong)">Лучше отложить:</b> ${mis.avoid}.</p></div>
          ${d.eclipses.length ? `<div class="notice" style="margin-top:12px">${icon('sparkle')}<span>${T.eclipseMeaning[d.eclipses[0].type]}</span></div>` : ''}
        </div>
      </div>`;
    UI.fadeIn(dd, 6);
  }

  /** Блок «Луна без курса» в подробностях дня: шкала суток, точные часы, длительность, откуда период. */
  function vocDayHTML(d) {
    if (!d.voc.length) return `<div class="voc-day none">${icon('circle-check')}<span>Луны без курса в этот день нет — весь день Луна «в курсе».</span></div>`;
    const parts = d.voc.map((v) => vocPart(v, d));
    const total = parts.reduce((a, p) => a + p.ms, 0);
    const ticks = [0, 6, 12, 18, 24].map((x) => `<span style="left:${(x / 24) * 100}%">${String(x).padStart(2, '0')}:00</span>`).join('');
    return `<div class="voc-day">
      <div class="voc-day-head">${icon('moon-off')}<div><b>Луна без курса: ${parts.map((p) => p.label).join(' и ')}</b><small>в этот день — ${dur(total)} · время: ${esc(city.name)}</small></div></div>
      <div class="voc-scale">${vocBar(d, 'voc-track')}<div class="voc-ticks" aria-hidden="true">${ticks}</div></div>
      ${d.voc.map((v) => { const inDay = v.start >= d.d0 && v.end <= d.d1; return `<div class="voc-item">${inDay ? '' : `<b>Весь период: ${hmd(v.start, d.noon)} – ${hmd(v.end, d.noon)}</b> <span class="muted">· ${dur(v.end - v.start)}</span>`}<p class="small muted">${vocWhy(v)}</p></div>`; }).join('')}
      <p class="small voc-tip">${icon('info')}<span>В эти часы лучше не начинать важное — подписание, покупки, старт проекта. Хорошо отдыхать, завершать начатое, наводить порядок и планировать.</span></p>
    </div>`;
  }

  /** Все периоды Луны без курса за месяц — списком, с точными часами. */
  function renderVocList() {
    const box = document.getElementById('vocList');
    if (!box || !data) return;
    const now = new Date();
    const list = data.voc.filter((v) => v.end > data.start && v.start < data.end);
    const dayIdx = (t) => data.days.findIndex((d) => t >= d.d0 && t < d.d1);
    box.innerHTML = `<div class="row between" style="margin-bottom:10px"><h3 style="margin:0">Луна без курса — ${fmt.MONTHS[data.m - 1].toLowerCase()} ${data.y}</h3><span class="small muted">${esc(city.name)} · ${esc(city.tz)}</span></div>
      <p class="small muted" style="margin:0 0 14px">Все периоды месяца с точным временем начала и конца. Нажмите на строку — откроется этот день.</p>
      <div class="voc-list">${list.map((v) => {
        const st = now >= v.end ? 'past' : now >= v.start ? 'now' : '';
        const i = Math.max(0, dayIdx(v.start < data.start ? data.start : v.start));
        const s = tzParts(v.start, city.tz), e = tzParts(v.end, city.tz);
        const same = dayKey(v.start) === dayKey(v.end);
        return `<button type="button" class="voc-row ${st}" data-day="${i}">
          <span class="vd">${same ? `${s.d} ${fmt.MONTHS_SHORT[s.m - 1]}` : s.m === e.m ? `${s.d}–${e.d} ${fmt.MONTHS_SHORT[s.m - 1]}` : `${s.d} ${fmt.MONTHS_SHORT[s.m - 1]} – ${e.d} ${fmt.MONTHS_SHORT[e.m - 1]}`}</span>
          <span class="vt"><b>${hm(v.start)} – ${hm(v.end)}</b><small>${dur(v.end - v.start)}${st === 'now' ? ' · <em>сейчас</em>' : ''}</small></span>
          <span class="vs glyph" title="Луна ${T.signs[v.sign].loc} → ${T.signs[v.nextSign].loc}">${T.signs[v.sign].glyph} → ${T.signs[v.nextSign].glyph}</span>
        </button>`;
      }).join('') || '<p class="small muted">В этом месяце периодов нет.</p>'}</div>`;
  }

  function setCity(c) {
    city = c; UI.store.set('moonCity', c);
    document.getElementById('tzNote').textContent = `Время указано для часового пояса ${c.tz}`;
    renderToday(); renderMonth();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sel = document.getElementById('citySel');
    sel.innerHTML = UI.CITIES.map((c, i) => `<option value="${i}">${esc(c.name)}</option>`).join('');
    const idx = UI.CITIES.findIndex((c) => c.name === city.name);
    sel.value = idx >= 0 ? idx : 0;
    sel.addEventListener('change', () => { selected = null; setCity(UI.CITIES[+sel.value]); });
    const now = tzParts(new Date(), city.tz);
    view = { y: now.y, m: now.m };
    document.getElementById('prevM').addEventListener('click', () => { selected = null; view.m--; if (view.m < 1) { view.m = 12; view.y--; } renderMonth(); });
    document.getElementById('nextM').addEventListener('click', () => { selected = null; view.m++; if (view.m > 12) { view.m = 1; view.y++; } renderMonth(); });
    document.getElementById('cal').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) showDay(+b.dataset.i); });
    document.getElementById('vocList').addEventListener('click', (e) => {
      const r = e.target.closest('[data-day]'); if (!r) return;
      showDay(+r.dataset.day);
      const dd = document.getElementById('dayDetail');
      if (dd.scrollIntoView) dd.scrollIntoView({ behavior: UI.reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    });
    setCity(city);
  });
})();
