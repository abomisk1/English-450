// أنواع التمارين (interleaving). كل تمرين مرتبط بعنصر تعليمي (item).
//
// ExerciseType:
//  'choose-meaning'  اختر المعنى العربي الصحيح
//  'choose-english'  اختر الكلمة الإنجليزية للمعنى العربي
//  'listen-choose'   استمع واختر ما سمعت
//  'fill-blank'      أكمل الناقص
//  'word-order'      رتّب كلمات الجملة
//  'situation'       موقف واختر العبارة المناسبة

import { ALL_ITEMS, WORD_ITEMS } from '../data/index.js';
import { shuffle, sampleN } from './shuffle.js';

let keyCounter = 0;
const nextKey = () => `ex-${keyCounter++}`;

// بناء خيارات مشتّتة (distractors) من عناصر أخرى مشابهة قدر الإمكان.
function distractors(item, pool, n) {
  const sameCat = pool.filter((x) => x.id !== item.id && x.category === item.category);
  const others = pool.filter((x) => x.id !== item.id && x.category !== item.category);
  const chosen = [...sampleN(sameCat, n), ...sampleN(others, n)];
  const seen = new Set();
  const unique = [];
  for (const c of chosen) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      unique.push(c);
    }
    if (unique.length >= n) break;
  }
  return unique.slice(0, n);
}

// توحيد نص الخيار لمقارنة عدم التكرار (تجاهل الحالة والمسافات الطرفية).
function normLabel(s) {
  return String(s).trim().toLowerCase();
}

// يجمّع الخيارات مع ضمان: خيار صحيح واحد + خيارات فريدة النص (بلا تكرار)، ثم يخلطها.
// candidates: قائمة خيارات خاطئة محتملة (قد تكون أكثر من المطلوب) — نأخذ الفريد منها فقط.
function assembleOptions(correct, candidates, n = 3) {
  const seen = new Set([normLabel(correct.label)]);
  const opts = [{ ...correct, correct: true }];
  for (const c of candidates) {
    const k = normLabel(c.label);
    if (seen.has(k)) continue;
    seen.add(k);
    opts.push({ ...c, correct: false });
    if (opts.length >= n + 1) break;
  }
  return shuffle(opts);
}

function buildChooseMeaning(item) {
  const wrong = distractors(item, ALL_ITEMS, 8);
  const options = assembleOptions(
    { id: item.id, label: item.arabic, lang: 'ar' },
    wrong.map((w) => ({ id: w.id, label: w.arabic, lang: 'ar' })),
  );
  return {
    key: nextKey(),
    type: 'choose-meaning',
    item,
    prompt: item.kind === 'word' ? 'ما معنى هذه الكلمة؟' : 'ما معنى هذه الجملة؟',
    options,
    hint: item.exampleArabic,
  };
}

function buildChooseEnglish(item) {
  const pool = item.kind === 'word' ? WORD_ITEMS : ALL_ITEMS;
  const wrong = distractors(item, pool, 8);
  const options = assembleOptions(
    { id: item.id, label: item.english, lang: 'en' },
    wrong.map((w) => ({ id: w.id, label: w.english, lang: 'en' })),
  );
  return {
    key: nextKey(),
    type: 'choose-english',
    item,
    prompt: 'اختر الترجمة الإنجليزية الصحيحة:',
    options,
  };
}

function buildListenChoose(item) {
  const pool = item.kind === 'word' ? WORD_ITEMS : ALL_ITEMS;
  const wrong = distractors(item, pool, 8);
  const options = assembleOptions(
    { id: item.id, label: item.english, lang: 'en' },
    wrong.map((w) => ({ id: w.id, label: w.english, lang: 'en' })),
  );
  return {
    key: nextKey(),
    type: 'listen-choose',
    item,
    prompt: 'استمع جيدًا، ثم اختر ما سمعت:',
    options,
    answer: item.english,
    hint: item.arabic,
  };
}

function buildFillBlank(item) {
  // نُخفي كلمة واحدة من الجملة الإنجليزية (للكلمات نستخدم المثال).
  const sentence = item.kind === 'phrase' ? item.english : item.exampleEnglish || item.english;
  const words = sentence.split(' ');
  const candidates = words
    .map((w, i) => ({ w: w.replace(/[.,!?]/g, ''), i }))
    .filter((x) => x.w.length > 2);
  const target = candidates.length ? sampleN(candidates, 1)[0] : { w: words[0], i: 0 };
  const answerWord = words[target.i].replace(/[.,!?]/g, '');
  const display = words.map((w, i) => (i === target.i ? '‹___›' : w)).join(' ');

  // تجميع كلمات مرشّحة فريدة (تجاهل الحالة) واستبعاد الكلمة الصحيحة.
  const seenWord = new Set([answerWord.toLowerCase()]);
  const poolWords = [];
  for (const it of ALL_ITEMS) {
    for (const raw of it.english.split(' ')) {
      const w = raw.replace(/[.,!?]/g, '');
      const k = w.toLowerCase();
      if (w.length > 2 && !seenWord.has(k)) {
        seenWord.add(k);
        poolWords.push(w);
      }
    }
  }
  const options = assembleOptions(
    { id: 'correct', label: answerWord, lang: 'en' },
    shuffle(poolWords).map((w, i) => ({ id: `w${i}`, label: w, lang: 'en' })),
  );

  return {
    key: nextKey(),
    type: 'fill-blank',
    item,
    prompt: 'أكمل الفراغ في الجملة:',
    blankDisplay: display,
    options,
    answer: answerWord,
    hint: item.arabic,
  };
}

function buildWordOrder(item) {
  const sentence = item.kind === 'phrase' ? item.english : item.exampleEnglish || item.english;
  const tokens = sentence
    .replace(/[.?!]/g, '')
    .split(' ')
    .filter(Boolean);
  let scrambled = shuffle(tokens);
  if (tokens.length > 1 && scrambled.join(' ') === tokens.join(' ')) {
    scrambled = shuffle(tokens);
  }
  return {
    key: nextKey(),
    type: 'word-order',
    item,
    prompt: 'رتّب الكلمات لتكوين الجملة الصحيحة:',
    tokens: scrambled,
    answer: tokens.join(' '),
    hint: item.arabic,
  };
}

function buildSituation(item) {
  const sameKind = distractors(item, ALL_ITEMS, 10).filter((w) => w.kind === item.kind);
  const filler = distractors(item, ALL_ITEMS, 10);
  const pool = sameKind.length >= 3 ? sameKind : [...sameKind, ...filler];
  const options = assembleOptions(
    { id: item.id, label: item.english, lang: 'en' },
    pool.map((w) => ({ id: w.id, label: w.english, lang: 'en' })),
  );
  return {
    key: nextKey(),
    type: 'situation',
    item,
    prompt: `الموقف: ${item.context || item.arabic}\nما العبارة المناسبة؟`,
    options,
    hint: item.arabic,
  };
}

export function buildExercise(item, type) {
  switch (type) {
    case 'choose-meaning':
      return buildChooseMeaning(item);
    case 'choose-english':
      return buildChooseEnglish(item);
    case 'listen-choose':
      return buildListenChoose(item);
    case 'fill-blank':
      return buildFillBlank(item);
    case 'word-order':
      return buildWordOrder(item);
    case 'situation':
      return buildSituation(item);
    default:
      return buildChooseMeaning(item);
  }
}

// أنواع التمارين المناسبة لكل نوع عنصر.
export function typesFor(item) {
  if (item.kind === 'phrase') {
    return ['choose-meaning', 'listen-choose', 'word-order', 'fill-blank', 'situation'];
  }
  return ['choose-meaning', 'choose-english', 'listen-choose', 'fill-blank'];
}
