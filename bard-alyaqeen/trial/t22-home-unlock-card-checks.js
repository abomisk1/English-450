const {chromium}=require('playwright');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);} };
(async()=>{
  const b=await chromium.launch();
  for(const f of ['prototype','trial']) for(const [W,H] of [[320,568],[360,740]]){
    console.log('---',f,W,H);
    const ctx=await b.newContext({viewport:{width:W,height:H},hasTouch:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
    await p.goto(`file:///home/user/English-450/bard-alyaqeen/${f}.html`); await p.waitForTimeout(250);
    const ev=f=>p.evaluate(f);
    const setup=(n,r)=>p.evaluate(([n,r])=>{resetAll();S.seen.zad=true;S.gintro={1:true};if(typeof TS!=='undefined'){TS.consent=true;TS.code='P-QABF';TS.device='هاتف';TS.records=[{code:'P-QABF',seq:1,kind:'S',id:'1',sent:false}];tsave();}save();seedDemo(n,r);go('home')},[n,r]);
    await setup(0,0); await p.waitForTimeout(150);
    const card=()=>ev(()=>{document.querySelector('#view').scrollTo(0,99999);const c=document.querySelector('.unlockcard'),v=document.querySelector('#view'),t=document.querySelector('#tabs').getBoundingClientRect(),r=c.getBoundingClientRect(),cs=calc();const kv=[...c.querySelectorAll('.kv div')].map(d=>d.innerText.replace(/\n/g,' '));return {txt:c.innerText,kv,h3:c.querySelector('h3').textContent,lock:!!c.querySelector('.lockbadge svg'),meter:!!c.querySelector('.meter'),w:(c.querySelector('.meter i')||{style:{}}).style.width||'',last:document.querySelector('#view .screen').lastElementChild===c,aboveTabs:r.bottom<=t.top+1,order:[...document.querySelector('#view .screen').children].map(e=>e.className.split(' ')[0]).join(','),cs:{sl:cs.sessionsLeft,rl:cs.reviewsLeft,pct:cs.unlockPct},nextTop:document.querySelector('.next').getBoundingClientRect().top,cardTop:r.top}});
    let c=await card();
    ok(c.h3==='ما تبقى لفتح المسار التحصيني'&&c.lock&&c.meter,'card present: title, lock icon, progress bar');
    ok(c.kv.length===2&&/مجموعات متبقية/.test(c.kv[0])&&/مراجعات متبقية/.test(c.kv[1])&&!/الوقت المستثمر|أيام متتالية|دقيقة/.test(c.txt),'only the two indicators (groups / reviews remaining); no invested time, no consecutive days');
    ok(c.last&&c.aboveTabs&&c.cardTop>c.nextTop,'card is the last item on the home page, below «خطوتك التالية», above the bottom bar (no overlap)');
    ok(!/≈/.test(c.txt)&&/تقديري/.test(c.txt)&&/لم تُعتمد نهائيًا/.test(c.txt),'no ≈ sign; the «تقديري / لم تُعتمد نهائيًا» note stays');
    ok(c.kv[0].includes(await ev(()=>ar(Math.ceil(calc().sessionsLeft/GROUP))))&&c.kv[1].includes(await ev(()=>ar(calc().reviewsLeft))),'values come from the progress record: '+c.kv.join(' / '));
    // progress updates
    const w0=parseFloat(c.w)||0; await setup(3,0); c=await card(); const w1=parseFloat(c.w)||0; ok(c.cs.sl===445&&c.kv[0].includes('٤٥')&&w1>w0,'after 3 sessions (inside group 1): groups remaining stays ٤٥ (current group not complete), bar advances ('+w0.toFixed(2)+'→'+w1.toFixed(2)+'%)');
    await setup(10,1); c=await card(); ok(c.cs.rl===44&&c.kv[1].includes('٤٤')&&c.kv[0].includes('٤٤')&&c.cs.sl===438,'after 10 sessions + 1 review: groups remaining ٤٤, reviews ٤٤ (values follow the record)');
    await setup(12,1); c=await card(); ok(c.cs.sl===436&&c.kv[0].includes('٤٤'),'12 sessions (2 inside group 2): groups remaining ٤٤ — the partly finished group still counts');
    await setup(20,2); c=await card(); ok(c.cs.sl===428&&c.kv[0].includes('٤٣'),'20 sessions: groups remaining ٤٣');
    ok(await ev(()=>calc().unlockPct<100&&ui.unlocked===false),'tahsini stays closed (unlock % < 100)');
    await setup(0,0); await ev(()=>go('tahsini')); await p.waitForTimeout(150); ok(await ev(()=>ui.screen)==='tahsini'&&/مقفل|يُفتح|بعد|لم يُفتح/.test(await ev(()=>document.querySelector('#view').innerText)),'the tahsini path still shows its locked state');
    // no trial elements on home
    await setup(2,0); const hv=await ev(()=>document.querySelector('#view').innerText);
    ok(!/التجربة المغلقة|P-QABF|نتائج التجربة|رأيك في التجربة|تُسجَّل بياناتك/.test(hv)&&await ev(()=>!document.querySelector('#view [data-arg="trialres"],#view [data-arg="trialfb"]')),'no closed-trial element on the home page');
    if(f==='trial'){ ok(await ev(()=>TS.records.length===1&&TS.code==='P-QABF'),'participant records and code are kept (only hidden from the home page)'); await ev(()=>go('trialfb')); ok(await ev(()=>ui.screen)==='trialfb','feedback form still works'); await ev(()=>go('trialres')); ok(/P-QABF/.test(await ev(()=>document.querySelector('#view').innerText)),'results screen still reachable'); }
    // untouched: progress page values and next step
    await setup(2,0); const pv=await ev(()=>{const a=calc();go('progress');return [document.querySelector('#view').innerText.includes('نسبة إنجاز المسار'),a.sessionsDone]}); ok(pv[0]&&pv[1]===2,'progress page unchanged');
    await p.screenshot({path:`shots/m-${f}-${W}.png`});
    ok(errs.length===0,'no page errors '+errs.join('|')); await ctx.close();
  }
  console.log(`\nPASS=${pass} FAIL=${fail}`); await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
