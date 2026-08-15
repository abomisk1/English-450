// نقطة تشغيل التطبيق: موجّه بسيط بالحالة بين ثلاث شاشات + شريط تنقل سفلي.

import { h, mount, icon } from './ui/dom.js';
import { renderHome } from './ui/home.js';
import { renderProgress } from './ui/progress.js';
import { renderSession } from './ui/session.js';

const root = document.getElementById('root');

// الحالة الحالية للعرض: { name: 'tabs', tab } أو { name: 'session' }
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
    h('div', { class: 'bottom-nav__inner' }, navBtn('home', 'الرئيسية', 'home'), navBtn('progress', 'تقدّمي', 'chart')),
  );
}

function render() {
  window.scrollTo(0, 0);

  if (view.name === 'session') {
    // شاشة الجلسة تأخذ الشاشة كاملة (بلا شريط تنقل سفلي).
    mount(root, renderSession({ onExit: () => setView({ name: 'tabs', tab: 'home' }) }));
    return;
  }

  const main = h('main', { class: 'app__main' });
  if (view.tab === 'home') {
    main.appendChild(renderHome({ onStart: () => setView({ name: 'session' }) }));
  } else {
    main.appendChild(renderProgress({ afterReset: render }));
  }

  const app = h(
    'div',
    { class: 'app' },
    main,
    bottomNav(view.tab, (tab) => setView({ name: 'tabs', tab })),
  );
  mount(root, app);
}

function setView(next) {
  view = next;
  render();
}

render();
