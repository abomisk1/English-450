// مولّد المحتوى: يقرأ المصدر المختصر، يتحقق من عدم التكرار،
// يرتّب حسب الصعوبة (order تصاعدي: الأسهل أولًا)، ثم يكتب
// js/data/words.js و js/data/phrases.js بنفس البنية الحالية.
//
// التشغيل: node scripts/generate-content.mjs [--write]
// بدون --write: يطبع تقريرًا فقط (عدد، تكرارات) دون الكتابة.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SRC = process.env.CONTENT_SRC || join(ROOT, 'content-src');
const { words } = await import(join(SRC, 'words-src.mjs'));
const { phrases } = await import(join(SRC, 'phrases-src.mjs'));

// —— تصنيف المستويات التعليمية (1..6) ——
// المنهجية (تقييم تربوي حقيقي، لا تقسيم متساوٍ ولا حسب الترتيب الحالي فقط):
//   نحسب "درجة صعوبة مركّبة" لكل عنصر تجمع:
//     • رتبة الثيمة (tier): مدى تقدّم موضوع العنصر (شيوعه وأهميته للمبتدئ) — الوزن الأكبر.
//     • الصعوبة (difficulty 1..3): التركيب اللغوي.
//     • الطول/التعقيد: عدد كلمات الجملة أو طول الكلمة.
//   ثم نرتّب الـ450 عنصرًا حسب الدرجة ونوزّعها على 6 مستويات بأحجام متدرّجة (غير متساوية).
//   كل عنصر ينتمي إلى مستوى واحد فقط، والتدرّج من 1 (الأسهل) إلى 6 (الأصعب).

// رتبة الثيمة للكلمات (0 = أساس المبتدئ جدًا ... الأعلى = أكثر تقدّمًا).
const WORD_TIER = {
  'ضمائر وكلمات وظيفية': 0,
  'الأرقام': 0,
  'الألوان': 1,
  'الأفعال الأساسية': 1,
  'الصفات الأساسية': 2,
  'الأشخاص والعائلة': 2,
  'المنزل': 2,
  'الطعام والشراب': 3,
  'الوقت والأيام': 3,
  'الأماكن': 4,
  'الدراسة': 4,
  'المشاعر': 5,
  'الصحة العامة': 5,
  'العمل': 6,
  'السفر': 6,
  'التسوق': 6,
};
// رتبة الثيمة للجمل (الجمل أعلى قليلًا لأنها تراكيب كاملة).
const PHRASE_TIER = {
  'التحية': 1,
  'التعارف': 2,
  'الشكر': 2,
  'الاعتذار': 3,
  'السؤال': 3,
  'الطلب': 4,
  'طلب المساعدة': 4,
  'الاتجاهات': 5,
  'المطعم': 6,
  'التسوق': 6,
  'الفندق': 7,
  'المطار': 7,
  'المواعيد': 7,
  'العمل': 8,
  'المحادثات اليومية': 8,
};

// درجة الصعوبة المركّبة (كلما زادت تأخّر العنصر إلى مستوى أعلى).
function difficultyScore(kind, category, difficulty, english) {
  const tier = (kind === 'word' ? WORD_TIER : PHRASE_TIER)[category] ?? 4;
  const words = english.trim().split(/\s+/).length;
  const lengthFactor = kind === 'phrase' ? Math.min(words * 6, 40) : Math.min(english.length, 12);
  return tier * 100 + difficulty * 22 + lengthFactor;
}

// أحجام المستويات (غير متساوية، متدرّجة) — المجموع = 450.
const LEVEL_SIZES = [80, 80, 78, 74, 70, 68];

// يوزّع قائمة العناصر (لها score) على 6 مستويات حسب الترتيب والأحجام أعلاه.
function assignLevels(itemsWithScore) {
  const sorted = [...itemsWithScore].sort((a, b) => a.score - b.score || a.order - b.order);
  const byId = {};
  let idx = 0;
  for (let L = 1; L <= 6; L++) {
    const size = L === 6 ? sorted.length - idx : LEVEL_SIZES[L - 1];
    for (let k = 0; k < size && idx < sorted.length; k++, idx++) byId[sorted[idx].id] = L;
  }
  return byId;
}

// —— أدوات ——
function slug(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function checkDuplicates(items, keyFn, label) {
  const seen = new Map();
  const dups = [];
  for (const it of items) {
    const k = keyFn(it);
    if (seen.has(k)) dups.push(k);
    else seen.set(k, true);
  }
  if (dups.length) {
    console.error(`❌ تكرار في ${label}:`, [...new Set(dups)]);
  }
  return dups.length;
}

// —— الكلمات ——
let problems = 0;
problems += checkDuplicates(words, (w) => w.e.toLowerCase(), 'الكلمات (english)');

// تحقق من اكتمال الحقول
for (const w of words) {
  for (const f of ['e', 'a', 'p', 'ex', 'exa', 'd', 'c']) {
    if (w[f] === undefined || w[f] === '') {
      console.error('❌ حقل ناقص في كلمة:', w.e, '->', f);
      problems++;
    }
  }
  if (![1, 2, 3].includes(w.d)) {
    console.error('❌ صعوبة غير صحيحة:', w.e, w.d);
    problems++;
  }
}

// ترتيب ثابت حسب الصعوبة (الأسهل أولًا) مع الحفاظ على ترتيب التأليف داخل كل مستوى
const wordsSorted = words
  .map((w, i) => ({ w, i }))
  .sort((a, b) => a.w.d - b.w.d || a.i - b.i)
  .map(({ w }) => w);

const wordIds = new Set();
const wordsOut = wordsSorted.map((w, idx) => {
  let id = 'w-' + slug(w.e);
  while (wordIds.has(id)) id += '-x';
  wordIds.add(id);
  return { ...w, id, order: idx + 1, score: difficultyScore('word', w.c, w.d, w.e) };
});

// —— الجمل ——
problems += checkDuplicates(phrases, (p) => p.e.toLowerCase(), 'الجمل (english)');
for (const p of phrases) {
  for (const f of ['e', 'a', 'ctx', 'c', 'd']) {
    if (p[f] === undefined || p[f] === '') {
      console.error('❌ حقل ناقص في جملة:', p.e, '->', f);
      problems++;
    }
  }
  if (![1, 2, 3].includes(p.d)) {
    console.error('❌ صعوبة غير صحيحة (جملة):', p.e, p.d);
    problems++;
  }
}

const phrasesSorted = phrases
  .map((p, i) => ({ p, i }))
  .sort((a, b) => a.p.d - b.p.d || a.i - b.i)
  .map(({ p }) => p);

const phraseIds = new Set();
const phrasesOut = phrasesSorted.map((p, idx) => {
  let id = 'p-' + slug(p.e).slice(0, 40);
  while (phraseIds.has(id)) id += '-x';
  phraseIds.add(id);
  return { ...p, id, order: idx + 1, score: difficultyScore('phrase', p.c, p.d, p.e) };
});

// —— إسناد المستويات على مجموع الـ450 عنصرًا حسب الدرجة المركّبة ——
const levelById = assignLevels([...wordsOut, ...phrasesOut]);
for (const w of wordsOut) w.level = levelById[w.id];
for (const p of phrasesOut) p.level = levelById[p.id];

// —— تقرير ——
const wCat = {};
for (const w of wordsOut) wCat[w.c] = (wCat[w.c] || 0) + 1;
const wDiff = { 1: 0, 2: 0, 3: 0 };
for (const w of wordsOut) wDiff[w.d]++;

console.log('=== تقرير المحتوى ===');
console.log('عدد الكلمات:', wordsOut.length);
console.log('توزيع الصعوبة (كلمات):', wDiff);
console.log('التصنيفات (كلمات):');
for (const [c, n] of Object.entries(wCat).sort((a, b) => b[1] - a[1])) {
  console.log(`  - ${c}: ${n}`);
}
console.log('عدد الجمل:', phrasesOut.length);
const pDiff = { 1: 0, 2: 0, 3: 0 };
for (const p of phrasesOut) pDiff[p.d]++;
console.log('توزيع الصعوبة (جمل):', pDiff);

// توزيع المستويات
const lvl = { 1: { w: 0, p: 0 }, 2: { w: 0, p: 0 }, 3: { w: 0, p: 0 }, 4: { w: 0, p: 0 }, 5: { w: 0, p: 0 }, 6: { w: 0, p: 0 } };
for (const w of wordsOut) lvl[w.level].w++;
for (const p of phrasesOut) lvl[p.level].p++;
console.log('توزيع المستويات (كلمات + جمل = الإجمالي):');
for (let L = 1; L <= 6; L++) {
  console.log(`  - المستوى ${L}: ${lvl[L].w} كلمة + ${lvl[L].p} جملة = ${lvl[L].w + lvl[L].p}`);
}
console.log('مشاكل:', problems);

// —— الكتابة ——
if (process.argv.includes('--write')) {
  if (problems > 0) {
    console.error('\n⛔ لن تتم الكتابة بسبب وجود مشاكل. أصلحها أولًا.');
    process.exit(1);
  }

  const wordsFile =
    `import type { Word } from './types';\n\n` +
    `// محتوى الكلمات — 350 كلمة أساسية مرتّبة تدريجيًا من الأسهل إلى الأصعب (order تصاعدي).\n` +
    `// مُولّد آليًا من scripts/generate-content.mjs — لا تُحرّره يدويًا؛ عدّل المصدر ثم أعد التوليد.\n\n` +
    `export const WORDS: Word[] = [\n` +
    wordsOut
      .map(
        (w) =>
          `  { id: '${w.id}', english: '${esc(w.e)}', arabic: '${esc(w.a)}', partOfSpeech: '${esc(
            w.p,
          )}', exampleEnglish: '${esc(w.ex)}', exampleArabic: '${esc(w.exa)}', category: '${esc(
            w.c,
          )}', difficulty: ${w.d}, level: ${w.level}, order: ${w.order} },`,
      )
      .join('\n') +
    `\n];\n`;

  const phrasesFile =
    `import type { Phrase } from './types';\n\n` +
    `// محتوى الجمل — 100 جملة عملية مرتّبة تدريجيًا من الأسهل إلى الأصعب (order تصاعدي).\n` +
    `// مُولّد آليًا من scripts/generate-content.mjs — لا تُحرّره يدويًا؛ عدّل المصدر ثم أعد التوليد.\n\n` +
    `export const PHRASES: Phrase[] = [\n` +
    phrasesOut
      .map(
        (p) =>
          `  { id: '${p.id}', english: '${esc(p.e)}', arabic: '${esc(p.a)}', context: '${esc(
            p.ctx,
          )}', category: '${esc(p.c)}', difficulty: ${p.d}, level: ${p.level}, order: ${p.order} },`,
      )
      .join('\n') +
    `\n];\n`;

  // النسخة الحالية للتطبيق هي JavaScript (بلا ترجمة). نكتب ملفات .js بدون أنواع.
  const toJsWords = wordsFile
    .replace(`import type { Word } from './types';\n\n`, '')
    .replace(`export const WORDS: Word[] = [`, 'export const WORDS = [');
  const toJsPhrases = phrasesFile
    .replace(`import type { Phrase } from './types';\n\n`, '')
    .replace(`export const PHRASES: Phrase[] = [`, 'export const PHRASES = [');

  writeFileSync(join(ROOT, 'js/data/words.js'), toJsWords);
  writeFileSync(join(ROOT, 'js/data/phrases.js'), toJsPhrases);
  console.log('\n✅ تمت كتابة js/data/words.js و js/data/phrases.js');
}
