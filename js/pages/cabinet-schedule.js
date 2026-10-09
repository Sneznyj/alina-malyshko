/* Кабинет → «Расписание»: рабочие часы, выходные и отпуск для календаря записи на сайте; публикация js/schedule.js.
   И «Из заявки»: текст заявки с сайта → клиент и консультация в кабинете. Подключается из cabinet.js (CabinetSchedule.init). */
(function () {
  'use strict';
  const UI = window.UI, SITE = window.SITE, BC = window.BookingCore, BK = window.Booking;
  const { esc, fmt, icon, store } = UI;
  let C = null; // контекст кабинета: DB, sessDate, serviceTitle, show, nav, uid

  const WEEK = [['mon', 'Понедельник', 'Пн'], ['tue', 'Вторник', 'Вт'], ['wed', 'Среда', 'Ср'], ['thu', 'Четверг', 'Чт'], ['fri', 'Пятница', 'Пт'], ['sat', 'Суббота', 'Сб'], ['sun', 'Воскресенье', 'Вс']];
  const DEFAULT_HOURS = '11:00-19:00';
  const clone = (o) => JSON.parse(JSON.stringify(o || {}));
  const pad = (n) => String(n).padStart(2, '0');
  const todayKey = (tz) => BC.partsIn(Date.now(), tz).key;
  const keyDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
  const keyDM = (key) => { const [, m, d] = key.split('-').map(Number); return `${d} ${fmt.MONTHS_GEN[m - 1]}`; };
  const keyDMW = (key) => `${keyDM(key)}, ${fmt.DOW[BC.dowOf(key)].toLowerCase()}`;
  const shortH = (min) => (min % 60 ? BC.hm(min) : String(Math.floor(min / 60)));
  const rangesShort = (rs) => rs.map(([a, b]) => `${shortH(a)}–${shortH(b)}`).join(', ');
  const rangesText = (rs) => rs.map(([a, b]) => `${BC.hm(a)}–${BC.hm(b)}`).join(', ');

  // ---------- черновик и опубликованное ----------
  // Опубликованное — js/schedule.js (window.SCHEDULE) или то, что этот кабинет уже выложил (если сайт ещё не обновился).
  function published() {
    const live = window.SCHEDULE || {};
    const pub = store.get('schedulePublished', null);
    return clone(pub && String(pub.updated || '') > String(live.updated || '') ? pub : live);
  }
  function loadDraft() {
    const d = store.get('scheduleDraft', null);
    // файл из черновика уже на сайте — черновик больше не нужен
    if (d && !d._edited && String((window.SCHEDULE || {}).updated || '') >= String(d.updated || '')) { store.del('scheduleDraft'); return null; }
    return d;
  }
  let S = null; // рабочая копия
  function current() {
    if (!S) S = loadDraft() || published();
    S.week = S.week || {}; S.special = S.special || {}; S.daysOff = S.daysOff || []; S.busy = S.busy || []; S.durations = S.durations || {};
    if (!S.timezone) S.timezone = 'Europe/Minsk';
    return S;
  }
  function commit() {
    S._edited = true;
    store.set('scheduleDraft', S);
    refresh();
  }

  /** Запланированные консультации кабинета → занятое время (по поясу расписания, без имён). */
  function bookedFromSessions(s) {
    const tz = BC.norm(s).timezone, now = Date.now(), out = [];
    for (const x of C.DB.sessions()) {
      if (x.status !== 'planned') continue;
      const st = C.sessDate(x).getTime(), en = st + (+x.duration || 60) * 60000;
      if (!isFinite(st) || en < now) continue;
      const a = BC.partsIn(st, tz), b = BC.partsIn(en, tz);
      out.push(`${a.key} ${BC.hm(a.min)}-${BC.hm(b.key === a.key ? b.min : 1440)}`);
    }
    return Array.from(new Set(out)).sort();
  }
  function futureBooked(list, tz) {
    const now = Date.now();
    return (list || []).filter((x) => { const b = BC.busyOf({ timezone: tz, booked: [x] })[0]; return b && b.end > now; }).sort();
  }
  /** Нужно ли выкладывать: есть правки или консультации из кабинета ещё не закрыты на сайте. */
  function status() {
    const s = current(), pub = published(), tz = BC.norm(s).timezone;
    const draft = store.get('scheduleDraft', null);
    const bookedNow = bookedFromSessions(s);
    const bookedChanged = JSON.stringify(bookedNow) !== JSON.stringify(futureBooked(pub.booked, tz));
    if (draft && draft._edited) return { kind: 'edited', bookedChanged };
    if (draft) return { kind: 'sent', bookedChanged };
    if (bookedChanged) return { kind: 'booked', bookedChanged };
    return { kind: 'ok', bookedChanged };
  }
  const needsPublish = () => { try { return status().kind !== 'ok'; } catch (e) { return false; } };

  /** Убрать прошедшие выходные, особые дни и занятое время. */
  function tidy(s) {
    const t = todayKey(BC.norm(s).timezone);
    s.daysOff = BC.offRanges(s).filter(([, b]) => b >= t).map(([a, b]) => (a === b ? a : `${a}..${b}`));
    for (const k of Object.keys(s.special)) if (k < t) delete s.special[k];
    s.busy = s.busy.filter((x) => String(x).slice(0, 10) >= t);
    return s;
  }
  const q = (v) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const arr = (a) => `[${a.map(q).join(', ')}]`;
  /** Текст файла js/schedule.js. */
  function fileText(s, stamp) {
    const n = BC.norm(s);
    const special = Object.keys(s.special).sort().map((k) => `${q(k)}: ${q(s.special[k])}`).join(', ');
    const durs = Object.keys(s.durations).map((k) => `${/^[a-z_$][\w$]*$/i.test(k) ? k : q(k)}: ${Math.max(0, Math.round(+s.durations[k] || 0))}`).join(', ');
    return `/*
 * ===================== РАСПИСАНИЕ АЛИНЫ =====================
 * Когда клиенты могут записаться через календарь на сайте.
 * Удобнее всего менять в кабинете: «Кабинет астролога» → «Расписание»
 * (там рабочие часы, выходные, отпуск и кнопка «Опубликовать»).
 * Можно и прямо здесь. Всё время ниже — по часовому поясу Алины (timezone):
 * клиент видит свободное время уже в своём часовом поясе, сайт пересчитывает сам.
 * Этот файл собран кабинетом ${fmt.dateTime(new Date(stamp))}.
 * ============================================================
 */
globalThis.SCHEDULE = {
  timezone: ${q(n.timezone)}, // часовой пояс Алины

  // Рабочие часы по дням недели. Несколько промежутков — через запятую: '10:00-14:00, 16:00-20:00'.
  // Пустые кавычки '' — выходной.
  week: {
${WEEK.map(([k, name]) => `    ${k}: ${q(BC.fmtRanges(BC.parseRanges(s.week[k])))}, // ${name.toLowerCase()}`).join('\n')}
  },

  // Выходные и отпуск: один день 'ГГГГ-ММ-ДД' или период 'ГГГГ-ММ-ДД..ГГГГ-ММ-ДД'.
  daysOff: ${arr(s.daysOff)},

  // Особые дни: другие часы в конкретную дату (в том числе работа в обычный выходной).
  special: {${special ? ' ' + special + ' ' : ''}},

  // Занятое время: 'ГГГГ-ММ-ДД ЧЧ:ММ-ЧЧ:ММ'.
  busy: ${arr(s.busy)},
  // Консультации из кабинета (только время, без имён). Кабинет заполняет сам при публикации — руками не править.
  booked: ${arr(bookedFromSessions(s))},

  step: ${n.step},       // начало консультации — каждые столько минут (30 или 60)
  gap: ${n.gap},        // перерыв между консультациями, минут
  minNotice: ${n.minNotice},  // записаться можно не раньше чем через столько часов
  daysAhead: ${n.daysAhead},  // на сколько дней вперёд открыт календарь
  maxPerDay: ${n.maxPerDay},   // не больше стольких консультаций в день (0 — без ограничения)

  // Длительность услуг для календаря, минут. 0 — время встречи не выбирается (письменные услуги, ответ голосовым).
  durations: { ${durs} },

  updated: ${q(new Date(stamp).toISOString())}, // когда расписание меняли (кабинет ставит сам)
};
`;
  }
  /** Подготовить выкладку: чистим прошлое, ставим отметку времени. */
  function prepare() {
    const s = tidy(current());
    const stamp = Date.now();
    s.updated = new Date(stamp).toISOString();
    return { s, text: fileText(s, stamp) };
  }
  function markExported(s) {
    s._edited = false;
    store.set('scheduleDraft', s);
  }

  // ---------- публикация через GitHub ----------
  const repo = () => SITE.githubRepo || 'Sneznyj/alina-malyshko';
  const b64 = (str) => { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  const ghHeaders = (tok) => ({ Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
  const ghUrl = () => `https://api.github.com/repos/${repo()}/contents/js/schedule.js`;
  const GH_ERR = {
    notoken: 'Публикация из кабинета ещё не настроена.',
    auth: 'Ключ не подходит или его срок истёк — создайте новый (шаги ниже).',
    access: `Ключ не видит репозиторий ${repo()} — при создании выберите его в «Repository access».`,
    write: 'У ключа нет права менять файлы: в Permissions → Contents нужно «Read and write».',
    net: 'Нет связи с GitHub. Проверьте интернет и попробуйте ещё раз.',
  };
  async function ghFetch(url, init) {
    try { return await fetch(url, init); } catch (e) { throw new Error('net'); }
  }
  async function ghCheck(tok) {
    const r = await ghFetch(ghUrl() + '?ref=main', { headers: ghHeaders(tok), cache: 'no-store' });
    if (r.status === 401) throw new Error('auth');
    if (r.status === 403 || r.status === 404) throw new Error('access');
    if (!r.ok) throw new Error('http' + r.status);
    return (await r.json()).sha;
  }
  async function ghPublish(text) {
    const tok = store.get('ghToken', '');
    if (!tok) throw new Error('notoken');
    const sha = await ghCheck(tok);
    const r = await ghFetch(ghUrl(), { method: 'PUT', headers: ghHeaders(tok), body: JSON.stringify({ message: 'Расписание записи — из кабинета', content: b64(text), sha, branch: 'main' }) });
    if (r.status === 401) throw new Error('auth');
    if (r.status === 403 || r.status === 404) throw new Error('write');
    if (r.status === 409) throw new Error('http409');
    if (!r.ok) throw new Error('http' + r.status);
  }
  const errText = (e) => GH_ERR[e.message] || `GitHub ответил ошибкой (${String(e.message).replace('http', '')}). Попробуйте ещё раз через минуту.`;

  async function publishNow(btn) {
    const { s, text } = prepare();
    if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = `${icon('refresh')} Публикую…`; }
    try {
      await ghPublish(text);
      const pub = clone(s); delete pub._edited;
      pub.booked = bookedFromSessions(s);
      store.set('schedulePublished', pub);
      store.del('scheduleDraft');
      S = null;
      UI.toast('Расписание опубликовано — на сайте через 1–2 минуты', 'cloud-upload');
      rerender();
    } catch (e) {
      if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = btn.dataset.label; }
      if (e.message === 'notoken') { publishDialog(); return; }
      UI.toast(errText(e), 'info');
      publishDialog(errText(e));
    }
  }

  /** Окно «Опубликовать»: сразу (если настроено), файлом Павлу или настройка ключа. */
  function publishDialog(err) {
    const tok = store.get('ghToken', '');
    const m = UI.modal(`
      <h3>${icon('cloud-upload')} Опубликовать расписание</h3>
      <p class="small muted">Календарь на сайте обновится, когда новое расписание окажется на сайте (файл <code>js/schedule.js</code>).</p>
      ${err ? `<p class="notice">${icon('info')}<span>${esc(err)}</span></p>` : ''}
      ${tok ? `<button class="btn btn-primary btn-block no-artifact" type="button" data-pd="now">${icon('cloud-upload')} Опубликовать сейчас</button>` : ''}
      <div class="card solid" style="margin-top:14px;padding:16px"><h4 style="margin:0 0 6px">Файлом — через Павла</h4>
        <p class="small" style="margin:0 0 10px">Скачайте файл или скопируйте текст и отправьте Павлу: он заменит <code>js/schedule.js</code> и обновит сайт (или попросит Claude «обнови расписание на сайте Алины»).</p>
        <div class="row"><button class="btn btn-ghost btn-sm no-artifact" type="button" data-pd="file">${icon('download')} Скачать schedule.js</button><button class="btn btn-ghost btn-sm" type="button" data-pd="copy">${icon('copy')} Скопировать текст</button></div></div>
      <details class="details-adv no-artifact" style="margin-top:14px"${tok ? '' : ' open'}><summary>${tok ? 'Ключ публикации' : 'Публиковать прямо отсюда — настроить один раз'}</summary>
        <div class="small" style="margin-top:8px">
          <p style="margin:0 0 8px">Тогда кнопка «Опубликовать» будет сама обновлять сайт за 1–2 минуты. Настраивает Павел (владелец сайта на GitHub):</p>
          <ol style="margin:0 0 10px;padding-left:1.2em;display:grid;gap:4px">
            <li>github.com → Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token.</li>
            <li>Repository access: <b>Only select repositories</b> → <b>${esc(repo().split('/')[1] || repo())}</b>. Срок — до года.</li>
            <li>Permissions → Repository permissions → <b>Contents: Read and write</b>. Больше ничего не нужно.</li>
            <li>Скопировать ключ (начинается с <code>github_pat_</code>) и вставить ниже на устройстве Алины.</li>
          </ol>
          <div class="field"><label for="ghTok">Ключ доступа</label><input class="input" id="ghTok" type="password" autocomplete="off" spellcheck="false" placeholder="${tok ? 'сохранён — вставьте новый, чтобы заменить' : 'github_pat_…'}"></div>
          <p class="tiny muted" style="margin:6px 0 10px">Ключ хранится только в этом браузере и даёт доступ только к файлам сайта. Отозвать его можно на GitHub в любой момент.</p>
          <div class="row"><button class="btn btn-primary btn-sm" type="button" data-pd="save">${icon('key')} Проверить и сохранить</button>${tok ? `<button class="btn btn-ghost btn-sm" type="button" data-pd="forget" style="color:var(--bad)">${icon('trash')} Забыть ключ</button>` : ''}</div>
        </div></details>`);
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-pd]'); if (!b) return;
      const k = b.dataset.pd;
      if (k === 'now') { m.close(); publishNow(); }
      if (k === 'file' || k === 'copy') {
        const { s, text } = prepare();
        if (k === 'file') UI.download('schedule.js', text, 'text/javascript;charset=utf-8');
        else if (!(await UI.copyText(text))) { UI.toast('Не получилось скопировать — скачайте файл', 'info'); return; }
        markExported(s);
        UI.toast(k === 'file' ? 'Файл schedule.js скачан — отправьте его Павлу' : 'Текст скопирован — отправьте Павлу', 'check');
        rerender();
      }
      if (k === 'save') {
        const v = m.el.querySelector('#ghTok').value.trim();
        if (!v) { UI.toast('Вставьте ключ', 'key'); return; }
        b.disabled = true;
        try { await ghCheck(v); store.set('ghToken', v); UI.toast('Ключ работает — публикуйте одной кнопкой', 'check'); m.close(); rerender(); }
        catch (err2) { UI.toast(errText(err2), 'info'); }
        b.disabled = false;
      }
      if (k === 'forget') { store.del('ghToken'); UI.toast('Ключ удалён с этого устройства', 'trash'); m.close(); rerender(); }
    });
  }

  /** Перерисовать раздел, только если он сейчас открыт (публикация могла закончиться, когда Алина ушла в другой раздел). */
  function rerender() {
    if (document.getElementById('schedRoot')) render();
    C.nav();
  }

  // ---------- редактор промежутков ----------
  function rangesHTML(ranges, scope) {
    return `<div class="sc-ranges" data-scope="${scope}">${ranges.map(([a, b], i) => `<div class="sc-range"><input class="input" type="time" step="900" value="${BC.hm(a)}" aria-label="С" data-ri="${i}" data-re="s"><span aria-hidden="true">–</span><input class="input" type="time" step="900" value="${BC.hm(b === 1440 ? 1439 : b)}" aria-label="До" data-ri="${i}" data-re="e">${ranges.length > 1 ? `<button class="icon-btn sm" type="button" data-rdel="${i}" aria-label="Убрать промежуток">${icon('close')}</button>` : ''}</div>`).join('')}
      <button class="bk-link" type="button" data-radd>${icon('plus')} промежуток</button></div>`;
  }
  function readRanges(box) {
    const out = [];
    box.querySelectorAll('.sc-range').forEach((row) => {
      const s = BC.toMin(row.querySelector('[data-re="s"]').value), e0 = BC.toMin(row.querySelector('[data-re="e"]').value);
      const e = e0 === 1439 ? 1440 : e0;
      if (s != null && e != null && e > s) out.push([s, e]);
    });
    return out;
  }
  /** Нажатия «+ промежуток» / «×» внутри редактора. Возвращает новые промежутки или null. */
  function rangesClick(e, box) {
    const add = e.target.closest('[data-radd]'), del = e.target.closest('[data-rdel]');
    if (!add && !del) return null;
    const r = readRanges(box);
    if (add) { const last = r[r.length - 1]; const s = last ? Math.min(last[1] + 60, 22 * 60) : 11 * 60; r.push([s, Math.min(s + 120, 1440)]); }
    if (del) r.splice(+del.dataset.rdel, 1);
    return r;
  }

  // ---------- выходные: отпуск и отдельные дни ----------
  function setOff(s, key, off) {
    const list = [];
    for (const [a, b] of BC.offRanges(s)) {
      if (key < a || key > b) { list.push([a, b]); continue; }
      if (a < key) list.push([a, BC.addDays(key, -1)]);
      if (b > key) list.push([BC.addDays(key, 1), b]);
    }
    if (off) list.push([key, key]);
    list.sort((x, y) => (x[0] < y[0] ? -1 : 1));
    s.daysOff = list.map(([a, b]) => (a === b ? a : `${a}..${b}`));
  }
  function exceptions(s) {
    const t = todayKey(BC.norm(s).timezone), out = [];
    for (const [a, b] of BC.offRanges(s)) if (b >= t) out.push({ key: a, html: a === b ? `<b>${keyDMW(a)}</b> — выходной` : `<b>${keyDM(a)} – ${keyDM(b)}</b> — отпуск (${Math.round((keyDate(b) - keyDate(a)) / 86400000) + 1} ${fmt.plural(Math.round((keyDate(b) - keyDate(a)) / 86400000) + 1, 'день', 'дня', 'дней')})`, del: `off:${a}..${b}`, ic: a === b ? 'calendar-off' : 'beach' });
    for (const k of Object.keys(s.special)) if (k >= t) { const r = BC.parseRanges(s.special[k]); out.push({ key: k, html: `<b>${keyDMW(k)}</b> — ${r.length ? 'особые часы ' + rangesText(r) : 'выходной'}`, del: `sp:${k}`, ic: r.length ? 'calendar-time' : 'calendar-off' }); }
    return out.sort((x, y) => (x.key < y.key ? -1 : 1));
  }

  // ---------- мини-календарь месяца ----------
  let month = null;
  function monthHTML(s) {
    const tz = BC.norm(s).timezone, t = todayKey(tz);
    if (!month) month = t.slice(0, 7);
    const [y, m] = month.split('-').map(Number);
    const startDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, nDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const busy = BC.busyOf(Object.assign({}, s, { booked: bookedFromSessions(s) }));
    const minYm = t.slice(0, 7), maxYm = BC.addDays(t, 366).slice(0, 7);
    let cells = WEEK.map((w) => `<span class="dw">${w[2]}</span>`).join('');
    for (let i = 0; i < startDow; i++) cells += '<span></span>';
    for (let d = 1; d <= nDays; d++) {
      const key = BC.keyOf(y, m, d), kind = BC.dayKind(s, key), hrs = BC.hoursFor(s, key);
      const nb = busy.filter((b) => b.key === key).length;
      const label = kind === 'off' ? (BC.offRanges(s).some(([a, b]) => a !== b && key >= a && key <= b) ? 'отпуск' : 'выходной') : kind === 'weekly-off' ? 'вых.' : rangesShort(hrs);
      // в клетке — с какого по какой час; полностью (с перерывами) — в подсказке
      const brief = hrs.length > 1 && kind !== 'off' && kind !== 'weekly-off' ? `${shortH(hrs[0][0])}–${shortH(hrs[hrs.length - 1][1])}` : label;
      const full = kind === 'work' || kind === 'special' ? rangesText(hrs) : label;
      cells += `<button type="button" class="sc-d ${kind}${key < t ? ' past' : ''}${key === t ? ' today' : ''}" data-sday="${key}"${key < t ? ' disabled' : ''} title="${esc(full)}" aria-label="${keyDMW(key)}: ${esc(full)}${nb ? ', занято ' + nb : ''}"><span class="n">${d}${nb ? `<i class="bz">${nb}</i>` : ''}</span><span class="h">${esc(brief)}</span></button>`;
    }
    return `<div class="bk-cal-head"><button type="button" class="bk-nav" data-sm="-1" aria-label="Предыдущий месяц"${month <= minYm ? ' disabled' : ''}>${icon('chevron-left')}</button><b>${fmt.MONTHS[m - 1]} ${y}</b><button type="button" class="bk-nav" data-sm="1" aria-label="Следующий месяц"${month >= maxYm ? ' disabled' : ''}>${icon('chevron-right')}</button></div>
      <div class="sc-grid">${cells}</div>
      <p class="sc-legend tiny muted"><span><i class="lg work"></i>рабочий</span><span><i class="lg special"></i>особые часы</span><span><i class="lg off"></i>выходной / отпуск</span><span><i class="bz">1</i>занято</span></p>`;
  }
  /** Окно одного дня: как обычно / выходной / другие часы. */
  function dayDialog(key) {
    const s = current(), tz = BC.norm(s).timezone;
    const weekly = BC.parseRanges(s.week[BC.DOW_KEYS[BC.dowOf(key)]]);
    const kind = BC.dayKind(s, key);
    const inVac = BC.offRanges(s).find(([a, b]) => a !== b && key >= a && key <= b);
    const cur = kind === 'special' ? 'special' : kind === 'off' ? 'off' : 'normal';
    const rs = kind === 'special' ? BC.parseRanges(s.special[key]) : weekly.length ? weekly : BC.parseRanges(DEFAULT_HOURS);
    const booked = C.DB.sessions().filter((x) => x.status === 'planned' && BC.partsIn(C.sessDate(x).getTime(), tz).key === key);
    const m = UI.modal(`
      <h3 style="margin-bottom:4px">${esc(keyDMW(key).replace(/^./, (c) => c.toUpperCase()))}</h3>
      <p class="small muted" style="margin:0 0 14px">По графику: ${weekly.length ? rangesText(weekly) : 'выходной'}${inVac ? ` · сейчас часть отпуска ${keyDM(inVac[0])} – ${keyDM(inVac[1])}` : ''}</p>
      <div class="sc-choice" role="radiogroup">
        <label class="check"><input type="radio" name="dk" value="normal"${cur === 'normal' ? ' checked' : ''}> <span>Как обычно${weekly.length ? ` — ${rangesText(weekly)}` : ' — выходной по графику'}</span></label>
        <label class="check"><input type="radio" name="dk" value="off"${cur === 'off' ? ' checked' : ''}> <span>Выходной — в этот день записи нет</span></label>
        <label class="check"><input type="radio" name="dk" value="special"${cur === 'special' ? ' checked' : ''}> <span>Другие часы в этот день</span></label>
      </div>
      <div class="sc-day-ranges" id="dkRanges"${cur === 'special' ? '' : ' hidden'}>${rangesHTML(rs, 'day')}</div>
      ${booked.length ? `<p class="notice info" style="margin-top:14px">${icon('calendar-check')}<span>В этот день запланировано: ${booked.map((x) => `${fmt.time(C.sessDate(x))} — ${esc(C.clientName(x.clientId))}`).join('; ')}.</span></p>` : ''}
      <div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn btn-primary btn-sm" type="button" data-dk="save">Сохранить</button></div>`);
    const box = m.el.querySelector('#dkRanges');
    m.el.addEventListener('change', (e) => { if (e.target.name === 'dk') { box.hidden = e.target.value !== 'special'; if (!box.hidden) UI.fadeIn(box, 6); } });
    m.el.addEventListener('click', (e) => {
      const r = rangesClick(e, box.querySelector('.sc-ranges'));
      if (r) { box.innerHTML = rangesHTML(r.length ? r : BC.parseRanges(DEFAULT_HOURS), 'day'); return; }
      if (!e.target.closest('[data-dk="save"]')) return;
      const v = m.el.querySelector('input[name=dk]:checked').value;
      const s2 = current();
      delete s2.special[key];
      if (v === 'normal') setOff(s2, key, false);
      if (v === 'off') { if (weekly.length) setOff(s2, key, true); else setOff(s2, key, false); }
      if (v === 'special') {
        setOff(s2, key, false);
        const rr = readRanges(box.querySelector('.sc-ranges'));
        if (rr.length) s2.special[key] = BC.fmtRanges(rr); else setOff(s2, key, true);
      }
      m.close(); commit();
      UI.toast(v === 'off' ? `${keyDM(key)} — выходной` : v === 'special' ? `${keyDM(key)} — особые часы` : `${keyDM(key)} — как обычно`, 'calendar-time');
    });
  }

  // ---------- раздел ----------
  let preview = null;
  const weekMemo = {};
  function selectHTML(id, val, opts) { return `<select class="select" data-rule="${id}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(val) ? ' selected' : ''}>${t}</option>`).join('')}</select>`; }
  function statusHTML() {
    const st = status(), pub = published();
    const when = pub.updated ? fmt.dmTime(new Date(pub.updated)) : '';
    const hasTok = !!store.get('ghToken', '');
    const btn = `<button class="btn btn-primary btn-sm" type="button" data-sc="publish">${icon('cloud-upload')} Опубликовать${hasTok ? '' : '…'}</button>`;
    if (st.kind === 'edited') return `<div class="sc-bar warn">${icon('info')}<div><b>Есть изменения — на сайте пока старое расписание</b><small>Изменения сохранены в этом браузере. Нажмите «Опубликовать», чтобы календарь на сайте обновился.</small></div>${btn}<button class="btn btn-ghost btn-xs" type="button" data-sc="reset">${icon('arrow-back-up')} Отменить правки</button></div>`;
    if (st.kind === 'sent') return `<div class="sc-bar gold">${icon('calendar-time')}<div><b>Файл отправлен — ждёт выкладки на сайт</b><small>Как только Павел обновит сайт, эта плашка исчезнет сама.${st.bookedChanged ? ' После отправки появились новые консультации — можно отправить ещё раз.' : ''}</small></div>${btn}</div>`;
    if (st.kind === 'booked') return `<div class="sc-bar gold">${icon('calendar-check')}<div><b>Новые консультации из кабинета ещё не закрыты на сайте</b><small>Опубликуйте — их время исчезнет из календаря записи, чтобы на него никто не записался.</small></div>${btn}</div>`;
    return `<div class="sc-bar ok">${icon('circle-check')}<div><b>На сайте актуальное расписание</b><small>${when ? 'Обновлено ' + when + '. ' : ''}Меняйте часы и выходные ниже — потом «Опубликовать».</small></div></div>`;
  }
  function weekRowHTML(s, k, name) {
    const rs = BC.parseRanges(s.week[k]);
    return `<div class="sc-wk" data-wk="${k}"><label class="switch"><input type="checkbox" data-wkon${rs.length ? ' checked' : ''}> <span>${name}</span></label>
      <div class="sc-wk-body">${rs.length ? rangesHTML(rs, k) : '<span class="small muted">выходной</span>'}</div></div>`;
  }
  function render() {
    const view = document.getElementById('view');
    const s = current(), n = BC.norm(s);
    const offset = BK.tzLabel(n.timezone);
    const tz = UI.timeZones().includes(n.timezone) ? UI.timeZones() : UI.timeZones().concat([n.timezone]);
    const svcs = SITE.services.map((x) => [x.id, x.title]).concat([['lessons', 'Индивидуальные уроки']]);
    const exc = exceptions(s);
    const planned = C.DB.sessions().filter((x) => x.status === 'planned' && C.sessDate(x).getTime() + (+x.duration || 60) * 60000 > Date.now()).sort((a, b) => C.sessDate(a) - C.sessDate(b));
    const t = todayKey(n.timezone);
    view.innerHTML = `<div id="schedRoot">
      <div class="row between"><h2 style="margin:0">Расписание</h2><button class="btn btn-ghost btn-sm" type="button" data-act="fromRequest">${icon('clipboard-plus')} Заявку — в кабинет</button></div>
      <p class="muted small" style="margin:8px 0 14px">Здесь вы решаете, когда клиенты могут записаться через календарь на сайте. Часы — по вашему времени (<b>${esc(offset)}</b>), клиенты видят их уже в своём часовом поясе.</p>
      <div id="scStatus">${statusHTML()}</div>
      <div class="grid grid-2 sc-top" style="align-items:start;margin-top:16px">
        <div class="card reveal"><h3>${icon('calendar-time')} Рабочая неделя</h3>
          <p class="small muted" style="margin-top:-4px">Когда вы готовы проводить консультации. Выключите день — он станет выходным.</p>
          <div class="sc-week" id="scWeek">${WEEK.map(([k, , sh]) => weekRowHTML(s, k, sh)).join('')}</div></div>
        <div class="card reveal" style="--d:.05s"><h3>${icon('beach')} Выходные и отпуск</h3>
          <p class="small muted" style="margin-top:-4px">Нажмите на день, чтобы сделать его выходным или поставить другие часы.</p>
          <div class="sc-cal" id="scCal">${monthHTML(s)}</div>
          <div class="sc-vac"><span class="label">Отпуск</span><div class="sc-vac-row"><input class="input" type="date" id="vacFrom" min="${t}" aria-label="Отпуск с"><span aria-hidden="true">–</span><input class="input" type="date" id="vacTo" min="${t}" aria-label="Отпуск по"><button class="btn btn-ghost btn-sm" type="button" data-sc="vac">${icon('plus')} Добавить</button></div></div>
          <div class="sc-exc" id="scExc">${excHTML(exc)}</div></div>
      </div>
      <div class="grid grid-2" style="align-items:start;margin-top:18px">
        <div class="card reveal"><h3>${icon('settings')} Правила записи</h3><div class="form" style="gap:12px">
          <div class="field"><label>Ваш часовой пояс</label><select class="select" data-rule="timezone">${tz.map((z) => `<option${z === n.timezone ? ' selected' : ''}>${esc(z)}</option>`).join('')}</select></div>
          <div class="form-row"><div class="field"><label>Начало консультаций</label>${selectHTML('step', n.step, [[30, 'каждые 30 минут'], [60, 'каждый час']])}</div>
            <div class="field"><label>Перерыв между ними</label>${selectHTML('gap', n.gap, [[0, 'без перерыва'], [15, '15 минут'], [30, '30 минут'], [45, '45 минут'], [60, '1 час']])}</div></div>
          <div class="form-row"><div class="field"><label>Записаться не позже чем за</label>${selectHTML('minNotice', n.minNotice, [[2, '2 часа'], [6, '6 часов'], [12, '12 часов'], [24, 'сутки'], [48, '2 дня']])}</div>
            <div class="field"><label>Календарь открыт на</label>${selectHTML('daysAhead', n.daysAhead, [[7, 'неделю'], [14, '2 недели'], [21, '3 недели'], [30, 'месяц'], [45, '1,5 месяца'], [60, '2 месяца'], [90, '3 месяца']])}</div></div>
          <div class="field"><label>Не больше консультаций в день</label>${selectHTML('maxPerDay', n.maxPerDay, [[0, 'без ограничения'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']])}</div>
        </div></div>
        <div class="card reveal" style="--d:.05s"><h3>${icon('clock')} Длительность услуг</h3>
          <p class="small muted" style="margin-top:-4px">Сколько минут занимает встреча. 0 — клиент не выбирает время (письменные услуги, ответ голосовым).</p>
          <div class="sc-durs">${svcs.map(([id, title]) => `<label class="sc-dur"><span>${esc(title)}</span><input class="input" type="number" min="0" max="480" step="15" value="${Math.max(0, +s.durations[id] || 0)}" data-dur="${id}" aria-label="${esc(title)}, минут"><small>мин</small></label>`).join('')}</div></div>
      </div>
      <div class="card reveal" style="margin-top:18px"><h3>${icon('calendar-check')} Занятое время</h3>
        <div class="grid grid-2" style="align-items:start;gap:20px">
          <div><h4 style="margin:0 0 6px">Консультации из кабинета</h4><p class="small muted" style="margin:0 0 10px">Закрываются на сайте сами при публикации — без имён, только время.</p>
            <div class="sc-list">${planned.slice(0, 12).map((x) => `<div class="sc-li">${icon('calendar-check')}<span>${fmt.dmTime(C.sessDate(x))} · ${esc(C.clientName(x.clientId))} <small class="muted">${esc(C.serviceTitle(x.service))}</small></span></div>`).join('') || '<p class="small muted">Запланированных консультаций нет.</p>'}</div></div>
          <div><h4 style="margin:0 0 6px">Занято по другим делам</h4><p class="small muted" style="margin:0 0 10px">Например, приём у врача или встреча: это время клиенты не увидят.</p>
            <div class="sc-busy-add"><input class="input" type="date" id="bzDate" min="${t}" aria-label="Дата"><input class="input" type="time" id="bzFrom" step="900" value="14:00" aria-label="С"><span aria-hidden="true">–</span><input class="input" type="time" id="bzTo" step="900" value="16:00" aria-label="До"><button class="btn btn-ghost btn-sm" type="button" data-sc="busy">${icon('plus')}</button></div>
            <div class="sc-list" id="scBusy">${busyHTML(s)}</div></div>
        </div></div>
      <div class="card reveal" style="margin-top:18px"><h3>${icon('eye')} Так клиенты видят календарь</h3>
        <p class="small muted" style="margin-top:-4px">Предпросмотр с вашими правками — ещё до публикации. Время здесь показано по часовому поясу этого устройства.</p>
        <div id="scPreview"></div></div>
    </div>`;
    preview = BK.widget(view.querySelector('#scPreview'), { prefix: 'pv', preview: true, scrollTop: false, schedule: () => Object.assign({}, current(), { booked: bookedFromSessions(current()) }) });
    bind(view.querySelector('#schedRoot'));
  }
  function excHTML(exc) {
    return exc.length ? `<div class="sc-list">${exc.map((x) => `<div class="sc-li">${icon(x.ic)}<span>${x.html}</span><button class="icon-btn sm" type="button" data-exdel="${esc(x.del)}" aria-label="Убрать">${icon('close')}</button></div>`).join('')}</div>` : '<p class="small muted" style="margin:10px 0 0">Отдельных выходных и отпуска пока нет.</p>';
  }
  function busyHTML(s) {
    const t = todayKey(BC.norm(s).timezone);
    const list = s.busy.filter((x) => String(x).slice(0, 10) >= t).sort();
    return list.map((x) => { const m = /^(\d{4}-\d{2}-\d{2})\s*(.*)$/.exec(x); return `<div class="sc-li">${icon('clock')}<span><b>${m ? keyDMW(m[1]) : esc(x)}</b>${m && m[2] ? ', ' + esc(m[2].replace('-', '–')) : ', весь день'}</span><button class="icon-btn sm" type="button" data-bzdel="${esc(x)}" aria-label="Убрать">${icon('close')}</button></div>`; }).join('') || '<p class="small muted">Пусто.</p>';
  }
  /** Перерисовать всё, что зависит от расписания, не трогая поля, где сейчас курсор. */
  function refresh() {
    const s = current();
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    set('scStatus', statusHTML());
    set('scCal', monthHTML(s));
    set('scExc', excHTML(exceptions(s)));
    set('scBusy', busyHTML(s));
    if (preview) preview.refresh();
    C.nav();
  }
  function bind(root) {
    root.addEventListener('change', (e) => {
      const t = e.target, s = current();
      const wk = t.closest('[data-wk]');
      if (wk && t.matches('[data-wkon]')) {
        const k = wk.dataset.wk;
        if (t.checked) s.week[k] = weekMemo[k] || DEFAULT_HOURS; else { weekMemo[k] = s.week[k]; s.week[k] = ''; }
        wk.outerHTML = weekRowHTML(s, k, WEEK.find((w) => w[0] === k)[2]);
        commit(); return;
      }
      if (wk && t.matches('[data-re]')) {
        const r = readRanges(wk.querySelector('.sc-ranges'));
        if (r.length) { s.week[wk.dataset.wk] = BC.fmtRanges(r); commit(); } else UI.toast('Время «до» должно быть позже, чем «с»', 'clock');
        return;
      }
      if (t.dataset.rule) { s[t.dataset.rule] = t.dataset.rule === 'timezone' ? t.value : +t.value; commit(); return; }
      if (t.dataset.dur) { s.durations[t.dataset.dur] = Math.max(0, Math.min(480, Math.round(+t.value || 0))); commit(); }
    });
    root.addEventListener('click', (e) => {
      const s = current();
      const wk = e.target.closest('[data-wk]');
      if (wk) {
        const r = rangesClick(e, wk.querySelector('.sc-ranges'));
        if (r) { s.week[wk.dataset.wk] = BC.fmtRanges(r); wk.outerHTML = weekRowHTML(s, wk.dataset.wk, WEEK.find((w) => w[0] === wk.dataset.wk)[2]); commit(); return; }
      }
      const sm = e.target.closest('[data-sm]');
      if (sm) { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + +sm.dataset.sm, 1)); month = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; document.getElementById('scCal').innerHTML = monthHTML(s); UI.fadeIn(document.getElementById('scCal'), 4); return; }
      const day = e.target.closest('[data-sday]');
      if (day && !day.disabled) { dayDialog(day.dataset.sday); return; }
      const ex = e.target.closest('[data-exdel]');
      if (ex) {
        const v = ex.dataset.exdel;
        if (v.startsWith('sp:')) delete s.special[v.slice(3)];
        else { const [a, b] = v.slice(4).split('..'); s.daysOff = BC.offRanges(s).filter(([x, y]) => !(x === a && y === b)).map(([x, y]) => (x === y ? x : `${x}..${y}`)); }
        commit(); return;
      }
      const bz = e.target.closest('[data-bzdel]');
      if (bz) { s.busy = s.busy.filter((x) => x !== bz.dataset.bzdel); commit(); return; }
      const a = e.target.closest('[data-sc]');
      if (!a) return;
      const k = a.dataset.sc;
      if (k === 'publish') { if (store.get('ghToken', '')) publishNow(a); else publishDialog(); }
      if (k === 'reset') { if (!confirm('Отменить все неопубликованные правки расписания?')) return; store.del('scheduleDraft'); S = null; render(); C.nav(); UI.toast('Правки отменены', 'arrow-back-up'); }
      if (k === 'vac') {
        let f = root.querySelector('#vacFrom').value, to = root.querySelector('#vacTo').value || f;
        if (!f) { UI.toast('Укажите, с какого дня отпуск', 'calendar'); return; }
        if (to < f) [f, to] = [to, f];
        for (const key of Object.keys(s.special)) if (key >= f && key <= to) delete s.special[key];
        s.daysOff.push(f === to ? f : `${f}..${to}`);
        commit(); UI.toast(f === to ? `${keyDM(f)} — выходной` : `Отпуск ${keyDM(f)} – ${keyDM(to)} добавлен`, 'beach');
      }
      if (k === 'busy') {
        const d = root.querySelector('#bzDate').value, fr = BC.toMin(root.querySelector('#bzFrom').value), to = BC.toMin(root.querySelector('#bzTo').value);
        if (!d) { UI.toast('Выберите дату', 'calendar'); return; }
        if (fr == null || to == null || to <= fr) { UI.toast('Время «до» должно быть позже, чем «с»', 'clock'); return; }
        s.busy.push(`${d} ${BC.hm(fr)}-${BC.hm(to)}`); s.busy.sort();
        commit(); UI.toast('Время отмечено занятым', 'check');
      }
    });
  }

  // ---------- заявка с сайта → клиент и консультация ----------
  const norm = (x) => String(x || '').toLowerCase().replace(/ё/g, 'е').trim();
  function parseRequest(text) {
    const get = (label) => { const m = new RegExp('^\\s*' + label + '\\s*:\\s*(.+)$', 'mi').exec(text); return m ? m[1].trim() : ''; };
    const svcs = SITE.services.map((x) => [x.id, x.title]).concat([['lessons', 'Индивидуальные уроки астрологии'], ['course', 'Курс «Астрология с нуля»'], ['gift', 'Подарочный сертификат'], ['other', 'Другое / пока не знаю']]);
    const svcT = get('Услуга');
    const svc = svcs.find(([, t]) => norm(t) === norm(svcT)) || svcs.find(([, t]) => svcT && norm(t).startsWith(norm(svcT).slice(0, 12)));
    const r = { name: get('Имя'), contact: get('Связь'), service: svc ? svc[0] : 'other', serviceTitle: svc ? svc[1] : svcT, question: get('Запрос'), prefer: get('Мне удобно'), clientTz: get('Мой часовой пояс'), start: null, end: null };
    if (r.clientTz && !BC.validTz(r.clientTz)) r.clientTz = '';
    const tz = BC.norm(current()).timezone;
    const tm = /(\d{2})\.(\d{2})\.(\d{4}),?\s*(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/;
    const own = get('По вашему времени[^:]*'), gen = get('Время');
    const m = tm.exec(own) || (/одинаковое время/.test(gen) || !r.clientTz ? tm.exec(gen) : null);
    if (m) {
      const key = `${m[3]}-${m[2]}-${m[1]}`;
      r.start = BC.wallToUtc(key, +m[4] * 60 + +m[5], tz);
      r.end = BC.wallToUtc(key, +m[6] * 60 + +m[7], tz);
      if (r.end <= r.start) r.end += 86400000;
    } else if (!own && r.clientTz) {
      // время клиента без строки «по вашему времени» — пересчитываем из его пояса
      const g = tm.exec(gen);
      if (g) { const key = `${g[3]}-${g[2]}-${g[1]}`; r.start = BC.wallToUtc(key, +g[4] * 60 + +g[5], r.clientTz); r.end = BC.wallToUtc(key, +g[6] * 60 + +g[7], r.clientTz); }
    }
    const bm = /(\d{2})\.(\d{2})\.(\d{4})(?:,\s*(\d{1,2}):(\d{2}))?(?:,\s*(.+))?/.exec(get('Дата рождения'));
    if (bm) {
      r.birthText = get('Дата рождения');
      const place = (bm[6] || '').trim();
      const city = place && UI.CITIES.find((c) => norm(c.name) === norm(place));
      if (city) r.birth = { name: r.name, y: +bm[3], mo: +bm[2], d: +bm[1], h: bm[4] ? +bm[4] : 12, mi: bm[5] ? +bm[5] : 0, timeKnown: !!bm[4], lat: city.lat, lon: city.lon, zone: city.tz, place: city.name };
    }
    return r;
  }
  function requestDialog() {
    const m = UI.modal(`
      <h3>${icon('clipboard-plus')} Заявка с сайта → в кабинет</h3>
      <p class="small muted">Скопируйте текст заявки из Telegram, WhatsApp или почты и вставьте сюда — клиент и консультация заполнятся сами.</p>
      <textarea class="textarea" id="rqText" rows="8" placeholder="Здравствуйте, Алина! Хочу записаться ✨&#10;Имя: …&#10;Связь: …"></textarea>
      <div id="rqPrev" style="margin-top:12px"></div>
      <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn btn-primary btn-sm" type="button" id="rqAdd" disabled>${icon('plus')} Добавить в кабинет</button></div>`, { wide: true });
    const ta = m.el.querySelector('#rqText'), prev = m.el.querySelector('#rqPrev'), add = m.el.querySelector('#rqAdd');
    let parsed = null;
    const existing = (r) => C.DB.clients().find((c) => (r.contact && norm(c.contact) === norm(r.contact)) || (r.name && norm(c.name) === norm(r.name)));
    ta.addEventListener('input', () => {
      parsed = ta.value.trim() ? parseRequest(ta.value) : null;
      if (!parsed || !parsed.name) { prev.innerHTML = ta.value.trim() ? `<p class="notice">${icon('info')}<span>Не нашла строку «Имя: …» — это точно текст заявки с сайта?</span></p>` : ''; add.disabled = true; return; }
      const ex = existing(parsed);
      const when = parsed.start ? `${fmt.DOW_LONG[new Date(parsed.start).getDay()]}, ${fmt.dmTime(new Date(parsed.start))}–${fmt.time(new Date(parsed.end))} <small class="muted">(по времени этого устройства)</small>` : parsed.prefer ? `подобрать: «${esc(parsed.prefer)}»` : 'не выбрано — договоритесь в переписке';
      prev.innerHTML = `<div class="sc-list">
        <div class="sc-li">${icon('user')}<span><b>${esc(parsed.name)}</b>${parsed.contact ? ' · ' + esc(parsed.contact) : ''} — ${ex ? 'уже есть в кабинете' : 'новый клиент'}</span></div>
        <div class="sc-li">${icon('sparkle')}<span>${esc(parsed.serviceTitle || 'услуга не указана')}</span></div>
        <div class="sc-li">${icon('calendar-time')}<span>${when}</span></div>
        ${parsed.clientTz ? `<div class="sc-li">${icon('world-pin')}<span>Часовой пояс клиента: ${esc(BK.tzLabel(parsed.clientTz))} — в шаблонах время будет по его часам</span></div>` : ''}
        ${parsed.birthText ? `<div class="sc-li">${icon('planet')}<span>Рождение: ${esc(parsed.birthText)} — ${parsed.birth ? 'карта построится' : 'город не нашла в списке, запишу в заметки'}</span></div>` : ''}</div>`;
      add.disabled = false;
    });
    add.addEventListener('click', () => {
      if (!parsed || !parsed.name) return;
      let c = existing(parsed);
      const notes = [parsed.question && 'Запрос: ' + parsed.question, parsed.prefer && 'Удобное время: ' + parsed.prefer, !parsed.birth && parsed.birthText && 'Рождение: ' + parsed.birthText].filter(Boolean).join('\n');
      if (!c) c = UI.clients.add({ name: parsed.name, contact: parsed.contact, tags: ['с сайта'], notes, birth: parsed.birth || null });
      else if (notes) { const l = C.DB.clients(); const i = l.findIndex((x) => x.id === c.id); l[i].notes = [l[i].notes, notes].filter(Boolean).join('\n'); C.DB.saveClients(l); }
      const svc = SITE.services.find((x) => x.id === parsed.service);
      const dur = parsed.start ? Math.round((parsed.end - parsed.start) / 60000) : (BK.durationOf(current(), parsed.service) || 60);
      const d = parsed.start ? new Date(parsed.start) : null;
      // консультация — только когда время выбрано; иначе запланированная «на сегодня» закрыла бы на сайте чужое время
      if (d) {
        const list = C.DB.sessions();
        list.push({ id: C.uid('s'), created: new Date().toISOString(), clientId: c.id, service: parsed.service, date: fmt.ymd(d), time: fmt.time(d), duration: dur, price: svc ? svc.price : 0, status: 'planned', paid: false, notes: parsed.question ? 'Запрос: ' + parsed.question : '', clientTz: parsed.clientTz || '' });
        C.DB.saveSessions(list);
      }
      m.close();
      UI.toast(d ? 'Клиент и консультация добавлены — опубликуйте расписание, чтобы закрыть это время на сайте' : 'Клиент добавлен. Когда договоритесь о времени — добавьте консультацию', 'check');
      C.show(d ? 'schedule' : 'clients');
    });
    setTimeout(() => ta.focus(), 80);
  }

  window.CabinetSchedule = {
    init(ctx) { C = ctx; },
    view() { S = null; render(); },
    needsPublish,
    requestDialog,
    parseRequest,
  };
})();
