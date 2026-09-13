/**
 * الدليل البصري — يلتقط الشاشات الأربع عشرة المطلوبة للمراجعة،
 * على الجوال (٣٩٠×٨٤٤) والحاسب (١٢٨٠×٩٠٠).
 *
 * لكل شاشة صورتان:
 *   *-full.png      الصفحة كاملة (للاطّلاع على كل المحتوى)
 *   *.png           بمقاس الشاشة (لرؤية الشريط العلوي والسفلي في موضعهما الحقيقي)
 *
 * التشغيل:  node scripts/serve.mjs &  ثم  node tests/screenshots.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8123';
const OUT = path.resolve('docs/screenshots');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(EXEC) ? EXEC : undefined });

/** حالة تقدّم واقعية لتظهر الشاشات بمحتوى حيّ لا فارغ. */
const SEED = {
  version: 1, createdAt: Date.now(), updatedAt: Date.now(), onboarded: true,
  prefs: { largeText: false, audio: false,
    highContrast: false, theme: 'system', reduceMotion: false, fontScale: 1 },
  lessons: {
    u1l1: { seen: true, quizBest: 100, quizAttempts: 1, completedAt: Date.now() - 4e8 },
    u1l2: { seen: true, quizBest: 100, quizAttempts: 1, completedAt: Date.now() - 3e8 },
    u1l3: { seen: true, quizBest: 80, quizAttempts: 2, completedAt: Date.now() - 2e8 },
    u1l4: { seen: true, quizBest: 60, quizAttempts: 1, completedAt: null },
    u2l0: { seen: true, quizBest: 100, quizAttempts: 1, completedAt: Date.now() - 1e8 },
    u2l1: { seen: true, quizBest: 100, quizAttempts: 1, completedAt: Date.now() - 5e7 },
  },
  tasks: { 'u1/t1': { doneAt: Date.now() - 2e8 }, 'u1/t3': { doneAt: Date.now() - 4e7 },
    'u2/t2': { doneAt: Date.now() - 2e7 } },
  review: {
    'u1/u1l4/q2': { ease: 2.5, interval: 0, due: Date.now() - 1000, reps: 1, lapses: 1, step: 0 },
    'u1/u1l3/q5': { ease: 2.5, interval: 0, due: Date.now() - 2000, reps: 1, lapses: 1, step: 0 },
    'u1/u1l1/q1': { ease: 2.6, interval: 3, due: Date.now() + 2e8, reps: 3, lapses: 0, step: 3 },
  },
  bookmarks: [{ type: 'lesson', id: 'u1l4', label: 'آية الكرسي', unitId: 'u1', at: Date.now() }],
  activity: [
    { at: Date.now() - 1e7, kind: 'quiz', ref: { percent: 100 } },
    { at: Date.now() - 2e7, kind: 'task', ref: {} },
    { at: Date.now() - 3e7, kind: 'lesson-complete', ref: {} },
    { at: Date.now() - 5e7, kind: 'review', ref: { count: 4, percent: 75 } },
  ],
  badges: { 'first-lesson': Date.now(), mastery: Date.now(), 'task-done': Date.now() },
  lastPosition: { unitId: 'u1', lessonId: 'u1l4', lessonTitle: 'آية الكرسي' },
  streak: { count: 5, lastDay: new Date().setHours(0, 0, 0, 0), best: 7 },
  stats: { lessonsCompleted: 5, quizPassed: 5, tasksDone: 3, reviewsDone: 9, reviewDays: 3 },
};

/**
 * الشاشات الأربع عشرة المطلوبة.
 * prep: خطوات تُنفَّذ قبل الالتقاط · scroll: عنصر يُمرَّر إليه · prefs: تعديل تفضيلات
 */
const SHOTS = [
  { id: '01-splash', title: 'الصفحة الافتتاحية', route: '/', fresh: true },
  { id: '02-setup', title: 'التهيئة الأولى: حجم الخطّ بمعاينة حيّة وتيسير العرض',
    route: '/#/setup', fresh: true,
    prep: async (p) => {
      await p.locator('input[type="range"][aria-label="حجم الخطّ"]').fill('1.2');
      await p.waitForTimeout(150);
    } },
  { id: '03-home', title: 'الصفحة الرئيسة ومسار التعلّم', route: '/#/home' },
  { id: '04-units', title: 'قائمة الوحدات السبع', route: '/#/units' },
  { id: '05-lesson-quran', title: 'درس يحتوي على آية قرآنية (آية الكرسي)', route: '/#/lesson/u1/u1l4',
    scroll: '.quran' },
  { id: '06-lesson-fiqh', title: 'درس فقهي (واجبات الصلاة والفرق بين الركن والواجب)',
    route: '/#/lesson/u4/u4l7', scroll: '.deflist' },
  { id: '07-activity', title: 'نشاط تفاعلي (مطابقة + ترتيب) مع التغذية الراجعة',
    route: '/#/lesson/u4/u4l7',
    prep: async (p) => {
      const q = p.locator('.q').first();
      await q.scrollIntoViewIfNeeded();
      const sels = q.locator('select');
      const n = await sels.count();
      if (n) {
        // نملأ المطابقة إجابةً صحيحة ثم نتحقّق
        const pairs = [['الركوع', 'سُبْحَانَ رَبِّيَ الْعَظِيمِ'],
          ['السجود', 'سُبْحَانَ رَبِّيَ الْأَعْلَى'],
          ['بين السجدتين', 'رَبِّ اغْفِرْ لِي']];
        for (let i = 0; i < n; i++) {
          const label = await q.locator('.match__term').nth(i).innerText();
          const want = (pairs.find((x) => label.includes(x[0])) || [])[1];
          if (want) await sels.nth(i).selectOption({ label: want });
        }
        await q.locator('button', { hasText: 'تحقّق' }).click();
      } else {
        await q.locator('.opt').first().click();
      }
      await p.waitForTimeout(400);
    },
    scroll: '.feedback' },
  { id: '08-quiz', title: 'اختبار مع التغذية الراجعة الفورية', route: '/#/quiz/u1/u1l3',
    prep: async (p) => {
      await p.waitForSelector('.opt');
      await p.locator('.opt').first().click();
      await p.waitForSelector('.feedback');
      await p.waitForTimeout(300);
    } },
  { id: '09-tasks', title: 'المهام الأدائية', route: '/#/tasks' },
  { id: '10-progress', title: 'صفحة التقدّم والإنجاز', route: '/#/progress' },
  { id: '11-large-text', title: 'وضع الخط الكبير (قراءة مريحة لكبار السن)',
    route: '/#/lesson/u1/u1l3',
    prefs: { largeText: true, fontScale: 1.2 }, scroll: '.quran' },
  { id: '12-dark', title: 'الوضع الداكن', route: '/#/lesson/u1/u1l4',
    prefs: { theme: 'dark' }, colorScheme: 'dark', scroll: '.quran' },
  { id: '13-admin', title: 'لوحة مراجعة المحتوى', route: '/admin/index.html', raw: true },
  { id: '14-review-filtered', title: 'لوحة المراجعة — تصفية بالأولوية العالية',
    route: '/admin/index.html', raw: true,
    prep: async (p) => {
      await p.waitForSelector('.rv');
      await p.selectOption('select[aria-label="الأولوية"]', 'high');
      await p.waitForTimeout(500);
    } },
];

const EXTRA = [
  { id: 'x1-unit', title: 'صفحة وحدة (تفسير ما يتكرر)', route: '/#/unit/u1' },
  { id: 'x2-review', title: 'المراجعة الذكية', route: '/#/review' },
  { id: 'x3-search', title: 'البحث داخل المحتوى', route: '/#/search',
    prep: async (p) => { await p.fill('input[type="search"]', 'الوضوء'); await p.waitForTimeout(450); } },
  { id: 'x4-settings', title: 'الإعدادات وإمكانية الوصول', route: '/#/settings' },
  { id: 'x5-adhkar', title: 'درس الأذكار (أذكار الصباح)', route: '/#/lesson/u5/u5l1' },
  { id: 'x6-family', title: 'النشاط الأسري داخل الدرس (بلا إعداد يفعّله)',
    route: '/#/lesson/u1/u1l3', scroll: '.card[style*="soft-brand"]' },
  { id: 'x7-paths', title: 'مسارا الدرس بعد إتمامه: تعلّم الدرس / مراجعة سريعة',
    route: '/#/lesson/u1/u1l3', scroll: '.mode-switch' },
  { id: 'x8-review-path', title: 'مسار «مراجعة سريعة»: خلاصة وبطاقات تذكّر ونصوص الكتاب',
    route: '/#/lesson/u1/u1l3?path=review' },
  { id: 'x9-classify', title: 'نشاط التصنيف (تفاعل مضاف مستمدّ من نصّ الدرس)',
    route: '/#/lesson/u5/u5l14', scroll: '.q .match' },
  { id: 'x10-audio-note', title: 'سبب تعطيل الاستماع للآيات ظاهرًا في الواجهة',
    route: '/#/lesson/u1/u1l4', scroll: '.audio-note' },
  { id: 'x11-family-home', title: 'قسم «دروس مناسبة للأسرة» في الصفحة الرئيسة',
    route: '/#/home', scroll: 'text=دروس مناسبة للأسرة' },
];

const manifest = [];

async function capture(device, viewport, shots) {
  for (const s of shots) {
    const seed = JSON.parse(JSON.stringify(SEED));
    if (s.prefs) Object.assign(seed.prefs, s.prefs);
    if (s.fresh) seed.onboarded = false;

    const ctx = await browser.newContext({
      viewport, locale: 'ar', deviceScaleFactor: 1,
      colorScheme: s.colorScheme || 'light',
    });
    await ctx.addInitScript((st) => {
      try { localStorage.setItem('bay.state.v1', JSON.stringify(st)); } catch (_) {}
    }, seed);
    const page = await ctx.newPage();
    await page.goto(BASE + s.route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(650);
    if (s.prep) { try { await s.prep(page); } catch (e) { console.warn(' تعذّر التحضير:', s.id, e.message); } }
    if (s.scroll) {
      try { await page.locator(s.scroll).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(350); }
      catch (_) {}
    }
    const base = `${device}-${s.id}`;
    await page.screenshot({ path: path.join(OUT, `${base}.png`) });
    await page.screenshot({ path: path.join(OUT, `${base}-full.png`), fullPage: true });
    manifest.push({ device, id: s.id, title: s.title, route: s.route,
      files: [`${base}.png`, `${base}-full.png`] });
    await ctx.close();
  }
}

console.log('› الجوال ٣٩٠×٨٤٤ …');
await capture('mobile', { width: 390, height: 844 }, [...SHOTS, ...EXTRA]);
console.log('› الحاسب ١٢٨٠×٩٠٠ …');
await capture('desktop', { width: 1280, height: 900 }, [...SHOTS, ...EXTRA]);

// لقطة مقارنة: نفس الدرس على ثلاثة مقاسات
console.log('› مقارنة المقاسات …');
for (const [name, w, h] of [['320', 320, 640], ['768', 768, 1024], ['1920', 1920, 1080]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ar', deviceScaleFactor: 1 });
  await ctx.addInitScript((st) => {
    try { localStorage.setItem('bay.state.v1', JSON.stringify(st)); } catch (_) {}
  }, SEED);
  const page = await ctx.newPage();
  await page.goto(BASE + '/#/lesson/u1/u1l4', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `size-${name}-lesson.png`) });
  await ctx.close();
}

await browser.close();

fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(manifest, null, 1));
const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.png'));
console.log(`\nالتُقطت ${files.length} صورة في docs/screenshots/`);
