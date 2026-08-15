// لوحة التقدم التفصيلية.

import { h } from './dom.js';
import { progressBar, progressRing, statCard } from './widgets.js';
import { getState, computeStats, resetAll, levelsSummary } from '../store.js';
import { WORDS, PHRASES, TARGET_WORDS, TARGET_PHRASES, LEVELS, LEVEL_COUNT } from '../data/index.js';

const ACHIEVEMENTS = [
  { id: 'first-session', icon: '🌟', label: 'أول جلسة' },
  { id: 'streak-3', icon: '🔥', label: '٣ أيام متتالية' },
  { id: 'streak-7', icon: '🏆', label: '٧ أيام متتالية' },
];

const STATUS_META = {
  new: { label: 'لم تبدأ بعد', dot: 'dot--new' },
  learning: { label: 'قيد التعلّم', dot: 'dot--learning' },
  review: { label: 'قيد المراجعة', dot: 'dot--review' },
  mastered: { label: 'متقَنة', dot: 'dot--mastered' },
};

export function renderProgress({ afterReset }) {
  const progress = getState();
  const stats = computeStats(progress);
  const totalContent = WORDS.length + PHRASES.length;

  // توزيع الحالات على المحتوى الحالي.
  const counts = { new: 0, learning: 0, review: 0, mastered: 0 };
  const allIds = [...WORDS.map((w) => w.id), ...PHRASES.map((p) => p.id)];
  for (const id of allIds) {
    const p = progress.items[id];
    counts[p ? p.status : 'new']++;
  }

  const ringCard = h(
    'div',
    { class: 'card text-center', style: { marginBottom: 'var(--space-5)' } },
    progressRing(stats.masteryPercent, { unit: 'نسبة الإتقان' }),
    h('p', { class: 'muted mt-3' }, 'الإتقان يعني أنك تتذكّر العنصر وتستخدمه، وليس مجرد رؤيته مرة واحدة.'),
  );

  const grid = h(
    'div',
    { class: 'stat-grid', style: { marginBottom: 'var(--space-4)' } },
    statCard(String(stats.wordsLearned), `كلمات مكتسبة من ${TARGET_WORDS}`),
    statCard(String(stats.phrasesLearned), `جمل مكتسبة من ${TARGET_PHRASES}`),
    statCard(String(stats.dueCount), 'بحاجة إلى مراجعة'),
    statCard(`${stats.levelsCompleted} / ${LEVEL_COUNT}`, 'مستويات مكتملة'),
    statCard(String(progress.streak), 'أيام متتالية 🔥'),
    statCard(String(progress.points), 'مجموع النقاط'),
  );

  // تقدّم كل مستوى (نسبة الإتقان) + ✅ عند الاكتمال.
  const summary = levelsSummary(progress);
  const levelsSection = h(
    'div',
    {},
    h('div', { class: 'section-title' }, 'تقدّم المستويات'),
    h(
      'div',
      { class: 'stack' },
      ...LEVELS.map((lvl) => {
        const s = summary[lvl.id - 1];
        return h(
          'div',
          {},
          h(
            'div',
            { class: 'muted', style: { marginBottom: '6px', display: 'flex', justifyContent: 'space-between' } },
            h('span', {}, `المستوى ${lvl.id} · ${lvl.name} ${s.complete ? '✅' : ''}`),
            h('span', {}, `${s.mastered}/${s.total} — ${s.percent}%`),
          ),
          progressBar(s.percent),
        );
      }),
    ),
  );

  const statusList = h(
    'div',
    {},
    h('div', { class: 'section-title' }, `حالة المحتوى الحالي (${totalContent} عنصرًا)`),
    h(
      'div',
      { class: 'mastery-list' },
      ...Object.keys(STATUS_META).map((s) =>
        h(
          'div',
          { class: 'mastery-row' },
          h('span', { class: `mastery-row__dot ${STATUS_META[s].dot}` }),
          h('span', {}, STATUS_META[s].label),
          h('span', { class: 'mastery-row__count' }, String(counts[s])),
        ),
      ),
    ),
  );

  const goals = h(
    'div',
    {},
    h('div', { class: 'section-title' }, 'التقدّم نحو ٣٥٠ كلمة و١٠٠ جملة'),
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

  const badges = h(
    'div',
    {},
    h('div', { class: 'section-title' }, 'الإنجازات'),
    h(
      'div',
      { class: 'badges' },
      ...ACHIEVEMENTS.map((a) => {
        const unlocked = progress.achievements.includes(a.id);
        return h(
          'div',
          { class: `badge ${unlocked ? '' : 'is-locked'}` },
          h('span', { class: 'badge__icon' }, a.icon),
          h('span', { class: 'badge__label' }, a.label),
        );
      }),
    ),
  );

  const resetBtn = h(
    'div',
    { style: { marginTop: 'var(--space-6)' } },
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn--ghost',
        onclick: () => {
          if (window.confirm('هل تريد فعلًا حذف كل تقدّمك والبدء من جديد؟')) {
            resetAll();
            if (afterReset) afterReset();
          }
        },
      },
      'إعادة ضبط التقدّم',
    ),
  );

  return h(
    'div',
    { class: 'page-fade' },
    h('h1', { class: 'hero__title', style: { marginBottom: 'var(--space-5)' } }, 'تقدّمي'),
    ringCard,
    grid,
    levelsSection,
    statusList,
    goals,
    badges,
    resetBtn,
  );
}
