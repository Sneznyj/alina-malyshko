/* Главная: живое небо, услуги с акцией, пакеты, отзывы, вопросы, запись. */
(function () {
  'use strict';
  const AC = window.AstroCore, T = window.ASTRO_TEXTS, UI = window.UI, SITE = window.SITE;
  const { esc, fmt, icon } = UI;
  const $ = (id) => document.getElementById(id);
  const money = (n, code) => UI.money(n, code);

  function zodiacRing() {
    let s = '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor">';
    s += '<circle cx="50" cy="50" r="49" stroke-width=".25"/><circle cx="50" cy="50" r="43.5" stroke-width=".18" stroke-dasharray=".6 1.2"/><circle cx="50" cy="50" r="40.5" stroke-width=".2"/>';
    for (let d = 0; d < 360; d += 5) {
      const a = d * Math.PI / 180, r1 = 49, r2 = d % 30 === 0 ? 46.2 : 47.8;
      s += `<line x1="${50 + r1 * Math.cos(a)}" y1="${50 + r1 * Math.sin(a)}" x2="${50 + r2 * Math.cos(a)}" y2="${50 + r2 * Math.sin(a)}" stroke-width="${d % 30 === 0 ? 0.3 : 0.15}"/>`;
    }
    AC.SIGNS.forEach((sid, i) => {
      const a = (i * 30 + 15 - 90) * Math.PI / 180, r = 46.6;
      const x = 50 + r * Math.cos(a), y = 50 + r * Math.sin(a);
      s += `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" fill="currentColor" stroke="none" font-size="3.1" text-anchor="middle" dominant-baseline="central" font-family="'Noto Sans Symbols','Segoe UI Symbol',sans-serif" transform="rotate(${i * 30 + 15} ${x.toFixed(2)} ${y.toFixed(2)})">${T.signs[sid].glyph}</text>`;
    });
    for (let i = 0; i < 4; i++) { const a = (i * 90 + 45) * Math.PI / 180; s += `<circle cx="${50 + 40.5 * Math.cos(a)}" cy="${50 + 40.5 * Math.sin(a)}" r=".9" fill="currentColor" stroke="none"/>`; }
    return s + '</svg>';
  }

  // ---------- живое небо ----------
  function skyStrip() {
    const now = new Date();
    const city = UI.defaultCity();
    const sky = UI.skyNow(now);
    const ms = sky.moon;
    const ph = T.moonPhaseNow[ms.phase8];
    const nextIng = AC.ingresses('moon', now, AC.addDays(now, 3), 0.25)[0];
    let ld = null;
    try { ld = AC.lunarDay(now, city.lat, city.lon); } catch (e) { ld = null; }
    const sun = sky.pts[0];
    const retro = sky.retro.filter((id) => id !== 'sun' && id !== 'moon');
    const personalRetro = retro.filter((id) => ['mercury', 'venus', 'mars'].includes(id));
    $('skyDate').textContent = '· ' + fmt.date(now);
    const cells = [
      `<div class="sky-cell"><span style="width:40px;flex-shrink:0">${UI.moonSVG(ms.angle)}</span><div><div class="k">Фаза</div><div class="v">${ph.name}</div><div class="s">освещено ${Math.round(ms.illum * 100)}%</div></div></div>`,
      `<div class="sky-cell"><span class="big-glyph glyph">${T.signs[ms.sign].glyph}</span><div><div class="k">Луна</div><div class="v">${T.signs[ms.sign].loc}</div><div class="s">${nextIng ? 'до ' + fmt.dmTime(nextIng.date) : ''}</div></div></div>`,
      `<div class="sky-cell"><span class="big-glyph" style="font-family:var(--ff-display);font-weight:600">${ld ? ld.day : '—'}</span><div><div class="k">Лунный день</div><div class="v">${ld ? T.lunarDays[ld.day].sym : ''}</div><div class="s">${ld && ld.end ? 'до ' + fmt.dmTime(ld.end) + ' · ' + esc(city.name) : ''}</div></div></div>`,
      `<div class="sky-cell"><span class="big-glyph glyph">${T.signs[AC.signOf(sun.lon)].glyph}</span><div><div class="k">Солнце</div><div class="v">${T.signs[AC.signOf(sun.lon)].loc}</div><div class="s">${AC.fmtDeg(sun.lon)}</div></div></div>`,
      `<div class="sky-cell"><span class="big-glyph glyph" style="color:${personalRetro.length ? 'var(--rose-strong)' : 'var(--ok)'}">${personalRetro.length ? T.planets[personalRetro[0]].glyph : '✓'}</span><div><div class="k">Ретроградные</div><div class="v glyph" style="font-size:1.25rem;letter-spacing:.12em;color:var(--lav-strong)" title="${retro.map((id) => T.planets[id].name).join(', ')}">${retro.length ? retro.map((id) => T.planets[id].glyph).join(' ') : '—'}</div><div class="s">${personalRetro.length ? personalRetro.map((id) => T.planets[id].name).join(', ') + ': перепроверяйте договорённости' : retro.length ? retro.map((id) => T.planets[id].name).join(', ') : 'все планеты директны'}</div></div></div>`,
    ];
    $('skyStrip').innerHTML = cells.join('');
    $('fcMoonIco').innerHTML = UI.moonSVG(ms.angle);
    $('fcMoonTitle').textContent = 'Луна ' + T.signs[ms.sign].loc;
    $('fcMoonSub').textContent = ld ? `${ld.day} лунный день · ${ph.name.toLowerCase()}` : ph.name;
    const ev = nextEvent(now);
    if (ev) { $('fcEventIco').innerHTML = icon(ev.icon); $('fcEventTitle').textContent = ev.title; $('fcEventSub').textContent = ev.sub; }
  }

  function nextEvent(now) {
    const end = AC.addDays(now, 45);
    const cand = [];
    for (const e of AC.eclipses(now, AC.addDays(now, 40))) cand.push({ date: e.date, icon: 'sun-moon', title: (e.type === 'solar' ? 'Солнечное' : 'Лунное') + ' затмение', sub: fmt.dm(e.date) + ' · ' + T.signs[AC.signOf(e.lon)].loc, w: 0 });
    for (const st of AC.stations(['mercury', 'venus', 'mars'], now, end)) cand.push({ date: st.date, icon: 'planet', title: T.planets[st.id].name + (st.kind === 'retro' ? (st.id === 'venus' ? ' ретроградна' : ' ретрограден') : (st.id === 'venus' ? ' директна' : ' директен')), sub: 'с ' + fmt.dm(st.date), w: 1 });
    for (const p of AC.moonPhases(now, AC.addDays(now, 16))) if (p.phase === 0 || p.phase === 2) cand.push({ date: p.date, icon: p.phase === 0 ? 'moon-stars' : 'moon', title: p.phase === 0 ? 'Новолуние' : 'Полнолуние', sub: fmt.dm(p.date) + ' · ' + T.signs[AC.signOf(p.lon)].loc, w: 2 });
    cand.sort((a, b) => a.date - b.date);
    const soon = cand.filter((c) => c.date - now < 10 * 86400000 && c.w < 2);
    return soon[0] || cand[0];
  }

  // ---------- цены и акция ----------
  function priceHTML(svc, big) {
    const p = UI.priceFor(svc);
    if (!svc.price) return '<div class="price">по запросу</div>';
    if (p.old) return `<div class="price-row"><span class="price-old">${money(p.old, p.code)}</span><span class="price">${money(p.now, p.code)}</span><span class="sticker sm">−${p.percent}%</span></div><div class="price-note">на первую консультацию</div>`;
    return `<div class="price">${money(p.now, p.code)}</div>`;
  }

  function hero() {
    const pr = UI.promoInfo();
    const from = UI.minPrice();
    $('priceHint').innerHTML = `${icon('ticket')}<span>Консультации от <b>${money(from)}</b></span>` + (pr ? ` <span class="sticker sm">−${pr.percent}% ${esc(pr.short)}</span> <span class="small muted">до ${pr.end.getDate()} ${fmt.MONTHS_GEN[pr.end.getMonth()]}</span>` : '');
    if (pr) { const st = $('heroSticker'); st.hidden = false; st.innerHTML = `−${pr.percent}%<small>${esc(pr.short)}</small>`; st.setAttribute('role', 'note'); }
  }

  function needs() {
    $('needsGrid').innerHTML = SITE.needs.map((n, i) => `<div class="card hover need-card reveal" style="--d:${(i % 3) * 0.08}s"><span class="need-ic">${icon(n.icon || 'sparkle')}</span><div><h3 style="font-size:1.45rem">${esc(n.title)}</h3><p class="muted" style="margin:0">${esc(n.text)}</p></div></div>`).join('');
  }

  // ---------- валюта ----------
  function curSwitch() {
    const box = $('curSwitch');
    if (!box) return;
    // одна валюта (сейчас только рубли) — переключатель не нужен
    if (Object.keys(SITE.currencies || {}).length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    const cur = UI.currency();
    const names = { RUB: 'рубли', USD: 'доллары', EUR: 'евро' };
    box.innerHTML = '<span class="small muted">Цены в</span><div class="seg" role="group" aria-label="Валюта">' +
      Object.entries(SITE.currencies || {}).map(([code, sign]) => `<button type="button" data-cur="${code}" aria-pressed="${code === cur}">${sign} ${names[code] || code}</button>`).join('') + '</div>';
  }
  document.addEventListener('currencychange', () => {
    curSwitch(); hero(); services(); offers(); academy();
    document.querySelectorAll('#servicesGrid .reveal, #offersGrid .reveal, #acFormats .reveal').forEach((el) => el.classList.add('in'));
  });

  function services() {
    const tones = ['', 'gold', 'rose'];
    $('servicesGrid').innerHTML = SITE.services.map((s, i) => `
      <article class="card hover service-card reveal ${s.featured ? 'featured services-featured' : ''}" style="--d:${(i % 3) * 0.06}s">
        ${s.featured ? '<div class="deco-ring" aria-hidden="true">' + zodiacRing() + '</div>' : ''}
        ${s.tag ? `<div class="tags-top"><span class="tag ${s.tagType || 'hit'}">${icon(s.tagType === 'new' ? 'sparkle' : s.tagType === 'gift' ? 'gift' : 'flame-filled')}${esc(s.tag)}</span></div>` : ''}
        <div class="card-icon ${tones[i % 3]}">${icon(s.icon || 'planet')}</div>
        <h3>${esc(s.title)}</h3>
        <p class="muted">${esc(s.text)}</p>
        <ul class="${s.featured ? 'two-col' : ''}">${s.includes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        ${s.featured ? '<p class="featured-quote">«Ваша карта рождения — подробная инструкция к себе. Давайте прочитаем её вместе».</p>' : ''}
        <div class="foot">
          <div>${priceHTML(s)}<div class="tiny muted">${esc(s.duration)}</div></div>
          <button class="btn ${s.featured ? 'btn-primary' : 'btn-ghost'} btn-sm" type="button" data-book="${s.id}">Записаться</button>
        </div>
      </article>`).join('');
  }

  function offers() {
    const byId = Object.fromEntries(SITE.services.map((s) => [s.id, s]));
    const cards = (SITE.bundles || []).map((b, i) => {
      const bp = UI.priceOf(b);
      const old = b.items.reduce((a, id) => a + (byId[id] ? UI.priceOf(byId[id]).n : 0), 0);
      const pct = old ? Math.round((1 - bp.n / old) * 100) : 0;
      return `<article class="card hover offer-card reveal" style="--d:${i * 0.08}s">
        ${pct > 0 ? `<span class="sticker corner">−${pct}%</span>` : ''}
        ${b.tag ? `<span class="tag gold" style="align-self:flex-start;margin-bottom:12px">${icon('star-filled')}${esc(b.tag)}</span>` : ''}
        <h3>${esc(b.title)}</h3>
        <div class="plus">${b.items.map((id) => byId[id] ? `<span class="pi">${icon(byId[id].icon)}${esc(byId[id].title)}</span>` : '').join('<span class="muted">+</span>')}</div>
        <p class="muted">${esc(b.text)}</p>
        <div class="foot"><div><div class="price-row"><span class="price-old">${money(old, bp.code)}</span><span class="price">${money(bp.n, bp.code)}</span></div><span class="save">выгода ${money(old - bp.n, bp.code)}</span></div>
        <button class="btn btn-primary btn-sm" type="button" data-book="${b.items[0]}">Хочу пакет</button></div>
      </article>`;
    });
    const g = SITE.gift;
    if (g && g.enabled) cards.push(`<article class="card hover offer-card gift-card reveal" style="--d:.16s">
      <span class="tag gift" style="align-self:flex-start;margin-bottom:12px;background:rgba(255,255,255,.18);box-shadow:none">${icon('gift')}В подарок</span>
      <svg class="gift-bow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">${(window.ICONS || {}).gift || ''}</svg>
      <div class="gift-preview" id="giftPreview" aria-hidden="true"></div>
      <h3>${esc(g.title)}</h3>
      <p>${esc(g.text)}</p>
      <div class="foot"><div><div class="price">от ${money(UI.priceOf(g, 'from').n, UI.priceOf(g, 'from').code)}</div><span class="small" style="color:#e7dcff">на любую консультацию</span></div>
      <button class="btn btn-light btn-sm" type="button" data-book="other">${icon('gift')} Подарить</button></div>
    </article>`);
    $('offersGrid').innerHTML = cards.join('');
    if (!cards.length) $('offers').hidden = true;
    const gp = $('giftPreview');
    if (gp && window.Cards) setTimeout(async () => {
      try {
        const cv = await window.Cards.certificate({ number: 'AM-0000', recipient: 'Вас', title: SITE.services[0].title, message: 'Пусть звёзды подскажут самый красивый путь', style: 'paper', validUntil: AC.addDays(new Date(), 365) });
        cv.toBlob((b) => { if (b) gp.innerHTML = `<img src="${URL.createObjectURL(b)}" alt="">`; }, 'image/png');
      } catch (e) { /* превью не обязательно */ }
    }, 400);
  }

  function tools() {
    const tones = ['', 'gold', 'rose'];
    const d = { 'natal.html': 'Колесо карты, планеты в знаках и домах, аспекты и подробное толкование.', 'synastry.html': 'Синастрия двух карт: притяжение, эмоции, общение и надёжность союза.', 'forecast.html': 'Транзиты к вашей карте по месяцам, соляр, прогрессии и профекция года.', 'horoscope.html': 'На сегодня, завтра и месяц — по реальному положению планет.', 'moon.html': 'Фазы, лунные сутки для вашего города, Луна без курса и советы на день.', 'sky.html': 'Ретроградные планеты с теневыми периодами, затмения, новолуния.', 'numerology.html': 'Число жизненного пути, квадрат Пифагора, личный год и числа имени.' };
    $('toolsGrid').innerHTML = UI.TOOLS.map(([h, t, ic], i) => `
      <a class="card hover tool-tile reveal" style="--d:${(i % 3) * 0.08}s" href="${h}">
        <span class="tag new free">бесплатно</span>
        <span class="t-ic card-icon ${tones[i % 3]}" style="margin:0">${icon(ic)}</span><span class="t-bg">${icon(ic)}</span>
        <h3>${t}</h3><p class="muted">${d[h] || ''}</p>
        <span class="link-arrow">Открыть ${icon('arrow')}</span>
      </a>`).join('');
    // премиум-доступ: подробные разделы по коду (js/premium.js, content.js → premium)
    const P = SITE.premium;
    if (P && P.enabled !== false && !$('premiumBand')) {
      const from = Math.min(...(P.plans || []).map((p) => p.price));
      $('toolsGrid').insertAdjacentHTML('afterend', `<a class="card hover premium-band reveal" id="premiumBand" href="premium.html">
        <span class="pw-crown" aria-hidden="true">${icon('crown')}</span>
        <div><span class="eyebrow" style="margin-bottom:4px">${esc(P.name || 'Премиум-доступ')}</span>
          <h3>Хотите глубже? Прогноз по датам и подробные разборы</h3>
          <p class="muted">${(P.features || []).map((f) => esc(f.title)).join(' · ')}</p></div>
        <span class="premium-band-go">${isFinite(from) ? 'от ' + fmt.money(from) : ''}<b>Подробнее ${icon('arrow')}</b></span>
      </a>`);
    }
  }

  function about() {
    const a = SITE.about;
    $('aboutTitle').innerHTML = esc(a.title).replace('Алина', '<em class="accent">Алина</em>');
    $('aboutText').innerHTML = a.paragraphs.map((p, i) => `<p class="${i === 0 ? 'lead' : ''}">${esc(p)}</p>`).join('');
    $('aboutStory').innerHTML = a.story ? `<div class="story">${esc(a.story)}</div>` : '';
    $('aboutValues').innerHTML = a.values.map((v, i) => `<div class="value"><span style="color:var(--gold)">${icon(['heart', 'eye', 'compass'][i % 3])}</span><b>${esc(v.title)}</b><span>${esc(v.text)}</span></div>`).join('');
    $('aboutSign').textContent = a.signature;
    $('aboutCaption').textContent = a.photoCaption || '';
  }

  function academy() {
    const ac = SITE.academy;
    // обучение скрыто (academy.enabled: false) — ни блока, ни кнопки «Уроки астрологии» в «Обо мне»
    if (!UI.academyOn) {
      $('academy').hidden = true;
      document.querySelectorAll('#about a[href="academy.html"]').forEach((a) => a.remove());
      return;
    }
    $('acTitle').innerHTML = esc(ac.title);
    $('acText').textContent = ac.text;
    $('acFormats').innerHTML = ac.formats.map((f, i) => `
      <div class="card ac-card reveal" style="--d:${i * 0.08}s">
        <span style="color:var(--gold-2)">${icon(['book', 'user-heart', 'users'][i % 3])}</span>
        <h3 style="margin-top:10px">${esc(f.title)}</h3>
        <p>${esc(f.text)}</p>
        ${f.note ? `<p class="small" style="color:var(--gold-2)">${esc(f.note)}</p>` : ''}
        <div class="row between ac-foot">
          <span class="price">${f.price ? money(UI.priceOf(f).n, UI.priceOf(f).code) + (f.unit ? ` <small style="font:500 .8rem var(--ff-body);color:#cfc5ee">${esc(f.unit)}</small>` : '') : (f.href ? 'бесплатно' : '')}</span>
          ${f.href ? `<a class="btn btn-light btn-sm" href="${f.href}">${esc(f.cta)}</a>` : `<button class="btn btn-light btn-sm" type="button" data-book="${f.service}">${esc(f.cta)}</button>`}
        </div>
      </div>`).join('');
  }

  function reviews() {
    const list = SITE.reviews || [];
    if (!list.length) { $('reviews').hidden = true; return; }
    $('reviewsList').innerHTML = list.map((r) => `
      <figure class="review" style="margin:0">
        <div class="bubble">
          <div style="color:var(--gold);margin-bottom:8px;display:flex;gap:2px">${icon('star-filled').repeat(5)}</div>
          <blockquote class="quote" style="margin:0">«${esc(r.text)}»</blockquote>
        </div>
        <figcaption class="who"><span class="ava">${esc(r.name[0] || '✦')}</span><span><b>${esc(r.name)}</b><br><span class="small muted">${esc(r.service || '')}</span></span></figcaption>
      </figure>`).join('');
  }

  function faq() {
    $('faqList').innerHTML = SITE.faq.map((f, i) => `<details class="acc-item reveal" style="--d:${i * 0.04}s"${i === 0 ? ' open' : ''}><summary>${esc(f.q)}<span class="pm">${icon('plus')}</span></summary><div class="acc-body">${esc(f.a)}</div></details>`).join('');
  }

  function booking() {
    const pr = UI.promoInfo();
    const promo = pr ? `<div class="promo-inline"><span class="sticker">−${pr.percent}%</span><span><b>${esc(pr.title)}</b><br><small>до ${pr.end.getDate()} ${fmt.MONTHS_GEN[pr.end.getMonth()]} — скидка применится автоматически</small></span></div>` : '';
    // анкета: уходит Алине в Telegram, время она предлагает сама
    $('bookingCard').innerHTML = promo + UI.bookingFormHTML('hb');
    UI.bindBooking($('bookingCard').querySelector('form'));
    const links = UI.contactLinks();
    $('bookingContacts').innerHTML = links.map((l) => `<a class="contact-line" href="${esc(l.href)}" target="_blank" rel="noopener">${icon(l.k)}<span>${esc(l.label)}</span></a>`).join('');
  }

  function media() {
    const m = SITE.media || {};
    let calm = false;
    try { calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.connection && navigator.connection.saveData); } catch (e) { calm = false; }
    if (m.heroVideo && !calm) {
      const v = document.createElement('video');
      Object.assign(v, { src: m.heroVideo, muted: true, loop: true, autoplay: true, playsInline: true, preload: 'auto' });
      v.className = 'scene-video'; v.setAttribute('aria-hidden', 'true'); v.setAttribute('muted', '');
      document.querySelector('.scene-bg').prepend(v);
      v.play().catch(() => {});
    }
    if (m.greetingVideo) {
      const fig = document.querySelector('.polaroid');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'greet';
      b.innerHTML = `<video src="${esc(m.greetingVideo)}" muted loop autoplay playsinline preload="metadata" aria-hidden="true"></video><span class="greet-play">${icon('play-filled')}</span><span class="greet-label">${esc(m.greetingTitle || 'Видео обо мне')}</span>`;
      fig.appendChild(b);
      b.addEventListener('click', () => UI.modal(`<video class="greet-full" src="${esc(m.greetingVideo)}" controls autoplay playsinline></video>`));
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('zodiacRing').innerHTML = zodiacRing();
    media();
    hero(); needs(); curSwitch(); services(); offers(); tools(); about(); academy(); reviews(); faq(); booking();
    UI.reveal();
    setTimeout(() => { try { skyStrip(); } catch (e) { console.error(e); } }, 30);
  });
})();
