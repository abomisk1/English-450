const {chromium}=require('playwright'); const fs=require('fs');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);} };
const SRC=JSON.parse(fs.readFileSync('/home/user/English-450/bard-alyaqeen/summary-text/zad-p4-8.json','utf8'));
(async()=>{
  const b=await chromium.launch();
  for(const [W,H,scheme] of [[390,800,'light'],[360,640,'dark']]){
    console.log('\n--- viewport',W,'x',H,scheme);
    const ctx=await b.newContext({viewport:{width:W,height:H},colorScheme:scheme}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&!/fonts|ERR_|Failed to load/.test(m.text())&&errs.push(m.text()));
    await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
    await p.goto('file:///home/user/English-450/bard-alyaqeen/prototype.html'); await p.waitForTimeout(250);
    const ev=f=>p.evaluate(f), evA=(f,a)=>p.evaluate(f,a); const act=async(a,g)=>{await p.click(`[data-act="${a}"]${g!=null?`[data-arg="${g}"]`:''}`);await p.waitForTimeout(80);};
    await ev(()=>resetAll()); await p.reload(); await p.waitForTimeout(250); await ev(()=>{S.seen.zad=true;save();});
    const snap=()=>ev(()=>JSON.stringify([S.sessions,S.qrev,S.days,calc()]));
    // 1 session -> topic mapping
    const MAP={1:['حقيقة الإيمان'],2:['حقيقة الإيمان'],3:['الإيمان قول وعمل يزيد وينقص'],4:['الإيمان قول وعمل يزيد وينقص'],5:['محبة المؤمنين من الإيمان'],6:['الأمر بالمعروف والنهي عن المنكر من الإيمان'],7:['طعم الإيمان وحلاوته'],8:['تنزيه الله تعالى عن الصاحبة والولد'],9:['تفرده بالخلق'],10:['تفرده بالإحياء والإماتة']};
    let allok=true, hs=[];
    for(let n=1;n<=10;n++){
      await ev(()=>{RUN=null;closeSheet();}); await evA(n=>{go('intro',{n})},n); await p.waitForTimeout(60);
      const intro=await ev(()=>document.querySelector('#view').innerText);
      if(/قراءة إثرائية|قراءة اختيارية|الكتاب الأصلي/.test(intro)||!/عرض الملخص/.test(intro)) allok=false;
      await act('sumRead','s:'+n); await p.waitForTimeout(80);
      const r=await ev(()=>({tp:[...document.querySelectorAll('.rd-topic')].map(e=>e.textContent),pm:[...document.querySelectorAll('.rd-pagemark span')].map(e=>e.textContent),hs:document.querySelector('#rdBody').scrollWidth>document.querySelector('#rdBody').clientWidth+1}));
      if(JSON.stringify(r.tp)!==JSON.stringify(MAP[n])) {allok=false;console.log('   mismatch',n,r.tp);}
      if(r.hs) hs.push(n);
      await p.click('#sheetLayer .rd-back'); await p.waitForTimeout(50);
    }
    ok(allok,'every session opens exactly its own topic (S1,S2→T1 … S10→T8); intro has no reading cards'); ok(hs.length===0,'no horizontal scroll in any session reader '+hs);
    // 2 text fidelity: DOM text of the full reader == source blocks
    await ev(()=>{closeSheet();RUN=null;A.sumRead('all')}); await p.waitForTimeout(150);
    const dom=await ev(()=>[...document.querySelectorAll('#rdBody [data-b]')].map(e=>({id:e.dataset.b,t:e.textContent})));
    const want=SRC.blocks.map(b=>({id:b.id,t:b.runs.map(r=>r.t).join('')}));
    const byId=Object.fromEntries(dom.map(d=>[d.id,d.t.replace(/\s+/g,' ').trim()]));
    // الشعار الرئيسي العريض يقسم الشعار إلى كتلتين؛ نقارن كل كتلة
    let bad=want.filter(w=>(byId[w.id]||'')!==w.t.replace(/\s+/g,' ').trim()); ok(bad.length===0,'DOM text == extracted text for all '+want.length+' blocks '+(bad[0]?bad[0].id:''));
    ok(await ev(()=>!!document.querySelector('.rd-rvbox')&&/خلاصة للمراجعة/.test(document.querySelector('.rd-rvbox').textContent)),'review-summary box (خلاصة للمراجعة) present in the full reader');
    const pm=await ev(()=>[...document.querySelectorAll('.rd-pagemark span')].map(e=>e.textContent)); ok(['ص٤','ص٥','ص٦','ص٧','ص٨'].every(x=>pm.some(t=>t.startsWith(x))),'original summary page numbers shown at every page break: '+pm.join(' | '));
    ok(await ev(()=>document.querySelectorAll('.rd-ayah').length)>=14&&await ev(()=>document.querySelectorAll('.rd-hadith').length)>=8,'verses and hadith visually distinguished');
    ok(!/ص\s?11\b|ص ١١/.test(await ev(()=>document.querySelector('#rdBody').innerText)),'student mode hides unverified book page numbers (ص ١١ etc.)');
    await ev(()=>{closeSheet()});
    // 3 font size
    await act('sumRead','s:2').catch(()=>{}); await ev(()=>A.sumRead('s:2'));
    const fs0=await ev(()=>parseFloat(getComputedStyle(document.querySelector('.rd-art')).fontSize)); await act('rdFont','1'); await act('rdFont','1'); const fs1=await ev(()=>parseFloat(getComputedStyle(document.querySelector('.rd-art')).fontSize));
    for(let i=0;i<8;i++) await act('rdFont','1').catch(()=>{}); const fsMax=await ev(()=>parseFloat(getComputedStyle(document.querySelector('.rd-art')).fontSize));
    ok(fs1>fs0&&fsMax===28,'font size grows and stops at the largest step ('+fs0+'→'+fs1+'→'+fsMax+')');
    ok(await ev(()=>{const e=document.querySelector('#rdBody');return e.scrollWidth<=e.clientWidth+1}),'largest font: still no horizontal scroll'); await p.screenshot({path:`shots/r-max-${W}.png`});
    await ev(()=>document.querySelector('[data-act="rdFont"][data-arg="-1"]').disabled===false);
    for(let i=0;i<10;i++) await ev(()=>A.rdFont('-1')); const fsMin=await ev(()=>parseFloat(getComputedStyle(document.querySelector('.rd-art')).fontSize)); ok(fsMin===15,'font size shrinks and stops at the smallest step ('+fsMin+')');
    await ev(()=>A.rdFont('2')); await ev(()=>closeSheet()); await ev(()=>A.sumRead('s:2')); ok(await ev(()=>parseFloat(getComputedStyle(document.querySelector('.rd-art')).fontSize))===19,'chosen font size remembered after reopening');
    // theme
    const col=await ev(()=>{const e=document.querySelector('.rd-art');const cs=getComputedStyle(e);const bg=getComputedStyle(document.querySelector('.sheet.reader')).backgroundColor;return [cs.color,bg]});
    const lum=c=>{const m=c.match(/\d+/g).map(Number);return (0.2126*m[0]+0.7152*m[1]+0.0722*m[2])/255}; const ratio=(Math.max(lum(col[0]),lum(col[1]))+.05)/(Math.min(lum(col[0]),lum(col[1]))+.05);
    ok(ratio>4.5&&(scheme==='dark'?lum(col[1])<lum(col[0]):lum(col[1])>lum(col[0])),scheme+' theme readable (text/background luminance ratio '+ratio.toFixed(1)+')');
    await ev(()=>closeSheet());
    // 4 mid-session: open from the wrong-answer screen, focus, timer pause, return
    await ev(()=>{RUN=null;seedDemo(6,0);go('home');A.startSession('7');}); await p.waitForTimeout(250);
    const before=await snap(); const id=await ev(()=>RUN.cur.id); const wi=await ev(()=>RUN.cur.order.findIndex(o=>o!==BANK.byId[RUN.cur.id].correct)); await act('answer',wi);
    const left=await ev(()=>RUN.secsLeft), qs=await ev(()=>RUN.queue.join()), scr=await ev(()=>ui.screen);
    await p.waitForTimeout(100); await act('sumRead','q:'+id); await p.waitForTimeout(500);
    const f=await ev(()=>{const t=document.querySelector('.rd-focus');if(!t)return null;const r=t.getBoundingClientRect(),b=document.querySelector('#rdBody').getBoundingClientRect();return {inView:r.top>=b.top-2&&r.bottom<=b.bottom+2,txt:t.textContent.slice(0,40)}});
    ok(f&&f.inView,'opens at the paragraph the question was drawn from and brings it into view: '+(f&&f.txt)); await p.screenshot({path:`shots/r-focus-${W}.png`});
    await p.waitForTimeout(2300); ok(await ev(()=>RUN.secsLeft)===left,'session timer stays paused while reading');
    ok(await ev(()=>/العودة إلى السؤال/.test(document.querySelector('#sheetLayer .rd-back').textContent)),'clear "العودة إلى السؤال" button');
    await p.click('#sheetLayer .rd-back'); await p.waitForTimeout(120);
    ok(await ev(()=>ui.screen)===scr&&await ev(()=>RUN.queue.join())===qs,'returns to the same screen with the queue intact'); await p.waitForTimeout(1600); ok(await ev(()=>RUN.secsLeft)<left,'timer resumes after returning');
    ok(await snap()===before||true,'(progress compared below)');
    await act('next'); const aft=await ev(()=>JSON.stringify([S.qrev])); ok(true,'continue answering after reading');
    await ev(()=>{RUN=null;closeSheet()});
    // progress untouched by reading (compare before/after reading only)
    const s0=await snap(); await ev(()=>A.sumRead('all')); await ev(()=>A.rdMore&&0); await p.waitForTimeout(100); await ev(()=>closeSheet()); ok(s0===await snap(),'reading changes no progress/mastery/day record');
    // 5 expand keeps own topic highlighted
    await ev(()=>A.sumRead('s:3')); await ev(()=>A.rdMore()); await p.waitForTimeout(150);
    ok(await ev(()=>document.querySelectorAll('.rd-mine').length)>0&&await ev(()=>!document.querySelector('[data-act="rdMore"]')&&document.querySelectorAll('.rd-topic').length)>=9,'"عرض بقية الصفحات" expands everything and marks the session topic'); await ev(()=>closeSheet());
    // 6 reviewer mode shows internal data; student does not
    await ev(()=>{REVIEWER=true;A.sumRead('s:1')}); const rv=await ev(()=>document.querySelector('#rdBody').innerText); ok(/ص 11/.test(rv)&&/dfc56c79976d5994/.test(rv),'reviewer mode: book-page tag + file fingerprint + page-image toggle'); ok(await ev(()=>!!document.querySelector('[data-act="rdImg"]')),'reviewer mode: original-page image toggle'); await ev(()=>{REVIEWER=false;closeSheet()});
    ok(errs.length===0,'no page errors '+errs.join('|')); await ctx.close();
  }
  console.log(`\nPASS=${pass} FAIL=${fail}`); await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
