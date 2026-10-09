/* Движок гороскопа по знаку (солнечные дома): день — по Луне, месяц — по Солнцу, Венере и Марсу.
   Общий для страницы «Гороскоп» (js/pages/horoscope.js) и карточки клиента в кабинете. */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI;
  const { fmt } = UI;
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

  window.HoroscopeCore = { dayBlock, monthBlock, solarHouse };
})();
