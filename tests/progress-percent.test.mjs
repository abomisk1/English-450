// اختبار «نسبة الإنجاز» — يثبت أنها تعتمد فقط على عدد العناصر ذات status ≠ new
// (عدد المُتعلَّم ÷ 450 × 100)، ولا تتأثّر بالإتقان ولا إعادة الجلسات/الاختبارات.
// تشغيل: node tests/progress-percent.test.mjs

import assert from 'node:assert/strict';
import { ALL_ITEMS } from '../js/data/index.js';
import {
  resetAll,
  learnItem,
  answerItem,
  getState,
  computeStats,
  recordLevelQuizResult,
  recordFinalQuizResult,
  levelContentFinished,
} from '../js/store.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ✓', name); }

const pct = () => computeStats(getState()).masteryPercent;

// يجعل أوّل n عنصرًا «متعلَّمًا» (status ≠ new) بأقل تدخّل.
function learnFirst(n) {
  resetAll();
  for (let i = 0; i < n; i++) learnItem(ALL_ITEMS[i].id, ALL_ITEMS[i].kind);
}

console.log('— اختبار نسبة الإنجاز —');

// (3) الحالات المطلوبة: 0 / 45 / 225 / 450
test('الحالات: 0/450=0%، 45/450=10%، 225/450=50%، 450/450=100%', () => {
  learnFirst(0); assert.equal(pct(), 0);
  learnFirst(45); assert.equal(pct(), 10);
  learnFirst(225); assert.equal(pct(), 50);
  learnFirst(450); assert.equal(pct(), 100);
});

// النسبة = round(المُتعلَّم ÷ 450 × 100) عبر قيم متنوّعة
test('النسبة = round(عدد status≠new ÷ 450 × 100)', () => {
  for (const n of [1, 9, 23, 100, 200, 333, 449]) {
    learnFirst(n);
    assert.equal(pct(), Math.round((n / 450) * 100), `n=${n}`);
    assert.equal(computeStats(getState()).learnedTotal, n);
  }
});

// (2) تعتمد فقط على العدد: لا يزيدها الانتقال بين حالات التعلّم ولا الإتقان
test('الإتقان لا يزيد نسبة الإنجاز (مفهوم منفصل)', () => {
  resetAll();
  learnItem(ALL_ITEMS[0].id, ALL_ITEMS[0].kind);
  const base = pct(); // عنصر واحد متعلَّم
  // أجب عليه صحيحًا مرارًا حتى يُتقَن — يبقى عنصرًا واحدًا في العدّ
  for (let i = 0; i < 8; i++) answerItem(ALL_ITEMS[0].id, ALL_ITEMS[0].kind, true);
  const s = computeStats(getState());
  assert.equal(s.masteredTotal >= 1, true, 'العنصر أُتقن فعلًا');
  assert.equal(pct(), base, 'نسبة الإنجاز لم تتغيّر بالإتقان');
  assert.equal(s.learnedTotal, 1, 'ما زال عنصرًا واحدًا منجزًا');
});

// (4) إعادة الجلسات/الإجابات على نفس العنصر لا تكرّر الاحتساب
test('تكرار الإجابة على نفس العنصر لا يزيد النسبة', () => {
  resetAll();
  learnItem(ALL_ITEMS[0].id, ALL_ITEMS[0].kind);
  learnItem(ALL_ITEMS[1].id, ALL_ITEMS[1].kind);
  const before = pct();
  answerItem(ALL_ITEMS[0].id, ALL_ITEMS[0].kind, true);
  answerItem(ALL_ITEMS[0].id, ALL_ITEMS[0].kind, false); // خطأ ثم مراجعة
  answerItem(ALL_ITEMS[1].id, ALL_ITEMS[1].kind, true);
  assert.equal(pct(), before, 'العدّ ثابت رغم تكرار الإجابات');
  assert.equal(computeStats(getState()).learnedTotal, 2);
});

// (1) الاختبارات لا تؤثّر على نسبة الإنجاز
test('اختبارات المستوى والنهائي لا تغيّر نسبة الإنجاز', () => {
  resetAll();
  for (let i = 0; i < 90; i++) learnItem(ALL_ITEMS[i].id, ALL_ITEMS[i].kind);
  const before = pct(); // 90/450 = 20%
  assert.equal(before, 20);
  recordLevelQuizResult(1, { score: 20, total: 20, errors: [] });
  recordLevelQuizResult(1, { score: 16, total: 20, errors: [] }); // إعادة
  recordFinalQuizResult({ score: 50, total: 50, errors: [] });
  assert.equal(pct(), before, 'الاختبارات لم تغيّر نسبة الإنجاز');
});

// حراسة: مفهوم الإتقان (programComplete) لم يُدمَج مع نسبة الإنجاز
test('programComplete يبقى معتمدًا على الإتقان لا على الإنجاز', () => {
  learnFirst(450); // كل العناصر متعلَّمة (100% إنجاز) لكن غير متقَنة
  const s = computeStats(getState());
  assert.equal(s.masteryPercent, 100);
  assert.equal(s.programComplete, false, 'الإكمال يتطلّب الإتقان لا مجرّد الإنجاز');
});

console.log(`\n✅ نجحت اختبارات نسبة الإنجاز (${passed} اختبارًا).`);
