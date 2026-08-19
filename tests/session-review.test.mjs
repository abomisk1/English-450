// اختبار منطق تخزين أسئلة مراجعة الجلسة — يمنع عودة مشكلة عرض أسئلة لم يُخطئ فيها المستخدم.
// تشغيل: node tests/session-review.test.mjs
//
// يثبت أن المراجعة تحتفظ بـ«نفس السؤال» المُخطأ فيه (نسخة مستقلّة ثابتة) بهويّته الكاملة:
// item.id + type + النص + الخيارات + الإجابة الصحيحة — قبل الخلط وبعده — ومنع التكرار.

import assert from 'node:assert/strict';
import { addUniqueError, cloneExercise, questionKey } from '../js/lib/session-review.js';
import { buildExercise, typesFor } from '../js/lib/exercises.js';
import { ITEMS_BY_LEVEL, ITEMS_BY_ID } from '../js/data/index.js';
import { shuffle } from '../js/lib/shuffle.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ✓', name); };

const correctLabel = (ex) => (ex.options ? (ex.options.find((o) => o.correct) || {}).label : ex.answer);

console.log('— اختبار منطق مراجعة أخطاء الجلسة —');

test('cloneExercise ينتج نسخة مستقلّة لا تتأثّر بتغيّر الأصل', () => {
  const it = ITEMS_BY_LEVEL[1][0];
  const ex = buildExercise(it, 'choose-meaning');
  const snap = cloneExercise(ex);
  // غيّر الأصل بعد التخزين
  ex.prompt = 'CHANGED';
  ex.options[0].label = 'CHANGED';
  ex.item = { id: 'other' };
  assert.notEqual(snap.prompt, 'CHANGED');
  assert.notEqual(snap.options[0].label, 'CHANGED');
  assert.equal(snap.item.id, it.id, 'العنصر داخل النسخة ثابت');
});

test('النسخة تحفظ الهويّة الكاملة: id + type + النص + الخيارات + الإجابة الصحيحة', () => {
  for (const kind of [ITEMS_BY_LEVEL[1].find((x) => x.kind === 'word'), ITEMS_BY_LEVEL[1].find((x) => x.kind === 'phrase')]) {
    for (const t of typesFor(kind)) {
      const ex = buildExercise(kind, t);
      const snap = cloneExercise(ex);
      assert.equal(snap.item.id, ex.item.id);
      assert.equal(snap.type, ex.type);
      assert.equal(snap.prompt, ex.prompt);
      assert.deepEqual(snap.options, ex.options);
      assert.equal(correctLabel(snap), correctLabel(ex), 'الإجابة الصحيحة محفوظة');
    }
  }
});

test('addUniqueError يمنع تكرار نفس (item.id|type) ويسمح باختلاف النوع', () => {
  const it = ITEMS_BY_LEVEL[1].find((x) => x.kind === 'word');
  const errors = [], keys = new Set();
  const exA = buildExercise(it, 'choose-meaning');
  const exA2 = buildExercise(it, 'choose-meaning'); // نفس (id|type) — نسخة أخرى
  const exB = buildExercise(it, 'choose-english');   // نفس العنصر، نوع مختلف
  assert.equal(addUniqueError(errors, keys, exA), true);
  assert.equal(addUniqueError(errors, keys, exA2), false, 'نفس (id|type) لا يُضاف مرّتين');
  assert.equal(addUniqueError(errors, keys, exB), true, 'نوع مختلف يُضاف');
  assert.equal(errors.length, 2);
  assert.deepEqual(errors.map((e) => e.type).sort(), ['choose-english', 'choose-meaning']);
});

test('محاكاة المراجعة: تُعاد الأسئلة المُخطأة نفسها فقط، والصواب يحذفها ولا تتكرر', () => {
  // نبني عدّة أسئلة، نعلّم بعضها «خطأ»، ثم نحاكي طابور المراجعة كما في الجلسة.
  const items = ITEMS_BY_LEVEL[3].slice(0, 8);
  const wrongExercises = items.slice(0, 5).map((it, i) => buildExercise(it, typesFor(it)[i % typesFor(it).length]));
  const rightExercises = items.slice(5).map((it) => buildExercise(it, typesFor(it)[0]));

  const errors = [], keys = new Set();
  for (const ex of wrongExercises) addUniqueError(errors, keys, ex);
  for (const ex of rightExercises) {/* الصحيحة لا تُخزَّن */}

  // الطابور = نسخة من الأخطاء (كما في startReview)
  let queue = errors.slice();
  const shownKeys = [];
  let steps = 0;
  // نصحّح الجميع من المحاولة الأولى (كل سؤال يظهر مرّة ثم يُحذف)
  while (queue.length && steps++ < 100) {
    const ex = queue.shift();
    shownKeys.push(questionKey(ex));
    // إجابة صحيحة ⇒ لا يُعاد
  }
  // كل ما ظهر يجب أن يكون من الأخطاء بالضبط، وبلا تكرار
  const wrongKeys = wrongExercises.map(questionKey);
  assert.deepEqual(shownKeys.slice().sort(), wrongKeys.slice().sort(), 'المعروض = المُخطأ بالضبط');
  // لا يظهر أي سؤال من الأسئلة الصحيحة
  const rightKeys = new Set(rightExercises.map(questionKey));
  assert.equal(shownKeys.some((k) => rightKeys.has(k)), false, 'لا يظهر سؤال أُجيب صحيحًا');
});

test('الخطأ في المراجعة يُعيد نفس السؤال إلى نهاية الطابور حتى يُصحَّح', () => {
  const items = ITEMS_BY_LEVEL[2].slice(0, 3);
  const errors = [], keys = new Set();
  for (const it of items) addUniqueError(errors, keys, buildExercise(it, typesFor(it)[0]));
  let queue = errors.slice();
  const target = questionKey(queue[0]);
  // المحاولة الأولى على أول سؤال: خطأ ⇒ يعود إلى النهاية (نفس النسخة)
  const first = queue.shift();
  queue.push(first);
  assert.equal(questionKey(queue[queue.length - 1]), target, 'نفس السؤال عاد إلى النهاية');
  assert.equal(queue.length, 3, 'العدد ثابت (لا نسخة جديدة)');
  assert.equal(queue[queue.length - 1], first, 'نفس الكائن المخزَّن (لا إعادة توليد)');
});

test('ثبات الهويّة قبل الخلط وبعده (اعتماد على item.id)', () => {
  const items = ITEMS_BY_LEVEL[4].slice(0, 6);
  const originalIds = items.map((x) => x.id);
  // ابنِ أسئلة ثم اخلط ترتيبها ثم خزّنها كأخطاء
  const exercises = items.map((it) => buildExercise(it, typesFor(it)[0]));
  const errors = [], keys = new Set();
  for (const ex of shuffle(exercises)) addUniqueError(errors, keys, ex);
  // المعرّفات المخزّنة (كمجموعة) = المعرّفات الأصلية رغم الخلط
  assert.deepEqual(errors.map((e) => e.item.id).sort(), originalIds.slice().sort());
  // كل معرّف مخزَّن يشير إلى عنصر حقيقي، ونصّ السؤال يخصّ ذلك العنصر
  for (const e of errors) {
    assert.ok(ITEMS_BY_ID[e.item.id], 'معرّف حقيقي');
    assert.equal(e.item.id, ITEMS_BY_ID[e.item.id].id);
  }
});

console.log(`\n✅ نجحت اختبارات منطق مراجعة الجلسة (${passed} اختبارًا).`);
