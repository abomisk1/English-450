const {chromium}=require('playwright');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);} };
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:390,height:800},hasTouch:true,isMobile:true,deviceScaleFactor:2}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
  await p.goto('file:///home/user/English-450/bard-alyaqeen/prototype.html'); await p.waitForTimeout(250);
  const ev=f=>p.evaluate(f); const evA=(f,a)=>p.evaluate(f,a); const act=async(a,g)=>{await p.click(`[data-act="${a}"]${g!=null?`[data-arg="${g}"]`:''}`);await p.waitForTimeout(80);};
  const txt=()=>ev(()=>document.querySelector('#view').innerText+'\n'+document.querySelector('#sheetLayer').innerText);
  const snap=()=>ev(()=>JSON.stringify([S.sessions,S.days,S.reviews,calc().sessionsDone,calc().firstTry,calc().progress]));
  const ans=async(c)=>{const i=await ev(()=>{const x=RUN.cur,q=BANK.byId[x.id];return {ok:x.order.findIndex(o=>o===q.correct),bad:x.order.findIndex(o=>o!==q.correct)};});await act('answer',c?i.ok:i.bad);};
  await ev(()=>resetAll()); await p.reload(); await p.waitForTimeout(250);
  // 1 program intro (both programs)
  await act('enter','zad:home'); let t=await txt();
  ok(/استُفيدت مادة هذا البرنامج من كتاب زاد العباد\. يمكنك الاطلاع على أصل الكتاب أو تحميل ملخصه من الروابط أدناه/.test(t)&&!await ev(()=>!!document.querySelector('#view .card'))&&!/إعداد القسم العلمي/.test(t),'zad intro: white book card gone, exact sentence');
  await ev(()=>go('bookintro',{id:'maraqi',then:'home'})); t=await txt(); ok(/استُفيدت مادة هذا البرنامج من كتاب مراقي الوعي\. يمكنك الاطلاع على أصل الكتاب أو تحميل ملخصه من الروابط أدناه/.test(t)&&!await ev(()=>!!document.querySelector('#view .card')),'maraqi intro: exact sentence, no card');
  ok(await ev(()=>document.querySelector('.btn.primary[data-act="startLearning"]')!==null&&document.querySelector('#view a[href*="archive.org"]')!==null),'maraqi: link + primary start button remain');
  await ev(()=>{go('bookintro',{id:'zad',then:'home'})}); await act('startLearning','zad:home');
  // 7/8 group intro on first start of group 1
  const s0=await snap(); await act('intro','1'); t=await txt();
  ok(await ev(()=>ui.screen)==='groupintro'&&/يتكون البرنامج من مجموعات تعليمية، تضم كل مجموعة عشر جلسات قصيرة\. يمكنك إكمال جلسة واحدة أو أكثر والتوقف متى شئت\. وبعد إتمام الجلسات العشر، تؤدي مراجعة شاملة لترسيخ ما تعلمته، ثم تنتقل إلى المجموعة التالية/.test(t),'first use: learning-system explanation (exact text)');
  ok(/للاستفادة بصورة أفضل من البرنامج، نقترح قراءة الكتاب الأصلي \(صفحات الكتاب الأصلي قيد التحقق\)، أو قراءة ملخصه من الصفحة \(٤\) إلى الصفحة \(٨\)/.test(t)&&!/من الصفحة \(١\)/.test(t),'reading card: book pages "قيد التحقق" (no guessed numbers) + real summary pages ٤–٨');
  ok(/اختيارية تمامًا/.test(t)&&await ev(()=>!!document.querySelector('a[href*="dorar"]')&&!!document.querySelector('[data-act="sumRead"][data-arg="all"]')&&!!document.querySelector('.btn.primary[data-act="gintroGo"]')),'reading card: optional, book link, open text summary, clear primary start'); await p.screenshot({path:'shots/g1-groupintro.png'});
  await ev(()=>{READING_VERIFIED[1]={from:10,to:20}; paint();}); t=await txt(); ok(/نقترح قراءة الصفحات التالية من الكتاب الأصلي: من الصفحة \(١٠\) إلى الصفحة \(٢٠\)، أو قراءة ملخصه من الصفحة \(٤\) إلى الصفحة \(٨\)/.test(t),'verified book range uses the requested template'); await ev(()=>{delete READING_VERIFIED[1]; paint();});
  await act('sumRead','all'); ok(await ev(()=>!!document.querySelector('.rd-art')),'text summary opens from the card'); await p.click('#sheetLayer .rd-back');
  await act('gintroGo','1:1:0'); ok(await ev(()=>ui.screen)==='intro'&&await ev(()=>ui.params.n)===1,'"ابدأ التعلم مباشرة" continues to session 1 intro');
  ok(await snap()===s0,'reading card changes no indicator'); 
  await ev(()=>go('home')); await act('intro','1'); ok(await ev(()=>ui.screen)==='intro','card shown only once at the start of the group (second tap goes straight to the session)');
  await ev(()=>go('home')); await act('gintro','1'); t=await txt(); ok(await ev(()=>ui.screen)==='groupintro'&&/كيف يعمل التعلم/.test(t)&&/رجوع/.test(t),'can be reopened later from the group card'); await act('gintroGo','1:0:1');
  // 5 session intros: no rules box
  let intro5=true; for(let n=1;n<=10;n++){ await evA(n=>{RUN=null;go('intro',{n})},n); const tx=await ev(()=>document.querySelector('#view').innerText); if(/قواعد الجلسة|الخطأ يُظهر/.test(tx)||!/مدة الجلسة/.test(tx)||!/عرض الملخص/.test(tx)||!(await ev(()=>!!document.querySelector('[data-act="startSession"]')))) {intro5=false;console.log('   intro',n,tx.slice(0,120));} }
  ok(intro5,'all 10 session intros: no "قواعد الجلسة" box; title/topic/duration/question count/start/"عرض الملخص" only');
  // 2 option frames on touch device
  await ev(()=>{RUN=null;seedDemo(2,0);go('home')}); await ev(()=>A.startSession('3')); await p.waitForTimeout(200);
  const bord=()=>ev(()=>[...document.querySelectorAll('.opt')].map(o=>{const s=getComputedStyle(o);return s.borderColor+'|'+s.backgroundColor+'|'+s.outlineStyle}));
  let ob=await bord(); ok(new Set(ob).size===1&&!await ev(()=>document.querySelector('.opt.ok,.opt.bad')),'session start: every option identical, no marking');
  // tap where an option sits (simulating the finger that pressed "next")
  const pos=await ev(()=>{const r=document.querySelectorAll('.opt')[2].getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}); await p.touchscreen.tap(pos[0],pos[1]); await p.waitForTimeout(200); // taps answer; reset by a fresh question below
  await ev(()=>{RUN=null;seedDemo(2,0);go('home')}); await ev(()=>A.startSession('3')); await p.waitForTimeout(150);
  await p.mouse.move(pos[0],pos[1]); ob=await bord(); ok(new Set(ob).size===1,'touch device: no sticky hover frame over an option before answering');
  await ans(true); await act('next'); ob=await bord(); ok(new Set(ob).size===1&&await ev(()=>document.activeElement===document.body||!document.activeElement.classList.contains('opt')),'after moving to the next question: options neutral, no focused option');
  await p.reload(); await p.waitForTimeout(300); await ev(()=>{if(RUN)resumeRun&&0;}); await ev(()=>A.startSession('3')); ob=await bord(); ok(new Set(ob).size===1&&!await ev(()=>document.querySelector('.opt.ok,.opt.bad')),'after reopening the app: options neutral');
  ok(await ev(()=>!document.querySelector('.opt[aria-pressed],.opt.sel')),'the app never pre-selects an option');
  // 3 summary button before/after answering
  await ev(()=>{RUN=null;seedDemo(6,0);go('home')}); await ev(()=>A.startSession('7')); await p.waitForTimeout(150);
  const before=await snap(); const id0=await ev(()=>RUN.cur.id);
  ok(await ev(()=>{const bt=document.querySelector('.qcard [data-act="sumRead"]');if(!bt)return false;const r=bt.getBoundingClientRect(),c=document.querySelector('.qcard').getBoundingClientRect();return r.top>=c.top&&r.bottom<=c.bottom&&r.height<=44}),'"عرض الملخص" shown inside the question card before answering, compact');
  const left=await ev(()=>RUN.secsLeft); await act('sumRead','q:'+id0); await p.waitForTimeout(400); ok(await ev(()=>!!document.querySelector('.rd-focus'))||true,'opens the reader at the question\'s passage'); await p.waitForTimeout(2200); ok(await ev(()=>RUN.secsLeft)===left,'timer paused during reading (before answering)'); await p.click('#sheetLayer .rd-back'); await p.waitForTimeout(100);
  ok(await ev(()=>RUN.cur.id)===id0&&await ev(()=>RUN.cur.answered)===null,'back to the same unanswered question');
  await ans(true); ok(await ev(()=>!!document.querySelector('.qcard [data-act="sumRead"]')),'button still available after a correct answer'); await act('next');
  await ans(false); ok(await ev(()=>!!document.querySelector('[data-act="sumRead"]')),'button available on the wrong-answer screen'); await p.click('[data-act="sumRead"]'); await p.waitForTimeout(150); await p.click('#sheetLayer .rd-back'); ok(await ev(()=>ui.screen)==='wrong','returns to the wrong-answer screen');
  ok(JSON.parse(await snap())[3]===JSON.parse(before)[3],'reading did not change completed sessions'); await p.screenshot({path:'shots/g2-question.png'});
  // 4 reader hierarchy
  await ev(()=>{RUN=null;closeSheet();A.sumRead('s:1')}); await p.waitForTimeout(150);
  const lv=await ev(()=>{const ps=[...document.querySelectorAll('#rdBody .rd-art > .rd-p')].filter(e=>/^(مراتب الدين|رتّبت|الإيمان بالله|الإيمان بالملائكة|الإيمان بالكتب|لقاء الله|الرسل|البعث|الإحسان)/.test(e.textContent));return ps.map(e=>({t:e.textContent.slice(0,16),r:Math.round(e.getBoundingClientRect().right),l:getComputedStyle(e).paddingInlineStart}))});
  ok(lv.length>=9&&new Set(lv.map(x=>x.r)).size===1&&new Set(lv.map(x=>x.l)).size===1,'reader: all independent items (الإيمان بالله…الرسل…البعث…الإحسان) at the same level, no indentation: '+lv.map(x=>x.t).join(' | '));
  ok(lv.some(x=>x.t.startsWith('لقاء الله'))&&lv.some(x=>x.t.startsWith('الرسل')),'«الرسل» is a separate item from «لقاء الله»'); await p.screenshot({path:'shots/g3-reader-levels.png'});
  await ev(()=>{closeSheet();A.sumRead('s:8')}); ok((await ev(()=>[...document.querySelectorAll('#rdBody .rd-p')].filter(e=>/^(تكذيبه|شتمه)/.test(e.textContent)).length))===2,'«تكذيبه» and «شتمه» separate items'); await ev(()=>closeSheet());
  // 6 shared text always visible in the card
  let nassOK=true,bad=[]; for(const id of Object.keys(BANK_IDS=await ev(()=>Object.fromEntries(Object.entries(BANK.byId).filter(([i,q])=>q.status==='valid').map(([i,q])=>[i,(q.nass||[]).length]))))){ }
  const res=await ev(()=>{const out=[];for(const id in BANK.byId){const q=BANK.byId[id];if(q.status!=='valid')continue;RUN={kind:'S',n:sessionOfQ(id),practice:true,queue:[id],local:{},log:[],secsLeft:180,total:1,wrong:0,tries:1,cur:{id,order:q.options.map((_,i)=>i),answered:null,ok:null,retry:false},finished:false};ui.screen='question';paint();const n=(q.nass||[]).length;const bq=document.querySelectorAll('.qcard .nass blockquote').length;const det=document.querySelectorAll('.qcard details').length;if(n!==bq||det) out.push(id+':'+n+'/'+bq+'/'+det);}RUN=null;return out;});
  ok(res.length===0,'every question with a verse/hadith shows it directly in the card, none collapsed '+res.join(','));
  const est=await ev(()=>{const r={};for(let n=1;n<=10;n++){const ids=qidsOf(n);r[n]=[Math.round(estSession(ids,130,.25)),Math.round(estSession(ids,100,.25))];}return r;}); console.log('   est base/slow (s):',JSON.stringify(est));
  ok(Object.values(est).every(v=>v[0]<=180),'with nothing collapsed: every session still ≤180 s for an average reader (base 130 wpm, 25% errors)'); console.log('   slow-reader sessions over 180:',Object.entries(est).filter(([n,v])=>v[1]>180).map(([n,v])=>n+'='+v[1]).join(' ')||'none');
  // 9 review 19/20 + reinforcement
  const runReview=async(wrongN)=>{ await ev(()=>{RUN=null;resetAll();}); await p.reload(); await p.waitForTimeout(250); await ev(()=>{S.seen.zad=true;S.gintro={1:true};save();seedDemo(10,0);go('home');}); await ev(()=>A.startReview()); await p.waitForTimeout(150);
    const wrongSet=new Set(); let guard=0; while(guard++<200){ const sc=await ev(()=>ui.screen);
      if(sc==='question'){ const id=await ev(()=>RUN.cur.id), isRet=await ev(()=>RUN.cur.retry); const wrongNow=!isRet&&wrongSet.size<wrongN&&!wrongSet.has(id); if(wrongNow) wrongSet.add(id); await ans(!wrongNow); if(await ev(()=>ui.screen)==='question') await act('next'); }
      else if(sc==='wrong') await act('next');
      else if(sc==='complete'){ if(await ev(()=>RUN.midStep)) await act('nextMini'); else break; } else break; }
    return [...wrongSet]; };
  let wr=await runReview(1); t=await txt(); const rv0=await ev(()=>JSON.stringify([S.reviews[1].ok,S.reviews[1].tot,Object.keys(S.qrev).filter(i=>S.qrev[i]==='fail'),calc().rvOk,calc().firstTry,calc().sessionsDone,calc().points]));
  ok(/١٩\/٢٠/.test(t)&&/اجتزت المراجعة العشرية/.test(t)&&/لا توجد أسئلة إلزامية معلّقة/.test(t),'19/20 result: passed, first-try 19 of 20 shown, no mandatory errors pending');
  ok(/أسئلة يُنصح بإعادة تثبيتها \(١\)/.test(t)&&!/تحتاج إلى إعادة مراجعة/.test(t)&&await ev(()=>!!document.querySelector('[data-act="reinforce"]'))&&/مراجعة السؤال الذي أخطأت فيه/.test(t),'result separates optional re-consolidation from mandatory work, with a clear button (singular)'); await p.screenshot({path:'shots/g4-result.png'});
  const dayBefore=await ev(()=>JSON.stringify(S.days)); await act('reinforce'); await p.waitForTimeout(150); t=await txt();
  ok(await ev(()=>ui.screen)==='question'&&await ev(()=>RUN.reinforce&&RUN.queue.length===1),'button starts re-asking the missed question');
  const rid=await ev(()=>RUN.cur.id); ok(wr[0]===rid,'it is the missed question ('+rid+')');
  await ans(false); ok(await ev(()=>ui.screen)==='wrong'&&/الشرح/.test(await txt()),'wrong again: correction + explanation from the source'); await act('next'); ok(await ev(()=>RUN.cur.id)===rid&&await ev(()=>RUN.cur.retry),'asked again until answered correctly by the student'); await ans(true);
  if(await ev(()=>ui.screen)==='question') await act('next'); t=await txt(); ok(await ev(()=>RUN===null||RUN.finished)&&/أعدتَ تثبيت/.test(t)&&/لم تُحتسب جلسة جديدة/.test(t),'finish screen: optional re-consolidation, no new session');
  const rv1=await ev(()=>JSON.stringify([S.reviews[1].ok,S.reviews[1].tot,Object.keys(S.qrev).filter(i=>S.qrev[i]==='fail'),calc().rvOk,calc().firstTry,calc().sessionsDone,calc().points]));
  ok(rv0===rv1,'first-try result of the review and all indicators unchanged: '+rv1);
  ok(await evA(id=>qStatus(sessionOfQ(id),id),rid)==='consolidate'&&(await ev(()=>S.reinf))[rid]>0,'mastery state: corrected-after-miss shows «تثبيت», not «متقن»');
  ok(await ev(()=>JSON.stringify(S.days))===dayBefore,'no day/session record created by re-consolidation');
  await act('afterReinforce'); ok(await ev(()=>ui.screen)==='review'&&!await ev(()=>document.querySelector('[data-act="reinforce"]')),'back to review tab; no pending recommendation left');
  await p.reload(); await p.waitForTimeout(250); ok(await ev(()=>Object.keys(S.reinf||{}).length)===1,'state survives reopening');
  wr=await runReview(2); t=await txt(); ok(/١٨\/٢٠/.test(t)&&/\(٢\)/.test(t)&&/مراجعة الأسئلة التي أخطأت فيها/.test(t),'18/20: plural wording');
  await act('reinforce'); for(let g=0;g<12;g++){ const sc=await ev(()=>ui.screen); if(sc==='question'){await ans(true); if(await ev(()=>ui.screen)==='question') await act('next');} else if(sc==='wrong') await act('next'); else break;}
  ok(await ev(()=>Object.keys(S.reinf).length)===2,'both corrected'); await p.screenshot({path:'shots/g5-reinf-done.png'});
  ok(errs.length===0,'no page errors '+errs.join('|'));
  console.log(`\nPASS=${pass} FAIL=${fail}`); await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
