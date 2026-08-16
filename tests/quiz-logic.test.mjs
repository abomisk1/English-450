// اختبارات منطق الاختبارات (اختبار المستوى + الاختبار النهائي).
// تعمل بـ Node مباشرة بلا أي اعتماديات: node tests/quiz-logic.test.mjs
// (المتجر يعمل بلا localStorage في Node — يتجاهل الحفظ بهدوء.)

import assert from 'node:assert/strict';
import {
  LEVEL_QUIZ_SIZE,
  FINAL_QUIZ_SIZE,
  LEVEL_PASS_SCORE,
  FINAL_PASS_SCORE,
  FINAL_PER_LEVEL,
  isLevelPass,
  isFinalPass,
  buildLevelQuiz,
  buildFinalQuiz,
  pickProportional,
} from '../js/lib/quiz.js';
import { ITEMS_BY_LEVEL, LEVEL_COUNT, ALL_ITEMS } from '../js/data/index.js';
import {
  resetAll,
  learnItem,
  getState,
  computeStats,
  levelContentFinished,
  levelQuizState,
  finalQuizState,
  isFinalUnlocked,
  recordLevelQuizResult,
  recordFinalQuizResult,
} from '../js/store.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

function learnAllOfLevel(L) {
  for (const it of ITEMS_BY_LEVEL[L]) learnItem(it.id, it.kind);
}

console.log('— اختبارات منطق الاختبارات —');

// (3) عدد أسئلة اختبار المستوى = 20
test('عدد أسئلة اختبار المستوى = 20', () => {
  assert.equal(LEVEL_QUIZ_SIZE, 20);
  for (let L = 1; L <= LEVEL_COUNT; L++) assert.equal(buildLevelQuiz(L).length, 20);
});

// (15) عدد أسئلة الاختبار النهائي = 50
test('عدد أسئلة الاختبار النهائي = 50', () => {
  assert.equal(FINAL_QUIZ_SIZE, 50);
  assert.equal(FINAL_PER_LEVEL.reduce((a, b) => a + b, 0), 50);
  assert.equal(buildFinalQuiz().length, 50);
});

// (4) جميع أسئلة اختبار المستوى من المستوى الصحيح
test('كل أسئلة اختبار المستوى من نفس المستوى', () => {
  for (let L = 1; L <= LEVEL_COUNT; L++) {
    for (const q of buildLevelQuiz(L)) assert.equal(q.item.level, L, `عنصر من مستوى ${q.item.level} ظهر في اختبار ${L}`);
  }
});

// (5) عدم تكرار العنصر داخل الاختبار الواحد (مستوى)
test('لا تكرار للعناصر داخل اختبار المستوى', () => {
  for (let L = 1; L <= LEVEL_COUNT; L++) {
    for (let r = 0; r < 20; r++) {
      const ids = buildLevelQuiz(L).map((q) => q.item.id);
      assert.equal(new Set(ids).size, ids.length);
    }
  }
});

// (17) عدم تكرار العناصر داخل الاختبار النهائي
test('لا تكرار للعناصر داخل الاختبار النهائي', () => {
  for (let r = 0; r < 20; r++) {
    const ids = buildFinalQuiz().map((q) => q.item.id);
    assert.equal(new Set(ids).size, ids.length, 'وُجد تكرار في الاختبار النهائي');
  }
});

// (16) تمثيل جميع المستويات الستة في الاختبار النهائي بحسب الحصص
test('الاختبار النهائي يمثّل المستويات الستة بالحصص 8/8/8/8/9/9', () => {
  for (let r = 0; r < 20; r++) {
    const counts = {};
    for (const q of buildFinalQuiz()) counts[q.item.level] = (counts[q.item.level] || 0) + 1;
    for (let L = 1; L <= LEVEL_COUNT; L++) assert.equal(counts[L], FINAL_PER_LEVEL[L - 1], `المستوى ${L} تمثيله غير صحيح`);
  }
});

// توزيع الكلمات/الجمل بالتناسب (اختبار المستوى)
test('توزيع الكلمات/الجمل في اختبار المستوى متناسب مع المحتوى', () => {
  for (let L = 1; L <= LEVEL_COUNT; L++) {
    const items = ITEMS_BY_LEVEL[L];
    const W = items.filter((x) => x.kind === 'word').length;
    const N = items.length;
    let expectedW = Math.round((20 * W) / N);
    const P = N - W;
    let expectedP = Math.min(20 - expectedW, P);
    expectedW = Math.min(20 - expectedP, W);
    expectedP = 20 - expectedW;
    const q = buildLevelQuiz(L);
    const gotW = q.filter((x) => x.item.kind === 'word').length;
    const gotP = q.filter((x) => x.item.kind === 'phrase').length;
    assert.equal(gotW, expectedW, `L${L} كلمات`);
    assert.equal(gotP, expectedP, `L${L} جمل`);
  }
});

// pickProportional لا يكرّر ولا يتجاوز المتاح
test('pickProportional يعيد عناصر فريدة بالعدد المطلوب', () => {
  const items = ITEMS_BY_LEVEL[6];
  const picked = pickProportional(items, 9);
  assert.equal(picked.length, 9);
  assert.equal(new Set(picked.map((x) => x.id)).size, 9);
});

// (6,7,18,19) عتبات النجاح
test('عتبات النجاح: 16/20 و15/20 و40/50 و39/50', () => {
  assert.equal(LEVEL_PASS_SCORE, 16);
  assert.equal(FINAL_PASS_SCORE, 40);
  assert.equal(isLevelPass(16), true);
  assert.equal(isLevelPass(20), true);
  assert.equal(isLevelPass(15), false);
  assert.equal(isFinalPass(40), true);
  assert.equal(isFinalPass(50), true);
  assert.equal(isFinalPass(39), false);
});

// (1) عدم فتح اختبار المستوى قبل إكمال المستوى — و(2) فتحه بعده
test('اختبار المستوى مقفل قبل إنهاء المحتوى ومتاح بعده', () => {
  resetAll();
  assert.equal(levelContentFinished(1), false);
  assert.equal(levelQuizState(1).available, false);
  learnAllOfLevel(1);
  assert.equal(levelContentFinished(1), true);
  assert.equal(levelQuizState(1).available, true);
  // مستوى آخر لم يُنهَ بعد يبقى مقفلًا
  assert.equal(levelQuizState(2).available, false);
});

// (8,9) حفظ أفضل نتيجة + عدم خفضها عند نتيجة أقل
test('أفضل نتيجة تُحفظ ولا تنخفض عند إعادة بنتيجة أقل', () => {
  resetAll();
  learnAllOfLevel(1);
  recordLevelQuizResult(1, { score: 18, total: 20, errors: [] });
  assert.deepEqual(levelQuizState(1).best, { score: 18, total: 20, pct: 90 });
  recordLevelQuizResult(1, { score: 15, total: 20, errors: [] });
  const st = levelQuizState(1);
  assert.equal(st.best.score, 18, 'أفضل نتيجة يجب أن تبقى 18');
  assert.equal(st.last.score, 15, 'آخر نتيجة يجب أن تكون 15');
  assert.equal(st.attempts, 2);
  assert.equal(st.passed, true, 'النجاح لاصق (اجتاز في المحاولة الأولى)');
});

// النجاح لاصق حتى لو رسب لاحقًا
test('حالة النجاح لاصقة ولا تُلغى برسوب لاحق', () => {
  resetAll();
  learnAllOfLevel(1);
  recordLevelQuizResult(1, { score: 10, total: 20, errors: [] }); // رسوب
  assert.equal(levelQuizState(1).passed, false);
  recordLevelQuizResult(1, { score: 16, total: 20, errors: [] }); // نجاح
  assert.equal(levelQuizState(1).passed, true);
  recordLevelQuizResult(1, { score: 5, total: 20, errors: [] }); // رسوب لاحق
  assert.equal(levelQuizState(1).passed, true, 'يبقى ناجحًا');
});

// (10) مراجعة الأخطاء تُخزَّن كما هي (أخطاء آخر محاولة فقط)
test('أخطاء آخر محاولة تُحفظ للمراجعة', () => {
  resetAll();
  learnAllOfLevel(1);
  const errs = [{ english: 'he', arabic: 'هو', your: 'she', correct: 'he' }];
  recordLevelQuizResult(1, { score: 19, total: 20, errors: errs });
  assert.deepEqual(levelQuizState(1).errors, errs);
  // محاولة جديدة بلا أخطاء تستبدل أخطاء المراجعة
  recordLevelQuizResult(1, { score: 20, total: 20, errors: [] });
  assert.deepEqual(levelQuizState(1).errors, []);
});

// (13,14) فتح الاختبار النهائي: قبل/بعد استيفاء الشروط
test('الاختبار النهائي مقفل حتى اجتياز المستويات الستة', () => {
  resetAll();
  assert.equal(finalQuizState().unlocked, false);
  for (let L = 1; L <= LEVEL_COUNT; L++) learnAllOfLevel(L);
  // أنهى المحتوى لكن لم يجتز الاختبارات بعد
  assert.equal(isFinalUnlocked(), false);
  for (let L = 1; L <= LEVEL_COUNT; L++) recordLevelQuizResult(L, { score: 16, total: 20, errors: [] });
  assert.equal(isFinalUnlocked(), true);
  assert.equal(finalQuizState().unlocked, true);
});

// (20) حفظ أفضل نتيجة نهائية
test('الاختبار النهائي يحفظ أفضل نتيجة ولا يخفضها', () => {
  resetAll();
  recordFinalQuizResult({ score: 45, total: 50, errors: [] });
  assert.equal(finalQuizState().best.score, 45);
  assert.equal(finalQuizState().passed, true);
  recordFinalQuizResult({ score: 41, total: 50, errors: [] });
  assert.equal(finalQuizState().best.score, 45, 'أفضل نتيجة نهائية تبقى 45');
  assert.equal(finalQuizState().last.score, 41);
});

// (11,12) نسبة الإنجاز لا تزيد بسبب الاختبارات ولا بسبب إعادتها
test('نسبة الإنجاز لا تتأثر بالاختبارات ولا بإعادتها', () => {
  resetAll();
  learnAllOfLevel(1);
  learnAllOfLevel(2);
  const before = computeStats(getState()).masteryPercent;
  const itemsBefore = JSON.stringify(getState().items);
  recordLevelQuizResult(1, { score: 20, total: 20, errors: [] });
  recordLevelQuizResult(1, { score: 20, total: 20, errors: [] }); // إعادة
  recordLevelQuizResult(2, { score: 18, total: 20, errors: [] });
  recordFinalQuizResult({ score: 50, total: 50, errors: [] });
  const after = computeStats(getState()).masteryPercent;
  assert.equal(after, before, 'نسبة الإنجاز تغيّرت بسبب الاختبار');
  assert.equal(JSON.stringify(getState().items), itemsBefore, 'الاختبارات غيّرت حالة العناصر');
  assert.equal(getState().points, 0, 'الاختبارات منحت نقاطًا');
});

// (21) سلامة البيانات القديمة: progress بلا مفتاح quizzes لا يكسر المحدّدات
test('بيانات مستخدم قديمة (بلا quizzes) تعمل بأمان', () => {
  const legacy = { items: {}, points: 100, activeLevel: 2 }; // لا يوجد quizzes
  assert.doesNotThrow(() => levelQuizState(1, legacy));
  assert.equal(levelQuizState(1, legacy).available, false);
  assert.equal(finalQuizState(legacy).unlocked, false);
  assert.equal(isFinalUnlocked(legacy), false);
});

// سلامة عامة: كل عنصر في مستوى واحد والمجموع 450 (لم يتغيّر المحتوى)
test('المحتوى 450 عنصرًا وتوزيع المستويات ثابت', () => {
  assert.equal(ALL_ITEMS.length, 450);
  const counts = {};
  for (const it of ALL_ITEMS) counts[it.level] = (counts[it.level] || 0) + 1;
  assert.deepEqual(counts, { 1: 78, 2: 82, 3: 80, 4: 72, 5: 70, 6: 68 });
});

console.log(`\n✅ نجحت جميع اختبارات المنطق (${passed} اختبارًا).`);
