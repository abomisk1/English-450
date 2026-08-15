// بناء خطة الجلسة اليومية.
//
// SessionStep:
//   { kind: 'learn', item }
//   { kind: 'exercise', exercise, isReview }

import { WORD_ITEMS, PHRASE_ITEMS, ITEMS_BY_ID } from '../data/index.js';
import { isDue } from './srs.js';
import { buildExercise, typesFor } from './exercises.js';
import { sample, shuffle } from './shuffle.js';

const NEW_WORDS_PER_SESSION = 4;
const NEW_PHRASES_PER_SESSION = 2;
const MAX_REVIEWS_PER_SESSION = 6;

function firstUnlearned(items, progress, limit) {
  const ordered = [...items].sort((a, b) => a.order - b.order);
  const out = [];
  for (const it of ordered) {
    const p = progress.items[it.id];
    if (!p || p.status === 'new') out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

function dueItems(progress, now) {
  return Object.values(progress.items)
    .filter((p) => p.status !== 'new' && p.status !== 'mastered' && isDue(p, now))
    .map((p) => ITEMS_BY_ID[p.id])
    .filter(Boolean)
    .sort((a, b) => progress.items[a.id].dueAt - progress.items[b.id].dueAt);
}

// بناء خطة جلسة اليوم:
// 1) مراجعات مستحقة (أولوية).
// 2) عناصر جديدة (كلمات + جمل) مع بطاقة تعلّم لكل عنصر ثم تمرينين.
// 3) تحدٍّ ختامي قصير على عناصر الجلسة.
export function buildSession(progress, now = Date.now()) {
  const reviewItems = dueItems(progress, now).slice(0, MAX_REVIEWS_PER_SESSION);
  const newWords = firstUnlearned(WORD_ITEMS, progress, NEW_WORDS_PER_SESSION);
  const newPhrases = firstUnlearned(PHRASE_ITEMS, progress, NEW_PHRASES_PER_SESSION);
  const newItems = [...newWords, ...newPhrases];

  const steps = [];

  // 1) مراجعات مستحقة في البداية (استرجاع مباشر)
  for (const item of reviewItems) {
    const type = sample(typesFor(item));
    steps.push({ kind: 'exercise', exercise: buildExercise(item, type), isReview: true });
  }

  // 2) لكل عنصر جديد: بطاقة تعلّم ثم تمرينان بنوعين مختلفين
  for (const item of newItems) {
    steps.push({ kind: 'learn', item });
    const types = shuffle(typesFor(item)).slice(0, 2);
    for (const t of types) {
      steps.push({ kind: 'exercise', exercise: buildExercise(item, t), isReview: false });
    }
  }

  // 3) تحدٍّ ختامي: تمرين إضافي على عناصر عشوائية من الجلسة
  const challengePool = shuffle([...newItems, ...reviewItems]).slice(0, 3);
  for (const item of challengePool) {
    const type = sample(typesFor(item));
    steps.push({ kind: 'exercise', exercise: buildExercise(item, type), isReview: true });
  }

  return { steps, newItems, reviewItems };
}

export function hasSessionContent(progress, now = Date.now()) {
  return buildSession(progress, now).steps.length > 0;
}
