/* Кабинет астролога: обзор, клиенты, консультации, шаблоны, инструменты, настройки. Данные — localStorage. */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI, CV = window.ChartView, W = window.Wheel, SITE = window.SITE;
  const { esc, fmt, icon, store } = UI;
  let viewName = 'dashboard';
  let clientQuery = '', clientTag = '', sessFilter = 'upcoming';

  // ---------- данные ----------
  const DB = {
    clients: () => UI.clients.all(),
    saveClients: (l) => UI.clients.save(l),
    sessions: () => store.get('sessions', []),
    saveSessions: (l) => store.set('sessions', l),
    templates: () => store.get('templates', null) || DEFAULT_TEMPLATES,
    saveTemplates: (l) => store.set('templates', l),
  };
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const STATUS = { planned: ['Запланирована', 'gold'], done: ['Проведена', 'ok'], cancelled: ['Отменена', 'bad'] };
  const serviceTitle = (id) => { const s = SITE.services.find((x) => x.id === id); return s ? s.title : id === 'lessons' ? 'Урок астрологии' : id === 'other' ? 'Другое' : id || ''; };
  const sessDate = (s) => new Date(`${s.date}T${s.time || '12:00'}`);

  const DEFAULT_TEMPLATES = [
    { id: 't1', title: 'Подтверждение записи', text: 'Здравствуйте, {имя}! ✨ Подтверждаю консультацию «{услуга}» {дата} в {время} (время ваше местное). Встречаемся онлайн — пришлю ссылку за час до начала.\nЕсли ещё не прислали данные рождения: дата, точное время и город. До встречи! Алина' },
    { id: 't2', title: 'Запрос данных рождения', text: '{имя}, чтобы подготовить вашу карту, пришлите, пожалуйста:\n• дату рождения\n• время (как можно точнее — из справки роддома или свидетельства)\n• город рождения\nИ 2–3 главных вопроса, которые хотите разобрать 🌙' },
    { id: 't3', title: 'Напоминание за день', text: 'Добрый день, {имя}! Напоминаю: завтра, {дата}, в {время} у нас консультация. Подготовьте, пожалуйста, тихое место, наушники и блокнот ✨' },
    { id: 't4', title: 'После консультации', text: '{имя}, спасибо за встречу! 🙏 Отправляю запись и короткие рекомендации. Если будут вопросы — пишите.\nБуду очень благодарна, если поделитесь парой слов о консультации — это помогает мне и тем, кто только думает записаться.' },
    { id: 't5', title: 'Поздравление и прогноз на год', text: 'С наступающим днём рождения, {имя}! 🎂✨ Скоро начинается ваш новый личный год — соляр покажет его главные темы. Если хотите узнать, что он готовит, я с радостью сделаю прогноз на год.' },
    { id: 't6', title: 'Анкета для ректификации', text: 'Для уточнения времени рождения пришлите, пожалуйста, даты (хотя бы месяц и год) важных событий:\n• переезды\n• поступление и окончание учёбы, смены работы\n• отношения: начало, брак, расставания\n• рождение детей\n• серьёзные болезни, операции, травмы\n• потери близких\nЧем больше событий — тем точнее результат.' },
  ];

  const OUTLINE = ['Знакомство и запрос клиента', 'Общий рисунок карты: стихии, кресты, стеллиумы', 'Большая тройка: Солнце, Луна, Асцендент', 'Управитель карты и его положение', 'Личные планеты: Меркурий, Венера, Марс', 'Сферы запроса: дома и их управители', 'Ключевые аспекты (3–5 самых точных)', 'Текущие транзиты и ближайший год', 'Рекомендации и вопросы клиента', 'Итоги, запись, следующий шаг'];

  // ---------- навигация ----------
  const NAV = [
    ['dashboard', 'Обзор', 'home'], ['clients', 'Клиенты', 'users'], ['sessions', 'Консультации', 'calendar'], ['schedule', 'Расписание', 'calendar-time'],
    ['elect', 'Подбор дат', 'star'], ['certs', 'Сертификаты', 'gift'], ['templates', 'Шаблоны', 'copy'], ['tools', 'Инструменты', 'chart'], ['settings', 'Настройки', 'settings'],
  ];
  function nav() {
    const counts = { clients: DB.clients().length, sessions: DB.sessions().filter((s) => s.status === 'planned' && sessDate(s) >= new Date(Date.now() - 86400000)).length, schedule: window.CabinetSchedule && window.CabinetSchedule.needsPublish() ? '!' : 0 };
    document.getElementById('cabNav').innerHTML = NAV.map(([k, t, i]) => `<button type="button" data-view="${k}" aria-current="${viewName === k}">${icon(i)}${t}${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</button>`).join('');
  }
  function show(v) { viewName = v; nav(); VIEWS[v](); UI.reveal(document.getElementById('view')); UI.fadeIn(document.getElementById('view')); }

  // ---------- обзор ----------
  function dashboard() {
    const now = new Date();
    const hr = now.getHours();
    const greet = hr < 6 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
    const clients = DB.clients(), sessions = DB.sessions();
    const m0 = new Date(now.getFullYear(), now.getMonth(), 1), m1 = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthS = sessions.filter((s) => sessDate(s) >= m0 && sessDate(s) < m1 && s.status !== 'cancelled');
    const income = monthS.filter((s) => s.paid).reduce((a, s) => a + (+s.price || 0), 0);
    const expected = monthS.filter((s) => !s.paid).reduce((a, s) => a + (+s.price || 0), 0);
    const upcoming = sessions.filter((s) => s.status === 'planned' && sessDate(s) >= new Date(now.getTime() - 2 * 3600000)).sort((a, b) => sessDate(a) - sessDate(b));
    const bdays = clients.filter((c) => c.birth).map((c) => { let d = new Date(now.getFullYear(), c.birth.mo - 1, c.birth.d); if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = new Date(now.getFullYear() + 1, c.birth.mo - 1, c.birth.d); return { c, d, days: Math.round((d - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000) }; }).filter((x) => x.days <= 30).sort((a, b) => a.days - b.days);
    const sky = UI.skyNow(now);
    let voc = []; try { voc = AC.voidOfCourse(now, AC.addDays(now, 2)); } catch (e) { voc = []; }
    const ev = soonEvents(now);
    document.getElementById('view').innerHTML = `
      <h2 style="margin-bottom:4px">${greet}, ${esc(SITE.name.split(' ')[0])} ✦</h2>
      <p class="muted">${fmt.DOW_LONG[now.getDay()][0].toUpperCase() + fmt.DOW_LONG[now.getDay()].slice(1)}, ${fmt.date(now)}</p>
      <div class="grid grid-4" style="margin-top:18px">
        <div class="card stat reveal"><div class="k">Клиентов</div><div class="v">${clients.length}</div><div class="s">в базе</div></div>
        <div class="card stat reveal" style="--d:.05s"><div class="k">Консультаций</div><div class="v">${monthS.length}</div><div class="s">в ${['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'][now.getMonth()]}</div></div>
        <div class="card stat reveal" style="--d:.1s"><div class="k">Доход за месяц</div><div class="v">${fmt.money(income) || '0 ' + (SITE.currency || '₽')}</div><div class="s">${expected ? 'ожидается ещё ' + fmt.money(expected) : 'всё оплачено'}</div></div>
        <div class="card stat reveal" style="--d:.15s"><div class="k">Ближайшая</div><div class="v" style="font-size:1.4rem">${upcoming[0] ? fmt.dm(sessDate(upcoming[0])) : '—'}</div><div class="s">${upcoming[0] ? fmt.time(sessDate(upcoming[0])) + ' · ' + esc(clientName(upcoming[0].clientId)) : 'нет записей'}</div></div>
      </div>
      <div class="grid grid-2" style="margin-top:18px;align-items:start">
        <div class="card reveal"><div class="row between"><h3 style="margin:0">Ближайшие консультации</h3><button class="btn btn-ghost btn-xs" type="button" data-act="newSession">${icon('plus')} Добавить</button></div>
          <div class="list" style="margin-top:14px">${upcoming.slice(0, 6).map(sessionRow).join('') || '<div class="empty">Пока пусто. Добавьте первую консультацию.</div>'}</div></div>
        <div class="card reveal" style="--d:.06s"><h3>Небо сегодня</h3>
          <div class="row" style="gap:14px;flex-wrap:nowrap;align-items:center"><div style="width:58px;flex-shrink:0">${UI.moonSVG(sky.moon.angle)}</div><div><b>${T.moonPhaseNow[sky.moon.phase8].name}</b> · Луна ${T.signs[sky.moon.sign].loc}<br><span class="small muted">${voc.length ? 'Без курса: ' + voc.slice(0, 2).map((v) => fmt.dmTime(v.start) + ' — ' + fmt.time(v.end)).join('; ') : ''}</span></div></div>
          <p class="small" style="margin:12px 0 6px"><b>Ретроградные:</b> ${sky.retro.length ? sky.retro.map((id) => T.planets[id].name).join(', ') : 'нет'}</p>
          <h4 style="margin-top:14px">Скоро на небе</h4>
          <div class="event-list">${ev.map((e) => `<div class="event" style="padding:8px 12px"><div class="d" style="font-size:.85rem">${fmt.dateShort(e.date)}<small>${fmt.time(e.date)}</small></div><div class="i glyph" style="font-size:1.2rem">${e.icon}</div><div class="t small">${e.text}</div></div>`).join('') || '<p class="small muted">Ничего заметного в ближайшие 2 недели.</p>'}</div>
        </div>
      </div>
      <div class="card reveal" style="margin-top:18px"><h3>Дни рождения клиентов — 30 дней</h3><p class="small muted">Хороший повод поздравить и предложить прогноз на новый личный год (соляр).</p>
        <div class="list">${bdays.map((x) => `<div class="list-item" data-client="${x.c.id}"><span class="ava">${esc((x.c.name || '?')[0])}</span><div class="main"><b>${esc(x.c.name)}</b><small>${fmt.dm(x.d)} · исполнится ${x.d.getFullYear() - x.c.birth.y}</small></div><div class="side">${x.days === 0 ? '<span class="badge gold">сегодня!</span>' : 'через ' + x.days + ' ' + fmt.plural(x.days, 'день', 'дня', 'дней')}<br><button class="btn btn-xs btn-gold" type="button" data-bday="${x.c.id}" style="margin-top:6px">${icon('gift')} Поздравление</button></div></div>`).join('') || '<div class="empty">В ближайший месяц дней рождения нет.</div>'}</div></div>`;
  }

  function soonEvents(now) {
    const end = AC.addDays(now, 14), out = [];
    for (const s of AC.stations(['mercury', 'venus', 'mars', 'jupiter', 'saturn'], now, end)) out.push({ date: s.date, icon: T.planets[s.id].glyph, text: `${T.planets[s.id].name} ${s.kind === 'retro' ? 'становится ретроградным' : 'становится директным'}` });
    for (const p of AC.moonPhases(now, end)) if (p.phase === 0 || p.phase === 2) out.push({ date: p.date, icon: p.phase === 0 ? '●' : '○', text: `${p.phase === 0 ? 'Новолуние' : 'Полнолуние'} ${T.signs[AC.signOf(p.lon)].loc}` });
    for (const e of AC.eclipses(now, end)) out.push({ date: e.date, icon: '◑', text: `${e.type === 'solar' ? 'Солнечное' : 'Лунное'} затмение` });
    for (const id of ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']) for (const i of AC.ingresses(id, now, end)) out.push({ date: i.date, icon: T.planets[id].glyph, text: `${T.planets[id].name} → ${T.signs[i.to].name}` });
    return out.sort((a, b) => a.date - b.date).slice(0, 7);
  }

  const clientName = (id) => { const c = UI.clients.get(id); return c ? c.name : 'Клиент'; };
  function sessionRow(s) {
    const d = sessDate(s); const st = STATUS[s.status] || STATUS.planned;
    return `<div class="list-item" data-session="${s.id}"><span class="ava" style="border-radius:12px;font-size:.78rem;line-height:1.1;text-align:center">${d.getDate()}<br>${fmt.MONTHS_SHORT[d.getMonth()]}</span><div class="main"><b>${esc(clientName(s.clientId))}</b><small>${fmt.time(d)} · ${esc(serviceTitle(s.service))}</small></div><div class="side"><span class="badge ${st[1]}">${st[0]}</span><br>${s.price ? `<span class="small">${fmt.money(+s.price)}${s.paid ? ' ✓' : ''}</span>` : ''}</div></div>`;
  }

  // ---------- клиенты ----------
  function clientsView() {
    const all = DB.clients();
    const tags = Array.from(new Set(all.flatMap((c) => c.tags || []))).sort();
    const q = clientQuery.toLowerCase();
    const list = all.filter((c) => (!q || (c.name + ' ' + (c.contact || '') + ' ' + (c.notes || '')).toLowerCase().includes(q)) && (!clientTag || (c.tags || []).includes(clientTag)));
    document.getElementById('view').innerHTML = `
      <div class="row between"><h2 style="margin:0">Клиенты</h2><button class="btn btn-primary btn-sm" type="button" data-act="newClient">${icon('plus')} Новый клиент</button></div>
      <div class="toolbar" style="margin-top:16px"><input class="input" id="cq" placeholder="Поиск по имени, контакту, заметкам" value="${esc(clientQuery)}" aria-label="Поиск клиентов">
        ${tags.length ? `<select class="select" id="ctag" style="max-width:200px"><option value="">Все теги</option>${tags.map((t) => `<option${t === clientTag ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''}</div>
      <div class="list">${list.map((c) => {
        const ch = c.birth ? safeChart(c.birth) : null;
        const b3 = ch ? ['sun', 'moon', 'asc'].map((id) => ch.byId[id] ? T.signs[ch.byId[id].sign].glyph : '·').join(' ') : '';
        const last = DB.sessions().filter((s) => s.clientId === c.id).sort((a, b) => sessDate(b) - sessDate(a))[0];
        return `<div class="list-item" data-client="${c.id}"><span class="ava">${esc((c.name || '?').replace(/^Демо — /, '')[0])}</span><div class="main"><b>${esc(c.name)}</b><small>${c.birth ? fmt.birth(c.birth) : 'нет данных рождения'}${c.contact ? ' · ' + esc(c.contact) : ''}</small></div><div class="side"><span class="glyph" style="color:var(--lav-strong);font-size:1.05rem" title="Солнце · Луна · Асцендент">${b3}</span><br><small class="muted">${last ? 'посл.: ' + fmt.dateShort(sessDate(last)) : ''}</small>${(c.tags || []).map((t) => ` <span class="badge" style="font-size:.66rem">${esc(t)}</span>`).join('')}</div></div>`;
      }).join('') || `<div class="empty card">${all.length ? 'Никого не нашлось.' : 'Пока нет клиентов. Добавьте первого — или сохраните карту со страницы «Натальная карта» кнопкой «В кабинет».'}</div>`}</div>`;
    const cq = document.getElementById('cq');
    cq.addEventListener('input', () => { clientQuery = cq.value; const pos = cq.selectionStart; clientsView(); const n = document.getElementById('cq'); n.focus(); n.setSelectionRange(pos, pos); });
    const ct = document.getElementById('ctag'); if (ct) ct.addEventListener('change', () => { clientTag = ct.value; clientsView(); });
  }

  const chartCache = {};
  function safeChart(b) {
    const k = JSON.stringify(b);
    if (chartCache[k]) return chartCache[k];
    try { return (chartCache[k] = AC.chart(b, CV.chartOpts())); } catch (e) { return null; }
  }

  function clientForm(c) {
    c = c || { name: '', contact: '', tags: [], notes: '' };
    const m = UI.modal(`
      <h3>${c.id ? 'Редактировать клиента' : 'Новый клиент'}</h3>
      <div class="form">
        <div class="form-row"><div class="field"><label for="cfContact">Контакт</label><input class="input" id="cfContact" value="${esc(c.contact)}" placeholder="@telegram, телефон, почта"></div>
        <div class="field"><label for="cfTags">Теги (через запятую)</label><input class="input" id="cfTags" value="${esc((c.tags || []).join(', '))}" placeholder="постоянный, курс, рекомендация"></div></div>
        <div id="cfBirth"></div>
        <div class="field"><label for="cfNotes">Заметки</label><textarea class="textarea" id="cfNotes" placeholder="Запрос, важные события, договорённости">${esc(c.notes || '')}</textarea></div>
        <label class="check"><input type="checkbox" id="cfNoBirth"${c.id && !c.birth ? ' checked' : ''}> Данных рождения пока нет</label>
        <button class="btn btn-primary" type="button" id="cfSave">Сохранить</button>
      </div>`, { wide: true });
    const bf = UI.birthForm(m.el.querySelector('#cfBirth'), { namePlaceholder: 'Имя клиента' });
    if (c.birth) bf.set(Object.assign({}, c.birth, { name: c.name })); else m.el.querySelector('#cfBirth input').value = c.name || '';
    m.el.querySelector('#cfSave').addEventListener('click', () => {
      const noBirth = m.el.querySelector('#cfNoBirth').checked;
      let birth = null, name = m.el.querySelector('#cfBirth input').value.trim();
      if (!noBirth) { birth = bf.get(); if (!birth) return; name = birth.name || name; delete birth.name; }
      if (!name) { UI.toast('Укажите имя клиента', 'user'); return; }
      const list = DB.clients();
      const data = { name, contact: m.el.querySelector('#cfContact').value.trim(), tags: m.el.querySelector('#cfTags').value.split(',').map((s) => s.trim()).filter(Boolean), notes: m.el.querySelector('#cfNotes').value, birth: noBirth ? null : Object.assign({ name }, birth) };
      if (c.id) { const i = list.findIndex((x) => x.id === c.id); list[i] = Object.assign({}, list[i], data); DB.saveClients(list); }
      else UI.clients.add(data);
      m.close(); UI.toast('Клиент сохранён', 'check'); show('clients');
    });
  }

  function clientCard(id) {
    const c = UI.clients.get(id); if (!c) return;
    const ch = c.birth ? safeChart(c.birth) : null;
    const sess = DB.sessions().filter((s) => s.clientId === id).sort((a, b) => sessDate(b) - sessDate(a));
    const others = DB.clients().filter((x) => x.id !== id && x.birth);
    const m = UI.modal(`
      <div class="row between" style="align-items:flex-start;padding-right:40px">
        <div class="row" style="gap:14px;flex-wrap:nowrap"><span class="ava" style="width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--lav-soft),var(--rose));font:600 1.5rem var(--ff-display);color:var(--lav-strong)">${esc((c.name || '?')[0])}</span>
        <div><h3 style="margin:0">${esc(c.name)}</h3><p class="small muted" style="margin:2px 0 0">${c.contact ? esc(c.contact) : 'без контакта'}${(c.tags || []).map((t) => ` <span class="badge">${esc(t)}</span>`).join('')}</p></div></div>
        <button class="btn btn-ghost btn-xs" type="button" data-cact="edit">${icon('edit')} Изменить</button>
      </div>
      ${ch ? `<div class="grid grid-2" style="margin-top:18px;align-items:center">
          <div class="wheel-box" style="max-width:320px">${W.svg(ch, { animate: false })}</div>
          <div><p class="small muted" style="margin-bottom:8px">${fmt.birth(c.birth)} · ${esc(c.birth.place || '')}</p>
            ${['sun', 'moon', 'asc'].map((pid) => ch.byId[pid] ? `<p style="margin:0 0 4px"><span class="glyph" style="color:var(--lav-strong)">${T.planets[pid].glyph}</span> ${T.planets[pid].name}: <b>${T.signs[ch.byId[pid].sign].name}</b> <span class="muted small">${AC.fmtDeg(ch.byId[pid].lon)}</span></p>` : '').join('')}
            <p class="small" style="margin:8px 0 0">Стихия: <b>${T.elements[ch.summary.topElement].name}</b> · сильнейшая планета: <b>${T.planets[ch.summary.dominant[0]].name}</b>${ch.summary.ascRuler ? ' · управитель карты: <b>' + T.planets[ch.summary.ascRuler].name + '</b>' : ''}</p>
            <div class="row" style="margin-top:14px;gap:8px">
              <a class="btn btn-primary btn-xs" href="natal.html?client=${c.id}">${icon('chart')} Карта</a>
              <a class="btn btn-ghost btn-xs" href="forecast.html?client=${c.id}">Прогноз</a>
              ${others.length ? `<select class="select" id="synWith" style="max-width:180px;min-height:34px;padding:4px 30px 4px 10px;font-size:.82rem"><option value="">Совместимость с…</option>${others.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select>` : ''}
            </div></div></div>` : '<p class="notice" style="margin-top:16px">Данных рождения нет — добавьте их, чтобы построить карту.</p>'}
      ${c.notes ? `<h4 style="margin-top:18px">Заметки</h4><p class="small" style="white-space:pre-wrap">${esc(c.notes)}</p>` : ''}
      <div class="row between" style="margin-top:18px"><h4 style="margin:0">Консультации (${sess.length})</h4><button class="btn btn-ghost btn-xs" type="button" data-cact="session">${icon('plus')} Записать</button></div>
      <div class="list" style="margin-top:10px">${sess.map(sessionRow).join('') || '<p class="small muted">Пока не было.</p>'}</div>
      <div class="row between" style="margin-top:20px;border-top:1px solid var(--line);padding-top:14px"><button class="btn btn-ghost btn-xs" type="button" data-cact="copy">${icon('copy')} Скопировать данные</button><button class="btn btn-ghost btn-xs" type="button" data-cact="delete" style="color:var(--bad)">${icon('trash')} Удалить клиента</button></div>`, { wide: true });
    const sw = m.el.querySelector('#synWith');
    if (sw) sw.addEventListener('change', () => { if (sw.value) location.href = `synastry.html?a=${c.id}&b=${sw.value}`; });
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-cact]');
      const srow = e.target.closest('[data-session]');
      if (srow) { m.close(); setTimeout(() => sessionForm(DB.sessions().find((s) => s.id === srow.dataset.session)), 320); return; }
      if (!b) return;
      const a = b.dataset.cact;
      if (a === 'edit') { m.close(); setTimeout(() => clientForm(c), 320); }
      if (a === 'session') { m.close(); setTimeout(() => sessionForm(null, c.id), 320); }
      if (a === 'copy') { const t = `${c.name}\n${c.birth ? fmt.birth(c.birth) + ', ' + (c.birth.place || '') + ' (' + UI.fmtCoord(c.birth.lat, c.birth.lon) + ', ' + c.birth.zone + ')' : ''}${ch ? '\nСолнце: ' + T.signs[ch.byId.sun.sign].name + ', Луна: ' + T.signs[ch.byId.moon.sign].name + (ch.byId.asc ? ', ASC: ' + T.signs[ch.byId.asc.sign].name : '') : ''}`; if (await UI.copyText(t)) UI.toast('Скопировано', 'check'); }
      if (a === 'delete') {
        if (!confirm(`Удалить клиента «${c.name}» и все его консультации? Это нельзя отменить.`)) return;
        DB.saveClients(DB.clients().filter((x) => x.id !== c.id));
        DB.saveSessions(DB.sessions().filter((s) => s.clientId !== c.id));
        m.close(); UI.toast('Клиент удалён', 'trash'); show(viewName);
      }
    });
  }

  // ---------- консультации ----------
  function sessionsView() {
    const now = new Date();
    const all = DB.sessions().slice();
    const list = sessFilter === 'upcoming' ? all.filter((s) => s.status === 'planned' && sessDate(s) >= new Date(now.getTime() - 3 * 3600000)).sort((a, b) => sessDate(a) - sessDate(b))
      : sessFilter === 'past' ? all.filter((s) => s.status !== 'planned' || sessDate(s) < now).sort((a, b) => sessDate(b) - sessDate(a))
        : all.filter((s) => !s.paid && s.status === 'done').sort((a, b) => sessDate(b) - sessDate(a));
    // сводка по месяцам
    const byM = {};
    for (const s of all) { if (s.status === 'cancelled') continue; const d = sessDate(s); const k = d.getFullYear() * 12 + d.getMonth(); byM[k] = byM[k] || { n: 0, sum: 0, paid: 0 }; byM[k].n++; byM[k].sum += +s.price || 0; if (s.paid) byM[k].paid += +s.price || 0; }
    const months = Object.keys(byM).map(Number).sort((a, b) => b - a).slice(0, 6);
    document.getElementById('view').innerHTML = `
      <div class="row between"><h2 style="margin:0">Консультации</h2><div class="row"><button class="btn btn-ghost btn-sm" type="button" data-act="fromRequest">${icon('clipboard-plus')} Из заявки</button><button class="btn btn-primary btn-sm" type="button" data-act="newSession">${icon('plus')} Новая консультация</button></div></div>
      <div class="seg" style="margin:16px 0" role="group">${[['upcoming', 'Предстоящие'], ['past', 'Прошедшие'], ['unpaid', 'Не оплачены']].map(([k, t]) => `<button type="button" data-sf="${k}" aria-pressed="${sessFilter === k}">${t}</button>`).join('')}</div>
      <div class="list">${list.map(sessionRow).join('') || '<div class="empty card">Здесь пока пусто.</div>'}</div>
      ${months.length ? `<h3 style="margin-top:28px">По месяцам</h3><div class="table-wrap"><table class="table"><thead><tr><th>Месяц</th><th>Консультаций</th><th>Сумма</th><th>Оплачено</th></tr></thead><tbody>${months.map((k) => `<tr><td>${fmt.MONTHS[k % 12]} ${Math.floor(k / 12)}</td><td>${byM[k].n}</td><td>${fmt.money(byM[k].sum) || '—'}</td><td>${fmt.money(byM[k].paid) || '—'}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  }

  function sessionForm(s, presetClient) {
    const clients = DB.clients();
    if (!clients.length) { UI.toast('Сначала добавьте клиента', 'user'); clientForm(); return; }
    const today = fmt.ymd(new Date());
    s = s || { clientId: presetClient || clients[0].id, service: SITE.services[0].id, date: today, time: '12:00', duration: 90, price: SITE.services[0].price, status: 'planned', paid: false, notes: '' };
    const svcs = SITE.services.map((x) => [x.id, x.title, x.price]).concat([['lessons', 'Урок астрологии', 3000], ['other', 'Другое', 0]]);
    const m = UI.modal(`
      <h3>${s.id ? 'Консультация' : 'Новая консультация'}</h3>
      <div class="form">
        <div class="form-row">
          <div class="field"><label for="sfC">Клиент</label><select class="select" id="sfC">${clients.map((c) => `<option value="${c.id}"${c.id === s.clientId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="sfS">Услуга</label><select class="select" id="sfS">${svcs.map(([id, t]) => `<option value="${id}"${id === s.service ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        </div>
        <div class="form-row three">
          <div class="field"><label for="sfD">Дата</label><input class="input" type="date" id="sfD" value="${s.date}"></div>
          <div class="field"><label for="sfT">Время</label><input class="input" type="time" id="sfT" value="${s.time}"></div>
          <div class="field"><label for="sfDur">Минут</label><input class="input" type="number" id="sfDur" min="10" step="5" value="${s.duration || 60}"></div>
        </div>
        <div class="field"><label for="sfTz">Часовой пояс клиента</label><select class="select" id="sfTz"><option value="">Как у меня</option>${UI.timeZones().concat(s.clientTz && !UI.timeZones().includes(s.clientTz) ? [s.clientTz] : []).map((z) => `<option${z === s.clientTz ? ' selected' : ''}>${esc(z)}</option>`).join('')}</select><span class="hint">Время выше — ваше. В шаблонах сообщений ({дата}, {время}) оно будет по часам клиента.</span></div>
        <div class="form-row">
          <div class="field"><label for="sfP">Стоимость, ${esc(SITE.currency || '₽')}</label><input class="input" type="number" id="sfP" min="0" step="100" value="${s.price || 0}"></div>
          <div class="field"><label for="sfSt">Статус</label><select class="select" id="sfSt">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === s.status ? ' selected' : ''}>${v[0]}</option>`).join('')}</select></div>
        </div>
        <label class="switch"><input type="checkbox" id="sfPaid"${s.paid ? ' checked' : ''}> Оплачено</label>
        <div class="field"><label for="sfN">Заметки к встрече</label><textarea class="textarea" id="sfN" placeholder="Запрос, ключевые темы, что обещали прислать">${esc(s.notes || '')}</textarea></div>
        <details class="details-adv"><summary>План консультации (чек-лист)</summary><div style="display:grid;gap:6px;margin-top:6px">${OUTLINE.map((o, i) => `<label class="check"><input type="checkbox" data-ol="${i}"${(s.outline || []).includes(i) ? ' checked' : ''}> ${o}</label>`).join('')}</div></details>
        <div class="row between">
          ${s.id ? `<button class="btn btn-ghost btn-sm" type="button" id="sfDel" style="color:var(--bad)">${icon('trash')} Удалить</button>` : '<span></span>'}
          <div class="row">${s.id ? `<button class="btn btn-ghost btn-sm" type="button" id="sfMsg">${icon('copy')} Подтверждение</button>` : ''}<button class="btn btn-primary btn-sm" type="button" id="sfSave">Сохранить</button></div>
        </div>
      </div>`, { wide: true });
    const $m = (q) => m.el.querySelector(q);
    $m('#sfS').addEventListener('change', () => { const sv = svcs.find((x) => x[0] === $m('#sfS').value); if (sv && sv[2] && !s.id) $m('#sfP').value = sv[2]; });
    $m('#sfSave').addEventListener('click', () => {
      const list = DB.sessions();
      const data = { clientId: $m('#sfC').value, service: $m('#sfS').value, date: $m('#sfD').value || today, time: $m('#sfT').value || '12:00', duration: +$m('#sfDur').value || 60, clientTz: $m('#sfTz').value, price: +$m('#sfP').value || 0, status: $m('#sfSt').value, paid: $m('#sfPaid').checked, notes: $m('#sfN').value, outline: Array.from(m.el.querySelectorAll('[data-ol]:checked')).map((x) => +x.dataset.ol) };
      if (s.id) { const i = list.findIndex((x) => x.id === s.id); list[i] = Object.assign({}, list[i], data); } else list.push(Object.assign({ id: uid('s'), created: new Date().toISOString() }, data));
      DB.saveSessions(list); m.close(); UI.toast('Консультация сохранена', 'check'); show(viewName);
    });
    if (s.id) {
      $m('#sfDel').addEventListener('click', () => { if (!confirm('Удалить консультацию?')) return; DB.saveSessions(DB.sessions().filter((x) => x.id !== s.id)); m.close(); show(viewName); });
      $m('#sfMsg').addEventListener('click', async () => { const t = fillTpl(DB.templates()[0].text, s); if (await UI.copyText(t)) UI.toast('Текст подтверждения скопирован', 'check'); });
    }
  }

  function fillTpl(text, s, client) {
    const c = client || (s && UI.clients.get(s.clientId));
    const d = s ? sessDate(s) : null;
    // у клиента из другого часового пояса дата и время в сообщении — по его часам
    const BC = window.BookingCore;
    const p = d && s.clientTz && BC && BC.validTz(s.clientTz) ? BC.partsIn(d.getTime(), s.clientTz) : null;
    const dm = d ? (p ? `${p.d} ${fmt.MONTHS_GEN[p.m - 1]}` : fmt.dm(d)) : '___', tm = d ? (p ? BC.hm(p.min) : fmt.time(d)) : '___';
    return text.replace(/\{имя\}/g, c ? c.name.split(' ')[0] : '___').replace(/\{дата\}/g, dm).replace(/\{время\}/g, tm).replace(/\{услуга\}/g, s ? serviceTitle(s.service) : '___');
  }

  // ---------- подбор благоприятных дат ----------
  let electState = null;
  function electView() {
    const st = electState || { purpose: 'contract', from: fmt.ymd(new Date()), days: 30, city: (UI.defaultCity()).name };
    document.getElementById('view').innerHTML = `
      <h2 style="margin-bottom:6px">Подбор благоприятных дат</h2>
      <p class="muted small">Элективная астрология: оценка каждого дня для начинания по фазе и знаку Луны, Луне без курса, ретроградности, затмениям и аспектам Луны. Окно оценки — 9:00–21:00 по времени выбранного города. Это помощник для подготовки — финальное решение за астрологом.</p>
      <div class="card" style="margin-top:14px"><div class="form-row four">
        <div class="field"><label for="elP">Цель</label><select class="select" id="elP">${Object.entries(AC.ELECT).map(([k, v]) => `<option value="${k}"${k === st.purpose ? ' selected' : ''}>${v.name}</option>`).join('')}</select></div>
        <div class="field"><label for="elF">С даты</label><input class="input" type="date" id="elF" value="${st.from}"></div>
        <div class="field"><label for="elD">Период</label><select class="select" id="elD">${[14, 30, 60, 90].map((n) => `<option value="${n}"${n === st.days ? ' selected' : ''}>${n} дней</option>`).join('')}</select></div>
        <div class="field"><label for="elC">Город</label><select class="select" id="elC">${UI.CITIES.map((c) => `<option${c.name === st.city ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      </div><button class="btn btn-primary btn-sm" type="button" id="elGo" style="margin-top:14px">${icon('search')} Подобрать даты</button></div>
      <div id="elRes" style="margin-top:18px"></div>`;
    document.getElementById('elGo').addEventListener('click', runElect);
    if (electState && electState.result) renderElect();
  }
  function runElect() {
    const v = (id) => document.getElementById(id).value;
    const city = UI.CITIES.find((c) => c.name === v('elC')) || UI.CITIES[0];
    const [y, m, d] = (v('elF') || fmt.ymd(new Date())).split('-').map(Number);
    const days = +v('elD');
    const dayStart = (i) => { const x = new Date(Date.UTC(y, m - 1, d + i)); return AC.localToUTC(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate(), 0, 0, city.tz).date; };
    const btn = document.getElementById('elGo'); btn.disabled = true; btn.textContent = 'Считаю…';
    setTimeout(() => {
      try {
        const res = AC.electional(v('elP'), dayStart(0), days, dayStart);
        res.forEach((r, i) => { const x = new Date(Date.UTC(y, m - 1, d + i)); r.label = `${x.getUTCDate()} ${fmt.MONTHS_GEN[x.getUTCMonth()]}`; r.dow = fmt.DOW[x.getUTCDay()]; });
        electState = { purpose: v('elP'), from: v('elF'), days, city: city.name, result: res };
        renderElect();
      } catch (e) { console.error(e); UI.toast('Не удалось рассчитать', 'info'); }
      btn.disabled = false; btn.innerHTML = icon('search') + ' Подобрать даты';
    }, 30);
  }
  function renderElect() {
    const res = electState.result;
    const top = res.slice().sort((a, b) => b.score - a.score || a.date - b.date).slice(0, 5);
    const color = (sc) => (sc >= 4 ? 'var(--ok)' : sc >= 2 ? 'var(--soft-asp)' : sc >= 0 ? 'var(--gold)' : 'var(--bad)');
    const why = (r) => r.reasons.map(([s, t]) => `<span style="color:${s === '+' ? 'var(--ok)' : 'var(--bad)'}">${s === '+' ? '＋' : '−'}</span> ${esc(t)}`).join('<br>');
    document.getElementById('elRes').innerHTML = `
      <div class="row between"><h3 style="margin:0">Лучшие дни · ${esc(AC.ELECT[electState.purpose].name.toLowerCase())}</h3><button class="btn btn-gold btn-xs" type="button" id="elCopy">${icon('copy')} Текст для клиента</button></div>
      <div class="grid grid-3" style="margin-top:12px">${top.map((r) => `<div class="card" style="border-top:4px solid ${color(r.score)}"><div class="row between"><b style="font:600 1.3rem var(--ff-display)">${r.label}</b><span class="badge">${r.dow}</span></div><p class="small muted" style="margin:4px 0 8px">Луна ${T.signs[r.moonSign].loc} · ${T.moonPhaseNow[r.phase].name.toLowerCase()} · оценка ${r.score > 0 ? '+' : ''}${r.score}</p><p class="tiny" style="margin:0">${why(r)}</p></div>`).join('')}</div>
      <h3 style="margin-top:22px">Все дни</h3>
      <div class="table-wrap"><table class="table"><thead><tr><th>Дата</th><th>Оценка</th><th>Луна</th><th>Без курса днём</th><th>Почему</th></tr></thead><tbody>
        ${res.map((r) => `<tr><td><b>${r.label}</b> <span class="muted small">${r.dow}</span></td><td><span style="display:inline-block;min-width:34px;text-align:center;padding:2px 8px;border-radius:999px;background:${color(r.score)};color:#fff;font-weight:700;font-size:.82rem">${r.score > 0 ? '+' : ''}${r.score}</span></td><td><span class="glyph" style="color:var(--lav-strong)">${T.signs[r.moonSign].glyph}</span> ${T.signs[r.moonSign].name}</td><td>${r.vocMin ? Math.round(r.vocMin / 6) / 10 + ' ч' : '—'}</td><td class="wrap tiny" style="min-width:260px">${why(r)}</td></tr>`).join('')}
      </tbody></table></div>`;
    document.getElementById('elCopy').addEventListener('click', async () => {
      const t = `Подобрала для вас благоприятные даты (${AC.ELECT[electState.purpose].name.toLowerCase()}):\n` + top.slice(0, 3).map((r, i) => `${i + 1}. ${r.label} (${r.dow}) — Луна ${T.signs[r.moonSign].loc}, ${T.moonPhaseNow[r.phase].name.toLowerCase()}`).join('\n') + '\nТочное время подскажу дополнительно ✨';
      if (await UI.copyText(t)) UI.toast('Текст скопирован', 'check');
    });
  }

  // ---------- подарочные сертификаты ----------
  let certDraft = null, certTimer = null;
  const certs = () => store.get('certs', []);
  const saveCerts = (l) => store.set('certs', l);
  function nextCertNumber() {
    const y = new Date().getFullYear();
    const seq = certs().filter((c) => c.number.startsWith(`AM-${y}-`)).map((c) => +c.number.split('-')[2]).reduce((a, b) => Math.max(a, b), 0) + 1;
    return `AM-${y}-${String(seq).padStart(3, '0')}`;
  }
  const certTitle = (c) => (c.kind === 'amount' ? fmt.money(+c.amount) : serviceTitle(c.service));
  const MESSAGES = ['Пусть звёзды подскажут самый красивый путь', 'С днём рождения! Пусть этот год будет твоим', 'Узнай себя глубже — ты удивишься, какая ты сильная', 'Для самых важных решений этого года'];
  function certData(c, number) {
    return { number: number || c.number, recipient: c.recipient, from: c.from, title: c.kind === 'amount' ? '' : serviceTitle(c.service), amount: c.kind === 'amount' ? +c.amount : 0, message: c.message, validUntil: c.validUntil || AC.addDays(new Date(), Math.round((+c.months || 12) * 30.44)), style: c.style };
  }
  function certsView() {
    const d = certDraft || (certDraft = { recipient: '', from: '', kind: 'service', service: SITE.services[0].id, amount: 5000, message: MESSAGES[0], months: 12, style: 'velvet' });
    const list = certs().slice().reverse();
    document.getElementById('view').innerHTML = `
      <h2 style="margin-bottom:6px">Подарочные сертификаты</h2>
      <p class="muted small">Заполните поля — превью обновится сразу. «Выдать» присвоит номер, сохранит сертификат в реестр и откроет картинку для отправки.</p>
      <div class="cert-layout">
        <div class="card form" id="certForm">
          <div class="form-row">
            <div class="field"><label for="ctTo">Для кого</label><input class="input" id="ctTo" placeholder="Марии" value="${esc(d.recipient)}"><span class="hint">в родительном падеже: «для Марии»</span></div>
            <div class="field"><label for="ctFrom">От кого (подпись)</label><input class="input" id="ctFrom" placeholder="Анна" value="${esc(d.from)}"></div>
          </div>
          <div class="seg" role="group" aria-label="Что дарим">${[['service', 'Услуга'], ['amount', 'Сумма']].map(([k, t]) => `<button type="button" data-kind="${k}" aria-pressed="${d.kind === k}">${t}</button>`).join('')}</div>
          ${d.kind === 'service'
            ? `<div class="field"><label for="ctSvc">Консультация</label><select class="select" id="ctSvc">${SITE.services.map((x) => `<option value="${x.id}"${x.id === d.service ? ' selected' : ''}>${esc(x.title)}</option>`).join('')}</select></div>`
            : `<div class="field"><label for="ctSum">Сумма, ${esc(SITE.currency || '₽')}</label><input class="input" id="ctSum" type="number" min="500" step="500" value="${+d.amount || 5000}"></div>`}
          <div class="field"><label for="ctMsg">Пожелание</label><textarea class="textarea" id="ctMsg" rows="2">${esc(d.message)}</textarea>
            <div class="row" style="gap:6px;margin-top:6px">${MESSAGES.map((m, i) => `<button type="button" class="chip" data-msg="${i}" style="cursor:pointer;font-size:.76rem;padding:5px 10px">${esc(m.split(' ').slice(0, 4).join(' '))}…</button>`).join('')}</div></div>
          <div class="form-row">
            <div class="field"><label for="ctMonths">Срок действия</label><select class="select" id="ctMonths">${[3, 6, 12].map((n) => `<option value="${n}"${+d.months === n ? ' selected' : ''}>${n} ${fmt.plural(n, 'месяц', 'месяца', 'месяцев')}</option>`).join('')}</select></div>
            <div class="field"><span class="label">Оформление</span><div class="seg" role="group">${[['velvet', 'Бархат'], ['paper', 'Пергамент']].map(([k, t]) => `<button type="button" data-style="${k}" aria-pressed="${d.style === k}">${t}</button>`).join('')}</div></div>
          </div>
          <button class="btn btn-primary" type="button" id="ctIssue">${icon('gift')} Выдать сертификат</button>
        </div>
        <div class="card"><div class="cert-preview" id="ctPreview"></div><p class="tiny muted center" style="margin:10px 0 0">Номер при выдаче: <b>${nextCertNumber()}</b></p></div>
      </div>
      <h3 style="margin-top:26px">Реестр сертификатов</h3>
      ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>№</th><th>Для кого</th><th>Что</th><th>До</th><th>Статус</th><th></th></tr></thead><tbody>
        ${list.map((c) => { const exp = new Date(c.validUntil) < new Date(); const stt = c.status === 'used' ? ['использован', 'ok'] : exp ? ['истёк', 'bad'] : ['активен', 'gold']; return `<tr>
          <td><b>${esc(c.number)}</b></td><td>${esc(c.recipient || '—')}${c.from ? `<br><small class="muted">от ${esc(c.from)}</small>` : ''}</td><td class="wrap">${esc(certTitle(c))}</td><td>${fmt.dateShort(new Date(c.validUntil))} ${new Date(c.validUntil).getFullYear()}</td>
          <td><button type="button" class="badge ${stt[1]}" data-cstat="${c.number}" style="border:0;cursor:pointer" title="Нажмите, чтобы отметить использованным или вернуть">${stt[0]}</button></td>
          <td style="white-space:nowrap"><button class="btn btn-ghost btn-xs" type="button" data-cshow="${c.number}">${icon('eye')}</button> <button class="btn btn-ghost btn-xs" type="button" data-ctext="${c.number}">${icon('copy')}</button> <button class="btn btn-ghost btn-xs" type="button" data-cdel="${c.number}" title="Удалить">${icon('trash')}</button></td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="empty card">Пока ни одного сертификата. Создайте первый — например, к чьему-нибудь дню рождения.</div>'}`;
    const v = document.getElementById('view');
    const read = () => {
      certDraft.recipient = v.querySelector('#ctTo').value.trim();
      certDraft.from = v.querySelector('#ctFrom').value.trim();
      certDraft.message = v.querySelector('#ctMsg').value.trim();
      certDraft.months = +v.querySelector('#ctMonths').value;
      const svc = v.querySelector('#ctSvc'); if (svc) certDraft.service = svc.value;
      const sum = v.querySelector('#ctSum'); if (sum) certDraft.amount = +sum.value;
    };
    const preview = () => { clearTimeout(certTimer); certTimer = setTimeout(async () => { read(); const cv = await window.Cards.certificate(certData(certDraft, nextCertNumber())); const box = document.getElementById('ctPreview'); if (box) { box.innerHTML = ''; box.appendChild(cv); } }, 220); };
    v.querySelector('#certForm').addEventListener('input', preview);
    v.querySelector('#certForm').addEventListener('change', preview);
    v.querySelector('#certForm').addEventListener('click', (e) => {
      const k = e.target.closest('[data-kind]'), st = e.target.closest('[data-style]'), msg = e.target.closest('[data-msg]');
      if (k) { read(); certDraft.kind = k.dataset.kind; certsView(); }
      if (st) { read(); certDraft.style = st.dataset.style; certsView(); }
      if (msg) { v.querySelector('#ctMsg').value = MESSAGES[+msg.dataset.msg]; preview(); }
    });
    v.querySelector('#ctIssue').addEventListener('click', async () => {
      read();
      const number = nextCertNumber();
      const rec = Object.assign({}, certDraft, { number, status: 'active', created: new Date().toISOString(), validUntil: AC.addDays(new Date(), Math.round(certDraft.months * 30.44)).toISOString() });
      const l = certs(); l.push(rec); saveCerts(l);
      const cv = await window.Cards.certificate(certData(rec));
      await window.Cards.show(cv, `sertifikat-${number}.png`, `Сертификат ${number}`, 'Отправьте картинку покупателю. Текст к ней — кнопка копирования в реестре.');
      certsView(); nav();
    });
    preview();
  }
  function certText(c) {
    return `Дарю тебе подарочный сертификат к астрологу ${SITE.name} ✨\n${certTitle(c)}${c.message ? '\n«' + c.message + '»' : ''}\nСертификат № ${c.number}, действителен до ${fmt.date(new Date(c.validUntil))}.\nЧтобы воспользоваться, напиши Алине и назови номер.`;
  }

  // ---------- шаблоны ----------
  function templatesView() {
    const tpl = DB.templates();
    document.getElementById('view').innerHTML = `
      <div class="row between"><h2 style="margin:0">Шаблоны сообщений</h2><button class="btn btn-ghost btn-sm" type="button" data-act="addTpl">${icon('plus')} Шаблон</button></div>
      <p class="muted small" style="margin-top:8px">Подстановки: <code>{имя}</code>, <code>{дата}</code>, <code>{время}</code>, <code>{услуга}</code> — заполняются автоматически, когда копируете из консультации. Изменения сохраняются сами.</p>
      <div class="grid grid-2" style="margin-top:14px">${tpl.map((t, i) => `<div class="card"><input class="input" data-tt="${i}" value="${esc(t.title)}" style="font-weight:700;margin-bottom:8px" aria-label="Название шаблона"><textarea class="textarea" data-tx="${i}" rows="6" aria-label="Текст шаблона">${esc(t.text)}</textarea><div class="row between" style="margin-top:10px"><button class="btn btn-gold btn-xs" type="button" data-copy="${i}">${icon('copy')} Копировать</button><button class="btn btn-ghost btn-xs" type="button" data-deltpl="${i}">${icon('trash')}</button></div></div>`).join('')}</div>
      <div class="card" style="margin-top:18px"><h3>Структура консультации по натальной карте</h3><ol class="small" style="margin:0;padding-left:1.2em">${OUTLINE.map((o) => `<li>${o}</li>`).join('')}</ol><p class="small muted" style="margin:10px 0 0">Этот же чек-лист есть в карточке каждой консультации — можно отмечать пункты по ходу встречи.</p></div>`;
  }

  // ---------- инструменты ----------
  function toolsView() {
    const t = [
      ['natal.html?now=1', '☉&#xFE0E;', 'Карта момента', 'Хорарный вопрос или «что сейчас»: карта на текущую минуту.'],
      ['natal.html', '☽&#xFE0E;', 'Натальная карта', 'Колесо, толкование, PNG и печать.'],
      ['synastry.html', '♀&#xFE0E;', 'Синастрия', 'Совместимость и композит пары.'],
      ['forecast.html', '♃&#xFE0E;', 'Транзиты, соляр, прогрессии', 'Прогноз по месяцам для клиента.'],
      ['#story-moon', '✦', 'Сторис «Луна сегодня»', 'Готовая картинка 1080×1920 для ежедневных сторис.'],
      ['moon.html', '☾&#xFE0E;', 'Лунный календарь', 'Лунные сутки по городу, Луна без курса.'],
      ['sky.html', '℞', 'Ретро и затмения', 'Календарь событий года с тенью ретроградности.'],
      ['horoscope.html', '♈&#xFE0E;', 'Гороскопы по знакам', 'Автоматические тексты на день и месяц.'],
      ['academy.html', '✎', 'Мини-курс', 'Материалы, которые можно давать ученикам.'],
    ];
    document.getElementById('view').innerHTML = `<h2>Инструменты</h2><div class="grid grid-2">${t.map(([h, g, n, d]) => `<a class="card hover tool-tile" style="min-height:0" href="${h}"><span class="t-glyph" style="font-size:1.8rem">${g}</span><h3 style="font-size:1.3rem;margin:0">${n}</h3><p class="small muted" style="margin:0">${d}</p></a>`).join('')}</div>
      <div class="card" style="margin-top:18px"><h3>Где редактировать сайт</h3><p class="small">Рабочие часы, выходные и отпуск для записи — в разделе «Расписание» этого кабинета (файл <code>js/schedule.js</code>). Тексты, цены, контакты, отзывы и вопросы — в файле <code>js/content.js</code>. Толкования планет, знаков, домов и лунных суток — в <code>js/texts.js</code>. Уроки — в <code>js/academy-data.js</code>. Подробная инструкция — в <code>README.md</code>.</p></div>`;
  }

  // ---------- настройки ----------
  function settingsView() {
    const c = DB.clients().length, s = DB.sessions().length;
    // демо-записи могли остаться в этом браузере от прежней версии кабинета — тогда даём их убрать
    const hasDemo = DB.clients().some((x) => x.demo) || DB.sessions().some((x) => x.demo);
    document.getElementById('view').innerHTML = `
      <h2>Настройки</h2>
      <div class="grid grid-2" style="align-items:start">
        <div class="card"><h3>Расчёт карт</h3><div id="setBox"></div><p class="small muted" style="margin-top:12px">Применяется ко всем инструментам сайта на этом устройстве.</p></div>
        <div class="card"><h3>Резервная копия</h3><p class="small">В базе: ${c} ${fmt.plural(c, 'клиент', 'клиента', 'клиентов')}, ${s} ${fmt.plural(s, 'консультация', 'консультации', 'консультаций')}.</p>
          <div class="row"><button class="btn btn-primary btn-sm no-artifact" type="button" data-act="export">${icon('download')} Скачать копию</button><label class="btn btn-ghost btn-sm" style="cursor:pointer">${icon('upload')} Загрузить копию<input type="file" accept=".json,application/json" id="importFile" hidden></label></div>
          <hr class="divider" style="margin:18px 0"><h4>Очистка</h4>
          <div class="row">${hasDemo ? '<button class="btn btn-ghost btn-sm" type="button" data-act="clearDemo">Убрать демо-данные</button>' : ''}<button class="btn btn-ghost btn-sm" type="button" data-act="wipe" style="color:var(--bad)">${icon('trash')} Удалить всё</button></div></div>
      </div>`;
    document.getElementById('setBox').appendChild(CV.settingsForm(() => UI.toast('Настройки сохранены', 'check')));
    document.getElementById('setBox').querySelector('details').open = true;
    document.getElementById('importFile').addEventListener('change', importData);
  }

  function exportData() {
    const data = { app: 'alina-astro-cabinet', version: 1, exported: new Date().toISOString(), clients: DB.clients(), sessions: DB.sessions(), templates: DB.templates(), settings: UI.settings, scheduleDraft: store.get('scheduleDraft', null) };
    UI.download(`kabinet-astrologa-${fmt.ymd(new Date())}.json`, JSON.stringify(data, null, 2), 'application/json');
    UI.toast('Резервная копия сохранена', 'download');
  }
  function importData(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (d.app !== 'alina-astro-cabinet') throw new Error('format');
        const mode = confirm('Объединить с текущими данными? «Отмена» — заменить полностью.');
        const merge = (cur, inc) => { const ids = new Set(cur.map((x) => x.id)); return cur.concat(inc.filter((x) => !ids.has(x.id))); };
        DB.saveClients(mode ? merge(DB.clients(), d.clients || []) : d.clients || []);
        DB.saveSessions(mode ? merge(DB.sessions(), d.sessions || []) : d.sessions || []);
        if (d.templates) DB.saveTemplates(d.templates);
        if (d.scheduleDraft && !store.get('scheduleDraft', null)) store.set('scheduleDraft', d.scheduleDraft);
        UI.toast('Данные загружены', 'check'); show('clients');
      } catch (err) { UI.toast('Это не файл копии кабинета', 'info'); }
    };
    r.readAsText(f);
  }


  if (window.CabinetSchedule) window.CabinetSchedule.init({ DB, sessDate, serviceTitle, clientName, uid, show, nav });
  const VIEWS = { dashboard, clients: clientsView, sessions: sessionsView, schedule: () => window.CabinetSchedule.view(), elect: electView, certs: certsView, templates: templatesView, tools: toolsView, settings: settingsView };

  document.addEventListener('DOMContentLoaded', () => {
    nav(); show(location.hash.slice(1) in VIEWS ? location.hash.slice(1) : 'dashboard');
    document.getElementById('cabNav').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) { history.replaceState(null, '', '#' + b.dataset.view); show(b.dataset.view); } });
    document.getElementById('view').addEventListener('input', (e) => {
      if (viewName !== 'templates') return;
      const l = DB.templates();
      if (e.target.dataset.tt != null) { l[+e.target.dataset.tt].title = e.target.value; DB.saveTemplates(l); }
      if (e.target.dataset.tx != null) { l[+e.target.dataset.tx].text = e.target.value; DB.saveTemplates(l); }
    });
    document.getElementById('view').addEventListener('click', async (e) => {
      const a = e.target.closest('[data-act]');
      const cl = e.target.closest('[data-client]');
      const se = e.target.closest('[data-session]');
      const bd = e.target.closest('[data-bday]');
      if (bd) { e.stopPropagation(); const c = UI.clients.get(bd.dataset.bday); const t = fillTpl(DB.templates().find((x) => x.id === 't5') ? DB.templates().find((x) => x.id === 't5').text : DEFAULT_TEMPLATES[4].text, null, c); if (await UI.copyText(t)) UI.toast('Поздравление скопировано', 'gift'); return; }
      const sm = e.target.closest('a[href="#story-moon"]');
      if (sm) { e.preventDefault(); const cv = await window.Cards.storyMoon(new Date(), UI.defaultCity()); window.Cards.show(cv, 'luna-segodnya.png', 'Сторис «Луна сегодня»', 'Публикуйте каждое утро — город для лунных суток берётся из лунного календаря.'); return; }
      if (a) {
        const k = a.dataset.act;
        if (k === 'newClient') clientForm();
        if (k === 'newSession') sessionForm();
        if (k === 'fromRequest') window.CabinetSchedule.requestDialog();
        if (k === 'export') exportData();
        if (k === 'clearDemo') { DB.saveClients(DB.clients().filter((c) => !c.demo)); DB.saveSessions(DB.sessions().filter((s) => !s.demo)); UI.toast('Демо-данные убраны', 'check'); show(viewName); }
        if (k === 'wipe') { if (confirm('Удалить ВСЕХ клиентов и консультации с этого устройства? Сначала лучше скачать копию.')) { DB.saveClients([]); DB.saveSessions([]); UI.toast('Данные удалены', 'trash'); show(viewName); } }
        if (k === 'addTpl') { const l = DB.templates(); l.push({ id: uid('t'), title: 'Новый шаблон', text: '' }); DB.saveTemplates(l); templatesView(); }
        return;
      }
      const cp = e.target.closest('[data-copy]');
      if (cp) { const t = DB.templates()[+cp.dataset.copy]; if (await UI.copyText(t.text)) UI.toast('Шаблон скопирован', 'check'); return; }
      const dt = e.target.closest('[data-deltpl]');
      if (dt) { if (confirm('Удалить шаблон?')) { const l = DB.templates(); l.splice(+dt.dataset.deltpl, 1); DB.saveTemplates(l); templatesView(); } return; }
      const cst = e.target.closest('[data-cstat]'), csh = e.target.closest('[data-cshow]'), ctx2 = e.target.closest('[data-ctext]'), cdl = e.target.closest('[data-cdel]');
      if (cst) { const l = certs(); const c = l.find((x) => x.number === cst.dataset.cstat); c.status = c.status === 'used' ? 'active' : 'used'; saveCerts(l); certsView(); return; }
      if (csh) { const c = certs().find((x) => x.number === csh.dataset.cshow); const cv = await window.Cards.certificate(certData(c)); window.Cards.show(cv, `sertifikat-${c.number}.png`, `Сертификат ${c.number}`, ''); return; }
      if (ctx2) { const c = certs().find((x) => x.number === ctx2.dataset.ctext); if (await UI.copyText(certText(c))) UI.toast('Текст для отправки скопирован', 'check'); return; }
      if (cdl) { if (cdl.dataset.armed) { saveCerts(certs().filter((x) => x.number !== cdl.dataset.cdel)); certsView(); UI.toast('Сертификат удалён', 'trash'); } else { cdl.dataset.armed = '1'; cdl.innerHTML = 'Точно?'; setTimeout(() => { if (cdl.isConnected) { delete cdl.dataset.armed; cdl.innerHTML = icon('trash'); } }, 3000); } return; }
      const sf = e.target.closest('[data-sf]');
      if (sf) { sessFilter = sf.dataset.sf; sessionsView(); return; }
      if (se) { sessionForm(DB.sessions().find((s) => s.id === se.dataset.session)); return; }
      if (cl) clientCard(cl.dataset.client);
    });
  });
})();
