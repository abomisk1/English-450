import { WORDS } from './words.js';
import { PHRASES } from './phrases.js';

export { WORDS, PHRASES };

// إجمالي الأهداف — تُستخدم في شرائط التقدم (350 كلمة / 100 جملة).
export const TARGET_WORDS = 350;
export const TARGET_PHRASES = 100;

// تحويل كلمة/جملة إلى عنصر تعليمي موحّد (LearnItem).
export function wordToItem(w) {
  return {
    id: w.id,
    kind: 'word',
    english: w.english,
    arabic: w.arabic,
    category: w.category,
    difficulty: w.difficulty,
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
