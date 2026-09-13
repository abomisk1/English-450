/** صفحة الوحدات، وصفحة وحدة واحدة بدروسها وأنشطتها ومهامها. */

import { h, ar, arCount, COUNT_MINUTE_GEN, icon, ICONS } from '../lib/dom.js';
import { progressBar, sectionTitle, ornament, qtext } from './widgets.js';
import { navigate } from '../lib/router.js';
import { getState } from '../store.js';
import * as P from '../lib/progress.js';
import * as C from '../lib/content.js';

export function unitsScreen(units) {
  const s = getState();
  const wrap = h('div', { class: 'container section stack' }, h('h1', {}, 'الوحدات'));
  for (const u of units) {
    const p = P.unitProgress(s, u);
    wrap.append(h('button', {
      class: 'unit-card', type: 'button', onclick: () => navigate(`/unit/${u.id}`),
    },
      h('div', { class: 'row', style: { flexWrap: 'nowrap' } },
        h('span', { class: 'unit-card__no' }, ar(u.order)),
        h('span', { style: { flex: 1, minWidth: 0 } },
          h('span', { style: { fontWeight: 700, display: 'block' } }, u.shortTitle),
          h('span', { class: 'small muted' }, `${ar(p.done)}/${ar(p.total)} دروس · ص ${ar(u.source.pages[0])}–${ar(u.source.pages[1])}`)),
        h('span', { class: p.percent === 100 ? 'chip chip--ok' : 'chip' }, `${ar(p.percent)}٪`),
      ),
      h('div', { style: { marginTop: '.6rem' } }, progressBar(p.percent)),
    ));
  }
  return wrap;
}

export function unitScreen(unit) {
  const s = getState();
  const p = P.unitProgress(s, { lessons: unit.lessons });
  const wrap = h('div', { class: 'container section stack' });

  wrap.append(
    h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => navigate('/units') },
      icon(ICONS.back, 18), 'الوحدات'),
    h('h1', { style: { fontFamily: 'var(--font-text)', marginBottom: '.25rem' } }, unit.title),
    h('div', { class: 'small muted' }, `الكتاب: ص ${ar(unit.source.pages[0])}–${ar(unit.source.pages[1])}`),
    progressBar(p.percent, true),
  );

  // النتائج التعليمية المستهدفة
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'lesson-card__label' }, h('span', { class: 'chip' }, 'من الكتاب')),
    h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, 'المأمول أن يخرج الطالب من هذا الفصل بأمور'),
    h('ol', { style: { margin: 0, paddingInlineStart: '1.3rem', lineHeight: '2' } },
      ...unit.outcomes.points.map((t) => h('li', {}, t))),
  ));

  if (unit.intro) {
    wrap.append(h('div', { class: 'card' },
      h('div', { class: 'lesson-card__label' }, h('span', { class: 'chip' }, 'من الكتاب')),
      h('div', { class: 'book-text' }, unit.intro.text),
      h('div', { class: 'src-ref', style: { marginTop: '.5rem' } }, `الكتاب، ص ${ar(unit.intro.page)}`),
    ));
  }

  wrap.append(ornament(), sectionTitle('الدروس'));

  const list = h('div', { class: 'stack' });
  unit.lessons.forEach((l, i) => {
    const rec = P.lessonRecord(s, l.id);
    const done = P.isLessonComplete(rec);
    list.append(h('button', {
      class: 'card', type: 'button',
      style: { width: '100%', textAlign: 'start', cursor: 'pointer', font: 'inherit', color: 'inherit' },
      onclick: () => navigate(`/lesson/${unit.id}/${l.id}`),
    },
      h('div', { class: 'row', style: { flexWrap: 'nowrap', justifyContent: 'space-between' } },
        h('span', { style: { flex: 1, minWidth: 0 } },
          h('span', { class: 'small muted' }, `الدرس ${ar(i + 1)}`),
          h('span', { style: { fontWeight: 700, display: 'block', fontFamily: 'var(--font-text)', fontSize: 'var(--fs-lg)' } }, l.title),
          h('span', { class: 'xsmall muted' },
            `ص ${l.source.pages.map(ar).join('، ')} · نحو ${arCount(C.estimatedMinutes(l), COUNT_MINUTE_GEN)}`),
          l.family ? h('span', { class: 'chip chip--brand', style: { marginTop: '.35rem' } }, 'نشاط أسري') : null),
        done ? h('span', { class: 'chip chip--ok' }, '✓ أُتمّ')
          : (rec && rec.seen ? h('span', { class: 'chip chip--warn' }, 'قيد المتابعة') : h('span', { class: 'chip' }, 'ابدأ')),
      ),
    ));
  });
  wrap.append(list);

  // الأسئلة التحصيلية من الكتاب
  wrap.append(sectionTitle('أسئلة تحصيلية'));
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'lesson-card__label' },
      h('span', { class: 'chip' }, 'من الكتاب — صفحة «أنشطة»')),
    h('p', { class: 'small muted' }, 'أسئلة مقالية كما وردت في الكتاب؛ أجب عنها كتابةً ثم قارنها بما درست.'),
    ...unit.assessment.map((a, i) => h('details', { class: 'more' },
      h('summary', {}, qtext(`${ar(i + 1)}. ${a.q}`)),
      h('div', { class: 'field', style: { marginTop: '.5rem' } },
        h('textarea', {
          class: 'textarea', placeholder: 'اكتب إجابتك هنا…',
          'aria-label': a.q,
          value: (getState().bookmarks.find((b) => b.type === 'answer' && b.id === `${unit.id}/${a.id}`) || {}).label || '',
          oninput: (e) => {
            const id = `${unit.id}/${a.id}`;
            const val = e.target.value;
            import('../store.js').then(({ update }) => update((st) => {
              st.bookmarks = st.bookmarks.filter((b) => !(b.type === 'answer' && b.id === id));
              if (val.trim()) st.bookmarks.push({ type: 'answer', id, label: val, at: Date.now() });
            }, { silent: true }));
          },
        })),
      h('div', { class: 'xsmall muted' }, `الكتاب، ص ${ar(a.page)}`),
    )),
  ));

  wrap.append(h('button', {
    class: 'btn btn--ghost btn--block', type: 'button',
    onclick: () => navigate(`/tasks/${unit.id}`),
  }, icon(ICONS.tasks, 20), `المهام الأدائية (${ar(unit.tasks.length)})`));

  return wrap;
}
