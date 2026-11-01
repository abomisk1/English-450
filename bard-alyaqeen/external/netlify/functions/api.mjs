// واجهة البيانات. المشارك يكتب ويقرأ مساره فقط؛ المشرف وحده (بمفتاحه) يقرأ الكل.
import { json, inviteOk, adminOk, PID_RE, PATH_RE, uidOf, store } from './lib/common.mjs';
export const config = { path: ['/api/db', '/api/admin/data', '/api/ping'] };

export default async (req) => {
  const url = new URL(req.url);
  if (url.pathname === '/api/ping') return json({ ok: true });
  if (url.pathname === '/api/admin/data') {
    if (!adminOk(req)) return json({ error: 'unauthorized' }, 401);
    const st = await store(); const { blobs } = await st.list({ prefix: 'd/' }); const rows = [];
    for (const b of blobs) rows.push({ path: b.key.slice(2), data: await st.get(b.key, { type: 'json' }) });
    return json({ docs: rows });
  }
  // مسار المشارك
  if (!inviteOk(req)) return json({ error: 'invite_required' }, 401);
  const pid = req.headers.get('x-pid') || '';
  if (!PID_RE.test(pid)) return json({ error: 'bad_participant' }, 400);
  const uid = uidOf(pid); const st = await store();
  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
    const path = String(body.path || '');
    if (!PATH_RE.test(path) || path.split('/')[1] !== uid) return json({ error: 'forbidden_path' }, 403);
    const text = JSON.stringify(body.data ?? null);
    if (text.length > 20000) return json({ error: 'too_large' }, 413);
    await st.setJSON('d/' + path, body.data ?? null); return json({ ok: true });
  }
  if (req.method === 'GET') {      // يقرأ مساره فقط
    const { blobs } = await st.list({ prefix: 'd/trial/' + uid }); const rows = [];
    for (const b of blobs) rows.push({ path: b.key.slice(2), data: await st.get(b.key, { type: 'json' }) });
    return json({ docs: rows });
  }
  return json({ error: 'method' }, 405);
};
