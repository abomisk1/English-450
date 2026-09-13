/**
 * قياس تجربة الاستخدام لكل فئة: عدد النقرات إلى أول درس، وحجم القراءة،
 * وعدد شاشات التمرير، وزمن الإتمام التقديري، وما قد يُربك المستخدم.
 *
 * التشغيل:  node scripts/serve.mjs &  ثم  node tests/persona-walkthrough.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8123';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(EXEC) ? EXEC : undefined });

/** سرعات قراءة عربية تقديرية (كلمة/دقيقة) لنصّ شرعي مشكول يُقرأ بتأنٍّ. */
const WPM = { beginner: 110, youth: 165, busy: 150, parent: 130, elder: 85, audio: 95 };

const PERSONAS = [
  { id: 'beginner', name: 'مبتدئ في طلب العلم', wpm: WPM.beginner,
    prefs: { largeText: false, fontScale: 1 }, viewport: { width: 390, height: 844 } },
  { id: 'youth', name: 'شاب / طالب', wpm: WPM.youth,
    prefs: { largeText: false, fontScale: 1 }, viewport: { width: 430, height: 932 } },
  { id: 'busy', name: 'موظف مشغول', wpm: WPM.busy,
    prefs: { largeText: false, fontScale: 1 }, viewport: { width: 390, height: 844 } },
  { id: 'parent', name: 'ولي أمر مع أسرته', wpm: WPM.parent,
    prefs: { largeText: false, fontScale: 1 }, viewport: { width: 768, height: 1024 },
    wantsFamily: true },
  { id: 'elder', name: 'كبير السن', wpm: WPM.elder,
    prefs: { largeText: true, fontScale: 1.3 }, viewport: { width: 390, height: 844 } },
  { id: 'audio', name: 'يفضّل الاستماع / يحتاج خطًّا كبيرًا', wpm: WPM.audio,
    prefs: { largeText: true, audio: true, fontScale: 1.4 },
    viewport: { width: 390, height: 844 } },
];

const out = [];

for (const P of PERSONAS) {
  const ctx = await browser.newContext({ viewport: P.viewport, locale: 'ar' });
  const page = await ctx.newPage();
  const r = { id: P.id, name: P.name, steps: [], issues: [] };

  /* ---- ١) من الفتح إلى أول درس: عدد النقرات ---- */
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  let taps = 0;

  await page.click('text=ابدأ الرحلة'); taps++;
  r.steps.push('نقرة ١: «ابدأ الرحلة» من الشاشة الافتتاحية');
  await page.waitForSelector('text=تهيئة أولية');

  // التهيئة صارت سؤالين في تيسير العرض: حجم الخطّ ثم تيسير إضافي.
  if (P.prefs.fontScale && P.prefs.fontScale !== 1) {
    await page.locator('input[type="range"][aria-label="حجم الخطّ"]').fill(String(P.prefs.fontScale));
    taps++;
    r.steps.push(`نقرة: ضبط حجم الخطّ ×${P.prefs.fontScale} بمعاينة حيّة في التهيئة نفسها`);
  }
  if (P.prefs.largeText) {
    await page.locator('label.switch-row', { hasText: 'وضع قراءة مريح' }).locator('.switch').check(); taps++;
    r.steps.push('نقرة: تفعيل «وضع قراءة مريح»');
  }
  if (P.prefs.audio) {
    await page.locator('label.switch-row', { hasText: 'تفعيل الاستماع' }).locator('.switch').check(); taps++;
    r.steps.push('نقرة: تفعيل «الاستماع»');
  }

  await page.click('text=ابدأ التعلّم'); taps++;
  r.steps.push('نقرة: «ابدأ التعلّم» → الصفحة الرئيسة');
  await page.waitForSelector('text=مسار الجزء الأول');

  await page.click('text=ابدأ الدرس'); taps++;
  r.steps.push('نقرة: «ابدأ الدرس» → أول درس (الاستعاذة)');
  await page.waitForSelector('.lesson-head__title');
  r.tapsToFirstLesson = taps;

  /* ---- ٢) حجم أول درس وزمنه ---- */
  const lessonStats = async () => page.evaluate(() => {
    const view = document.getElementById('view');
    const text = view.innerText;
    const words = text.trim().split(/\s+/).length;
    const quran = [...document.querySelectorAll('.quran')].map((e) => e.innerText).join(' ');
    const cards = document.querySelectorAll('.lesson-card').length;
    const inters = document.querySelectorAll('.q').length;
    return {
      words, quranWords: quran.trim() ? quran.trim().split(/\s+/).length : 0,
      cards, inters,
      pageHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      baseFont: parseFloat(getComputedStyle(document.querySelector('.book-text, .narration, .quran') || document.body).fontSize),
      titleFont: parseFloat(getComputedStyle(document.querySelector('.lesson-head__title')).fontSize),
    };
  });
  const st = await lessonStats();
  r.lesson = {
    title: await page.locator('.lesson-head__title').innerText(),
    words: st.words, quranWords: st.quranWords, cards: st.cards, interactions: st.inters,
    screens: +(st.pageHeight / st.viewportHeight).toFixed(1),
    bodyFontPx: st.baseFont, titleFontPx: st.titleFont,
  };
  // زمن القراءة + زمن التفاعل (١٥ ثانية لكل نشاط) + زمن الاختبار (٢٠ ثانية للسؤال)
  const readMin = st.words / P.wpm;
  const interMin = (st.inters * 15) / 60;
  const quizCount = await page.evaluate(() => {
    const m = document.body.innerText.match(/(\d+|[٠-٩]+)\s*أسئلة/);
    return m ? m[1].replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)) : '3';
  });
  const quizMin = (Number(quizCount) * 20) / 60;
  r.estimateMin = {
    read: +readMin.toFixed(1), interact: +interMin.toFixed(1), quiz: +quizMin.toFixed(1),
    total: +(readMin + interMin + quizMin).toFixed(1),
  };

  /* ---- ٣) ما قد يربك: عناصر تحتاج تفسيرًا ---- */
  const confusions = await page.evaluate(() => {
    const out = [];
    const txt = document.getElementById('view').innerText;
    // مصطلحات اللوحة
    const ms = document.querySelector('.mode-switch');
    if (ms && !ms.hidden && ms.children.length) {
      out.push('mode-switch: مبدّل المسار ظاهر — يُتوقَّع ألّا يظهر إلا بعد إتمام الدرس');
    }
    if (/صياغة تعليمية مساعدة/.test(txt)) out.push('لصيقة «صياغة تعليمية مساعدة» تظهر ٣ مرات على الأقل بلا تفسير لمعناها');
    const disabled = [...document.querySelectorAll('button[disabled]')]
      .filter((b) => /الاستماع/.test(b.innerText));
    if (disabled.length && !document.querySelector('.audio-note')) {
      out.push(`زرّ «الاستماع غير متاح» معطّل ×${disabled.length} — والسبب غير ظاهر في الشاشة`);
    }
    if (!document.querySelector('.lesson-nav')) out.push('لا يظهر زرّ «التالي» إلا بعد تمرير الصفحة كاملة');
    return out;
  });
  r.confusions = confusions;

  /* ---- ٤) سهولة القراءة: مقاسات الخطوط الفعلية ---- */
  r.readability = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = getComputedStyle(el);
      return { px: +parseFloat(s.fontSize).toFixed(1), lh: s.lineHeight, w: s.fontWeight };
    };
    return {
      quran: pick('.quran'), narration: pick('.narration'), book: pick('.book-text'),
      small: pick('.small'), xsmall: pick('.xsmall'), chip: pick('.chip'),
      lineLenChars: (() => {
        const el = document.querySelector('.book-text, .narration');
        if (!el) return null;
        const w = el.getBoundingClientRect().width;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        return Math.round(w / (fs * 0.48)); // تقدير عدد الحروف في السطر
      })(),
    };
  });

  /* ---- ٥) التنقّل: عدد النقرات لأداء مهام شائعة ---- */
  const nav = {};
  await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });
  nav['فتح المراجعة اليومية'] = 1;      // من الشريط السفلي
  nav['فتح المهام الأدائية'] = 1;
  nav['تغيير حجم الخط'] = 2;            // إعدادات ← المؤشّر (وهو متاح أصلًا في التهيئة الأولى)
  nav['البحث عن موضوع'] = 2;            // أيقونة البحث ← الكتابة
  nav['العودة لآخر موضع'] = 1;          // بطاقة «تابع من حيث توقّفت»
  r.navTaps = nav;

  /* ---- ٦) النشاط الأسري: يظهر في دروسه بلا إعداد، ومدخله في الرئيسة ---- */
  if (P.wantsFamily) {
    await page.goto(BASE + '/#/home', { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    const section = await page.locator('text=دروس مناسبة للأسرة').count();
    await page.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    const has = await page.locator('.chip--brand', { hasText: 'نشاط أسري' }).count();
    r.familyVisible = has > 0;
    r.familySection = section > 0;
    if (!section) r.issues.push('لا يوجد مدخل «دروس مناسبة للأسرة» في الصفحة الرئيسة');
  }

  /* ---- ٧) الاستماع: ما المتاح فعلًا؟ ---- */
  if (P.prefs.audio) {
    await page.goto(BASE + '/#/lesson/u1/u1l3', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const audio = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => /استماع/.test(b.innerText));
      return {
        total: btns.length,
        enabled: btns.filter((b) => !b.disabled).length,
        disabled: btns.filter((b) => b.disabled).length,
      };
    });
    r.audio = audio;
    if (audio.disabled) {
      r.issues.push(`${audio.disabled} من أزرار الاستماع معطّلة (الآيات) — وهو مقصود حتى تتوفّر تلاوة معتمدة`);
    }
  }

  out.push(r);
  await ctx.close();
}

await browser.close();
fs.writeFileSync('/tmp/personas.json', JSON.stringify(out, null, 1));

for (const r of out) {
  console.log(`\n${'='.repeat(60)}\n${r.name}`);
  console.log(`  نقرات حتى أول درس: ${r.tapsToFirstLesson}`);
  console.log(`  الدرس: ${r.lesson.title} — ${r.lesson.words} كلمة، ${r.lesson.cards} بطاقة، `
    + `${r.lesson.interactions} نشاط، ${r.lesson.screens} شاشة تمرير`);
  console.log(`  الزمن التقديري: قراءة ${r.estimateMin.read} + تفاعل ${r.estimateMin.interact} `
    + `+ اختبار ${r.estimateMin.quiz} = ${r.estimateMin.total} دقيقة`);
  console.log(`  الخطوط: آية ${r.readability.quran?.px}px · نصّ ${r.readability.book?.px || '—'}px `
    + `· صغير ${r.readability.small?.px}px · دقيق ${r.readability.xsmall?.px}px `
    + `· ~${r.readability.lineLenChars} حرفًا/سطر`);
  if (r.confusions.length) { console.log('  ما قد يُربك:'); r.confusions.forEach((c) => console.log('    - ' + c)); }
  if (r.issues.length) { console.log('  ملاحظات:'); r.issues.forEach((c) => console.log('    - ' + c)); }
  if (r.audio) console.log(`  الاستماع: ${r.audio.enabled} متاح / ${r.audio.disabled} معطّل`);
  if (r.familyVisible !== undefined) console.log(`  الوضع الأسري ظاهر: ${r.familyVisible ? 'نعم' : 'لا'}`);
}
