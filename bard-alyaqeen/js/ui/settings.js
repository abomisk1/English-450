/** الإعدادات وإمكانية الوصول، وإدارة البيانات. */

import { h, toast, ar } from '../lib/dom.js';
import { getState, update, replaceState, resetState, flush } from '../store.js';
import { exportState, importState } from '../lib/storage.js';
import { navigate } from '../lib/router.js';

/** يطبّق تفضيلات العرض على عنصر الجذر. */
export function applyPrefs(prefs) {
  const root = document.documentElement;
  root.dataset.reading = prefs.largeText ? 'comfort' : 'normal';
  root.dataset.contrast = prefs.highContrast ? 'high' : 'normal';
  if (prefs.theme === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = prefs.theme;
  root.style.setProperty('--font-scale', String(prefs.fontScale || 1));
  root.dataset.reviewLabels = prefs.reviewLabels ? 'on' : 'off';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const dark = root.dataset.theme === 'dark'
      || (prefs.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    meta.setAttribute('content', dark ? '#071a2a' : '#fbf8f1');
  }
}

function toggleRow(label, desc, key, after) {
  const prefs = getState().prefs;
  const input = h('input', {
    type: 'checkbox', class: 'switch', checked: !!prefs[key],
    onchange: (e) => {
      update((s) => { s.prefs = { ...s.prefs, [key]: e.target.checked }; });
      applyPrefs(getState().prefs);
      after && after();
    },
  });
  return h('label', { class: 'switch-row' },
    h('span', {}, h('span', { style: { fontWeight: 600 } }, label),
      h('span', { class: 'small muted', style: { display: 'block' } }, desc)),
    input);
}

function selectRow(label, desc, key, options) {
  const prefs = getState().prefs;
  const sel = h('select', { class: 'select', style: { maxWidth: '11rem' }, 'aria-label': label },
    ...options.map((o) => h('option', { value: o.value, selected: prefs[key] === o.value }, o.label)));
  sel.addEventListener('change', () => {
    update((s) => { s.prefs = { ...s.prefs, [key]: sel.value }; });
    applyPrefs(getState().prefs);
  });
  return h('div', { class: 'switch-row' },
    h('span', {}, h('span', { style: { fontWeight: 600 } }, label),
      h('span', { class: 'small muted', style: { display: 'block' } }, desc)),
    sel);
}

export function settingsScreen() {
  const s = getState();

  const fontScale = h('input', {
    type: 'range', min: '0.9', max: '1.5', step: '0.1',
    value: String(s.prefs.fontScale || 1), style: { width: '11rem' },
    'aria-label': 'حجم الخط',
    oninput: (e) => {
      update((st) => { st.prefs = { ...st.prefs, fontScale: Number(e.target.value) }; }, { silent: true });
      applyPrefs(getState().prefs);
    },
  });

  const fileInput = h('input', {
    type: 'file', accept: 'application/json,.json', class: 'sr-only',
    onchange: async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const next = importState(await f.text());
        replaceState(next);
        applyPrefs(next.prefs);
        toast('تم استعادة التقدّم بنجاح.');
        navigate('/home');
      } catch (_) {
        toast('الملف غير صالح.');
      }
      e.target.value = '';
    },
  });

  return h('div', { class: 'container container--narrow section stack' },
    h('h1', {}, 'الإعدادات وإمكانية الوصول'),

    h('div', { class: 'card' },
      h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, 'العرض والقراءة'),
      toggleRow('وضع القراءة المريح', 'خط أكبر ومسافات أوسع، مناسب لكبار السن.', 'largeText'),
      toggleRow('تباين عالٍ', 'ألوان أوضح لمن يحتاج تباينًا أقوى.', 'highContrast'),
      selectRow('السِّمة', 'فاتح أو داكن أو حسب النظام.', 'theme', [
        { value: 'system', label: 'حسب النظام' },
        { value: 'light', label: 'فاتح' },
        { value: 'dark', label: 'داكن' },
      ]),
      h('div', { class: 'switch-row' },
        h('span', {}, h('span', { style: { fontWeight: 600 } }, 'حجم الخط'),
          h('span', { class: 'small muted', style: { display: 'block' } }, 'يؤثّر على البرنامج كله.')),
        fontScale),
    ),

    h('div', { class: 'card' },
      h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, 'التعلّم'),
      h('p', { class: 'small muted', style: { marginTop: 0 } },
        'لكلّ درس مساران: «تعلّم الدرس» وهو الافتراضي للدراسة الأولى، '
        + 'و«مراجعة سريعة» تُتاح بعد إتمام الدرس ومن صفحة المراجعة. '
        + 'والمحتوى الشرعي واحد في المسارين.'),
      toggleRow('تفعيل الاستماع', 'للشروح والصياغات التعليمية فقط؛ لا تُقرأ الآيات قراءة آلية.', 'audio'),
    ),

    h('div', { class: 'card stack' },
      h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, 'بياناتك'),
      h('p', { class: 'small muted' },
        'يُحفظ تقدّمك على جهازك فقط، ولا يُطلب منك أي بيانات شخصية. '
        + 'لنقل تقدّمك إلى جهاز آخر صدّر نسخة احتياطية ثم استعدها هناك.'),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn btn--ghost', type: 'button',
          onclick: () => {
            flush();
            const blob = new Blob([exportState(getState())], { type: 'application/json' });
            const a = h('a', {
              href: URL.createObjectURL(blob),
              download: `bard-al-yaqeen-backup-${new Date().toISOString().slice(0, 10)}.json`,
            });
            document.body.append(a); a.click(); a.remove();
            toast('تم تصدير نسخة احتياطية.');
          },
        }, 'تصدير نسخة احتياطية'),
        h('button', {
          class: 'btn btn--ghost', type: 'button',
          onclick: () => fileInput.click(),
        }, 'استعادة نسخة'),
        fileInput,
      ),
      h('details', { class: 'more' },
        h('summary', {}, 'حساب اختياري ومزامنة عبر الأجهزة'),
        h('p', { class: 'small muted', style: { marginTop: '.5rem' } },
          'البرنامج مصمَّم ليعمل بالكامل دون حساب. المزامنة عبر الأجهزة تحتاج إلى خدمة خادم، '
          + 'وهي لم تُفعَّل بانتظار موافقتك على اختيار الخدمة ومراجعة سياسة الخصوصية. '
          + 'وقد جُهِّزت طبقة التخزين لاستقبالها لاحقًا دون تغيير في بقية البرنامج.')),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn btn--quiet', type: 'button', style: { color: 'var(--c-err)' },
          onclick: () => {
            if (confirm('سيُحذف تقدّمك المحفوظ على هذا الجهاز. هل أنت متأكد؟')) {
              resetState(); applyPrefs(getState().prefs); toast('تم مسح البيانات.'); navigate('/');
            }
          },
        }, 'مسح بياناتي من هذا الجهاز'),
      ),
    ),

    h('div', { class: 'card' },
      h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, 'عن البرنامج'),
      h('p', { class: 'small muted' },
        'بَرْدُ اليقين — الجزء الأول. المادة العلمية منقولة من كتاب «الْمُهِمّ لِكُلِّ مُسْلِم» '
        + 'لسلطان بن جابر الجعدبي الظفيري، ولم يُضَف إليها حكم شرعي ولا تفسير من خارج الكتاب.'),
      h('p', { class: 'xsmall muted' }, `آخر حفظ: ${new Date(s.updatedAt).toLocaleString('ar')}`),
      h('a', { class: 'btn btn--quiet btn--sm', href: 'admin/index.html' }, 'لوحة إدارة المحتوى والمراجعة الشرعية'),
    ),
  );
}
