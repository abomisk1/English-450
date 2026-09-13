/** التقاط صور الشاشات على الجوال والحاسب. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8123';
const OUT = path.resolve('docs/screenshots');
fs.mkdirSync(OUT, { recursive: true });

const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {});

/** حالة تقدّم واقعية لتظهر الشاشات بمحتوى حقيقي. */
const SEED = {
  version: 1, createdAt: Date.now(), updatedAt: Date.now(), onboarded: true,
  prefs: { sessionLength: 'standard', detail: 'standard', largeText: false, audio: false,
    highContrast: false, theme: 'system', familyMode: true, reduceMotion: false, fontScale: 1 },
  lessons: {
    u1l1: { seen: true, quizBest: 100, quizAttempts: 1, completedAt: Date.now() - 3e8 },
    u1l2: { seen: true, quizBest: 100, quizAttempts: 1, completedAt: Date.now() - 2e8 },
    u1l3: { seen: true, quizBest: 80, quizAttempts: 2, completedAt: Date.now() - 1e8 },
    u1l4: { seen: true, quizBest: 60, quizAttempts: 1, completedAt: null },
    u2l0: { seen: true, quizBest: 100, quizAttempts: 1, completedAt: Date.now() - 5e7 },
  },
  tasks: { 'u1/t1': { doneAt: Date.now() - 1e8 }, 'u1/t3': { doneAt: Date.now() - 2e7 } },
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
  ],
  badges: { 'first-lesson': Date.now(), mastery: Date.now(), 'task-done': Date.now() },
  lastPosition: { unitId: 'u1', lessonId: 'u1l4', lessonTitle: 'آية الكرسي' },
  streak: { count: 4, lastDay: new Date().setHours(0, 0, 0, 0), best: 6 },
  stats: { lessonsCompleted: 4, quizPassed: 4, tasksDone: 2, reviewsDone: 7, reviewDays: 3 },
};

const SHOTS = [
  ['01-splash', '/', 'الشاشة الافتتاحية', true],
  ['02-setup', '/#/setup', 'التهيئة الأولية', true],
  ['03-home', '/#/home', 'الصفحة الرئيسة ومسار التعلّم'],
  ['04-units', '/#/units', 'صفحة الوحدات'],
  ['05-unit', '/#/unit/u1', 'وحدة: تفسير ما يتكرر'],
  ['06-lesson', '/#/lesson/u1/u1l3', 'شاشة الدرس التفاعلي (سورة الفاتحة)'],
  ['07-lesson-fiqh', '/#/lesson/u4/u4l7', 'درس: واجبات الصلاة'],
  ['08-quiz', '/#/quiz/u1/u1l3', 'شاشة الاختبار والتغذية الراجعة'],
  ['09-tasks', '/#/tasks', 'المهام الأدائية'],
  ['10-review', '/#/review', 'المراجعة الذكية'],
  ['11-progress', '/#/progress', 'الإنجاز والتقدّم'],
  ['12-bookmarks', '/#/bookmarks', 'المفضلة والعلامات المرجعية'],
  ['13-search', '/#/search', 'البحث داخل المحتوى'],
  ['14-settings', '/#/settings', 'الإعدادات وإمكانية الوصول'],
  ['15-admin', '/admin/index.html', 'لوحة إدارة المحتوى والمراجعة الشرعية'],
];

async function shoot(device, viewport, prefix, extra = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'ar', deviceScaleFactor: 1, ...extra });
  // نزرع الحالة قبل تنفيذ أي شفرة في الصفحة، حتى لا يكتبها الحفظ التلقائي للصفحة السابقة.
  await ctx.addInitScript((seed) => {
    try { localStorage.setItem('bay.state.v1', JSON.stringify(seed)); } catch (_) {}
  }, SEED);
  const page = await ctx.newPage();

  for (const [name, route, , fresh] of SHOTS) {
    if (fresh) {
      await ctx.addInitScript(() => {
        try {
          const s = JSON.parse(localStorage.getItem('bay.state.v1') || '{}');
          s.onboarded = false; localStorage.setItem('bay.state.v1', JSON.stringify(s));
        } catch (_) {}
      });
    }
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    if (route.includes('/quiz/')) {
      const opt = page.locator('.opt').first();
      if (await opt.count()) { await opt.click(); await page.waitForTimeout(400); }
    }
    if (route.includes('/search')) {
      await page.fill('input[type="search"]', 'الوضوء');
      await page.waitForTimeout(450);
    }
    await page.screenshot({ path: path.join(OUT, `${prefix}-${name}.png`), fullPage: true });
    if (['03-home', '06-lesson', '09-tasks'].includes(name)) {
      await page.screenshot({ path: path.join(OUT, `${prefix}-${name}-viewport.png`) });
    }
  }
  await ctx.close();
}

await shoot('mobile', { width: 390, height: 844 }, 'mobile');
await shoot('desktop', { width: 1280, height: 900 }, 'desktop');

// لقطة للوضع الداكن ووضع القراءة المريح على الجوال
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, locale: 'ar', deviceScaleFactor: 1,
    colorScheme: 'dark',
  });
  await ctx.addInitScript((seed) => {
    try {
      localStorage.setItem('bay.state.v1',
        JSON.stringify({ ...seed, prefs: { ...seed.prefs, theme: 'dark' } }));
    } catch (_) {}
  }, SEED);
  const page = await ctx.newPage();
  await page.goto(BASE + '/#/lesson/u1/u1l4', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'mobile-16-dark-lesson.png'), fullPage: true });

  await ctx.addInitScript((seed) => {
    try {
      localStorage.setItem('bay.state.v1', JSON.stringify({ ...seed,
        prefs: { ...seed.prefs, theme: 'light', largeText: true, fontScale: 1.2 } }));
    } catch (_) {}
  }, SEED);
  await page.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'mobile-17-large-text.png'), fullPage: true });
  await ctx.close();
}

await browser.close();
const files = fs.readdirSync(OUT).sort();
console.log(`تم التقاط ${files.length} صورة في docs/screenshots:`);
console.log(files.join('\n'));
