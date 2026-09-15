/**
 * صفحة «مراجعة السياقات القرآنية» — الدفعة الثانية، للمعاينة الخاصة وحدها.
 *
 * واحدٌ وعشرون عنصرًا تحوي نصًّا قرآنيًّا ولم تُعتمد. تُعرض كاملةً كما يراها
 * المتعلّم — لا المقطع القرآني وحده — ومعها فحصان **مستقلّان**: سلامة النصّ
 * القرآني، وسلامة السياق التعليمي. ونجاح الأول لا يُغني عن الثاني.
 *
 * وقرار المراجعة هنا يُحفظ في مفتاح مستقلّ، ولا يعتمد عنصرًا ولا يعدّل محتوى.
 */

import { h, icon, ICONS, ar, toast, announce } from '../lib/dom.js';
import { qtext } from './widgets.js';
import { zoomer, exportPanel, field, IMG_BASE } from './quran-review.js';

const DATA = new URL('../../docs/quran-review/context-review-data.json', import.meta.url);

/* مفتاح مستقلّ عن حالة البرنامج وعن قرارات الدفعة الأولى. */
export const CTX_KEY = 'bay.quran.contextcheck.v1';

export const CTX_DECISIONS = [
  { id: 'ok', label: 'راجعته: مطابق وسليم' },
  { id: 'note', label: 'توجد ملاحظة' },
  { id: 'blocked', label: 'تعذّر التحقّق' },
];

const KIND_AR = {
  summary: 'خلاصة الدرس',
  'interaction:mcq': 'تفاعل — اختيار من متعدّد',
  'interaction:scenario': 'تفاعل — موقف تطبيقي',
  'quiz:mcq': 'سؤال اختبار — اختيار من متعدّد',
};

export function contextReviewVisible(prefs) {
  return !!(window.__BAY_REVIEW_PREVIEW__ && prefs && prefs.reviewLabels);
}

export function loadCtxChecks() {
  try {
    const raw = localStorage.getItem(CTX_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

function saveCtxChecks(c) {
  try { localStorage.setItem(CTX_KEY, JSON.stringify(c)); } catch (_) { /* لا شيء */ }
}

let CACHE = null;
export async function loadContextData() {
  if (!CACHE) {
    const res = await fetch(DATA, { cache: 'no-cache' });
    if (!res.ok) throw new Error('تعذّر تحميل بيانات مراجعة السياقات القرآنية.');
    CACHE = await res.json();
  }
  return CACHE;
}

/* --------------------------------------------- عرض العنصر كما يراه المتعلّم */
function learnerView(v) {
  const rows = [];
  if (v.kind === 'summary') {
    rows.push(h('ul', { class: 'ctx-points' },
      ...(v.points || []).map((t) => qtext(t, 'li'))));
    return rows;
  }
  if (v.prompt) rows.push(field('السؤال', qtext(v.prompt, 'div', 'ctx-prompt')));
  if (v.before || v.after) {
    rows.push(field('النصّ المعروض',
      h('div', {}, qtext(v.before || '', 'span'), ' ____ ', qtext(v.after || '', 'span'))));
  }
  if ((v.options || []).length) {
    rows.push(field(`جميع الخيارات (${ar(v.options.length)})`,
      h('ol', { class: 'ctx-opts' },
        ...v.options.map((o, i) => h('li', { class: i === v.answer ? 'is-answer' : '' },
          h('span', { class: 'ctx-mark' }, i === v.answer ? '✔' : '—'),
          qtext(o, 'span'),
          i === v.answer ? h('span', { class: 'chip chip--ok ctx-tag' }, 'الإجابة الصحيحة') : null)))));
  }
  if (v.answerText) rows.push(field('الإجابة الصحيحة', qtext(v.answerText, 'div')));
  if ((v.pairs || []).length) {
    rows.push(field('طرفا المطابقة',
      h('ul', { class: 'ctx-pairs' }, ...v.pairs.map((p) => h('li', {},
        qtext(p[0] || '', 'span'), h('span', { class: 'muted' }, ' ⟵ '),
        qtext(p[1] || '', 'span'))))));
  }
  if ((v.groups || []).length) {
    rows.push(field('عناصر التصنيف',
      h('ul', { class: 'ctx-pairs' }, ...v.groups.map((g) => h('li', {},
        h('strong', {}, `${g.name}: `),
        ...g.items.map((t, i) => [i ? ' · ' : '', qtext(t, 'span')]))))));
  }
  if ((v.items || []).length) {
    rows.push(field('عناصر الترتيب',
      h('ol', { class: 'ctx-opts' }, ...v.items.map((t) => h('li', {}, qtext(t, 'span'))))));
  }
  if (v.why) rows.push(field('تفسير الإجابة', qtext(v.why, 'div')));
  return rows;
}

function checkList(title, verdict, checks, warnings) {
  const cls = verdict.includes('⚠️') ? 'chip chip--warn'
    : (verdict.includes('مقابلة') ? 'chip' : 'chip chip--ok');
  return h('section', { class: 'ctx-check' },
    h('h3', { class: 'ctx-check__h' }, title, ' ', h('span', { class: cls }, verdict)),
    h('ul', { class: 'ctx-check__list' },
      ...checks.map(([label, value, state]) => h('li', { class: `is-${state}` },
        h('span', { class: 'ctx-check__k' }, label),
        h('span', { class: 'ctx-check__v' }, value)))),
    warnings.length
      ? h('ul', { class: 'ctx-warns' }, ...warnings.map((w) => h('li', {}, w)))
      : null);
}

/* ------------------------------------------------------------------ البطاقة */
function itemCard(it, checks, onChange, unitsRoute) {
  const c = () => checks[it.id] || {};
  const idBase = `ctx-${it.id.replace(/\W/g, '-')}`;

  const noteBox = h('textarea', {
    class: 'input qrv-note', rows: 3, id: `${idBase}-note`,
    placeholder: 'اكتب الملاحظة كما قرأتها من صفحة الكتاب…',
    'aria-label': `ملاحظة على ${it.id}`,
  });
  noteBox.value = c().note || '';
  const noteWrap = h('div', { class: 'qrv-notewrap' },
    h('label', { class: 'small muted', for: `${idBase}-note` }, 'الملاحظة'), noteBox);
  noteBox.addEventListener('input', () => {
    onChange(it.id, { ...c(), decision: 'note', note: noteBox.value, at: Date.now() }, false);
  });
  noteWrap.hidden = c().decision !== 'note';

  const radios = CTX_DECISIONS.map((d) => h('label', { class: 'qrv-choice' },
    h('input', {
      type: 'radio', name: `${idBase}-dec`, value: d.id, id: `${idBase}-${d.id}`,
      checked: c().decision === d.id,
      onchange: () => {
        onChange(it.id, {
          decision: d.id, note: d.id === 'note' ? noteBox.value : '', at: Date.now(),
        }, true);
        noteWrap.hidden = d.id !== 'note';
        if (d.id === 'note') noteBox.focus();
      },
    }),
    h('span', {}, d.label)));

  const src = it.quran.sources || [];
  const ayahTxt = src.length
    ? src.map((s) => `${s.surah}:${s.ayah} — ${s.type} (من ${ar(s.from)} إلى ${ar(s.to)})`).join(' · ')
    : 'لا مقطع داخل قوسَي الاقتباس';

  return h('section', {
    class: 'card qrv-card ctx-card', id: `c-${it.id.replace(/\//g, '-')}`,
    'data-item-id': it.id, 'data-decided': c().decision ? '1' : '0',
  },
  h('header', { class: 'qrv-card__h' },
    h('h2', { class: 'qrv-card__ttl' }, `${it.lessonTitle} — ${KIND_AR[it.kind] || it.kind}`),
    h('span', { class: 'chip qrv-status' }, it.status)),
  h('dl', { class: 'qrv-fields' },
    field('المعرّف', h('code', {}, it.id)),
    field('الوحدة والدرس', `${it.unit} — ${it.unitTitle} · ${it.lesson} — ${it.lessonTitle}`),
    field('نوع العنصر', KIND_AR[it.kind] || it.kind),
    field('السورة والآية', ayahTxt),
    field('صفحة الكتاب', ar(it.page || '—')),
    field('مصدر الصياغة', h('span', { class: 'chip' }, it.sourceLabel))),

  h('div', { class: 'ctx-learner' },
    h('h3', { class: 'ctx-sub' }, 'العنصر كاملًا كما يراه المتعلّم'),
    ...learnerView(it.view),
    h('a', {
      class: 'btn btn--sm ctx-open', href: it.route,
    }, 'افتح العنصر داخل درس المتعلّم')),

  it.bookAnchors && it.bookAnchors.length
    ? h('details', { class: 'qrv-det' },
      h('summary', {}, `النصّ المقابل من الكتاب (${ar(it.bookAnchors.length)})`),
      h('ul', { class: 'ctx-anchors' }, ...it.bookAnchors.map((a) => h('li', {},
        h('span', { class: 'muted small' }, `${a.cardId} · ${a.type} · ص ${ar(a.page || '—')} `),
        qtext(a.text, 'div', 'ctx-anchor')))))
    : null,

  h('details', { class: 'qrv-det', open: true },
    h('summary', {}, `صورة موضع المصدر — صفحة ${ar(it.page || '—')}، وتقبل التكبير`),
    it.image ? zoomer(new URL(it.image, IMG_BASE).href, `صفحة الكتاب ${it.page}`)
      : h('p', { class: 'small muted' }, 'لا صورة لهذه الصفحة في سجلّ المراجعة.')),

  checkList('الجانب الأول — سلامة النصّ القرآني',
    it.quran.verdict, it.quran.checks, it.quran.warnings),
  checkList('الجانب الثاني — سلامة السياق التعليمي',
    it.context.verdict, it.context.checks, it.context.warnings),
  h('p', { class: 'small muted ctx-indep' },
    'الفحصان مستقلّان: نجاح التدقيق القرآني ليس دليلًا على صحّة السؤال '
    + 'أو الشرح المحيط بالآية.'),

  h('fieldset', { class: 'qrv-dec' },
    h('legend', { class: 'small' }, 'قرار المراجعة — لا يُعدّ اعتمادًا'),
    h('div', { class: 'qrv-choices' }, radios),
    noteWrap));
}

/* --------------------------------------------------------------- التصدير */
const COLS = ['المعرّف', 'الوحدة', 'الدرس', 'نوع العنصر', 'السورة والآية',
  'صفحة الكتاب', 'النصّ القرآني', 'النصّ الكامل للعنصر', 'الإجابة الصحيحة',
  'تفسير الإجابة', 'مصدر الصياغة', 'نتيجة التدقيق القرآني', 'نتيجة فحص السياق',
  'حالة الاعتماد الحالية', 'قرار المقابلة البشرية', 'الملاحظة', 'وقت القرار'];

function fullText(v) {
  if (v.kind === 'summary') return (v.points || []).map((p) => `• ${p}`).join('\n');
  const out = [];
  if (v.prompt) out.push(v.prompt);
  if (v.before || v.after) out.push(`${v.before || ''} ____ ${v.after || ''}`);
  (v.options || []).forEach((o, i) => out.push(`${i === v.answer ? '✔' : '—'} ${o}`));
  (v.items || []).forEach((t) => out.push(`• ${t}`));
  (v.pairs || []).forEach((p) => out.push(`${p[0]} ⟵ ${p[1]}`));
  (v.groups || []).forEach((g) => out.push(`${g.name}: ${(g.items || []).join(' · ')}`));
  if (v.why) out.push(`التفسير: ${v.why}`);
  return out.join('\n');
}

function row(it, c) {
  const d = CTX_DECISIONS.find((x) => x.id === c.decision);
  const q = (it.quran.sources || []).map((s) => `${s.surah}:${s.ayah}`).join(' · ');
  const qt = (it.quran.sources || []).map((s) => s.segment).join(' ');
  return [it.id, it.unit, it.lesson, KIND_AR[it.kind] || it.kind, q,
    it.page, qt, fullText(it.view), it.view.answerText || '', it.view.why || '',
    it.sourceLabel, it.quran.verdict, it.context.verdict, it.status,
    d ? d.label : 'لم يُراجَع بعد', c.note || '',
    c.at ? new Date(c.at).toISOString() : ''];
}

function toCSV(data, checks) {
  const esc = (v) => `"${String(v === undefined || v === null ? '' : v).replace(/"/g, '""')}"`;
  return '﻿' + [COLS.map(esc).join(','),
    ...data.items.map((it) => row(it, checks[it.id] || {}).map(esc).join(','))].join('\r\n');
}

function toJSON(data, checks) {
  return JSON.stringify({
    note: 'مراجعة سياقات، لا اعتماد. لم يتغيّر أيّ نصّ ولا سؤال ولا إجابة.',
    generatedAt: new Date().toISOString(),
    batch: data.count,
    decisions: data.items.map((it) => {
      const r = row(it, checks[it.id] || {});
      return Object.fromEntries(COLS.map((k, i) => [k, r[i]]));
    }),
  }, null, 1);
}

/* ------------------------------------------------------------------ الشاشة */
export function contextReviewScreen(data) {
  const checks = loadCtxChecks();
  const wrap = h('div', { class: 'container section stack qrv ctx' });

  const counter = h('p', { class: 'qrv-count', role: 'status' });
  const bar = h('div', { class: 'progress' }, h('div', { class: 'progress__bar' }));
  const done = () => data.items.filter((t) => (checks[t.id] || {}).decision).length;
  const jump = h('button', {
    class: 'btn btn--primary btn--sm', type: 'button',
    onclick: () => {
      const next = data.items.find((t) => !(checks[t.id] || {}).decision);
      if (!next) { toast('لا يوجد عنصر غير مراجَع.'); return; }
      const el = document.getElementById(`c-${next.id.replace(/\//g, '-')}`);
      if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      announce(`انتقلنا إلى ${next.lessonTitle}`);
    },
  }, 'الانتقال إلى أول عنصر غير مراجَع');
  const refresh = () => {
    const n = done();
    counter.textContent = `تمت مراجعة ${ar(n)} من ${ar(data.count)}`;
    bar.firstChild.style.width = `${(n / data.count) * 100}%`;
    jump.disabled = n >= data.count;
  };
  const onChange = (id, val, mark) => {
    checks[id] = val;
    saveCtxChecks(checks);
    refresh();
    if (mark) {
      const card = wrap.querySelector(`[data-item-id="${CSS.escape(id)}"]`);
      if (card) card.dataset.decided = '1';
    }
  };

  const flagged = data.items.filter((i) => i.quran.verdict.includes('⚠️')).length;

  wrap.append(
    h('h1', {}, 'مراجعة السياقات القرآنية'),
    h('div', { class: 'card qrv-notice' },
      h('p', {},
        h('strong', {}, 'دفعةُ إعدادٍ ومقابلة، لا اعتماد. '),
        `${ar(data.count)} عنصرًا تحوي نصًّا قرآنيًّا ولم تُعتمد. `
        + 'وقرارك هنا لا يغيّر حالة عنصر، ولا يعدّل نصًّا ولا سؤالًا ولا إجابة.'),
      h('p', { class: 'small muted' },
        `الحالة العامّة: ${ar(data.scope.approved)} معتمَدًا · `
        + `${ar(data.scope.pending)} بانتظار المراجعة · `
        + `هذه الدفعة ${ar(data.count)} · خارجها ${ar(data.scope.outsideBatch)} عنصرًا لا نصّ قرآني فيها.`),
      flagged
        ? h('p', { class: 'small' },
          h('span', { class: 'chip chip--warn' }, `${ar(flagged)} عنصرًا يحتاج نظرًا`),
          ' — انظر تنبيهات الفحص القرآني في بطاقتيهما.')
        : null),
    h('div', { class: 'qrv-top stack' }, counter, bar, jump),
    ...data.items.map((it) => itemCard(it, checks, onChange)),
    h('section', { class: 'card stack' },
      h('h2', {}, 'تصدير قرارات المراجعة'),
      h('p', { class: 'small muted' },
        'محفوظة في هذا المتصفّح وحده، في مفتاح مستقلّ عن حالة الاعتماد '
        + 'وعن قرارات الدفعة الأولى.'),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn btn--sm', type: 'button',
          onclick: (e) => {
            const host = e.target.closest('section');
            host.querySelector('.qrv-exportbox')?.remove();
            host.append(exportPanel('context-review.csv', toCSV(data, checks)));
          },
        }, 'تصدير CSV'),
        h('button', {
          class: 'btn btn--sm', type: 'button',
          onclick: (e) => {
            const host = e.target.closest('section');
            host.querySelector('.qrv-exportbox')?.remove();
            host.append(exportPanel('context-review.json', toJSON(data, checks)));
          },
        }, 'تصدير JSON'))),
  );
  refresh();

  const topbar = document.getElementById('topbar');
  const setOffset = () => {
    const px = topbar ? Math.round(topbar.getBoundingClientRect().height) : 0;
    wrap.style.setProperty('--qrv-top-offset', `${px}px`);
  };
  setOffset();
  if (topbar && 'ResizeObserver' in window) {
    const ro = new ResizeObserver(setOffset);
    ro.observe(topbar);
    new MutationObserver((_m, obs) => {
      if (!wrap.isConnected) { ro.disconnect(); obs.disconnect(); }
    }).observe(document.getElementById('view') || document.body, { childList: true });
  }
  return wrap;
}

export function contextReviewHiddenScreen() {
  return h('div', { class: 'container container--narrow section' },
    h('div', { class: 'card center stack' },
      icon(ICONS.review, 28),
      h('h1', {}, 'الصفحة غير متاحة'),
      h('p', { class: 'muted' },
        'صفحة «مراجعة السياقات القرآنية» خاصّة بالمعاينة، ولا تظهر إلا بتفعيل '
        + '«وضع مراجعة المحتوى».')));
}
