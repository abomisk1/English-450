// اختبار واجهة لصندوق شرح مصطلحات الإحصائيات + تسميات البطاقات الجديدة.
// يتطلّب خادمًا محليًا + playwright؛ يتخطّى بلا فشل إن غابا.
// تشغيل: node tests/stats-help.e2e.mjs  (أو E2E_PORT=8141)

import { createRequire } from 'module';

const PORT = process.env.E2E_PORT || '8141';
const BASE = `http://127.0.0.1:${PORT}/index.html`;
const PKEY = 'english450:progress:v1';

let chromium;
try {
  const require = createRequire('/opt/node22/lib/node_modules/');
  ({ chromium } = require('playwright'));
} catch {
  console.log('⏭️  تخطّي: playwright غير متوفّرة.');
  process.exit(0);
}
async function reachable(url) { try { await fetch(url); return true; } catch { return false; } }

const isExt = (t) => /ERR_TUNNEL|Failed to load resource|fonts\.(googleapis|gstatic)|supabase/.test(t);
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// حالة تقدّم معروفة: عنصران «قيد التثبيت» ونقاط ثابتة، للتحقّق من ثبات الأرقام.
function seededProgress() {
  const now = Date.now();
  const mk = (id, kind) => ({ id, kind, status: 'review', reps: 2, lapses: 0, correctStreak: 2, ease: 2.1, intervalDays: 3, dueAt: now + 3 * 86400000, seenAt: now });
  return { items: { 'w-i': mk('w-i', 'word'), 'w-you': mk('w-you', 'word') }, points: 1790, streak: 5, lastSessionDate: null, sessionsCompleted: 3, achievements: [], completions: 0, lastCompletedAt: null, currentCycleCompleted: false, activeLevel: 1, quizzes: { levels: {}, final: {} } };
}

const TERMS = ['بدأت تعلّمها', 'قيد التعلّم', 'قيد التثبيت', 'مستحقة اليوم', 'متقنة', 'نقاط التحفيز', 'المستويات المكتملة'];

(async () => {
  if (!(await reachable(BASE))) { console.log(`⏭️  تخطّي: الخادم غير متاح على ${BASE}.`); process.exit(0); }
  const browser = await chromium.launch();
  const jsErrors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('console', (m) => { if (m.type() === 'error' && !isExt(m.text())) jsErrors.push(m.text()); });
    page.on('pageerror', (e) => jsErrors.push(String(e)));
    await page.addInitScript((seed) => { try { window.speechSynthesis.speak = () => {}; } catch {} localStorage.setItem('english450:progress:v1', seed); }, JSON.stringify(seededProgress()));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    // انتقل إلى تبويب «تقدّمي»
    await page.evaluate(() => { const b = [...document.querySelectorAll('.bottom-nav__btn')].find((x) => x.textContent.includes('تقدّم')); b && b.click(); });
    await page.waitForTimeout(200);

    // (1) ظهور زر/عنوان التوضيح
    const summaryText = await page.evaluate(() => (document.querySelector('.stats-help__summary') || {}).textContent || '');
    ok(summaryText.includes('ما معنى هذه الإحصائيات؟'), 'ظهور زر «ما معنى هذه الإحصائيات؟»');

    // (2) مغلق افتراضيًا
    let open = await page.evaluate(() => document.querySelector('.stats-help').open);
    ok(open === false, 'الصندوق مغلق افتراضيًا');
    let bodyVisible = await page.evaluate(() => { const b = document.querySelector('.stats-help__body'); return b && b.offsetHeight > 0; });
    ok(!bodyVisible, 'محتوى الشرح مخفيّ قبل الفتح');

    // (3) بطاقات بالمصطلحات الجديدة + التقاط الأرقام قبل الفتح
    const cardsBefore = await page.evaluate(() => [...document.querySelectorAll('.stat')].map((s) => ({ v: s.querySelector('.stat__value').textContent.trim(), l: s.querySelector('.stat__label').textContent.trim() })));
    const labels = cardsBefore.map((c) => c.l).join(' | ');
    ok(/كلمات بدأت تعلّمها/.test(labels), 'بطاقة «كلمات بدأت تعلّمها»');
    ok(/جمل بدأت تعلّمها/.test(labels), 'بطاقة «جمل بدأت تعلّمها»');
    ok(/مستحقة اليوم/.test(labels), 'بطاقة «مستحقة اليوم»');
    ok(/نقاط التحفيز/.test(labels), 'بطاقة «نقاط التحفيز»');
    ok(!/مكتسبة|بحاجة إلى مراجعة|مجموع النقاط/.test(labels), 'اختفاء المصطلحات القديمة من البطاقات');
    // «قيد التثبيت» في قائمة حالة المحتوى، وغياب «قيد المراجعة»
    const statusText = await page.evaluate(() => document.body.innerText);
    ok(/قيد التثبيت/.test(statusText), 'ظهور «قيد التثبيت» في حالة المحتوى');
    ok(!/قيد المراجعة/.test(statusText), 'اختفاء «قيد المراجعة»');

    // (4) فتح الشرح والتحقّق من كل المصطلحات بالنص الصحيح
    await page.click('.stats-help__summary'); await page.waitForTimeout(200);
    open = await page.evaluate(() => document.querySelector('.stats-help').open);
    ok(open === true, 'يفتح الشرح عند النقر');
    const helpBody = await page.evaluate(() => (document.querySelector('.stats-help__body') || {}).innerText || '');
    for (const term of TERMS) ok(helpBody.includes(term), `الشرح يعرض المصطلح: «${term}»`);
    ok(/تحصل على 10 نقاط مقابل كل إجابة صحيحة/.test(helpBody), 'نص شرح نقاط التحفيز صحيح');
    ok(/وهي جزء من العناصر قيد التثبيت/.test(helpBody), 'شرح «مستحقة اليوم» يستخدم «قيد التثبيت»');
    ok(!/SRS|reps|intervalDays/i.test(helpBody), 'لا مصطلحات تقنية في الشرح');

    // (5) الأرقام لم تتغيّر بعد الفتح
    const cardsAfter = await page.evaluate(() => [...document.querySelectorAll('.stat')].map((s) => s.querySelector('.stat__value').textContent.trim()));
    ok(JSON.stringify(cardsBefore.map((c) => c.v)) === JSON.stringify(cardsAfter), 'أرقام الإحصائيات لم تتغيّر بعد فتح الشرح');
    const pts = cardsBefore.find((c) => /نقاط التحفيز/.test(c.l));
    ok(pts && pts.v === '1790', `قيمة نقاط التحفيز كما هي (${pts && pts.v})`);

    // (6) الإغلاق
    await page.click('.stats-help__summary'); await page.waitForTimeout(200);
    open = await page.evaluate(() => document.querySelector('.stats-help').open);
    ok(open === false, 'يُغلق الشرح عند النقر مجددًا');

    ok(jsErrors.length === 0, 'لا أخطاء JavaScript' + (jsErrors.length ? ' :: ' + jsErrors.join(' | ') : ''));
    await page.close();
  } finally {
    await browser.close();
  }
  if (fails.length) { console.log(`\n❌ فشل: ${fails.length}`); process.exit(1); }
  console.log('\n✅ نجح اختبار صندوق شرح الإحصائيات والتسميات الجديدة.');
})().catch((e) => { console.error(e); process.exit(1); });
