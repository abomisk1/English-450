/**
 * مراجعة بصرية في متصفح حقيقي — تفحص بنود المراجعة المطلوبة بندًا بندًا:
 * جميع الصفحات · خمسة مقاسات · RTL · القصّ والتداخل والتمرير الأفقي ·
 * الوضع الفاتح والداكن · وضوح النصّ القرآني · مناطق اللمس · نبرة الواجهة.
 *
 * التشغيل:  node scripts/serve.mjs &  ثم  node tests/visual-audit.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8123';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const SIZES = [
  { name: 'جوال صغير', w: 320, h: 640 },
  { name: 'جوال متوسط', w: 375, h: 667 },
  { name: 'جوال', w: 390, h: 844 },
  { name: 'جوال كبير', w: 430, h: 932 },
  { name: 'لوحي رأسي', w: 768, h: 1024 },
  { name: 'لوحي أفقي', w: 1024, h: 768 },
  { name: 'حاسب', w: 1280, h: 900 },
  { name: 'حاسب عريض', w: 1920, h: 1080 },
];

const ROUTES = [
  ['الافتتاحية', '/'],
  ['التهيئة الأولية', '/#/setup'],
  ['الرئيسة', '/#/home'],
  ['الوحدات', '/#/units'],
  ['وحدة ١ — تفسير ما يتكرر', '/#/unit/u1'],
  ['وحدة ٤ — الفقه', '/#/unit/u4'],
  ['وحدة ٥ — الأذكار والآداب', '/#/unit/u5'],
  ['درس بآية — سورة الفاتحة', '/#/lesson/u1/u1l3'],
  ['درس بآية — آية الكرسي', '/#/lesson/u1/u1l4'],
  ['درس فقهي — واجبات الصلاة', '/#/lesson/u4/u4l7'],
  ['درس فقهي — سنن الصلاة (أطول درس)', '/#/lesson/u4/u4l8'],
  ['درس أذكار — أذكار الصباح', '/#/lesson/u5/u5l1'],
  ['درس أخلاق — الحياء', '/#/lesson/u6/u6l5'],
  ['درس رقائق — رحمة الله', '/#/lesson/u7/u7l8'],
  ['الاختبار', '/#/quiz/u1/u1l3'],
  ['المهام الأدائية', '/#/tasks'],
  ['المراجعة الذكية', '/#/review'],
  ['الإنجاز والتقدّم', '/#/progress'],
  ['المفضلة', '/#/bookmarks'],
  ['البحث', '/#/search'],
  ['الإعدادات', '/#/settings'],
  ['لوحة المراجعة', '/admin/index.html'],
];

const findings = [];
let checks = 0, fails = 0;
function note(level, area, msg) {
  findings.push({ level, area, msg });
  if (level === 'خطأ') fails++;
}
function ok(area) { checks++; }

const SEED = {
  version: 1, createdAt: Date.now(), updatedAt: Date.now(), onboarded: true,
  prefs: { sessionLength: 'standard', detail: 'standard', largeText: false, audio: false,
    highContrast: false, theme: 'system', familyMode: true, reduceMotion: false, fontScale: 1 },
  lessons: { u1l1: { seen: true, quizBest: 100, quizAttempts: 1, completedAt: 1 },
    u1l2: { seen: true, quizBest: 100, quizAttempts: 1, completedAt: 1 },
    u1l3: { seen: true, quizBest: 80, quizAttempts: 2, completedAt: 1 } },
  tasks: { 'u1/t1': { doneAt: 1 } },
  review: { 'u1/u1l4/q2': { ease: 2.5, interval: 0, due: 1, reps: 1, lapses: 1, step: 0 } },
  bookmarks: [{ type: 'lesson', id: 'u1l4', label: 'آية الكرسي', unitId: 'u1', at: 1 }],
  activity: [{ at: Date.now(), kind: 'quiz', ref: { percent: 100 } }],
  badges: { 'first-lesson': 1 },
  lastPosition: { unitId: 'u1', lessonId: 'u1l4', lessonTitle: 'آية الكرسي' },
  streak: { count: 3, lastDay: new Date().setHours(0, 0, 0, 0), best: 5 },
  stats: { lessonsCompleted: 3, quizPassed: 3, tasksDone: 1, reviewsDone: 4, reviewDays: 2 },
};

const browser = await chromium.launch({ executablePath: fs.existsSync(EXEC) ? EXEC : undefined });

async function makeCtx(opts = {}) {
  const ctx = await browser.newContext({ locale: 'ar', ...opts });
  await ctx.addInitScript((s) => {
    try { localStorage.setItem('bay.state.v1', JSON.stringify(s)); } catch (_) {}
  }, SEED);
  return ctx;
}

/* ============ ١) التمرير الأفقي والقصّ والتداخل على كل المقاسات ============ */
console.log('› فحص التخطيط على %d مقاسات × %d شاشة …', SIZES.length, ROUTES.length);
for (const sz of SIZES) {
  const ctx = await makeCtx({ viewport: { width: sz.w, height: sz.h } });
  const page = await ctx.newPage();
  for (const [label, route] of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(140);

    // تمرير أفقي
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) note('خطأ', `${sz.name} · ${label}`, `تمرير أفقي بمقدار ${over}px`);
    else ok();

    // عناصر خارج الشاشة أو مقصوصة
    const bad = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const out = [];
      for (const el of document.querySelectorAll('#view *, .topbar *, .tabbar *')) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const st = getComputedStyle(el);
        if (st.position === 'fixed') continue;
        let scrollable = false;
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) { scrollable = true; break; }
        }
        if (scrollable) continue;
        if (r.right > vw + 1 || r.left < -1) {
          out.push(`${el.tagName}.${String(el.className).slice(0, 30)} (${Math.round(r.left)}→${Math.round(r.right)} / ${vw})`);
        }
        // قصّ النصّ: النصّ أطول من الصندوق ولا يُسمح بالتمرير
        if (el.children.length === 0 && el.scrollHeight > el.clientHeight + 4
            && st.overflowY === 'hidden' && el.textContent.trim()) {
          out.push(`نصّ مقصوص: ${el.tagName}.${String(el.className).slice(0, 30)}`);
        }
      }
      return [...new Set(out)].slice(0, 3);
    });
    if (bad.length) note('خطأ', `${sz.name} · ${label}`, 'عنصر يتجاوز الشاشة أو مقصوص: ' + bad.join('، '));
    else ok();

    // تداخل بين البطاقات المتجاورة
    const overlap = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#view .card, #view .lesson-card, #view .unit-card')];
      for (let i = 0; i < cards.length - 1; i++) {
        const a = cards[i].getBoundingClientRect(), b = cards[i + 1].getBoundingClientRect();
        if (a.bottom > b.top + 2 && a.top < b.top && Math.abs(a.left - b.left) < 4) {
          return `${cards[i].className.slice(0, 24)} يتداخل مع التالي بمقدار ${Math.round(a.bottom - b.top)}px`;
        }
      }
      return null;
    });
    if (overlap) note('خطأ', `${sz.name} · ${label}`, overlap); else ok();
  }
  await ctx.close();
}

/* =================== ٢) اتجاه RTL في كل الشاشات =================== */
console.log('› فحص اتجاه RTL …');
{
  const ctx = await makeCtx({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  for (const [label, route] of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => {
      const doc = document.documentElement;
      const bad = [];
      // أي عنصر ظاهر اتجاهه ltr بغير سبب
      for (const el of document.querySelectorAll('#view *')) {
        const st = getComputedStyle(el);
        if (st.direction === 'ltr' && el.textContent.trim() && /[؀-ۿ]/.test(el.textContent)) {
          bad.push(el.tagName + '.' + String(el.className).slice(0, 24));
        }
      }
      // محاذاة العناوين: يجب أن تبدأ من اليمين
      const h1 = document.querySelector('#view h1, #view h2');
      let align = null;
      if (h1) {
        const rect = h1.getBoundingClientRect();
        const parent = h1.parentElement.getBoundingClientRect();
        align = { gapRight: Math.round(parent.right - rect.right), gapLeft: Math.round(rect.left - parent.left) };
      }
      return { dir: doc.dir, bodyDir: getComputedStyle(document.body).direction, bad: bad.slice(0, 2), align };
    });
    if (r.dir !== 'rtl' || r.bodyDir !== 'rtl') note('خطأ', label, `الاتجاه ليس rtl (${r.dir}/${r.bodyDir})`);
    else if (r.bad.length) note('تنبيه', label, 'عنصر عربي باتجاه ltr: ' + r.bad.join('، '));
    else ok();
  }
  await ctx.close();
}

/* ============ ٣) الوضع الفاتح والداكن: تباين ووضوح النصّ القرآني ============ */
console.log('› فحص الوضعين الفاتح والداكن …');
const CONTRAST = `(() => {
  const lum = (c) => { const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});
    return .2126*r+.7152*g+.0722*b; };
  const parse = (s) => (s.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
  const bgOf = (el) => { let e=el; while(e){ const c=getComputedStyle(e).backgroundColor;
    const a=(c.match(/[\\d.]+/g)||[])[3]; if(c&&c!=='rgba(0, 0, 0, 0)'&&a!=='0') return parse(c); e=e.parentElement; }
    return [255,255,255]; };
  const out=[];
  for (const el of document.querySelectorAll('#view *')) {
    if (el.children.length) continue;
    const t=(el.textContent||'').trim(); if(!t) continue;
    const r=el.getBoundingClientRect(); if(r.width<4||r.height<4) continue;
    const st=getComputedStyle(el); if(st.visibility==='hidden'||st.opacity==='0') continue;
    const fg=parse(st.color), bg=bgOf(el);
    const l1=lum(fg),l2=lum(bg);
    const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
    const size=parseFloat(st.fontSize);
    const large=size>=24||(size>=18.66&&Number(st.fontWeight)>=700);
    const need=large?3:4.5;
    if(ratio<need) out.push((el.className||el.tagName)+' ratio='+ratio.toFixed(2)+' need='+need+' «'+t.slice(0,24)+'»');
  }
  return [...new Set(out)].slice(0,4);
})()`;

for (const [themeLabel, opts] of [
  ['فاتح', { colorScheme: 'light' }],
  ['داكن (من النظام)', { colorScheme: 'dark' }],
]) {
  const ctx = await makeCtx({ viewport: { width: 390, height: 900 }, ...opts });
  const page = await ctx.newPage();
  for (const [label, route] of ROUTES) {
    if (route.startsWith('/admin')) continue;
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(160);
    const bad = await page.evaluate(CONTRAST);
    if (bad.length) note('خطأ', `الوضع ${themeLabel} · ${label}`, 'تباين دون WCAG AA: ' + bad.join(' | '));
    else ok();
  }
  // وضوح النصّ القرآني تحديدًا
  for (const route of ['/#/lesson/u1/u1l3', '/#/lesson/u1/u1l4', '/#/lesson/u6/u6l5']) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForSelector('.quran');
    const q = await page.evaluate(() => {
      const el = document.querySelector('.quran');
      const st = getComputedStyle(el);
      const t = el.textContent;
      return {
        font: st.fontFamily, size: parseFloat(st.fontSize), lh: st.lineHeight,
        color: st.color, align: st.textAlign,
        hasTashkeel: /[ً-ْٰ]/.test(t),
        hasAyaMarks: /[﴿﴾]/.test(t),
        chars: t.length,
        clipped: el.scrollHeight > el.clientHeight + 4,
      };
    });
    if (!/Amiri Quran/.test(q.font)) note('خطأ', `الوضع ${themeLabel}`, `خطّ الآية ليس Amiri Quran: ${q.font}`);
    else if (q.size < 18) note('تنبيه', `الوضع ${themeLabel}`, `حجم خطّ الآية صغير: ${q.size}px`);
    else if (!q.hasTashkeel) note('خطأ', `الوضع ${themeLabel}`, 'نصّ الآية بلا تشكيل');
    else if (q.clipped) note('خطأ', `الوضع ${themeLabel} · ${route}`, 'نصّ الآية مقصوص');
    else ok();
  }
  await ctx.close();
}

/* ==================== ٤) مناطق اللمس ووضوح الأزرار ==================== */
console.log('› فحص مناطق اللمس …');
{
  const ctx = await makeCtx({ viewport: { width: 320, height: 640 } });
  const page = await ctx.newPage();
  for (const [label, route] of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(120);
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button, a.btn, .opt, select, input[type=checkbox]')) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (r.height < 44 || r.width < 30) {
          out.push(`${String(el.className).slice(0, 26)} ${Math.round(r.width)}×${Math.round(r.height)}`);
        }
      }
      return [...new Set(out)].slice(0, 4);
    });
    if (small.length) note('تنبيه', `مناطق اللمس · ${label}`, 'أصغر من ٤٤px: ' + small.join('، '));
    else ok();
  }
  await ctx.close();
}

/* ============= ٥) وضع الخط الكبير: لا قصّ ولا تداخل بعد التكبير ============= */
console.log('› فحص وضع الخط الكبير …');
{
  const big = JSON.parse(JSON.stringify(SEED));
  big.prefs.largeText = true; big.prefs.fontScale = 1.5;
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: 'ar' });
  await ctx.addInitScript((s) => {
    try { localStorage.setItem('bay.state.v1', JSON.stringify(s)); } catch (_) {}
  }, big);
  const page = await ctx.newPage();
  for (const [label, route] of ROUTES) {
    if (route.startsWith('/admin')) continue;
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(160);
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) note('خطأ', `خط كبير ×١٫٥ · ${label}`, `تمرير أفقي ${over}px`);
    else ok();
    const clipped = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('#view *')) {
        if (el.children.length) continue;
        const st = getComputedStyle(el);
        if (st.overflow === 'hidden' && el.scrollHeight > el.clientHeight + 6 && el.textContent.trim()) {
          out.push(String(el.className).slice(0, 30));
        }
      }
      return [...new Set(out)].slice(0, 3);
    });
    if (clipped.length) note('خطأ', `خط كبير ×١٫٥ · ${label}`, 'نصّ مقصوص: ' + clipped.join('، '));
    else ok();
  }
  await ctx.close();
}

/* ================= ٦) نبرة الواجهة: ليست طفولية ولا جافّة ================= */
console.log('› فحص نبرة الواجهة …');
{
  const ctx = await makeCtx({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const CHILDISH = ['رائع جدًا', 'يا بطل', 'أحسنت يا', 'هيا بنا', 'ممتاز!!', 'واو', 'مبروووك'];
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u;
  let emojiCount = 0, exclam = 0;
  for (const [label, route] of ROUTES) {
    if (route.startsWith('/admin')) continue;
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(120);
    const txt = await page.locator('#view').innerText();
    for (const w of CHILDISH) if (txt.includes(w)) note('تنبيه', label, `أسلوب طفولي محتمل: «${w}»`);
    emojiCount += (txt.match(EMOJI) || []).length;
    exclam += (txt.match(/!/g) || []).length;
  }
  findings.push({ level: 'معلومة', area: 'نبرة الواجهة',
    msg: `مجموع الرموز التعبيرية في كل الشاشات: ${emojiCount} · علامات التعجّب: ${exclam}` });
  ok();
  await ctx.close();
}

/* ========================= ٧) لوحة المراجعة ========================= */
console.log('› فحص لوحة المراجعة …');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(BASE + '/admin/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.rv', { timeout: 8000 });

  const cases = [
    ['التصفية بالوحدة', 'select[aria-label="الوحدة"]', 'u5'],
    ['التصفية بنوع العنصر', 'select[aria-label="نوع العنصر"]', 'card:quran'],
    ['التصفية بالأولوية', 'select[aria-label="الأولوية"]', 'high'],
    ['التصفية بحالة الاعتماد', 'select[aria-label="حالة الاعتماد"]', 'pending'],
  ];
  for (const [label, sel, val] of cases) {
    await page.click('text=إعادة ضبط التصفية');
    await page.waitForTimeout(200);
    await page.selectOption(sel, val);
    await page.waitForTimeout(300);
    const n = await page.locator('#rv-count').innerText();
    if (!/[٠-٩]/.test(n)) note('خطأ', 'لوحة المراجعة', `${label}: لا عدّاد`);
    else ok();
  }
  await page.click('text=إعادة ضبط التصفية');
  await page.fill('input[type="search"]', 'الوضوء');
  await page.waitForTimeout(500);
  if (await page.locator('mark.hit').count() === 0) note('خطأ', 'لوحة المراجعة', 'البحث لا يبرز المطابقات');
  else ok();
  if (await page.locator('.rv__anchor').count() === 0) note('خطأ', 'لوحة المراجعة', 'نصّ الكتاب المرجعي لا يظهر');
  else ok();
  if (await page.locator('a:has-text("موضعه في البرنامج")').count() === 0) note('خطأ', 'لوحة المراجعة', 'لا رابط للانتقال إلى الواجهة');
  else ok();
  if (errs.length) note('خطأ', 'لوحة المراجعة', errs.slice(0, 2).join(' | '));
  else ok();
  await ctx.close();
}

/* ================== ٨) أخطاء الشفرة والموارد المفقودة ================== */
console.log('› فحص أخطاء الشفرة …');
{
  const ctx = await makeCtx({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('JS: ' + String(e).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 120)); });
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon\.ico/.test(r.url())) errs.push(`HTTP ${r.status()} ${r.url()}`); });
  for (const [, route] of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(120);
  }
  if (errs.length) note('خطأ', 'الشفرة', [...new Set(errs)].slice(0, 4).join(' | '));
  else ok();
  await ctx.close();
}

await browser.close();

/* ============================== التقرير ============================== */
const byLevel = { 'خطأ': [], 'تنبيه': [], 'معلومة': [] };
for (const f of findings) byLevel[f.level].push(f);

console.log('\n' + '='.repeat(64));
console.log(`فحوص ناجحة: ${checks} · أخطاء: ${byLevel['خطأ'].length} · تنبيهات: ${byLevel['تنبيه'].length}`);
for (const lvl of ['خطأ', 'تنبيه', 'معلومة']) {
  if (!byLevel[lvl].length) continue;
  console.log(`\n— ${lvl} (${byLevel[lvl].length}) —`);
  const seen = new Set();
  for (const f of byLevel[lvl]) {
    const k = f.area + '|' + f.msg;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(`  • [${f.area}] ${f.msg}`);
  }
}
console.log('='.repeat(64));

fs.writeFileSync('/tmp/visual-audit.json', JSON.stringify({ checks, findings }, null, 1));
process.exit(0);
