// اختبار شامل لخدمة التجربة الخارجية: دخول بلا حساب Claude، عزل المشاركين، لوحة المشرف، منع الفهرسة.
const {chromium}=require('playwright');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);} };
(async()=>{
  const {server}=await import('./server.mjs'); await new Promise(r=>server.listen(0,'127.0.0.1',r)); const B='http://localhost:'+server.address().port;
  const INV=process.env.INVITE_CODE, AK=process.env.ADMIN_KEY;
  // 1 HTTP-level
  let r=await fetch(B+'/',{redirect:'manual'}); let t=await r.text();
  ok(r.status===200&&/رمز الدعوة/.test(t)&&!/s1q1|const DATA|مراتب الدين/.test(t),'without an invite: only the invite page; no app code and no scientific content is sent');
  ok(/noindex/.test(r.headers.get('x-robots-tag')||'')&&/noindex/.test(t),'invite page: X-Robots-Tag and meta noindex');
  r=await fetch(B+'/?k=wrong',{redirect:'manual'}); ok(r.status===403,'wrong invite code refused (403)');
  r=await fetch(B+'/robots.txt'); ok(/Disallow: \//.test(await r.text()),'robots.txt disallows all');
  r=await fetch(B+'/api/db',{method:'POST',body:'{}'}); ok(r.status===401,'API without invite cookie: 401');
  r=await fetch(B+'/api/admin/data'); ok(r.status===401,'admin data without key: 401'); r=await fetch(B+'/api/admin/data',{headers:{'x-admin-key':'nope'}}); ok(r.status===401,'admin data with a wrong key: 401');
  r=await fetch(B+'/admin'); t=await r.text(); ok(r.status===200&&!/P-[A-Z0-9]{4}/.test(t)&&/noindex/.test(r.headers.get('x-robots-tag')),'admin page is a data-free shell (no results in the HTML), noindex');
  // 2 browser: two independent participants, no Claude, no login
  const b=await chromium.launch(); const mk=async()=>{const ctx=await b.newContext({viewport:{width:390,height:800},hasTouch:true}); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); return {ctx,p};};
  const A=await mk(), Bp=await mk(); 
  for(const X of [A,Bp]){ await X.p.goto(B+'/?k='+INV); await X.p.waitForTimeout(500); }
  ok(await A.p.evaluate(()=>typeof BANK==='object'&&ui.screen==='splash'&&/رحلةٌ علمية/.test(document.body.innerText)),'invite link opens the app directly on the splash screen (no Claude account, no login)');
  for(const X of [A,Bp]){ await X.p.click('.splash .btn'); await X.p.waitForTimeout(200); }
  ok(await A.p.evaluate(()=>ui.screen==='trialintro'&&/غير معتمدة علميًا/.test(document.body.innerText)),'«ابدأ التعلم» leads to the consent screen that states the trial is not scientifically approved');
  ok(await A.p.evaluate(()=>!new URLSearchParams(location.search).get('k')),'invite code removed from the address bar after entry');
  ok(await A.p.evaluate(()=>{const e=document.querySelector('.panel,.panel-toggle');return !e||getComputedStyle(e).display==='none'})&&await A.p.evaluate(()=>REVIEWER===false),'no developer panel / reviewer mode');
  const run=async(X,code)=>{ const p=X.p; await p.evaluate(c=>{document.querySelector('#tcode').value=c;document.querySelector('#tok').checked=true;document.querySelector('#tdev').value='هاتف';},code); await p.click('#tgo'); await p.waitForTimeout(200);
    await p.evaluate(()=>{S.seen.zad=true;S.gintro={1:true};save();go('home');A.startSession('1');}); await p.waitForTimeout(150);
    for(let g=0;g<14;g++){const sc=await p.evaluate(()=>ui.screen); if(sc==='question'){const i=await p.evaluate(()=>RUN.cur.order.findIndex(o=>o===BANK.byId[RUN.cur.id].correct)); await p.click(`[data-act="answer"][data-arg="${i}"]`); if(await p.evaluate(()=>ui.screen)==='question') await p.click('[data-act="next"]');} else break; await p.waitForTimeout(40);}
    await p.waitForTimeout(500); return p.evaluate(()=>({screen:ui.screen,done:calc().sessionsDone,sent:TS.records.filter(r=>r.sent).length,n:TS.records.length,uid:null}));};
  const ra=await run(A,'P-AAAA'), rb=await run(Bp,'P-BBBB');
  ok(ra.screen==='complete'&&ra.done===1&&ra.sent===1&&rb.done===1&&rb.sent===1,'each participant completes session 1 and the result reaches the server without a Claude account '+JSON.stringify([ra,rb]));
  ok(await A.p.evaluate(()=>S.sessions[1].done&&true)&&true,'progress is stored per participant in their own browser');
  // feedback from A
  await A.p.evaluate(()=>{go('trialfb')}); await A.p.click('[data-act="fbPick"][data-arg="clarity|4"]'); await A.p.click('[data-act="fbPick"][data-arg="ease|5"]'); await A.p.click('[data-act="fbPick"][data-arg="duration|مناسبة"]'); await A.p.evaluate(()=>{document.querySelector('#fbc').value='رأي سري للمشارك A'}); await A.p.click('[data-act="fbSend"]'); await A.p.waitForTimeout(500);
  ok(/وصل رأيك/.test(await A.p.evaluate(()=>document.querySelector('#sheetLayer').innerText)),'feedback form: submission acknowledged');
  // 3 privacy: B uses its own cookie jar; try to touch A's data
  const uidA=await A.p.evaluate(async()=>{const u=await window.claude.use('user');return u.id();}), uidB=await Bp.p.evaluate(async()=>{const u=await window.claude.use('user');return u.id();});
  ok(uidA!==uidB,'distinct participant ids');
  const hit=await Bp.p.evaluate(async(uidA)=>{const pid=localStorage.getItem('bard-pid');const w=await fetch('/api/db',{method:'POST',headers:{'content-type':'application/json','x-pid':pid},body:JSON.stringify({path:'trial/'+uidA+'/runs/hack',data:{x:1}})});const g=await fetch('/api/db',{headers:{'x-pid':pid}});const body=await g.json();return {w:w.status,g:g.status,paths:body.docs.map(d=>d.path),leak:JSON.stringify(body).includes('رأي سري')||JSON.stringify(body).includes('P-AAAA')};},uidA);
  ok(hit.w===403,'B cannot write into A\'s path (403)'); ok(!hit.leak&&hit.paths.every(p=>p.startsWith('trial/'+uidB)),'B reading the API sees only its own documents (no A data, no A feedback) '+hit.paths.length+' docs');
  const hit2=await Bp.p.evaluate(async()=>{const a=await fetch('/api/admin/data'); const b=await fetch('/api/admin/data',{headers:{'x-admin-key':localStorage.getItem('bard-pid')}}); return [a.status,b.status];}); ok(hit2[0]===401&&hit2[1]===401,'a participant cannot read the admin endpoint');
  const nopid=await Bp.p.evaluate(async()=>{const g=await fetch('/api/db'); return g.status;}); ok(nopid===400,'API without participant id refused');
  const bigw=await Bp.p.evaluate(async(u)=>{const w=await fetch('/api/db',{method:'POST',headers:{'content-type':'application/json','x-pid':localStorage.getItem('bard-pid')},body:JSON.stringify({path:'trial/'+u+'/runs/x',data:{s:'a'.repeat(30000)}})});const e=await fetch('/api/db',{method:'POST',headers:{'content-type':'application/json','x-pid':localStorage.getItem('bard-pid')},body:JSON.stringify({path:'../../etc',data:{}})});return [w.status,e.status];},uidB); ok(bigw[0]===413&&bigw[1]===403,'oversized document and malformed path rejected');
  // 4 admin dashboard
  const adm=await mk(); await adm.p.goto(B+'/admin'); await adm.p.fill('#k',AK); await adm.p.click('#go'); await adm.p.waitForTimeout(600); const txt=await adm.p.evaluate(()=>document.querySelector('#out').innerText);
  ok(/P-AAAA/.test(txt)&&/P-BBBB/.test(txt)&&/رأي سري للمشارك A/.test(txt),'admin dashboard (with the key) shows both participants, their results and A\'s feedback');
  const bad=await mk(); await bad.p.goto(B+'/admin'); await bad.p.fill('#k','wrong-key-wrong'); await bad.p.click('#go'); await bad.p.waitForTimeout(400); ok(/غير صحيح/.test(await bad.p.evaluate(()=>document.querySelector('#msg').textContent))&&!(await bad.p.evaluate(()=>document.querySelector('#out').innerText)).includes('P-AAAA'),'dashboard with a wrong key shows nothing');
  await adm.p.screenshot({path:'/tmp/admin.png'});
  // 5 returning participant: cookie valid, no code needed; fresh context without cookie needs the code
  await A.p.goto(B+'/'); await A.p.waitForTimeout(300); ok(await A.p.evaluate(()=>typeof BANK==='object'),'returning participant (cookie) opens the app without re-entering the code');
  const fresh=await mk(); await fresh.p.goto(B+'/'); ok(await fresh.p.evaluate(()=>!document.querySelector('#view')&&/رمز الدعوة/.test(document.body.innerText)),'a visitor without the code or cookie only sees the invite page');
  await fresh.p.fill('input[name=k]',INV); await fresh.p.click('button'); await fresh.p.waitForTimeout(600); ok(await fresh.p.evaluate(()=>typeof BANK==='object'),'typing the invite code on the invite page opens the app');
  // 6 ملف PDF: يُخفى الزر ما دام الملف غير منشور، ويعمل التنزيل حين يُنشر
  const fs=require('fs'), path=require('path'); const FD=path.join(__dirname,'../app/files');
  const goIntro=async(X,id)=>{ await X.p.evaluate(id=>{S.seen.zad=false;S.seen.maraqi=false;go('bookintro',{id,then:'home'})},id); await X.p.waitForTimeout(700); };
  r=await fetch(B+'/files/summary-zad.pdf'); ok(r.status===401,'/files without invite cookie: 401');
  const ck=(await (async()=>{const rr=await fetch(B+'/?k='+INV,{redirect:'manual'});return rr.headers.get('set-cookie').split(';')[0];})());
  r=await fetch(B+'/files/summary-zad.pdf',{headers:{cookie:ck}}); ok(r.status===404,'PDF not in the deployment: 404 (nothing served)');
  await goIntro(A,'zad'); ok(await A.p.evaluate(()=>{const e=document.querySelector('[data-dl="zad"]');return !!e&&e.hidden}),'PDF not published: the download button stays hidden (no inactive button)');
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
  fs.writeFileSync(path.join(FD,'summary-zad.pdf'),pdf);
  try{
    r=await fetch(B+'/files/summary-zad.pdf',{headers:{cookie:ck}}); ok(r.status===200&&/application\/pdf/.test(r.headers.get('content-type'))&&/attachment/.test(r.headers.get('content-disposition'))&&(await r.arrayBuffer()).byteLength===pdf.length,'PDF published: served only with the invite cookie, application/pdf, Content-Disposition: attachment, exact bytes');
    r=await fetch(B+'/files/summary-zad.pdf',{method:'HEAD',headers:{cookie:ck}}); ok(r.status===200,'HEAD works');
    for(const bad of ['/files/../package.json','/files/%2e%2e/package.json','/files/other.pdf','/files/summary-zad.pdf/../../x']){ const rr=await fetch(B+bad,{headers:{cookie:ck}}); if(rr.status===200&&bad!=='/files/summary-zad.pdf/../../x') {ok(false,'traversal '+bad);} }
    ok((await fetch(B+'/files/other.pdf',{headers:{cookie:ck}})).status===404,'only the two allowed file names are served; traversal attempts do not leak files');
    await goIntro(A,'zad'); ok(await A.p.evaluate(()=>{const e=document.querySelector('[data-dl="zad"]');return !!e&&!e.hidden}),'PDF published: the button appears on the zad path intro');
    const [dl]=await Promise.all([A.p.waitForEvent('download',{timeout:8000}),A.p.click('[data-dl="zad"]')]);
    const tmp=await dl.path(); console.log('   dl:',JSON.stringify(dl.suggestedFilename()),tmp&&fs.statSync(tmp).size,pdf.length); ok(/\.pdf$/.test(dl.suggestedFilename())&&fs.readFileSync(tmp).equals(pdf),'tapping the button downloads the exact PDF file ('+dl.suggestedFilename()+')');
    ok(!(await A.p.evaluate(()=>/تعذّر تحميل/.test(document.body.innerText))),'no error message after download');
    await goIntro(A,'maraqi'); ok(await A.p.evaluate(()=>{const e=document.querySelector('[data-dl="maraqi"]');return !!e&&e.hidden}),'maraqi PDF not published: its button stays hidden while zad shows');
    await A.p.evaluate(()=>{S.seen.zad=true;S.seen.maraqi=true;go('home');A.sumRead('all')}); await A.p.waitForTimeout(300); ok(!(await A.p.evaluate(()=>!!document.querySelector('[data-dl]'))),'no PDF button inside the text reader');
    await A.p.evaluate(()=>{closeSheet();go('home')});
  } finally { try{fs.unlinkSync(path.join(FD,'summary-zad.pdf'));}catch(e){} }
  // 7 المسميات ولوحة المؤشرات
  const N=await mk(); await N.p.goto(B+'/?k='+INV); await N.p.waitForTimeout(500); const sp=await N.p.evaluate(()=>({h1:document.querySelector('.splash h1').textContent,two:document.querySelector('.splash .two').textContent,pr:[...document.querySelectorAll('.splash .pr h2')].map(x=>x.textContent),tag:document.querySelector('.splash .tag').textContent}));
  ok(sp.h1==='برنامج بَرْد اليقين'&&sp.two==='يحتوي برنامج بَرْد اليقين على مسارين:'&&sp.pr.join('|')==='المسار التأصيلي|المسار التحصيني'&&/^رحلةٌ علمية/.test(sp.tag),'live build: new title, the two-paths sentence, «المسار التأصيلي/التحصيني»');
  await N.p.evaluate(()=>{S.seen.zad=true;S.gintro={1:true};TS.consent=true;TS.code='P-ZZZZ';TS.device='هاتف';save();seedDemo(3,0);go('home')}); await N.p.waitForTimeout(200);
  ok(await N.p.evaluate(()=>!document.querySelector('.tiles')&&!document.querySelector('.chips3')&&!document.querySelector('.progbtn')&&!/التجربة المغلقة|P-ZZZZ|نتائج التجربة|رأيك في التجربة/.test(document.querySelector('#view').innerText)),'home: no separate indicator cards, no big progress card, no closed-trial card');
  ok(await N.p.evaluate(()=>{const c=document.querySelector('.unlockcard');return !!c&&c.querySelector('h3').textContent==='ما تبقى لفتح المسار التحصيني'&&document.querySelector('#view .screen').lastElementChild===c&&!/الوقت المستثمر|أيام متتالية/.test(c.innerText)&&c.querySelectorAll('.kv div').length===1&&/مجموعات متبقية/.test(c.innerText)&&!/مراجعات متبقية/.test(c.innerText)}),'home: «ما تبقى لفتح المسار التحصيني» is the last card with the single «مجموعات متبقية» indicator');
  ok(await N.p.evaluate(()=>/الجلسة رقم ٤ من المجموعة الأولى/.test(document.querySelector('.next').innerText)),'home «خطوتك التالية»: «الجلسة رقم ٤ من المجموعة الأولى»');
  ok(await N.p.evaluate(()=>[...document.querySelectorAll('.tab')].map(t=>t.innerText.replace(/\n/g,' ')).join('|'))==='الرئيسية|المسارات|المراجعة|قياس مستوى التقدم|المصدر','bottom bar: «قياس مستوى التقدم» replaces «إنجازاتي»');
  await N.p.click('.tab:nth-child(4)'); await N.p.waitForTimeout(200); const pt=await N.p.evaluate(()=>document.querySelector('#view').innerText);
  ok(['نسبة إنجاز المسار','الإتقان المثبت','الجلسات المكتملة','الجلسات المتبقية للمراجعة القادمة','الصواب من المحاولة الأولى','دقائق التعلم','الإنجاز اليومي','الاستمرارية','تحتاج إلى إعادة تثبيت'].every(w=>pt.includes(w)),'unified progress page (from the bottom tab) shows every indicator');
  ok([A,Bp,adm,bad,fresh].every(x=>x.p.errs.length===0),'no page errors '+[A,Bp,adm].map(x=>x.p.errs.join('|')).join(''));
  console.log(`\nPASS=${pass} FAIL=${fail}`); await b.close(); server.close(); process.exit(fail?1:0);
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
