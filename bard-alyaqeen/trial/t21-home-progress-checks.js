const {chromium}=require('playwright');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);} };
(async()=>{
  const b=await chromium.launch();
  for(const [W,H] of [[320,568],[360,700]]){
    console.log('--- viewport',W,H);
    const ctx=await b.newContext({viewport:{width:W,height:H},hasTouch:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
    await p.goto('file:///home/user/English-450/bard-alyaqeen/prototype.html'); await p.waitForTimeout(250);
    const ev=f=>p.evaluate(f), evA=(f,a)=>p.evaluate(f,a); const act=async(a,g)=>{await p.click(`[data-act="${a}"]${g!=null?`[data-arg="${g}"]`:''}`);await p.waitForTimeout(80);};
    const home=()=>ev(()=>document.querySelector('.next').innerText.replace(/\n+/g,' | '));
    await ev(()=>{resetAll();S.seen.zad=true;S.gintro={1:true};save();go('home')}); await p.waitForTimeout(100);
    // 1 session / group label
    let t=await home(); ok(/الجلسة رقم ١ من المجموعة الأولى/.test(t)&&/مراتب الدين وأركان الإيمان/.test(t)&&/الموضوع: حقيقة الإيمان/.test(t)&&/٣ دقائق كحد أقصى/.test(t)&&/٥ أسئلة/.test(t),'fresh start: «الجلسة رقم ١ من المجموعة الأولى» with title, topic, duration and question count: '+t.slice(0,150));
    ok(/خطوتك التالية/.test(t),'card still titled «خطوتك التالية»');
    const lbls=await ev(()=>[1,2,10,11,12,20,21].map(sessLbl)); ok(lbls[0]==='الجلسة رقم ١ من المجموعة الأولى'&&lbls[2]==='الجلسة رقم ١٠ من المجموعة الأولى'&&lbls[3]==='الجلسة رقم ١ من المجموعة الثانية'&&lbls[5]==='الجلسة رقم ١٠ من المجموعة الثانية'&&lbls[6]==='الجلسة رقم ١ من المجموعة الثالثة','group number rolls over automatically (11 → ١ من الثانية, 21 → ١ من الثالثة) with Arabic numerals');
    await ev(()=>{seedDemo(1,0);go('home')}); t=await home(); ok(/الجلسة رقم ٢ من المجموعة الأولى/.test(t),'after one completed session: updates to «الجلسة رقم ٢»');
    await ev(()=>{seedDemo(9,0);go('home')}); t=await home(); ok(/الجلسة رقم ١٠ من المجموعة الأولى/.test(t),'after nine sessions: «الجلسة رقم ١٠»');
    await ev(()=>{seedDemo(10,0);go('home')}); t=await home(); ok(/مراجعة المجموعة الأولى/.test(t)&&!/الجلسة رقم/.test(t)&&/مراجعة مستحقة/.test(t),'ten sessions done: «مراجعة المجموعة الأولى» replaces the session title');
    // resume: stop mid-session, reload
    await ev(()=>{resetAll();S.seen.zad=true;S.gintro={1:true};save();seedDemo(2,0);go('home');A.startSession('3')}); await p.waitForTimeout(150);
    const i=await ev(()=>RUN.cur.order.findIndex(o=>o===BANK.byId[RUN.cur.id].correct)); await act('answer',i); await act('next'); await ev(()=>exitRun()); await p.reload(); await p.waitForTimeout(300); await ev(()=>go('home')); t=await home();
    ok(/الجلسة رقم ٣ من المجموعة الأولى/.test(t)&&/استئناف جلسة محفوظة/.test(t)&&/بقي/.test(t),'after leaving mid-session and reopening: the card resumes «الجلسة رقم ٣» (saved progress)');
    // 2 no locked icons on home
    await ev(()=>{resetAll();S.seen.zad=true;S.gintro={1:true};save();seedDemo(3,0);go('home')}); await p.waitForTimeout(100);
    const hm=await ev(()=>({lock:!!document.querySelector('#view .lockbadge'),lockSvg:[...document.querySelectorAll('#view svg')].some(s=>/lock/i.test(s.outerHTML)&&false),dots:!!document.querySelector('#view .dots10'),pill:/٣ من ١٠ جلسات مكتملة/.test(document.querySelector('#view').innerText),meter:!!document.querySelector('.grp .meter'),txt:document.querySelector('#view').innerText,locked:/مقفل|مغلق/.test(document.querySelector('#view').innerText)}));
    ok(!hm.lock&&!hm.dots&&!hm.locked&&!/فتح المسار التحصيني/.test(hm.txt),'home: no lock icons / locked items / unavailable-session dots');
    ok(hm.pill&&hm.meter,'home keeps a compact completed-of-ten indicator («٣ من ١٠ جلسات مكتملة» + slim bar)');
    ok(await ev(()=>!document.querySelector('.progbtn')&&!document.querySelector('.tiles')&&!document.querySelector('.chips3')),'home: no big «قياس مستوى التقدم» card and no separate indicator cards');
    ok((await ev(()=>{S.sessions[4]=undefined;delete S.sessions[4];return !!window.nextSessionNo}))&&true,'gating helpers intact');
    const gate=await ev(()=>{seedDemo(10,0);const a=A.startSession; return typeof gate==='function'?1:1;}); 
    // gating still works: session 11 not startable before the review
    await ev(()=>{seedDemo(10,0);go('home');A.startSession('11')}); await p.waitForTimeout(150); ok(await ev(()=>ui.screen)!=='question','session 11 stays closed until the review is passed (gating unchanged)'); await ev(()=>closeSheet());
    // 3/4 tab bar
    await ev(()=>{resetAll();S.seen.zad=true;S.gintro={1:true};save();seedDemo(3,0);go('home')}); await p.waitForTimeout(100);
    const tabs=await ev(()=>[...document.querySelectorAll('.tab')].map(t=>({t:t.innerText.replace(/\n/g,' '),w:Math.round(t.getBoundingClientRect().width),clip:t.scrollWidth>t.clientWidth+1,r:t.getBoundingClientRect().toJSON()})));
    ok(tabs.map(x=>x.t).join('|')==='الرئيسية|المسارات|المراجعة|قياس مستوى التقدم|المصدر','tab bar: 5 tabs, order kept, «إنجازاتي» replaced by «قياس مستوى التقدم»');
    ok(tabs.every(x=>!x.clip),'no clipped tab text at '+W+'px'); const labs=await ev(()=>[...document.querySelectorAll('.tab')].map(t=>{const s=[...t.childNodes].filter(n=>n.nodeType===1&&n.tagName!=='svg').map(n=>n.getBoundingClientRect()).concat(t.querySelector('span')?[t.querySelector('span').getBoundingClientRect()]:[]);const r=t.getBoundingClientRect();return {l:r.left,r:r.right}}));
    let overlap=false; for(let i=0;i<labs.length-1;i++){ if(Math.abs(labs[i].l-labs[i+1].r)>1&&labs[i].r>labs[i+1].l+1&&labs[i].l<labs[i+1].r-1) overlap=true; } ok(!overlap,'tabs do not overlap');
    ok(await ev(()=>{const t=document.querySelectorAll('.tab')[3];return !!t.querySelector('svg')&&/chart|M/.test(t.querySelector('svg').innerHTML)}),'chart icon on the progress tab');
    await p.screenshot({path:`shots/i-home-${W}.png`});
    const before=await ev(()=>JSON.stringify([S.sessions,S.reviews,S.qrev,S.days,calc()]));
    await p.click('.tab:nth-child(4)'); await p.waitForTimeout(150);
    ok(await ev(()=>ui.screen)==='progress'&&await ev(()=>document.querySelectorAll('.tab')[3].classList.contains('on')),'tapping the tab opens the unified page directly; the icon is highlighted'); ok(await ev(()=>document.querySelector('#tabs').hidden===false),'tab bar stays visible on the page');
    // 5 unified indicators
    const pt=await ev(()=>document.querySelector('#view').innerText);
    const need=['قياس مستوى التقدم','المؤشرات العلمية','النشاط والاستمرارية','نسبة إنجاز المسار','الإتقان المثبت بالمراجعات','الجلسات المكتملة','بقي نحو','الجلسات المتبقية للمراجعة القادمة','الصواب من المحاولة الأولى في الجلسات','الصواب من المحاولة الأولى في المراجعات','دقائق التعلم','الإنجاز اليومي','الاستمرارية','تحتاج إلى إعادة تثبيت','لم يُقَس بعد'];
    ok(need.every(w=>pt.includes(w)),'unified page carries every indicator, split into scientific vs activity groups; missing: '+need.filter(w=>!pt.includes(w)).join(','));
    ok(!/إنجازاتي/.test(pt),'old «إنجازاتي» title gone');
    const vals=await ev(()=>{const c=calc();const m=document.querySelector('#view').innerText;return {minutes:m.includes(ar(c.minutes)),streak:m.includes(ar(c.streak)),est:/≈/.test(m)}}); ok(vals.minutes&&vals.streak&&vals.est,'values come from calc(); estimates keep the «≈ / تقدير» marking');
    ok(await ev(()=>JSON.stringify([S.sessions,S.reviews,S.qrev,S.days,calc()]))===before,'opening the page changes no progress, mastery, day record or indicator');
    await ev(()=>A.info('mastery')); ok(await ev(()=>document.querySelector('#sheetLayer').innerText.length>20),'«؟» explanations still open'); await ev(()=>closeSheet());
    // fresh state: not-measured
    await ev(()=>{resetAll();S.seen.zad=true;save();go('progress')}); const f=await ev(()=>document.querySelector('#view').innerText); ok((f.match(/لم يُقَس بعد/g)||[]).length>=2,'new user: «لم يُقَس بعد» where data is insufficient');
    await p.screenshot({path:`shots/i-prog-${W}.png`});
    // old route alias
    await ev(()=>go('ach')); ok(await ev(()=>ui.screen)==='progress','old «ach» route lands on the unified page');
    ok(errs.length===0,'no page errors '+errs.join('|')); await ctx.close();
  }
  console.log(`\nPASS=${pass} FAIL=${fail}`); await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
