// طبقة التخزين — اليوم localStorage.
// مجرّدة عمدًا لتسهيل الترقية لاحقًا إلى IndexedDB أو مزامنة سحابية دون تغيير الواجهة.
//
// UserProgress:
// { items: { [id]: ItemProgress }, points, streak, lastSessionDate,
//   sessionsCompleted, achievements: string[] }

const STORAGE_KEY = 'english450:progress:v1';

export function emptyProgress() {
  return {
    items: {},
    points: 0,
    streak: 0,
    lastSessionDate: null,
    sessionsCompleted: 0,
    achievements: [],
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    return { ...emptyProgress(), ...parsed, items: parsed.items ?? {} };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // التخزين ممتلئ أو محظور — نتجاهل بهدوء في النسخة الأولى.
  }
}

export function resetProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* تجاهل */
  }
}

// تاريخ اليوم بصيغة YYYY-MM-DD بالتوقيت المحلي.
export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// الفرق بالأيام بين مفتاحي تاريخ.
export function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / (24 * 60 * 60 * 1000));
}
