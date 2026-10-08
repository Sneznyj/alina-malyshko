/* Синастрия: две карты → оценка по сферам, двойное колесо, аспекты, композит. */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI, CV = window.ChartView, W = window.Wheel;
  const { esc, fmt, icon } = UI;
  let fa, fb, A = null, B = null, S = null, pa = null, pb = null;

  const sphereOf = (x) => x.sphere || 'other';

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
    const tabs = [['tab-asp', 'Аспекты пары'], ['tab-wheel', 'Двойное колесо'], ['tab-comp', 'Композит'], ['tab-cmp', 'Сравнение карт']];
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
      <div class="card" style="margin-top:20px">
        <div class="tabs" role="tablist">${tabs.map(([id, t], i) => `<button role="tab" id="${id}-btn" aria-controls="${id}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${t}</button>`).join('')}</div>
        <div style="margin-top:22px">
          <div class="tab-panel" role="tabpanel" id="tab-asp">${aspectsBlock(nA, nB)}</div>
          <div class="tab-panel" role="tabpanel" id="tab-wheel" hidden>
            <p class="small muted center">Внутри — карта: ${esc(nA)}, снаружи — планеты: ${esc(nB)}. Линии — аспекты между вашими планетами.</p>
            <div class="wheel-box" id="wheelBox">${W.svg(A, { outer: B, aspects: S.aspects, labelB: nB })}</div>
            ${CV.legend()}
          </div>
          <div class="tab-panel" role="tabpanel" id="tab-comp" hidden>${compositeBlock()}</div>
          <div class="tab-panel" role="tabpanel" id="tab-cmp" hidden>${compareBlock(nA, nB)}</div>
        </div>
      </div>
      <div class="card note-card" style="margin-top:20px">${UI.alinaNote('Цифры — только ориентир. Любую пару делают люди, а не планеты. На консультации покажу, в чём сила именно вашего союза и как мягко проходить острые углы.', '<button class="btn btn-primary btn-sm" type="button" data-book="synastry">Разобрать нашу пару</button>')}</div>`;
    UI.tabs(box);
    W.attach(document.getElementById('wheelBox'));
    CV.animateBars(box);
    document.getElementById('synStory').addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { const cv = await window.Cards.storySynastry(nA, nB, S); await window.Cards.show(cv, 'nasha-sovmestimost.png', 'Карточка для сторис', 'Только имена и оценки по сферам — без дат рождения.'); } catch (err) { console.error(err); UI.toast('Не получилось нарисовать карточку', 'info'); }
      b.disabled = false;
    });
    requestAnimationFrame(() => setTimeout(() => box.querySelectorAll('[data-off]').forEach((c) => { c.style.strokeDashoffset = c.dataset.off; }), 80));
    UI.reveal(box);
  }

  function aspectsBlock(nA, nB) {
    const list = S.aspects.filter((x) => !['quincunx', 'semisextile', 'semisquare', 'sesquisquare', 'quintile'].includes(x.type) && x.a !== 'mc' && x.b !== 'mc').slice(0, 24);
    const groups = {};
    for (const x of list) (groups[sphereOf(x)] = groups[sphereOf(x)] || []).push(x);
    const order = ['attraction', 'emotion', 'communication', 'stability', 'growth', 'other'];
    return order.filter((k) => groups[k]).map((k) => `
      <h3 style="margin-top:18px">${T.synSpheres[k].name} <span class="muted small" style="font-family:var(--ff-body)">· ${T.synSpheres[k].about.toLowerCase()}</span></h3>
      <div class="interp">${groups[k].map((x) => {
        const asp = T.aspects[x.type];
        return `<article class="interp-item"><div class="ig glyph" style="color:${asp.color}">${asp.glyph}</div><div>
          <h4>${T.planets[x.a].name} <span class="muted small">(${esc(nA)})</span> ${asp.glyph} ${T.planets[x.b].name} <span class="muted small">(${esc(nB)})</span></h4>
          <div class="tags"><span class="badge">${asp.name}</span><span class="badge">орбис ${x.orb.toFixed(1)}°</span></div>
          <p>${T.synastryText(x.a, x.b, x.type, nA, nB)}</p></div></article>`;
      }).join('')}</div>`).join('') || '<p class="muted">Мажорных аспектов между картами не найдено.</p>';
  }

  function compositeBlock() {
    const comp = AC.composite(A, B);
    const ids = ['sun', 'moon', 'venus', 'mars', 'mercury', 'asc'].filter((id) => comp.byId[id]);
    const about = { sun: 'смысл и цель вашего союза', moon: 'эмоциональный климат пары', venus: 'как вы любите и что цените вместе', mars: 'как пара действует и решает конфликты', mercury: 'как вы общаетесь и договариваетесь', asc: 'как пару видят окружающие' };
    return `<p class="muted small">Композит — карта отношений как отдельного «существа»: средние точки между планетами двух людей.</p>
      <div class="interp">${ids.map((id) => {
        const p = comp.byId[id]; const s = T.signs[p.sign];
        return `<article class="interp-item"><div class="ig glyph">${T.planets[id].glyph}</div><div><h4>${T.planets[id].name} пары ${s.loc}</h4><div class="tags"><span class="badge">${AC.fmtDeg(p.lon)} ${s.name}</span></div><p>${T.capital(about[id])}: союз проявляется ${s.trait}. Ключевые темы: ${s.keys}.</p></div></article>`;
      }).join('')}</div>`;
  }

  function compareBlock(nA, nB) {
    const ids = ['sun', 'moon', 'asc', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
    const cell = (c, id) => { const p = c.byId[id]; return p ? `${T.signs[p.sign].glyph} ${T.signs[p.sign].name} <span class="muted small">${AC.fmtDeg(p.lon)}</span>` : '<span class="muted">—</span>'; };
    return `<div class="table-wrap"><table class="table"><thead><tr><th></th><th>${esc(nA)}</th><th>${esc(nB)}</th></tr></thead><tbody>
      ${ids.map((id) => `<tr><td><span class="g glyph">${T.planets[id].glyph}</span> ${T.planets[id].name}</td><td>${cell(A, id)}</td><td>${cell(B, id)}</td></tr>`).join('')}
      <tr><td>Ведущая стихия</td><td>${T.elements[A.summary.topElement].name}</td><td>${T.elements[B.summary.topElement].name}</td></tr>
    </tbody></table></div>`;
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
    document.addEventListener('themechange', () => { const wb = document.getElementById('wheelBox'); if (wb && A) { wb.innerHTML = W.svg(A, { outer: B, aspects: S.aspects, animate: false }); W.attach(wb); } });
  });
})();
