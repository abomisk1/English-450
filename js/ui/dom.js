// مساعد إنشاء عناصر DOM بسيط (بديل خفيف عن مكتبات الواجهة).
// h('div', { class: 'x', onclick: fn }, child1, child2, ...)

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'html') el.innerHTML = value;
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key in el && key !== 'list') {
        try {
          el[key] = value;
        } catch {
          el.setAttribute(key, value);
        }
      } else {
        el.setAttribute(key, value);
      }
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) appendChildren(el, child);
    else if (child instanceof Node) el.appendChild(child);
    else el.appendChild(document.createTextNode(String(child)));
  }
}

// استبدال محتوى حاوية بعنصر جديد.
export function mount(container, node) {
  container.replaceChildren(node);
}

// أيقونات SVG بسيطة (بلا اعتماديات).
const ICONS = {
  speaker:
    '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M16 8.5a4 4 0 010 7M18.5 6a7 7 0 010 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  home:
    '<path d="M3 11l9-8 9 8M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  chart:
    '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  check:
    '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  // سهم "السابق" — في واجهة RTL يشير إلى اليمين.
  back:
    '<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  layers:
    '<path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
};

export function icon(name, className) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  svg.innerHTML = ICONS[name] || '';
  return svg;
}
