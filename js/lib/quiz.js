// منطق الاختبارات (اختبار المستوى + الاختبار النهائي) — طبقة نقيّة بلا واجهة.
//
// يُعيد استخدام مولّد التمارين الحالي (buildExercise) وأنواعه المجرّبة، مع فصل
// الاختبار تمامًا عن جلسات التعلّم اليومية: لا يمسّ SRS ولا نسبة الإنجاز ولا النقاط.
//
// اختيار الأسئلة:
//   • اختبار المستوى: 20 سؤالًا من عناصر المستوى نفسه فقط، بلا تكرار عنصر،
//     موزّعة بين الكلمات والجمل بحسب نسبة وجود كل نوع في المستوى، وعشوائية كل محاولة.
//   • الاختبار النهائي: 50 سؤالًا موزّعة على المستويات الستة (8/8/8/8/9/9)، وداخل كل
//     مستوى موزّعة بين الكلمات والجمل بالتناسب، بلا تكرار عنصر، وعشوائية كل محاولة.

import { ITEMS_BY_LEVEL, LEVEL_COUNT } from '../data/index.js';
import { buildExercise } from './exercises.js';
import { shuffle, sample, sampleN } from './shuffle.js';

export const LEVEL_QUIZ_SIZE = 20;
export const FINAL_QUIZ_SIZE = 50;
export const PASS_RATIO = 0.8; // 80% — نجاح الاختبار
export const LEVEL_PASS_SCORE = Math.ceil(LEVEL_QUIZ_SIZE * PASS_RATIO); // 16 / 20
export const FINAL_PASS_SCORE = Math.ceil(FINAL_QUIZ_SIZE * PASS_RATIO); // 40 / 50

// توزيع أسئلة الاختبار النهائي على المستويات الستة (المجموع = 50).
export const FINAL_PER_LEVEL = [8, 8, 8, 8, 9, 9];

// هل النتيجة ناجحة في اختبار المستوى؟
export function isLevelPass(score) {
  return score >= LEVEL_PASS_SCORE;
}

// هل النتيجة ناجحة في الاختبار النهائي؟
export function isFinalPass(score) {
  return score >= FINAL_PASS_SCORE;
}

// اختيار count عنصرًا من قائمة عناصر مع توزيع الكلمات/الجمل بالتناسب وبلا تكرار.
export function pickProportional(items, count) {
  const words = items.filter((x) => x.kind === 'word');
  const phrases = items.filter((x) => x.kind === 'phrase');
  const total = words.length + phrases.length;
  if (total <= count) return shuffle(items);

  let wSlots = Math.round((count * words.length) / total);
  let pSlots = count - wSlots;
  // لا نتجاوز المتاح فعلًا من كل نوع، ونملأ الباقي من النوع الآخر.
  pSlots = Math.min(pSlots, phrases.length);
  wSlots = Math.min(count - pSlots, words.length);
  pSlots = count - wSlots;

  return shuffle([...sampleN(words, wSlots), ...sampleN(phrases, pSlots)]);
}

// أنواع الأسئلة المستخدمة في الاختبار — مجموعة الاختيار المتعدّد المجرّبة أصلًا،
// نفس أنماط التعلّم دون إضافة نوع جديد.
export function quizTypesFor(item) {
  return item.kind === 'word'
    ? ['choose-meaning', 'choose-english', 'listen-choose']
    : ['choose-meaning', 'listen-choose', 'situation'];
}

// يبني تمرين اختبار واحدًا لعنصر (اختيار متعدّد، بخيار صحيح واحد).
export function buildQuizQuestion(item) {
  return buildExercise(item, sample(quizTypesFor(item)));
}

// عناصر اختبار مستوى معيّن (عيّنة متناسبة بلا تكرار).
export function pickLevelQuizItems(level, size = LEVEL_QUIZ_SIZE) {
  const items = ITEMS_BY_LEVEL[level] || [];
  return pickProportional(items, Math.min(size, items.length));
}

// بناء اختبار مستوى: قائمة أسئلة اختيار متعدّد بترتيب عشوائي.
export function buildLevelQuiz(level, size = LEVEL_QUIZ_SIZE) {
  return pickLevelQuizItems(level, size).map((it) => buildQuizQuestion(it));
}

// عناصر الاختبار النهائي: عيّنة من كل مستوى بحسب FINAL_PER_LEVEL، مع تمثيل النوعين.
export function pickFinalQuizItems() {
  const chosen = [];
  for (let L = 1; L <= LEVEL_COUNT; L++) {
    const quota = FINAL_PER_LEVEL[L - 1] || 0;
    chosen.push(...pickProportional(ITEMS_BY_LEVEL[L] || [], quota));
  }
  return chosen;
}

// بناء الاختبار النهائي: 50 سؤالًا تمثّل المستويات الستة، بترتيب عشوائي.
export function buildFinalQuiz() {
  return shuffle(pickFinalQuizItems().map((it) => buildQuizQuestion(it)));
}
