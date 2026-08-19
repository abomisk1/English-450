// اختبار متصفّح (E2E) لمراجعة أخطاء الجلسة — يمنع عودة مشكلة عرض أسئلة لم يُخطئ فيها المستخدم.
//
// يتطلّب: خادمًا محليًا يخدم جذر المشروع + مكتبة playwright.
//   1) node <path>/http-server . -p 8141 -c-1
//   2) node tests/session-review.e2e.mjs   (أو مرّر المنفذ: E2E_PORT=8141)
// إن لم تتوفّر playwright أو الخادم، يتخطّى الاختبار بلا فشل.
//
// الفكرة: كل إجابة تستدعي answerItem فتغيّر localStorage — فنعرف بدقّة أيّ عنصر أُجيب وهل
// كان خطأ (حقيقة أرضية). نلتقط لكل إجابة (item.id|type)، ثم نتحقّق أن أسئلة المراجعة =
// الأسئلة المُخطأة نفسها بالضبط: لا سؤال لم يُخطأ فيه، ولا سؤال أُجيب صحيحًا.

import { createRequire } from 'module';

const PORT = process.env.E2E_PORT || '8141';
const BASE = `http://127.0.0.1:${PORT}/index.html`;
const PKEY = 'english450:progress:v1';

let chromium;
try {
  const require = createRequire('/opt/node22/lib/node_modules/');
  ({ chromium } = require('playwright'));
} catch {
  console.log('⏭️  تخطّي E2E: playwright غير متوفّرة.');
  process.exit(0);
}

async function reachable(url) {
  try { await fetch(url); return true; } catch { return false; }
}

const isExt = (t) => /ERR_TUNNEL|Failed to load resource|fonts\.(googleapis|gstatic)|supabase/.test(t);
const readItems = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || '{}').items || {}; } catch { return {}; } }, PKEY);

function diff(before, after) {
  for (const id of Object.keys(after)) {
    if (JSON.stringify(before[id]) !== JSON.stringify(after[id])) {
      return { id, wrong: (after[id].lapses || 0) > ((before[id] && before[id].lapses) || 0) };
    }
  }
  return null;
}
async function screen(page) {
  return page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const has = (t) => btns.some((b) => b.textContent.includes(t));
    const prompt = (document.querySelector('.exercise__prompt') || {}).textContent || '';
    let qtype = 'unknown';
    if (document.querySelector('.word-order__bank') || /رتّب الكلمات/.test(prompt)) qtype = 'word-order';
    else if (/^الموقف:/.test(prompt)) qtype = 'situation';
    else if (document.querySelector('.exercise__listen')) qtype = 'listen-choose';
    else if (/أكمل الفراغ/.test(prompt)) qtype = 'fill-blank';
    else if (/ما معنى/.test(prompt)) qtype = 'choose-meaning';
    else if (/اختر الترجمة الإنجليزية/.test(prompt)) qtype = 'choose-english';
    if (has('مراجعة أخطائي')) return { kind: 'result' };
    if (has('العودة إلى الرئيسية') && document.querySelector('.summary')) return { kind: 'terminal' };
    if (document.body.innerText.includes('أكملت English 450')) return { kind: 'completion' };
    if (has('فهمت، التالي')) return { kind: 'learn' };
    if (document.querySelector('.word-order__bank')) return { kind: 'wordorder', qtype, answered: !!document.querySelector('.feedback') };
    if (document.querySelector('.options')) return { kind: 'choice', qtype, answered: !!document.querySelector('.feedback') };
    return { kind: 'unknown' };
  });
}
const clickForward = (page) => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(التالي|متابعة)$/.test(x.textContent.trim()) && !x.disabled); b && b.click(); });

async function runOnce(page) {
  await page.addInitScript(() => { try { window.speechSynthesis.speak = () => {}; } catch {} localStorage.clear(); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('ابدأ جلسة اليوم')); b && b.click(); });
  await page.waitForTimeout(250);

  const wrongedQ = new Set(), correctQ = new Set(), reviewedQ = [];
  const wrongedId = new Set(), reviewedId = new Set();
  let phase = 'main', guard = 0;
  while (guard++ < 250) {
    const s = await screen(page);
    if (s.kind === 'terminal' || s.kind === 'completion') break;
    if (s.kind === 'result') { phase = 'review'; await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('مراجعة أخطائي')); b && b.click(); }); await page.waitForTimeout(120); continue; }
    if (s.kind === 'learn') { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('فهمت، التالي')); b && b.click(); }); await page.waitForTimeout(100); continue; }
    if (s.kind === 'choice' || s.kind === 'wordorder') {
      if (s.answered) { await clickForward(page); await page.waitForTimeout(100); continue; }
      const before = await readItems(page);
      if (s.kind === 'choice') await page.evaluate(() => { const o = document.querySelector('.option'); o && o.click(); });
      else await page.evaluate(() => { [...document.querySelectorAll('.word-order__bank .token')].forEach((t) => t.click()); const c = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'تحقّق'); c && c.click(); });
      await page.waitForTimeout(130);
      const d = diff(before, await readItems(page));
      if (d) {
        const sig = `${d.id}|${s.qtype}`;
        if (phase === 'main') { if (d.wrong) { wrongedQ.add(sig); wrongedId.add(d.id); } else correctQ.add(sig); }
        else { reviewedQ.push(sig); reviewedId.add(d.id); }
      }
      await page.waitForTimeout(50);
      continue;
    }
    await clickForward(page); await page.waitForTimeout(100);
  }
  return { wrongedQ, correctQ, reviewedQ, wrongedId, reviewedId };
}

(async () => {
  if (!(await reachable(BASE))) { console.log(`⏭️  تخطّي E2E: الخادم غير متاح على ${BASE}.`); process.exit(0); }
  const browser = await chromium.launch();
  const fails = [];
  try {
    // نُعيد المحاولة حتى نحصل على جلسة فيها أخطاء (لضمان تغطية المراجعة)
    let r = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errs = [];
      page.on('console', (m) => { if (m.type() === 'error' && !isExt(m.text())) errs.push(m.text()); });
      page.on('pageerror', (e) => errs.push(String(e)));
      r = await runOnce(page);
      r.jsErrors = errs;
      await page.close();
      if (r.wrongedQ.size > 0) break;
    }
    const reviewedQ = [...new Set(r.reviewedQ)];
    const reviewedNotWronged = reviewedQ.filter((sig) => !r.wrongedQ.has(sig));
    const shownCorrect = reviewedQ.filter((sig) => r.correctQ.has(sig) && !r.wrongedQ.has(sig));
    const idExtra = [...r.reviewedId].filter((id) => !r.wrongedId.has(id));
    const idMissing = [...r.wrongedId].filter((id) => !r.reviewedId.has(id));

    const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
    ok(r.wrongedQ.size > 0, `الجلسة احتوت أخطاءً للتحقّق (${r.wrongedQ.size} سؤالًا)`);
    ok(reviewedNotWronged.length === 0, 'لا تعرض المراجعة أي سؤال لم يُخطئ فيه المستخدم' + (reviewedNotWronged.length ? ' :: ' + reviewedNotWronged.join(', ') : ''));
    ok(shownCorrect.length === 0, 'لا تعرض المراجعة سؤالًا أجابه المستخدم صحيحًا' + (shownCorrect.length ? ' :: ' + shownCorrect.join(', ') : ''));
    ok(idExtra.length === 0 && idMissing.length === 0, 'معرّفات عناصر المراجعة = المُخطأة تمامًا');
    ok((r.jsErrors || []).length === 0, 'لا أخطاء JavaScript');
  } finally {
    await browser.close();
  }
  if (fails.length) { console.log(`\n❌ فشل E2E: ${fails.length}`); process.exit(1); }
  console.log('\n✅ نجح اختبار E2E لمراجعة أخطاء الجلسة: تُعاد الأسئلة المُخطأة نفسها فقط.');
})().catch((e) => { console.error(e); process.exit(1); });
