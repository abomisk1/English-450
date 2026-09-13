/**
 * احتساب التقدّم والإنجاز.
 *
 * المبدأ: التقدّم الحقيقي يُقاس بإكمال المحتوى، وإتقان الاختبارات،
 * وتنفيذ المهام الأدائية — لا بالنقاط وحدها.
 */

import { PASS_MARK } from './quiz.js';

/** هل أُكمل الدرس؟ يُشترط الاطّلاع على بطاقاته واجتياز اختباره. */
export function isLessonComplete(rec) {
  return !!rec && !!rec.seen && (rec.quizBest || 0) >= PASS_MARK;
}

export function lessonRecord(state, lessonId) {
  return (state.lessons || {})[lessonId] || null;
}

/** نسبة إتمام وحدة (0-100) بحسب عدد دروسها المكتملة. */
export function unitProgress(state, unit) {
  const lessons = unit.lessons || [];
  if (!lessons.length) return { done: 0, total: 0, percent: 0 };
  const done = lessons.filter((l) => isLessonComplete(lessonRecord(state, l.id))).length;
  return { done, total: lessons.length, percent: Math.round((done / lessons.length) * 100) };
}

/** نسبة إتمام البرنامج كاملًا. */
export function overallProgress(state, units) {
  let done = 0, total = 0;
  for (const u of units) {
    const p = unitProgress(state, u);
    done += p.done; total += p.total;
  }
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function taskKey(unitId, taskId) { return `${unitId}/${taskId}`; }

export function tasksDone(state, unitId, tasks) {
  return (tasks || []).filter((t) => (state.tasks || {})[taskKey(unitId, t.id)]).length;
}

/** تحديث سلسلة المواظبة اليومية. */
export function touchStreak(state, now = Date.now()) {
  const day = new Date(now); day.setHours(0, 0, 0, 0);
  const today = day.getTime();
  const s = state.streak || { count: 0, lastDay: null, best: 0 };
  if (s.lastDay === today) return state;
  const yesterday = today - 24 * 60 * 60 * 1000;
  const count = s.lastDay === yesterday ? (s.count || 0) + 1 : 1;
  state.streak = { count, lastDay: today, best: Math.max(s.best || 0, count) };
  return state;
}

/** تسجيل حدث في سجل الإنجاز (يُحتفظ بآخر ٢٠٠ حدث). */
export function logActivity(state, kind, ref, now = Date.now()) {
  state.activity = [{ at: now, kind, ref }, ...(state.activity || [])].slice(0, 200);
  return state;
}

/* -------------------------------------------------------------------------
   الشارات — تحفيز هادئ ومحترم لطبيعة البرنامج، بلا منافسات ولا لوحات ترتيب.
   ------------------------------------------------------------------------- */
export const BADGES = [
  { id: 'first-lesson', icon: '🌱', name: 'أول درس', desc: 'أتممت درسك الأول.' },
  { id: 'unit-done', icon: '📘', name: 'أتممت وحدة', desc: 'أتممت جميع دروس وحدة كاملة.' },
  { id: 'task-done', icon: '🤝', name: 'أنجزت مهمة', desc: 'نفّذت مهمة أدائية من مهام الكتاب.' },
  { id: 'review-keeper', icon: '🔁', name: 'حافظت على المراجعة', desc: 'أتممت مراجعة في ثلاثة أيام.' },
  { id: 'mastery', icon: '🎯', name: 'إتقان تام', desc: 'حصلت على الدرجة الكاملة في اختبار درس.' },
  { id: 'week-steady', icon: '🌙', name: 'مواظبة أسبوع', desc: 'واصلت التعلّم سبعة أيام متتابعة.' },
  { id: 'part-done', icon: '🕌', name: 'أتممت الجزء الأول', desc: 'أتممت جميع وحدات الجزء الأول.' },
];

/**
 * يفحص الشارات المستحقّة ويمنحها. يعيد قائمة الشارات الممنوحة حديثًا.
 */
export function evaluateBadges(state, units, now = Date.now()) {
  const earned = [];
  const give = (id) => {
    if (!state.badges[id]) { state.badges[id] = now; earned.push(id); }
  };
  const completedLessons = Object.values(state.lessons || {}).filter(isLessonComplete).length;
  if (completedLessons >= 1) give('first-lesson');
  if (Object.values(state.lessons || {}).some((r) => (r.quizBest || 0) === 100)) give('mastery');
  if (Object.keys(state.tasks || {}).length >= 1) give('task-done');
  if ((state.stats || {}).reviewDays >= 3) give('review-keeper');
  if ((state.streak || {}).best >= 7) give('week-steady');
  if (units && units.length) {
    if (units.some((u) => unitProgress(state, u).percent === 100)) give('unit-done');
    if (units.every((u) => unitProgress(state, u).percent === 100)) give('part-done');
  }
  return earned;
}

export function badgeById(id) { return BADGES.find((b) => b.id === id); }

/** خطة تعلّم شخصية: الدرس التالي المقترح بحسب تفضيلات المستخدم وتقدّمه. */
export function nextUp(state, units) {
  for (const u of units) {
    for (const l of u.lessons) {
      if (!isLessonComplete(lessonRecord(state, l.id))) {
        return { unitId: u.id, unitTitle: u.shortTitle || u.title, lessonId: l.id, lessonTitle: l.title };
      }
    }
  }
  return null;
}

/** الزمن التقريبي للدرس بحسب نمط العرض المختار. */
export const MODE_MINUTES = { brief: 5, standard: 10, deep: 18 };

export function modeLabel(mode) {
  return { brief: 'مختصر', standard: 'معتدل', deep: 'متعمّق' }[mode] || 'معتدل';
}
