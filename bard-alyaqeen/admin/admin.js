/**
 * لوحة إدارة المحتوى والمراجعة الشرعية.
 *
 * قرارات المراجعة والتحريرات تُحفظ في متصفح المراجع (localStorage) ولا تُكتب
 * في ملفات المحتوى. الاعتماد النهائي يتمّ بتصدير الملف وتطبيقه على المحتوى.
 */

import { h, ar, toast, icon, ICONS } from '../js/lib/dom.js';
import { normalizeAr } from '../js/lib/content.js';

const BASE = '../content/';
const view = document.getElementById('view');

const KIND_AR = {
  'card:quran': 'نصّ قرآني',
  'card:note': 'ملحوظة تعليمية',
  'hook': 'مدخل الدرس',
  'objective': 'هدف الدرس',
  'summary': 'خلاصة الدرس',
  'family': 'سؤال النقاش الأسري',
  'interaction:scenario': 'موقف تطبيقي (داخل الدرس)',
  'quiz:scenario': 'موقف تطبيقي (في الاختبار)',
};
const SRC_AR = { quran: 'نصّ قرآني', authored: 'صياغة تعليمية مساعدة', book: 'منقول من الكتاب' };
const STATUS_AR = { pending: 'بانتظار المراجعة', approved: 'معتمَد', 'needs-change': 'يحتاج تعديلًا' };

/* ------------------------- تخزين قرارات المراجعة ------------------------- */
const RK = 'bay.review.v2';
function loadDecisions() {
  try { return JSON.parse(localStorage.getItem(RK) || '{}'); } catch (_) { return {}; }
}
function saveDecisions(o) {
  try { localStorage.setItem(RK, JSON.stringify(o)); return true; } catch (_) { return false; }
}

async function getJSON(p) {
  const r = await fetch(BASE + p, { cache: 'no-cache' });
  if (!r.ok) throw new Error(p);
  return r.json();
}

/* ------------------------------- الأدوات ------------------------------- */

function highlight(text, query) {
  if (!query || query.trim().length < 2) return document.createTextNode(text);
  const nq = normalizeAr(query);
  const frag = document.createDocumentFragment();
  // نطابق على النصّ المطبَّع لكن نقصّ من النصّ الأصلي بمحاذاة الأحرف.
  const chars = [...text];
  const normPerChar = chars.map((c) => normalizeAr(c));
  let acc = '', map = [];
  chars.forEach((c, i) => { const n = normPerChar[i]; for (let k = 0; k < n.length; k++) map.push(i); acc += n; });
  let from = 0, at;
  let last = 0;
  while ((at = acc.indexOf(nq, from)) !== -1) {
    const s = map[at], e = (map[at + nq.length - 1] ?? map[map.length - 1]) + 1;
    if (s > last) frag.append(chars.slice(last, s).join(''));
    frag.append(h('mark', { class: 'hit' }, chars.slice(s, e).join('')));
    last = e; from = at + nq.length;
  }
  frag.append(chars.slice(last).join(''));
  return frag;
}

function csvEscape(v) {
  const s = String(v ?? '').replace(/\r?\n/g, ' ⏎ ');
  return /[",;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function download(name, blob) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* --------------------------------- البدء --------------------------------- */

async function boot() {
  let manifest, review, units;
  try {
    [manifest, review] = await Promise.all([getJSON('manifest.json'), getJSON('needs-review.json')]);
    units = await Promise.all(manifest.units.map((u) => getJSON(u.file)));
  } catch (_) {
    view.replaceChildren(h('div', { class: 'card' },
      h('h2', {}, 'تعذّر تحميل المحتوى'),
      h('p', { class: 'small muted' }, 'شغّل اللوحة عبر خادم ملفات محلي (لا عبر file://).')));
    return;
  }

  const items = review.items;
  const decisions = loadDecisions();
  const keyOf = (it) => it.path + '#' + it.kind;
  const dec = (it) => decisions[keyOf(it)] || { status: 'pending', note: '', edited: null };

  const paneHost = h('div', {});
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const addTab = (label, build) => {
    const b = h('button', { class: 'tabs__btn', type: 'button', role: 'tab' }, label);
    b.addEventListener('click', () => {
      [...tabs.children].forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      paneHost.replaceChildren(build());
      window.scrollTo({ top: 0 });
    });
    tabs.append(b);
    return b;
  };

  const statsBox = h('div', { class: 'card stack' });
  function paintStats() {
    const c = { pending: 0, approved: 0, 'needs-change': 0 };
    const byPrio = { high: 0, medium: 0, low: 0 };
    for (const it of items) {
      c[dec(it).status] = (c[dec(it).status] || 0) + 1;
      if (dec(it).status === 'pending') byPrio[it.priority]++;
    }
    const done = c.approved + c['needs-change'];
    statsBox.replaceChildren(
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('h2', { style: { margin: 0 } }, 'حالة المراجعة'),
        h('span', { class: 'small muted' }, `${ar(done)} / ${ar(items.length)} روجِعت`)),
      h('div', { class: 'progress progress--lg', role: 'progressbar',
        'aria-valuenow': Math.round(done / items.length * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 },
        h('div', { class: 'progress__bar', style: { width: `${done / items.length * 100}%` } })),
      h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('div', { class: 'stat__n' }, ar(items.length)), h('div', { class: 'stat__l' }, 'الإجمالي')),
        h('div', { class: 'stat stat--ok' }, h('div', { class: 'stat__n' }, ar(c.approved)), h('div', { class: 'stat__l' }, 'معتمَد')),
        h('div', { class: 'stat stat--err' }, h('div', { class: 'stat__n' }, ar(c['needs-change'])), h('div', { class: 'stat__l' }, 'يحتاج تعديلًا')),
        h('div', { class: 'stat stat--warn' }, h('div', { class: 'stat__n' }, ar(c.pending)), h('div', { class: 'stat__l' }, 'بانتظار المراجعة'))),
      h('div', { class: 'row' },
        h('span', { class: 'small muted' }, 'المتبقّي بحسب الأولوية:'),
        h('span', { class: 'chip chip--err' }, `عالية ${ar(byPrio.high)}`),
        h('span', { class: 'chip chip--warn' }, `متوسطة ${ar(byPrio.medium)}`),
        h('span', { class: 'chip chip--brand' }, `منخفضة ${ar(byPrio.low)}`)),
      h('p', { class: 'xsmall muted', style: { margin: 0 } }, review.policy),
    );
  }

  /* ---------------------------- قائمة المراجعة ---------------------------- */
  const state = { unit: '', kind: '', priority: '', status: '', q: '', page: 0, per: 25 };
  const PER_PAGE = 25;

  function matches(it) {
    const d = dec(it);
    if (state.unit && it.unitId !== state.unit) return false;
    if (state.kind && it.kind !== state.kind) return false;
    if (state.priority && it.priority !== state.priority) return false;
    if (state.status && d.status !== state.status) return false;
    if (state.q && state.q.trim().length >= 2) {
      const nq = normalizeAr(state.q);
      const hay = normalizeAr([it.text, d.edited || '', it.lesson, it.unit, d.note || '',
        (it.bookContext || {}).text || ''].join(' '));
      if (!hay.includes(nq)) return false;
    }
    return true;
  }

  function buildReviewList() {
    const wrap = h('div', { class: 'stack' });

    const mkSelect = (label, key, options) => {
      const sel = h('select', { class: 'select', 'aria-label': label },
        ...options.map((o) => h('option', { value: o.v, selected: state[key] === o.v }, o.l)));
      sel.addEventListener('change', () => { state[key] = sel.value; state.page = 0; paintList(); });
      return h('div', { class: 'filters__field' },
        h('label', { class: 'filters__label' }, label), sel);
    };

    const kinds = [...new Set(items.map((i) => i.kind))]
      .sort((a, b) => (KIND_AR[a] || a).localeCompare(KIND_AR[b] || b, 'ar'));

    const searchInput = h('input', {
      class: 'input', type: 'search', value: state.q,
      placeholder: 'ابحث في النصوص والملاحظات…', 'aria-label': 'البحث في نصوص المراجعة',
    });
    let t = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = searchInput.value; state.page = 0; paintList(); }, 220);
    });

    const filters = h('div', { class: 'filters' },
      h('div', { class: 'filters__grid' },
        mkSelect('الوحدة', 'unit', [{ v: '', l: 'كل الوحدات' },
          ...manifest.units.map((u) => ({ v: u.id, l: `${ar(u.order)}. ${u.shortTitle}` }))]),
        mkSelect('نوع العنصر', 'kind', [{ v: '', l: 'كل الأنواع' },
          ...kinds.map((k) => ({ v: k, l: KIND_AR[k] || k }))]),
        mkSelect('الأولوية', 'priority', [{ v: '', l: 'كل الأولويات' },
          { v: 'high', l: 'عالية' }, { v: 'medium', l: 'متوسطة' }, { v: 'low', l: 'منخفضة' }]),
        mkSelect('حالة الاعتماد', 'status', [{ v: '', l: 'كل الحالات' },
          { v: 'pending', l: 'بانتظار المراجعة' }, { v: 'approved', l: 'معتمَد' },
          { v: 'needs-change', l: 'يحتاج تعديلًا' }]),
      ),
      h('div', { class: 'filters__field', style: { marginTop: '.5rem' } },
        h('label', { class: 'filters__label' }, 'البحث في النصوص'), searchInput),
      h('div', { class: 'row', style: { marginTop: '.5rem', justifyContent: 'space-between' } },
        h('button', {
          class: 'btn btn--quiet btn--sm', type: 'button',
          onclick: () => {
            Object.assign(state, { unit: '', kind: '', priority: '', status: '', q: '', page: 0 });
            paintList(); buildAndReplace();
          },
        }, 'إعادة ضبط التصفية'),
        h('span', { class: 'small muted', id: 'rv-count' }, '')),
    );

    const listHost = h('div', { class: 'stack' });
    const pagerHost = h('div', { class: 'pager' });

    function buildAndReplace() {
      const fresh = buildReviewList();
      paneHost.replaceChildren(fresh);
    }

    function paintList() {
      const rows = items.filter(matches);
      const countEl = filters.querySelector('#rv-count');
      if (countEl) countEl.textContent = `${ar(rows.length)} عنصرًا مطابقًا`;

      const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
      state.page = Math.min(state.page, pages - 1);
      const slice = rows.slice(state.page * PER_PAGE, (state.page + 1) * PER_PAGE);

      listHost.replaceChildren();
      if (!rows.length) {
        listHost.append(h('div', { class: 'empty' },
          h('div', { class: 'empty__icon' }, '🔍'),
          h('h3', {}, 'لا عناصر مطابقة'),
          h('p', { class: 'muted' }, 'غيّر التصفية أو كلمة البحث.')));
      }
      for (const it of slice) listHost.append(renderItem(it));

      pagerHost.replaceChildren(
        h('button', {
          class: 'btn btn--ghost btn--sm', type: 'button', disabled: state.page === 0,
          onclick: () => { state.page--; paintList(); window.scrollTo({ top: 0 }); },
        }, 'السابق'),
        h('span', { class: 'small muted' }, `صفحة ${ar(state.page + 1)} من ${ar(pages)}`),
        h('button', {
          class: 'btn btn--ghost btn--sm', type: 'button', disabled: state.page >= pages - 1,
          onclick: () => { state.page++; paintList(); window.scrollTo({ top: 0 }); },
        }, 'التالي'),
      );
    }

    function renderItem(it) {
      const d = dec(it);
      const isQuran = it.src === 'quran';
      const card = h('article', { class: `card stack rv rv--${it.priority}` });

      const statusChip = h('span', {
        class: 'chip ' + (d.status === 'approved' ? 'chip--ok'
          : d.status === 'needs-change' ? 'chip--err' : 'chip--warn'),
      }, STATUS_AR[d.status]);

      const dirty = h('span', { class: 'rv__dirty' },
        d.edited != null && d.edited !== it.text ? '✎ نصّ محرَّر' : '');

      card.append(h('div', { class: 'rv__head' },
        h('span', { class: 'row', style: { gap: '.4rem' } },
          h('span', { class: 'rv__seq' }, ar(it.seq)),
          h('span', { class: 'chip ' + (isQuran ? 'chip--brand' : 'chip--warn') }, KIND_AR[it.kind] || it.kind),
          h('span', {
            class: 'chip ' + (it.priority === 'high' ? 'chip--err'
              : it.priority === 'medium' ? 'chip--warn' : ''),
          }, `أولوية ${it.priorityAr}`)),
        h('span', { class: 'row', style: { gap: '.4rem' } }, dirty, statusChip)));

      card.append(h('div', { class: 'rv__crumb' },
        [`${it.unit}`, it.lesson, it.page ? `الكتاب ص ${ar(it.page)}` : null, it.ref, it.path]
          .filter(Boolean).join(' · ')));

      card.append(h('div', { class: 'rv__reason' },
        h('strong', {}, 'سبب المراجعة: '), it.reason));

      // النصّ — قابل للقراءة والتحرير قبل الاعتماد
      const current = d.edited != null ? d.edited : it.text;
      const editor = h('textarea', {
        class: `textarea rv__edit ${isQuran ? 'rv__edit--quran' : ''}`,
        value: current, 'aria-label': 'نصّ العنصر (قابل للتحرير قبل الاعتماد)',
        rows: Math.min(14, Math.max(3, current.split('\n').length + 1)),
      });
      const preview = h('div', { class: `rv__body ${isQuran ? 'quran' : 'book-text'}` });
      const paintPreview = () => {
        preview.replaceChildren(highlight(editor.value, state.q));
      };
      paintPreview();

      let editing = false;
      const editBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button' },
        icon(ICONS.gear, 16), 'تحرير النصّ');
      const holder = h('div', {});
      holder.append(preview);
      editBtn.addEventListener('click', () => {
        editing = !editing;
        holder.replaceChildren(editing ? editor : preview);
        editBtn.lastChild.textContent = editing ? 'إنهاء التحرير' : 'تحرير النصّ';
        if (editing) editor.focus();
        else paintPreview();
      });
      editor.addEventListener('input', () => {
        decisions[keyOf(it)] = { ...dec(it), edited: editor.value };
        saveDecisions(decisions);
        dirty.textContent = editor.value !== it.text ? '✎ نصّ محرَّر' : '';
      });
      card.append(holder);

      // مرساة من الكتاب بجوار الصياغة المستحدثة
      if (it.bookContext && !isQuran) {
        card.append(h('div', { class: 'rv__anchor' },
          h('span', { class: 'rv__anchor-label' },
            `نصّ الكتاب في هذا الدرس — ص ${ar(it.bookContext.page || it.page || '')}`),
          h('div', { class: 'rv__anchor-text' }, it.bookContext.text)));
      }
      if (isQuran) {
        card.append(h('div', { class: 'aid' },
          h('span', { class: 'aid__tag' }, 'تنبيه'),
          'هذا النصّ لم يُستخرج من ملف الكتاب — خطوط المصحف فيه لا تحمل ترميزًا نصيًّا — '
          + 'بل كُتب بالرسم العثماني. قابِله بالمصحف حرفًا وتشكيلًا، وتحقّق من حدود المقطع ورقم الآية.'));
      }

      // ملاحظة المراجع
      const note = h('textarea', {
        class: 'textarea', value: d.note || '', style: { minHeight: '64px' },
        placeholder: 'ملاحظة المراجع (تُصدَّر مع الملف)…', 'aria-label': 'ملاحظة المراجع',
      });
      note.addEventListener('input', () => {
        decisions[keyOf(it)] = { ...dec(it), note: note.value };
        saveDecisions(decisions);
      });
      card.append(note);

      const setStatus = (status) => {
        decisions[keyOf(it)] = {
          ...dec(it), status, note: note.value,
          edited: editor.value !== it.text ? editor.value : null,
          at: Date.now(),
        };
        saveDecisions(decisions);
        paintStats();
        paintList();
      };

      card.append(h('div', { class: 'rv__actions' },
        h('button', {
          class: 'btn btn--sm ' + (d.status === 'approved' ? 'btn--accent' : 'btn--ghost'),
          type: 'button', onclick: () => setStatus('approved'),
        }, '✓ معتمَد'),
        h('button', {
          class: 'btn btn--sm ' + (d.status === 'needs-change' ? 'btn--accent' : 'btn--ghost'),
          type: 'button', onclick: () => setStatus('needs-change'),
        }, '✎ يحتاج تعديلًا'),
        h('button', {
          class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => setStatus('pending'),
        }, 'إعادة للانتظار'),
        editBtn,
        h('a', {
          class: 'btn btn--quiet btn--sm', target: '_blank', rel: 'noopener',
          href: '../index.html' + it.route,
          title: 'فتح الدرس في واجهة المتعلّم',
        }, '↗ موضعه في البرنامج'),
      ));

      return card;
    }

    paintList();
    wrap.append(filters, listHost, pagerHost);
    return wrap;
  }

  /* ------------------------------- التصدير ------------------------------- */
  const COLS = [
    ['seq', 'م'],
    ['unit', 'الوحدة'],
    ['lesson', 'الدرس'],
    ['kindAr', 'نوع العنصر'],
    ['text', 'النص'],
    ['srcAr', 'المصدر'],
    ['page', 'صفحة الكتاب'],
    ['reason', 'سبب الحاجة إلى المراجعة'],
    ['priorityAr', 'الأولوية'],
    ['statusAr', 'حالة الاعتماد'],
    ['note', 'الملاحظات'],
    ['editedText', 'النص بعد التحرير'],
    ['bookText', 'نص الكتاب المرجعي'],
    ['ref', 'المرجع'],
    ['path', 'المعرّف'],
    ['route', 'موضعه في البرنامج'],
  ];

  function exportRows(onlyFiltered) {
    const src = onlyFiltered ? items.filter(matches) : items;
    return src.map((it) => {
      const d = dec(it);
      return {
        seq: it.seq,
        unit: it.unit,
        lesson: it.lesson,
        kindAr: KIND_AR[it.kind] || it.kind,
        text: it.text,
        srcAr: SRC_AR[it.src] || it.src,
        page: it.page || '',
        reason: it.reason,
        priorityAr: it.priorityAr,
        statusAr: STATUS_AR[d.status],
        note: d.note || '',
        editedText: d.edited != null && d.edited !== it.text ? d.edited : '',
        bookText: (it.bookContext || {}).text || '',
        ref: it.ref || '',
        path: it.path,
        route: it.route,
      };
    });
  }

  function exportCSV(onlyFiltered) {
    const rows = exportRows(onlyFiltered);
    // فاصلة منقوطة + BOM: يفتحه Excel العربي مباشرة بالترميز الصحيح.
    const lines = [COLS.map((c) => csvEscape(c[1])).join(';')];
    for (const r of rows) lines.push(COLS.map((c) => csvEscape(r[c[0]])).join(';'));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    download(`bard-al-yaqeen-review-${new Date().toISOString().slice(0, 10)}.csv`, blob);
    toast(`صُدِّر ${rows.length} عنصرًا.`);
  }

  function exportXLSX(onlyFiltered) {
    // جدول HTML بامتداد .xls — يفتحه Excel وLibreOffice مباشرة بلا مكتبات خارجية.
    const rows = exportRows(onlyFiltered);
    const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const head = COLS.map((c) => `<th>${esc(c[1])}</th>`).join('');
    const body = rows.map((r) => '<tr>' + COLS.map((c) => {
      const v = esc(r[c[0]]).replace(/\r?\n/g, '<br>');
      return `<td${c[0] === 'seq' || c[0] === 'page' ? ' x:num' : ''}>${v}</td>`;
    }).join('') + '</tr>').join('');
    const html = `<html dir="rtl"><head><meta charset="utf-8"><style>
      table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:11pt}
      th{background:#0c2f4a;color:#fff;border:1px solid #999;padding:6px;text-align:right}
      td{border:1px solid #ccc;padding:6px;vertical-align:top;text-align:right}
      tr:nth-child(even) td{background:#f6f6f6}
    </style></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    download(`bard-al-yaqeen-review-${new Date().toISOString().slice(0, 10)}.xls`,
      new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
    toast(`صُدِّر ${rows.length} عنصرًا إلى ملف Excel.`);
  }

  function exportJSON() {
    download('bard-al-yaqeen-review-decisions.json',
      new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), rows: exportRows(false) }, null, 1)],
        { type: 'application/json' }));
    toast('صُدِّرت القرارات.');
  }

  function importJSON(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const parsed = JSON.parse(fr.result);
        const byPath = new Map(items.map((i) => [i.path + '#' + i.kind, i]));
        let n = 0;
        for (const r of parsed.rows || []) {
          const it = byPath.get(r.path + '#' + (r.kind || ''))
            || items.find((i) => i.path === r.path);
          if (!it) continue;
          const status = Object.keys(STATUS_AR).find((k) => STATUS_AR[k] === r.statusAr) || 'pending';
          decisions[keyOf(it)] = {
            status, note: r.note || '',
            edited: r.editedText ? r.editedText : null, at: Date.now(),
          };
          n++;
        }
        saveDecisions(decisions);
        toast(`استُوردت قرارات ${n} عنصرًا.`);
        paintStats();
        paneHost.replaceChildren(buildReviewList());
      } catch (_) { toast('ملف غير صالح.'); }
    };
    fr.readAsText(file);
  }

  function buildExport() {
    const fileIn = h('input', {
      type: 'file', accept: '.json,application/json', class: 'sr-only',
      onchange: (e) => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; },
    });
    return h('div', { class: 'stack' },
      h('div', { class: 'card stack' },
        h('h2', { style: { marginTop: 0 } }, 'تصدير عناصر المراجعة'),
        h('p', { class: 'small muted' },
          'ملف منظَّم حسب الوحدة والدرس ونوع العنصر والصفحة، يتضمّن سبب الحاجة إلى المراجعة '
          + 'والأولوية وحالة الاعتماد والملاحظات — ليُراجَع خارج البرنامج ثم يُعاد استيراده.'),
        h('div', { class: 'scroll-x' },
          h('table', { class: 'tbl' },
            h('thead', {}, h('tr', {}, h('th', {}, 'العمود'), h('th', {}, 'المحتوى'))),
            h('tbody', {}, ...[
              ['م', 'رقم تسلسلي عامّ من ١ إلى ' + ar(items.length)],
              ['الوحدة', 'اسم الوحدة المختصر'],
              ['الدرس', 'عنوان الدرس'],
              ['نوع العنصر', 'مدخل / هدف / خلاصة / ملحوظة / موقف تطبيقي / نصّ قرآني / سؤال أسري'],
              ['النص', 'نصّ العنصر كاملًا كما يظهر للمتعلّم'],
              ['المصدر', 'نصّ قرآني — أو صياغة تعليمية مساعدة'],
              ['صفحة الكتاب', 'رقم الصفحة التي يستند إليها الدرس'],
              ['سبب الحاجة إلى المراجعة', 'مشروح لكل نوع على حدة'],
              ['الأولوية', 'عالية / متوسطة / منخفضة'],
              ['حالة الاعتماد', 'بانتظار المراجعة / معتمَد / يحتاج تعديلًا'],
              ['الملاحظات', 'ملاحظة المراجع'],
              ['النص بعد التحرير', 'يُملأ إن حرّر المراجع النصّ قبل اعتماده'],
              ['نص الكتاب المرجعي', 'نصّ من الكتاب في الدرس نفسه، للمقابلة'],
              ['المرجع', 'السورة والآية للنصوص القرآنية'],
              ['المعرّف', 'مسار العنصر داخل ملفات المحتوى'],
              ['موضعه في البرنامج', 'مسار الدرس في واجهة المتعلّم'],
            ].map(([a, b]) => h('tr', {}, h('td', {}, h('strong', {}, a)), h('td', {}, b)))))),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: () => exportXLSX(false) },
            '⬇ تصدير Excel (كل العناصر)'),
          h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => exportCSV(false) },
            '⬇ تصدير CSV (كل العناصر)'),
          h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => exportXLSX(true) },
            '⬇ تصدير المطابق للتصفية فقط'),
        ),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: exportJSON },
            'تصدير القرارات (JSON) للنسخ الاحتياطي'),
          h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => fileIn.click() },
            'استيراد قرارات من ملف'),
          fileIn),
      ),
      h('div', { class: 'card' },
        h('h3', { style: { marginTop: 0 } }, 'مسح القرارات'),
        h('p', { class: 'small muted' },
          'القرارات محفوظة في هذا المتصفح فقط. صدّرها قبل المسح.'),
        h('button', {
          class: 'btn btn--quiet btn--sm', style: { color: 'var(--c-err)' }, type: 'button',
          onclick: () => {
            if (confirm('مسح جميع قرارات المراجعة والتحريرات على هذا الجهاز؟')) {
              localStorage.removeItem(RK); location.reload();
            }
          },
        }, 'مسح جميع القرارات'),
      ),
    );
  }

  /* ---------------------------- خريطة المحتوى ---------------------------- */
  function buildContentMap() {
    const wrap = h('div', { class: 'stack' });
    wrap.append(h('div', { class: 'card' },
      h('h2', { style: { marginTop: 0 } }, 'إحصاءات المحتوى'),
      h('div', { class: 'stat-row' },
        ...Object.entries({
          'وحدات': manifest.stats.units, 'دروس': manifest.stats.lessons,
          'بطاقات': manifest.stats.cards, 'أسئلة': manifest.stats.quizItems,
          'مهام': manifest.stats.tasks, 'تحتاج مراجعة': manifest.stats.needsReview,
        }).map(([k, v]) => h('div', { class: 'stat' },
          h('div', { class: 'stat__n' }, ar(v)), h('div', { class: 'stat__l' }, k))))));

    for (const u of units) {
      const pending = items.filter((i) => i.unitId === u.id && dec(i).status === 'pending').length;
      wrap.append(h('div', { class: 'card' },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } },
          h('h3', { style: { margin: 0 } }, `${ar(u.order)}. ${u.title}`),
          h('span', { class: pending ? 'chip chip--warn' : 'chip chip--ok' },
            pending ? `${ar(pending)} بانتظار المراجعة` : 'روجِعت كاملة')),
        h('div', { class: 'small muted' },
          `ص ${ar(u.source.pages[0])}–${ar(u.source.pages[1])} · ${ar(u.tasks.length)} مهام أدائية `
          + `· ${ar(u.assessment.length)} أسئلة تحصيلية`),
        h('div', { class: 'scroll-x' },
          h('table', { class: 'tbl' },
            h('thead', {}, h('tr', {},
              h('th', {}, 'الدرس'), h('th', {}, 'ص'), h('th', {}, 'بطاقات'),
              h('th', {}, 'تفاعلات'), h('th', {}, 'أسئلة'), h('th', {}, 'مراجعة'), h('th', {}, ''))),
            h('tbody', {}, ...u.lessons.map((l) => {
              const p = items.filter((i) => i.lessonId === l.id && dec(i).status === 'pending').length;
              return h('tr', {},
                h('td', {}, l.title),
                h('td', {}, l.source.pages.map(ar).join('، ')),
                h('td', {}, ar(l.cards.length)),
                h('td', {}, ar(l.interactions.length)),
                h('td', {}, ar(l.quiz.length)),
                h('td', {}, p ? h('span', { class: 'chip chip--warn' }, ar(p)) : h('span', { class: 'chip chip--ok' }, '✓')),
                h('td', {}, h('a', {
                  class: 'btn btn--quiet btn--sm', target: '_blank', rel: 'noopener',
                  href: `../index.html#/lesson/${u.id}/${l.id}`,
                }, '↗')));
            }))))));
    }
    return wrap;
  }

  /* ------------------------------ دليل الإدارة ------------------------------ */
  function buildGuide() {
    return h('div', { class: 'card stack' },
      h('h2', { style: { marginTop: 0 } }, 'كيف تُراجع؟'),
      h('ol', { style: { lineHeight: '2', paddingInlineStart: '1.3rem' } },
        h('li', {}, h('strong', {}, 'ابدأ بالأولوية العالية: '),
          'صفِّ «الأولوية = عالية» — وهي ٢٤ نصًّا قرآنيًّا و٤ مواقف تُحتسب في الدرجة.'),
        h('li', {}, h('strong', {}, 'راجع وحدة وحدة: '),
          'صفِّ بالوحدة لتراجع سياقًا واحدًا متّصلًا بدل القفز بين الأبواب.'),
        h('li', {}, h('strong', {}, 'قابِل بالكتاب: '),
          'كل عنصر يعرض رقم صفحته، ويعرض تحته نصّ الكتاب في الدرس نفسه للمقابلة.'),
        h('li', {}, h('strong', {}, 'انظر موضعه: '),
          'زرّ «موضعه في البرنامج» يفتح الدرس في واجهة المتعلّم لترى العنصر في سياقه.'),
        h('li', {}, h('strong', {}, 'حرّر قبل الاعتماد: '),
          'زرّ «تحرير النصّ» يتيح تعديل الصياغة، ويُحفظ التعديل ويُصدَّر في عمود مستقل.'),
        h('li', {}, h('strong', {}, 'اكتب ملاحظتك: '),
          'الملاحظة تُصدَّر مع العنصر ليعرف المنفّذ ما المطلوب.'),
        h('li', {}, h('strong', {}, 'صدّر: '),
          'من تبويب «التصدير» تُخرج ملف Excel أو CSV بكل الأعمدة المطلوبة.'),
      ),
      h('hr'),
      h('h3', {}, 'ماذا يعني كل حقل في المحتوى؟'),
      h('div', { class: 'scroll-x' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', {}, 'الحقل'), h('th', {}, 'المعنى'))),
        h('tbody', {}, ...[
          ['src: "book"', 'نصّ منقول حرفيًّا من الكتاب — لا يحتاج مراجعة'],
          ['src: "quran"', 'نصّ قرآني كُتب بالرسم العثماني — يحتاج تدقيقًا حرفيًّا'],
          ['src: "derived"', 'سؤال مبنيّ حرفيًّا على نصّ الكتاب — تفسيره يشير إلى موضعه'],
          ['src: "authored"', 'صياغة تعليمية مساعدة ليست من الكتاب — تحتاج اعتمادًا'],
          ['needsReview: true', 'يظهر في هذه القائمة'],
          ['page', 'رقم صفحة الكتاب — يُعرض للمتعلّم تحت كل بطاقة'],
          ['level', 'brief يظهر في كل الأنماط · standard في المعتدل والمتعمّق · deep في المتعمّق فقط'],
        ].map(([a, b]) => h('tr', {}, h('td', {}, h('code', {}, a)), h('td', {}, b)))))),
      h('hr'),
      h('h3', {}, 'بعد الاعتماد'),
      h('p', { class: 'small' },
        'صدّر الملف وسلّمه للمنفّذ. التعديلات تُطبَّق على ',
        h('code', {}, 'content/units/*.json'), ' مباشرة، أو على المصدر المنظَّم في ',
        h('code', {}, 'scripts/content/*.py'), ' ثم يُعاد التوليد بـ ',
        h('code', {}, 'python3 scripts/build_content.py'), '.'),
      h('p', { class: 'small muted' },
        'قرارات المراجعة والتحريرات لا تُكتب في ملفات المحتوى تلقائيًّا — '
        + 'لا يتغيّر أي نصّ في البرنامج إلا بخطوة يدوية بعد اعتمادك.'),
    );
  }

  view.replaceChildren(statsBox, tabs, paneHost);
  paintStats();
  const t1 = addTab('قائمة المراجعة', buildReviewList);
  addTab('التصدير', buildExport);
  addTab('خريطة المحتوى', buildContentMap);
  addTab('كيف تُراجع؟', buildGuide);
  t1.click();
}

boot();
