/* Натальная карта: форма → расчёт → колесо, толкование, аспекты, баланс, таблицы.
   Бесплатно: колесо, большая тройка, планеты в знаках, баланс, таблицы и сетка аспектов.
   Премиум (js/premium.js → зашифрованный _private/natal-pro.js): планеты в домах, управитель карты, кармические точки,
   призвание (MC), ключевые аспекты и толкование всех аспектов. Без доступа на их месте — закрытые карточки и тарифы. */
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
          <button class="btn btn-ghost btn-sm" type="button" data-act="link" title="Скопировать ссылку: по ней эта карта откроется на любом устройстве">${icon('link')} Ссылка</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="png">${icon('download')} PNG</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="print">${icon('print')} Печать / PDF</button>
          ${p.personId ? `<a class="btn btn-ghost btn-sm" href="astro.html#p=${encodeURIComponent(p.personId)}" title="Открыть в астропроцессоре: прогноз, числа, гороскоп, совместимость">${icon('address-book')} Мои карты</a>` : ''}
          ${UI.isAlina() ? `<button class="btn btn-ghost btn-sm" type="button" data-act="save">${icon('user')} В кабинет</button>` : ''}
        </div>
      </div>
      ${!c.timeKnown ? `<div class="notice" style="margin-bottom:16px">${icon('clock')}<span>Время рождения не указано: карта построена на полдень. Асцендент и дома не рассчитаны, положение Луны может отличаться до 6–7°.</span></div>` : ''}
      ${c.houses && c.houses.fallback ? `<div class="notice" style="margin-bottom:16px">${icon('info')}<span>Место рождения за полярным кругом: дома рассчитаны по системе Порфирия.</span></div>` : ''}`;
  }

  function render() {
    const c = current, p = params;
    const moment = !!p.moment;
    const box = document.getElementById('result');
    const tabs = [['tab-wheel', 'Карта'], ['tab-interp', 'Толкование'], ['tab-aspects', 'Аспекты'], ['tab-balance', 'Баланс'], ['tab-data', 'Положения'], ['tab-pro', 'Профи']];
    box.innerHTML = `
      <div class="card">
        ${header(c, p)}
        <div class="tabs no-print" role="tablist" aria-label="Разделы карты">${tabs.map(([id, t], i) => `<button role="tab" id="${id}-btn" aria-controls="${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t}</button>`).join('')}</div>
        <div style="margin-top:22px">
          <div class="tab-panel" role="tabpanel" id="tab-wheel" aria-labelledby="tab-wheel-btn">
            ${moment ? '<div id="horaryBox" style="margin-bottom:18px"></div>' : ''}
            <div class="wheel-box" id="wheelBox">${W.svg(c, { minor: UI.settings.minor })}</div>
            ${CV.legend()}
            <p class="tiny muted center no-print" style="margin:6px 0 0">Наведите на линию аспекта, планету или номер дома — появится подсказка; нажмите — откроется толкование.</p>
            <div style="margin-top:26px">${CV.big3(c)}</div>
            ${keySummary(c)}
          </div>
          <div class="tab-panel" role="tabpanel" id="tab-interp" aria-labelledby="tab-interp-btn" hidden>${CV.interpretation(c)}<div id="natalMore">${moreTeaser(c)}</div></div>
          <div class="tab-panel" role="tabpanel" id="tab-aspects" aria-labelledby="tab-aspects-btn" hidden>
            <p class="muted small">Аспекты — угловые расстояния между планетами. Гармоничные (трин, секстиль) дают лёгкость, напряжённые (квадрат, оппозиция) — внутренний вызов и рост.</p>
            ${CV.aspectGrid(c)}
            <div style="margin-top:20px">${CV.aspectList(c)}</div>
            <div id="aspMore">${aspTeaser(c)}</div>
          </div>
          <div class="tab-panel" role="tabpanel" id="tab-balance" aria-labelledby="tab-balance-btn" hidden>${CV.balance(c)}</div>
          <div class="tab-panel" role="tabpanel" id="tab-data" aria-labelledby="tab-data-btn" hidden>
            <h4>Планеты и точки</h4>${CV.planetTable(c)}
            <h4 style="margin-top:22px">Куспиды домов</h4>${CV.housesTable(c)}
          </div>
          <div class="tab-panel" role="tabpanel" id="tab-pro" aria-labelledby="tab-pro-btn" hidden><div id="proBox"></div></div>
        </div>
      </div>
      <div class="card note-card reveal" style="margin-top:20px">${UI.alinaNote('Это автоматический разбор — он описывает каждую часть карты по отдельности. На консультации я соберу их в цельную картину именно про вас и отвечу на ваши вопросы.', '<button class="btn btn-primary btn-sm" type="button" data-book="natal">Записаться на разбор</button>' + (UI.promoInfo() ? ' <span class="sticker sm">−' + UI.promoInfo().percent + '%</span>' : ''))}</div>`;
    UI.tabs(box);
    W.attach(document.getElementById('wheelBox'));
    box.querySelector('[role=tablist]').addEventListener('tabchange', (e) => {
      if (e.detail === 'tab-balance') CV.animateBars(box);
      // профи-инструменты считаются, только когда их открыли
      if (e.detail === 'tab-pro' && window.ProView && !document.getElementById('proBox').childElementCount) window.ProView.natal(document.getElementById('proBox'), c, p);
      UI.reveal(box);
    });
    if (moment && window.ProView) { const hb = document.getElementById('horaryBox'); hb.innerHTML = window.ProView.horaryCard(c, { name: p.place, lat: p.lat, lon: p.lon, tz: typeof p.zone === 'string' ? p.zone : UI.browserTz }); window.ProView.loadTexts().then((ok) => { if (ok && hb.isConnected) hb.innerHTML = window.ProView.horaryCard(c, { name: p.place, lat: p.lat, lon: p.lon, tz: typeof p.zone === 'string' ? p.zone : UI.browserTz }); }); }
    box.querySelector('.result-head').addEventListener('click', onAction);
    UI.reveal(box);
    UI.fadeIn(box);
    upgrade(c);
  }

  // ---------- премиум: полное толкование ----------
  const MAJOR = ['conj', 'opp', 'square', 'trine', 'sextile'];
  const majorAspects = (c) => c.aspects.filter((a) => MAJOR.includes(a.type) && AC.PLANETS.includes(a.a) && AC.PLANETS.includes(a.b));
  /** Без доступа: что ещё откроется — заголовки без текстов (самих толкований на странице нет). */
  function moreTeaser(c) {
    if (!window.Premium) return '';
    const P = window.Premium;
    const withHouse = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].filter((id) => c.byId[id] && c.byId[id].house).length;
    const items = [
      withHouse ? P.locked(`Планеты в домах — ${withHouse} ${fmt.plural(withHouse, 'толкование', 'толкования', 'толкований')}: в какой сфере жизни проявляется каждая планета`, { lines: 3 }) : '',
      c.summary.ascRuler ? P.locked('Управитель карты — «водитель» всей вашей карты и его главная тема', { lines: 2 }) : '',
      P.locked('Кармические точки: Лунный узел, Хирон и Лилит — задачи и уроки', { lines: 3 }),
      c.byId.mc ? P.locked(`Призвание — MC ${T.signs[c.byId.mc.sign].loc}`, { lines: 2 }) : '',
      majorAspects(c).length ? P.locked(`Ключевые аспекты карты — ${Math.min(10, majorAspects(c).length)} подробных толкований`, { lines: 3 }) : '',
    ].join('');
    return `<h3>Ещё в вашей карте</h3><div class="locked-list">${items}</div>${P.paywall({ feature: 'natal', compact: true, title: 'Натальная карта полностью — в премиум-доступе' })}`;
  }
  function aspTeaser(c) {
    if (!window.Premium) return '';
    const n = majorAspects(c).length;
    return n ? `<div style="margin-top:22px">${window.Premium.locked(`Толкование всех аспектов вашей карты — ${n}: соединения, гармоничные и напряжённые`, { lines: 3, meta: 'премиум' })}</div>` : '';
  }
  /** Есть доступ — подменяем закрытые карточки полным толкованием. */
  async function upgrade(c) {
    if (!window.Premium || !(await window.Premium.ensure(['natal-pro'])) || !window.NatalPro || current !== c) return;
    const ti = document.getElementById('tab-interp'), am = document.getElementById('aspMore');
    if (!ti) return;
    ti.innerHTML = window.NatalPro.interpretation(c);
    if (am) am.innerHTML = window.NatalPro.aspects(c);
    UI.reveal(document.getElementById('result'));
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
    if (act === 'link') {
      // ссылка на карту (как «Поделиться» в Sotis): те же параметры, что принимает страница (?y=…&lat=…&tz=…)
      const p = params, q = new URLSearchParams({ y: p.y, mo: p.mo, d: p.d, h: p.timeKnown === false ? 12 : p.h, mi: p.timeKnown === false ? 0 : p.mi, tk: p.timeKnown === false ? 0 : 1, lat: (+p.lat).toFixed(4), lon: (+p.lon).toFixed(4), tz: typeof p.zone === 'string' ? p.zone : '', place: p.place || '', name: p.name || '' });
      const url = location.href.split(/[?#]/)[0] + '?' + q.toString();
      if (await UI.copyText(url)) UI.toast('Ссылка на карту скопирована — по ней карта откроется сразу', 'link');
      return;
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

  /** quiet — пересчёт без «волшебства» (сменили настройки расчёта). */
  async function calc(p, quiet) {
    params = p || form.get();
    if (!params) return;
    try {
      current = AC.chart(params, CV.chartOpts());
    } catch (err) {
      console.error(err); UI.toast('Не получилось рассчитать карту — проверьте данные', 'info'); return;
    }
    UI.recent.add(params);
    renderRecent();
    if (!quiet && !(await UI.conjure(document.getElementById('result'), { kind: 'natal' }))) return;
    render();
    if (window.innerWidth < 1000) document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // «Недавние карты» теперь — «Мои карты» прямо в форме (UI.peopleChips); старый блок не показываем
  function renderRecent() { const box = document.getElementById('recentBox'); if (box) box.hidden = true; }

  document.addEventListener('DOMContentLoaded', () => {
    // «Мои карты»: нажали на человека — сразу строим его карту
    form = UI.birthForm(document.getElementById('birthForm'), { onPick: (it) => calc(Object.assign({}, it.p, it.person ? { personId: it.person.id } : {})) });
    document.getElementById('settingsBox').appendChild(CV.settingsForm(() => { if (params) calc(params, true); }));
    document.getElementById('calcBtn').addEventListener('click', () => calc());
    document.getElementById('birthForm').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input:not([role=combobox])')) calc(); });
    renderRecent();
    // из астропроцессора: natal.html?person=<id>
    const pq = new URLSearchParams(location.search).get('person');
    const pp = pq && UI.people.get(pq);
    if (pp && pp.birth) { const p = UI.people.params(pp); p.personId = pp.id; form.set(p); calc(p); }
    // код доступа введён или закончился — перерисовать карту с нужным толкованием
    document.addEventListener('premiumchange', () => { if (current) render(); });
    document.addEventListener('themechange', () => { if (current) { const wb = document.getElementById('wheelBox'); if (wb) { wb.innerHTML = W.svg(current, { minor: UI.settings.minor, animate: false }); W.attach(wb); } } });
    // открыть клиента из кабинета
    const q = new URLSearchParams(location.search);
    const cid = q.get('client');
    if (cid) { const c = UI.clients.get(cid); if (c && c.birth) { form.set(c.birth); calc(c.birth); } }
    // карта по ссылке из Telegram-бота: ?y=1995&mo=3&d=14&h=8&mi=30&tk=1&lat=55.75&lon=37.62&tz=Europe/Moscow&place=Москва&name=Мария
    if (q.get('y') && q.get('lat') && q.get('lon')) {
      const p = { name: q.get('name') || '', y: +q.get('y'), mo: +q.get('mo'), d: +q.get('d'), h: +(q.get('h') || 12), mi: +(q.get('mi') || 0), timeKnown: q.get('tk') !== '0', lat: +q.get('lat'), lon: +q.get('lon'), zone: q.get('tz') || 'Europe/Moscow', place: q.get('place') || '' };
      let tzOk = true;
      try { new Intl.DateTimeFormat('en', { timeZone: p.zone }); } catch (e) { tzOk = false; }
      if (tzOk && p.y >= 1900 && p.mo >= 1 && p.mo <= 12 && p.d >= 1 && p.d <= 31 && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180) { form.set(p); calc(p); }
    }
    if (q.get('now')) {
      // карта момента: текущее время, город — из лунного календаря или Москва
      const city = UI.defaultCity();
      const d = new Date();
      const p = { name: 'Карта момента', y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), timeKnown: true, lat: city.lat, lon: city.lon, zone: Intl.DateTimeFormat().resolvedOptions().timeZone || city.tz, place: city.name, moment: true };
      form.set(p); calc(p);
    }
  });
})();
