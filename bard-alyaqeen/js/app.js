/** نقطة الدخول: التوجيه، والهيكل العام، وتطبيق التفضيلات. */

import { h, clear, icon, ICONS, brandMark, focusMain, enableFocusOnRender, toast } from './lib/dom.js';
import { route, start, navigate, currentPath } from './lib/router.js';
import { getState, update, subscribe } from './store.js';
import * as C from './lib/content.js';
import { dueCount } from './lib/srs.js';

import { splashScreen, setupScreen } from './ui/onboarding.js';
import { homeScreen } from './ui/home.js';
import { unitsScreen, unitScreen } from './ui/units.js';
import { lessonScreen, quizScreen } from './ui/lesson.js';
import { tasksScreen, reviewScreen, achievementsScreen, bookmarksScreen, searchScreen, moreScreen } from './ui/misc.js';
import { settingsScreen, applyPrefs } from './ui/settings.js';

const view = document.getElementById('view');
const tabbarHost = document.getElementById('tabbar');

let MANIFEST = null;
let UNITS = [];

/*
 * أربعة تبويبات ظاهرة لا خمسة، وخامسها «المزيد» يجمع البقيّة.
 * السبب: على عرض ٣٢٠px كانت الخمسة تقتسم ٦٤px للتبويب الواحد، فلا يتّسع
 * «المراجعة» عند تكبير الخطّ. وبأربعة يصير نصيب التبويب ٨٠px، فيبقى الاسم
 * مقروءًا بحجم لا ينزل عن ١٢px، بلا قصّ ولا تمرير أفقي.
 */
export const TABS = [
  { path: '/home', label: 'الرئيسة', ic: ICONS.home },
  { path: '/units', label: 'الوحدات', ic: ICONS.book },
  { path: '/review', label: 'المراجعة', ic: ICONS.review },
  { path: '/more', label: 'المزيد', ic: ICONS.more, owns: ['/tasks', '/progress', '/search', '/bookmarks', '/settings'] },
];

function renderTabbar(path) {
  const due = dueCount(getState().review);
  tabbarHost.replaceChildren(...TABS.map((t) => {
    const active = path.startsWith(t.path)
      || (t.owns || []).some((p) => path.startsWith(p));
    const btn = h('button', {
      class: 'tabbar__btn', type: 'button',
      'aria-current': active ? 'page' : null,
      onclick: () => navigate(t.path),
    }, icon(t.ic, 22), h('span', { class: 'tabbar__label' }, t.label));
    if (t.path === '/review' && due > 0) {
      btn.append(h('span', { class: 'sr-only' }, `${due} عنصرًا مستحقًّا`));
      btn.querySelector('svg').style.color = 'var(--c-gold)';
    }
    return btn;
  }));
  tabbarHost.hidden = ['/', '/setup'].includes(path);
}

/**
 * شريط «وضع مراجعة المحتوى» — للمعاينة الخاصة وحدها.
 * لا يُرسَم إلا إذا أعلنت الصفحة `window.__BAY_REVIEW_PREVIEW__ = true`،
 * وصفحة البرنامج العامّة (index.html) لا تُعلنه، فلا يراه المستخدم العام.
 */
function renderReviewModeBar() {
  if (!window.__BAY_REVIEW_PREVIEW__) return;
  const host = document.getElementById('review-mode-bar');
  if (!host) return;
  const on = () => !!getState().prefs.reviewLabels;
  const input = h('input', {
    type: 'checkbox', class: 'switch', id: 'review-mode-toggle', checked: on(),
    'aria-label': 'وضع مراجعة المحتوى',
    onchange: (e) => {
      update((s) => { s.prefs = { ...s.prefs, reviewLabels: e.target.checked }; });
      applyPrefs(getState().prefs);
    },
  });
  host.replaceChildren(
    h('span', { class: 'review-mode-bar__txt' },
      h('span', { class: 'review-mode-bar__ttl' }, 'وضع مراجعة المحتوى'),
      h('span', { class: 'small muted', style: { display: 'block' } },
        'يُظهر لصيقة «صياغة تعليمية مساعدة» على ما ليس من نصّ الكتاب. '
        + 'خاصٌّ بالمعاينة، ولا يظهر للمستخدم العام.')),
    input);
  host.hidden = false;
}

function renderTopbar() {
  const bar = document.getElementById('topbar');
  bar.replaceChildren(
    h('a', { class: 'topbar__brand', href: '#/home', style: { textDecoration: 'none', color: 'inherit' } },
      h('span', { class: 'mark' }, brandMark(21)),
      h('span', { class: 'topbar__title' }, 'بَرْدُ اليقين')),
    h('span', { class: 'topbar__spacer' }),
    h('button', {
      class: 'btn btn--quiet btn--icon', type: 'button', 'aria-label': 'البحث',
      onclick: () => navigate('/search'),
    }, icon(ICONS.search, 20)),
    h('button', {
      class: 'btn btn--quiet btn--icon', type: 'button', 'aria-label': 'المفضلة',
      onclick: () => navigate('/bookmarks'),
    }, icon(ICONS.star, 20)),
    h('button', {
      class: 'btn btn--quiet btn--icon', type: 'button', 'aria-label': 'الإعدادات',
      onclick: () => navigate('/settings'),
    }, icon(ICONS.gear, 20)),
  );
}

function show(node) {
  clear(view);
  view.append(node);
  focusMain();
}

function loading() {
  return h('div', { class: 'container section center' },
    h('p', { class: 'muted' }, 'جارٍ تحميل المحتوى…'));
}

function errorScreen(msg) {
  return h('div', { class: 'container section' },
    h('div', { class: 'card center' },
      h('h2', {}, 'تعذّر تحميل المحتوى'),
      h('p', { class: 'muted small' }, msg),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => location.reload() }, 'إعادة المحاولة')));
}

async function withUnits(fn) {
  show(loading());
  try {
    if (!UNITS.length) UNITS = await C.loadAllUnits();
    show(fn(UNITS));
  } catch (e) {
    show(errorScreen(e.message || String(e)));
  }
}

function defineRoutes() {
  route('/', () => show(splashScreen(MANIFEST)));
  route('/setup', () => show(setupScreen()));
  route('/home', () => withUnits((units) => homeScreen(MANIFEST, units)));
  route('/units', () => withUnits((units) => unitsScreen(units)));

  route('/unit/:id', ({ params }) => withUnits((units) => {
    const u = units.find((x) => x.id === params.id);
    return u ? unitScreen(u) : errorScreen('وحدة غير معروفة.');
  }));

  route('/lesson/:unitId/:lessonId', ({ params }) => withUnits((units) => {
    const u = units.find((x) => x.id === params.unitId);
    const l = u && C.findLesson(u, params.lessonId);
    return l ? lessonScreen(u, l, units) : errorScreen('درس غير معروف.');
  }));

  route('/quiz/:unitId/:lessonId', ({ params }) => withUnits((units) => {
    const u = units.find((x) => x.id === params.unitId);
    const l = u && C.findLesson(u, params.lessonId);
    return l ? quizScreen(u, l, units)
      : errorScreen('درس غير معروف.');
  }));

  route('/tasks', () => withUnits((units) => tasksScreen(units)));
  route('/tasks/:unitId', ({ params }) => withUnits((units) => tasksScreen(units, params.unitId)));
  route('/review', () => withUnits((units) => reviewScreen(units)));
  route('/progress', () => withUnits((units) => achievementsScreen(units)));
  route('/bookmarks', () => withUnits((units) => bookmarksScreen(units)));
  route('/search', () => withUnits((units) => searchScreen(units)));
  route('/settings', () => show(settingsScreen()));
  route('/more', () => show(moreScreen()));
}

async function boot() {
  applyPrefs(getState().prefs);
  renderTopbar();
  renderReviewModeBar();
  try {
    MANIFEST = await C.loadManifest();
  } catch (e) {
    show(errorScreen('تعذّر تحميل فهرس المحتوى. تأكّد من تشغيل البرنامج عبر خادم ملفات.'));
    return;
  }
  defineRoutes();
  start((path) => renderTabbar(path));
  window.addEventListener('hashchange', enableFocusOnRender, { once: true });
  subscribe(() => renderTabbar(currentPath()));

  // إن لم يكن المستخدم قد بدأ، نعرض الشاشة الافتتاحية.
  if (!location.hash || location.hash === '#/') navigate('/', { replace: true });

  registerSW();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;
  const go = () => navigator.serviceWorker
    .register(new URL('../sw.js', import.meta.url), { scope: './' })
    .catch(() => { /* يعمل البرنامج بدون عمل خارج الاتصال */ });
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

window.addEventListener('online', () => toast('عاد الاتصال.'));
window.addEventListener('offline', () => toast('أنت الآن دون اتصال؛ المحتوى المحفوظ يعمل.'));

boot();
