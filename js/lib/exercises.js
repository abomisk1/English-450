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

function buildChooseMeaning(item) {
  const wrong = distractors(item, ALL_ITEMS, 3);
  const options = shuffle([
    { id: item.id, label: item.arabic, correct: true, lang: 'ar' },
    ...wrong.map((w) => ({ id: w.id, label: w.arabic, correct: false, lang: 'ar' })),
  ]);
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
  const wrong = distractors(item, pool, 3);
  const options = shuffle([
    { id: item.id, label: item.english, correct: true, lang: 'en' },
    ...wrong.map((w) => ({ id: w.id, label: w.english, correct: false, lang: 'en' })),
  ]);
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
  const wrong = distractors(item, pool, 3);
  const options = shuffle([
    { id: item.id, label: item.english, correct: true, lang: 'en' },
    ...wrong.map((w) => ({ id: w.id, label: w.english, correct: false, lang: 'en' })),
  ]);
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

  const pool = ALL_ITEMS.flatMap((it) => it.english.split(' ')).map((w) =>
    w.replace(/[.,!?]/g, ''),
  );
  const wrongWords = shuffle(
    [...new Set(pool)].filter(
      (w) => w.length > 2 && w.toLowerCase() !== answerWord.toLowerCase(),
    ),
  ).slice(0, 3);
  const options = shuffle([
    { id: 'correct', label: answerWord, correct: true, lang: 'en' },
    ...wrongWords.map((w, i) => ({ id: `w${i}`, label: w, correct: false, lang: 'en' })),
  ]);

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
  const sameKind = distractors(item, ALL_ITEMS, 6).filter((w) => w.kind === item.kind);
  const filler = distractors(item, ALL_ITEMS, 3);
  const pool = (sameKind.length >= 3 ? sameKind : filler).slice(0, 3);
  const options = shuffle([
    { id: item.id, label: item.english, correct: true, lang: 'en' },
    ...pool.map((w) => ({ id: w.id, label: w.english, correct: false, lang: 'en' })),
  ]);
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
