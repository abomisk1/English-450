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

  await check('التهيئة الأولية فيها خيار الخط الكبير وتحفظ التفضيلات', async () => {
    await page.click('text=ابدأ الرحلة');
    await page.waitForSelector('text=تهيئة أولية');
    // ع-٦: خيار حجم الخطّ صار ضمن التهيئة الأولى، بمعاينة حيّة.
    const slider = page.locator('input[type="range"][aria-label="حجم الخطّ"]');
    assert(await slider.count() === 1, 'لا خيار لحجم الخطّ في التهيئة');
    assert((await page.locator('#setup-sample').count()) === 1, 'لا معاينة للنصّ');
    await slider.fill('1.3');
    await page.waitForTimeout(120);
    const live = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-scale').trim());
    assert(live === '1.3', `المعاينة الحيّة لا تعمل: ${live}`);
    await page.locator('.switch-row', { hasText: 'وضع قراءة مريح' }).locator('input').check();
    await page.click('text=ابدأ التعلّم');
    await page.waitForSelector('text=مسار الجزء الأول');
    await page.waitForTimeout(400);
    const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('bay.state.v1')).prefs);
    assert(prefs.fontScale === 1.3, `لم يُحفظ حجم الخطّ: ${prefs.fontScale}`);
    assert(prefs.largeText === true, 'لم يُحفظ وضع القراءة المريح');
    // التفضيلات الملغاة لا تعود
    assert(!('detail' in prefs) && !('sessionLength' in prefs) && !('familyMode' in prefs),
      'تفضيلات أنماط العرض ما زالت محفوظة');
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
    // درس لم يُتمّ بعدُ: لا يظهر فيه مبدّل المسار، فلا تُعرض «المراجعة السريعة» بديلًا عن الدراسة.
    assert((await page.locator('.mode-switch__btn:visible').count()) === 0,
      'مبدّل المسار ظاهر قبل إتمام الدرس');
    // ع-٥: صياغة العدد
    const quizLine = await page.locator('text=/وتغذية راجعة فورية/').first().innerText();
    assert(!/^١ أسئلة|\s١ أسئلة/.test(quizLine), `صياغة عدد خاطئة: ${quizLine}`);
  });

  await check('النصّ الشرعي مميّز عن الصياغة التعليمية المساعدة', async () => {
    const dhikr = await page.locator('.narration').count();
    const aid = await page.locator('.aid, .chip--warn').count();
    assert(dhikr > 0, 'لا يوجد نصّ مميَّز');
    assert(aid > 0, 'لا تمييز للصياغة المساعدة');
  });

  await check('زر الاستماع معطّل للآيات وسببه ظاهر في الواجهة لا في title وحده', async () => {
    await page.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
    await page.waitForSelector('.quran');
    const card = page.locator('.lesson-card').filter({ has: page.locator('.quran') }).first();
    const btn = card.locator('button[disabled]');
    assert(await btn.count() > 0, 'زر الاستماع غير معطّل على الآية');
    // ع-٦: السبب مكتوب ومرئي داخل البطاقة (الجوال لا يُظهر title عند اللمس).
    const reason = card.locator('.audio-note');
    assert(await reason.count() > 0, 'سبب التعطيل غير ظاهر في الواجهة');
    assert(await reason.first().isVisible(), 'سبب التعطيل مخفي');
    const txt = await reason.first().innerText();
    assert(txt.includes('لا تُستخدم القراءة الآلية للقرآن'), `نصّ السبب ناقص: ${txt}`);
  });

  // حالة مبذورة في سياق مستقلّ: الحفظ التلقائي في الصفحة الحيّة يطمس أي كتابة مباشرة.
  const doneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar' });
  await doneCtx.addInitScript((st) => {
    try { localStorage.setItem('bay.state.v1', JSON.stringify(st)); } catch (_) {}
  }, {
    version: 1, createdAt: 1, updatedAt: 1, onboarded: true,
    prefs: { largeText: false, audio: false, highContrast: false, theme: 'system', fontScale: 1, reduceMotion: false },
    lessons: { u1l3: { seen: true, quizBest: 100, quizAttempts: 1, completedAt: 1 } },
    tasks: {}, review: {}, bookmarks: [], activity: [], badges: {},
    lastPosition: null, streak: { count: 1, lastDay: null, best: 1 }, stats: {},
  });
  const donePage = await doneCtx.newPage();

  await check('المسار الثاني «مراجعة سريعة» يُتاح بعد إتمام الدرس فقط', async () => {
    // قبل الإتمام: لا مبدّل مسار (تحقّق سابق على درس آخر)
    await donePage.goto(BASE + '/#/lesson/u1/u1l1', { waitUntil: 'networkidle' });
    await donePage.waitForTimeout(200);
    assert((await donePage.locator('.mode-switch__btn:visible').count()) === 0,
      'مبدّل المسار ظاهر على درس لم يُتمّ');

    await donePage.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
    await donePage.waitForTimeout(200);
    const btns = donePage.locator('.mode-switch__btn');
    assert(await btns.count() === 2, `المساران اثنان لا ${await btns.count()}`);
    const labels = await btns.allInnerTexts();
    assert(labels[0].includes('تعلّم الدرس') && labels[1].includes('مراجعة سريعة'), labels.join(' | '));
    // لا وعود زمنية ثابتة: الزمن تقريبي ومحسوب من محتوى الدرس
    assert(labels.every((t) => t.includes('نحو')), `صيغة الزمن غير تقريبية: ${labels.join(' | ')}`);
    assert(!labels.some((t) => /١٨د|١٠د|٥د/.test(t)), `وعد زمني ثابت: ${labels.join(' | ')}`);

    const nLearn = await donePage.locator('.lesson-card').count();
    await btns.nth(1).click();
    await donePage.waitForTimeout(250);
    assert((await donePage.locator('text=خلاصة الدرس').count()) > 0, 'المراجعة بلا خلاصة');
    const nReview = await donePage.locator('.lesson-card').count();
    assert(nReview < nLearn, `المراجعة لا تختصر: ${nReview}/${nLearn}`);
    assert((await donePage.locator('details.more', { hasText: 'نصوص الدرس من الكتاب' }).count()) > 0,
      'نصوص الكتاب غير متاحة في المراجعة');
    assert((await donePage.locator('text=لم يُنقص منها شيء').count()) > 0, 'بيان الأسئلة ناقص');
  });

  await check('صفحة المراجعة فيها مدخل المراجعة السريعة للدروس المكتملة', async () => {
    await donePage.goto(BASE + '/#/review', { waitUntil: 'networkidle' });
    await donePage.waitForTimeout(300);
    const txt = await donePage.locator('#view').innerText();
    assert(txt.includes('مراجعة سريعة لدرس أتممتَه'), 'لا مدخل للمراجعة السريعة');
    assert(txt.includes('نحو'), 'لا زمن تقريبي في مدخل المراجعة');
  });

  await check('قسم «دروس مناسبة للأسرة» في الرئيسة، ولا إعداد عامّ للوضع الأسري', async () => {
    await donePage.goto(BASE + '/#/home', { waitUntil: 'networkidle' });
    await donePage.waitForTimeout(250);
    const home = await donePage.locator('#view').innerText();
    assert(home.includes('دروس مناسبة للأسرة'), 'لا قسم للدروس الأسرية في الرئيسة');
    assert((await donePage.locator('.chip--brand', { hasText: 'نشاط أسري' }).count()) > 0, 'لا شارة نشاط أسري');
    await donePage.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
    await donePage.waitForTimeout(200);
    const st = await donePage.locator('#view').innerText();
    assert(!st.includes('وضع أسري'), 'الوضع الأسري ما زال إعدادًا عامًّا');
    assert(!st.includes('نمط الدرس الافتراضي'), 'إعداد أنماط العرض ما زال موجودًا');
  });

  await check('النشاط الأسري يظهر في الدرس الذي فيه، بلا إعداد', async () => {
    await donePage.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
    await donePage.waitForTimeout(250);
    const has = await donePage.locator('.chip--brand', { hasText: 'نشاط أسري' }).count();
    const family = await donePage.evaluate(async () => {
      const u = await (await fetch('/content/units/u1.json')).json();
      return !!u.lessons.find((l) => l.id === 'u1l3').family;
    });
    assert(has > 0 === family, `التطابق مختلّ: شارة=${has} محتوى=${family}`);
  });

  await doneCtx.close();

  await check('التفاعل أثناء الدرس يعطي تغذية راجعة فورية', async () => {
    await page.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
    await page.waitForSelector('.q');
    const q = page.locator('.q').first();
    await q.scrollIntoViewIfNeeded();
    const opt = q.locator('.opt').first();
    if (await opt.count()) {
      await opt.click();
      await page.waitForSelector('.feedback', { timeout: 3000 });
      assert((await page.locator('.feedback').count()) > 0, 'لا تغذية راجعة');
    } else {
      await q.locator('button', { hasText: 'تحقّق' }).first().click();
      await page.waitForSelector('.feedback', { timeout: 3000 });
    }
  });

  await check('شريط التنقّل: أربعة تبويبات بأسماء مقروءة ≥١٢px بلا قصّ', async () => {
    for (const w of [320, 375, 390]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      const r = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        tabs: [...document.querySelectorAll('.tabbar__btn')].map((b) => {
          const l = b.querySelector('.tabbar__label');
          const rc = b.getBoundingClientRect();
          return {
            t: l.textContent, fs: parseFloat(getComputedStyle(l).fontSize),
            w: rc.width, h: rc.height, clipped: l.scrollWidth > l.clientWidth + 0.5,
          };
        }),
      }));
      assert(r.tabs.length === 4, `${w}px: التبويبات ${r.tabs.length} لا ٤`);
      assert(r.scroll <= r.client, `${w}px: تمرير أفقي ${r.scroll}/${r.client}`);
      for (const t of r.tabs) {
        assert(t.fs >= 12, `${w}px: «${t.t}» بحجم ${t.fs}px < ١٢`);
        assert(t.w >= 44 && t.h >= 44, `${w}px: «${t.t}» ${t.w}×${t.h} < ٤٤`);
        assert(!t.clipped, `${w}px: «${t.t}» مقصوص`);
        assert(t.t.trim().length > 2, `${w}px: تبويب بلا اسم مقروء`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await check('«المزيد» يفتح بقيّة الأقسام بأسماء كاملة', async () => {
    await page.goto(BASE + '/#/more', { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    const rows = page.locator('.more-row');
    assert(await rows.count() === 5, `صفوف المزيد ${await rows.count()} لا ٥`);
    const txt = await page.locator('#view').innerText();
    for (const t of ['المهام الأدائية', 'الإنجاز', 'البحث', 'المفضلة', 'الإعدادات']) {
      assert(txt.includes(t), `«${t}» غير موجود في المزيد`);
    }
    // والتبويب يُبرز «المزيد» عند فتح قسم من أقسامه
    await page.goto(BASE + '/#/tasks', { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    const cur = await page.locator('.tabbar__btn[aria-current="page"] .tabbar__label').innerText();
    assert(cur.includes('المزيد'), `التبويب البارز «${cur}» لا «المزيد»`);
  });

  await check('لصيقة «صياغة تعليمية مساعدة» مخفيّة عن المتعلّم في الوضع الطبيعي', async () => {
    for (const r of ['/#/lesson/u1/u1l3', '/#/lesson/u5/u5l14', '/#/lesson/u4/u4l7', '/#/home']) {
      await page.goto(BASE + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      const vis = await page.evaluate(() => [...document.querySelectorAll('body *')]
        .filter((e) => !e.children.length && e.offsetParent !== null
          && /صياغة تعليمية مساعدة|صياغة مساعدة/.test(e.textContent || ''))
        .map((e) => e.className || e.tagName));
      assert(vis.length === 0, `${r}: اللصيقة ظاهرة — ${vis.join('، ')}`);
    }
    // وحالة العنصر في البيانات لم تتغيّر
    const still = await page.evaluate(async () => {
      const r = await (await fetch('/content/needs-review.json')).json();
      return r.items.every((i) => !i.approved) && r.count;
    });
    assert(still > 0, 'عناصر المراجعة تغيّرت حالتها');
  });

  await check('«وضع مراجعة المحتوى» يُظهر اللصيقة وشرحها — في المعاينة وحدها', async () => {
    await page.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    // لا يظهر الشريط في صفحة البرنامج العامّة
    assert(await page.locator('#review-mode-bar').isHidden(), 'شريط المراجعة ظاهر للمستخدم العام');
    // وبتفعيل الوضع تظهر اللصيقة وشرحها
    await page.evaluate(() => { document.documentElement.dataset.reviewLabels = 'on'; });
    await page.waitForTimeout(150);
    const n = await page.evaluate(() => [...document.querySelectorAll('.prov')]
      .filter((e) => e.offsetParent !== null).length);
    assert(n >= 3, `اللصيقات الظاهرة ${n}`);
    const note = await page.locator('.prov__note').first().innerText();
    assert(note.includes('بانتظار المراجعة والاعتماد'), `نصّ الشرح: ${note}`);
  });

  await check('لا نصّ قرآني في أي قائمة خيارات ولا إكمال آية', async () => {
    const bad = await page.evaluate(async () => {
      const m = await (await fetch('/content/manifest.json')).json();
      const out = [];
      for (const u of m.units) {
        const unit = await (await fetch('/content/' + u.file)).json();
        for (const l of unit.lessons) {
          for (const q of [...l.interactions, ...l.quiz]) {
            for (const o of (q.options || [])) {
              if (String(o).includes('﴿')) out.push(`${l.id}/${q.id} خيار قرآني`);
            }
            if (q.kind === 'complete' && ((q.before || '') + (q.after || '')).includes('﴿')) {
              out.push(`${l.id}/${q.id} إكمال آية`);
            }
          }
        }
      }
      return out;
    });
    assert(bad.length === 0, bad.join(' | '));
  });

  await check('لا يظهر نصّ قرآني بخطّ الواجهة العامّة في أي شاشة', async () => {
    const routes = ['/#/lesson/u1/u1l3', '/#/lesson/u1/u1l4', '/#/lesson/u1/u1l5',
      '/#/lesson/u1/u1l6', '/#/lesson/u1/u1l7', '/#/lesson/u1/u1l8', '/#/lesson/u1/u1l9',
      '/#/lesson/u6/u6l1', '/#/lesson/u6/u6l4', '/#/lesson/u7/u7l1', '/#/lesson/u7/u7l8',
      '/#/lesson/u5/u5l5', '/#/quiz/u1/u1l3', '/#/unit/u1', '/#/unit/u6', '/#/unit/u7'];
    const bad = [];
    for (const r of routes) {
      await page.goto(BASE + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(220);
      const hits = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('#view *')) {
          if (el.children.length) continue;
          const t = el.textContent || '';
          if (!/[\uFD3E\uFD3F]/.test(t)) continue;
          if (!/Amiri Quran/i.test(getComputedStyle(el).fontFamily)) {
            out.push((el.className || el.tagName) + ' «' + t.trim().slice(0, 30) + '»');
          }
        }
        return out;
      });
      if (hits.length) bad.push(r + ': ' + hits.join(' | '));
    }
    assert(bad.length === 0, bad.join(' ‖ '));
  });

  await check('النصوص القرآنية بالرسم العثماني لا الإملائي', async () => {
    const res = await page.evaluate(async () => {
      const m = await (await fetch('/content/manifest.json')).json();
      let cards = 0, wasla = 0, plain = [];
      for (const u of m.units) {
        const unit = await (await fetch('/content/' + u.file)).json();
        for (const l of unit.lessons) {
          for (const c of l.cards) {
            if (c.type !== 'quran') continue;
            cards++;
            if (c.rasm !== 'عثماني') plain.push(l.id + '/' + c.id + ': بلا وسم رسم');
            // ألف الوصل ٱ علامة الرسم العثماني؛ والألف العادية في «الله» علامة الإملائي
            if (/\u0671/.test(c.text)) wasla++;
            if (/\u0627\u0644\u0644\u064e\u0651\u0647/.test(c.text)) {
              plain.push(l.id + '/' + c.id + ': «اللَّه» بألف عادية');
            }
          }
        }
      }
      return { cards, wasla, plain };
    });
    assert(res.cards === 24, `بطاقات القرآن ${res.cards}`);
    assert(res.plain.length === 0, res.plain.join(' | '));
    assert(res.wasla >= 20, `ألف الوصل في ${res.wasla} بطاقة فقط`);
  });

  await check('نشاط ترتيب الآيات: النصّ بخطّ المصحف، غير قابل للتحرير، ويُصحَّح', async () => {
    await page.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
    await page.waitForSelector('.order-list');
    const info = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.order-item__text')];
      return items.map((el) => {
        // النصّ القرآني يُلبَس خطّ المصحف في عنصر داخليّ .qtext
        const q = el.querySelector('.qtext') || el;
        return {
          t: el.textContent,
          font: getComputedStyle(q).fontFamily,
          editable: el.isContentEditable,
          inputs: el.querySelectorAll('input,textarea').length,
          draggable: el.draggable,
        };
      });
    });
    assert(info.length === 5, `عناصر الترتيب ${info.length} لا ٥`);
    for (const it of info) {
      assert(/Amiri Quran/i.test(it.font), `النصّ القرآني بخطّ ${it.font} لا خطّ المصحف`);
      assert(!it.editable, 'النصّ قابل للتحرير');
      assert(it.inputs === 0, 'حقل إدخال داخل النصّ');
      assert(!it.draggable, 'النصّ قابل للسحب');
      assert(/[\uFD3E\uFD3F]/.test(it.t), 'عنصر بلا أقواس آية');
    }
    // صياغة النشاط تُبيّن أنّ العرض للترتيب
    const prompt = await page.locator('.q').filter({ has: page.locator('.order-list') })
      .locator('.q__prompt').innerText();
    assert(/رتّب/.test(prompt), `الصياغة لا تُبيّن الغرض: ${prompt}`);

    // التصحيح يظهر بعد الإجابة، والترتيب الصحيح يُعرض عند الخطأ
    const q = page.locator('.q').filter({ has: page.locator('.order-list') });
    await q.locator('button', { hasText: 'تحقّق من الترتيب' }).click();
    await page.waitForSelector('.feedback', { timeout: 3000 });
    const marks = await page.evaluate(() =>
      document.querySelectorAll('.order-item--right,.order-item--wrong').length);
    assert(marks === 5, `علامات التصحيح ${marks} لا ٥`);
  });

  await check('الهيئة الخاطئة لا تُحفظ في حالة المتعلّم', async () => {
    const state = await page.evaluate(() => localStorage.getItem('bay.state.v1') || '');
    assert(!/الْحَمْدُ|اهْدِنَا|\uFD3F/.test(state), 'نصّ قرآني مخزَّن في حالة المتعلّم');
    const st = JSON.parse(state || '{}');
    assert(!st.review || Object.keys(st.review).every((k) => !k.includes('i1')),
      'تفاعل الدرس دخل خطة المراجعة');
  });

  await check('نشاط التصنيف يعمل ويصحّح', async () => {
    await page.goto(BASE + '/#/lesson/u5/u5l14', { waitUntil: 'networkidle' });
    await page.waitForSelector('.q');
    const q = page.locator('.q').filter({ has: page.locator('button', { hasText: 'تحقّق من التصنيف' }) }).first();
    assert(await q.count() > 0, 'نشاط التصنيف غير موجود');
    const sels = q.locator('.match__select');
    const n = await sels.count();
    assert(n >= 3, `عناصر التصنيف قليلة: ${n}`);
    for (let i = 0; i < n; i++) await sels.nth(i).selectOption('0');
    await q.locator('button', { hasText: 'تحقّق من التصنيف' }).click();
    await page.waitForSelector('.feedback', { timeout: 3000 });
    assert((await q.locator('.aid').count()) > 0, 'لا يُعرض التصنيف الصحيح عند الخطأ');
  });

  await check('الدروس ذات السؤال الواحد صار فيها ثلاثة تفاعلات متنوّعة', async () => {
    for (const [u, l] of [['u5', 'u5l14'], ['u7', 'u7l10'], ['u2', 'u2l0']]) {
      await page.goto(`${BASE}/#/lesson/${u}/${l}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.q');
      const kinds = await page.evaluate(() => [...document.querySelectorAll('.q')].map((el) => {
        if (el.querySelector('.opts')) return el.querySelector('.cloze') ? 'complete' : 'choice';
        if (el.querySelector('.order-list')) return 'order';
        if (el.querySelector('.match')) return 'match/classify';
        if (el.querySelector('.flash')) return 'flashcards';
        return '?';
      }));
      assert(kinds.length >= 2, `${l}: تفاعلات قليلة (${kinds.length})`);
      // ولصيقة الصياغة المساعدة ظاهرة على المستحدث
      assert((await page.locator('text=صياغة تعليمية مساعدة — مستمدّة من نصّ الدرس').count()) > 0,
        `${l}: التفاعل المستحدث بلا لصيقة`);
    }
  });

  await check('الاختبار القصير يحتسب النتيجة ويحدّث التقدّم', async () => {
    await page.goto(BASE + '/#/quiz/u2/u2l0', { waitUntil: 'networkidle' });
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
    assert((await page.locator('#rv-count').innerText()).includes('٣٠٤'), 'العدّاد لا يعرض ٣٠٤');
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
