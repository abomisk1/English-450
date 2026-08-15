// شاشة إكمال البرنامج — تظهر فقط عند إتقان جميع العناصر (mastered 450/450).

import { h } from './dom.js';
import { statCard } from './widgets.js';
import { getState, restartProgram } from '../store.js';

function formatDate(key) {
  if (!key) return null;
  const parts = key.split('-');
  if (parts.length !== 3) return key;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

// بطاقة التهنئة القابلة لإعادة الاستخدام (الرئيسية + نهاية الجلسة).
// onRestart: يُستدعى بعد إعادة البرنامج. onHome: (اختياري) زر العودة للرئيسية.
export function completionCard({ onRestart, onHome } = {}) {
  const s = getState();
  const dateStr = formatDate(s.lastCompletedAt);

  const stats = h(
    'div',
    { class: 'summary__stats', style: { marginBottom: 'var(--space-4)' } },
    statCard(String(s.completions || 0), 'مرات إكمال البرنامج'),
    dateStr ? statCard(h('span', { class: 'en' }, dateStr), 'تاريخ آخر إكمال') : statCard('450/450', 'عناصر متقَنة'),
  );

  const buttons = h('div', { class: 'stack' });
  buttons.appendChild(
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn--primary btn--lg',
        onclick: () => {
          const ok = window.confirm(
            'هل تريد إعادة البرنامج من البداية؟\n' +
              'سيبدأ تعلّم العناصر من جديد من العنصر الأول، مع الاحتفاظ بنقاطك وعدد مرات إكمالك.',
          );
          if (!ok) return;
          restartProgram();
          if (onRestart) onRestart();
        },
      },
      'إعادة البرنامج من البداية',
    ),
  );
  if (onHome) {
    buttons.appendChild(
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: onHome }, 'العودة إلى الرئيسية'),
    );
  }

  return h(
    'div',
    { class: 'card text-center', style: { padding: 'var(--space-6) var(--space-5)' } },
    h('div', { class: 'summary__emoji' }, '🎉'),
    h('h2', { class: 'summary__title' }, 'مبروك! أكملت English 450'),
    h('p', { class: 'muted', style: { marginBottom: 'var(--space-5)' } }, 'أتقنت جميع الـ450 كلمة وجملة إتقانًا كاملًا. إنجاز رائع يستحق الفخر 👏'),
    stats,
    buttons,
  );
}

// نسخة ملء الشاشة (تُستخدم في نهاية الجلسة التي اكتمل بها البرنامج).
export function renderCompletionScreen({ onRestart, onHome }) {
  return h(
    'div',
    { class: 'session page-fade' },
    h('div', { class: 'session__body' }, completionCard({ onRestart, onHome })),
  );
}
