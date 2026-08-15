// محرك المراجعة المتباعدة (Spaced Repetition) — نسخة مبسّطة (Leitner / SM-2 lite).
// واضحة الآن وقابلة للتحسين لاحقًا دون لمس الواجهة.
//
// حالة العنصر (ItemProgress):
// { id, kind, status: 'new'|'learning'|'review'|'mastered',
//   reps, lapses, correctStreak, ease, intervalDays, dueAt, seenAt, masteredAt? }

const DAY = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;
const MAX_EASE = 2.6;
const MASTERY_REPS = 4; // عدد النجاحات المطلوبة للإتقان
const MASTERY_INTERVAL = 16; // أو فترة تتجاوز هذا (بالأيام)

// فترات المراجعة التقريبية بالأيام حسب عدد النجاحات.
const INTERVAL_STEPS = [0, 1, 3, 7, 16, 35, 70];

export function createProgress(id, kind, now = Date.now()) {
  return {
    id,
    kind,
    status: 'new',
    reps: 0,
    lapses: 0,
    correctStreak: 0,
    ease: 2.0,
    intervalDays: 0,
    dueAt: now,
    seenAt: now,
    masteredAt: undefined,
  };
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function statusFor(p) {
  if (p.reps >= MASTERY_REPS && p.intervalDays >= MASTERY_INTERVAL) return 'mastered';
  if (p.reps >= 1) return 'review';
  return 'learning';
}

// تحديث حالة العنصر بعد إجابة.
export function review(prev, correct, now = Date.now()) {
  const p = { ...prev };

  if (correct) {
    p.reps += 1;
    p.correctStreak += 1;
    p.ease = clamp(p.ease + 0.05, MIN_EASE, MAX_EASE);
    const step = INTERVAL_STEPS[Math.min(p.reps, INTERVAL_STEPS.length - 1)];
    // خطوات مبكرة ثابتة، ثم تطبيق معامل السهولة.
    p.intervalDays = p.reps <= 2 ? step : Math.round(step * (p.ease / 2.0));
    p.dueAt = now + Math.max(p.intervalDays, 0) * DAY;
  } else {
    p.lapses += 1;
    p.correctStreak = 0;
    p.reps = Math.max(0, Math.floor(p.reps / 2)); // تراجع جزئي وليس تصفيرًا كاملًا
    p.ease = clamp(p.ease - 0.2, MIN_EASE, MAX_EASE);
    p.intervalDays = 0;
    p.dueAt = now + 10 * 60 * 1000; // مراجعة قريبة (~10 دقائق)
  }

  p.status = statusFor(p);
  if (p.status === 'mastered' && !p.masteredAt) p.masteredAt = now;
  if (p.status !== 'mastered') p.masteredAt = undefined;
  return p;
}

export function isDue(p, now = Date.now()) {
  return p.dueAt <= now;
}

// هل تعلّم المستخدم هذا العنصر (تجاوز مرحلة "جديد")؟
export function isLearned(p) {
  return p.status !== 'new';
}

export function isMastered(p) {
  return p.status === 'mastered';
}
