/* Гороскоп по знаку: солнечные дома для Луны (день) и Солнца/Венеры/Марса (месяц). */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI, SITE = window.SITE;
  const { esc, fmt, icon } = UI;
  let sign = null, mode = 'today';

  const solarHouse = (lon, si) => ((AC.signIndex(lon) - si + 12) % 12) + 1;
  const stars = (n) => '<span style="color:var(--gold);letter-spacing:2px">' + '★'.repeat(n) + '<span style="opacity:.25">' + '★'.repeat(5 - n) + '</span></span>';
  // гармония знаков по углу между ними
  const HARM = [5, 3, 4, 2, 5, 3, 3, 3, 5, 2, 4, 3];
  const harm = (a, b) => HARM[(a - b + 12) % 12];

  function dayBlock(date, si) {
    const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    const moon = AC.body('moon', noon), venus = AC.body('venus', noon), mars = AC.body('mars', noon), mercury = AC.body('mercury', noon);
    const mh = solarHouse(moon.lon, si);
    const ms = AC.moonState(noon);
    const mSign = AC.signIndex(moon.lon);
    const ingr = AC.ingresses('moon', new Date(noon.getTime() - 12 * 3600000), new Date(noon.getTime() + 12 * 3600000), 0.25)[0];
    const mood = harm(mSign, si), love = Math.max(1, Math.min(5, Math.round((harm(AC.signIndex(venus.lon), si) + harm(mSign, si)) / 2))), work = Math.max(1, Math.min(5, Math.round((harm(AC.signIndex(mars.lon), si) + harm(AC.signIndex(mercury.lon), si)) / 2) - (mercury.retro ? 1 : 0)));
    const p8 = T.moonPhaseNow[ms.phase8];
    return `
      <div class="grid grid-3" style="margin-bottom:18px">
        <div class="card" style="box-shadow:none;padding:16px"><div class="tiny muted">Настроение</div>${stars(mood)}</div>
        <div class="card" style="box-shadow:none;padding:16px"><div class="tiny muted">Любовь</div>${stars(love)}</div>
        <div class="card" style="box-shadow:none;padding:16px"><div class="tiny muted">Дела</div>${stars(work)}</div>
      </div>
      <div class="horo-block"><h4><span class="gl">☽&#xFE0E;</span> Луна ${T.signs[AC.signOf(moon.lon)].loc} — ваш ${CVroman(mh)} солнечный дом</h4><p>${T.moonSolarHouse[mh]}</p>${ingr ? `<p class="small muted">В ${fmt.time(ingr.date)} Луна переходит в знак ${T.signs[ingr.to].gen} — фокус сместится: ${T.moonSolarHouse[solarHouse(AC.SIGNS.indexOf(ingr.to) * 30 + 1, si)].split('.')[0].toLowerCase()}.</p>` : ''}</div>
      <div class="horo-block"><h4><span class="gl">◐</span> ${p8.name}</h4><p>${p8.tip}</p></div>
      ${mercury.retro ? `<div class="horo-block"><h4><span class="gl">☿&#xFE0E;</span> Меркурий ретрограден</h4><p>${T.retroMeaning.mercury}</p></div>` : ''}
      ${venus.retro ? `<div class="horo-block"><h4><span class="gl">♀&#xFE0E;</span> Венера ретроградна</h4><p>${T.retroMeaning.venus}</p></div>` : ''}`;
  }

  function CVroman(n) { return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][n - 1]; }

  function monthBlock(si) {
    const now = new Date();
    const m0 = new Date(now.getFullYear(), now.getMonth(), 1), m1 = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const mid = new Date(now.getFullYear(), now.getMonth(), 15, 12);
    const sun = AC.body('sun', mid), venus = AC.body('venus', mid), mars = AC.body('mars', mid);
    const sh = solarHouse(sun.lon, si), vh = solarHouse(venus.lon, si), mh = solarHouse(mars.lon, si);
    const lun = AC.moonPhases(m0, m1).filter((p) => p.phase === 0 || p.phase === 2);
    const ecl = AC.eclipses(m0, m1);
    const retro = AC.retrogradePeriods(['mercury', 'venus', 'mars'], m0, m1);
    const sunIng = AC.ingresses('sun', m0, m1)[0];
    return `
      <div class="horo-block"><h4><span class="gl">☉&#xFE0E;</span> Главная тема месяца — ${T.houses[sh].title.toLowerCase()}</h4><p>${T.sunSolarHouse[sh]}</p>${sunIng ? `<p class="small muted">С ${fmt.dm(sunIng.date)} Солнце ${T.signs[sunIng.to].loc}: ${T.sunSolarHouse[solarHouse(AC.SIGNS.indexOf(sunIng.to) * 30 + 1, si)].split(':')[0].toLowerCase()}.</p>` : ''}</div>
      <div class="horo-block"><h4><span class="gl">♀&#xFE0E;</span> Любовь и деньги</h4><p>${T.fill(T.venusSolarHouse, { n: CVroman(vh), topic: T.houses[vh].topic })}${venus.retro ? ' Венера ретроградна — хорошо возвращаться к старым чувствам и пересматривать траты, а не начинать новое.' : ''}</p></div>
      <div class="horo-block"><h4><span class="gl">♂&#xFE0E;</span> Энергия и действия</h4><p>${T.fill(T.marsSolarHouse, { n: CVroman(mh), topic: T.houses[mh].topic })}</p></div>
      ${lun.length ? `<div class="horo-block"><h4><span class="gl">●</span> Новолуния и полнолуния</h4>${lun.map((p) => { const h = solarHouse(p.lon, si); return `<p><b>${fmt.dm(p.date)} — ${p.phase === 0 ? 'новолуние' : 'полнолуние'} ${T.signs[AC.signOf(p.lon)].loc}</b> в вашем ${CVroman(h)} доме: ${p.phase === 0 ? 'хорошее время начать новое в сфере' : 'кульминация и итоги в сфере'} «${T.houses[h].topic}».</p>`; }).join('')}</div>` : ''}
      ${ecl.length ? `<div class="horo-block"><h4><span class="gl">◑</span> Затмения</h4>${ecl.map((e) => `<p><b>${fmt.dm(e.date)}</b> — ${e.type === 'solar' ? 'солнечное' : 'лунное'} затмение в вашем ${CVroman(solarHouse(e.lon, si))} доме («${T.houses[solarHouse(e.lon, si)].topic}»). ${T.eclipseMeaning[e.type]}</p>`).join('')}</div>` : ''}
      ${retro.length ? `<div class="horo-block"><h4><span class="gl">℞</span> Ретроградные периоды</h4>${retro.map((r) => `<p><b>${T.planets[r.id].name}: ${fmt.dm(r.start)} — ${fmt.dm(r.end)}.</b> ${T.retroMeaning[r.id]}</p>`).join('')}</div>` : ''}`;
  }

  function render() {
    const si = AC.SIGNS.indexOf(sign);
    const s = T.signs[sign];
    const note = SITE.weeklyNotes && SITE.weeklyNotes[sign];
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    document.getElementById('horo').innerHTML = `
      <div class="row between" style="align-items:flex-start">
        <div class="row" style="gap:16px;flex-wrap:nowrap"><span class="glyph" style="font-size:3.4rem;color:var(--lav-strong);line-height:1">${s.glyph}</span><div><h2 style="margin:0">${s.name}</h2><p class="muted small" style="margin:2px 0 0">${s.dates} · ${T.elements[AC.elementOf(si)].name} · управитель ${T.planets[AC.RULER[sign]].name}</p></div></div>
        <div class="seg" role="group" aria-label="Период">${[['today', 'Сегодня'], ['tomorrow', 'Завтра'], ['month', 'Месяц']].map(([k, t]) => `<button type="button" data-mode="${k}" aria-pressed="${mode === k}">${t}</button>`).join('')}</div>
      </div>
      <p class="muted" style="margin:14px 0 6px">${s.about}</p>
      ${note ? `<div class="notice" style="margin:14px 0">${icon('heart')}<span><b>Алина${SITE.weeklyNotes.week ? ' · ' + esc(SITE.weeklyNotes.week) : ''}:</b> ${esc(note)}</span></div>` : ''}
      <div class="tab-panel" style="margin-top:12px">
        <h3 style="margin-top:8px">${mode === 'month' ? fmt.MONTHS[now.getMonth()] + ' ' + now.getFullYear() : mode === 'today' ? 'Сегодня, ' + fmt.dm(now) : 'Завтра, ' + fmt.dm(tomorrow)}</h3>
        ${mode === 'month' ? monthBlock(si) : dayBlock(mode === 'today' ? now : tomorrow, si)}
      </div>
      ${UI.botCta('src_site__horo_' + sign, 'Получать гороскоп для знака «' + s.name + '» каждое утро в Telegram')}`;
    document.querySelectorAll('#picker .sign-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sign === sign)));
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('picker').innerHTML = AC.SIGNS.map((id) => `<button class="sign-btn" type="button" data-sign="${id}" aria-pressed="false"><span class="g">${T.signs[id].glyph}</span><span class="n">${T.signs[id].name}</span><span class="d">${T.signs[id].dates.replace(/ — /, '–').replace(/(\d+) (\S+)–(\d+) (\S+)/, '$1 $2 – $3 $4').replace(/января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря/g, (m) => fmt.MONTHS_SHORT[fmt.MONTHS_GEN.indexOf(m)])}</span></button>`).join('');
    const hash = location.hash.slice(1);
    const r = UI.recent.list()[0];
    sign = AC.SIGNS.includes(hash) ? hash : UI.store.get('horoSign', null) || (r ? AC.signOf(AC.chart(r).byId.sun.lon) : 'aries');
    document.getElementById('picker').addEventListener('click', (e) => { const b = e.target.closest('[data-sign]'); if (!b) return; sign = b.dataset.sign; UI.store.set('horoSign', sign); history.replaceState(null, '', '#' + sign); render(); UI.fadeIn(document.getElementById('horo')); document.getElementById('horo').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    document.getElementById('horo').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (!b) return; mode = b.dataset.mode; render(); });
    render();
  });
})();
