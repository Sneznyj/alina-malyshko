/* Нумерология: расчёты (без страницы — проверяются в Node: _dev/test_numerology.js).
   Пифагорейская система: числа сводятся к одной цифре, мастер-числа 11, 22, 33 сохраняются.
   Жизненный путь — по частям (день, месяц, год сводятся отдельно, потом складываются).
   Квадрат Пифагора — по методу Александрова (четыре рабочих числа), одинаково для всех дат. */
(function () {
  'use strict';
  const G = typeof globalThis !== 'undefined' ? globalThis : window;
  const MASTERS = [11, 22, 33];

  const digits = (n) => String(Math.abs(n)).split('').map(Number);
  const digitSum = (n) => digits(n).reduce((a, b) => a + b, 0);
  /** Свести к одной цифре; masters — какие мастер-числа оставить. Возвращает { value, chain: [26, 8] }. */
  function reduceChain(n, masters) {
    const keep = masters || MASTERS;
    const chain = [n];
    while (n > 9 && !keep.includes(n)) { n = digitSum(n); chain.push(n); }
    return { value: n, chain };
  }
  const reduce = (n, masters) => reduceChain(n, masters).value;

  // ---------- по дате ----------
  /** Число жизненного пути: день, месяц и год сводятся отдельно (мастер-числа сохраняются), затем сумма. */
  function lifePath(y, m, d) {
    const day = reduceChain(d, [11, 22]), month = reduceChain(m, [11]), year = reduceChain(digitSum(y), MASTERS);
    year.chain.unshift(y);
    const sum = day.value + month.value + year.value;
    const total = reduceChain(sum, MASTERS);
    return { value: total.value, day, month, year, sum, chain: total.chain };
  }
  /** Число дня рождения: день месяца (11 и 22 сохраняются). */
  const birthday = (d) => reduceChain(d, [11, 22]);
  /** Личный год (1–9): день + месяц рождения + текущий год. Новый личный год — с 1 января. */
  function personalYear(m, d, year) {
    const sum = reduce(d, []) + reduce(m, []) + reduce(digitSum(year), []);
    return { value: reduce(sum, []), sum };
  }
  const personalMonth = (py, month) => reduce(py + reduce(month, []), []);
  const personalDay = (pm, day) => reduce(pm + reduce(day, []), []);
  /** Число дня для всех: сумма цифр даты (1–9). */
  const universalDay = (y, m, d) => reduce(reduce(d, []) + reduce(m, []) + reduce(digitSum(y), []), []);

  // ---------- по имени ----------
  // Кириллица по кругу: А1 Б2 В3 Г4 Д5 Е6 Ё7 Ж8 З9, И1 … Р9, С1 … Щ9, Ъ1 Ы2 Ь3 Э4 Ю5 Я6
  const RU = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
  const EN = 'abcdefghijklmnopqrstuvwxyz';
  const VOWELS = 'аеёиоуыэюяaeiouy';
  function letterValue(ch) {
    const c = String(ch).toLowerCase();
    let i = RU.indexOf(c); if (i >= 0) return (i % 9) + 1;
    i = EN.indexOf(c); if (i >= 0) return (i % 9) + 1;
    return 0;
  }
  const isVowel = (ch) => VOWELS.includes(String(ch).toLowerCase());
  /** Числа имени: выражения (все буквы), души (гласные), личности (согласные). null — букв нет. */
  function nameNumbers(name) {
    const words = String(name || '').trim().split(/[\s\-–—]+/).filter(Boolean).map((w) => {
      const letters = Array.from(w).filter((c) => letterValue(c)).map((c) => ({ ch: c, v: letterValue(c), vowel: isVowel(c) }));
      return { word: w, letters, sum: letters.reduce((a, l) => a + l.v, 0) };
    }).filter((w) => w.letters.length);
    if (!words.length) return null;
    const all = words.flatMap((w) => w.letters);
    const sumOf = (ls) => ls.reduce((a, l) => a + l.v, 0);
    const ex = sumOf(all), so = sumOf(all.filter((l) => l.vowel)), pe = sumOf(all.filter((l) => !l.vowel));
    return {
      words,
      expression: Object.assign(reduceChain(ex), { sum: ex }),
      soul: so ? Object.assign(reduceChain(so), { sum: so }) : null,
      personality: pe ? Object.assign(reduceChain(pe), { sum: pe }) : null,
    };
  }

  // ---------- квадрат Пифагора (психоматрица, метод Александрова) ----------
  const LINES = {
    goal: [1, 4, 7], family: [2, 5, 8], habits: [3, 6, 9], // строки
    self: [1, 2, 3], money: [4, 5, 6], talent: [7, 8, 9], // столбцы
    spirit: [1, 5, 9], temper: [3, 5, 7], // диагонали
  };
  function pythagoras(y, m, d) {
    const pad = (n) => String(n).padStart(2, '0');
    const date = pad(d) + pad(m) + String(y);
    const dateDigits = date.split('').map(Number);
    const w1 = dateDigits.reduce((a, b) => a + b, 0);
    const w2 = digitSum(w1);
    const firstDayDigit = +pad(d)[0] || +pad(d)[1];
    const raw3 = w1 - 2 * firstDayDigit;
    const w3 = Math.abs(raw3);
    const w4 = digitSum(w3);
    const all = dateDigits.concat(digits(w1), digits(w2), digits(w3), digits(w4)).filter((x) => x > 0);
    const counts = {}; for (let i = 1; i <= 9; i++) counts[i] = 0;
    for (const x of all) counts[x]++;
    const lines = {};
    for (const [k, cells] of Object.entries(LINES)) lines[k] = cells.reduce((a, c) => a + counts[c], 0);
    return { work: [w1, w2, w3, w4], negative3: raw3 < 0, firstDayDigit, counts, lines, total: all.length };
  }

  G.Numerology = { MASTERS, digits, digitSum, reduce, reduceChain, lifePath, birthday, personalYear, personalMonth, personalDay, universalDay, letterValue, isVowel, nameNumbers, pythagoras, LINES };
})();
