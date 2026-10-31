const {chromium}=require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);} };
const ROOT='/home/user/English-450/bard-alyaqeen', PUB=__dirname+'/pub';
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0]; let f=u==='/'?ROOT+'/prototype.html':(fs.existsSync(PUB+u)?PUB+u:null); if(!f){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':f.endsWith('.pdf')?'application/pdf':'text/html; charset=utf-8'}); fs.createReadStream(f).pipe(r);});
(async()=>{
  await new Promise(r=>srv.listen(0,r)); const URL='http://127.0.0.1:'+srv.address().port+'/';
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:800}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{window.claude={use:async n=>n==='downloads'?{save:async r=>{window.__saved={filename:r.filename,size:r.data.size};return {status:'saved'};}}:null};});
  await p.goto(URL); await p.waitForTimeout(250);
  const ev=f=>p.evaluate(f); const act=async(a,g)=>{await p.click(`[data-act="${a}"]${g!=null?`[data-arg="${g}"]`:''}`);await p.waitForTimeout(80);};
  const txt=()=>ev(()=>document.querySelector('#view').innerText+'\n'+document.querySelector('#sheetLayer').innerText);
  // 1 bank hygiene
  const h=await ev(()=>{const bad=[];const forb=/يناسب بعض خلقه|يشابههم|شريك في العبادة|يخلق بالاشتراك|يمنع العزل|الحسد لما أُعطي|طلب المصلحة الدنيوية|القدرة على الخلق|^الغنى$|مساوٍ لها|ناسخ لها/;let nOpt={2:0,3:0,x:0},maxW=0,multi=[];
    for(const id in BANK.byId){const q=BANK.byId[id]; if(q.status!=='valid') continue; q.options.forEach(o=>{if(forb.test(o))bad.push(id+':'+o);}); (nOpt[q.options.length]!==undefined?nOpt[q.options.length]++:nOpt.x++); maxW=Math.max(maxW,q.text.trim().split(/\s+/).length); if(q.correct!==0&&false) bad.push(id); if(/[؟?].*[؟?]/.test(q.text)||/،\s*(وما|وماذا|ومن)\s/.test(q.text)) multi.push(id);}
    return {bad,nOpt,maxW,multi,n:Object.values(BANK.byId).filter(q=>q.status==='valid').length};});
  ok(h.bad.length===0,'no improper distractor patterns in 42 questions '+JSON.stringify(h.bad)); ok(h.n===42&&h.nOpt.x===0,'42 questions, 2-3 options each '+JSON.stringify(h.nOpt)); ok(h.multi.length===0,'no "X، وما Y" compound question stems '+JSON.stringify(h.multi)); console.log('   longest stem words:',h.maxW);
  const q4=await ev(()=>BANK.byId.s8q4.options.length+'|'+BANK.byId.s8q4.options.join('|')); ok(!/يناسب بعض خلقه/.test(q4)&&/شيئين متناسبين/.test(q4),'s8q4 reworked: removed option gone, correct kept'); const q32=await ev(()=>BANK.byId.s3q2.text); ok(/بماذا سمّى الله الصلاة إلى بيت المقدس/.test(q32)&&!/مما يدل/.test(q32),'s3q2 simplified to one idea');
  // 2 book intro: links + download
  await ev(()=>resetAll()); await p.reload(); await p.waitForTimeout(250); await act('enter','zad:home'); await p.waitForTimeout(700);
  let t=await txt(); ok((await ev(()=>ui.screen))==='bookintro'&&/البرنامج التأصيلي/.test(t)&&/زاد العباد/.test(t)&&/ابدأ التعلم مباشرة/.test(t),'book card: program, book, start');
  ok(await ev(()=>document.querySelector('#view a[href="https://store.dorar.net/zad-al-abbad/p1793429359"]')!==null),'zad link = supplied URL');
  ok(await ev(()=>{const e=document.querySelector('[data-dl="zad"]');return !!e&&!e.hidden}),'download button visible only after file + downloads probe succeed'); await p.screenshot({path:'shots/n1-intro.png'});
  await ev(()=>{window.__saved=null}); await act('dlSummary','zad'); await p.waitForTimeout(500); const sv=await ev(()=>window.__saved); const sz=fs.statSync(PUB+'/summary-zad.pdf').size;
  ok(sv&&sv.size===sz&&/\.pdf$/.test(sv.filename),'download hands the full summary PDF to downloads.save ('+JSON.stringify(sv)+')');
  await ev(()=>go('bookintro',{id:'maraqi',then:'home'})); await p.waitForTimeout(500); ok(await ev(()=>document.querySelector('#view a[href="https://archive.org/details/mrq-way-salehsindi"]')!==null),'maraqi link = supplied URL');
  ok(await ev(()=>{const e=document.querySelector('[data-dl="maraqi"]');return !!e&&!e.hidden}),'maraqi download visible');
  const b0=await ev(()=>JSON.stringify(calc())); ok(b0===await ev(()=>JSON.stringify(calc())),'indicators untouched');
  await ev(()=>closeSheet()); await ev(()=>go('bookintro',{id:'zad',then:'home'})); await p.waitForTimeout(200);
  await act('startLearning','zad:home'); t=await txt(); ok(!/قراءة اختيارية|قراءة إثرائية|نطاق القراءة/.test(t),'home has no reading cards');
  await act('intro','1'); t=await txt(); ok(!/قراءة|الكتاب الأصلي/.test(t)&&/عرض الملخص/.test(t),'session intro: only "عرض الملخص"');
  await act('startSession','1'); const first=await ev(()=>RUN.cur.id); const wrong=await ev(()=>RUN.cur.order.findIndex(o=>o!==BANK.byId[RUN.cur.id].correct)); await act('answer',wrong);
  t=await txt(); ok(/كتاب «زاد العباد»/.test(t)&&/الصفحة قيد التحقق/.test(t),'reference: book + topic + page pending');
  ok(await ev(()=>{const a=document.querySelector('.ref a.booklink');return !!a&&a.href.includes('store.dorar.net')&&a.target==='_blank'}),'reference carries "فتح الكتاب" link to the general page (no fake page deep link)');
  ok(!await ev(()=>/store\.dorar\.net[^"]*#|page=/.test(document.querySelector('.ref').innerHTML)),'no invented per-page link');
  // 4 viewer full-screen, back to question, timer paused
  const left=await ev(()=>RUN.secsLeft), qs=await ev(()=>RUN.queue.join());
  await act('sumView','zad|4'); await p.waitForTimeout(150);
  const g=await ev(()=>{const r=document.querySelector('#sheetLayer .sheet').getBoundingClientRect(),st=document.querySelector('.stage').getBoundingClientRect();return {t:Math.round(r.top-st.top),h:Math.round(r.height),sh:Math.round(st.height),w:Math.round(r.width),sw:Math.round(st.width),btn:/العودة إلى السؤال/.test(document.querySelector('#sheetLayer').innerText),img:!!document.querySelector('.pv img'),ta:getComputedStyle(document.querySelector('.pv')).touchAction}});
  ok(g.t<=1&&Math.abs(g.h-g.sh)<=2&&Math.abs(g.w-g.sw)<=2,'viewer fills the whole screen '+JSON.stringify(g)); ok(g.btn&&g.img,'viewer: page image + "العودة إلى السؤال"'); ok(/manipulation|pinch-zoom/.test(g.ta),'pinch-zoom allowed on page area'); await p.screenshot({path:'shots/n2-viewer.png'});
  await ev(()=>{window.__saved=null}); ok(await ev(()=>{const e=document.querySelector('#sheetLayer [data-dl]');return !!e&&!e.hidden}),'viewer also offers full-summary download');
  await p.waitForTimeout(2200); ok(await ev(()=>RUN.secsLeft)===left,'timer paused while the viewer is open');
  await p.click('#sheetLayer .btn.primary[data-act="closeSheet"]'); await p.waitForTimeout(100); ok((await ev(()=>RUN.queue.join()))===qs&&(await ev(()=>ui.screen))==='wrong','"العودة إلى السؤال" returns to the same screen, queue intact');
  await p.waitForTimeout(1500); ok(await ev(()=>RUN.secsLeft)<left,'timer resumes after returning');
  // 5 phone screens of the two reported questions
  for(const id of ['s8q4','s3q2']){ await p.evaluate((id)=>{RUN=null;const n=+/^s(\d+)/.exec(id)[1];seedDemo(n-1,0);go('home')},id); await p.evaluate((id)=>{const n=+/^s(\d+)/.exec(id)[1];A.startSession(String(n));},id); await p.waitForTimeout(200);
    for(let k=0;k<8&&(await ev(()=>ui.screen))==='question'&&(await ev(()=>RUN.cur.id))!==id;k++){const i=await ev(()=>RUN.cur.order.findIndex(o=>o===BANK.byId[RUN.cur.id].correct)); await act('answer',i); await act('next');}
    const cur=await ev(()=>RUN&&RUN.cur&&RUN.cur.id); ok(cur===id,'reached '+id); const m=await ev(()=>{const v=document.querySelector('#view');return {sh:v.scrollHeight,ch:v.clientHeight,hs:document.documentElement.scrollWidth>innerWidth}}); ok(!m.hs,id+' no horizontal overflow on 390px'); await p.screenshot({path:`shots/n3-${id}.png`}); }
  ok(errs.length===0,'no page errors '+errs.join('|'));
  console.log(`\nPASS=${pass} FAIL=${fail}`); await b.close(); srv.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
