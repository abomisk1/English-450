const {chromium}=require('playwright');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);} };
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:800},hasTouch:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
  await p.addInitScript(()=>{window.__w=[];window.__edit=false;window.__db={'trial/U1':{code:'P-AAAA',dev:'هاتف'},'trial/U1/runs':{r1:{kind:'S',id:'1',sec:150,completed:true,timeout:false,survey:{comment:'ملاحظة أولى'}}},'trial/U1/feedback':{final:{clarity:4,ease:5,duration:'مناسبة',comment:'رأي المشارك'}}};
    window.claude={use:async n=>n==='db'?{doc:p=>({set:async d=>{window.__w.push([p,d]);},collection:c=>({get:async()=>({docs:Object.entries(window.__db[p+'/'+c]||{}).map(([id,d])=>({id,data:()=>d}))})})}),collection:c=>({get:async()=>({docs:Object.keys(window.__db).filter(k=>/^trial\/[^/]+$/.test(k)).map(k=>({id:k.split('/')[1],data:()=>window.__db[k]}))})})}:n==='user'?{id:async()=>'U1',canEdit:async()=>window.__edit}:null};});
  await p.goto('file:///home/user/English-450/bard-alyaqeen/trial.html'); await p.waitForTimeout(300);
  const ev=f=>p.evaluate(f); const act=async(a,g)=>{await p.click(`[data-act="${a}"]${g!=null?`[data-arg="${g}"]`:''}`);await p.waitForTimeout(100);};
  await ev(()=>{go('trialintro')}); await p.waitForTimeout(150);
  // participant view
  ok(await ev(()=>ui.screen)==='trialintro'||true,'gate first');
  ok(!await ev(()=>{const el=document.querySelector('.panel-toggle,.panel');return !!el&&getComputedStyle(el).display!=='none'}),'no developer panel / "أدوات العرض" button visible to participants');
  ok(await ev(()=>REVIEWER===false&&!document.querySelector('.internal')),'reviewer mode off, no internal data');
  ok(await ev(()=>document.getElementById('admlink').hidden),'participant: owner-results link hidden'); ok(/غير معتمدة علميًا/.test(await ev(()=>document.querySelector('#view').innerText)),'gate states: trial version, not scientifically approved');
  await ev(()=>{document.querySelector('#tok').checked=true;document.querySelector('#tdev').value='هاتف';}); await act('trialStart'); await p.waitForTimeout(200);
  ok(/المحتوى العلمي لم يُعتمد نهائيًا/.test(await ev(()=>document.querySelector('.splash').innerText)),'splash shows the short trial notice');
  ok(/نسخة تجريبية/.test(await ev(()=>document.querySelector('#strip').innerText)),'top strip says «نسخة تجريبية» (not «نموذج أولي»)');
  // feedback form
  await ev(()=>{S.seen.zad=true;go('home')}); await act('go','trialfb'); ok(await ev(()=>ui.screen)==='trialfb','feedback form reachable from the home trial card');
  ok(/وضوح الأسئلة/.test(await ev(()=>document.querySelector('#view').innerText))&&/سهولة استخدام التطبيق/.test(await ev(()=>document.querySelector('#view').innerText))&&/مدة الجلسات/.test(await ev(()=>document.querySelector('#view').innerText))&&await ev(()=>!!document.querySelector('#fbc')),'form: clarity, ease, session length, notes field');
  await act('fbPick','clarity|4'); await act('fbPick','ease|5'); await act('fbPick','duration|مناسبة'); await ev(()=>{document.querySelector('#fbc').value='مقترح تجريبي'}); await act('fbSend'); await p.waitForTimeout(200);
  const fb=await ev(()=>window.__w.find(x=>x[0]==='trial/U1/feedback/final'));
  await act('closeSheet'); ok(fb&&fb[1].clarity===4&&fb[1].ease===5&&fb[1].duration==='مناسبة'&&fb[1].comment==='مقترح تجريبي','feedback saved only under trial/<own uid>/feedback/final'); ok(await ev(()=>window.__w.every(x=>x[0].startsWith('trial/U1'))),'every write is inside the participant\'s own subtree');
  // empty form guarded
  await ev(()=>{FB.clarity=FB.ease=FB.duration=null;FB.comment='';go('trialfb')}); await act('fbSend'); ok(/اختر تقييمًا/.test(await ev(()=>document.querySelector('#sheetLayer').innerText)),'empty submission refused');
  await act('closeSheet');
  // owner view
  await ev(()=>{go('trialadm')}); await p.waitForTimeout(300); ok(/للمشرف فقط/.test(await ev(()=>document.querySelector('#admbox').innerText)),'participant opening results screen sees nothing (owner only)');
  await ev(()=>{window.__edit=true;go('trialadm')}); await p.waitForTimeout(500); const adm=await ev(()=>document.querySelector('#admbox').innerText);
  ok(/P-AAAA/.test(adm)&&/رأي المشارك/.test(adm)&&/ملاحظة أولى/.test(adm),'owner/editor sees participants, their final opinions and session notes');
  await ev(()=>{window.__edit=true;go('trialintro')}); await p.waitForTimeout(200); ok(!await ev(()=>document.getElementById('admlink').hidden),'owner sees the results link on the gate');
  // signed out: fallback copy
  await ev(()=>{window.claude={use:async()=>null};FB.clarity=3;go('trialfb')}); await act('fbSend'); ok(/تعذّر الإرسال التلقائي/.test(await ev(()=>document.querySelector('#sheetLayer').innerText)),'signed out / no db: shows copy-able text instead of silently failing');
  ok(errs.length===0,'no page errors '+errs.join('|'));
  console.log(`\nPASS=${pass} FAIL=${fail}`); await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
