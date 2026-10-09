/* Гороскоп по знаку: солнечные дома для Луны (день) и Солнца/Венеры/Марса (месяц). */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI, SITE = window.SITE;
  const { esc, fmt, icon } = UI;
  let sign = null, mode = 'today';

  const { dayBlock, monthBlock } = window.HoroscopeCore;

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

  /** Выбрали знак (кнопкой или из «Моих карт»): короткое «волшебство» — знак доворачивается наверх круга, — потом гороскоп. */
  async function pick(s, scroll) {
    sign = s; UI.store.set('horoSign', sign); history.replaceState(null, '', '#' + sign);
    document.querySelectorAll('#picker .sign-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sign === sign)));
    const box = document.getElementById('horo');
    if (scroll) box.scrollIntoView({ behavior: UI.reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    if (!(await UI.conjure(box, { kind: 'horo', sign: AC.SIGNS.indexOf(s) }))) return;
    render(); UI.fadeIn(box);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('picker').innerHTML = AC.SIGNS.map((id) => `<button class="sign-btn" type="button" data-sign="${id}" aria-pressed="false"><span class="g">${T.signs[id].glyph}</span><span class="n">${T.signs[id].name}</span><span class="d">${T.signs[id].dates.replace(/ — /, '–').replace(/(\d+) (\S+)–(\d+) (\S+)/, '$1 $2 – $3 $4').replace(/января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря/g, (m) => fmt.MONTHS_SHORT[fmt.MONTHS_GEN.indexOf(m)])}</span></button>`).join('');
    const hash = location.hash.slice(1);
    const r = UI.recent.list()[0];
    sign = AC.SIGNS.includes(hash) ? hash : UI.store.get('horoSign', null) || (r ? AC.signOf(AC.chart(r).byId.sun.lon) : 'aries');
    // «Мои карты»: знак Солнца каждого сохранённого человека — одним нажатием
    const ppBox = document.getElementById('horoPeople');
    if (ppBox) {
      const sunOf = (it) => { try { return AC.signOf(AC.body('sun', AC.localToUTC(it.p.y, it.p.mo, it.p.d, it.p.timeKnown === false ? 12 : it.p.h, it.p.timeKnown === false ? 0 : it.p.mi, it.p.zone).date).lon); } catch (e) { return null; } };
      UI.peopleChips(ppBox, (it) => { const s = sunOf(it); if (s) pick(s, false); }, { label: 'Знаки моих людей', max: 6, sub: (it) => { const s = sunOf(it); return s ? T.signs[s].name : ''; } });
    }
    document.getElementById('picker').addEventListener('click', (e) => { const b = e.target.closest('[data-sign]'); if (b) pick(b.dataset.sign, true); });
    document.getElementById('horo').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (!b) return; mode = b.dataset.mode; render(); });
    render();
  });
})();
