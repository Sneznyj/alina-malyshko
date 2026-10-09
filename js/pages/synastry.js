/* Синастрия: две карты → оценка совместимости цифрами (общая и по сферам).
   Подробный разбор — аспекты пары, двойное колесо, композит, сравнение карт — только у Алины:
   зашифрованный модуль _private/synastry-pro.js, открывается после входа (js/admin.js). */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI, CV = window.ChartView, W = window.Wheel;
  const { esc, fmt, icon } = UI;
  let fa, fb, A = null, B = null, S = null, pa = null, pb = null;


  function ring(val) {
    const r = 72, c = 2 * Math.PI * r;
    return `<div class="score-ring"><svg viewBox="0 0 170 170" width="170" height="170"><defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="#9b87d9"/><stop offset="1" stop-color="#e58fb0"/></linearGradient></defs>
      <circle cx="85" cy="85" r="${r}" fill="none" stroke="var(--bg-3)" stroke-width="12"/>
      <circle cx="85" cy="85" r="${r}" fill="none" stroke="url(#sg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" data-off="${(c * (1 - val / 100)).toFixed(1)}"/></svg>
      <div class="val"><div><b>${val}</b><span>из 100</span></div></div></div>`;
  }

  function verdict(v) {
    if (v >= 75) return 'Очень сильная связь: много точек притяжения и взаимопонимания.';
    if (v >= 60) return 'Хорошая совместимость: вам есть на что опереться, а сложности решаемы.';
    if (v >= 45) return 'Союз роста: притяжение есть, но отношения потребуют внимания и разговоров.';
    return 'Непростое сочетание: вы очень разные — это может как обогащать, так и утомлять. Важны осознанность и договорённости.';
  }

  function render() {
    const nA = pa.name || 'Партнёр 1', nB = pb.name || 'Партнёр 2';
    const box = document.getElementById('result');
    const sph = Object.entries(S.spheres).map(([k, v]) => `<div class="bar" style="grid-template-columns:190px 1fr 44px"><span title="${T.synSpheres[k].about}">${T.synSpheres[k].name}</span><span class="track"><span class="fill" data-w="${v}" style="background:linear-gradient(90deg,var(--lav),var(--rose-strong))"></span></span><span class="pct">${v}</span></div>`).join('');
    box.innerHTML = `
      <div class="card">
        <div class="row" style="gap:28px;align-items:center;flex-wrap:wrap">
          ${ring(S.total)}
          <div style="flex:1;min-width:260px">
            <span class="eyebrow" style="margin-bottom:6px">Совместимость</span>
            <h2 style="margin:0 0 6px;font-size:clamp(1.7rem,3vw,2.4rem)"><span class="person-tag"><i style="background:var(--lav-strong)"></i>${esc(nA)}</span> <span class="muted">и</span> <span class="person-tag"><i style="background:#c96b8f"></i>${esc(nB)}</span></h2>
            <p class="lead" style="margin:0">${verdict(S.total)}</p>
            <p class="small muted" style="margin-top:8px">Гармония стихий Солнца и Луны: ${S.elemScore}%. Оценка — ориентир, а не приговор: любые отношения строят люди, а не планеты.</p>
            <button class="btn btn-primary btn-sm" type="button" id="synStory" style="margin-top:6px">${icon('sparkle')} Сторис «Наша совместимость»</button>
          </div>
        </div>
        <div class="bars" style="margin-top:24px">${sph}</div>
      </div>
      <div id="synPro"></div>
      <div class="card note-card" style="margin-top:20px">${UI.alinaNote('Цифры — только ориентир. Любую пару делают люди, а не планеты. На консультации разберу ваши карты вместе: аспекты между вами, карту союза и как мягко проходить острые углы.', '<button class="btn btn-primary btn-sm" type="button" data-book="synastry">Разобрать нашу пару</button>')}</div>`;
    CV.animateBars(box);
    // Алина вошла — добавляем подробный разбор пары
    if (window.Admin && window.Admin.has()) window.Admin.run(['synastry-pro']).then(() => { if (window.SynastryPro) window.SynastryPro.render(document.getElementById('synPro'), { A, B, S, nA, nB }); }).catch(() => {});
    document.getElementById('synStory').addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { const cv = await window.Cards.storySynastry(nA, nB, S); await window.Cards.show(cv, 'nasha-sovmestimost.png', 'Карточка для сторис', 'Только имена и оценки по сферам — без дат рождения.'); } catch (err) { console.error(err); UI.toast('Не получилось нарисовать карточку', 'info'); }
      b.disabled = false;
    });
    requestAnimationFrame(() => setTimeout(() => box.querySelectorAll('[data-off]').forEach((c) => { c.style.strokeDashoffset = c.dataset.off; }), 80));
    UI.reveal(box);
    UI.fadeIn(box);
  }

  function calc() {
    pa = fa.get(); if (!pa) return;
    pb = fb.get(); if (!pb) return;
    const o = CV.chartOpts();
    A = AC.chart(pa, o); B = AC.chart(pb, o);
    S = AC.synastry(A, B);
    UI.recent.add(pa); UI.recent.add(pb);
    render();
    document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.addEventListener('DOMContentLoaded', () => {
    fa = UI.birthForm(document.getElementById('formA'), { namePlaceholder: 'Имя' });
    fb = UI.birthForm(document.getElementById('formB'), { namePlaceholder: 'Имя партнёра' });
    document.getElementById('calcBtn').addEventListener('click', calc);
    // подставим последнюю карту как первого человека
    const q = new URLSearchParams(location.search);
    const ca = q.get('a') && UI.clients.get(q.get('a')), cb = q.get('b') && UI.clients.get(q.get('b'));
    if (ca && cb && ca.birth && cb.birth) { fa.set(ca.birth); fb.set(cb.birth); setTimeout(calc, 50); }
    else { const r = UI.recent.list(); if (r[0]) fa.set(r[0]); }
  });
})();
