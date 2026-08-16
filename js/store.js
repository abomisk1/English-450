// مخزن الحالة — نمط observable بسيط (بلا مكتبات).
// يحمّل التقدم من localStorage، ويحفظه تلقائيًا عند كل تغيير، ويُخطر المشتركين.

import { WORD_IDS, PHRASE_IDS, ITEMS_BY_LEVEL, LEVEL_COUNT } from './data/index.js';
import {
  createProgress,
  review,
  isMastered,
  isLearned,
  isDue,
} from './lib/srs.js';
import {
  loadProgress,
  saveProgress,
  emptyProgress,
  emptyQuizRecord,
  todayKey,
  daysBetween,
} from './lib/storage.js';
import { isLevelPass, isFinalPass } from './lib/quiz.js';

const POINTS_CORRECT = 10;

let state = loadProgress();
const listeners = new Set();

function emit() {
  saveProgress(state);
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

// —— أفعال (Actions) ——

// تسجيل رؤية عنصر جديد لأول مرة (new → learning).
export function learnItem(id, kind) {
  const existing = state.items[id];
  if (existing && existing.status !== 'new') return;
  const p = existing ?? createProgress(id, kind);
  state = {
    ...state,
    items: { ...state.items, [id]: { ...p, status: p.status === 'new' ? 'learning' : p.status } },
  };
  emit();
}

// عدد العناصر المُتقَنة (mastered) ضمن حالة معيّنة.
function masteredCount(s) {
  let n = 0;
  for (const p of Object.values(s.items)) if (isMastered(p)) n++;
  return n;
}

const TOTAL_ITEMS = WORD_IDS.size + PHRASE_IDS.size;

// تسجيل إجابة على عنصر.
export function answerItem(id, kind, correct) {
  const prev = state.items[id] ?? createProgress(id, kind);
  const next = review(prev, correct);
  let nextState = {
    ...state,
    items: { ...state.items, [id]: next },
    points: state.points + (correct ? POINTS_CORRECT : 0),
  };

  // احتساب إكمال البرنامج مرّة واحدة فقط لكل دورة عند إتقان جميع العناصر (450/450).
  if (!nextState.currentCycleCompleted && masteredCount(nextState) >= TOTAL_ITEMS && TOTAL_ITEMS > 0) {
    nextState = {
      ...nextState,
      completions: (nextState.completions || 0) + 1,
      lastCompletedAt: todayKey(),
      currentCycleCompleted: true,
    };
  }

  state = nextState;
  emit();
}

// إنهاء الجلسة: تحديث السلسلة والجلسات والإنجازات.
export function completeSession(earned) {
  const today = todayKey();
  let streak = state.streak;
  if (state.lastSessionDate === null) {
    streak = 1;
  } else {
    const diff = daysBetween(state.lastSessionDate, today);
    if (diff === 0) streak = Math.max(streak, 1);
    else if (diff === 1) streak = streak + 1;
    else streak = 1;
  }

  const achievements = new Set(state.achievements);
  const sessionsCompleted = state.sessionsCompleted + 1;
  achievements.add('first-session');
  if (streak >= 3) achievements.add('streak-3');
  if (streak >= 7) achievements.add('streak-7');

  state = {
    ...state,
    points: state.points + earned,
    streak,
    lastSessionDate: today,
    sessionsCompleted,
    achievements: [...achievements],
  };
  emit();
}

// تحديد المستوى الذي يدرسه المستخدم حاليًا (تُسحب منه العناصر الجديدة في الجلسة).
export function setActiveLevel(level) {
  const L = Math.min(LEVEL_COUNT, Math.max(1, level | 0));
  if (state.activeLevel === L) return;
  state = { ...state, activeLevel: L };
  emit();
}

export function resetAll() {
  state = emptyProgress();
  emit();
}

// إعادة البرنامج من البداية: تُصفّر حالة تعلّم العناصر وتبدأ دورة جديدة،
// مع الاحتفاظ بالنقاط التراكمية وعدد مرات الإكمال وتاريخ آخر إكمال (وسجلّ الاستخدام).
export function restartProgram() {
  state = {
    ...state,
    items: {},
    currentCycleCompleted: false,
    activeLevel: 1, // تبدأ الدورة الجديدة من المستوى الأول
    // يُحتفَظ بها عمدًا: points, completions, lastCompletedAt, streak,
    // sessionsCompleted, achievements.
  };
  emit();
}

// —— إحصاءات مشتقّة ——

export function computeStats(s = state) {
  const now = Date.now();
  let wordsLearned = 0;
  let phrasesLearned = 0;
  let wordsMastered = 0;
  let phrasesMastered = 0;
  let dueCount = 0;

  for (const p of Object.values(s.items)) {
    const isWord = WORD_IDS.has(p.id);
    const isPhrase = PHRASE_IDS.has(p.id);
    if (isLearned(p)) {
      if (isWord) wordsLearned++;
      if (isPhrase) phrasesLearned++;
    }
    if (isMastered(p)) {
      if (isWord) wordsMastered++;
      if (isPhrase) phrasesMastered++;
    }
    if (p.status !== 'new' && p.status !== 'mastered' && isDue(p, now)) dueCount++;
  }

  const totalItems = WORD_IDS.size + PHRASE_IDS.size;
  const learnedTotal = wordsLearned + phrasesLearned;
  const masteredTotal = wordsMastered + phrasesMastered;
  // نسبة الإنجاز = عدد العناصر التي خرجت من حالة «جديد» (status ≠ new) ÷ الإجمالي × 100.
  // يُحتسب كل عنصر مرّة واحدة فقط (state.items لا يكرّر العنصر)، فلا تزيده إعادة الجلسات
  // ولا مراجعة الأخطاء ولا الانتقال بين حالات التعلّم. الإتقان مفهوم منفصل (programComplete).
  const masteryPercent =
    totalItems === 0 ? 0 : Math.round((learnedTotal / totalItems) * 100);

  return {
    wordsLearned,
    phrasesLearned,
    wordsMastered,
    phrasesMastered,
    dueCount,
    masteryPercent,
    totalItems,
    learnedTotal,
    masteredTotal,
    // البرنامج مكتمل فقط عند إتقان جميع العناصر فعليًا (mastered 450/450).
    programComplete: totalItems > 0 && masteredTotal >= totalItems,
    levelsCompleted: countLevelsCompleted(s),
  };
}

// —— إحصاءات المستويات ——

// إحصاء مستوى واحد: عدد العناصر، المُتقَن، المُكتسَب، النسبة، والاكتمال (✅).
export function levelStats(level, s = state) {
  const items = ITEMS_BY_LEVEL[level] || [];
  let mastered = 0;
  let learned = 0;
  for (const it of items) {
    const p = s.items[it.id];
    if (!p) continue;
    if (isLearned(p)) learned++;
    if (isMastered(p)) mastered++;
  }
  const total = items.length;
  const percent = total === 0 ? 0 : Math.round((mastered / total) * 100);
  return {
    level,
    total,
    words: items.filter((x) => x.kind === 'word').length,
    phrases: items.filter((x) => x.kind === 'phrase').length,
    mastered,
    learned,
    percent,
    complete: total > 0 && mastered >= total,
  };
}

export function levelsSummary(s = state) {
  const out = [];
  for (let L = 1; L <= LEVEL_COUNT; L++) out.push(levelStats(L, s));
  return out;
}

function countLevelsCompleted(s) {
  let n = 0;
  for (let L = 1; L <= LEVEL_COUNT; L++) if (levelStats(L, s).complete) n++;
  return n;
}

// —— حالة الاختبارات (مستقلّة تمامًا عن نسبة الإنجاز/SRS/النقاط) ——

// هل أنهى المستخدم *محتوى* المستوى؟ = رأى/تعلّم جميع عناصره (status ≠ 'new').
// ملاحظة: هذا يختلف عن «اجتياز المستوى» الذي يتطلّب أيضًا النجاح في اختبار المستوى،
// ويختلف عن «الإتقان» (levelStats.complete) الذي يتطلّب mastery لكل العناصر.
export function levelContentFinished(level, s = state) {
  const items = ITEMS_BY_LEVEL[level] || [];
  if (items.length === 0) return false;
  for (const it of items) {
    const p = s.items[it.id];
    if (!p || !isLearned(p)) return false;
  }
  return true;
}

function mkResult(score, total) {
  return { score, total, pct: total === 0 ? 0 : Math.round((score / total) * 100) };
}

// دمج نتيجة جديدة في سجلّ اختبار: يحفظ آخر نتيجة دائمًا، وأفضل نتيجة (لا تُخفَّض)،
// وحالة النجاح لاصقة (تبقى ناجحة)، ويحفظ أخطاء آخر محاولة للمراجعة.
function mergeQuizRecord(prev, score, total, errors, passFn) {
  const last = mkResult(score, total);
  const best = !prev.best || score > prev.best.score ? last : prev.best;
  return {
    taken: true,
    passed: Boolean(prev.passed) || passFn(score),
    attempts: (prev.attempts || 0) + 1,
    last,
    best,
    errors: Array.isArray(errors) ? errors : [],
  };
}

// تسجيل نتيجة اختبار مستوى — لا يمسّ items ولا points ولا نسبة الإنجاز.
export function recordLevelQuizResult(level, { score, total, errors = [] }) {
  const L = Math.min(LEVEL_COUNT, Math.max(1, level | 0));
  const quizzes = state.quizzes || { levels: {}, final: emptyQuizRecord() };
  const prev = quizzes.levels[L] || emptyQuizRecord();
  const rec = mergeQuizRecord(prev, score, total, errors, isLevelPass);
  state = {
    ...state,
    quizzes: { ...quizzes, levels: { ...quizzes.levels, [L]: rec } },
  };
  emit();
  return rec;
}

// تسجيل نتيجة الاختبار النهائي — لا يمسّ items ولا points ولا نسبة الإنجاز.
export function recordFinalQuizResult({ score, total, errors = [] }) {
  const quizzes = state.quizzes || { levels: {}, final: emptyQuizRecord() };
  const prev = quizzes.final || emptyQuizRecord();
  const rec = mergeQuizRecord(prev, score, total, errors, isFinalPass);
  state = { ...state, quizzes: { ...quizzes, final: rec } };
  emit();
  return rec;
}

// حالة اختبار مستوى واحد للعرض.
export function levelQuizState(level, s = state) {
  const rec = (s.quizzes && s.quizzes.levels && s.quizzes.levels[level]) || emptyQuizRecord();
  const contentFinished = levelContentFinished(level, s);
  return {
    level,
    contentFinished,
    available: contentFinished, // الاختبار متاح فقط بعد إنهاء المحتوى
    taken: Boolean(rec.taken),
    passed: Boolean(rec.passed),
    attempts: rec.attempts || 0,
    last: rec.last || null,
    best: rec.best || null,
    errors: rec.errors || [],
  };
}

// هل استوفى المستخدم شروط فتح الاختبار النهائي؟
// = إنهاء محتوى المستويات الستة + اجتياز اختبار كل مستوى منها.
export function isFinalUnlocked(s = state) {
  for (let L = 1; L <= LEVEL_COUNT; L++) {
    const rec = s.quizzes && s.quizzes.levels && s.quizzes.levels[L];
    if (!rec || !rec.passed) return false;
    if (!levelContentFinished(L, s)) return false;
  }
  return true;
}

// حالة الاختبار النهائي للعرض.
export function finalQuizState(s = state) {
  const rec = (s.quizzes && s.quizzes.final) || emptyQuizRecord();
  return {
    unlocked: isFinalUnlocked(s),
    taken: Boolean(rec.taken),
    passed: Boolean(rec.passed),
    attempts: rec.attempts || 0,
    last: rec.last || null,
    best: rec.best || null,
    errors: rec.errors || [],
  };
}
