const {chromium}=require('playwright');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);} };
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:360,height:740},hasTouch:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
  await p.goto('file:///home/user/English-450/bard-alyaqeen/trial.html'); await p.waitForTimeout(250);
  const ev=f=>p.evaluate(f); const act=async(a,g)=>{await p.click(`[data-act="${a}"]${g!=null?`[data-arg="${g}"]`:''}`);await p.waitForTimeout(80);};
  const base=()=>p.evaluate(()=>{TS.consent=true;TS.code='P-TEST';TS.device='هاتف';S.seen.zad=true;S.gintro={1:true};save();tsave();});
  const card=async()=>{ await ev(()=>{go('home');document.querySelector('#view').scrollTo(0,99999)}); await p.waitForTimeout(80); return ev(()=>{const c=document.querySelector('.unlockcard');return {h:c.querySelector('h3').textContent,kv:[...c.querySelectorAll('.kv div')].map(d=>d.innerText.replace(/\n/g,' ')),w:parseFloat((c.querySelector('.meter i')||{style:{width:'0'}}).style.width)||0,txt:c.innerText,lock:!!c.querySelector('.lockbadge svg'),passed:calc().reviewsDone,gl:calc().groupsLeft}}); };
  const setup=(n,r)=>p.evaluate(([n,r])=>{resetAll();TS.consent=true;TS.code='P-TEST';TS.device='هاتف';S.seen.zad=true;S.gintro={1:true};save();seedDemo(n,r);go('home')},[n,r]);
  const cases=[[0,0,45,'بداية التعلم'],[3,0,45,'٣ جلسات'],[2,0,45,'جلستان ثم التوقف'],[10,0,45,'عشر جلسات دون مراجعة'],[10,1,44,'اجتياز مراجعة المجموعة الأولى'],[20,1,44,'جلسات المجموعة الثانية دون مراجعتها'],[20,2,43,'اجتياز مراجعة المجموعة الثانية'],[15,1,44,'منتصف المجموعة الثانية']];
  for(const [n,r,exp,lab] of cases){ await setup(n,r); const c=await card(); const pctExp=(r/45*100);
    ok(c.kv.length===1&&/مجموعات متبقية/.test(c.kv[0])&&c.kv[0].includes(await p.evaluate(n=>ar(n),exp))&&Math.abs(c.w-pctExp)<0.05,lab+': «مجموعات متبقية» = '+exp+' and the bar = '+r+'/45 groups passed ('+c.w.toFixed(2)+'%)'); }
  await setup(0,0); let c=await card();
  ok(c.h==='ما تبقى لفتح المسار التحصيني'&&c.lock&&!/مراجعات متبقية/.test(c.txt)&&!/≈/.test(c.txt)&&c.txt.includes('تقديري: خطة المجموعات لم تُعتمد نهائيًا.'),'card: title, lock icon, bar, ONE indicator; no «مراجعات متبقية», no ≈, the exact estimate note');
  // stopping and reopening keeps the count
  await setup(2,0); await ev(()=>A.startSession('3')); await p.waitForTimeout(150); await p.reload(); await p.waitForTimeout(250); await base(); c=await card(); ok(c.gl===45,'two sessions done, stop, reopen: still ٤٥');
  // 10th session completion message
  await setup(9,0); await ev(()=>A.startSession('10')); await p.waitForTimeout(150);
  for(let g=0;g<14;g++){const sc=await ev(()=>ui.screen); if(sc==='question'){const i=await ev(()=>RUN.cur.order.findIndex(o=>o===BANK.byId[RUN.cur.id].correct)); await act('answer',i); if(await ev(()=>ui.screen)==='question') await act('next');} else break;}
  let t=await ev(()=>document.querySelector('#view').innerText); ok(await ev(()=>ui.screen)==='complete'&&t.includes('أكملت جلسات هذه المجموعة، ويلزمك اجتياز مراجعتها الشاملة للانتقال إلى المجموعة التالية.')&&await ev(()=>!!document.querySelector('.btn.primary[data-arg="review"]')&&/ابدأ مراجعة المجموعة/.test(document.querySelector('.btn.primary[data-arg="review"]').textContent)),'after the 10th session: the required message and the «ابدأ مراجعة المجموعة» button');
  c=await card(); ok(c.gl===45,'10 sessions completed for real, review not taken: groups remaining ٤٥ (sessions alone do not pass a group)');
  ok(/مراجعة المجموعة الأولى/.test(await ev(()=>document.querySelector('.next').innerText))&&await ev(()=>document.querySelector('.next .btn').textContent.trim())==='ابدأ مراجعة المجموعة','home «خطوتك التالية» shows «مراجعة المجموعة الأولى» with the same button');
  // next group stays closed
  await ev(()=>A.startSession('11')); await p.waitForTimeout(120); ok(await ev(()=>ui.screen)!=='question','session 11 stays closed before the review is passed'); await ev(()=>closeSheet());
  // review: wrong answers are not a pass until corrected; save/resume
  await ev(()=>{go('home');A.startReview()}); await p.waitForTimeout(150);
  const ans=async(good)=>{const i=await ev(()=>{const x=RUN.cur,q=BANK.byId[x.id];return {ok:x.order.findIndex(o=>o===q.correct),bad:x.order.findIndex(o=>o!==q.correct)};}); await act('answer',good?i.ok:i.bad);};
  await ans(false); ok(await ev(()=>ui.screen)==='wrong'&&await ev(()=>Object.keys(S.reviews).length)===0,'a wrong answer in the review: not counted, the review is not passed'); await act('next'); const q0=await ev(()=>RUN.cur.id); await ans(true); if(await ev(()=>ui.screen)==='question') await act('next');
  await ev(()=>exitRun()); await p.reload(); await p.waitForTimeout(250); await base(); const left0=await ev(()=>calc().groupsLeft); ok(left0===45&&await ev(()=>Object.keys(S.reviews).filter(k=>S.reviews[k].done).length)===0,'leaving mid-review and reopening: nothing passed, ٤٥ remain');
  await ev(()=>go('review')); await p.waitForTimeout(100); ok(await ev(()=>!!document.querySelector('[data-act="resumeRun"],[data-act="startReview"]')),'the review can be started/resumed after reopening');
  await ev(()=>{A.startReview()}); await p.waitForTimeout(150);
  // finish the review properly
  for(let g=0;g<80;g++){const sc=await ev(()=>ui.screen); if(sc==='question'){await ans(true); if(await ev(()=>ui.screen)==='question') await act('next');} else if(sc==='wrong') await act('next'); else if(sc==='complete'){ if(await ev(()=>RUN.midStep)) await act('nextMini'); else break;} else break;}
  t=await ev(()=>document.querySelector('#view').innerText); ok(/اجتزت المراجعة العشرية/.test(t)&&/تهانينا/.test(t)&&/اجتزت المجموعة الأولى/.test(t)&&/المجموعة التالية قيد الإعداد/.test(t),'after passing: congratulations for passing group ١ (next group «قيد الإعداد» because group ٢ has no prepared content)');
  c=await card(); ok(c.gl===44&&Math.abs(c.w-100/45)<0.05,'review passed: ٤٤ remain, bar = 1/45');
  // group 2 sessions without review, then pass
  await setup(20,1); c=await card(); ok(c.gl===44,'group ٢ sessions done, no review: ٤٤'); await ev(()=>A.startSession('21')); await p.waitForTimeout(100); ok(await ev(()=>ui.screen)!=='question','group ٣ closed until group ٢ review is passed'); await ev(()=>closeSheet());
  // tahsini stays closed
  await setup(10,1); ok(await ev(()=>calc().unlockPct<100&&ui.unlocked===false),'tahsini stays closed while the tāṣīlī path is incomplete');
  // unified rule for the tahsini path (simulation, no content)
  const rule=await ev(()=>{const t=360,r=(d,p)=>groupRule({total:t,sessionsDone:d,passed:p});return {a:r(0,0),b:r(10,0),c:r(10,1),d:r(20,1),e:r(20,2),f:groupRule({total:355,sessionsDone:355,passed:35}),g:groupRule({total:355,sessionsDone:355,passed:36})};});
  ok(rule.a.remaining===36&&rule.b.remaining===36&&rule.b.due===true&&rule.c.remaining===35&&rule.c.due===false&&rule.d.remaining===35&&rule.d.due===true&&rule.e.remaining===34&&rule.b.openUpTo===10&&rule.c.openUpTo===20,'tahsini simulation (same rule): remaining only drops after a review pass; review due after 10 sessions; next group opens only after the pass');
  ok(rule.f.groups===36&&rule.f.due===true&&rule.f.remaining===1&&rule.g.remaining===0&&rule.g.due===false&&rule.g.pct===100,'last (partial) group follows the same rule; all passed → 0 remaining, bar 100%');
  const same=await ev(()=>{let bad=0;for(const [n,r] of [[0,0],[3,0],[10,0],[10,1],[20,1],[20,2],[25,2],[40,3]]){resetAll();seedDemo(n,r);const c=calc(),g=groupRule({total:PLAN.total,sessionsDone:c.sessionsDone,passed:c.reviewsDone});if(g.remaining!==c.groupsLeft||g.due!==c.due) bad++;}return bad;}); ok(same===0,'the unified rule agrees with the engine (remaining + review-due) in every sampled state');
  // other indicators untouched
  await setup(10,1); const ind=await ev(()=>{const a=calc();return {r:a.reviewsLeft,s:a.sessionsLeft,p:a.progress,m:a.mastery,u:a.unlockPct};}); ok(ind.r===44&&ind.s===438,'other indicators (reviewsLeft, sessionsLeft…) unchanged');
  ok(errs.length===0,'no page errors '+errs.join('|'));
  console.log(`\nPASS=${pass} FAIL=${fail}`); await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
