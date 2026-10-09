/* Страница «Премиум-доступ»: статус доступа, что входит, тарифы, как оформить, ввод кода, вопросы и условия.
   Тарифы и тексты возможностей — js/content.js → premium. Логика кодов — js/premium.js. */
(function () {
  'use strict';
  const UI = window.UI, SITE = window.SITE, Pm = window.Premium;
  const { esc, fmt, icon } = UI;
  const P = SITE.premium || {};
  const $ = (id) => document.getElementById(id);
  const site = () => 'https://' + String(SITE.siteUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

  const FAQ = [
    ['Это подписка? Деньги будут списываться сами?', 'Нет. Вы оплачиваете выбранный срок один раз — 7 дней, месяц или год. Никаких автосписаний: срок закончится — продлите, если захотите.'],
    ['Как я получу доступ?', 'После оплаты Алина пришлёт личную ссылку. Откройте её — премиум-разделы откроются сразу, без регистрации и паролей.'],
    ['Можно пользоваться на телефоне и компьютере?', 'Да. Откройте ту же ссылку на каждом своём устройстве. Сохраните сообщение со ссылкой — она понадобится, если почистите браузер или смените телефон.'],
    ['Можно смотреть прогнозы и разборы для близких?', 'Да: вводите данные рождения любого человека — мамы, партнёра, ребёнка. Доступ открывает разделы, а не одну карту.'],
    ['Чем это отличается от консультации?', 'Премиум — точные расчёты и автоматические толкования каждой части карты. На консультации Алина собирает их в цельную картину именно про вас и отвечает на ваши вопросы. Одно хорошо дополняет другое.'],
    ['Можно подарить?', 'Да. Отметьте «Это подарок» в заявке — Алина пришлёт ссылку, которую можно переслать получателю.'],
    ['Что, если доступ не открылся?', 'Напишите Алине и пришлите ссылку из сообщения — она проверит и поможет.'],
  ];
  const STEPS = [
    ['sparkle', 'Выберите тариф', 'Неделя, месяц или год — все премиум-разделы в любом из них.'],
    ['send', 'Отправьте заявку', 'Текст составится сам — останется отправить Алине в Telegram или удобный мессенджер.'],
    ['receipt', 'Оплатите', 'Алина ответит, как удобнее оплатить, и пришлёт чек.'],
    ['key', 'Откройте ссылку', 'Личная ссылка откроет всё сразу — на любом вашем устройстве до конца срока.'],
  ];

  function status() {
    const s = Pm.state() || {};
    const box = $('pmStatus');
    if (s.kind === 'alina') {
      box.innerHTML = `<div class="card pm-status">${icon('crown')}<div><b>Алина, вам открыто всё</b><span>Коды клиентам — в кабинете, раздел «Доступы».</span></div><a class="btn btn-primary btn-sm" href="cabinet.html#access">Выдать доступ</a></div>`;
    } else if (s.kind === 'active') {
      const left = s.info.to - Pm.todayNum();
      box.innerHTML = `<div class="card pm-status on">${icon('crown')}<div><b>${s.info.name ? esc(s.info.name) + ', ваш доступ открыт' : 'Ваш доступ открыт'}</b><span>по ${fmt.date(Pm.dateOf(s.info.to))} включительно · ${left === 0 ? 'последний день' : 'осталось ' + left + ' ' + fmt.plural(left, 'день', 'дня', 'дней')}</span></div>
        <button class="btn btn-ghost btn-sm" type="button" data-pm="link">${icon('link')} Ссылка для другого устройства</button></div>`;
    } else if (s.kind === 'expired') {
      box.innerHTML = `<div class="card pm-status off">${icon('hourglass')}<div><b>Ваш доступ закончился ${fmt.date(Pm.dateOf(s.info.to))}</b><span>Продлите — и всё снова откроется.</span></div><a class="btn btn-primary btn-sm" href="#plans">Продлить</a></div>`;
    } else if (s.kind === 'notyet') {
      box.innerHTML = `<div class="card pm-status">${icon('calendar')}<div><b>Доступ начнётся ${fmt.date(Pm.dateOf(s.info.from))}</b><span>Ссылка сохранена — в этот день всё откроется само.</span></div></div>`;
    } else {
      box.innerHTML = `<div class="hero-cta" style="margin-top:6px"><a class="btn btn-primary" href="#plans">Выбрать тариф</a><button class="btn btn-ghost" type="button" data-pw="code">${icon('key')} У меня есть код</button></div>`;
    }
  }

  function features() {
    const open = Pm.isOpen();
    $('pmFeatures').innerHTML = (P.features || []).map((f, i) => `
      <a class="card hover pm-feat reveal" style="--d:${(i % 2) * 0.08}s" href="${esc(f.href)}">
        <span class="card-icon ${['', 'rose', 'gold', ''][i % 4]}">${icon(f.icon)}</span>
        <h3>${esc(f.title)}</h3><p class="muted">${esc(f.text)}</p>
        <span class="link-arrow">${open ? 'Открыть' : 'Посмотреть, что бесплатно'} ${icon('arrow')}</span>
      </a>`).join('');
  }

  function plans() {
    $('pmPlans').innerHTML = `<div class="pm-paywall" data-paywall="">${Pm.planCards()}
      <div class="pw-foot" style="justify-content:center"><button type="button" class="btn btn-ghost btn-sm" data-pw="code">${icon('key')} У меня есть код</button></div></div>`;
  }

  function steps() {
    $('pmSteps').innerHTML = STEPS.map(([ic, t, d], i) => `<li class="card reveal" style="--d:${i * 0.06}s" data-n="${i + 1}"><span class="pm-step-ic">${icon(ic)}</span><b>${t}</b><span class="small muted">${d}</span></li>`).join('');
    $('pmActivate').innerHTML = `<div class="pm-act-head">${icon('key')}<div><h3 style="margin:0">Уже есть ссылка или код?</h3><p class="small muted" style="margin:2px 0 0">Вставьте её сюда — доступ откроется на этом устройстве.</p></div></div>
      <form class="pm-act-form" novalidate><textarea class="textarea" id="pmCode" rows="2" spellcheck="false" autocomplete="off" placeholder="https://…/premium.html#k=…" aria-label="Ссылка или код доступа"></textarea>
      <button class="btn btn-primary" type="submit">${icon('lock-open')} Открыть</button></form><p class="lock-err small" role="alert" id="pmErr"></p>`;
    const ta = $('pmCode'), err = $('pmErr');
    ta.addEventListener('input', () => { err.textContent = ''; ta.classList.remove('invalid'); });
    $('pmActivate').querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = Pm.extract(ta.value);
      if (!code) { err.textContent = 'Это не похоже на код доступа. Скопируйте ссылку из сообщения Алины целиком.'; ta.classList.add('invalid'); return; }
      const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
      const r = await Pm.activate(code);
      btn.disabled = false;
      if (r.ok) { ta.value = ''; Pm.welcome(r.info); return; }
      err.textContent = Pm.whyText(r);
      if (r.why !== 'notyet') ta.classList.add('invalid');
    });
  }

  function faq() {
    $('pmFaq').innerHTML = FAQ.map(([q, a], i) => `<details class="acc-item reveal" style="--d:${i * 0.04}s"><summary>${esc(q)}<span class="pm">${icon('plus')}</span></summary><div class="acc-body">${esc(a)}</div></details>`).join('');
    const terms = [
      'Премиум-доступ открывает разделы сайта, перечисленные выше, на выбранный срок — по дату, указанную в ссылке, включительно. Автоматических списаний нет: продление — новой оплатой.',
      'Доступ личный: пользуйтесь ссылкой на любом своём устройстве, но, пожалуйста, не публикуйте её. Опубликованную ссылку Алина может отключить.',
      'Расчёты и толкования носят информационный характер — это инструмент самопознания. Они не заменяют помощь врача, психолога, юриста или финансового специалиста.',
      'Вопросы по оплате и доступу — Алине, контакты внизу страницы.',
    ];
    $('pmTerms').innerHTML = `<h3 style="margin-top:0">Условия</h3><ul class="small" style="margin:0;padding-left:1.1em;display:grid;gap:6px">${terms.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>${P.seller ? `<p class="small muted" style="margin:12px 0 0">${esc(P.seller)}</p>` : ''}`;
    $('pmNote').innerHTML = UI.alinaNote('Премиум — для тех, кто любит разбираться сам: даты, аспекты, числа. А если захочется поговорить о вашей карте вживую — я рядом.', '<button class="btn btn-primary btn-sm" type="button" data-book>Записаться на консультацию</button>');
  }

  function render() { status(); features(); }

  document.addEventListener('DOMContentLoaded', async () => {
    plans(); steps(); faq();
    await Pm.ready();
    render();
    UI.reveal(document.getElementById('main'));
    document.addEventListener('premiumchange', render);
    document.getElementById('pmStatus').addEventListener('click', async (e) => {
      if (!e.target.closest('[data-pm="link"]')) return;
      const s = Pm.state();
      if (s && s.code && (await UI.copyText(`${site()}/premium.html#k=${s.code}`))) UI.toast('Ссылка скопирована — откройте её на другом устройстве', 'link');
    });
  });
})();
