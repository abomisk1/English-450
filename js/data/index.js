import { WORDS } from './words.js';
import { PHRASES } from './phrases.js';
import { LEVELS } from './levels.js';

export { WORDS, PHRASES, LEVELS };

// إجمالي الأهداف — تُستخدم في شرائط التقدم (350 كلمة / 100 جملة).
export const TARGET_WORDS = 350;
export const TARGET_PHRASES = 100;
export const LEVEL_COUNT = 6;

// تحويل كلمة/جملة إلى عنصر تعليمي موحّد (LearnItem).
export function wordToItem(w) {
  return {
    id: w.id,
    kind: 'word',
    english: w.english,
    arabic: w.arabic,
    category: w.category,
    difficulty: w.difficulty,
    level: w.level,
    order: w.order,
    partOfSpeech: w.partOfSpeech,
    exampleEnglish: w.exampleEnglish,
    exampleArabic: w.exampleArabic,
  };
}

export function phraseToItem(p) {
  return {
    id: p.id,
    kind: 'phrase',
    english: p.english,
    arabic: p.arabic,
    category: p.category,
    difficulty: p.difficulty,
    level: p.level,
    order: p.order,
    context: p.context,
  };
}

export const WORD_ITEMS = WORDS.map(wordToItem);
export const PHRASE_ITEMS = PHRASES.map(phraseToItem);

// كل العناصر التعليمية موحّدة.
export const ALL_ITEMS = [...WORD_ITEMS, ...PHRASE_ITEMS];

export const ITEMS_BY_ID = Object.fromEntries(ALL_ITEMS.map((it) => [it.id, it]));

export const WORD_IDS = new Set(WORDS.map((w) => w.id));
export const PHRASE_IDS = new Set(PHRASES.map((p) => p.id));

// —— تجميع العناصر حسب المستوى (1..6) ——
// عناصر كل مستوى مرتّبة حسب order (الأسهل أولًا داخل المستوى).
export const ITEMS_BY_LEVEL = {};
for (let L = 1; L <= LEVEL_COUNT; L++) ITEMS_BY_LEVEL[L] = [];
for (const it of ALL_ITEMS) {
  if (ITEMS_BY_LEVEL[it.level]) ITEMS_BY_LEVEL[it.level].push(it);
}
for (let L = 1; L <= LEVEL_COUNT; L++) {
  ITEMS_BY_LEVEL[L].sort((a, b) => a.order - b.order);
}

// أعداد كل مستوى (كلمات/جمل/الإجمالي) — تُستخدم في شاشة اختيار المستويات.
export const LEVEL_COUNTS = {};
for (let L = 1; L <= LEVEL_COUNT; L++) {
  const items = ITEMS_BY_LEVEL[L];
  LEVEL_COUNTS[L] = {
    words: items.filter((x) => x.kind === 'word').length,
    phrases: items.filter((x) => x.kind === 'phrase').length,
    total: items.length,
  };
}
