// شاشة اختيار المستويات — 6 مستويات، لكل منها معلومات وتقدّم وزر بدء.

import { h } from './dom.js';
import { progressBar } from './widgets.js';
import { LEVELS } from '../data/index.js';
import { getState, levelsSummary } from '../store.js';

export function renderLevels({ onStartLevel }) {
  const progress = getState();
  const summary = levelsSummary(progress);
  const active = progress.activeLevel || 1;

  const cards = LEVELS.map((lvl) => {
    const s = summary[lvl.id - 1];
    const isActive = lvl.id === active;

    const head = h(
      'div',
      { class: 'level-card__head' },
      h('div', { class: 'level-card__num' }, String(lvl.id)),
      h(
        'div',
        { style: { flex: '1' } },
        h('div', { class: 'level-card__title' }, `${lvl.name}${isActive ? ' · الحالي' : ''}`),
        h('div', { class: 'level-card__desc' }, lvl.desc),
      ),
      s.complete ? h('div', { class: 'level-card__done', title: 'مستوى مكتمل' }, '✅') : null,
    );

    const meta = h(
      'div',
      { class: 'level-card__meta' },
      h('span', {}, `${s.words} كلمة · ${s.phrases} جملة`),
      h('span', { class: 'level-card__mastered' }, `متقَن ${s.mastered} / ${s.total}`),
    );

    const bar = h(
      'div',
      { class: 'level-card__bar' },
      progressBar(s.percent),
      h('div', { class: 'level-card__pct' }, `${s.percent}%`),
    );

    const btn = h(
      'button',
      {
        type: 'button',
        class: `btn ${isActive ? 'btn--primary' : 'btn--ghost'}`,
        onclick: () => onStartLevel(lvl.id),
      },
      s.complete ? 'مراجعة المستوى' : s.learned > 0 ? 'متابعة هذا المستوى' : 'ابدأ هذا المستوى',
    );

    return h(
      'div',
      { class: `level-card ${isActive ? 'is-active' : ''} ${s.complete ? 'is-complete' : ''}` },
      head,
      meta,
      bar,
      h('div', { class: 'mt-3' }, btn),
    );
  });

  return h(
    'div',
    { class: 'page-fade' },
    h('h1', { class: 'hero__title', style: { marginBottom: 'var(--space-2)' } }, 'المستويات'),
    h('p', { class: 'muted', style: { marginBottom: 'var(--space-5)' } }, 'اختر المستوى الذي يناسبك وابدأ منه مباشرة. يمكنك التنقّل بين المستويات في أي وقت.'),
    h('div', { class: 'stack' }, ...cards),
  );
}
