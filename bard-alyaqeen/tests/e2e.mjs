/**
 * اختبارات الواجهة في متصفح حقيقي (Chromium عبر Playwright).
 * يفحص: التنقّل، والدرس، والاختبار، والمهام، والمراجعة، وإمكانية الوصول،
 * وعدم وجود تمرير أفقي أو قصّ على مقاسات الجوال والتابلت والحاسب.
 *
 * التشغيل:  node scripts/serve.mjs &   ثم   node tests/e2e.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8123';
const SIZES = [
  { name: 'جوال صغير', width: 320, height: 640 },
  { name: 'جوال', width: 390, height: 844 },
  { name: 'جوال كبير', width: 430, height: 932 },
  { name: 'تابلت', width: 768, height: 1024 },
  { name: 'حاسب', width: 1280, height: 900 },
];

let pass = 0, fail = 0;
const log = [];
async function check(name, fn) {
  try { await fn(); pass++; log.push(`✅ ${name}`); }
  catch (e) { fail++; log.push(`❌ ${name} — ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'فشل التحقّق'); }

// المتصفح المثبَّت في البيئة (بلا تنزيل إضافي)
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {});

/* ------------------------- المسار الكامل ------------------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  await check('الشاشة الافتتاحية تعرض الاسم والوصف والكتاب', async () => {
    assert(await page.locator('.hero__name').innerText() === 'بَرْدُ اليقين');
    const t = await page.locator('.hero__tagline').innerText();
    assert(t.includes('الحصانة الفكرية'), 'الوصف غير ظاهر');
    assert((await page.locator('text=الْمُهِمّ لِكُلِّ مُسْلِم').count()) > 0, 'اسم الكتاب غير ظاهر');
    assert((await page.locator('text=سلطان بن جابر الجعدبي الظفيري').count()) > 0, 'المؤلف غير ظاهر');
  });

  await check('اتجاه الصفحة من اليمين إلى اليسار', async () => {
    assert(await page.evaluate(() => document.documentElement.dir) === 'rtl');
    assert(await page.evaluate(() => getComputedStyle(document.body).direction) === 'rtl');
  });

  await check('التهيئة الأولية تعمل وتحفظ التفضيلات', async () => {
    await page.click('text=ابدأ الرحلة');
    await page.waitForSelector('text=تهيئة أولية');
    assert((await page.locator('.choice').count()) >= 6, 'خيارات التهيئة ناقصة');
    await page.locator('.choice', { hasText: 'عشر دقائق' }).click();
    await page.locator('.choice', { hasText: 'متوسّط' }).click();
    await page.click('text=ابدأ التعلّم');
    await page.waitForSelector('text=مسار الجزء الأول');
    await page.waitForTimeout(400);
    const detail = await page.evaluate(() => JSON.parse(localStorage.getItem('bay.state.v1')).prefs.detail);
    assert(detail === 'standard', 'لم تُحفظ التفضيلات');
  });

  await check('كل شاشة رئيسة تُعرض بلا رسالة خطأ', async () => {
    for (const r of ['/#/home', '/#/units', '/#/unit/u4', '/#/lesson/u4/u4l7',
      '/#/tasks', '/#/review', '/#/progress', '/#/bookmarks', '/#/search', '/#/settings']) {
      await page.goto(BASE + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(120);
      const txt = await page.locator('#view').innerText();
      assert(!txt.includes('تعذّر تحميل المحتوى'), `${r}: شاشة خطأ`);
      assert(txt.trim().length > 20, `${r}: شاشة فارغة`);
    }
    await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });
  });

  await check('الرئيسة تعرض الوحدات السبع والدرس التالي', async () => {
    assert(await page.locator('.unit-card').count() === 7, 'عدد الوحدات غير صحيح');
    const cta = (await page.locator('text=ابدأ الدرس').count())
      + (await page.locator('text=متابعة الدرس').count());
    assert(cta > 0, 'لا يوجد اقتراح للدرس التالي ولا متابعة');
  });

  await check('فتح وحدة يعرض النتائج التعليمية والدروس', async () => {
    await page.locator('.unit-card').first().click();
    await page.waitForSelector('text=المأمول أن يخرج الطالب من هذا الفصل بأمور');
    assert((await page.locator('text=الدرس ١').count()) > 0);
    assert((await page.locator('text=أسئلة تحصيلية').count()) > 0);
  });

  await check('شاشة الدرس تعرض المدخل والهدف والبطاقات والخلاصة', async () => {
    await page.locator('text=الدرس ١').click();
    await page.waitForSelector('.lesson-head__title');
    assert((await page.locator('text=مدخل — صياغة تعليمية مساعدة').count()) > 0, 'المدخل غير ظاهر');
    assert((await page.locator('text=هدف الدرس').count()) > 0, 'الهدف غير ظاهر');
    assert((await page.locator('.lesson-card').count()) > 0, 'لا بطاقات');
    assert((await page.locator('text=خلاصة الدرس').count()) > 0, 'الخلاصة غير ظاهرة');
    assert((await page.locator('.mode-switch__btn').count()) === 3, 'أنماط العرض الثلاثة ناقصة');
  });

  await check('النصّ الشرعي مميّز عن الصياغة التعليمية المساعدة', async () => {
    const dhikr = await page.locator('.narration').count();
    const aid = await page.locator('.aid, .chip--warn').count();
    assert(dhikr > 0, 'لا يوجد نصّ مميَّز');
    assert(aid > 0, 'لا تمييز للصياغة المساعدة');
  });

  await check('زر الاستماع معطّل للآيات مع بيان السبب', async () => {
    await page.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
    await page.waitForSelector('.quran');
    const card = page.locator('.lesson-card').filter({ has: page.locator('.quran') }).first();
    const btn = card.locator('button[disabled]');
    assert(await btn.count() > 0, 'زر الاستماع غير معطّل على الآية');
    const title = await btn.first().getAttribute('title');
    assert(title.includes('لا تُستخدم القراءة الآلية للقرآن'), 'سبب التعطيل غير مذكور');
  });

  await check('تغيير نمط العرض يغيّر عدد البطاقات', async () => {
    const deep = page.locator('.mode-switch__btn').nth(2);
    const brief = page.locator('.mode-switch__btn').nth(0);
    await deep.click();
    const nDeep = await page.locator('.lesson-card').count();
    await brief.click();
    const nBrief = await page.locator('.lesson-card').count();
    assert(nBrief < nDeep, `مختصر=${nBrief} متعمّق=${nDeep}`);
  });

  await check('التفاعل أثناء الدرس يعطي تغذية راجعة فورية', async () => {
    await page.locator('.mode-switch__btn').nth(1).click();
    const q = page.locator('.q').first();
    await q.scrollIntoViewIfNeeded();
    const opt = q.locator('.opt').first();
    if (await opt.count()) {
      await opt.click();
      await page.waitForSelector('.feedback', { timeout: 3000 });
      assert((await page.locator('.feedback').count()) > 0, 'لا تغذية راجعة');
    } else {
      // سؤال ترتيب أو مطابقة
      await q.locator('button', { hasText: 'تحقّق' }).first().click();
      await page.waitForSelector('.feedback', { timeout: 3000 });
    }
  });

  await check('الاختبار القصير يحتسب النتيجة ويحدّث التقدّم', async () => {
    await page.goto(BASE + '/#/quiz/u2/u2l0?mode=standard', { waitUntil: 'networkidle' });
    await page.waitForSelector('.opt');
    // نجيب إجابة صحيحة: نقرأ موضع الصحيح من الحالة المعروضة بعد المحاولة
    let guard = 0;
    while (guard++ < 12) {
      const opts = page.locator('.opt:not([disabled])');
      if (await opts.count() === 0) break;
      await opts.first().click();
      await page.waitForSelector('.feedback', { timeout: 3000 });
      const next = page.locator('button:not([disabled])', { hasText: /السؤال التالي|عرض النتيجة/ });
      if (await next.count() === 0) break;
      await next.first().click();
      if (await page.locator('text=إعادة المحاولة').count()) break;
    }
    await page.waitForSelector('text=إعادة المحاولة', { timeout: 5000 });
    await page.waitForTimeout(400);
    const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('bay.state.v1')).lessons['u2l0']);
    assert(rec && rec.quizAttempts >= 1, 'لم تُسجَّل محاولة الاختبار');
    assert(typeof rec.quizBest === 'number', 'لم تُحفظ الدرجة');
  });

  await check('الإجابة الخاطئة تُضاف إلى المراجعة المتباعدة', async () => {
    const n = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('bay.state.v1')).review).length);
    assert(n > 0, 'خطة المراجعة فارغة');
  });

  await check('المهام الأدائية تُسجَّل وتُلغى', async () => {
    await page.goto(BASE + '/#/tasks/u1', { waitUntil: 'networkidle' });
    await page.waitForSelector('.task__check');
    await page.locator('.task__check').first().click();
    await page.waitForTimeout(250);
    let done = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('bay.state.v1')).tasks).length);
    assert(done === 1, 'لم تُسجَّل المهمة');
    assert((await page.locator('.task--done').count()) === 1, 'لا تغيّر بصري');
    await page.locator('.task__check').first().click();
    await page.waitForTimeout(250);
    done = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('bay.state.v1')).tasks).length);
    assert(done === 0, 'لم يُلغَ التسجيل');
  });

  await check('البحث يجد النصوص بلا تشكيل', async () => {
    await page.goto(BASE + '/#/search', { waitUntil: 'networkidle' });
    await page.fill('input[type="search"]', 'اية الكرسي');
    await page.waitForTimeout(350);
    assert((await page.locator('#view .card').count()) > 0, 'لا نتائج');
  });

  await check('المفضلة تُضاف وتظهر', async () => {
    await page.goto(BASE + '/#/lesson/u1/u1l4', { waitUntil: 'networkidle' });
    await page.locator('button[aria-label="إضافة إلى المفضلة"]').click();
    await page.goto(BASE + '/#/bookmarks', { waitUntil: 'networkidle' });
    assert((await page.locator('text=آية الكرسي').count()) > 0, 'المفضلة فارغة');
  });

  await check('صفحة الإنجاز تعرض التقدّم والشارات', async () => {
    await page.goto(BASE + '/#/progress', { waitUntil: 'networkidle' });
    assert((await page.locator('.badge').count()) >= 7, 'الشارات ناقصة');
    assert((await page.locator('.progress').count()) > 0, 'لا شريط تقدّم');
  });

  await check('المراجعة الذكية تعمل أو تعرض حالة فارغة مفهومة', async () => {
    await page.goto(BASE + '/#/review', { waitUntil: 'networkidle' });
    const hasQ = await page.locator('.q').count();
    const hasEmpty = await page.locator('.empty').count();
    assert(hasQ > 0 || hasEmpty > 0, 'شاشة المراجعة فارغة تمامًا');
  });

  await check('الإعدادات تغيّر وضع القراءة المريح فورًا', async () => {
    await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
    await page.locator('.switch').first().check();
    await page.waitForTimeout(200);
    const mode = await page.evaluate(() => document.documentElement.dataset.reading);
    assert(mode === 'comfort', 'وضع القراءة لم يُطبَّق');
    await page.locator('.switch').first().uncheck();
  });

  await check('تصدير النسخة الاحتياطية يُنتج ملفًا', async () => {
    await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.click('text=تصدير نسخة احتياطية'),
    ]);
    assert(dl.suggestedFilename().endsWith('.json'), 'اسم الملف غير صحيح');
  });

  await check('التقدّم يبقى بعد إعادة تحميل الصفحة', async () => {
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bay.state.v1')).lessons);
    await page.reload({ waitUntil: 'networkidle' });
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('bay.state.v1')).lessons);
    assert(JSON.stringify(before) === JSON.stringify(after), 'ضاع التقدّم');
  });

  await check('لوحة المراجعة: العرض والتصفية الرباعية', async () => {
    await page.goto(BASE + '/admin/index.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('.rv', { timeout: 8000 });
    assert((await page.locator('#rv-count').innerText()).includes('٢٦٠'), 'العدّاد لا يعرض ٢٦٠');
    for (const [sel, val, expect] of [
      ['select[aria-label="الأولوية"]', 'high', '٢٤'],
      ['select[aria-label="الوحدة"]', 'u2', null],
      ['select[aria-label="نوع العنصر"]', 'hook', null],
      ['select[aria-label="حالة الاعتماد"]', 'pending', null],
    ]) {
      await page.click('text=إعادة ضبط التصفية');
      await page.waitForTimeout(180);
      await page.selectOption(sel, val);
      await page.waitForTimeout(280);
      const n = await page.locator('#rv-count').innerText();
      assert(/[٠-٩]/.test(n), `${sel}: لا عدّاد`);
      if (expect) assert(n.includes(expect), `${sel}: توقّعت ${expect} فوجدت ${n}`);
    }
  });

  await check('لوحة المراجعة: البحث يبرز المطابقات', async () => {
    await page.click('text=إعادة ضبط التصفية');
    await page.fill('input[type="search"]', 'الوضوء');
    await page.waitForTimeout(450);
    assert((await page.locator('mark.hit').count()) > 0, 'لا إبراز للمطابقات');
  });

  await check('لوحة المراجعة: نصّ الكتاب المرجعي ورابط الانتقال', async () => {
    await page.click('text=إعادة ضبط التصفية');
    await page.waitForTimeout(300);
    assert((await page.locator('.rv__anchor').count()) > 0, 'لا يظهر نصّ الكتاب المرجعي');
    const link = page.locator('a:has-text("موضعه في البرنامج")').first();
    assert(await link.count() > 0, 'لا رابط انتقال');
    assert((await link.getAttribute('href')).includes('#/lesson/'), 'الرابط لا يشير إلى درس');
  });

  await check('لوحة المراجعة: التحرير والملاحظة والاعتماد تُحفظ', async () => {
    await page.click('text=إعادة ضبط التصفية');
    await page.waitForTimeout(300);
    const card = page.locator('.rv').first();
    await card.locator('text=تحرير النصّ').click();
    await card.locator('textarea.rv__edit').fill('نصّ اختبار');
    await card.locator('textarea[aria-label="ملاحظة المراجع"]').fill('ملاحظة اختبار');
    await card.locator('text=✓ معتمَد').click();
    await page.waitForTimeout(350);
    const saved = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('bay.review.v2') || '{}');
      return Object.values(d)[0];
    });
    assert(saved && saved.status === 'approved', 'لم تُحفظ حالة الاعتماد');
    assert(saved.note === 'ملاحظة اختبار', 'لم تُحفظ الملاحظة');
    assert(saved.edited === 'نصّ اختبار', 'لم يُحفظ النصّ المحرَّر');
    await page.evaluate(() => localStorage.removeItem('bay.review.v2'));
  });

  await check('لوحة المراجعة: التصدير يُنتج ملفًا بكل الأعمدة', async () => {
    await page.goto(BASE + '/admin/index.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('.rv');
    await page.click('text=التصدير');
    await page.waitForTimeout(250);
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      page.click('text=⬇ تصدير CSV (كل العناصر)'),
    ]);
    const p2 = await dl.path();
    const txt = fs.readFileSync(p2, 'utf8');
    const head = txt.split('\r\n')[0];
    for (const col of ['م', 'الوحدة', 'الدرس', 'نوع العنصر', 'النص', 'المصدر', 'صفحة الكتاب',
      'سبب الحاجة إلى المراجعة', 'الأولوية', 'حالة الاعتماد', 'الملاحظات']) {
      assert(head.includes(col), `عمود ناقص: ${col}`);
    }
    assert(txt.split('\r\n').length - 1 >= 260, 'عدد الصفوف أقل من ٢٦٠');
  });

  await check('لوحة المراجعة: خريطة المحتوى تعرض الوحدات السبع', async () => {
    await page.click('text=خريطة المحتوى');
    await page.waitForSelector('.tbl');
    assert((await page.locator('.tbl').count()) === 7, 'خريطة المحتوى ناقصة');
  });

  await check('التنقّل بلوحة المفاتيح يصل إلى رابط التخطّي', async () => {
    await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement.className);
    assert(focused.includes('skip-link'), `العنصر المركَّز: ${focused}`);
  });

  await check('لا أخطاء ولا موارد مفقودة', async () => {
    const real = errors.filter((e) => !/favicon\.ico/i.test(e));
    assert(real.length === 0, real.slice(0, 3).join(' | '));
  });

  await ctx.close();
}

/* --------------------- التجاوب مع أحجام الشاشات --------------------- */
const ROUTES = ['/', '/#/home', '/#/units', '/#/unit/u1', '/#/lesson/u1/u1l3',
  '/#/quiz/u1/u1l3', '/#/tasks', '/#/review', '/#/progress', '/#/search', '/#/settings'];

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, locale: 'ar' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bay.state.v1') || '{}');
    s.onboarded = true; localStorage.setItem('bay.state.v1', JSON.stringify(s));
  });

  await check(`${size.name} (${size.width}px): لا تمرير أفقي في أي شاشة`, async () => {
    for (const r of ROUTES) {
      await page.goto(BASE + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(120);
      const over = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(over <= 1, `${r}: زيادة ${over}px`);
    }
  });

  await check(`${size.name}: لا عنصر يتجاوز عرض الشاشة`, async () => {
    await page.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    const bad = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const out = [];
      for (const el of document.querySelectorAll('#view *')) {
        const r = el.getBoundingClientRect();
        if (r.width > vw + 1 || r.right > vw + 1 || r.left < -1) {
          if (getComputedStyle(el.parentElement || el).overflowX === 'auto') continue;
          out.push(el.tagName + '.' + (el.className || '').toString().slice(0, 40));
        }
      }
      return out.slice(0, 4);
    });
    assert(bad.length === 0, bad.join(', '));
  });

  await check(`${size.name}: أزرار التنقّل بمساحة لمس كافية (≥44px)`, async () => {
    await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });
    const small = await page.evaluate(() => {
      const out = [];
      for (const b of document.querySelectorAll('.tabbar__btn, .btn--primary, .btn--accent, .opt')) {
        const r = b.getBoundingClientRect();
        if (r.height > 0 && r.height < 44) out.push(b.className + ':' + Math.round(r.height));
      }
      return out.slice(0, 3);
    });
    assert(small.length === 0, small.join(', '));
  });

  await ctx.close();
}

/* ------------------------- إمكانية الوصول ------------------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });

  await check('كل زر أيقوني له وصف نصّي لقارئ الشاشة', async () => {
    const bad = await page.evaluate(() => {
      const out = [];
      for (const b of document.querySelectorAll('button')) {
        const txt = (b.innerText || '').trim();
        if (!txt && !b.getAttribute('aria-label') && !b.getAttribute('title')) {
          out.push(b.className || b.outerHTML.slice(0, 50));
        }
      }
      return out.slice(0, 4);
    });
    assert(bad.length === 0, bad.join(', '));
  });

  await check('أشرطة التقدّم معلَّمة لقارئ الشاشة', async () => {
    const ok = await page.evaluate(() =>
      [...document.querySelectorAll('.progress')].every((p) =>
        p.getAttribute('role') === 'progressbar' && p.hasAttribute('aria-valuenow')));
    assert(ok, 'شريط تقدّم بلا role/aria');
  });

  await check('الوضع الداكن يُطبَّق ويغيّر ألوان الخلفية', async () => {
    await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
    await page.selectOption('select[aria-label="السِّمة"]', 'dark');
    await page.waitForTimeout(200);
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    assert(theme === 'dark', 'لم تُطبَّق السِّمة الداكنة');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert(bg !== 'rgb(251, 248, 241)', 'الخلفية لم تتغيّر');
    await page.selectOption('select[aria-label="السِّمة"]', 'system');
  });

  await check('وضع القراءة المريح يكبّر النصّ فعليًّا ويبقى بعد إعادة التحميل', async () => {
    await page.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const before = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector('.book-text, .quran')).fontSize));
    await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
    await page.locator('.switch').first().check();
    await page.waitForTimeout(350);
    await page.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const after = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector('.book-text, .quran')).fontSize));
    assert(after > before, `${before} → ${after}`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const kept = await page.evaluate(() => document.documentElement.dataset.reading);
    assert(kept === 'comfort', 'لم يبقَ الإعداد بعد إعادة التحميل');
    await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
    await page.locator('.switch').first().uncheck();
    await page.waitForTimeout(300);
  });

  await ctx.close();
}

/* ------------------- تباين الألوان في السِّمتين ------------------- */
const CONTRAST_ROUTES = ['/#/home', '/#/lesson/u1/u1l3', '/#/lesson/u1/u1l4',
  '/#/quiz/u1/u1l3', '/#/tasks', '/#/progress', '/#/settings'];

/** نسبة التباين بحسب WCAG. */
const CONTRAST_FN = `(() => {
  const lum = (c) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * r + .7152 * g + .0722 * b;
  };
  const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const bgOf = (el) => {
    let e = el;
    while (e) {
      const c = getComputedStyle(e).backgroundColor;
      const a = (c.match(/[\d.]+/g) || [])[3];
      if (c && c !== 'rgba(0, 0, 0, 0)' && a !== '0') return parse(c);
      e = e.parentElement;
    }
    return [255, 255, 255];
  };
  const out = [];
  const sel = '.quran, .book-text, .narration, .deflist__def, .deflist__term, .aid, .aid__tag, ' +
    '.chip, .feedback, .opt, .muted, .small, .task__text, .badge__desc, p, h1, h2, h3, li, .btn';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.opacity === '0') continue;
    if (!el.textContent.trim()) continue;
    const fg = parse(st.color), bg = bgOf(el);
    const l1 = lum(fg), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
    const size = parseFloat(st.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(st.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) out.push(el.className.toString().slice(0, 40) + ' ratio=' + ratio.toFixed(2) + ' need=' + need);
  }
  return [...new Set(out)].slice(0, 5);
})()`;

for (const [label, opts] of [
  ['السِّمة الفاتحة', { colorScheme: 'light' }],
  ['السِّمة الداكنة (من النظام)', { colorScheme: 'dark' }],
]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'ar', ...opts });
  const page = await ctx.newPage();
  // فحص محدود لعناصر النصّ الأساسية (انحدار). الفحص الشامل لكل عنصر ظاهر
  // في كل الشاشات موجود في tests/visual-audit.mjs، وقد كشف عيوبًا مذكورة في docs/DEFECTS.md.
  await check(`${label}: تباين عناصر النصّ الأساسية (فحص انحدار محدود)`, async () => {
    for (const r of CONTRAST_ROUTES) {
      await page.goto(BASE + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      const bad = await page.evaluate(CONTRAST_FN);
      assert(bad.length === 0, `${r}: ${bad.join(' | ')}`);
    }
  });
  await ctx.close();
}

/* --------------------------- العمل دون اتصال --------------------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
  // ننتظر اكتمال تخزين ملفات المحتوى
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    for (const k of keys) {
      const c = await caches.open(k);
      if (await c.match('/content/units/u7.json')) return true;
    }
    return false;
  }, null, { timeout: 15000 });

  await check('عامل الخدمة مسجَّل', async () => {
    const reg = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return !!r;
    });
    assert(reg, 'لم يُسجَّل عامل الخدمة');
  });

  await check('البرنامج يعمل دون اتصال', async () => {
    await ctx.setOffline(true);
    await page.goto(BASE + '/index.html#/units', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.unit-card', { timeout: 8000 });
    assert((await page.locator('.unit-card').count()) === 7, 'الوحدات لم تُحمَّل دون اتصال');
    await ctx.setOffline(false);
  });

  await ctx.close();
}

await browser.close();

console.log(log.join('\n'));
console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل.`);
process.exit(fail ? 1 : 0);
