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

const TIME_CHOICES = [
  { id: 'brief', title: 'خمس دقائق', desc: 'جرعة قصيرة: النصّ الأساسي وخلاصة الدرس.' },
  { id: 'standard', title: 'عشر دقائق', desc: 'النصّ والشرح والتفاعل والاختبار القصير.' },
  { id: 'deep', title: 'وقت أطول', desc: 'جميع التفاصيل والأنشطة والمهام.' },
];

export function setupScreen() {
  const draft = { ...getState().prefs };

  const choiceGroup = (name, options, key) => h('div', { class: 'choice-grid', role: 'radiogroup', 'aria-label': name },
    ...options.map((o) => {
      const b = h('button', {
        class: 'choice', type: 'button', role: 'radio',
        'aria-pressed': String(draft[key] === o.id),
        'aria-checked': String(draft[key] === o.id),
      },
        h('span', { style: { flex: 1 } },
          h('span', { class: 'choice__title' }, o.title),
          h('span', { class: 'choice__desc', style: { display: 'block' } }, o.desc)),
      );
      b.addEventListener('click', () => {
        draft[key] = o.id;
        [...b.parentElement.children].forEach((c) => {
          c.setAttribute('aria-pressed', String(c === b));
          c.setAttribute('aria-checked', String(c === b));
        });
      });
      return b;
    }));

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

  return h('div', { class: 'container container--narrow section stack' },
    h('h1', { style: { marginBottom: '.25rem' } }, 'تهيئة أولية'),
    h('p', { class: 'muted' }, 'ثلاثة أسئلة فقط، ويمكنك تغييرها متى شئت من الإعدادات.'),

    h('div', { class: 'card stack' },
      h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, '١. كم من الوقت تفضّل للدرس؟'),
      choiceGroup('مدة الدرس', TIME_CHOICES, 'sessionLength'),
    ),

    h('div', { class: 'card stack' },
      h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, '٢. ما مستوى التفصيل المناسب لك؟'),
      choiceGroup('مستوى التفصيل', [
        { id: 'brief', title: 'الأساسيات', desc: 'النصّ الشرعي والخلاصة، مع إمكانية التوسّع في أي لحظة.' },
        { id: 'standard', title: 'متوسّط', desc: 'النصّ مع الشرح المستمدّ من الكتاب.' },
        { id: 'deep', title: 'مفصّل', desc: 'كل ما في الكتاب من مسائل وتنبيهات.' },
      ], 'detail'),
    ),

    h('div', { class: 'card stack' },
      h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, '٣. هل تحتاج إلى تيسير في العرض؟'),
      toggle('خط كبير ووضع قراءة مريح', 'مناسب لكبار السن ومن يقرأ بصعوبة.', 'largeText'),
      toggle('تفعيل الاستماع', 'للشروح والصياغات التعليمية. أما الآيات فلا تُقرأ آليًّا.', 'audio'),
      toggle('وضع أسري', 'يُظهر سؤال نقاش أسري في نهاية كل درس.', 'familyMode'),
      toggle('تباين عالٍ', 'ألوان أوضح لمن يحتاج تباينًا أقوى.', 'highContrast'),
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
