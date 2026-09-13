/** الشاشة الافتتاحية، والتعريف بالجزء الأول، والتهيئة الأولية. */

import { h, brandMark, ar, focusMain } from '../lib/dom.js';
import { ornament } from './widgets.js';
import { navigate } from '../lib/router.js';
import { getState, update, saveNow } from '../store.js';
import { applyPrefs } from './settings.js';

export function splashScreen(manifest) {
  const part = (manifest.parts || [])[0] || {};
  const book = part.book || {};
  const s = getState();
  return h('div', { class: 'container container--narrow section' },
    h('div', { class: 'hero' },
      h('div', { class: 'hero__mark' }, brandMark(54)),
      h('h1', { class: 'hero__name' }, manifest.name),
      h('p', { class: 'hero__tagline' }, manifest.tagline),
    ),
    ornament(),
    h('div', { class: 'card stack' },
      h('h2', { style: { marginTop: 0 } }, 'الجزء الأول'),
      h('p', { class: 'muted', style: { marginBottom: '.5rem' } },
        'هذا الجزء مبنيٌّ على كتاب:'),
      h('div', { class: 'narration', style: { textAlign: 'center' } },
        h('div', { style: { fontWeight: 700, fontSize: 'var(--fs-xl)' } }, book.title),
        h('div', { class: 'small muted', style: { fontFamily: 'var(--font-ui)', marginTop: '.4rem' } },
          `تأليف: ${book.author}`),
        h('div', { class: 'xsmall muted', style: { fontFamily: 'var(--font-ui)' } },
          `${book.edition} — ${book.year}`),
      ),
      h('p', { class: 'small muted' }, book.note),
      h('div', { class: 'row' },
        h('span', { class: 'chip' }, `${ar(manifest.stats.units)} وحدات`),
        h('span', { class: 'chip' }, `${ar(manifest.stats.lessons)} درسًا`),
        h('span', { class: 'chip' }, `${ar(manifest.stats.tasks)} مهمة أدائية`),
      ),
    ),
    h('div', { class: 'stack', style: { marginTop: '1.5rem' } },
      h('button', {
        class: 'btn btn--primary btn--block', type: 'button',
        onclick: () => navigate(s.onboarded ? '/home' : '/setup'),
      }, s.onboarded ? 'متابعة التعلّم' : 'ابدأ الرحلة'),
      s.onboarded ? null : h('button', {
        class: 'btn btn--quiet btn--block', type: 'button',
        onclick: () => { update((st) => { st.onboarded = true; }); saveNow(); navigate('/home'); },
      }, 'تخطّي التهيئة والدخول مباشرة'),
      h('p', { class: 'xsmall muted center' },
        'يمكنك التعلّم بلا تسجيل دخول؛ يُحفظ تقدّمك على جهازك.'),
    ),
  );
}

export function setupScreen() {
  const draft = { ...getState().prefs };

  const toggle = (label, desc, key) => {
    const input = h('input', {
      type: 'checkbox', class: 'switch', checked: !!draft[key],
      onchange: (e) => { draft[key] = e.target.checked; },
    });
    return h('label', { class: 'switch-row' },
      h('span', {}, h('span', { style: { fontWeight: 600 } }, label),
        h('span', { class: 'small muted', style: { display: 'block' } }, desc)),
      input);
  };

  // مُعامل تكبير الخطّ ضمن التهيئة الأولى، مع معاينة حيّة للنصّ.
  const fontScaleRow = (() => {
    const input = h('input', {
      type: 'range', min: '0.9', max: '1.6', step: '0.05',
      value: String(draft.fontScale || 1),
      'aria-label': 'حجم الخطّ',
      style: { flex: '1 1 10rem' },
    });
    const out = h('span', { class: 'small muted', style: { minWidth: '3.5rem', textAlign: 'center' } },
      `${ar(Math.round((draft.fontScale || 1) * 100))}٪`);
    input.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      draft.fontScale = v;
      out.textContent = `${ar(Math.round(v * 100))}٪`;
      // معاينة فورية على الصفحة نفسها.
      document.documentElement.style.setProperty('--font-scale', String(v));
    });
    return h('div', { class: 'row', style: { flexWrap: 'nowrap', gap: '.75rem' } }, input, out);
  })();

  return h('div', { class: 'container container--narrow section stack' },
    h('h1', { style: { marginBottom: '.25rem' } }, 'تهيئة أولية'),
    h('p', { class: 'muted' }, 'سؤالان فقط في تيسير العرض، ويمكنك تغييرهما متى شئت من الإعدادات.'),

    h('div', { class: 'card stack' },
      h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, '١. حجم الخطّ المريح لك'),
      h('p', { class: 'small muted', style: { margin: 0 } },
        'حرّك المؤشّر حتى يصير النصّ أدناه مريحًا لعينك.'),
      fontScaleRow,
      h('div', { class: 'card card--flat', id: 'setup-sample', style: { background: 'var(--bg-sunken)' } },
        h('div', { class: 'small muted' }, 'نموذج للقراءة'),
        h('p', { style: { margin: '.35rem 0 0', fontFamily: 'var(--font-text)', lineHeight: '1.9' } },
          'الحمدُ للهِ ربِّ العالمين، وأشهدُ أن لا إلهَ إلا الله وحدَه لا شريكَ له.')),
      toggle('وضع قراءة مريح', 'خطّ أكبر ومسافات أوسع، مناسب لكبار السنّ ومن يقرأ بصعوبة.', 'largeText'),
    ),

    h('div', { class: 'card stack' },
      h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, '٢. هل تحتاج إلى تيسير آخر؟'),
      toggle('تباين عالٍ', 'ألوان أوضح لمن يحتاج تباينًا أقوى.', 'highContrast'),
      toggle('تفعيل الاستماع', 'للشروح والصياغات التعليمية. أمّا الآيات فلا تُقرأ آليًّا.', 'audio'),
    ),

    h('button', {
      class: 'btn btn--primary btn--block', type: 'button',
      onclick: () => {
        update((s) => { s.prefs = { ...s.prefs, ...draft }; s.onboarded = true; });
        saveNow();
        applyPrefs(getState().prefs);
        navigate('/home');
        focusMain();
      },
    }, 'ابدأ التعلّم'),
  );
}
