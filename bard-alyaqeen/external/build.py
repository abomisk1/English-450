"""يولّد app/app.html من نسخة التجربة ../trial.html دون إعادة بنائها: يضيف طبقة اتصال بدل إمكانات Claude، ويزيل صور صفحات الملخص، ويمنع الفهرسة.
الاستعمال: python3 build.py"""
import re,os
H=os.path.dirname(os.path.abspath(__file__))
s=open(H+'/../trial.html',encoding='utf8').read()
shim=r'''<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">
<script>/* طبقة اتصال: تعوّض claude.use('db'|'user'|'downloads') بواجهة الاستضافة. المشارك يُعرَّف بمعرّف عشوائي يحتفظ به متصفحه. */
(function(){var K='bard-pid',pid=null;try{pid=localStorage.getItem(K);}catch(e){}
if(!pid||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(pid)){pid=(crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g,function(){return (Math.random()*16|0).toString(16);}));try{localStorage.setItem(K,pid);}catch(e){}}
var enc=new TextEncoder();
async function uid(){var h=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode('pid:'+pid)));var b='';h.forEach(function(x){b+=String.fromCharCode(x)});return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'').slice(0,22);}
function post(path,data){return fetch('/api/db',{method:'POST',headers:{'content-type':'application/json','x-pid':pid},body:JSON.stringify({path:path,data:data}),credentials:'same-origin'}).then(function(r){if(!r.ok){var e=new Error('http');e.code=r.status;throw e;}});}
window.claude={use:async function(n){
 if(n==='user') return {id:uid,canEdit:async function(){return false;},isOwner:async function(){return false;}};
 if(n==='db') return {doc:function(p){return {set:function(d){return post(p,d);}};},collection:function(){return {get:async function(){throw new Error('not allowed');}};}};
 if(n==='downloads') return {save:async function(r){var b=r.data instanceof Blob?r.data:new Blob([r.data],{type:'text/csv;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=r.filename;document.body.appendChild(a);a.click();a.remove();return {status:'saved'};}};
 return null;}};})();</script>'''
i=s.index('<div class="stage"')
head,body=s[:i],s[i:]
s='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;min-height:100%}</style>'+shim+head+'</head><body>'+body+'</body></html>'
n0=len(s)
s=re.sub(r'"pages":\{"zad":\{[^}]*\}\},"zad":','"pages":{"zad":{}},"zad":',s,count=1)
s=s.replace('(يحتاج فتح الرابط من حساب مدعو)','')
s=s.replace('<title>تجربة بَرْد اليقين</title>','<title>بَرْد اليقين</title>')
open(H+'/app/app.html','w',encoding='utf8').write(s)
print('app.html',len(s),'(was',n0,')','pages stripped' if '"zad":{}}' in s else 'PAGES NOT STRIPPED')
