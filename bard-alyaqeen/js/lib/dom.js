/** مساعدات إنشاء عناصر DOM — بديل خفيف عن أطر الواجهة. */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k in el && k !== 'list' && typeof v !== 'object') {
      try { el[k] = v; } catch (_) { el.setAttribute(k, v); }
    } else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(4)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

export function frag(...children) {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

/** أيقونة SVG من مسار مضغوط. */
export function icon(path, size = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = path;
  return svg;
}

export const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M8 7h8M8 11h6"/>',
  review: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  tasks: '<path d="M9 11l2 2 4-4"/><rect x="3" y="4" width="18" height="16" rx="2.5"/>',
  progress: '<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  star: '<path d="m12 3.6 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 3V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.6c.6.3 1.4.2 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1z"/>',
  back: '<path d="M9 5l7 7-7 7"/>',
  next: '<path d="M15 5l-7 7 7 7"/>',
  sound: '<path d="M11 5 6.5 9H3v6h3.5L11 19z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a9 9 0 0 1 0 12"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lamp: '<path d="M9 18h6M10 21h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
};

/** الشعار: قوس محراب داخل ثمانية مضلّعة — أصالة وحداثة بلا ازدحام. */
export function brandMark(size = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round">
      <path d="M24 3.5 38.8 9.2 44.5 24 38.8 38.8 24 44.5 9.2 38.8 3.5 24 9.2 9.2Z" opacity=".55"/>
      <path d="M24 13c-4.4 0-8 3.6-8 8v13h16V21c0-4.4-3.6-8-8-8Z"/>
      <path d="M24 20.5v7" stroke-linecap="round"/>
    </g>`;
  return svg;
}

/** تنبيه مؤقت غير مزعج. */
export function toast(msg) {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const t = h('div', { class: 'toast' }, msg);
  host.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 250ms'; }, 2400);
  setTimeout(() => t.remove(), 2750);
}

let focusOnRender = false;

/**
 * يُفعَّل بعد أول تنقّل من المستخدم. قبل ذلك لا نسرق التركيز،
 * حتى يبقى «تخطّي إلى المحتوى» أول ما يصله المستخدم بلوحة المفاتيح.
 */
export function enableFocusOnRender() { focusOnRender = true; }

/** ينقل تركيز القارئ إلى بداية الشاشة بعد التنقّل. */
export function focusMain() {
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (!focusOnRender) return;
  const m = document.getElementById('main');
  if (m) { m.setAttribute('tabindex', '-1'); m.focus({ preventScroll: true }); }
}

export function announce(msg) {
  let live = document.getElementById('live-region');
  if (!live) {
    live = h('div', { id: 'live-region', class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
    document.body.append(live);
  }
  live.textContent = '';
  setTimeout(() => { live.textContent = msg; }, 40);
}

/** حلقة تقدّم دائرية. */
export function ring(percent, label) {
  const r = 40, c = 2 * Math.PI * r;
  const wrap = h('div', { class: 'ring' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 92 92');
  svg.setAttribute('width', '92'); svg.setAttribute('height', '92');
  svg.setAttribute('class', 'ring__svg'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <circle class="ring__track" cx="46" cy="46" r="${r}" fill="none" stroke-width="7"/>
    <circle class="ring__fill" cx="46" cy="46" r="${r}" fill="none" stroke-width="7"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - percent / 100)}"/>`;
  wrap.append(svg, h('div', { class: 'ring__label' }, label ?? `${percent}٪`));
  return wrap;
}

/** تحويل الأرقام إلى أرقام عربية-هندية للعرض. */
export function ar(n) {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
}
