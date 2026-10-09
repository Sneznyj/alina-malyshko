/* Академия: уроки с тестами и прогрессом, инструкции, словарь. */
(function () {
  'use strict';
  const T = window.ASTRO_TEXTS, UI = window.UI, AC = window.AstroCore, D = window.ACADEMY;
  const { esc, icon } = UI;
  let done = UI.store.get('lessonsDone', []);
  let cur = 1;

  const tables = {
    signs: () => `<div class="mini-table">${AC.SIGNS.map((id) => { const s = T.signs[id]; return `<div><b><span class="g">${s.glyph}</span>${s.name}</b><span class="muted tiny">${s.dates}</span><br>${s.keys}</div>`; }).join('')}</div>`,
    planets: () => `<div class="mini-table">${['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'node', 'chiron'].map((id) => { const p = T.planets[id]; return `<div><b><span class="g">${p.glyph}</span>${p.name}</b>${p.keys}</div>`; }).join('')}</div>`,
    houses: () => `<div class="mini-table">${Object.entries(T.houses).map(([n, h]) => `<div><b>${h.name} · ${h.title}</b>${h.about}</div>`).join('')}</div>`,
    aspects: () => `<div class="mini-table">${['conj', 'sextile', 'square', 'trine', 'opp', 'quincunx'].map((id) => { const a = T.aspects[id]; const ang = AC.ASPECTS.find((x) => x.id === id).angle; return `<div><b><span class="g" style="color:${a.color}">${a.glyph}</span>${a.name} · ${ang}°</b>${a.about}</div>`; }).join('')}</div>`,
  };

  function progress() {
    const n = done.length, total = D.lessons.length;
    document.getElementById('progText').textContent = `Пройдено ${n} из ${total}`;
    document.getElementById('progPct').textContent = Math.round((n / total) * 100) + '%';
    document.getElementById('progBar').style.width = (n / total) * 100 + '%';
  }

  function list() {
    document.getElementById('lessonList').innerHTML = D.lessons.map((l) => `<button type="button" data-id="${l.id}" aria-current="${l.id === cur}" class="${done.includes(l.id) ? 'done' : ''}"><span class="n">${done.includes(l.id) ? '✓' : l.id}</span><span>${esc(l.title)}</span><span class="tiny muted">${l.time}</span></button>`).join('');
  }

  function lesson() {
    const l = D.lessons.find((x) => x.id === cur);
    const body = l.body.replace(/\{\{(\w+)\}\}/g, (_, k) => (tables[k] ? tables[k]() : ''));
    const next = D.lessons.find((x) => x.id === cur + 1);
    document.getElementById('lesson').innerHTML = `
      <span class="eyebrow">Урок ${l.id} · ${l.time}</span>
      <h2>${esc(l.title)}</h2>
      ${body}
      <div class="quiz card" style="box-shadow:none;background:var(--bg-2)">
        <h3 style="margin-top:0">Проверьте себя</h3>
        ${l.quiz.map((q, qi) => `<div class="quiz-q" data-q="${qi}"><p>${qi + 1}. ${esc(q.q)}</p><div class="quiz-opts">${q.a.map((a, ai) => `<button type="button" data-a="${ai}">${esc(a)}</button>`).join('')}</div><p class="small muted" data-why hidden></p></div>`).join('')}
        <p class="small" id="quizResult" style="margin:0"></p>
      </div>
      <div class="row between" style="margin-top:22px">
        <button class="btn ${done.includes(l.id) ? 'btn-ghost' : 'btn-gold'}" type="button" id="markDone">${done.includes(l.id) ? icon('check') + ' Урок пройден' : 'Отметить как пройденный'}</button>
        ${next ? `<button class="btn btn-primary" type="button" data-go="${next.id}">Следующий урок →</button>` : '<a class="btn btn-primary" href="natal.html">Построить свою карту →</a>'}
      </div>`;
    const answered = {};
    document.getElementById('lesson').querySelectorAll('.quiz-q').forEach((qEl) => {
      qEl.addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const qi = +qEl.dataset.q, q = l.quiz[qi], ai = +b.dataset.a;
        if (answered[qi] != null) return;
        answered[qi] = ai === q.ok;
        qEl.querySelectorAll('[data-a]').forEach((x) => { if (+x.dataset.a === q.ok) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
        const why = qEl.querySelector('[data-why]'); why.hidden = false; why.textContent = (ai === q.ok ? 'Верно! ' : 'Не совсем. ') + q.why;
        if (Object.keys(answered).length === l.quiz.length) {
          const ok = Object.values(answered).filter(Boolean).length;
          document.getElementById('quizResult').innerHTML = `<b>${ok} из ${l.quiz.length}</b> — ${ok === l.quiz.length ? 'отлично! Урок засчитан ✦' : 'хороший результат, можно перечитать урок.'}`;
          if (ok >= l.quiz.length - 1) markDone(l.id, true);
        }
      });
    });
    document.getElementById('markDone').addEventListener('click', () => markDone(l.id));
  }

  function markDone(id, silent) {
    if (!done.includes(id)) { done.push(id); UI.store.set('lessonsDone', done); if (!silent) UI.toast('Урок отмечен как пройденный', 'check'); else UI.toast('Урок засчитан ✦', 'sparkle'); }
    progress(); list();
    const b = document.getElementById('markDone'); if (b) { b.className = 'btn btn-ghost'; b.innerHTML = icon('check') + ' Урок пройден'; }
    if (done.length === D.lessons.length) UI.toast('Мини-курс пройден! Вы умеете читать карту ✨', 'star');
  }

  function go(id) { cur = id; history.replaceState(null, '', '#lesson-' + id); list(); lesson(); UI.fadeIn(document.getElementById('lesson')); if (window.innerWidth < 960) document.getElementById('lesson').scrollIntoView({ behavior: 'smooth' }); else window.scrollTo({ top: document.getElementById('lesson').getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' }); }

  function guides() {
    document.getElementById('guides').innerHTML = D.guides.map((g, i) => `<details class="acc-item"${i === 0 ? ' open' : ''}><summary><span class="row" style="gap:12px;flex-wrap:nowrap"><span class="glyph" style="color:var(--gold);font-size:1.3rem;width:24px;text-align:center">${g.icon}</span>${esc(g.title)}</span><span class="pm">${icon('plus')}</span></summary><div class="acc-body">${g.body}</div></details>`).join('');
  }
  function gloss(q) {
    const nq = (q || '').toLowerCase().replace(/ё/g, 'е');
    const items = D.glossary.filter(([t, d]) => !nq || (t + ' ' + d).toLowerCase().replace(/ё/g, 'е').includes(nq));
    document.getElementById('gloss').innerHTML = items.map(([t, d]) => `<dl><dt>${esc(t)}</dt><dd>${esc(d)}</dd></dl>`).join('') || '<p class="muted">Ничего не найдено.</p>';
  }

  document.addEventListener('DOMContentLoaded', () => {
    // обучение пока скрыто (content.js → academy.enabled: false): вместо уроков — короткая записка и запись на консультацию
    if (!UI.academyOn) {
      document.getElementById('main').innerHTML = `<section class="page-hero"><div class="container hero-anim"><span class="eyebrow">Обучение</span><h1>Уроки астрологии <em class="accent">скоро</em></h1>
        <p class="lead">Я готовлю обучение — здесь появятся уроки, когда всё будет готово. А пока можно записаться на личную консультацию.</p>
        <div class="hero-cta"><button class="btn btn-primary" type="button" data-book>Записаться на консультацию</button><a class="btn btn-ghost" href="index.html#services">Консультации и цены</a></div></div></section>`;
      return;
    }
    const m = location.hash.match(/lesson-(\d+)/);
    if (m && D.lessons.find((x) => x.id === +m[1])) cur = +m[1];
    else { const firstUndone = D.lessons.find((l) => !done.includes(l.id)); cur = firstUndone ? firstUndone.id : 1; }
    progress(); list(); lesson(); guides(); gloss('');
    document.getElementById('lessonList').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) go(+b.dataset.id); });
    document.getElementById('lesson').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(+b.dataset.go); });
    document.getElementById('glossQ').addEventListener('input', (e) => gloss(e.target.value));
  });
})();
