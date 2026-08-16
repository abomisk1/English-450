// شاشة اختيار المستويات — 6 مستويات، لكل منها معلومات وتقدّم وزر بدء، وحالة اختبار المستوى،
// يليها قسم الاختبار النهائي (يُفتح بعد إنهاء المستويات الستة واجتياز اختباراتها).

import { h } from './dom.js';
import { progressBar } from './widgets.js';
import { LEVELS } from '../data/index.js';
import { getState, levelsSummary, levelQuizState, finalQuizState } from '../store.js';
import { LEVEL_QUIZ_SIZE, FINAL_QUIZ_SIZE } from '../lib/quiz.js';

export function renderLevels({ onStartLevel, onStartLevelQuiz, onStartFinalQuiz }) {
  const progress = getState();
  const summary = levelsSummary(progress);
  const active = progress.activeLevel || 1;

  // صفّ حالة اختبار المستوى داخل بطاقة المستوى.
  function quizRow(levelId) {
    const qs = levelQuizState(levelId, progress);

    if (!qs.available) {
      return h(
        'div',
        { class: 'level-quiz is-locked' },
        h('span', { class: 'level-quiz__icon' }, '🔒'),
        h('span', { class: 'level-quiz__text' }, 'اختبار المستوى — أكمل محتوى المستوى لفتحه'),
      );
    }

    if (qs.passed) {
      return h(
        'div',
        { class: 'level-quiz is-pass' },
        h(
          'div',
          { class: 'level-quiz__info' },
          h('span', { class: 'level-quiz__text' }, '✅ تم اجتياز الاختبار'),
          qs.best ? h('span', { class: 'level-quiz__best' }, `أفضل نتيجة: ${qs.best.score}/${qs.best.total}`) : null,
        ),
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => onStartLevelQuiz(levelId) }, 'إعادة الاختبار'),
      );
    }

    return h(
      'div',
      { class: 'level-quiz' },
      h(
        'div',
        { class: 'level-quiz__info' },
        h('span', { class: 'level-quiz__badge' }, 'تم إنهاء المحتوى'),
        qs.taken && qs.last ? h('span', { class: 'level-quiz__best' }, `آخر نتيجة: ${qs.last.score}/${qs.last.total}`) : null,
      ),
      h('button', { type: 'button', class: 'btn btn--primary btn--sm', onclick: () => onStartLevelQuiz(levelId) }, `ابدأ الاختبار (${LEVEL_QUIZ_SIZE} سؤالًا)`),
    );
  }

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
      quizRow(lvl.id),
    );
  });

  // —— قسم الاختبار النهائي ——
  const fs = finalQuizState(progress);
  let finalSection;
  if (!fs.unlocked) {
    finalSection = h(
      'div',
      { class: 'final-quiz is-locked' },
      h('div', { class: 'final-quiz__head' }, h('span', { class: 'final-quiz__icon' }, '🔒'), h('span', { class: 'final-quiz__title' }, 'الاختبار النهائي')),
      h('p', { class: 'final-quiz__hint' }, 'أكمل المستويات الستة واختباراتها لفتح الاختبار النهائي.'),
    );
  } else {
    finalSection = h(
      'div',
      { class: `final-quiz ${fs.passed ? 'is-pass' : ''}` },
      h('div', { class: 'final-quiz__head' }, h('span', { class: 'final-quiz__icon' }, fs.passed ? '🏆' : '🎯'), h('span', { class: 'final-quiz__title' }, 'الاختبار النهائي')),
      h(
        'p',
        { class: 'final-quiz__hint' },
        fs.passed
          ? `✅ تم اجتياز الاختبار النهائي${fs.best ? ` — أفضل نتيجة: ${fs.best.score}/${fs.best.total}` : ''}`
          : `اختبار شامل من ${FINAL_QUIZ_SIZE} سؤالًا يغطّي المستويات الستة.`,
      ),
      h('button', { type: 'button', class: 'btn btn--primary btn--lg', onclick: onStartFinalQuiz }, fs.passed ? 'إعادة الاختبار النهائي' : 'ابدأ الاختبار النهائي'),
    );
  }

  return h(
    'div',
    { class: 'page-fade' },
    h('h1', { class: 'hero__title', style: { marginBottom: 'var(--space-2)' } }, 'المستويات'),
    h('p', { class: 'muted', style: { marginBottom: 'var(--space-5)' } }, 'اختر المستوى الذي يناسبك وابدأ منه مباشرة. بعد إنهاء محتوى مستوى يُفتح اختباره.'),
    h('div', { class: 'stack' }, ...cards),
    h('div', { class: 'section-title', style: { marginTop: 'var(--space-6)' } }, 'الاختبار الشامل'),
    finalSection,
  );
}
