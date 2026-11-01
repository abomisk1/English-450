// أدوات مشتركة: التحقق من الدعوة ومفتاح المشرف، ومخزن البيانات (Netlify Blobs أو ذاكرة للاختبار).
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export const NOINDEX = { 'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...NOINDEX, ...extra } });
export const html = (body, status = 200, extra = {}) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...NOINDEX, ...extra } });

const env = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k] ?? '';
export const INVITE = () => env('INVITE_CODE');
export const ADMIN = () => env('ADMIN_KEY');

const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
export const adminOk = (req) => { const k = ADMIN(); return !!k && k.length >= 12 && safeEq(req.headers.get('x-admin-key') || '', k); };

// رمز الدعوة: إن لم يُضبط INVITE_CODE فالدخول مفتوح. وإلا نتحقق من كوكي موقّعة (لا نخزن الرمز نفسه في الكوكي).
const sign = (v) => createHmac('sha256', ADMIN() || 'no-admin-key').update('invite:' + v).digest('hex');
export const inviteCookieValue = () => sign(INVITE());
export const inviteOk = (req) => {
  if (!INVITE()) return true;
  const c = (req.headers.get('cookie') || '').split(/;\s*/).find((x) => x.startsWith('inv='));
  return !!c && safeEq(c.slice(4), inviteCookieValue());
};
export const codeMatches = (code) => !!INVITE() && safeEq(String(code || '').trim(), INVITE());
export const cookieHeader = () => `inv=${inviteCookieValue()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;

// معرّف المشارك: UUID عشوائي يولّده المتصفح ويحتفظ به. مسار المشارك يُشتق منه بالتجزئة.
export const PID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const uidOf = (pid) => createHash('sha256').update('pid:' + pid).digest('base64url').slice(0, 22);
export const PATH_RE = /^trial\/[A-Za-z0-9_-]{22}(\/[A-Za-z0-9_.:-]{1,64}){0,3}$/;

let mem = null;
export async function store() {
  if (process.env.STORE_MODE === 'memory') {
    mem = mem || new Map();
    return { async setJSON(k, v) { mem.set(k, JSON.stringify(v)); }, async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; },
      async list(opts = {}) { return { blobs: [...mem.keys()].filter((k) => k.startsWith(opts.prefix || '')).map((key) => ({ key })) }; }, async delete(k) { mem.delete(k); } };
  }
  const { getStore } = await import('@netlify/blobs');
  return getStore('bard-trial');
}
