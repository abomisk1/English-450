/**
 * عامل الخدمة — يتيح العمل دون اتصال ويتعامل مع ضعف الشبكة.
 * لا يُخزَّن فيه أي بيانات مستخدم؛ بيانات التقدّم في التخزين المحلي.
 */

const VERSION = 'bay-v1';
const SHELL = `${VERSION}-shell`;
const CONTENT = `${VERSION}-content`;

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/app.css',
  './js/app.js',
  './js/store.js',
  './js/lib/dom.js',
  './js/lib/router.js',
  './js/lib/storage.js',
  './js/lib/srs.js',
  './js/lib/quiz.js',
  './js/lib/progress.js',
  './js/lib/content.js',
  './js/lib/speech.js',
  './js/ui/widgets.js',
  './js/ui/onboarding.js',
  './js/ui/home.js',
  './js/ui/units.js',
  './js/ui/lesson.js',
  './js/ui/misc.js',
  './js/ui/settings.js',
  './assets/img/icon.svg',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/fonts/cairo-var.woff2',
  './assets/fonts/amiri-400.woff2',
  './assets/fonts/amiri-700.woff2',
  './assets/fonts/amiri-quran-400.woff2',
  './content/manifest.json',
  './content/units/u1.json',
  './content/units/u2.json',
  './content/units/u3.json',
  './content/units/u4.json',
  './content/units/u5.json',
  './content/units/u6.json',
  './content/units/u7.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // نتجاهل ما يفشل تحميله حتى لا يفشل التثبيت كله على شبكة ضعيفة.
    await Promise.all(SHELL_FILES.map((u) => cache.add(u).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // المحتوى العلمي: من الشبكة أولًا مع رجوع للمخزّن (ليصل التحديث ويعمل دون اتصال).
  if (url.pathname.includes('/content/')) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CONTENT);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        const hit = await caches.match(req);
        if (hit) return hit;
        return new Response('{"error":"offline"}', { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // بقية الملفات: من المخزّن أولًا (أسرع وأخف).
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      if (fresh.ok) (await caches.open(SHELL)).put(req, fresh.clone());
      return fresh;
    } catch (_) {
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      return new Response('', { status: 504 });
    }
  })());
});
