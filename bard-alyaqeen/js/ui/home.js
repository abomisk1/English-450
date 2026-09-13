/** الصفحة الرئيسة ومسار التعلّم. */

import { h, ar, arCount, COUNT_LESSON, ring, icon, ICONS } from '../lib/dom.js';
import { progressBar, ornament, sectionTitle } from './widgets.js';
import { navigate } from '../lib/router.js';
import { getState } from '../store.js';
import * as P from '../lib/progress.js';
import { dueCount } from '../lib/srs.js';

function greeting() {
  const hr = new Date().getHours();
  if (hr < 5) return 'ليلة مباركة';
  if (hr < 12) return 'صباح الخير';
  if (hr < 17) return 'طاب يومك';
  return 'مساء الخير';
}

export function homeScreen(manifest, units) {
  const s = getState();
  const overall = P.overallProgress(s, units);
  const next = P.nextUp(s, units);
  const due = dueCount(s.review);
  const pos = s.lastPosition;

  const wrap = h('div', { class: 'container section stack' });

  // ترويسة التقدّم
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'row', style: { flexWrap: 'nowrap', gap: 'var(--sp-4)' } },
      ring(overall.percent),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { class: 'small muted' }, greeting()),
        h('h1', { style: { fontSize: 'var(--fs-xl)', margin: '0 0 .35rem' } }, 'مسار الجزء الأول'),
        h('div', { class: 'small muted' },
          `أتممت ${ar(overall.done)} من ${ar(overall.total)} درسًا`),
        s.streak.count > 0
          ? h('div', { class: 'chip chip--brand', style: { marginTop: '.5rem' } },
            `مواظبة ${ar(s.streak.count)} ${s.streak.count === 1 ? 'يوم' : 'أيام'}`)
          : null,
      ),
    ),
  ));

  // متابعة من آخر موضع / الدرس التالي
  if (pos && pos.lessonTitle) {
    wrap.append(h('div', { class: 'card' },
      h('div', { class: 'small muted' }, 'تابع من حيث توقّفت'),
      h('h2', { style: { fontSize: 'var(--fs-lg)', margin: '.25rem 0 .75rem' } }, pos.lessonTitle),
      h('button', {
        class: 'btn btn--primary btn--block', type: 'button',
        onclick: () => navigate(`/lesson/${pos.unitId}/${pos.lessonId}`),
      }, 'متابعة الدرس'),
    ));
  } else if (next) {
    wrap.append(h('div', { class: 'card' },
      h('div', { class: 'small muted' }, `الدرس التالي — ${next.unitTitle}`),
      h('h2', { style: { fontSize: 'var(--fs-lg)', margin: '.25rem 0 .75rem' } }, next.lessonTitle),
      h('button', {
        class: 'btn btn--primary btn--block', type: 'button',
        onclick: () => navigate(`/lesson/${next.unitId}/${next.lessonId}`),
      }, 'ابدأ الدرس'),
    ));
  } else {
    wrap.append(h('div', { class: 'card center' },
      h('div', { style: { fontSize: '2rem' } }, '🕌'),
      h('h2', { style: { fontSize: 'var(--fs-lg)' } }, 'أتممت جميع دروس الجزء الأول'),
      h('p', { class: 'muted small' }, 'واصل المراجعة المتباعدة وتنفيذ المهام الأدائية.'),
    ));
  }

  // المراجعة اليوم
  if (due > 0) {
    wrap.append(h('button', {
      class: 'card', type: 'button',
      style: { width: '100%', textAlign: 'start', cursor: 'pointer', font: 'inherit', color: 'inherit' },
      onclick: () => navigate('/review'),
    },
      h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } },
        h('div', {},
          h('div', { style: { fontWeight: 700 } }, 'مراجعة اليوم'),
          h('div', { class: 'small muted' }, `${ar(due)} عنصرًا يحتاج مراجعة`)),
        h('span', { class: 'chip chip--brand' }, 'ابدأ'),
      ),
    ));
  }

  wrap.append(ornament(), sectionTitle('الوحدات'));

  const grid = h('div', { class: 'grid grid--2' });
  for (const u of units) {
    const p = P.unitProgress(s, u);
    grid.append(h('button', {
      class: 'unit-card', type: 'button',
      onclick: () => navigate(`/unit/${u.id}`),
      'aria-label': `${u.shortTitle} — ${p.percent}٪`,
    },
      h('div', { class: 'row', style: { flexWrap: 'nowrap', marginBottom: '.5rem' } },
        h('span', { class: 'unit-card__no' }, ar(u.order)),
        h('span', { style: { fontWeight: 700, flex: 1 } }, u.shortTitle),
      ),
      h('div', { class: 'small muted', style: { marginBottom: '.5rem' } },
        `${ar(p.done)} / ${ar(p.total)} دروس`),
      progressBar(p.percent),
    ));
  }
  wrap.append(grid);

  // دروس فيها نشاط أسري — من الدروس الموجودة فعلًا، بلا توليد أنشطة جديدة.
  const familyLessons = [];
  for (const u of units) {
    for (const l of u.lessons) if (l.family) familyLessons.push({ u, l });
  }
  if (familyLessons.length) {
    wrap.append(ornament(), sectionTitle('دروس مناسبة للأسرة',
      h('span', { class: 'chip' }, arCount(familyLessons.length, COUNT_LESSON))));
    wrap.append(h('p', { class: 'small muted', style: { marginTop: 0 } },
      'دروس فيها سؤال نقاش تُدار به جلسة أسرية قصيرة. يظهر النشاط داخل الدرس نفسه.'));
    const fam = h('div', { class: 'stack' });
    for (const { u, l } of familyLessons.slice(0, 6)) {
      fam.append(h('button', {
        class: 'card', type: 'button',
        style: { width: '100%', textAlign: 'start', cursor: 'pointer', font: 'inherit', color: 'inherit' },
        onclick: () => navigate(`/lesson/${u.id}/${l.id}`),
      },
        h('div', { class: 'row', style: { flexWrap: 'nowrap', justifyContent: 'space-between' } },
          h('span', { style: { flex: 1, minWidth: 0 } },
            h('span', { class: 'small muted' }, u.shortTitle),
            h('span', { style: { fontWeight: 700, display: 'block', fontFamily: 'var(--font-text)' } }, l.title)),
          h('span', { class: 'chip chip--brand' }, 'نشاط أسري'))));
    }
    wrap.append(fam);
    if (familyLessons.length > 6) {
      wrap.append(h('p', { class: 'xsmall muted center' },
        `وبقيّتها في الوحدات — ${arCount(familyLessons.length - 6, COUNT_LESSON)}.`));
    }
  }

  wrap.append(h('div', { class: 'card', style: { marginTop: '1rem' } },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } },
      h('div', { class: 'small muted' }, 'المصدر العلمي للجزء الأول'),
      h('span', { class: 'chip' }, `ص ١–${ar(manifest.parts[0].book.pages)}`)),
    h('div', { style: { fontFamily: 'var(--font-text)', fontSize: 'var(--fs-lg)', marginTop: '.25rem' } },
      manifest.parts[0].book.title),
    h('div', { class: 'small muted' }, `تأليف: ${manifest.parts[0].book.author}`),
  ));

  return wrap;
}
