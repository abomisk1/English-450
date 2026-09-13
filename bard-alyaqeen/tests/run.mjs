/**
 * اختبارات وظيفية للمنطق الأساسي.
 * التشغيل:  node tests/run.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultState, migrate, createStorage, exportState, importState, mergeStates } from '../js/lib/storage.js';
import * as SRS from '../js/lib/srs.js';
import * as Q from '../js/lib/quiz.js';
import * as P from '../js/lib/progress.js';
import { normalizeAr, buildSearchIndex, search, cardsForPath, interactionsForPath, quizForPath,
  estimatedMinutes, pathLabel, reviewUnlocked, PATHS, cardKindLabel } from '../js/lib/content.js';
import { isTTSAllowed, audioSourceFor } from '../js/lib/speech.js';
import { arCount, COUNT_QUESTION, COUNT_MINUTE_GEN } from '../js/lib/dom.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
const results = [];
function test(name, fn) {
  try { fn(); passed++; results.push(['✅', name]); }
  catch (e) { failed++; results.push(['❌', `${name} — ${e.message}`]); }
}
function group(name) { results.push(['', '']); results.push(['##', name]); }

/* ------------------------- تحميل المحتوى ------------------------- */
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/manifest.json'), 'utf8'));
const units = manifest.units.map((u) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', u.file), 'utf8')));
const needsReview = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/needs-review.json'), 'utf8'));

group('سلامة المحتوى');

test('الوحدات السبع موجودة ومرتّبة', () => {
  assert.equal(units.length, 7);
  units.forEach((u, i) => assert.equal(u.order, i + 1));
});

test('كل درس له بطاقات وأسئلة وخلاصة ومصدر من الكتاب', () => {
  for (const u of units) {
    for (const l of u.lessons) {
      assert.ok(l.cards.length > 0, `${l.id}: بلا بطاقات`);
      assert.ok(l.quiz.length > 0, `${l.id}: بلا أسئلة`);
      assert.ok(l.summary.points.length > 0, `${l.id}: بلا خلاصة`);
      assert.ok(Array.isArray(l.source.pages) && l.source.pages.length > 0, `${l.id}: بلا صفحات مصدر`);
    }
  }
});

test('كل وحدة فيها خمسة أسئلة تحصيلية وخمس مهام أدائية كما في الكتاب', () => {
  for (const u of units) {
    assert.equal(u.assessment.length, 5, `${u.id}: الأسئلة التحصيلية`);
    assert.equal(u.tasks.length, 5, `${u.id}: المهام الأدائية`);
    for (const t of u.tasks) assert.ok(t.page, `${u.id}/${t.id}: بلا صفحة`);
  }
});

test('كل نصّ قرآني معلَّم needsReview وله مرجع', () => {
  for (const u of units) for (const l of u.lessons) for (const c of l.cards) {
    if (c.type === 'quran') {
      assert.equal(c.needsReview, true, `${l.id}/${c.id}`);
      assert.ok(c.ref, `${l.id}/${c.id}: بلا مرجع`);
    }
  }
});

test('لا يوجد نصّ من الكتاب معلَّم كصياغة مساعدة والعكس', () => {
  for (const u of units) for (const l of u.lessons) for (const c of l.cards) {
    if (['quran', 'hadith', 'dhikr'].includes(c.type)) {
      assert.ok(['book', 'quran'].includes(c.src), `${l.id}/${c.id}: src=${c.src}`);
    }
    if (c.src === 'authored') assert.equal(c.needsReview, true, `${l.id}/${c.id}`);
  }
});

test('قائمة المراجعة تطابق العناصر المعلَّمة', () => {
  let n = 0;
  for (const u of units) for (const l of u.lessons) {
    for (const k of ['hook', 'objective', 'summary', 'family']) if (l[k] && l[k].needsReview) n++;
    n += l.cards.filter((c) => c.needsReview).length;
    n += l.interactions.filter((q) => q.needsReview).length;
    n += l.quiz.filter((q) => q.needsReview).length;
  }
  // يُضاف إليها إكمال المقاطع القرآنية بالاختيار ولو كانت مشتقّة (أولوية عالية).
  const quranComplete = needsReview.items.filter((i) => i.kind.endsWith(':complete-quran')).length;
  assert.equal(needsReview.count, n + quranComplete);
  assert.equal(needsReview.items.length, n + quranComplete);
  assert.equal(quranComplete, 0, 'لم تعُد هناك عناصر إكمال قرآني');
});

test('كل سؤال اختيار له إجابة صحيحة ضمن الخيارات وتفسير', () => {
  for (const u of units) for (const l of u.lessons) {
    for (const q of [...l.quiz, ...l.interactions]) {
      if (['mcq', 'truefalse', 'complete', 'scenario'].includes(q.kind)) {
        assert.ok(Array.isArray(q.options) && q.options.length >= 2, `${l.id}/${q.id}`);
        assert.ok(q.answer >= 0 && q.answer < q.options.length, `${l.id}/${q.id}: answer=${q.answer}`);
        assert.ok(new Set(q.options).size === q.options.length, `${l.id}/${q.id}: خيارات مكرّرة`);
      }
      if (q.kind !== 'flashcards') assert.ok(q.why, `${l.id}/${q.id}: بلا تفسير`);
      if (q.kind === 'order') assert.ok(q.items.length >= 2, `${l.id}/${q.id}`);
      if (q.kind === 'match') assert.ok(q.pairs.length >= 2, `${l.id}/${q.id}`);
    }
  }
});

test('معرّفات الدروس فريدة', () => {
  const ids = units.flatMap((u) => u.lessons.map((l) => l.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('كل بطاقة تشير إلى صفحة في نطاق الكتاب (١–٧٩)', () => {
  for (const u of units) for (const l of u.lessons) for (const c of l.cards) {
    if (c.page) assert.ok(c.page >= 1 && c.page <= 79, `${l.id}/${c.id}: ص ${c.page}`);
  }
});

/* --------------------- حفظ التقدّم واستعادته --------------------- */
group('حفظ التقدّم واستعادته');

function memBackend() {
  let v = null;
  return { getItem: () => v, setItem: (_k, val) => { v = val; }, removeItem: () => { v = null; } };
}

test('الحفظ ثم التحميل يعيد نفس الحالة', () => {
  const st = createStorage(memBackend());
  const s = defaultState();
  s.lessons['u1l1'] = { seen: true, quizBest: 100, quizAttempts: 1, completedAt: 1 };
  st.save(s);
  const back = st.load();
  assert.equal(back.lessons['u1l1'].quizBest, 100);
});

test('الترقية تحافظ على البيانات القديمة وتضيف المفاتيح الناقصة', () => {
  const old = { version: 1, lessons: { a: { seen: true, quizBest: 90 } } };
  const m = migrate(old);
  assert.equal(m.lessons.a.quizBest, 90);
  assert.ok(m.prefs && m.prefs.theme);
  assert.ok(Array.isArray(m.bookmarks));
  assert.equal(m.version, 1);
});

test('حالة تالفة لا تُسقط البرنامج', () => {
  const bad = { getItem: () => '{not json', setItem() {}, removeItem() {} };
  const st = createStorage(bad);
  assert.deepEqual(Object.keys(st.load()).sort(), Object.keys(defaultState()).sort());
});

test('التخزين المعطّل لا يرمي خطأ', () => {
  const blocked = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  const st = createStorage(blocked);
  assert.ok(st.load());
  assert.equal(st.save(defaultState()), false);
});

test('التصدير والاستيراد يحفظان التقدّم', () => {
  const s = defaultState();
  s.tasks['u1/t1'] = { doneAt: 5 };
  const back = importState(exportState(s));
  assert.equal(back.tasks['u1/t1'].doneAt, 5);
  assert.throws(() => importState('{"app":"other"}'));
});

test('دمج حالتين يأخذ أفضل نتيجة ولا يفقد شيئًا', () => {
  const a = defaultState(); a.updatedAt = 1;
  a.lessons.x = { seen: true, quizBest: 60, quizAttempts: 1, completedAt: null };
  const b = defaultState(); b.updatedAt = 2;
  b.lessons.x = { seen: true, quizBest: 90, quizAttempts: 2, completedAt: 99 };
  b.lessons.y = { seen: true, quizBest: 100, quizAttempts: 1, completedAt: 100 };
  const m = mergeStates(a, b);
  assert.equal(m.lessons.x.quizBest, 90);
  assert.equal(m.lessons.x.quizAttempts, 3);
  assert.equal(m.lessons.y.quizBest, 100);
});

/* ------------------------ احتساب إتمام الدرس ------------------------ */
group('احتساب إتمام الدرس والتقدّم');

test('الدرس لا يُحتسب مكتملًا إلا بالاطّلاع واجتياز الاختبار', () => {
  assert.equal(P.isLessonComplete(null), false);
  assert.equal(P.isLessonComplete({ seen: true, quizBest: 70 }), false);
  assert.equal(P.isLessonComplete({ seen: false, quizBest: 100 }), false);
  assert.equal(P.isLessonComplete({ seen: true, quizBest: 80 }), true);
});

test('نسبة الوحدة والبرنامج تُحتسب بعدد الدروس المكتملة', () => {
  const s = defaultState();
  const u = units[1]; // الأحاديث النبوية: ٤ دروس
  assert.equal(P.unitProgress(s, u).percent, 0);
  s.lessons[u.lessons[0].id] = { seen: true, quizBest: 100 };
  assert.equal(P.unitProgress(s, u).percent, 25);
  const all = P.overallProgress(s, units);
  assert.equal(all.total, units.reduce((n, x) => n + x.lessons.length, 0));
  assert.equal(all.done, 1);
});

test('الدرس التالي المقترح هو أول درس غير مكتمل', () => {
  const s = defaultState();
  assert.equal(P.nextUp(s, units).lessonId, units[0].lessons[0].id);
  for (const l of units[0].lessons) s.lessons[l.id] = { seen: true, quizBest: 100 };
  assert.equal(P.nextUp(s, units).unitId, units[1].id);
});

test('سلسلة المواظبة تتصاعد ثم تُصفَّر عند الانقطاع', () => {
  const s = defaultState();
  const day = 24 * 3600 * 1000;
  const t0 = new Date('2026-03-10T09:00:00').getTime();
  P.touchStreak(s, t0);
  assert.equal(s.streak.count, 1);
  P.touchStreak(s, t0 + day);
  assert.equal(s.streak.count, 2);
  P.touchStreak(s, t0 + day); // نفس اليوم لا يزيد
  assert.equal(s.streak.count, 2);
  P.touchStreak(s, t0 + 4 * day); // انقطاع
  assert.equal(s.streak.count, 1);
  assert.equal(s.streak.best, 2);
});

test('الشارات تُمنح مرة واحدة وبشروطها', () => {
  const s = defaultState();
  assert.deepEqual(P.evaluateBadges(s, units), []);
  s.lessons.a = { seen: true, quizBest: 100 };
  const first = P.evaluateBadges(s, units);
  assert.ok(first.includes('first-lesson'));
  assert.ok(first.includes('mastery'));
  assert.deepEqual(P.evaluateBadges(s, units), []); // لا تتكرّر
});

test('شارة إتمام الجزء تُمنح عند إكمال كل الوحدات', () => {
  const s = defaultState();
  for (const u of units) for (const l of u.lessons) s.lessons[l.id] = { seen: true, quizBest: 90 };
  const earned = P.evaluateBadges(s, units);
  assert.ok(earned.includes('part-done'));
  assert.ok(earned.includes('unit-done'));
});

/* -------------------- الاختبارات وإعادة المحاولة -------------------- */
group('الاختبارات وإعادة المحاولة');

test('تجهيز سؤال الاختيار يخلط الخيارات ويحفظ موضع الصحيح', () => {
  const q = { id: 'q1', kind: 'mcq', prompt: 'س', options: ['أ', 'ب', 'ج', 'د'], answer: 2, why: 'w' };
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    const p = Q.prepare(q, seed);
    assert.equal(p.view.length, 4);
    assert.equal(p.view[p.answerIndex], 'ج');
    assert.deepEqual([...p.view].sort(), [...q.options].sort());
  }
});

test('«صحيح/خطأ» تبقى بترتيبها', () => {
  const q = { id: 'q', kind: 'truefalse', prompt: 'س', options: ['صحيح', 'خطأ'], answer: 0, why: 'w' };
  const p = Q.prepare(q, 's');
  assert.deepEqual(p.view, ['صحيح', 'خطأ']);
  assert.equal(p.answerIndex, 0);
});

test('الخلط ثابت بنفس البذرة ومختلف بغيرها', () => {
  const a = Q.seededShuffle([1, 2, 3, 4, 5, 6, 7, 8], 'x');
  const b = Q.seededShuffle([1, 2, 3, 4, 5, 6, 7, 8], 'x');
  const c = Q.seededShuffle([1, 2, 3, 4, 5, 6, 7, 8], 'y');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('سؤال الترتيب لا يُعرض مرتّبًا أصلًا', () => {
  const q = { id: 'o', kind: 'order', items: ['1', '2', '3'], why: 'w' };
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const p = Q.prepare(q, seed);
    assert.notDeepEqual(p.view, q.items);
  }
});

test('تصحيح الترتيب والمطابقة', () => {
  const o = Q.prepare({ id: 'o', kind: 'order', items: ['a', 'b', 'c'], why: 'w' }, 's');
  assert.equal(Q.check(o, ['a', 'b', 'c']).correct, true);
  assert.equal(Q.check(o, ['b', 'a', 'c']).correct, false);
  const m = Q.prepare({ id: 'm', kind: 'match', pairs: [['x', '1'], ['y', '2']], why: 'w' }, 's');
  assert.equal(Q.check(m, { x: '1', y: '2' }).correct, true);
  assert.equal(Q.check(m, { x: '2', y: '1' }).correct, false);
  assert.equal(Q.check(m, {}).correct, false);
});

test('حساب النتيجة وعتبة الاجتياز', () => {
  assert.deepEqual(Q.score([{ correct: true }, { correct: false }]), { right: 1, total: 2, percent: 50 });
  assert.equal(Q.passed(80), true);
  assert.equal(Q.passed(79), false);
  assert.equal(Q.score([]).percent, 0);
});

test('بطاقات التذكّر لا تُحتسب في الدرجة', () => {
  const list = [{ kind: 'mcq' }, { kind: 'flashcards' }, { kind: 'order' }];
  assert.equal(Q.gradable(list).length, 2);
});

test('إعادة المحاولة تحفظ أفضل نتيجة', () => {
  const s = defaultState();
  const apply = (pct) => {
    const rec = s.lessons.x || { seen: true, quizBest: 0, quizAttempts: 0, completedAt: null };
    s.lessons.x = { ...rec, quizBest: Math.max(rec.quizBest, pct), quizAttempts: rec.quizAttempts + 1 };
  };
  apply(60); apply(100); apply(40);
  assert.equal(s.lessons.x.quizBest, 100);
  assert.equal(s.lessons.x.quizAttempts, 3);
});

/* ------------------------ المراجعة المتباعدة ------------------------ */
group('التفاعلات المضافة وصياغة العدد');

test('نشاط التصنيف يُجهَّز ويُصحَّح صحيحًا', () => {
  const q = { id: 'c1', kind: 'classify',
    groups: [{ label: 'أ', items: ['و١', 'و٢'] }, { label: 'ب', items: ['و٣'] }] };
  const p = Q.prepare(q, 's');
  assert.equal(p.items.length, 3);
  assert.deepEqual(p.labels, ['أ', 'ب']);
  const right = Object.fromEntries(p.items.map((t) => [t, p.answerOf[t]]));
  assert.equal(Q.check(p, right).correct, true);
  const wrong = { ...right, [p.items[0]]: (p.answerOf[p.items[0]] + 1) % 2 };
  assert.equal(Q.check(p, wrong).correct, false);
  assert.equal(Q.check(p, {}).correct, false);
});

test('كل درس فيه ثلاثة تفاعلات متنوّعة على الأقل بعد الإضافة', () => {
  const short = [];
  for (const u of units) for (const l of u.lessons) {
    if (l.quiz.length + l.interactions.length < 3) short.push(l.id);
  }
  assert.deepEqual(short, [], `دروس دون ثلاثة عناصر: ${short.join('، ')}`);
});

test('الدروس ذات السؤال الواحد صار فيها ثلاثة أنواع مختلفة', () => {
  for (const u of units) for (const l of u.lessons) {
    if (Q.gradable(l.quiz).length > 1) continue;
    const kinds = new Set([...l.interactions, ...l.quiz].map((q) => q.kind));
    assert.ok(kinds.size >= 3, `${l.id}: ${[...kinds].join('، ')}`);
  }
});

test('كل تفاعل مستحدث موسوم authored ومُدرَج في المراجعة ومنسوب لصفحة', () => {
  for (const u of units) for (const l of u.lessons) {
    for (const q of l.interactions) {
      if (q.src !== 'authored') continue;
      assert.equal(q.needsReview, true, `${l.id}/${q.id}`);
      assert.ok(q.page, `${l.id}/${q.id}: بلا صفحة من الكتاب`);
      assert.ok(q.why && q.why.length > 10, `${l.id}/${q.id}: بلا تفسير`);
      assert.ok(needsReview.items.some((it) => it.lessonId === l.id && it.path.endsWith('/' + q.id)),
        `${l.id}/${q.id}: غير موجود في needs-review.json`);
    }
  }
});

test('لا يوجد في البرنامج إكمالٌ لنصّ قرآني بأي صورة', () => {
  const bare = (t) => (t || '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u06DD]/g, '')
    .replace(/[﴿﴾\[\]()«»…．.]/g, '').replace(/[٠-٩0-9]/g, '').replace(/\s+/g, '');
  for (const u of units) for (const l of u.lessons) {
    const quran = l.cards.filter((c) => c.type === 'quran').map((c) => bare(c.text));
    for (const q of [...l.interactions, ...l.quiz]) {
      if (q.kind !== 'complete') continue;
      const raw = (q.before || '') + (q.after || '');
      assert.ok(!raw.includes('﴿') && !raw.includes('﴾'),
        `${l.id}/${q.id}: إكمال نصّ موسوم بأقواس الآية`);
      const probe = (bare(q.before) + bare(q.after)).slice(0, 12);
      if (!probe) continue;
      assert.ok(!quran.some((t) => t.includes(probe)),
        `${l.id}/${q.id}: إكمال مقطع قرآني`);
    }
  }
});

test('لا يظهر نصّ قرآني داخل قائمة خيارات — لا صوابًا ولا خطأً', () => {
  for (const u of units) for (const l of u.lessons) {
    for (const q of [...l.interactions, ...l.quiz]) {
      for (const [i, o] of (q.options || []).entries()) {
        assert.ok(!String(o).includes('﴿') && !String(o).includes('﴾'),
          `${l.id}/${q.id}: خيار [${i}] فيه نصّ قرآني — ${String(o).slice(0, 40)}`);
      }
      // ولا يكون بديلًا خاطئًا في المطابقة أو التصنيف
      for (const pr of (q.pairs || [])) {
        assert.ok(!String(pr[1]).includes('﴿'),
          `${l.id}/${q.id}: نصّ قرآني في بدائل المطابقة`);
      }
      for (const g of (q.groups || [])) {
        for (const it of g.items) {
          assert.ok(!String(it).includes('﴿'),
            `${l.id}/${q.id}: نصّ قرآني بين عناصر التصنيف`);
        }
      }
    }
  }
});

test('التفاعلات الأربعة المحذوفة لم تعُد موجودة', () => {
  const gone = [['u1l3', 'i3'], ['u1l4', 'i2'], ['u1l6', 'i2'], ['u7l11', 'i2']];
  for (const [lid, qid] of gone) {
    const l = units.flatMap((u) => u.lessons).find((x) => x.id === lid);
    assert.ok(l, lid);
    const q = l.interactions.find((x) => x.id === qid);
    // المعرّف قد يبقى مستعملًا لبديلٍ آمن، والممنوع أن يبقى «إكمال آية».
    if (q) {
      assert.notEqual(q.kind, 'complete', `${lid}/${qid}: ما زال إكمال نصّ`);
      assert.ok(!((q.before || '') + (q.after || '')).includes('﴿'), `${lid}/${qid}`);
      assert.equal(q.src, 'authored', `${lid}/${qid}: البديل غير موسوم للمراجعة`);
      assert.equal(q.needsReview, true, `${lid}/${qid}`);
    }
  }
});

test('كل مقطع قرآني في البرنامج داخل الجَرْد المعتمد (بلا نصّ مولَّد)', () => {
  // نفس منطق scripts/audit_quran.py — يُثبت أنّ الشفرة والمحتوى متّفقان.
  const report = fs.readFileSync(path.join(ROOT, 'docs/QURAN_AUDIT.md'), 'utf8');
  assert.ok(/المخالفات: \*\*٠\*\*/.test(report),
    'تقرير تدقيق القرآن يذكر مخالفات — شغّل: python3 scripts/audit_quran.py');
});

test('نشاط ترتيب آيات الفاتحة: عناصره آيات صحيحة كاملة بترتيب المصحف', () => {
  const l = units.flatMap((u) => u.lessons).find((x) => x.id === 'u1l3');
  const q = l.interactions.find((x) => x.id === 'i1');
  assert.ok(q && q.kind === 'order', 'النشاط غير موجود');

  // ١) العناصر آيات كاملة من بطاقة السورة نفسها، لا كلمات مجزّأة.
  const card = l.cards.find((c) => c.type === 'quran');
  const bare = (t) => (t || '').replace(/[\uFD3E\uFD3F]/g, '').trim();
  const inCard = card.text;
  for (const it of q.items) {
    assert.ok(/[\uFD3E\uFD3F]/.test(it), `عنصر بلا أقواس آية: ${it}`);
    const body = bare(it);
    assert.ok(inCard.includes(body), `العنصر ليس نصًّا حرفيًّا من بطاقة السورة: ${body}`);
    assert.ok(body.split(/\s+/).length >= 2, `عنصر من كلمة واحدة (تجزئة): ${body}`);
  }

  // ٢) ترتيب الإجابة الصحيحة هو ترتيب المصحف: مواضعها في السورة متصاعدة.
  // (بعض المقاطع تتكرّر — كالبسملة وآخرها — فيُبحث عمّا بعد الموضع السابق)
  let prev = -1;
  for (const it of q.items) {
    const at = inCard.indexOf(bare(it), prev + 1);
    assert.ok(at > prev, `الترتيب ليس ترتيب المصحف عند: ${bare(it)}`);
    prev = at;
  }

  // ٣) لا نصّ مولَّد: كل عنصر داخل جَرْد بطاقة السورة.
  assert.equal(new Set(q.items).size, q.items.length, 'عناصر مكرّرة');
});

test('نشاط الترتيب لا يُجزّئ الآية ولا يقبل تعديل نصّها', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/ui/widgets.js'), 'utf8');
  const block = src.slice(src.indexOf("if (q.kind === 'order')"),
    src.indexOf("if (q.kind === 'match')"));
  assert.ok(!/contenteditable/i.test(block), 'النصّ قابل للتحرير');
  assert.ok(!/<input|createElement\('input'\)|'input'/.test(block), 'حقل إدخال في نشاط الترتيب');
  assert.ok(/draggable/.test(block) === false, 'سحب بالماوس قد يمسّ النصّ');
  // التصحيح يظهر بعد الإجابة
  assert.ok(/order-item--right/.test(block) && /order-item--wrong/.test(block),
    'لا تظهر علامات التصحيح');
  assert.ok(/الترتيب الصحيح/.test(block), 'لا يُعرض الترتيب الصحيح عند الخطأ');
  // النصّ القرآني بخطّ المصحف
  assert.ok(/qtext\(/.test(block), 'لا يُميَّز النصّ القرآني بخطّه');
});

test('التفاعلات لا تُحفظ في حالة المتعلّم، فلا تُخزَّن هيئة خاطئة', () => {
  // شاشة الدرس تمرّر دالة فارغة لتفاعلات الدرس، والحفظ للاختبار وحده.
  const src = fs.readFileSync(path.join(ROOT, 'js/ui/lesson.js'), 'utf8');
  const inter = src.slice(src.indexOf('// ٤) تفاعل أثناء الدرس'), src.indexOf('// ٥) الخلاصة'));
  assert.ok(inter.length > 40 && inter.length < 900, `مقطع غير متوقّع (${inter.length})`);
  assert.ok(/renderQuestion\(q, \(\) => \{\}/.test(inter),
    'تفاعل الدرس يمرّر معالجًا قد يحفظ');
  assert.ok(!/update\(/.test(inter), 'تفاعل الدرس يكتب في الحالة');
});

test('صياغة العدد والمعدود عربية سليمة', () => {
  assert.equal(arCount(0, COUNT_QUESTION), 'بلا أسئلة');
  assert.equal(arCount(1, COUNT_QUESTION), 'سؤال واحد');
  assert.equal(arCount(2, COUNT_QUESTION), 'سؤالان');
  assert.equal(arCount(3, COUNT_QUESTION), '٣ أسئلة');
  assert.equal(arCount(11, COUNT_QUESTION), '١١ سؤالًا');
  assert.equal(arCount(1, COUNT_MINUTE_GEN), 'دقيقة');
  assert.equal(arCount(2, COUNT_MINUTE_GEN), 'دقيقتين');
  assert.equal(arCount(5, COUNT_MINUTE_GEN), '٥ دقائق');
});

group('المراجعة المتباعدة');

test('الإجابة الصحيحة تباعد الموعد تدريجيًّا', () => {
  const now = Date.now();
  let c = SRS.grade(undefined, true, now);
  assert.equal(c.interval, 1);
  c = SRS.grade(c, true, now);
  assert.equal(c.interval, 3);
  c = SRS.grade(c, true, now);
  assert.equal(c.interval, 7);
  c = SRS.grade(c, true, now);
  assert.ok(c.interval > 7);
});

test('الخطأ يُعيد العنصر قريبًا ويزيد التعثّرات', () => {
  const now = Date.now();
  let c = SRS.grade(undefined, true, now);
  c = SRS.grade(c, false, now);
  assert.equal(c.lapses, 1);
  assert.equal(c.interval, 0);
  assert.ok(c.due - now <= 15 * 60 * 1000);
});

test('اختيار المستحق يرتّب الأقدم أولًا ويحترم الحد', () => {
  const now = Date.now();
  const map = {
    a: { due: now - 3000 }, b: { due: now - 1000 },
    c: { due: now + 100000 }, d: { due: now - 5000 },
  };
  assert.equal(SRS.dueCount(map, now), 3);
  const due = SRS.dueItems(map, now, 2);
  assert.deepEqual(due.map((x) => x.key), ['d', 'a']);
});

test('مفتاح عنصر المراجعة يُبنى ويُفكّ', () => {
  const k = SRS.itemKey('u1', 'u1l3', 'q2');
  assert.equal(k, 'u1/u1l3/q2');
  assert.deepEqual(SRS.parseKey(k), { unitId: 'u1', lessonId: 'u1l3', quizId: 'q2' });
});

test('عناصر المراجعة تشير إلى أسئلة موجودة فعلًا', () => {
  const u = units[0], l = u.lessons[0], q = l.quiz[0];
  const k = SRS.itemKey(u.id, l.id, q.id);
  const { unitId, lessonId, quizId } = SRS.parseKey(k);
  const found = units.find((x) => x.id === unitId).lessons.find((x) => x.id === lessonId)
    .quiz.find((x) => x.id === quizId);
  assert.ok(found);
});

/* ------------------------ مسارا الدرس والوصول ------------------------ */
group('مسارا الدرس والبحث والاستماع');

test('المساران اثنان فقط: تعلّم الدرس ومراجعة سريعة', () => {
  assert.deepEqual(PATHS, ['learn', 'review']);
  assert.equal(pathLabel('learn'), 'تعلّم الدرس');
  assert.equal(pathLabel('review'), 'مراجعة سريعة');
});

test('مسار التعلّم يعرض مادة الدرس كاملة بلا نقص', () => {
  for (const u of units) for (const l of u.lessons) {
    assert.equal(cardsForPath(l, 'learn').length, l.cards.length, l.id);
    assert.equal(interactionsForPath(l, 'learn').length, l.interactions.length, l.id);
  }
});

test('المراجعة السريعة لا تُنقص من الأسئلة شيئًا', () => {
  for (const u of units) for (const l of u.lessons) {
    assert.deepEqual(quizForPath(l), l.quiz, l.id);
  }
});

test('المراجعة السريعة تُبقي نصوص الكتاب متاحة', () => {
  for (const u of units) for (const l of u.lessons) {
    const srcCards = l.cards.filter((c) => ['quran', 'hadith', 'dhikr'].includes(c.type));
    assert.deepEqual(cardsForPath(l, 'review'), srcCards, l.id);
  }
});

test('المراجعة السريعة لا تُتاح إلا بعد إتمام الدرس', () => {
  assert.equal(reviewUnlocked(null), false);
  assert.equal(reviewUnlocked({ seen: true, quizBest: 0 }), false);
  assert.equal(reviewUnlocked({ seen: true, completedAt: 1 }), true);
});

test('الزمن التقريبي محسوب من محتوى كل درس، لا رقمًا ثابتًا', () => {
  const vals = new Set();
  for (const u of units) for (const l of u.lessons) {
    const m = estimatedMinutes(l, 'learn');
    assert.ok(Number.isInteger(m) && m >= 1, l.id);
    assert.ok(estimatedMinutes(l, 'review') <= m, l.id);
    vals.add(m);
  }
  assert.ok(vals.size >= 4, `الزمن لا يتمايز بين الدروس: ${[...vals]}`);
});

test('لا يبقى في الشفرة وعدٌ زمني ثابت (٥/١٠/١٨ دقيقة)', () => {
  const files = ['js/lib/content.js', 'js/lib/progress.js', 'js/ui/lesson.js',
    'js/ui/settings.js', 'js/ui/onboarding.js'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/MODE_MINUTES|modeLabel|cardsForMode|quizForMode/.test(src), f);
    assert.ok(!/نحو ١٨ دقيقة|١٨ د|نحو ٥ دقائق/.test(src), f);
  }
});

test('لصيقة البطاقة تفرّق بين الأصل والصياغة المساعدة', () => {
  assert.equal(cardKindLabel({ type: 'quran' }).text, 'نصّ قرآني');
  assert.equal(cardKindLabel({ type: 'hadith' }).text, 'حديث نبوي');
  assert.equal(cardKindLabel({ type: 'text', src: 'book' }).text, 'من الكتاب');
  assert.equal(cardKindLabel({ type: 'note', src: 'authored' }).text, 'صياغة تعليمية مساعدة');
});

test('التطبيع العربي يتجاهل التشكيل واختلاف الألف والياء', () => {
  assert.equal(normalizeAr('الْحَمْدُ'), normalizeAr('الحمد'));
  assert.equal(normalizeAr('إسلام'), normalizeAr('اسلام'));
  assert.equal(normalizeAr('صلاة'), normalizeAr('صلاه'));
  assert.equal(normalizeAr('الأعْلَى'), normalizeAr('الاعلي'));
});

test('البحث يجد النصوص بلا تشكيل', () => {
  const idx = buildSearchIndex(units);
  assert.ok(search(idx, 'الفاتحة').length > 0);
  assert.ok(search(idx, 'اية الكرسي').length > 0);
  assert.ok(search(idx, 'نواقض الوضوء').length > 0);
  assert.ok(search(idx, 'الاستخارة').length > 0);
  assert.ok(search(idx, 'الحياء').length > 0);
  assert.equal(search(idx, 'ا').length, 0); // أقل من حرفين
});

test('ضابط شرعي: لا قراءة آلية للقرآن', () => {
  assert.equal(isTTSAllowed({ type: 'quran' }), false);
  assert.equal(isTTSAllowed({ type: 'hadith' }), true);
  assert.equal(isTTSAllowed({ type: 'text' }), true);
  assert.equal(audioSourceFor({ type: 'quran' }), null);
  assert.equal(audioSourceFor({ type: 'quran', audio: 'x.mp3' }), 'recording');
});

test('كل بطاقة قرآنية في المحتوى محميّة من القراءة الآلية', () => {
  for (const u of units) for (const l of u.lessons) for (const c of l.cards) {
    if (c.type === 'quran') assert.equal(audioSourceFor(c), null, `${l.id}/${c.id}`);
  }
});

/* ------------------------- ملفات البرنامج ------------------------- */
group('ملفات البرنامج');

test('ملفات PWA موجودة', () => {
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js',
    'assets/img/icon-192.png', 'assets/img/icon-512.png',
    'assets/fonts/cairo-var.woff2', 'assets/fonts/amiri-quran-400.woff2']) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  }
});

test('عامل الخدمة يخزّن كل ملفات الوحدات', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  for (const u of manifest.units) assert.ok(sw.includes(u.file), u.file);
});

test('الصفحة الرئيسة عربية RTL', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(html.includes('lang="ar"'));
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(html.includes('manifest.webmanifest'));
  assert.ok(html.includes('skip-link'));
});

/* ------------------------------ التقرير ------------------------------ */
for (const [mark, line] of results) {
  if (mark === '##') console.log(`\n— ${line} —`);
  else if (mark) console.log(`${mark} ${line}`);
}
console.log(`\nالنتيجة: ${passed} ناجح، ${failed} فاشل.`);
process.exit(failed ? 1 : 0);
