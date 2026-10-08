/* Астрособытия года: планеты сейчас, ретро (диаграмма), затмения, лунации, ингрессии. */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI;
  const { esc, fmt } = UI;
  let year = new Date().getFullYear();
  const RETRO = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron'];

  function nowTable() {
    const now = new Date();
    const sky = AC.sky(now);
    const ids = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'node', 'chiron', 'lilith'];
    const rows = ids.map((id) => sky.byId[id]).filter(Boolean).map((p) => `<tr><td><span class="g glyph">${T.planets[p.id].glyph}</span> ${T.planets[p.id].name}</td><td>${AC.fmtDeg(p.lon)} <span class="glyph" style="color:var(--gold)">${T.signs[p.sign].glyph}</span> ${T.signs[p.sign].name}</td><td>${p.retro ? '<span class="badge rose">ретроградный</span>' : p.id === 'node' || p.id === 'lilith' ? '' : '<span class="badge ok">директный</span>'}</td><td>${p.dignity ? `<span class="badge ${p.dignity === 'domicile' || p.dignity === 'exaltation' ? 'ok' : 'warn'}">${T.dignity[p.dignity]}</span>` : ''}</td></tr>`).join('');
    document.getElementById('nowTable').innerHTML = `<p class="small muted">На ${fmt.dateTime(now)}</p><div class="table-wrap"><table class="table"><thead><tr><th>Планета</th><th>Положение</th><th>Движение</th><th>Статус</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function gantt(periods, y0, y1) {
    const span = y1 - y0;
    const pct = (d) => Math.max(0, Math.min(100, ((d - y0) / span) * 100));
    const now = new Date();
    let h = '<div class="gantt"><div></div><div class="months">' + fmt.MONTHS_SHORT.map((m) => `<span>${m}</span>`).join('') + '</div>';
    for (const id of RETRO) {
      const ps = periods.filter((p) => p.id === id);
      h += `<div class="gl"><span class="g">${T.planets[id].glyph}</span>${T.planets[id].name}</div><div class="track">`;
      for (const p of ps) {
        if (p.shadowStart && p.shadowEnd) h += `<span class="seg-s" style="left:${pct(p.shadowStart)}%;width:${pct(p.shadowEnd) - pct(p.shadowStart)}%" title="Тень: ${fmt.dm(p.shadowStart)} — ${fmt.dm(p.shadowEnd)}"></span>`;
        h += `<span class="seg-r" style="left:${pct(p.start)}%;width:${Math.max(0.6, pct(p.end) - pct(p.start))}%" title="${T.planets[id].name} ретрограден: ${fmt.date(p.start)} — ${fmt.date(p.end)}"></span>`;
      }
      if (now >= y0 && now < y1) h += `<span class="today-line" style="left:${pct(now)}%"></span>`;
      h += '</div>';
    }
    return h + '</div>';
  }

  function render() {
    document.getElementById('yearTitle').textContent = year;
    const y0 = new Date(year, 0, 1), y1 = new Date(year + 1, 0, 1);
    const periods = AC.retrogradePeriods(RETRO, y0, y1);
    document.getElementById('gantt').innerHTML = gantt(periods, y0, y1);
    document.getElementById('retroList').innerHTML = periods.filter((p) => ['mercury', 'venus', 'mars'].includes(p.id) || p.id === 'jupiter' || p.id === 'saturn').map((p) => `
      <article class="interp-item"><div class="ig glyph">${T.planets[p.id].glyph}</div><div>
        <h4>${T.planets[p.id].name}: ${fmt.date(p.start)} — ${fmt.date(p.end)}</h4>
        <div class="tags"><span class="badge rose">${T.signs[AC.signOf(p.lonStart)].name} ${AC.fmtDeg(p.lonStart)} → ${T.signs[AC.signOf(p.lonEnd)].name} ${AC.fmtDeg(p.lonEnd)}</span>${p.shadowStart ? `<span class="badge">тень: ${fmt.dm(p.shadowStart)} — ${p.shadowEnd ? fmt.dm(p.shadowEnd) : '…'}</span>` : ''}</div>
        <p>${T.retroMeaning[p.id] || ''}</p></div></article>`).join('');

    const now = new Date();
    document.getElementById('eclipses').innerHTML = AC.eclipses(y0, y1).map((e) => `
      <div class="event${e.date < now ? ' past' : ''}"><div class="d">${fmt.dateShort(e.date)}<small>${fmt.time(e.date)}</small></div>
      <div class="i glyph" style="color:${e.type === 'solar' ? 'var(--gold)' : 'var(--lav-strong)'}">${e.type === 'solar' ? '☉&#xFE0E;' : '☽&#xFE0E;'}</div>
      <div class="t"><b>${e.type === 'solar' ? 'Солнечное' : 'Лунное'} затмение, ${T.eclipseKind[e.kind] || e.kind}</b><span class="small muted">${AC.fmtDeg(e.lon)} ${T.signs[AC.signOf(e.lon)].name}</span></div></div>`).join('')
      + `<p class="small muted" style="margin-top:12px">${T.eclipseMeaning.solar}</p><p class="small muted">${T.eclipseMeaning.lunar}</p>`;

    document.getElementById('lunations').innerHTML = AC.moonPhases(y0, y1).filter((p) => p.phase === 0 || p.phase === 2).map((p) => `
      <div class="event${p.date < now ? ' past' : ''}"><div class="d">${fmt.dateShort(p.date)}<small>${fmt.time(p.date)}</small></div>
      <div class="i">${UI.moonSVG(p.phase === 0 ? 0 : 180)}</div>
      <div class="t"><b>${p.phase === 0 ? 'Новолуние' : 'Полнолуние'} ${T.signs[AC.signOf(p.lon)].loc}</b><span class="small muted">${AC.fmtDeg(p.lon)} · ${p.phase === 0 ? 'время намерений и начинаний' : 'кульминация, итоги, эмоции'}</span></div></div>`).join('');

    const ing = [];
    for (const id of ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) ing.push(...AC.ingresses(id, y0, y1));
    ing.sort((a, b) => a.date - b.date);
    document.getElementById('ingresses').innerHTML = ing.map((x) => `
      <div class="event${x.date < now ? ' past' : ''}"><div class="d">${fmt.dateShort(x.date)}<small>${fmt.time(x.date)}</small></div>
      <div class="i glyph">${T.planets[x.id].glyph}</div>
      <div class="t"><b>${T.planets[x.id].name} ${x.retro ? 'возвращается' : 'входит'} ${T.signs[x.to].loc.replace(/^в(о)? /, 'в$1 ')}</b><span class="small muted">${x.retro ? 'попятное движение · ' : ''}${T.signs[x.to].keys}</span></div></div>`).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    nowTable();
    document.getElementById('prevY').addEventListener('click', () => { year--; render(); });
    document.getElementById('nextY').addEventListener('click', () => { year++; render(); });
    setTimeout(render, 20);
  });
})();
