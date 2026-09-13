/**
 * تحميل المحتوى العلمي من ملفات JSON المنفصلة عن الشفرة.
 * يسمح بمراجعة المحتوى وتحديثه وإضافة الأجزاء المستقبلية دون تغيير النظام.
 */

const BASE = new URL('../../content/', import.meta.url);

const cache = { manifest: null, units: new Map() };

async function getJSON(path) {
  const res = await fetch(new URL(path, BASE), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`تعذّر تحميل المحتوى: ${path}`);
  return res.json();
}

export async function loadManifest() {
  if (!cache.manifest) cache.manifest = await getJSON('manifest.json');
  return cache.manifest;
}

export async function loadUnit(unitId) {
  if (cache.units.has(unitId)) return cache.units.get(unitId);
  const m = await loadManifest();
  const entry = (m.units || []).find((u) => u.id === unitId);
  if (!entry) throw new Error(`وحدة غير معروفة: ${unitId}`);
  const data = await getJSON(entry.file);
  cache.units.set(unitId, data);
  return data;
}

export async function loadAllUnits() {
  const m = await loadManifest();
  return Promise.all((m.units || []).map((u) => loadUnit(u.id)));
}

export async function loadNeedsReview() {
  return getJSON('needs-review.json');
}

export function findLesson(unit, lessonId) {
  return (unit.lessons || []).find((l) => l.id === lessonId) || null;
}

/** بطاقات الدرس المعروضة في نمط معيّن. */
/**
 * مساران للدرس — لا «أنماط عرض» ولا وعود زمنية ثابتة:
 *   learn  «تعلّم الدرس»   : المادة كاملة كما في الكتاب (المسار الافتراضي للدراسة الأولى).
 *   review «مراجعة سريعة» : تثبيت لما دُرِس — خلاصة وبطاقات تذكّر وأسئلة أساسية.
 * المحتوى الشرعي لا يختلف بين المسارين؛ المراجعة لا تُنقص نصًّا ولا تُضيف حكمًا،
 * وإنما تُعيد عرض ما دُرِس، ونصوص الكتاب تبقى متاحة فيها بالإظهار التدريجي.
 */
export const PATHS = ['learn', 'review'];

export function pathLabel(path) {
  return path === 'review' ? 'مراجعة سريعة' : 'تعلّم الدرس';
}

/** هل مسار المراجعة متاح؟ لا يُقدَّم بديلًا عن الدراسة الأولى، بل بعدها. */
export function reviewUnlocked(lessonRecord) {
  return !!(lessonRecord && lessonRecord.completedAt);
}

/** بطاقات المحتوى المعروضة في المسار. */
export function cardsForPath(lesson, path) {
  const all = lesson.cards || [];
  if (path !== 'review') return all;
  // في المراجعة: نصوص الكتاب المنقولة حرفيًّا فقط، وتُعرض بالإظهار التدريجي.
  return all.filter((c) => ['quran', 'hadith', 'dhikr'].includes(c.type));
}

/** التفاعلات المعروضة في المسار. */
export function interactionsForPath(lesson, path) {
  const all = lesson.interactions || [];
  if (path !== 'review') return all;
  return all.filter((q) => q.kind === 'flashcards');
}

/** أسئلة الاختبار — واحدة في المسارين؛ لا يُنقص التقييم في المراجعة. */
export function quizForPath(lesson) {
  return lesson.quiz || [];
}

/* ------------------------- الزمن التقريبي للدرس ------------------------- */

const WORDS_PER_MINUTE = 120;   // قراءة متأنّية لنصّ شرعي
const SECONDS_PER_ITEM = 30;    // تفاعل أو سؤال، بالتغذية الراجعة

function words(t) {
  return t ? String(t).trim().split(/\s+/).filter(Boolean).length : 0;
}

function cardWords(c) {
  return words(c.title) + words(c.text) + words(c.note)
    + (c.items || []).reduce((n, i) => n + words(i.term) + words(i.def), 0);
}

function itemWords(q) {
  return words(q.prompt) + words(q.why) + words(q.before) + words(q.after)
    + (q.options || []).reduce((n, o) => n + words(o), 0)
    + (q.items || []).reduce((n, o) => n + words(o), 0)
    + (q.pairs || []).reduce((n, pr) => n + words(pr[0]) + words(pr[1]), 0)
    + (q.groups || []).reduce(
      (n, g) => n + words(g.label) + g.items.reduce((m, o) => m + words(o), 0), 0);
}

/**
 * زمن تقريبي محسوب من محتوى الدرس نفسه — لا رقم ثابت على كل الدروس.
 * يُقرَّب إلى أقرب دقيقة، وأدناه دقيقة واحدة.
 */
export function estimatedMinutes(lesson, path = 'learn') {
  const cards = cardsForPath(lesson, path);
  const inter = interactionsForPath(lesson, path);
  const quiz = quizForPath(lesson);
  let w = cards.reduce((n, c) => n + cardWords(c), 0)
    + inter.reduce((n, q) => n + itemWords(q), 0)
    + quiz.reduce((n, q) => n + itemWords(q), 0);
  if (path !== 'review') {
    w += words(lesson.hook && lesson.hook.text) + words(lesson.objective && lesson.objective.text);
  }
  w += ((lesson.summary && lesson.summary.points) || []).reduce((n, t) => n + words(t), 0);
  const mins = w / WORDS_PER_MINUTE + ((inter.length + quiz.length) * SECONDS_PER_ITEM) / 60;
  return Math.max(1, Math.round(mins));
}

/** هل نصّ هذه البطاقة منقول حرفيًّا من الكتاب أو من القرآن؟ */
export function isSourceText(card) {
  return ['quran', 'hadith', 'dhikr'].includes(card.type)
    || (card.src === 'book' && card.type !== 'note');
}

/** تصنيف البطاقة لعرض لصيقة واضحة تفرق بين الأصل والشرح والصياغة المساعدة. */
export function cardKindLabel(card) {
  if (card.type === 'quran') return { text: 'نصّ قرآني', cls: 'chip--brand' };
  if (card.type === 'hadith') return { text: 'حديث نبوي', cls: 'chip--brand' };
  if (card.type === 'dhikr') return { text: 'ذكر / دعاء', cls: 'chip--brand' };
  if (card.src === 'book') return { text: 'من الكتاب', cls: '' };
  // لصيقة إفصاح عن المصدر: لا تُعرض للمتعلّم في الوضع الطبيعي، بل في
  // «وضع مراجعة المحتوى» ولوحة الإدارة. (prov = provenance)
  if (card.src === 'authored') return { text: 'صياغة تعليمية مساعدة', cls: 'chip--warn', prov: true };
  return { text: 'من الكتاب', cls: '' };
}

/* ------------------------------- البحث ------------------------------- */

/** تطبيع عربي للبحث: إزالة التشكيل وتوحيد الألف والياء والتاء المربوطة. */
export function normalizeAr(s) {
  return String(s || '')
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[‏‎]/g, '')
    .toLowerCase()
    .trim();
}

function cardText(c) {
  if (c.items) return c.items.map((i) => `${i.term} ${i.def}`).join(' ');
  return c.text || '';
}

/** بناء فهرس بحث بسيط من الوحدات المحمّلة. */
export function buildSearchIndex(units) {
  const idx = [];
  for (const u of units) {
    for (const l of u.lessons || []) {
      idx.push({
        unitId: u.id, unitTitle: u.shortTitle || u.title,
        lessonId: l.id, lessonTitle: l.title,
        kind: 'lesson', label: l.title, pages: l.source.pages,
        hay: normalizeAr(`${l.title} ${(l.tags || []).join(' ')}`),
      });
      for (const c of l.cards || []) {
        idx.push({
          unitId: u.id, unitTitle: u.shortTitle || u.title,
          lessonId: l.id, lessonTitle: l.title,
          kind: c.type, label: c.title || l.title, snippet: cardText(c).slice(0, 220),
          page: c.page, hay: normalizeAr(cardText(c) + ' ' + (c.title || '')),
        });
      }
    }
    for (const t of u.tasks || []) {
      idx.push({
        unitId: u.id, unitTitle: u.shortTitle || u.title, kind: 'task',
        label: 'مهمة أدائية', snippet: t.text, page: t.page, hay: normalizeAr(t.text),
      });
    }
    for (const a of u.assessment || []) {
      idx.push({
        unitId: u.id, unitTitle: u.shortTitle || u.title, kind: 'assessment',
        label: 'سؤال تحصيلي', snippet: a.q, page: a.page, hay: normalizeAr(a.q),
      });
    }
  }
  return idx;
}

export function search(index, query, limit = 40) {
  const q = normalizeAr(query);
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter(Boolean);
  return index
    .map((row) => {
      let s = 0;
      for (const w of words) {
        const i = row.hay.indexOf(w);
        if (i === -1) return null;
        s += i === 0 ? 3 : 1;
      }
      if (row.kind === 'lesson') s += 2;
      return { row, s };
    })
    .filter(Boolean)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.row);
}
