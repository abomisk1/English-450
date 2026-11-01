// يقدّم التطبيق بعد التحقق من الدعوة. بدون دعوة صحيحة لا يُرسَل أي محتوى علمي.
import { readFileSync } from 'node:fs';
import { html, inviteOk, codeMatches, cookieHeader, INVITE, NOINDEX } from './lib/common.mjs';
export const config = { path: ['/', '/index.html'] };

const entry = (msg = '') => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>دعوة</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#14304A;color:#EAF2F7;font-family:system-ui,"Segoe UI",Tahoma,sans-serif;padding:20px}main{max-width:360px;width:100%;text-align:center}h1{font-size:34px;margin:0 0 6px}p{color:#B9D1DD;line-height:1.8}input,button{font:inherit;width:100%;box-sizing:border-box;padding:14px;border-radius:14px;border:0;margin-top:10px}input{text-align:center;direction:ltr}button{background:#8FD3C8;color:#14304A;font-weight:700}.e{color:#F5B8A8;min-height:1.5em}</style></head>
<body><main><h1>بَرْد اليقين</h1><p>نسخة تجريبية لمجموعة محدودة. أدخل رمز الدعوة الذي أُرسل إليك.</p><form method="GET" action="/"><input name="k" autocomplete="off" autofocus placeholder="رمز الدعوة"><button>دخول</button></form><p class="e">${msg}</p></main></body></html>`;

export default async (req) => {
  const url = new URL(req.url);
  if (INVITE() && !inviteOk(req)) {
    const k = url.searchParams.get('k');
    if (k && codeMatches(k)) return new Response(null, { status: 302, headers: { Location: '/', 'Set-Cookie': cookieHeader(), ...NOINDEX } });
    return html(entry(k ? 'الرمز غير صحيح.' : ''), k ? 403 : 200);
  }
  const app = readFileSync(new URL('../../app/app.html', import.meta.url), 'utf8');
  return html(app);
};
