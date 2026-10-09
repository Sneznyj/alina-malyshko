/* Синастрия: две карты → оценка совместимости цифрами (общая и по сферам) — бесплатно.
   Подробный разбор — аспекты пары, двойное колесо, композит, сравнение карт — в премиум-доступе (и всегда у Алины):
   зашифрованный модуль _private/synastry-pro.js, открывается кодом доступа (js/premium.js).
   Без доступа — превью: сколько связей между картами, одна из них с толкованием, остальное закрыто, тарифы. */
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
    pro(nA, nB);
    document.getElementById('synStory').addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { const cv = await window.Cards.storySynastry(nA, nB, S); await window.Cards.show(cv, 'nasha-sovmestimost.png', 'Карточка для сторис', 'Только имена и оценки по сферам — без дат рождения.'); } catch (err) { console.error(err); UI.toast('Не получилось нарисовать карточку', 'info'); }
      b.disabled = false;
    });
    requestAnimationFrame(() => setTimeout(() => box.querySelectorAll('[data-off]').forEach((c) => { c.style.strokeDashoffset = c.dataset.off; }), 80));
    UI.reveal(box);
    UI.fadeIn(box);
  }

  // ---------- подробный разбор: премиум ----------
  const MINOR = ['quincunx', 'semisextile', 'semisquare', 'sesquisquare', 'quintile'];
  async function pro(nA, nB) {
    const box = document.getElementById('synPro');
    if (!box || !window.Premium) return;
    const s0 = S;
    if ((await window.Premium.ensure(['synastry-pro'])) && window.SynastryPro) { if (S === s0) window.SynastryPro.render(box, { A, B, S, nA, nB }); return; }
    if (S === s0) teaser(box, nA, nB);
  }
  function teaser(box, nA, nB) {
    const P = window.Premium;
    const list = S.aspects.filter((x) => !MINOR.includes(x.type) && x.a !== 'mc' && x.b !== 'mc');
    const kind = (x) => (x.type === 'conj' ? 'conj' : ['trine', 'sextile'].includes(x.type) ? 'soft' : 'hard');
    const cnt = { soft: 0, hard: 0, conj: 0 };
    list.forEach((x) => { cnt[kind(x)]++; });
    // одна связь открыта целиком — самая точная из «притяжения» или «эмоций»
    const sample = list.filter((x) => ['attraction', 'emotion'].includes(x.sphere)).sort((a, b) => a.orb - b.orb)[0] || list.slice().sort((a, b) => a.orb - b.orb)[0];
    const asp = sample && T.aspects[sample.type];
    const spheres = {};
    list.forEach((x) => { const k = x.sphere || 'other'; spheres[k] = (spheres[k] || 0) + 1; });
    box.innerHTML = `<div class="card syn-teaser" style="margin-top:20px">
        <span class="eyebrow" style="margin-bottom:6px">Подробный разбор пары</span>
        <h3 style="margin:0 0 4px">Между вашими картами ${list.length} ${fmt.plural(list.length, 'аспект', 'аспекта', 'аспектов')}</h3>
        <div class="fc-stats" style="margin-top:12px">
          <div class="fc-stat soft"><b>${cnt.soft}</b><span>гармоничных — где вам легко</span></div>
          <div class="fc-stat hard"><b>${cnt.hard}</b><span>напряжённых — где искрит</span></div>
          <div class="fc-stat conj"><b>${cnt.conj}</b><span>соединений — где вы сплавлены</span></div>
        </div>
        ${sample ? `<h4 style="margin:20px 0 8px">Одна из ваших связей</h4>
        <div class="interp"><article class="interp-item"><div class="ig glyph" style="color:${asp.color}">${asp.glyph}</div><div>
          <h4>${T.planets[sample.a].name} <span class="muted small">(${esc(nA)})</span> ${asp.glyph} ${T.planets[sample.b].name} <span class="muted small">(${esc(nB)})</span></h4>
          <div class="tags"><span class="badge">${asp.name}</span><span class="badge">орбис ${sample.orb.toFixed(1)}°</span>${sample.sphere && T.synSpheres[sample.sphere] ? `<span class="badge gold">${T.synSpheres[sample.sphere].name}</span>` : ''}</div>
          <p>${T.synastryText(sample.a, sample.b, sample.type, nA, nB)}</p></div></article></div>` : ''}
        <h4 style="margin:22px 0 10px">Ещё в разборе</h4>
        <div class="locked-list">
          ${list.length > 1 ? P.locked(`Все аспекты пары с толкованием — ещё ${list.length - 1}, по сферам: ${['attraction', 'emotion', 'communication', 'stability', 'growth', 'other'].filter((k) => spheres[k] && T.synSpheres[k]).map((k) => T.synSpheres[k].name.toLowerCase()).join(', ')}`, { lines: 3 }) : ''}
          ${P.locked('Двойное колесо: ваши планеты внутри карты партнёра', { lines: 2 })}
          ${P.locked('Композит — карта вашего союза как отдельного «существа»', { lines: 3 })}
          ${P.locked('Сравнение карт: стихии и планеты рядом', { lines: 2 })}
        </div>
      </div>
      <div style="margin-top:20px">${P.paywall({ feature: 'synastry', title: 'Подробная совместимость — в премиум-доступе', text: 'Все связи между вашими картами с толкованием, двойное колесо и композит пары.' })}</div>`;
    UI.reveal(box);
  }

  async function calc() {
    pa = fa.get(); if (!pa) return;
    pb = fb.get(); if (!pb) return;
    const o = CV.chartOpts();
    A = AC.chart(pa, o); B = AC.chart(pb, o);
    S = AC.synastry(A, B);
    UI.recent.add(pa); UI.recent.add(pb);
    if (!(await UI.conjure(document.getElementById('result'), { kind: 'synastry' }))) return;
    render();
    document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.addEventListener('DOMContentLoaded', () => {
    fa = UI.birthForm(document.getElementById('formA'), { namePlaceholder: 'Имя' });
    fb = UI.birthForm(document.getElementById('formB'), { namePlaceholder: 'Имя партнёра' });
    // из астропроцессора: synastry.html?pa=<id>&pb=<id>
    const qs = new URLSearchParams(location.search), pa = qs.get('pa') && UI.people.get(qs.get('pa')), pb = qs.get('pb') && UI.people.get(qs.get('pb'));
    if (pa && pa.birth) fa.set(UI.people.params(pa));
    if (pb && pb.birth) fb.set(UI.people.params(pb));
    document.getElementById('calcBtn').addEventListener('click', calc);
    // код доступа введён — показать подробный разбор без повторного расчёта
    document.addEventListener('premiumchange', () => { if (S) render(); });
    // подставим последнюю карту как первого человека
    const q = new URLSearchParams(location.search);
    const ca = q.get('a') && UI.clients.get(q.get('a')), cb = q.get('b') && UI.clients.get(q.get('b'));
    if (ca && cb && ca.birth && cb.birth) { fa.set(ca.birth); fb.set(cb.birth); setTimeout(calc, 50); }
    else { const r = UI.recent.list(); if (r[0]) fa.set(r[0]); }
  });
})();
