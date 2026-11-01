const {chromium}=require('playwright'); const http=require('http'),fs=require('fs');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);} };
const ROOT='/home/user/English-450/bard-alyaqeen', PUB=__dirname+'/pub';
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0]; let f=u==='/'?ROOT+'/prototype.html':(fs.existsSync(PUB+u)?PUB+u:null); if(!f){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':f.endsWith('.pdf')?'application/pdf':'text/html; charset=utf-8'}); fs.createReadStream(f).pipe(r);});
(async()=>{
  await new Promise(r=>srv.listen(0,r)); const URL='http://127.0.0.1:'+srv.address().port+'/';
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:800},hasTouch:true,isMobile:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{window.claude={use:async n=>n==='downloads'?{save:async r=>{window.__saved=r.filename;return {status:'saved'};}}:null};});
  await p.goto(URL); await p.waitForTimeout(250);
  const ev=f=>p.evaluate(f), evA=(f,a)=>p.evaluate(f,a); const act=async(a,g)=>{await p.click(`[data-act="${a}"]${g!=null?`[data-arg="${g}"]`:''}`);await p.waitForTimeout(80);};
  const ans=async(c)=>{const i=await ev(()=>{const x=RUN.cur,q=BANK.byId[x.id];return {ok:x.order.findIndex(o=>o===q.correct),bad:x.order.findIndex(o=>o!==q.correct)};});await act('answer',c?i.ok:i.bad);};
  const hasExt=()=>ev(()=>!!document.querySelector('#view a[href^="http"],#sheetLayer a[href^="http"],#view [data-dl],#sheetLayer [data-dl],#view [data-act="dlSummary"],#sheetLayer [data-act="dlSummary"],#view [data-act="bookIntro"],#view [data-act="bookSheet"]'));
  await ev(()=>resetAll()); await p.reload(); await p.waitForTimeout(250);
  // 1,2 first entry: both programs show book link + PDF
  for(const [id,host] of [['zad','dorar'],['maraqi','archive.org']]){
    await ev(()=>{resetAll();}); await p.reload(); await p.waitForTimeout(250); await ev(()=>{go('home')});
    await evA(id=>A.enter(id+':'+(id==='zad'?'home':'home')),id); await p.waitForTimeout(700);
    ok(await ev(()=>ui.screen)==='bookintro','first entry to '+id+': intro screen shown');
    ok(await evA(h=>!!document.querySelector(`#view a[href*="${h}"]`),host),id+': original-book link shown on the intro');
    ok(await evA(id=>{const e=document.querySelector(`[data-dl="${id}"]`);return !!e&&!e.hidden},id),id+': "تحميل الملخص PDF" shown on the intro');
    await act('startLearning',id+':home'); ok(await evA(id=>S.seen[id]===true,id),id+': completion of the intro is saved per program');
  }
  // 3 reopen: not shown again, per program
  await ev(()=>{resetAll();S.seen.zad=true;save();}); await p.reload(); await p.waitForTimeout(250);
  await ev(()=>A.enter('zad:home')); ok(await ev(()=>ui.screen)!=='bookintro','after reload: zad intro not shown again');
  await evA(()=>{go('home')}); await ev(()=>A.enter('maraqi:tahsini')); await p.waitForTimeout(100); ok(await ev(()=>ui.screen)==='bookintro','the other program (not yet seen) still shows its own intro first time');
  await act('startLearning','maraqi:tahsini'); await p.reload(); await p.waitForTimeout(250); await ev(()=>A.enter('maraqi:tahsini')); ok(await ev(()=>ui.screen)!=='bookintro','after reload: maraqi intro not shown again');
  ok(!await ev(()=>!!document.querySelector('#view [data-act="bookIntro"]')),'no re-entry button to the book card on the program screens');
  // 4 study screens: no external links, no PDF
  await ev(()=>{resetAll();S.seen.zad=true;S.gintro={1:true};save();seedDemo(6,0);go('home')}); await p.waitForTimeout(100);
  const shots=[]; const check=async(name)=>{ if(await hasExt()) shots.push(name); };
  await check('home'); await ev(()=>go('programs')); await check('programs'); await ev(()=>go('sections')); await check('sections'); await ev(()=>go('ach')); await check('ach'); await ev(()=>go('src')); await check('src');
  await ev(()=>go('home')); await act('gintro','1'); await check('groupintro'); await ev(()=>go('home'));
  await evA(n=>go('intro',{n}),7); await check('intro'); await ev(()=>A.startSession('7')); await p.waitForTimeout(150); await check('question');
  await ans(false); await check('wrong'); await act('next'); await ans(true); await check('correct'); 
  await ev(()=>A.sumRead('q:'+RUN.cur.id)); await check('reader'); await ev(()=>closeSheet());
  ok(shots.length===0,'no original-book or PDF link/button on any study screen (home, programs, sections, ach, group card, intro, question, wrong, correct, reader): '+shots.join(','));
  const refT=await ev(()=>{RUN.cur.answered=0;return 0}); 
  await ev(()=>{RUN=null;go('home')}); await ev(()=>{seedDemo(10,0);go('home');A.startReview()}); await p.waitForTimeout(150); await check('review question'); ok(!await hasExt(),'review screens have no book/PDF links');
  await ans(false); const rt=await ev(()=>document.querySelector('#view').innerText); ok(/كتاب «زاد العباد»/.test(rt)&&!await hasExt(),'answer screens keep the short citation (book name + topic + page pending) without a link');
  // 5 summary button before/after
  await ev(()=>{RUN=null;seedDemo(6,0);go('home');A.startSession('7')}); await p.waitForTimeout(150);
  const geo=await ev(()=>{const bt=document.querySelector('.qcard .qsum'),c=document.querySelector('.qcard').getBoundingClientRect(),r=bt.getBoundingClientRect(),opts=[...document.querySelectorAll('.opt')].map(o=>getComputedStyle(o).backgroundColor);const cs=getComputedStyle(bt);return {txt:bt.textContent.trim(),inside:r.top>=c.top&&r.bottom<=c.bottom+1,h:Math.round(r.height),bg:cs.backgroundColor,optBg:opts[0],border:cs.borderTopWidth,full:Math.round(r.width/c.width*100)}});
  ok(geo.txt==='📖 قراءة شرح السؤال من الملخص'&&geo.inside&&geo.h<=48,'button text/position: "📖 قراءة شرح السؤال من الملخص" inside the question card, compact '+JSON.stringify(geo));
  ok(geo.bg!==geo.optBg&&geo.border==='0px','button looks different from the answer options (tinted, borderless, not option-shaped)');
  await p.screenshot({path:'shots/h1-question.png'});
  const posBefore=await ev(()=>Math.round(document.querySelector('.qsum').getBoundingClientRect().top)); const id0=await ev(()=>RUN.cur.id); const left=await ev(()=>RUN.secsLeft);
  await act('sumRead','q:'+id0); await p.waitForTimeout(500); ok(await ev(()=>!!document.querySelector('.rd-focus')),'opens the reader directly at the paragraph linked to the question'); ok(!await ev(()=>!!document.querySelector('#sheetLayer a[href],#sheetLayer [data-dl]')),'reader has no PDF/book link'); await p.waitForTimeout(2200); ok(await ev(()=>RUN.secsLeft)===left,'timer paused while reading');
  ok(await ev(()=>/العودة إلى السؤال/.test(document.querySelector('.rd-back').textContent)),'clear "العودة إلى السؤال" button'); await p.click('.rd-back'); await p.waitForTimeout(100);
  ok(await ev(()=>RUN.cur.id)===id0&&await ev(()=>RUN.cur.answered)===null,'back on the same unanswered question, progress intact'); await p.waitForTimeout(1500); ok(await ev(()=>RUN.secsLeft)<left,'timer resumes');
  await ans(true); const posAfter=await ev(()=>Math.round(document.querySelector('.qcard .qsum').getBoundingClientRect().top)); ok(Math.abs(posAfter-posBefore)<=4,'button stays in the same place after answering ('+posBefore+'→'+posAfter+')');
  // answering directly without reading is possible & reading does not affect indicators
  const snap=()=>ev(()=>JSON.stringify([S.sessions,S.days,S.reviews,calc().sessionsDone,calc().firstTry,calc().progress,calc().mastery]));
  await ev(()=>{RUN=null;go('home')}); const s0=await snap(); await ev(()=>A.sumRead('all')); await ev(()=>closeSheet()); ok(s0===await snap(),'reading changes no progress/mastery indicator');
  // 7 PDF file kept in project
  ok(fs.existsSync(PUB+'/summary-zad.pdf')&&fs.existsSync(PUB+'/summary-maraqi.pdf'),'PDF files kept as published reference files');
  ok(errs.length===0,'no page errors '+errs.join('|'));
  console.log(`\nPASS=${pass} FAIL=${fail}`); await b.close(); srv.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
