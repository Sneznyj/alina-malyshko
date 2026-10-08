/* Натальная карта: форма → расчёт → колесо, толкование, аспекты, баланс, таблицы. */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI, CV = window.ChartView, W = window.Wheel;
  const { esc, fmt, icon } = UI;
  let form, current = null, params = null;

  function header(c, p) {
    const off = c.offset / 60;
    const tzStr = typeof p.zone === 'string' ? `${p.zone}, UTC${off >= 0 ? '+' : '−'}${Math.abs(off)}` : `UTC${off >= 0 ? '+' : '−'}${Math.abs(off)}`;
    return `
      <div class="result-head">
        <div>
          <span class="eyebrow" style="margin-bottom:8px">Натальная карта</span>
          <h2>${esc(p.name || 'Ваша карта')}</h2>
          <p class="muted small" style="margin:6px 0 0">${fmt.birth(p)} · ${esc(p.place)} · ${UI.fmtCoord(p.lat, p.lon)} · ${tzStr}</p>
        </div>
        <div class="row no-print">
          <button class="btn btn-primary btn-sm" type="button" data-act="story">${icon('sparkle')} Сторис</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="png">${icon('download')} PNG</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="print">${icon('print')} Печать / PDF</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="save">${icon('user')} В кабинет</button>
        </div>
      </div>
      ${!c.timeKnown ? `<div class="notice" style="margin-bottom:16px">${icon('clock')}<span>Время рождения не указано: карта построена на полдень. Асцендент и дома не рассчитаны, положение Луны может отличаться до 6–7°.</span></div>` : ''}
      ${c.houses && c.houses.fallback ? `<div class="notice" style="margin-bottom:16px">${icon('info')}<span>Место рождения за полярным кругом: дома рассчитаны по системе Порфирия.</span></div>` : ''}`;
  }

  function render() {
    const c = current, p = params;
    const box = document.getElementById('result');
    const tabs = [['tab-wheel', 'Карта'], ['tab-interp', 'Толкование'], ['tab-aspects', 'Аспекты'], ['tab-balance', 'Баланс'], ['tab-data', 'Положения']];
    box.innerHTML = `
      <div class="card">
        ${header(c, p)}
        <div class="tabs no-print" role="tablist" aria-label="Разделы карты">${tabs.map(([id, t], i) => `<button role="tab" id="${id}-btn" aria-controls="${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t}</button>`).join('')}</div>
        <div style="margin-top:22px">
          <div class="tab-panel" role="tabpanel" id="tab-wheel" aria-labelledby="tab-wheel-btn">
            <div class="wheel-box" id="wheelBox">${W.svg(c, { minor: UI.settings.minor })}</div>
            ${CV.legend()}
            <div style="margin-top:26px">${CV.big3(c)}</div>
            ${keySummary(c)}
          </div>
          <div class="tab-panel" role="tabpanel" id="tab-interp" aria-labelledby="tab-interp-btn" hidden>${CV.interpretation(c)}</div>
          <div class="tab-panel" role="tabpanel" id="tab-aspects" aria-labelledby="tab-aspects-btn" hidden>
            <p class="muted small">Аспекты — угловые расстояния между планетами. Гармоничные (трин, секстиль) дают лёгкость, напряжённые (квадрат, оппозиция) — внутренний вызов и рост.</p>
            ${CV.aspectGrid(c)}
            <div style="margin-top:20px">${CV.aspectList(c)}</div>
          </div>
          <div class="tab-panel" role="tabpanel" id="tab-balance" aria-labelledby="tab-balance-btn" hidden>${CV.balance(c)}</div>
          <div class="tab-panel" role="tabpanel" id="tab-data" aria-labelledby="tab-data-btn" hidden>
            <h4>Планеты и точки</h4>${CV.planetTable(c)}
            <h4 style="margin-top:22px">Куспиды домов</h4>${CV.housesTable(c)}
          </div>
        </div>
      </div>
      <div class="card note-card reveal" style="margin-top:20px">${UI.alinaNote('Это автоматический разбор — он описывает каждую часть карты по отдельности. На консультации я соберу их в цельную картину именно про вас и отвечу на ваши вопросы.', '<button class="btn btn-primary btn-sm" type="button" data-book="natal">Записаться на разбор</button>' + (UI.promoInfo() ? ' <span class="sticker sm">−' + UI.promoInfo().percent + '%</span>' : ''))}</div>`;
    UI.tabs(box);
    W.attach(document.getElementById('wheelBox'));
    box.querySelector('[role=tablist]').addEventListener('tabchange', (e) => { if (e.detail === 'tab-balance') CV.animateBars(box); UI.reveal(box); });
    box.querySelector('.result-head').addEventListener('click', onAction);
    UI.reveal(box);
  }

  function keySummary(c) {
    const s = c.summary;
    const dom = s.dominant[0];
    const el = T.elements[s.topElement];
    return `<div class="grid grid-3" style="margin-top:14px">
      <div class="card"><div class="tiny muted" style="letter-spacing:.14em;text-transform:uppercase;font-weight:700">Стихия</div><div style="font:600 1.35rem var(--ff-display);margin:4px 0">${el.name} · ${s.elements[s.topElement]}%</div><p class="small muted" style="margin:0">${el.high.split(':')[1] ? el.high.split(':')[1].trim().split('.')[0] + '.' : ''}</p></div>
      <div class="card"><div class="tiny muted" style="letter-spacing:.14em;text-transform:uppercase;font-weight:700">Сильнейшая планета</div><div style="font:600 1.35rem var(--ff-display);margin:4px 0"><span class="glyph" style="color:var(--lav-strong)">${T.planets[dom].glyph}</span> ${T.planets[dom].name}</div><p class="small muted" style="margin:0">${T.planets[dom].keys}</p></div>
      <div class="card"><div class="tiny muted" style="letter-spacing:.14em;text-transform:uppercase;font-weight:700">Луна при рождении</div><div style="font:600 1.35rem var(--ff-display);margin:4px 0">${T.moonPhase8[s.moonPhase].name}</div><p class="small muted" style="margin:0">${s.retro.length ? 'Ретроградных планет: ' + s.retro.length : 'Без ретроградных планет'}</p></div>
    </div>`;
  }

  async function onAction(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'story') {
      b.disabled = true;
      try { const cv = await window.Cards.storyNatal(current, params, { showName: !!params.name }); await window.Cards.show(cv, 'moya-natalnaya-karta.png', 'Карточка для сторис', 'Только знаки и колесо карты — без даты, времени и места рождения.'); } catch (e) { console.error(e); UI.toast('Не получилось нарисовать карточку', 'info'); }
      b.disabled = false; return;
    }
    if (act === 'png') W.exportPNG(current, { minor: UI.settings.minor, caption: `${params.name || 'Натальная карта'} · ${fmt.birth(params)} · ${params.place}` }, `natal-${(params.name || 'chart').replace(/\s+/g, '_')}.png`);
    if (act === 'print') { document.querySelectorAll('.tab-panel').forEach((p) => { p.dataset.wasHidden = p.hidden; }); window.print(); }
    if (act === 'save') {
      const exists = UI.clients.all().find((x) => x.birth && x.birth.y === params.y && x.birth.mo === params.mo && x.birth.d === params.d && x.name === params.name);
      if (exists) { UI.toast('Этот человек уже есть в кабинете', 'user'); return; }
      UI.clients.add({ name: params.name || 'Без имени', contact: '', tags: [], notes: '', birth: Object.assign({}, params) });
      UI.toast('Сохранено в кабинет астролога', 'check');
    }
  }

  function calc(p) {
    params = p || form.get();
    if (!params) return;
    try {
      current = AC.chart(params, CV.chartOpts());
    } catch (err) {
      console.error(err); UI.toast('Не получилось рассчитать карту — проверьте данные', 'info'); return;
    }
    UI.recent.add(params);
    renderRecent();
    render();
    if (window.innerWidth < 1000) document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderRecent() {
    const list = UI.recent.list();
    const box = document.getElementById('recentBox');
    box.hidden = !list.length;
    document.getElementById('recentList').innerHTML = list.map((p, i) => `<button type="button" data-i="${i}"><span>${esc(p.name || 'Без имени')}</span><small>${p.d}.${String(p.mo).padStart(2, '0')}.${p.y}</small></button>`).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    form = UI.birthForm(document.getElementById('birthForm'));
    document.getElementById('settingsBox').appendChild(CV.settingsForm(() => { if (params) calc(params); }));
    document.getElementById('calcBtn').addEventListener('click', () => calc());
    document.getElementById('birthForm').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input:not([role=combobox])')) calc(); });
    document.getElementById('recentList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      const p = UI.recent.list()[+b.dataset.i]; form.set(p); calc(p);
    });
    renderRecent();
    document.addEventListener('themechange', () => { if (current) { const wb = document.getElementById('wheelBox'); if (wb) { wb.innerHTML = W.svg(current, { minor: UI.settings.minor, animate: false }); W.attach(wb); } } });
    // открыть клиента из кабинета
    const q = new URLSearchParams(location.search);
    const cid = q.get('client');
    if (cid) { const c = UI.clients.get(cid); if (c && c.birth) { form.set(c.birth); calc(c.birth); } }
    if (q.get('now')) {
      // карта момента: текущее время, город — из лунного календаря или Москва
      const city = UI.defaultCity();
      const d = new Date();
      const p = { name: 'Карта момента', y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), timeKnown: true, lat: city.lat, lon: city.lon, zone: Intl.DateTimeFormat().resolvedOptions().timeZone || city.tz, place: city.name };
      form.set(p); calc(p);
    }
  });
})();
