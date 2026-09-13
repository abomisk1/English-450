/**
 * طبقة التخزين — تحفظ تقدّم المستخدم محليًا بصيغة مُرقَّمة قابلة للترقية،
 * بحيث لا تُفقد البيانات عند تحديث البرنامج.
 *
 * التخزين محلي بالكامل (localStorage). طبقة المزامنة السحابية اختيارية
 * وتُوصَّل عبر `attachSync` دون تغيير بقية البرنامج.
 */

export const STORE_KEY = 'bay.state.v1';
export const STATE_VERSION = 1;

export function defaultState() {
  return {
    version: STATE_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    onboarded: false,
    prefs: {
      largeText: false,
      audio: false,
      highContrast: false,
      theme: 'system',           // system | light | dark
      fontScale: 1,              // مُعامل تكبير الخطّ (٠٫٩–١٫٦)
      reduceMotion: false,
    },
    // تقدّم الدروس: { [lessonId]: { seen, quizBest, quizAttempts, completedAt } }
    lessons: {},
    // المهام الأدائية: { [unitId + '/' + taskId]: { doneAt, note } }
    tasks: {},
    // المراجعة المتباعدة: { [itemKey]: { ease, interval, due, reps, lapses } }
    review: {},
    // المفضلة والعلامات المرجعية: [{ type, id, label, at }]
    bookmarks: [],
    // سجل الإنجاز: [{ at, kind, ref }]
    activity: [],
    badges: {},          // { [badgeId]: earnedAt }
    lastPosition: null,  // { unitId, lessonId, cardIndex }
    streak: { count: 0, lastDay: null, best: 0 },
    stats: { lessonsCompleted: 0, quizPassed: 0, tasksDone: 0, reviewsDone: 0 },
  };
}

/** ترقية الحالة المخزّنة إلى الإصدار الحالي دون فقد بيانات. */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return defaultState();
  let s = raw;
  // كل ترقية مستقبلية تُضاف هنا بالترتيب.
  if (typeof s.version !== 'number') s = { ...defaultState(), ...s, version: 1 };
  // دمج المفاتيح الناقصة (يحدث عند إضافة ميزات جديدة).
  const base = defaultState();
  const merged = { ...base, ...s };
  merged.prefs = { ...base.prefs, ...(s.prefs || {}) };
  // تفضيلات أُلغيت: أنماط العرض الثلاثة و«الوضع الأسري» كإعداد عام.
  // (المسارات الآن: تعلّم الدرس / مراجعة سريعة، والنشاط الأسري يظهر في الدروس التي فيه.)
  for (const k of ['detail', 'sessionLength', 'familyMode']) delete merged.prefs[k];
  merged.streak = { ...base.streak, ...(s.streak || {}) };
  merged.stats = { ...base.stats, ...(s.stats || {}) };
  merged.lessons = s.lessons || {};
  merged.tasks = s.tasks || {};
  merged.review = s.review || {};
  merged.badges = s.badges || {};
  merged.bookmarks = Array.isArray(s.bookmarks) ? s.bookmarks : [];
  merged.activity = Array.isArray(s.activity) ? s.activity : [];
  merged.version = STATE_VERSION;
  return merged;
}

function safeLocal() {
  try {
    const t = '__bay_probe__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch (_) {
    return null;
  }
}

/** مخزن ذاكرة احتياطي حين يمنع المتصفح التخزين (تصفح خاص مثلًا). */
function memoryStore() {
  let v = null;
  return { getItem: () => v, setItem: (_k, val) => { v = val; }, removeItem: () => { v = null; } };
}

export function createStorage(backend) {
  const store = backend || safeLocal() || memoryStore();
  return {
    load() {
      try {
        const raw = store.getItem(STORE_KEY);
        if (!raw) return defaultState();
        return migrate(JSON.parse(raw));
      } catch (_) {
        return defaultState();
      }
    },
    save(state) {
      try {
        state.updatedAt = Date.now();
        store.setItem(STORE_KEY, JSON.stringify(state));
        return true;
      } catch (_) {
        return false;
      }
    },
    clear() {
      try { store.removeItem(STORE_KEY); return true; } catch (_) { return false; }
    },
  };
}

/** تصدير التقدّم كنصّ يمكن للمستخدم حفظه أو نقله إلى جهاز آخر. */
export function exportState(state) {
  return JSON.stringify({ app: 'bard-al-yaqeen', version: STATE_VERSION, state }, null, 1);
}

/** استيراد تقدّم مُصدَّر. يرمي خطأ إن كان الملف غير صالح. */
export function importState(text) {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.app !== 'bard-al-yaqeen' || !parsed.state) {
    throw new Error('ملف غير صالح');
  }
  return migrate(parsed.state);
}

/** دمج حالتين (للمزامنة لاحقًا): الأحدث لكل عنصر يفوز. */
export function mergeStates(a, b) {
  const [older, newer] = (a.updatedAt || 0) <= (b.updatedAt || 0) ? [a, b] : [b, a];
  const out = migrate({ ...older, ...newer });
  out.lessons = { ...older.lessons, ...newer.lessons };
  for (const k of Object.keys(older.lessons || {})) {
    const o = older.lessons[k], n = (newer.lessons || {})[k];
    if (o && n) {
      out.lessons[k] = {
        ...o, ...n,
        quizBest: Math.max(o.quizBest || 0, n.quizBest || 0),
        quizAttempts: (o.quizAttempts || 0) + (n.quizAttempts || 0),
        completedAt: o.completedAt && n.completedAt ? Math.min(o.completedAt, n.completedAt)
          : (o.completedAt || n.completedAt || null),
      };
    }
  }
  out.tasks = { ...older.tasks, ...newer.tasks };
  out.review = { ...older.review, ...newer.review };
  out.badges = { ...older.badges, ...newer.badges };
  const seen = new Set();
  out.bookmarks = [...(newer.bookmarks || []), ...(older.bookmarks || [])]
    .filter((b) => { const k = b.type + b.id; if (seen.has(k)) return false; seen.add(k); return true; });
  out.updatedAt = Date.now();
  return out;
}
