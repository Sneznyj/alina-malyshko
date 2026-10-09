/* Нумерология: дата и имя → главные числа, квадрат Пифагора, личный год; основы, значения чисел, вопросы.
   Расчёты — js/numerology.js, тексты — js/numerology-data.js. */
(function () {
  'use strict';
  const UI = window.UI, N = window.Numerology, TX = window.NUMEROLOGY_TEXTS;
  const { esc, fmt, icon } = UI;
  const $ = (id) => document.getElementById(id);
  const LIST = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];
  const pl = (n, a, b, c) => fmt.plural(n, a, b, c);
  let res = null, tile = 'birthday', cell = 1, monthSel = null;

  // ---------- помощники вида ----------
  /** Число в кольце: размер s — 'xl' | 'm' | 's'. */
  const orb = (v, s) => `<span class="num-orb ${s || ''}${TX.numbers[v] && TX.numbers[v].master ? ' master' : ''}" aria-hidden="true">${v}</span>`;
  const chips = (arr, cls) => `<div class="num-chips">${arr.map((x) => `<span class="num-chip ${cls || ''}">${esc(x)}</span>`).join('')}</div>`;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const chainText = (c) => c.join(' → ');
  const level = (k, v) => { const t = TX.lines[k].t; return v <= t[0] ? 'weak' : v <= t[1] ? 'mid' : 'strong'; };
  const LEVEL = { weak: 'выражено мягко', mid: 'выражено средне', strong: 'выражено ярко' };

  // ---------- расчёт ----------
  function calc(name, iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const now = new Date();
    const lp = N.lifePath(y, m, d), bd = N.birthday(d), nm = N.nameNumbers(name);
    const py = N.personalYear(m, d, now.getFullYear());
    const pm = N.personalMonth(py.value, now.getMonth() + 1);
    return {
      name: name.trim(), iso, y, m, d, lp, bd, nm, py, pm,
      pd: N.personalDay(pm, now.getDate()),
      pyNext: N.personalYear(m, d, now.getFullYear() + 1),
      sq: N.pythagoras(y, m, d), year: now.getFullYear(), month: now.getMonth() + 1,
    };
  }

  // ---------- вкладка «Главные числа» ----------
  function lifeHero(r) {
    const t = TX.numbers[r.lp.value];
    const L = r.lp;
    const how = `День ${String(r.d).padStart(2, '0')} → ${chainText(L.day.chain)} · месяц ${String(r.m).padStart(2, '0')} → ${chainText(L.month.chain)} · год ${chainText(L.year.chain)} · ${L.day.value} + ${L.month.value} + ${L.year.value} = ${chainText(L.chain)}`;
    return `<div class="num-hero">
        ${orb(r.lp.value, 'xl')}
        <div class="num-hero-text">
          <span class="num-label">Число жизненного пути${t.master ? ' · мастер-число' : ''}</span>
          <h3>${esc(t.name)}</h3>
          <p class="num-keys">${esc(t.keys)}</p>
          <p>${esc(t.essence)}</p>
        </div>
      </div>
      <div class="grid grid-2 num-sw">
        <div><h4>${icon('star')} Сильные стороны</h4>${chips(t.strengths)}</div>
        <div><h4>${icon('leaf')} Зона роста</h4>${chips(t.growth, 'soft')}</div>
      </div>
      <p class="num-advice">${esc(t.advice)}</p>
      <details class="details-adv num-how"><summary>Как посчитано</summary><p class="small">${how}.</p>
        <p class="small muted">День, месяц и год сводятся к одной цифре отдельно, потом складываются. Мастер-числа 11, 22 и 33 не сокращаются.</p></details>`;
  }
  const TILES = [
    ['birthday', 'cake', 'День рождения', (r) => r.bd.value, (r) => TX.numbers[r.bd.value].keys],
    ['expression', 'signature', 'Число имени', (r) => r.nm && r.nm.expression.value, (r) => r.nm && TX.numbers[r.nm.expression.value].keys],
    ['soul', 'heart', 'Число души', (r) => r.nm && r.nm.soul && r.nm.soul.value, (r) => r.nm && r.nm.soul && TX.numbers[r.nm.soul.value].keys],
    ['personality', 'mask', 'Число личности', (r) => r.nm && r.nm.personality && r.nm.personality.value, (r) => r.nm && r.nm.personality && TX.numbers[r.nm.personality.value].keys],
    ['year', 'calendar-repeat', `Личный год ${new Date().getFullYear()}`, (r) => r.py.value, (r) => TX.years[r.py.value].title.toLowerCase()],
  ];
  function tilesHTML(r) {
    return `<div class="num-tiles" role="group" aria-label="Числа">${TILES.map(([k, ic, title, val, keys]) => {
      const v = val(r);
      return `<button type="button" class="num-tile${tile === k ? ' sel' : ''}${v ? '' : ' empty'}" data-tile="${k}" aria-pressed="${tile === k}">
        ${v ? orb(v, 's') : `<span class="num-orb s ghost" aria-hidden="true">?</span>`}
        <span class="nt-text"><span class="nt-title">${icon(ic)}${title}</span><span class="nt-keys">${v ? esc(keys(r)) : 'добавьте имя'}</span></span>
      </button>`;
    }).join('')}</div><div class="num-detail" id="numDetail">${tileDetail(r)}</div>`;
  }
  function lettersHTML(nm) {
    return nm.words.map((w) => `<span class="nl-word">${w.letters.map((l) => `<span class="nl${l.vowel ? ' v' : ''}" title="${l.vowel ? 'гласная' : 'согласная'}">${esc(l.ch)}<sub>${l.v}</sub></span>`).join('')}<span class="nl-sum">= ${w.sum}</span></span>`).join('');
  }
  function tileDetail(r) {
    const askName = `<p class="muted">Числа имени считаются по буквам полного имени при рождении. <button type="button" class="bk-link" data-focus-name>Добавить имя</button></p>`;
    if (tile === 'birthday') {
      const t = TX.numbers[r.bd.value];
      return `<h4>${orb(r.bd.value, 's')} Число дня рождения — ${esc(t.name)}</h4>
        <p>Дар вашего дня рождения — ${esc(t.day)}. Это число добавляет к жизненному пути оттенок: <i>${esc(t.keys)}</i>.</p>
        <p class="small muted">Считается по дню месяца: ${r.d}${r.bd.chain.length > 1 ? ' → ' + chainText(r.bd.chain.slice(1)) : ''}.</p>`;
    }
    if (tile === 'year') {
      const y = TX.years[r.py.value];
      return `<h4>${orb(r.py.value, 's')} Личный год ${r.year} — ${esc(y.title)}</h4><p>${esc(y.text)}</p>
        <p><button type="button" class="bk-link" data-go-tab="tab-year">Месяцы и сегодняшний день →</button></p>`;
    }
    if (!r.nm) return askName;
    const nm = r.nm;
    if (tile === 'expression') {
      const t = TX.numbers[nm.expression.value];
      return `<h4>${orb(nm.expression.value, 's')} Число имени — ${esc(t.name)}</h4>
        <p>Так вы проявляетесь в мире и в делах. Ваш талант — ${esc(t.talent)}. Ключевые слова: <i>${esc(t.keys)}</i>.</p>
        <div class="num-letters-row">${lettersHTML(nm)}</div>
        <p class="small muted">Сумма всех букв: ${nm.expression.sum} → ${chainText(nm.expression.chain.slice(1)) || nm.expression.value}.</p>`;
    }
    if (tile === 'soul') {
      if (!nm.soul) return '<p class="muted">В имени нет гласных — число души не считается.</p>';
      const t = TX.numbers[nm.soul.value];
      return `<h4>${orb(nm.soul.value, 's')} Число души — ${esc(t.name)}</h4>
        <p>То, что движет вами изнутри. В глубине души вам важно ${esc(t.desire)}.</p>
        <p class="small muted">Считается по гласным (выделены): ${nm.soul.sum}${nm.soul.chain.length > 1 ? ' → ' + chainText(nm.soul.chain.slice(1)) : ''}.</p>
        <div class="num-letters-row only-v">${lettersHTML(nm)}</div>`;
    }
    if (!nm.personality) return '<p class="muted">В имени нет согласных — число личности не считается.</p>';
    const t = TX.numbers[nm.personality.value];
    return `<h4>${orb(nm.personality.value, 's')} Число личности — ${esc(t.name)}</h4>
      <p>Первое впечатление, которое вы производите. При знакомстве вас часто воспринимают как ${esc(t.image)}.</p>
      <p class="small muted">Считается по согласным: ${nm.personality.sum}${nm.personality.chain.length > 1 ? ' → ' + chainText(nm.personality.chain.slice(1)) : ''}.</p>
      <div class="num-letters-row only-c">${lettersHTML(nm)}</div>`;
  }

  // ---------- вкладка «Квадрат Пифагора» ----------
  const GRID = [[1, 4, 7], [2, 5, 8], [3, 6, 9]];
  const DIG_NAME = { 1: ['единица', 'единицы', 'единиц'], 2: ['двойка', 'двойки', 'двоек'], 3: ['тройка', 'тройки', 'троек'], 4: ['четвёрка', 'четвёрки', 'четвёрок'], 5: ['пятёрка', 'пятёрки', 'пятёрок'], 6: ['шестёрка', 'шестёрки', 'шестёрок'], 7: ['семёрка', 'семёрки', 'семёрок'], 8: ['восьмёрка', 'восьмёрки', 'восьмёрок'], 9: ['девятка', 'девятки', 'девяток'] };
  const countName = (dgt, c) => (c ? `${c} ${pl(c, ...DIG_NAME[dgt])}` : `нет ${DIG_NAME[dgt][2]}`);
  function squareHTML(r) {
    const sq = r.sq;
    const cells = GRID.map((row) => row.map((dgt) => {
      const c = sq.counts[dgt];
      return `<button type="button" class="pq-cell${cell === dgt ? ' sel' : ''}${c ? '' : ' zero'}" data-cell="${dgt}" aria-pressed="${cell === dgt}" aria-label="${TX.cells[dgt].title}: ${countName(dgt, c)}">
        <span class="pq-digits">${c ? (c > 5 ? `${dgt}<small>×${c}</small>` : String(dgt).repeat(c)) : '—'}</span><span class="pq-name">${TX.cells[dgt].grid || TX.cells[dgt].title}</span></button>`;
    }).join('')).join('');
    const groups = [['строка', 'Строки — сферы жизни'], ['столбец', 'Столбцы — опоры'], ['диагональ', 'Диагонали — настрой']];
    const lines = groups.map(([kind, head]) => `<h4 class="pq-lines-h">${head}</h4>` + Object.entries(TX.lines).filter(([, l]) => l.kind === kind).map(([k, l]) => {
      const v = sq.lines[k], lv = level(k, v);
      return `<div class="pq-line ${lv}"><div class="pq-line-top"><b>${l.name}</b><span class="pq-meter" role="img" aria-label="${LEVEL[lv]}"><i></i><i></i><i></i></span></div><span class="pq-line-meta">клетки ${N.LINES[k].join(', ')} · ${v} ${pl(v, 'цифра', 'цифры', 'цифр')} · ${LEVEL[lv]}</span><p class="small">${esc(l[lv])}</p></div>`;
    }).join('')).join('');
    const w = sq.work;
    return `<div class="pq-wrap">
        <div><div class="pq-grid" role="group" aria-label="Квадрат Пифагора">${cells}</div>
          <p class="tiny muted center" style="margin:10px 0 0">Нажмите на клетку — расшифровка справа</p></div>
        <div class="pq-side" id="pqSide">${cellDetail(r)}</div>
      </div>
      <details class="details-adv num-how" style="margin-top:16px"><summary>Рабочие числа: ${w.join(' · ')} — как посчитано</summary>
        <p class="small">1) сумма всех цифр даты = <b>${w[0]}</b>; 2) сумма цифр первого числа = <b>${w[1]}</b>; 3) первое число минус удвоенная первая цифра дня (${sq.firstDayDigit} × 2) = <b>${w[2]}</b>${sq.negative3 ? ' (получилось отрицательное — берём без минуса)' : ''}; 4) сумма цифр третьего = <b>${w[3]}</b>. Цифры даты и рабочих чисел раскладываются по клеткам, нули не считаются. Метод Александрова.</p>
        ${r.y >= 2000 ? '<p class="small muted">Для тех, кто родился после 2000 года, считаем так же, как для всех. Некоторые нумерологи добавляют поправки — это авторские методики, единого правила нет.</p>' : ''}</details>
      <div class="pq-lines">${lines}</div>`;
  }
  function cellDetail(r) {
    const c = r.sq.counts[cell], t = TX.cells[cell];
    const txt = t.texts[Math.min(c, t.texts.length - 1)];
    return `<span class="num-label">Клетка ${cell} · ${esc(t.about)}</span>
      <h4>${esc(t.title)} — ${countName(cell, c)}</h4><p>${esc(txt)}</p>
      ${cell === 4 ? '<p class="tiny muted">Это символ запаса сил, а не медицинская оценка.</p>' : ''}`;
  }

  // ---------- вкладка «Личный год» ----------
  function yearHTML(r) {
    const y = TX.years[r.py.value], nx = TX.years[r.pyNext.value];
    const cycle = Array.from({ length: 9 }, (_, i) => i + 1).map((k) => `<span class="cy${k === r.py.value ? ' now' : k < r.py.value ? ' past' : ''}" title="${esc(TX.years[k].title)}">${k}</span>`).join('');
    if (monthSel == null) monthSel = r.month;
    const months = fmt.MONTHS.map((mn, i) => { const v = N.personalMonth(r.py.value, i + 1); return `<button type="button" class="pmo${i + 1 === monthSel ? ' sel' : ''}${i + 1 === r.month ? ' cur' : ''}" data-month="${i + 1}" aria-pressed="${i + 1 === monthSel}"><span>${mn.slice(0, 3)}</span><b>${v}</b></button>`; }).join('');
    const pmSel = N.personalMonth(r.py.value, monthSel);
    return `<div class="num-hero">
        ${orb(r.py.value, 'xl')}
        <div class="num-hero-text"><span class="num-label">Личный год ${r.year}</span><h3>${esc(y.title)}</h3><p>${esc(y.text)}</p>${chips(y.focus)}</div>
      </div>
      <div class="num-cycle" aria-label="Девятилетний цикл: шаг ${r.py.value} из 9">${cycle}</div>
      <p class="tiny muted center" style="margin:6px 0 0">Ваш девятилетний цикл: шаг ${r.py.value} из 9. Личный год меняется 1 января.</p>
      <h4 style="margin-top:22px">Личные месяцы</h4>
      <div class="pm-grid" role="group" aria-label="Месяцы">${months}</div>
      <p class="pm-detail" id="pmDetail">${monthText(r, monthSel, pmSel)}</p>
      <div class="grid grid-2" style="margin-top:16px">
        <div class="num-mini">${icon('sun-high')}<div><b>Сегодня — личный день ${r.pd}</b><span class="small">хорошо ${esc(TX.tips[r.pd])}</span></div></div>
        <div class="num-mini">${icon('calendar-repeat')}<div><b>${r.year + 1} — личный год ${r.pyNext.value}</b><span class="small">${esc(nx.title.toLowerCase())}</span></div></div>
      </div>`;
  }
  const monthText = (r, m, v) => `<b>${fmt.MONTHS[m - 1]} — личный месяц ${v}.</b> Хорошо ${esc(TX.tips[v])}.`;

  // ---------- результат ----------
  function render(focus) {
    const r = res;
    const [y, m, d] = [r.y, r.m, r.d];
    // на узком экране подписи короче — все три вкладки помещаются
    const tabs = [['tab-main', '<span class="tl">Главные числа</span><span class="ts">Числа</span>'], ['tab-square', '<span class="tl">Квадрат Пифагора</span><span class="ts">Квадрат</span>'], ['tab-year', '<span class="tl">Личный год</span><span class="ts">Год</span>']];
    const box = $('numResult');
    box.innerHTML = `<div class="card">
        <div class="result-head">
          <div><span class="eyebrow" style="margin-bottom:8px">Нумерология</span><h2>${esc(r.name || 'Ваши числа')}</h2>
            <p class="muted small" style="margin:6px 0 0">${d} ${fmt.MONTHS_GEN[m - 1]} ${y}</p></div>
          <div class="row no-print"><button class="btn btn-primary btn-sm" type="button" data-act="story">${icon('sparkle')} Сторис «Мои числа»</button></div>
        </div>
        <div class="tabs" role="tablist" aria-label="Разделы">${tabs.map(([id, t], i) => `<button role="tab" id="${id}-btn" aria-controls="${id}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${t}</button>`).join('')}</div>
        <div style="margin-top:22px">
          <div class="tab-panel" role="tabpanel" id="tab-main">${lifeHero(r)}<h4 style="margin:24px 0 12px">Другие числа</h4>${tilesHTML(r)}</div>
          <div class="tab-panel" role="tabpanel" id="tab-square" hidden>${squareHTML(r)}</div>
          <div class="tab-panel" role="tabpanel" id="tab-year" hidden>${yearHTML(r)}</div>
        </div>
      </div>
      <div class="card note-card" style="margin-top:20px">${UI.alinaNote('Числа — первые штрихи портрета. На консультации я соединяю нумерологию с натальной картой: так видно не только «какой вы», но и когда лучше действовать.', '<button class="btn btn-primary btn-sm" type="button" data-book="numerology">Разобрать с Алиной</button><a class="btn btn-ghost btn-sm" href="natal.html">Натальная карта</a>')}</div>`;
    UI.tabs(box);
    showMeaning(r.lp.value);
    if (focus) { UI.fadeIn(box); if (window.innerWidth < 1000) box.scrollIntoView({ behavior: UI.reduceMotion() ? 'auto' : 'smooth', block: 'start' }); }
  }

  // ---------- справочник, основы, вопросы ----------
  let meaning = 1;
  function showMeaning(v) {
    meaning = v;
    $('numSeg').querySelectorAll('[data-n]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === v)));
    const t = TX.numbers[v];
    $('numMeaning').innerHTML = `<div class="num-hero">${orb(v, 'm')}<div class="num-hero-text"><span class="num-label">${t.master ? 'мастер-число' : 'число ' + v}</span><h3>${esc(t.name)}</h3><p class="num-keys">${esc(t.keys)}</p><p>${esc(t.essence)}</p></div></div>
      <div class="grid grid-2 num-sw"><div><h4>${icon('star')} Сильные стороны</h4>${chips(t.strengths)}</div><div><h4>${icon('leaf')} Зона роста</h4>${chips(t.growth, 'soft')}</div></div>
      <p class="num-advice">${esc(t.advice)}</p>`;
  }
  function staticBlocks() {
    $('numBasicsGrid').innerHTML = TX.basics.map((b, i) => `<div class="card num-basic reveal" style="--d:${(i % 3) * 0.06}s"><span class="nb-ic">${icon(b.icon)}</span><h3>${esc(b.title)}</h3><p class="muted">${esc(b.text)}</p></div>`).join('');
    $('numSeg').innerHTML = LIST.map((v) => `<button type="button" data-n="${v}" aria-pressed="${v === meaning}">${v}</button>`).join('');
    showMeaning(meaning);
    const rows = [[], [], [], []];
    const RU = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'.toUpperCase();
    Array.from(RU).forEach((ch, i) => rows[Math.floor(i / 9)].push(ch));
    $('numLetters').innerHTML = `<table class="table num-letters-table"><thead><tr>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<th>${k}</th>`).join('')}</tr></thead><tbody>${rows.filter((r) => r.length).map((r) => `<tr>${Array.from({ length: 9 }, (_, i) => `<td>${r[i] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $('numFaqList').innerHTML = TX.faq.map((f, i) => `<details class="acc-item reveal" style="--d:${i * 0.04}s"><summary>${esc(f.q)}<span class="pm">${icon('plus')}</span></summary><div class="acc-body">${esc(f.a)}</div></details>`).join('');
    $('numNote').innerHTML = UI.alinaNote('Хотите понять, как ваши числа проявляются именно у вас? Напишите мне — разберём их вместе с вашей натальной картой, спокойно и без спешки.', '<button class="btn btn-primary btn-sm" type="button" data-book="numerology">Записаться</button>');
    const now = new Date(), u = N.universalDay(now.getFullYear(), now.getMonth() + 1, now.getDate());
    $('numToday').innerHTML = `${orb(u, 's')}<span><b>Число дня — ${u}</b><span class="small">хорошо ${esc(TX.tips[u])}</span></span>`;
  }

  // ---------- форма ----------
  function readForm() {
    const iso = document.querySelector('#nmDateBox .dob-iso').value;
    if (!iso) {
      const t = document.querySelector('#nmDateBox .dob-text');
      t.classList.add('invalid'); t.focus();
      UI.toast(t.value.trim() ? 'Проверьте дату рождения: ДД.ММ.ГГГГ' : 'Укажите дату рождения', 'calendar');
      return null;
    }
    return { iso, name: $('nmName').value.trim() };
  }
  function setForm(name, iso) {
    $('nmName').value = name || '';
    const di = document.querySelector('#nmDateBox .dob-iso');
    if (iso) { di.value = iso; di.dispatchEvent(new Event('change')); }
  }
  function run(input, focus) {
    res = calc(input.name, input.iso);
    UI.store.set('numerology', input);
    render(focus);
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('nmDateBox').innerHTML = UI.dobHTML('nmDate', '');
    UI.enhanceDob($('nmDateBox'));
    staticBlocks();
    $('numForm').addEventListener('submit', (e) => { e.preventDefault(); const i = readForm(); if (i) run(i, true); });
    $('numSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (b) { showMeaning(+b.dataset.n); UI.fadeIn($('numMeaning'), 6); } });
    $('numResult').addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tile]');
      if (t) { tile = t.dataset.tile; $('numResult').querySelectorAll('[data-tile]').forEach((b) => { const on = b === t; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); }); $('numDetail').innerHTML = tileDetail(res); UI.fadeIn($('numDetail'), 6); return; }
      const c = e.target.closest('[data-cell]');
      if (c) { cell = +c.dataset.cell; $('numResult').querySelectorAll('[data-cell]').forEach((b) => { const on = b === c; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); }); $('pqSide').innerHTML = cellDetail(res); UI.fadeIn($('pqSide'), 6); if (window.innerWidth < 700) $('pqSide').scrollIntoView({ behavior: UI.reduceMotion() ? 'auto' : 'smooth', block: 'nearest' }); return; }
      const mo = e.target.closest('[data-month]');
      if (mo) { monthSel = +mo.dataset.month; $('numResult').querySelectorAll('[data-month]').forEach((b) => { const on = b === mo; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); }); $('pmDetail').innerHTML = monthText(res, monthSel, N.personalMonth(res.py.value, monthSel)); UI.fadeIn($('pmDetail'), 4); return; }
      const g = e.target.closest('[data-go-tab]');
      if (g) { const b = document.getElementById(g.dataset.goTab + '-btn'); if (b) { b.click(); b.focus(); } return; }
      if (e.target.closest('[data-focus-name]')) { $('nmName').focus(); $('nmName').scrollIntoView({ behavior: UI.reduceMotion() ? 'auto' : 'smooth', block: 'center' }); return; }
      const st = e.target.closest('[data-act="story"]');
      if (st && window.Cards && window.Cards.storyNumbers) {
        st.disabled = true;
        try { const cv = await window.Cards.storyNumbers(res); await window.Cards.show(cv, 'moi-chisla.png', 'Сторис «Мои числа»', 'Без даты рождения — только ваши числа.'); } catch (er) { console.error(er); UI.toast('Не получилось нарисовать карточку', 'info'); }
        st.disabled = false;
      }
    });
    // клиент из кабинета Алины, затем последний расчёт, затем последняя натальная карта
    const q = new URLSearchParams(location.search);
    const cl = q.get('client') && UI.clients.get(q.get('client'));
    const last = UI.store.get('numerology', null);
    const rec = (UI.recent.list() || [])[0];
    const pad = (n) => String(n).padStart(2, '0');
    if (cl && cl.birth) { setForm(cl.name, `${cl.birth.y}-${pad(cl.birth.mo)}-${pad(cl.birth.d)}`); run({ name: cl.name, iso: `${cl.birth.y}-${pad(cl.birth.mo)}-${pad(cl.birth.d)}` }); }
    else if (last && last.iso) { setForm(last.name, last.iso); run(last); }
    else if (rec && rec.y) setForm(rec.name || '', `${rec.y}-${pad(rec.mo)}-${pad(rec.d)}`);
    UI.reveal();
  });
})();
