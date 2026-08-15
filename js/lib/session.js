// بناء خطة الجلسة اليومية.
//
// SessionStep:
//   { kind: 'learn', item }
//   { kind: 'exercise', exercise, isReview }

import { ITEMS_BY_ID, ITEMS_BY_LEVEL, LEVEL_COUNT } from '../data/index.js';
import { isDue } from './srs.js';
import { buildExercise, typesFor } from './exercises.js';
import { sample, shuffle } from './shuffle.js';

const NEW_ITEMS_PER_SESSION = 6;
const MAX_REVIEWS_PER_SESSION = 6;

// أول العناصر غير المتعلَّمة في قائمة مرتّبة حسب order.
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

function clampLevel(level, progress) {
  const L = level || progress.activeLevel || 1;
  return Math.min(LEVEL_COUNT, Math.max(1, L | 0));
}

// بناء خطة جلسة:
// 1) مراجعات مستحقة عالميًا (نظام المراجعة المتباعدة عبر كل ما تعلّمه المستخدم).
// 2) عناصر جديدة من *المستوى المختار* (activeLevel) مع بطاقة تعلّم لكل عنصر ثم تمرينين.
// 3) تحدٍّ ختامي قصير على عناصر الجلسة.
export function buildSession(progress, level, now = Date.now()) {
  const L = clampLevel(level, progress);
  const reviewItems = dueItems(progress, now).slice(0, MAX_REVIEWS_PER_SESSION);
  const newItems = firstUnlearned(ITEMS_BY_LEVEL[L] || [], progress, NEW_ITEMS_PER_SESSION);

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

export function hasSessionContent(progress, level, now = Date.now()) {
  return buildSession(progress, level, now).steps.length > 0;
}
