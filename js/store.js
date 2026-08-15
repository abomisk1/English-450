// مخزن الحالة — نمط observable بسيط (بلا مكتبات).
// يحمّل التقدم من localStorage، ويحفظه تلقائيًا عند كل تغيير، ويُخطر المشتركين.

import { WORD_IDS, PHRASE_IDS } from './data/index.js';
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
  todayKey,
  daysBetween,
} from './lib/storage.js';

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
  const masteryPercent =
    totalItems === 0
      ? 0
      : Math.round(((learnedTotal * 0.5 + masteredTotal * 0.5) / totalItems) * 100);

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
  };
}
