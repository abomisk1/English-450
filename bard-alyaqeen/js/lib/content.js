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
export function cardsForMode(lesson, mode) {
  const rank = { brief: 0, standard: 1, deep: 2 };
  const max = rank[mode] ?? 1;
  return (lesson.cards || []).filter((c) => (rank[c.level] ?? 1) <= max);
}

/** التفاعلات المعروضة في نمط معيّن (النمط المختصر يعرض تفاعلًا واحدًا). */
export function interactionsForMode(lesson, mode) {
  const all = lesson.interactions || [];
  if (mode === 'brief') return all.slice(0, 1);
  if (mode === 'standard') return all.slice(0, 2);
  return all;
}

/** أسئلة الاختبار القصير بحسب النمط. */
export function quizForMode(lesson, mode) {
  const all = lesson.quiz || [];
  if (mode === 'brief') return all.slice(0, Math.min(3, all.length));
  return all;
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
  if (card.src === 'authored') return { text: 'صياغة تعليمية مساعدة', cls: 'chip--warn' };
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
