/* Астропроцессор «Мои карты» (astro.html): сохранённые люди посетителя (UI.people, только этот браузер) и карточка
   выбранного человека — натал, прогноз, числа, гороскоп, совместимость (js/person-view.js; толкования — в премиуме).
   Адрес: astro.html#p=<id>[/вкладка]. */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI, CV = window.ChartView, PV = window.PersonView;
  const { esc, fmt, icon } = UI;
  const $ = (id) => document.getElementById(id);
  const cur = { id: null, tab: 'natal', pv: { natal: 'wheel', forecast: 'transits', horo: 'today', months: 6 } };
  let query = '';
  const chartCache = {};
  function chartOf(p) {
    if (!p || !p.birth) return null;
    const k = JSON.stringify([p.birth, CV.chartOpts()]);
    if (chartCache[k] === undefined) { try { chartCache[k] = AC.chart(Object.assign({ name: p.name }, p.birth), CV.chartOpts()); } catch (e) { chartCache[k] = null; } }
    return chartCache[k];
  }
  const sunMoonAsc = (ch) => (ch ? ['sun', 'moon', 'asc'].map((id) => (ch.byId[id] ? T.signs[ch.byId[id].sign].glyph : '·')).join(' ') : '');

  // ---------- список ----------
  function list() {
    const all = UI.people.all();
    const nq = query.toLowerCase().replace(/ё/g, 'е');
    const items = all.filter((p) => !nq || ((p.name || '') + ' ' + (p.birth && p.birth.place || '') + ' ' + (p.fullName || '')).toLowerCase().replace(/ё/g, 'е').includes(nq));
    $('apPeople').innerHTML = items.map((p) => `<button type="button" class="ap-person${p.id === cur.id ? ' on' : ''}" data-ap-open="${esc(p.id)}" aria-current="${p.id === cur.id}"><span class="ava">${esc((UI.people.label(p) || '?')[0])}</span><span class="ap-pm"><b>${esc(UI.people.label(p))}</b><small>${p.birth ? fmt.birth(p.birth) : 'нет данных'}${p.birth && p.birth.place ? ' · ' + esc(p.birth.place) : ''}</small></span><span class="glyph ap-b3" title="Солнце · Луна · Асцендент">${sunMoonAsc(chartOf(p))}</span></button>`).join('')
      || `<p class="small muted" style="margin:12px 0 0">${all.length ? 'Никого не нашлось.' : 'Пока пусто. Нажмите «Новая» — или постройте натальную карту на сайте с галочкой «Сохранить в Мои карты».'}</p>`;
  }

  // ---------- карточка ----------
  function ctxOf(p, ch) {
    return {
      person: { id: p.id, name: p.name, birth: p.birth, fullName: p.fullName || '' },
      chart: ch, state: cur.pv,
      save: (patch) => { UI.people.update(p.id, patch); },
      partners: () => UI.people.all().filter((x) => x.id !== p.id && x.birth).map((o) => ({ key: o.id, name: UI.people.label(o), birth: o.birth })),
      partner: () => { const o = p.partnerId && UI.people.get(p.partnerId); return o && o.birth ? { key: o.id, name: UI.people.label(o), birth: o.birth } : null; },
      setPartner: (key) => { UI.people.update(p.id, { partnerId: key || null }); },
      newPartner: () => editDialog(null, (np) => { UI.people.update(p.id, { partnerId: np.id }); cur.pv.syn = null; render(); }),
      links: { natal: `natal.html?person=${encodeURIComponent(p.id)}`, forecast: `forecast.html?person=${encodeURIComponent(p.id)}`, numerology: `numerology.html?person=${encodeURIComponent(p.id)}`, synastry: (key) => `synastry.html?pa=${encodeURIComponent(p.id)}&pb=${encodeURIComponent(key)}` },
      redraw: panel,
    };
  }
  function header(p, ch) {
    const N = window.Numerology, b = p.birth;
    const facts = [];
    if (ch) facts.push(...['sun', 'moon', 'asc'].filter((id) => ch.byId[id]).map((id) => `<span class="cc-fact">${T.planets[id].glyph} <span class="glyph" style="color:var(--gold)">${T.signs[ch.byId[id].sign].glyph}</span> ${esc(T.signs[ch.byId[id].sign].name)}</span>`));
    if (N && b) { facts.push(`<span class="cc-fact">${icon('numerology')} путь ${N.lifePath(b.y, b.mo, b.d).value}</span>`); facts.push(`<span class="cc-fact">${icon('calendar-repeat')} личный год ${N.personalYear(b.mo, b.d, new Date().getFullYear()).value}</span>`); }
    if (ch && ch.summary) facts.push(`<span class="cc-fact">${icon('flame')} ${esc(T.elements[ch.summary.topElement].name)} · ${esc(T.planets[ch.summary.dominant[0]].name)}</span>`);
    return `<div class="card cc-head"><span class="cc-ava">${esc((UI.people.label(p) || '?')[0])}</span>
      <div class="cc-who"><h2>${esc(UI.people.label(p))}</h2><p class="small muted">${b ? `${fmt.birth(b)}${b.place ? ', ' + esc(b.place) : ''}` : 'нет данных рождения'}${p.note ? ' · ' + esc(p.note) : ''}</p></div>
      <div class="cc-act"><button class="btn btn-ghost btn-sm" type="button" data-ap="edit">${icon('edit')} Изменить</button><button class="btn btn-ghost btn-sm" type="button" data-ap="delete" title="Удалить карту">${icon('trash')}</button></div>
      ${facts.length ? `<div class="cc-facts">${facts.join('')}</div>` : ''}</div>`;
  }
  function render() {
    const main = $('apMain');
    const p = cur.id && UI.people.get(cur.id);
    list();
    if (!p) {
      main.innerHTML = `<div class="card result-empty"><div class="big">${icon('address-book')}</div><h3>Выберите карту или создайте новую</h3>
        <p class="muted" style="max-width:52ch;margin-inline:auto">Здесь всё о человеке в одном месте: колесо с подсказками и профи-расчёты (достоинства, диспозиторы, мидпоинты, звёзды, фирдарии), дирекции и лунар, числа, личный гороскоп и совместимость с другими картами. Толкования и прогноз по датам — в <a href="premium.html">премиум-доступе</a>.</p>
        <button class="btn btn-primary" type="button" data-ap="new">${icon('plus')} Новая карта</button></div>`;
      return;
    }
    const ch = chartOf(p);
    main.innerHTML = `${header(p, ch)}
      <div class="tabs cc-tabs" role="tablist" aria-label="Разделы карты">${PV.TABS.map(([k, t, ic]) => `<button type="button" role="tab" data-ap-tab="${k}" aria-selected="${cur.tab === k}">${icon(ic)}<span>${t}</span></button>`).join('')}</div>
      <div class="cc-panel" id="apPanel"></div>`;
    panel();
  }
  function panel() {
    const p = cur.id && UI.people.get(cur.id);
    const box = $('apPanel'); if (!p || !box) return;
    const ch = chartOf(p), ctx = ctxOf(p, ch);
    box.innerHTML = PV.body(cur.tab, ctx);
    PV.after(cur.tab, box, ctx);
    UI.fadeIn(box, 4);
  }
  function open(id, tab) {
    if (cur.id !== id) cur.pv = { natal: 'wheel', forecast: 'transits', horo: 'today', months: 6 };
    cur.id = id; cur.tab = tab && PV.TABS.some((t) => t[0] === tab) ? tab : (cur.tab || 'natal');
    history.replaceState(null, '', '#p=' + encodeURIComponent(id) + (cur.tab !== 'natal' ? '/' + cur.tab : ''));
    render();
    if (window.innerWidth < 1000) $('apMain').scrollIntoView({ behavior: UI.reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  // ---------- новая карта / изменить ----------
  function editDialog(p, done) {
    const m = UI.modal(`<h3>${icon(p ? 'edit' : 'plus')} ${p ? 'Изменить карту' : 'Новая карта'}</h3><div id="apForm"></div>
      <div class="form" style="gap:12px;margin-top:12px">
        <div class="field"><label for="apFull">ФИО при рождении <small class="muted">— для нумерологии, можно позже</small></label><input class="input" id="apFull" value="${esc(p ? p.fullName || '' : '')}" placeholder="Как в свидетельстве о рождении"></div>
        <div class="field"><label for="apNote">Заметка <small class="muted">— кто это: «мама», «клиентка», «коллега»</small></label><input class="input" id="apNote" value="${esc(p ? p.note || '' : '')}"></div>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-primary btn-sm" type="button" id="apSave">${icon('check')} Сохранить</button></div>`, { wide: true });
    const bf = UI.birthForm(m.el.querySelector('#apForm'), { noSave: true, noPicker: true, namePlaceholder: 'Имя' });
    if (p && p.birth) bf.set(UI.people.params(p));
    m.el.querySelector('#apSave').addEventListener('click', () => {
      const b = bf.get(); if (!b) return;
      const { name, ...birth } = b;
      const patch = { name: name || '', birth: { y: birth.y, mo: birth.mo, d: birth.d, h: birth.h, mi: birth.mi, timeKnown: birth.timeKnown, lat: birth.lat, lon: birth.lon, zone: birth.zone, place: birth.place }, fullName: m.el.querySelector('#apFull').value.trim(), note: m.el.querySelector('#apNote').value.trim() };
      const saved = p ? UI.people.update(p.id, patch) : UI.people.add(patch);
      PV.invalidate();
      m.close();
      UI.toast(p ? 'Карта сохранена' : 'Карта добавлена в «Мои карты» ✦', 'check');
      if (done) done(saved); else open(saved.id);
    });
  }

  // ---------- перенос ----------
  function exportFile() {
    const data = { app: 'alina-astro-people', version: 1, exported: new Date().toISOString(), people: UI.people.all() };
    UI.download(`moi-karty-${fmt.ymd(new Date())}.json`, JSON.stringify(data, null, 2), 'application/json');
    UI.toast('Файл с картами сохранён', 'download');
  }
  function importFile(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (d.app !== 'alina-astro-people' || !Array.isArray(d.people)) throw new Error('format');
        const mine = UI.people.all(), ids = new Set(mine.map((x) => x.id));
        const add = d.people.filter((x) => x && x.id && x.birth && !ids.has(x.id));
        UI.people.save(mine.concat(add));
        UI.toast(add.length ? `Добавлено карт: ${add.length}` : 'Новых карт в файле нет', 'check');
        render();
      } catch (e) { UI.toast('Это не файл «Моих карт»', 'info'); }
    };
    r.readAsText(file);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const h = /^#p=([^/]+)(?:\/(\w+))?/.exec(location.hash);
    if (h && UI.people.get(decodeURIComponent(h[1]))) { cur.id = decodeURIComponent(h[1]); cur.tab = h[2] || 'natal'; }
    render();
    PV.ensure().then((ok) => { if (ok && cur.id) panel(); });
    $('apQ').addEventListener('input', (e) => { query = e.target.value; list(); });
    $('apImport').addEventListener('change', (e) => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; });
    document.addEventListener('click', async (e) => {
      const o = e.target.closest('[data-ap-open]');
      if (o) { open(o.dataset.apOpen); return; }
      const tb = e.target.closest('[data-ap-tab]');
      if (tb) { cur.tab = tb.dataset.apTab; history.replaceState(null, '', '#p=' + encodeURIComponent(cur.id) + (cur.tab !== 'natal' ? '/' + cur.tab : '')); document.querySelectorAll('[data-ap-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.apTab === cur.tab))); panel(); return; }
      const a = e.target.closest('[data-ap]');
      if (a) {
        const k = a.dataset.ap, p = cur.id && UI.people.get(cur.id);
        if (k === 'new') editDialog(null);
        if (k === 'edit' && p) editDialog(p, () => render());
        if (k === 'delete' && p) { if (!confirm(`Удалить карту «${UI.people.label(p)}»? Это нельзя отменить.`)) return; UI.people.remove(p.id); cur.id = null; history.replaceState(null, '', location.pathname); render(); UI.toast('Карта удалена', 'trash'); }
        if (k === 'export') exportFile();
        return;
      }
      const p = cur.id && UI.people.get(cur.id);
      if (p && e.target.closest('#apPanel')) await PV.handle(e, ctxOf(p, chartOf(p)));
    });
    document.addEventListener('change', (e) => { const p = cur.id && UI.people.get(cur.id); if (p && e.target.closest('#apPanel')) PV.handle(e, ctxOf(p, chartOf(p))); });
    document.addEventListener('premiumchange', () => { PV.ensure().then(() => { if (cur.id) panel(); }); });
    document.addEventListener('themechange', () => { if (cur.id) panel(); });
  });
})();
