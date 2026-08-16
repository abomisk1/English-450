// نقطة تشغيل التطبيق: موجّه بسيط بالحالة بين الشاشات + شريط تنقل سفلي.

import { h, mount, icon } from './ui/dom.js';
import { renderHome } from './ui/home.js';
import { renderLevels } from './ui/levels.js';
import { renderProgress } from './ui/progress.js';
import { renderSession } from './ui/session.js';
import { renderQuiz } from './ui/quiz.js';
import { getState, setActiveLevel } from './store.js';

const root = document.getElementById('root');

// الحالة الحالية للعرض: { name: 'tabs', tab } أو { name: 'session', level }
let view = { name: 'tabs', tab: 'home' };

function bottomNav(activeTab, onChange) {
  const navBtn = (tab, label, iconName) =>
    h(
      'button',
      {
        type: 'button',
        class: `bottom-nav__btn ${activeTab === tab ? 'is-active' : ''}`,
        'aria-current': activeTab === tab ? 'true' : 'false',
        onclick: () => onChange(tab),
      },
      icon(iconName),
      label,
    );

  return h(
    'nav',
    { class: 'bottom-nav', 'aria-label': 'التنقل الرئيسي' },
    h(
      'div',
      { class: 'bottom-nav__inner' },
      navBtn('home', 'الرئيسية', 'home'),
      navBtn('levels', 'المستويات', 'layers'),
      navBtn('progress', 'تقدّمي', 'chart'),
    ),
  );
}

// بدء جلسة على مستوى محدّد (يُحدّث المستوى النشط ثم يفتح الجلسة).
function startLevel(level) {
  setActiveLevel(level);
  setView({ name: 'session', level });
}

// بدء اختبار (مستوى أو نهائي) — يعود إلى تبويب المستويات عند الخروج.
function startQuiz(mode, level) {
  setView({ name: 'quiz', mode, level });
}

function render() {
  window.scrollTo(0, 0);

  if (view.name === 'session') {
    // شاشة الجلسة تأخذ الشاشة كاملة (بلا شريط تنقل سفلي).
    mount(root, renderSession({ level: view.level, onExit: () => setView({ name: 'tabs', tab: 'home' }) }));
    return;
  }

  if (view.name === 'quiz') {
    // شاشة الاختبار تأخذ الشاشة كاملة (بلا شريط تنقل سفلي).
    mount(root, renderQuiz({ mode: view.mode, level: view.level, onExit: () => setView({ name: 'tabs', tab: 'levels' }) }));
    return;
  }

  const main = h('main', { class: 'app__main' });
  if (view.tab === 'home') {
    main.appendChild(
      renderHome({
        onStart: () => startLevel(getState().activeLevel || 1),
        onRestart: render,
        onChooseLevel: () => setView({ name: 'tabs', tab: 'levels' }),
      }),
    );
  } else if (view.tab === 'levels') {
    main.appendChild(
      renderLevels({
        onStartLevel: (L) => startLevel(L),
        onStartLevelQuiz: (L) => startQuiz('level', L),
        onStartFinalQuiz: () => startQuiz('final'),
      }),
    );
  } else {
    main.appendChild(renderProgress({ afterReset: render }));
  }

  const app = h('div', { class: 'app' }, main, bottomNav(view.tab, (tab) => setView({ name: 'tabs', tab })));
  mount(root, app);
}

function setView(next) {
  view = next;
  render();
}

render();
