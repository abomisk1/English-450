/** موجّه بسيط قائم على hash، يحفظ الموضع ويعمل دون اتصال. */

const routes = [];
let onChange = null;

export function route(pattern, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => {
    keys.push(k); return '([^/]+)';
  }) + '$');
  routes.push({ rx, keys, handler });
}

export function parse(hash) {
  const raw = (hash || '').replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path: path || '/', query };
}

export function navigate(path, { replace = false } = {}) {
  const target = '#' + path;
  if (location.hash === target) { dispatch(); return; }
  if (replace) history.replaceState(null, '', target);
  else location.hash = path;
  if (replace) dispatch();
}

export function dispatch() {
  const { path, query } = parse(location.hash);
  for (const r of routes) {
    const m = path.match(r.rx);
    if (m) {
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      r.handler({ params, query, path });
      onChange && onChange(path);
      return;
    }
  }
  // مسار غير معروف → الصفحة الرئيسة
  navigate('/home', { replace: true });
}

export function start(cb) {
  onChange = cb;
  window.addEventListener('hashchange', dispatch);
  dispatch();
}

export function currentPath() { return parse(location.hash).path; }
