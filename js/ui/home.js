// الصفحة الرئيسية: ترحيب + زر بدء الجلسة + ملخص التقدم.

import { h } from './dom.js';
import { progressBar, progressRing, statCard } from './widgets.js';
import { getState, computeStats } from '../store.js';
import { TARGET_WORDS, TARGET_PHRASES } from '../data/index.js';

export function renderHome({ onStart }) {
  const progress = getState();
  const stats = computeStats(progress);

  const hero = h(
    'div',
    { class: 'hero' },
    h('div', { class: 'hero__greeting' }, 'مرحبًا 👋'),
    h('h1', { class: 'hero__title' }, 'جاهز لجلسة اليوم؟'),
  );

  const cta = h(
    'div',
    { class: 'home-cta' },
    h(
      'p',
      { class: 'home-cta__hint' },
      stats.dueCount > 0
        ? `لديك ${stats.dueCount} عنصرًا للمراجعة اليوم، بالإضافة إلى كلمات جديدة.`
        : 'جلسة قصيرة (٥ إلى ١٠ دقائق) تكفي لتتقدّم كل يوم.',
    ),
    h('button', { type: 'button', class: 'btn btn--lg', onclick: onStart }, 'ابدأ جلسة اليوم'),
  );

  const ringCard = h(
    'div',
    { class: 'card text-center', style: { marginBottom: 'var(--space-5)' } },
    progressRing(stats.masteryPercent, { unit: 'نسبة الإتقان' }),
    progress.streak > 0
      ? h(
          'p',
          { class: 'mt-3 muted' },
          h('span', { class: 'streak-flame' }, '🔥'),
          ` استمرارية: ${progress.streak} يوم`,
        )
      : null,
  );

  const smallNum = (n, total) =>
    h(
      'span',
      {},
      String(n),
      ' ',
      h('span', { class: 'muted', style: { fontSize: '16px' } }, `/ ${total}`),
    );

  const grid = h(
    'div',
    { class: 'stat-grid' },
    statCard(smallNum(stats.wordsLearned, TARGET_WORDS), 'كلمات تعلّمتها'),
    statCard(smallNum(stats.phrasesLearned, TARGET_PHRASES), 'جمل تعلّمتها'),
    statCard(String(stats.dueCount), 'مراجعات اليوم'),
    statCard(String(progress.points), 'مجموع النقاط'),
  );

  const goals = h(
    'div',
    {},
    h('div', { class: 'section-title' }, 'تقدّمك نحو الهدف'),
    h(
      'div',
      { class: 'stack' },
      h(
        'div',
        {},
        h('div', { class: 'muted', style: { marginBottom: '6px' } }, `الكلمات · ${stats.wordsLearned} / ${TARGET_WORDS}`),
        progressBar((stats.wordsLearned / TARGET_WORDS) * 100),
      ),
      h(
        'div',
        {},
        h('div', { class: 'muted', style: { marginBottom: '6px' } }, `الجمل · ${stats.phrasesLearned} / ${TARGET_PHRASES}`),
        progressBar((stats.phrasesLearned / TARGET_PHRASES) * 100),
      ),
    ),
  );

  return h('div', { class: 'page-fade' }, hero, cta, ringCard, grid, goals);
}
