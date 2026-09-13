/**
 * المراجعة المتباعدة (Spaced Repetition).
 *
 * تعيد على المستخدم الأسئلة والمعلومات التي لم يُتقنها، وتباعد ما أتقنه.
 * خوارزمية مبسّطة على غرار SM-2 بفواصل بالأيام.
 */

export const DAY = 24 * 60 * 60 * 1000;

/** الفواصل الأولى بالأيام قبل دخول طور المضاعفة. */
export const STEPS = [1, 3, 7];

export function newCard(now = Date.now()) {
  return { ease: 2.5, interval: 0, due: now, reps: 0, lapses: 0, step: 0 };
}

/**
 * تحديث بطاقة بعد المراجعة.
 * @param {object} card البطاقة الحالية (أو undefined لبطاقة جديدة)
 * @param {boolean} correct هل أجاب إجابة صحيحة؟
 * @param {number} now الوقت الحالي
 */
export function grade(card, correct, now = Date.now()) {
  const c = card ? { ...card } : newCard(now);
  if (!correct) {
    c.lapses += 1;
    c.reps += 1;
    c.step = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.interval = 0;
    // يُعاد في نفس الجلسة تقريبًا (بعد ١٠ دقائق).
    c.due = now + 10 * 60 * 1000;
    return c;
  }
  c.reps += 1;
  if (c.step < STEPS.length) {
    c.interval = STEPS[c.step];
    c.step += 1;
  } else {
    c.interval = Math.max(1, Math.round(c.interval * c.ease));
    c.ease = Math.min(3.2, c.ease + 0.05);
  }
  c.due = now + c.interval * DAY;
  return c;
}

/** هل حان وقت هذه البطاقة؟ */
export function isDue(card, now = Date.now()) {
  return !card || (card.due || 0) <= now;
}

/**
 * اختيار العناصر المستحقة للمراجعة، الأقدم استحقاقًا أولًا.
 * @param {object} reviewMap خريطة { key: card }
 * @param {number} limit أقصى عدد
 */
export function dueItems(reviewMap, now = Date.now(), limit = 20) {
  return Object.entries(reviewMap || {})
    .filter(([, c]) => isDue(c, now))
    .sort((a, b) => (a[1].due || 0) - (b[1].due || 0))
    .slice(0, limit)
    .map(([key, card]) => ({ key, card }));
}

/** عدّ العناصر المستحقة اليوم. */
export function dueCount(reviewMap, now = Date.now()) {
  return Object.values(reviewMap || {}).filter((c) => isDue(c, now)).length;
}

/** مفتاح موحّد لعنصر مراجعة. */
export function itemKey(unitId, lessonId, quizId) {
  return `${unitId}/${lessonId}/${quizId}`;
}

export function parseKey(key) {
  const [unitId, lessonId, quizId] = String(key).split('/');
  return { unitId, lessonId, quizId };
}

/** متى تُستحقّ البطاقة التالية؟ يعيد نصًّا عربيًّا مختصرًا. */
export function dueLabel(card, now = Date.now()) {
  if (isDue(card, now)) return 'الآن';
  const days = Math.ceil(((card.due || 0) - now) / DAY);
  if (days <= 1) return 'غدًا';
  if (days === 2) return 'بعد يومين';
  if (days <= 10) return `بعد ${days} أيام`;
  return `بعد ${Math.round(days / 7)} أسابيع`;
}
