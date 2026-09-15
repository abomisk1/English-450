/**
 * صفحة «مراجعة النصوص القرآنية» — للمعاينة الخاصة وحدها.
 *
 * تعرض النصوص الأربعة والعشرين، ولكل نصّ عشرة حقول تُمكّن المراجعَ من
 * مقابلة النصّ بصورة صفحة الكتاب بعينه. وقرار المقابلة البصرية يُحفظ
 * محليًّا في مفتاح مستقلّ عن حالة البرنامج، ولا يمسّ «حالة الاعتماد»
 * ولا يعدّل نصًّا قرآنيًّا، ولا ينتقل إلى ملفات المحتوى.
 */

import { h, icon, ICONS, ar, toast, announce } from '../lib/dom.js';
import { qtext } from './widgets.js';

const DATA = new URL('../../docs/quran-review/review-data.json', import.meta.url);
export const IMG_BASE = new URL('../../docs/quran-review/', import.meta.url);

/* مفتاح مستقلّ تمامًا عن bay.state.v1، فلا يختلط قرار المقابلة بحالة المحتوى. */
export const CHECK_KEY = 'bay.quran.visualcheck.v1';

export const DECISIONS = [
  { id: 'matched', label: 'طابقته بصريًّا: مطابق' },
  { id: 'note', label: 'توجد ملاحظة' },
  { id: 'blocked', label: 'تعذّر التحقّق' },
];

/** هل نحن داخل المعاينة الخاصة **وفي وضع المراجعة**؟ */
export function quranReviewVisible(prefs) {
  return !!(window.__BAY_REVIEW_PREVIEW__ && prefs && prefs.reviewLabels);
}

export function loadChecks() {
  try {
    const raw = localStorage.getItem(CHECK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

function saveChecks(c) {
  try { localStorage.setItem(CHECK_KEY, JSON.stringify(c)); } catch (_) { /* لا شيء */ }
}

let CACHE = null;
export async function loadReviewData() {
  if (!CACHE) {
    const res = await fetch(DATA, { cache: 'no-cache' });
    if (!res.ok) throw new Error('تعذّر تحميل بيانات مراجعة النصوص القرآنية.');
    CACHE = await res.json();
  }
  return CACHE;
}

/* ------------------------------------------------------------ تكبير الصورة */
/**
 * عارض الصورة: الصفحة كاملة، ويُكبَّر موضع الآية بلا فقد وضوح (PNG بلا ضغط
 * فاقد، ٣٠٠ نقطة/بوصة). والتمرير داخل الإطار وحده، فلا يُزاح جسم الصفحة.
 */
export function zoomer(src, alt) {
  const img = h('img', {
    src, alt, class: 'qrv-img', loading: 'lazy', decoding: 'async',
  });
  const pane = h('div', { class: 'qrv-pane' }, img);
  let z = 1;
  const apply = (next) => {
    z = Math.min(6, Math.max(1, Math.round(next * 100) / 100));
    img.style.width = `${z * 100}%`;
    out.setAttribute('aria-valuenow', String(Math.round(z * 100)));
    lbl.textContent = `${ar(Math.round(z * 100))}٪`;
    pane.classList.toggle('is-zoomed', z > 1);
  };
  const lbl = h('span', { class: 'small muted qrv-zoom__lbl' }, '١٠٠٪');
  const btn = (t, aria, fn) => h('button', {
    class: 'btn btn--quiet btn--icon', type: 'button', 'aria-label': aria, onclick: fn,
  }, t);
  const out = h('div', {
    class: 'qrv-zoom', role: 'group', 'aria-label': `تكبير ${alt}`,
    'aria-valuenow': '100',
  },
  btn('−', 'تصغير', () => apply(z - 0.5)),
  lbl,
  btn('+', 'تكبير', () => apply(z + 0.5)),
  h('button', {
    class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => apply(1),
  }, 'إعادة الضبط'));
  // النقر على الصورة يكبّر تدريجيًّا، ثم يعود إلى الأصل.
  img.addEventListener('click', () => apply(z >= 3 ? 1 : z + 1));
  apply(1);
  return h('div', { class: 'qrv-figure' }, pane, out);
}

/* ---------------------------------------------------------------- التصدير */
function toCSV(data, checks) {
  const cols = ['المعرّف', 'السورة والآية', 'الوحدة', 'الدرس', 'البطاقة', 'الصفحة',
    'النصّ في البرنامج', 'المقارنة الحرفية', 'خلاف المصدرين',
    'حالة المراجعة', 'قرار المقابلة البصرية', 'الملاحظة', 'وقت القرار'];
  const esc = (v) => `"${String(v === undefined || v === null ? '' : v).replace(/"/g, '""')}"`;
  const rows = data.texts.map((t) => {
    const c = checks[t.id] || {};
    const d = DECISIONS.find((x) => x.id === c.decision);
    return [t.id, `${t.surah}`, t.unit, t.lesson, t.card, t.page, t.prog,
      t.rawPrimary, (t.sourceDiff || []).join(' / '), t.status,
      d ? d.label : 'لم يُراجَع بعد', c.note || '',
      c.at ? new Date(c.at).toISOString() : ''].map(esc).join(',');
  });
  return '﻿' + [cols.map(esc).join(','), ...rows].join('\r\n');
}

function toJSON(data, checks) {
  return JSON.stringify({
    note: 'قرارات مقابلة بصرية فقط. ليست اعتمادًا للمحتوى، ولم تغيّر أيّ نصّ.',
    generatedAt: new Date().toISOString(),
    primary: data.primary,
    decisions: data.texts.map((t) => ({
      id: t.id, surah: t.surah, page: t.page, status: t.status,
      ...(checks[t.id] || { decision: null }),
    })),
  }, null, 1);
}

/**
 * التصدير: تنزيلٌ حيث يسمح المتصفّح، ونصٌّ قابل للنسخ دائمًا — لأنّ إطار
 * المعاينة قد يمنع التنزيل، فلا يصحّ أن يضيع القرار بصمت.
 */
export function exportPanel(name, text) {
  const box = h('textarea', {
    class: 'qrv-export', readonly: true, rows: 8, 'aria-label': `محتوى ${name}`,
  });
  box.value = text;
  let url = null;
  try { url = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); } catch (_) { /* */ }
  return h('div', { class: 'qrv-exportbox stack' },
    h('div', { class: 'row' },
      url && h('a', { class: 'btn btn--sm', href: url, download: name }, `تنزيل ${name}`),
      h('button', {
        class: 'btn btn--sm', type: 'button',
        onclick: () => {
          box.select();
          const ok = (navigator.clipboard && navigator.clipboard.writeText(text)) || document.execCommand('copy');
          Promise.resolve(ok).then(() => toast('نُسخ إلى الحافظة.')).catch(() => toast('انسخ من الصندوق أدناه.'));
        },
      }, 'نسخ المحتوى')),
    box);
}

/* ----------------------------------------------------------------- البطاقة */
export function field(label, ...body) {
  return h('div', { class: 'qrv-field' },
    h('dt', { class: 'qrv-field__k small muted' }, label),
    h('dd', { class: 'qrv-field__v' }, ...body));
}

function textCard(t, checks, onChange) {
  const c = () => checks[t.id] || {};
  const idBase = `qrv-${t.id.replace(/\W/g, '-')}`;

  const noteBox = h('textarea', {
    class: 'input qrv-note', rows: 3, id: `${idBase}-note`,
    placeholder: 'اكتب الملاحظة كما قرأتها من صفحة الكتاب…',
    'aria-label': `ملاحظة على ${t.surah}`,
  });
  noteBox.value = c().note || '';
  const noteWrap = h('div', { class: 'qrv-notewrap' },
    h('label', { class: 'small muted', for: `${idBase}-note` }, 'الملاحظة'), noteBox);
  noteBox.addEventListener('input', () => {
    onChange(t.id, { ...c(), decision: 'note', note: noteBox.value, at: Date.now() }, false);
  });

  const radios = DECISIONS.map((d) => {
    const input = h('input', {
      type: 'radio', name: `${idBase}-dec`, value: d.id, id: `${idBase}-${d.id}`,
      checked: c().decision === d.id,
      onchange: () => {
        onChange(t.id, { decision: d.id, note: d.id === 'note' ? noteBox.value : '', at: Date.now() }, true);
        noteWrap.hidden = d.id !== 'note';
        if (d.id === 'note') noteBox.focus();
      },
    });
    return h('label', { class: 'qrv-choice' }, input, h('span', {}, d.label));
  });
  noteWrap.hidden = c().decision !== 'note';

  const verses = t.verses.map((v) => h('div', { class: 'qrv-verse' },
    h('div', { class: 'small muted' }, `الآية ${ar(v.ayah)}${v.full ? ' — آية كاملة' : ' — اقتباس جزئي'}`),
    field('النصّ الحالي في البرنامج', qtext(`﴿${v.prog}﴾`, 'div', 'qrv-t')),
    field('النصّ من المرجع الأساسي', qtext(`﴿${v.refPrimary}﴾`, 'div', 'qrv-t')),
    field('نتيجة المقارنة الحرفية الخام',
      h('span', { class: v.raw && v.raw.includes('⚠️') ? 'chip chip--warn' : 'chip chip--ok' },
        v.raw || '—')),
    v.sourcesAgree && v.sourcesAgree !== 'متطابقان'
      ? field('الفرق بين المصدرين',
        h('span', { class: 'chip chip--warn' }, v.sourcesAgree),
        h('div', { class: 'qrv-t small' }, qtext(`﴿${v.refWitness}﴾`, 'span')),
        h('p', { class: 'small muted' }, 'مسجَّل للمراجعة البشرية، ولم يُحسم آليًّا.'))
      : field('الفرق بين المصدرين', h('span', { class: 'chip chip--ok' }, 'لا فرق')),
  ));

  const places = h('ul', { class: 'qrv-places small' },
    t.places.map((p) => h('li', {},
      h('span', { class: 'muted' }, `${p.lesson} · ${p.where} — ${p.kind} (آية ${ar(p.ayah)})`),
      ' ', qtext(p.text, 'span'))));

  return h('section', {
    class: 'card qrv-card', id: `t-${t.id.replace('/', '-')}`,
    'data-text-id': t.id, 'data-decided': c().decision ? '1' : '0',
  },
  h('header', { class: 'qrv-card__h' },
    h('h2', { class: 'qrv-card__ttl' }, t.surah),
    h('span', {
      class: t.status === 'معتمد' ? 'chip chip--ok qrv-status' : 'chip qrv-status',
    }, t.status),
    t.approvedAt && h('span', { class: 'small muted' },
      `اعتُمد في ${t.approvedAt.slice(0, 10)}`)),
  h('dl', { class: 'qrv-fields' },
    field('الوحدة والدرس والبطاقة',
      `${t.unit} — ${t.unitTitle} · ${t.lesson} — ${t.lessonTitle} · ${t.card}`),
    field('صفحة الكتاب', ar(t.page)),
  ),
  h('div', { class: 'qrv-verses' }, verses),
  h('details', { class: 'qrv-det' },
    h('summary', {}, `مواضع ظهوره في البرنامج (${ar(t.places.length)})`), places),
  h('details', { class: 'qrv-det', open: true },
    h('summary', {}, `صورة صفحة الكتاب ${ar(t.page)} — كاملةً، وتقبل التكبير`),
    t.image ? zoomer(new URL(t.image, IMG_BASE).href, `صفحة الكتاب ${t.page}`)
      : h('p', { class: 'small' }, 'الصورة غير متاحة.')),
  h('fieldset', { class: 'qrv-dec' },
    h('legend', { class: 'small' }, 'قرار المقابلة البصرية — لا يُعدّ اعتمادًا'),
    h('div', { class: 'qrv-choices' }, radios),
    noteWrap));
}

/* ------------------------------------------------------------------ الشاشة */
export function quranReviewScreen(data) {
  const checks = loadChecks();
  const wrap = h('div', { class: 'container section stack qrv' });

  const counter = h('p', { class: 'qrv-count', role: 'status' });
  const bar = h('div', { class: 'progress' }, h('div', { class: 'progress__bar' }));
  const done = () => data.texts.filter((t) => (checks[t.id] || {}).decision).length;
  const refresh = () => {
    const n = done();
    counter.textContent = `تمت مراجعة ${ar(n)} من ${ar(data.texts.length)}`;
    bar.firstChild.style.width = `${(n / data.texts.length) * 100}%`;
    jump.disabled = n >= data.texts.length;
  };
  const jump = h('button', {
    class: 'btn btn--primary btn--sm', type: 'button',
    onclick: () => {
      const next = data.texts.find((t) => !(checks[t.id] || {}).decision);
      if (!next) { toast('لا يوجد نصّ غير مراجَع.'); return; }
      const el = document.getElementById(`t-${next.id.replace('/', '-')}`);
      if (el) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); el.focus?.(); }
      announce(`انتقلنا إلى ${next.surah}`);
    },
  }, 'انتقل إلى أول نصّ غير مراجَع');

  const onChange = (id, val, rerender) => {
    checks[id] = val;
    saveChecks(checks);
    refresh();
    if (rerender) {
      const card = wrap.querySelector(`[data-text-id="${CSS.escape(id)}"]`);
      if (card) card.dataset.decided = '1';
    }
  };

  wrap.append(
    h('h1', {}, 'مراجعة النصوص القرآنية'),
    h('div', { class: 'card qrv-notice' },
      h('p', {}, data.approved
        ? [h('strong', {}, `اعتُمدت ${ar(data.approved)} من النصوص القرآنية. `),
          `والاعتماد محصور فيها وحدها: بقيّة عناصر المراجعة — `
          + `${ar(data.pendingTotal)} عنصرًا — ما تزال «بانتظار المراجعة». `
          + 'وقرارات هذه الصفحة مقابلةٌ بصرية لا اعتماد؛ الاعتماد يصدر '
          + 'باستيراد مستقلّ بعد مراجعتك.']
        : [h('strong', {}, 'هذه صفحة مقابلة بصرية، لا اعتماد. '),
          'كل النصوص باقية «بانتظار المراجعة»، ولا يغيّر أيّ قرار هنا حالتها، '
          + 'ولا يعدّل نصًّا قرآنيًّا، ولا ينتقل إلى ملفات المحتوى.']),
      h('p', { class: 'small muted' },
        `المرجع الأساسي: ${data.primary} · الشاهد المستقلّ: ${data.witness} · `
        + `الحالات غير المحسومة: ${ar(data.unresolved)}`)),
    h('div', { class: 'qrv-top stack' }, counter, bar, jump),
    ...data.texts.map((t) => textCard(t, checks, onChange)),
    h('section', { class: 'card stack' },
      h('h2', {}, 'تصدير قرارات المقابلة'),
      h('p', { class: 'small muted' },
        'القرارات محفوظة في هذا المتصفّح وحده، في مفتاح مستقلّ عن حالة البرنامج.'),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn btn--sm', type: 'button',
          onclick: (e) => {
            const host = e.target.closest('section');
            host.querySelector('.qrv-exportbox')?.remove();
            host.append(exportPanel('quran-visual-check.csv', toCSV(data, checks)));
          },
        }, 'تصدير CSV'),
        h('button', {
          class: 'btn btn--sm', type: 'button',
          onclick: (e) => {
            const host = e.target.closest('section');
            host.querySelector('.qrv-exportbox')?.remove();
            host.append(exportPanel('quran-visual-check.json', toJSON(data, checks)));
          },
        }, 'تصدير JSON'))),
  );
  refresh();

  /*
   * الشريط العلويّ لاصقٌ بأعلى النافذة، فيجب أن يبدأ مؤشّر التقدّم تحته لا
   * خلفه. وارتفاعه يتغيّر بتكبير الخطّ، فيُقاس عند العرض وعند كل تغيّر.
   */
  const topbar = document.getElementById('topbar');
  const setOffset = () => {
    const px = topbar ? Math.round(topbar.getBoundingClientRect().height) : 0;
    wrap.style.setProperty('--qrv-top-offset', `${px}px`);
  };
  setOffset();
  if (topbar && 'ResizeObserver' in window) {
    const ro = new ResizeObserver(setOffset);
    ro.observe(topbar);
    // يتوقّف الرصد متى خرجت الصفحة من الشجرة، فلا يتسرّب مراقبٌ معلّق.
    new MutationObserver((_m, obs) => {
      if (!wrap.isConnected) { ro.disconnect(); obs.disconnect(); }
    }).observe(document.getElementById('view') || document.body, { childList: true });
  }
  return wrap;
}

export function quranReviewHiddenScreen() {
  return h('div', { class: 'container container--narrow section' },
    h('div', { class: 'card center stack' },
      icon(ICONS.review, 28),
      h('h1', {}, 'الصفحة غير متاحة'),
      h('p', { class: 'muted' },
        'صفحة «مراجعة النصوص القرآنية» خاصّة بالمعاينة، ولا تظهر إلا بتفعيل '
        + '«وضع مراجعة المحتوى».')));
}
