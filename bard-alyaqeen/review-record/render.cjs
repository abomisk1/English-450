// يحوّل record.html إلى PDF (مرورين لملء أرقام صفحات الفهرس). الاستعمال: NODE_PATH=$(npm root -g) node render.cjs out.pdf
const {chromium}=require('playwright'); const {execSync}=require('child_process'); const fs=require('fs'); const path=require('path');
const out=process.argv[2]||'record.pdf'; const here=__dirname;
async function pdf(p){const b=await chromium.launch(); const pg=await b.newPage(); await pg.goto('file://'+here+'/record.html'); await pg.evaluate(()=>document.fonts.ready); await pg.waitForTimeout(500);
  await pg.pdf({path:p,format:'A4',printBackground:true,displayHeaderFooter:true,margin:{top:'16mm',bottom:'18mm',left:'15mm',right:'15mm'},headerTemplate:'<span></span>',
   footerTemplate:'<div style="font-size:8px;width:100%;text-align:center;direction:rtl;color:#555;font-family:DejaVu Sans,sans-serif">بَرْد اليقين — سجل المراجعة العلمية · الإصدار 1.0 · صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></div>'});
  await b.close();}
(async()=>{
  execSync('python3 build_record.py',{cwd:here,stdio:'inherit'}); await pdf(out);
  const n=parseInt(execSync(`pdfinfo "${out}" | grep Pages | awk '{print $2}'`).toString());
  const pages={}; const keys=[...fs.readFileSync(here+'/record.html','utf8').matchAll(/class="mk">([^<]+)</g)].map(m=>m[1]);
  for(let i=1;i<=n;i++){const t=execSync(`pdftotext -f ${i} -l ${i} -layout "${out}" -`).toString(); for(const k of keys) if(!(k in pages)&&t.includes(k)&&i>4) pages[k]=i;}
  fs.writeFileSync(here+'/pages.json',JSON.stringify(pages));
  execSync('python3 build_record.py --pages pages.json'+(process.env.DECISIONS?' --decisions '+process.env.DECISIONS:''),{cwd:here,stdio:'inherit'}); await pdf(out);
  console.log('pages',n,'->',execSync(`pdfinfo "${out}" | grep Pages`).toString().trim());
})();
