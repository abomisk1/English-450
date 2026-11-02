// يخدم ملفات الملخص (إن وُجدت) بعد التحقق من الدعوة. لا يخدم إلا الاسمين المسموحين، ولا يقرأ مسارات أخرى.
import { readFileSync, existsSync } from 'node:fs';
import { json, inviteOk, NOINDEX } from './lib/common.mjs';
export const config = { path: '/files/*' };
const ALLOWED = { 'summary-zad.pdf': 'zad-al-ibad-summary.pdf', 'summary-maraqi.pdf': 'maraqi-al-waay-summary.pdf' };
export default async (req) => {
  if (!['GET', 'HEAD'].includes(req.method)) return json({ error: 'method' }, 405);
  if (!inviteOk(req)) return json({ error: 'invite_required' }, 401);
  const name = new URL(req.url).pathname.replace(/^\/files\//, '');
  if (!Object.prototype.hasOwnProperty.call(ALLOWED, name)) return json({ error: 'not_found' }, 404);
  const file = new URL('../../app/files/' + name, import.meta.url);
  if (!existsSync(file)) return json({ error: 'not_available' }, 404);
  const buf = readFileSync(file);
  const h = { ...NOINDEX, 'content-type': 'application/pdf', 'content-length': String(buf.length), 'content-disposition': `attachment; filename="${ALLOWED[name]}"` };
  return new Response(req.method === 'HEAD' ? null : buf, { status: 200, headers: h });
};
