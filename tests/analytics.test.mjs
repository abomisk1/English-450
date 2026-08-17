// اختبارات منطق الإحصائيات المجهولة — نقيّة، بلا شبكة أو localStorage.
// تشغيل: node tests/analytics.test.mjs
//
// تغطّي: توليد المعرّف، تطبيع السجلّ، اشتقاق أحداث إكمال المستوى/البرنامج (بالإتقان)،
// ومنع تكرار الاحتساب. لا تلمس منطق التطبيق أو التقدّم.

import assert from 'node:assert/strict';
import { ITEMS_BY_LEVEL, ALL_ITEMS } from '../js/data/index.js';
import { resetAll, answerItem, getState, levelStats, computeStats } from '../js/store.js';
import { ANALYTICS_CONFIG } from '../js/config/analytics.config.js';
import {
  newAnonId,
  normalizeRecord,
  pendingEvents,
  markReported,
  isEnabled,
} from '../js/lib/analytics.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ✓', name); };

// إتقان عنصر = 4 إجابات صحيحة (reps≥4 و intervalDays≥16).
function masterLevel(L) {
  for (const it of ITEMS_BY_LEVEL[L]) for (let i = 0; i < 4; i++) answerItem(it.id, it.kind, true);
}

console.log('— اختبارات منطق الإحصائيات —');

test('newAnonId يولّد معرّفات فريدة بصيغة UUID', () => {
  const a = newAnonId(), b = newAnonId();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.notEqual(a, b);
});

test('normalizeRecord يعطي بنية آمنة للبيانات الناقصة/الفاسدة', () => {
  const r = normalizeRecord(null);
  assert.equal(typeof r.id, 'string');
  assert.deepEqual(r.reportedLevels, []);
  assert.equal(r.reportedProgram, false);
  const r2 = normalizeRecord({ id: 'x', reportedLevels: [1, 'a', 3], reportedProgram: true });
  assert.equal(r2.id, 'x');
  assert.deepEqual(r2.reportedLevels, [1, 3]); // يُسقط غير الأعداد
  assert.equal(r2.reportedProgram, true);
});

test('isEnabled يعكس وجود الإعداد (منطق التفعيل)', () => {
  // النتيجة تعتمد على قيم analytics.config.js الفعلية؛ نتحقّق من المنطق لا من قيمة ثابتة:
  // مُفعَّل ⇔ ضُبط الرابط والمفتاح العام معًا.
  assert.equal(typeof isEnabled(), 'boolean');
  assert.equal(isEnabled(), Boolean(ANALYTICS_CONFIG.SUPABASE_URL && ANALYTICS_CONFIG.SUPABASE_ANON_KEY));
});

test('pendingEvents لا يُصدر شيئًا لمستخدم جديد', () => {
  resetAll();
  const rec = normalizeRecord(null);
  const { newLevels, program } = pendingEvents(rec, getState());
  assert.deepEqual(newLevels, []);
  assert.equal(program, false);
});

test('إكمال المستوى يُشتقّ بالإتقان الكامل فقط', () => {
  resetAll();
  const rec = normalizeRecord(null);
  // تعلّم بلا إتقان لا يُحتسب إكمالًا
  for (const it of ITEMS_BY_LEVEL[1]) answerItem(it.id, it.kind, true); // مرة واحدة فقط
  assert.equal(levelStats(1, getState()).complete, false);
  assert.deepEqual(pendingEvents(rec, getState()).newLevels, []);
  // الآن أتقن المستوى الأول بالكامل
  masterLevel(1);
  assert.equal(levelStats(1, getState()).complete, true);
  assert.deepEqual(pendingEvents(rec, getState()).newLevels, [1]);
});

test('منع تكرار احتساب نفس المستوى (markReported)', () => {
  resetAll();
  masterLevel(1);
  let rec = normalizeRecord(null);
  let ev = pendingEvents(rec, getState());
  assert.deepEqual(ev.newLevels, [1]);
  rec = markReported(rec, ev);            // بعد الإرسال
  assert.deepEqual(rec.reportedLevels, [1]);
  ev = pendingEvents(rec, getState());     // مرّة ثانية
  assert.deepEqual(ev.newLevels, [], 'لا يُعاد احتساب نفس المستوى');
});

test('إكمال البرنامج يُشتقّ ويُحتسب مرّة واحدة فقط (450/450 إتقان)', () => {
  resetAll();
  let rec = normalizeRecord(null);
  assert.equal(pendingEvents(rec, getState()).program, false);
  for (let L = 1; L <= 6; L++) masterLevel(L);
  assert.equal(computeStats(getState()).programComplete, true);
  let ev = pendingEvents(rec, getState());
  assert.equal(ev.program, true);
  assert.deepEqual(ev.newLevels, [1, 2, 3, 4, 5, 6], 'كل المستويات اكتملت أيضًا');
  rec = markReported(rec, ev);
  assert.equal(pendingEvents(rec, getState()).program, false, 'لا يُعاد احتساب البرنامج');
});

test('إعادة الإجابة بعد الإتقان لا تُعيد إصدار الحدث', () => {
  resetAll();
  masterLevel(1);
  let rec = markReported(normalizeRecord(null), pendingEvents(normalizeRecord(null), getState()));
  // مزيد من الإجابات على عناصر المستوى (إعادة جلسات)
  for (const it of ITEMS_BY_LEVEL[1].slice(0, 5)) answerItem(it.id, it.kind, true);
  assert.deepEqual(pendingEvents(rec, getState()).newLevels, []);
});

// حراسة: المحتوى لم يتغيّر
test('المحتوى ثابت 450 عنصرًا', () => {
  assert.equal(ALL_ITEMS.length, 450);
});

console.log(`\n✅ نجحت اختبارات منطق الإحصائيات (${passed} اختبارًا).`);
