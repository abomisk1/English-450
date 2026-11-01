"""يبني «بَرْد اليقين — سجل المراجعة العلمية للأسئلة والإجابات» من بنك الأسئلة الفعلي.
المخرجات: record.json (بيانات)، record.html (مصدر الـPDF)، record.xlsx (نسخة قابلة للتحرير).
الاستعمال: python3 build_record.py [--decisions edited.xlsx] [--pages pages.json]
 --decisions  يقرأ أعمدة (حالة المراجعة، قرار المشرف، الملاحظات) من نسخة xlsx محررة ويدرجها في PDF عند إعادة الإصدار.
 --pages      ملف نتيجة تعيين صفحات الـPDF لبناء الفهرس (تُنتجه render.js في المرور الأول).
لا يضيف أي سؤال: يقرأ ما في data/question-bank.json فقط."""
import json,re,sys,html,hashlib,datetime,unicodedata,os
HERE=os.path.dirname(os.path.abspath(__file__)); R=os.path.join(HERE,'..')
args=sys.argv[1:]; opt=lambda k:(args[args.index(k)+1] if k in args else None)
B=json.load(open(R+'/data/question-bank.json',encoding='utf8'))
RD=json.load(open(R+'/summary-text/zad-p4-8.json',encoding='utf8'))
W='/tmp/claude-0/-home-user-English-450/1a74657e-a863-5bc3-a106-7ab19c9c0c28/scratchpad/w/'
Z=json.load(open(W+'zad_struct.json',encoding='utf8')); M=json.load(open(W+'maraqi_struct.json',encoding='utf8'))
MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
VERSION='1.0'; ISSUE=os.environ.get('RECORD_DATE') or datetime.date.today().isoformat()
AD='٠١٢٣٤٥٦٧٨٩'; ar=lambda n:str(n).translate(str.maketrans('0123456789',AD)); e=html.escape
STATUS=['معتمد','يحتاج تعديلًا','يحتاج تحققًا']
# ---------- ترتيب الخيارات: خلط ثابت بمعرّف السؤال (لا يكشف الصحيحة بموضعها)
def hashStr(s):
    h=2166136261
    for ch in s: h^=ord(ch); h=(h*16777619)&0xFFFFFFFF
    return h
def rng(seed):
    st=[seed&0xFFFFFFFF]
    def f():
        st[0]=(st[0]+0x6D2B79F5)&0xFFFFFFFF; t=st[0]
        t=((t^(t>>15))*(1|t))&0xFFFFFFFF; t=(t+(((t^(t>>7))*(61|t))&0xFFFFFFFF))&0xFFFFFFFF^t
        return (((t^(t>>14))&0xFFFFFFFF))/4294967296
    return f
def shuffle(n,seed):
    r=rng(seed); a=list(range(n))
    for i in range(n-1,0,-1):
        j=int(r()*(i+1)); a[i],a[j]=a[j],a[i]
    return a
def sk(s):
    s=unicodedata.normalize('NFC',s); return ''.join(c for c in s if unicodedata.category(c) in('Lo','Nd') and c!='ـ')
blk=[(b['id'],b['page'],b.get('topic'),sk(''.join(r['t'] for r in b['runs']))) for b in RD['blocks']]
topic_title={t['id']:t['title'] for t in RD['topics']}
def locate(text):
    f=sk(text)[:26]
    if len(f)<10: return []
    return [(i,p,t) for i,p,t,s in blk if f in s]
PART={**{n:'الإيمان' for n in range(1,8)},**{n:'الإيمان بربوبية الله وحده (توحيد الربوبية)' for n in range(8,11)}}
rv={}
for o in B['reviewBlueprint']['objectives']:
    for qid in o['questions']: rv.setdefault(qid,[]).append(dict(obj=o['id'],title=o['title'],primary=(qid==o['primary'])))
OPEN={ # مسائل علمية مفتوحة صرّح بها في التقارير السابقة، لا قرارات
 's1q3':'لفظ حديث جبريل في الملخص («وكتبه» وترتيب الأركان) لا يطابق لفظ البخاري ٥٠ ولا مسلم ٩٩؛ المسألة معلّقة لقرار المشرف.',
 's2q1':'صار السؤال عن «ما لم يُحرَّف من الكتب السابقة»، وبقي كون القرآن حاكمًا عليها في الشرح؛ هل يلزم سؤال مستقل؟',
 's8q1':'الخياران الآخران موضوعان آخران من الملخص لا صلة لهما بالآية؛ هل يُقبل أسهل؟',
 's8m1':'أحد الخيارين نصٌّ من الحديث القدسي ذاته (تفسير التكذيب)؛ هل يُقبل خيارًا؟',
 's8q5':'يقتبس قول «الملائكة بنات الله» لزومًا؛ هل يُبدَّل بصياغة أخف؟'}
dec={}
if opt('--decisions'):
    import openpyxl
    wb=openpyxl.load_workbook(opt('--decisions')); ws=wb['الأسئلة']; hd=[c.value for c in ws[1]]
    ix={h:i for i,h in enumerate(hd)}
    for row in ws.iter_rows(min_row=2,values_only=True):
        if row[ix['المعرّف']]: dec[row[ix['المعرّف']]]=dict(status=row[ix['حالة المراجعة العلمية']],decision=row[ix['قرار المشرف العلمي']] or '',note=row[ix['ملاحظات المشرف']] or '')
Q=[]; seq=0
for s in B['sessions']:
    for qi,q in enumerate(s['questions'],1):
        if q.get('status')!='valid': continue
        seq+=1
        parts=q.get('quoteParts') or [q['quote']]
        loc=[]; 
        for pt in parts: loc+=locate(pt)
        for n in q.get('nass',[]): loc+=locate(re.sub('[«»﴿﴾]','',n['t']))
        seen=[];[seen.append(x) for x in loc if x not in seen]
        pages=sorted({p for _,p,_ in seen}); topics=[]; [topics.append(t) for _,_,t in seen if t not in topics]
        spages=q['src'].get('pages') or [q['src']['sp']]
        order=shuffle(len(q['options']),hashStr(q['id']))
        flags=[]
        if any(n['k']=='آية' for n in q.get('nass',[])): flags.append('الآية بالرسم الإملائي من بيانات مجمع الملك فهد بلا تشكيل؛ تشكيلها في ملف PDF الأصلي معلّق للمراجعة.')
        if any(n['k']=='حديث' for n in q.get('nass',[])): flags.append('نص الحديث وعزوه: تحقق مبدئي بمجموعات حديثية مفتوحة (انظر ملاحظة التحقق)؛ يلزم اعتماد المشرف.')
        if len(q['options'])==2: flags.append('سؤال بخيارين (تعذّر ثالث لائق شرعًا وتربويًا).')
        if q['id'] in OPEN: flags.append(OPEN[q['id']])
        d=dec.get(q['id'],{})
        Q.append(dict(seq=seq,id=q['id'],program='البرنامج التأصيلي — ملخص زاد العباد',section='العقائد',part=PART[s['n']],topic=s['title'] if False else None,
            unit=next(x for x in [None]) if False else None,group=1,session=s['n'],session_title=s['title'],unit_title=None,qno=qi,qtotal=sum(1 for x in s['questions'] if x.get('status')=='valid'),
            text=q['text'],nass=[dict(label=n.get('label') or n['k'],kind=n['k'],cite=n['c'],text=n['t'],verify=n.get('verify','')) for n in q.get('nass',[])],
            options=[dict(letter='أبج'[i],text=q['options'][k],correct=(k==q['correct'])) for i,k in enumerate(order)],correct_text=q['options'][q['correct']],
            explanation=parts,summary_pages=spages,located_pages=pages,located_blocks=[i for i,_,_ in seen],located_topics=[topic_title.get(t,'خلاصة للمراجعة' if t=='R1' else t) for t in topics],
            locus=q['src']['locus'],pages_consistent=(set(spages)>=set(pages) if pages else None),
            book_page='قيد التحقق',summary_version=q['src']['version'],bloom=q.get('bloom'),objective=q.get('objective'),review_use=rv.get(q['id'],[]),
            merged_from=q.get('mergedFrom'),flags=flags,status=(d.get('status') or 'يحتاج تحققًا'),decision=d.get('decision',''),note=d.get('note','')))
# عنوان الموضوع من بنك الأسئلة (حقل unit)
unit={s['n']:s['unit'] for s in B['sessions']}
for r in Q: r['unit_title']=unit[r['session']]
bank_ids=[q['id'] for s in B['sessions'] for q in s['questions'] if q.get('status')=='valid']
assert [r['id'] for r in Q]==bank_ids and len(Q)==42
sha=B['summaryVersions']['zad-sum-1']['sha256']
tah=dict(name='ملخص «مراقي الوعي»',sha256='b00c5d85dfd78093d271e4a9978a33811b134aa49ef73ac2bcfe4afdc2121ac8',pages=151,chapters=len(M['chapters']))
slots=[dict(obj=o['id'],title=o['title'],primary=o['primary'],others=[x for x in o['questions'] if x!=o['primary']]) for o in B['reviewBlueprint']['objectives']]
rec=dict(title='بَرْد اليقين — سجل المراجعة العلمية للأسئلة والإجابات',version=VERSION,issued=ISSUE,bank_version=B.get('bankVersion'),summary_version='zad-sum-1',summary_sha256=sha,
         questions=Q,review_slots=slots,tahsini=tah,zad_plan=[dict(id=s['id'],name=s['name'],pages=s['bookPages'],topics=sum(len(g['topics']) for g in s['groups']),sessions=sum(t['planned'] for g in s['groups'] for t in g['topics'])) for s in Z])
json.dump(rec,open(HERE+'/record.json','w',encoding='utf8'),ensure_ascii=False,indent=1)
pg=json.load(open(opt('--pages'))) if opt('--pages') else {}
P=lambda k:(ar(pg[k]) if k in pg else '…')
# ---------- HTML
CSS=open(HERE+'/record.css',encoding='utf8').read()
def cnt(f): return sum(1 for r in Q if f(r))
st_counts={s:cnt(lambda r,s=s:r['status']==s) for s in STATUS}
H=[]
H.append(f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>{e(rec["title"])}</title><style>{CSS}</style></head><body>
<section class="cover"><div class="seal">﷽</div><h1>بَرْد اليقين</h1><h2>سجل المراجعة العلمية للأسئلة والإجابات</h2>
<p class="sub">مرجع للمشرف العلمي لاعتماد المحتوى · البرنامجان: التأصيلي (ملخص زاد العباد) والتحصيني (ملخص مراقي الوعي)</p>
<table class="meta"><tr><th>الإصدار</th><td>{ar(VERSION)} (مسودة للمراجعة العلمية)</td></tr><tr><th>تاريخ الإصدار</th><td>{ar(int(ISSUE[8:]))} {MONTHS[int(ISSUE[5:7])-1]} {ar(ISSUE[:4])} م</td></tr><tr><th>إصدار بنك الأسئلة</th><td>{ar(B.get("bankVersion"))}</td></tr>
<tr><th>إصدار ملخص زاد العباد</th><td>zad-sum-1 · {ar(B["summaryVersions"]["zad-sum-1"]["pages"])} صفحة<br><span class="hash">SHA-256 {sha}</span></td></tr>
<tr><th>إصدار ملخص مراقي الوعي</th><td>maraqi-sum-1 · {ar(tah["pages"])} صفحة<br><span class="hash">SHA-256 {tah["sha256"]}</span></td></tr></table>
<p class="warn">لا يُعدّ أي سؤال في هذا السجل معتمدًا علميًا قبل قرار المشرف المخوَّل. ولا تُذكر صفحة الكتاب الأصلي إلا بعد التحقق منها، وإلا فهي «قيد التحقق».</p></section>''')
# ملخص
by_sess=''.join(f'<tr><td class="c">{ar(n)}</td><td>{e(unit[n])}</td><td class="c">{ar(cnt(lambda r,n=n:r["session"]==n))}</td><td class="c">{ar(cnt(lambda r,n=n:r["session"]==n and any(x["kind"]=="آية" for x in r["nass"])))}</td><td class="c">{ar(cnt(lambda r,n=n:r["session"]==n and any(x["kind"]=="حديث" for x in r["nass"])))}</td><td class="c">{ar(cnt(lambda r,n=n:r["session"]==n and len(r["options"])==2))}</td></tr>' for n in range(1,11))
bl={}; [bl.__setitem__(r['bloom'],bl.get(r['bloom'],0)+1) for r in Q]
H.append(f'''<section class="pg"><h1 class="h1">١. ملخص الأعداد وحالات المراجعة</h1>
<table class="grid"><thead><tr><th>البند</th><th>العدد</th></tr></thead><tbody>
<tr><td>الأسئلة التعليمية المُعدّة (الجلسات ١–١٠ من البرنامج التأصيلي)</td><td class="c">{ar(len(Q))}</td></tr>
<tr><td>مواضع المراجعة العشرية (٢٠ موضعًا، سؤال لكل هدف علمي، تُنتقى من الأسئلة الاثنين والأربعين نفسها فلا أسئلة إضافية)</td><td class="c">{ar(len(slots))}</td></tr>
<tr><td>مجموع ما يُراجَع في الملف: {ar(len(Q))} سؤالًا + {ar(len(slots))} موضعًا = {ar(len(Q)+len(slots))} بندًا</td><td class="c">{ar(len(Q)+len(slots))}</td></tr>
<tr><td>أسئلة البرنامج التحصيني (مراقي الوعي)</td><td class="c">لم تُعدّ بعد (٠)</td></tr>
<tr><td>أسئلة جلسات زاد العباد من ١١ إلى ٤٤٨</td><td class="c">لم تُعدّ بعد (٠)</td></tr></tbody></table>
<h3>حالة المراجعة العلمية</h3><table class="grid"><tbody>{"".join(f'<tr><td>{s}</td><td class="c">{ar(st_counts[s])}</td></tr>' for s in STATUS)}</tbody></table>
<p class="note">لا سؤال بحالة «معتمد»: الاعتماد قرار المشرف وحده. حالة «يحتاج تحققًا» افتراضية لكل سؤال حتى يُراجَع، وفي كل بطاقة ما يحتاج إلى تحقق تحديدًا.</p>
<h3>التوزيع على الجلسات</h3><table class="grid"><thead><tr><th>الجلسة</th><th>الموضوع</th><th>الأسئلة</th><th>فيها آية</th><th>فيها حديث</th><th>بخيارين</th></tr></thead><tbody>{by_sess}</tbody></table>
<p class="note">مستويات الأسئلة: {"، ".join(f"{k}: {ar(v)}" for k,v in bl.items())}. أسئلة بنص شرعي: {ar(cnt(lambda r:r["nass"]))} سؤالًا.</p></section>''')
# المنهج
H.append('''<section class="pg"><h1 class="h1">٢. كيف يُقرأ السجل وضوابط التوثيق</h1><ol class="rules">
<li><b>بطاقة السؤال:</b> رقم متسلسل ومعرّف (مثل s5q1)، ثم الموضع (البرنامج ‹ القسم ‹ الجزء ‹ الموضوع ‹ المجموعة ‹ الجلسة)، ثم نص السؤال، فالنص الشرعي الذي يعتمد عليه، فالخيارات (الصحيحة <span class="red">بالأحمر</span>)، فالشرح كما يظهر في التطبيق، فالتوثيق، فالحالة وخانة المشرف.</li>
<li><b>ترتيب الخيارات:</b> يُخلط في التطبيق عند كل عرض. عُرضت هنا بترتيب ثابت لا يكشف الصحيحة بموضعها.</li>
<li><b>صفحة الملخص:</b> هي صفحة ملف ملخص زاد العباد المعتمد (إصدار zad-sum-1). «الصفحات المسجلة» من بنك الأسئلة، و«الموضع الفعلي» محسوب بمطابقة نص الشرح والنص الشرعي مع النص المحوَّل لكل فقرة (الصفحات ٤–٨)، فيظهر الموضع الدقيق لا صفحة بداية الموضوع. وإن اختلف الاثنان نُبّه.</li>
<li><b>صفحة الكتاب الأصلي:</b> «قيد التحقق» لكل سؤال. لم أطابق أي صفحة بالكتاب الأصلي (ليس عندي)، ولم أذكر رقمًا تقديريًا. وأرقام «ص ١١» ونحوها التي يذكرها الملخص عند عناوين الموضوعات هي موضع الموضوع في الكتاب المطبوع بحسب الملخص، لا تحققًا.</li>
<li><b>الروابط:</b> لم يُضَف رابط صفحة لأنه لا يوجد رابط متحقق منه ينتقل مباشرة إلى صفحة محددة. تُضاف إلى هذا السجل حين تتحقق.</li>
<li><b>الآيات:</b> تُعرض بنص مجمع الملك فهد الإملائي (بلا تشكيل) بعد مطابقة حروفها. وتشكيل الآيات في ملف PDF الأصلي معلّق.</li>
<li><b>الأحاديث:</b> نُقلت كما في الملخص وطُوبقت أولًا بمجموعات حديثية مفتوحة (ملاحظة التحقق في كل بطاقة). الاعتماد النهائي للمشرف.</li>
<li><b>التتبّع:</b> كل بطاقة تحمل معرّف السؤال وإصدار الملخص، فيمكن تتبع أي تعديل مستقبلًا. وتُضاف أسئلة المجموعات الجديدة إلى هذا السجل نفسه بالأسلوب نفسه.</li></ol>
<h3>مفتاح الألوان والرموز</h3><p><span class="red">النص الأحمر</span> = الإجابة الصحيحة المخزنة في بنك الأسئلة · ☐ خانة اختيار للمشرف · «قيد التحقق» = لم تتم المطابقة بعد.</p></section>''')
# فهرس
toc=[]
for n in range(1,11):
    qs=[r for r in Q if r['session']==n]
    toc.append(f'<tr class="ts"><td>الجلسة {ar(n)} — {e(unit[n])}</td><td class="c">{P("S%02d"%n)}</td></tr>'+''.join(f'<tr class="tq"><td>{ar(r["seq"])}. <span class="lt">{r["id"]}</span> {e(r["text"][:70])}{"…" if len(r["text"])>70 else ""}</td><td class="c">{P("ID "+r["id"])}</td></tr>' for r in qs))
H.append(f'<section class="pg"><h1 class="h1">٣. الفهرس</h1><table class="toc"><tbody><tr class="ts"><td>البرنامج التأصيلي — الأسئلة والمراجعة</td><td class="c">{P("PROG1")}</td></tr>{"".join(toc)}<tr class="ts"><td>المراجعة العشرية للمجموعة ١ (٢٠ موضعًا)</td><td class="c">{P("REVIEW")}</td></tr><tr class="ts"><td>البرنامج التحصيني — مراقي الوعي</td><td class="c">{P("PROG2")}</td></tr><tr class="ts"><td>خطة بقية زاد العباد وصفحة اعتماد المشرف</td><td class="c">{P("PLAN")}</td></tr></tbody></table></section>')
# البرنامج الأول
H.append('<section class="prog" id="prog1"><div class="mk">PROG1</div><h1 class="h1">البرنامج التأصيلي — ملخص «زاد العباد»</h1><p>القسم الأول: العقائد · المجموعة العشرية ١ (الجلسات ١–١٠) · أُعدّت أسئلتها فعلًا.</p></section>')
def card(r):
    nass=''.join(f'<div class="nass {"ay" if x["kind"]=="آية" else "hd"}"><div class="nl">{e(x["label"])} · {e(x["cite"])}</div><div class="nt">{e(x["text"])}</div>{("<div class=vf>ملاحظة التحقق: "+e(x["verify"])+"</div>") if x["verify"] else ""}</div>' for x in r['nass'])
    opts=''.join(f'<li class="{"ok" if o["correct"] else ""}"><span class="lt2">{o["letter"]}</span><span>{e(o["text"])}{" ✔ الإجابة الصحيحة" if o["correct"] else ""}</span></li>' for o in r['options'])
    expl=''.join(f'<p>{e(x)}</p>' for x in r['explanation'])
    ru='، '.join(f'هدف {ar(x["obj"])} ({"أساسي" if x["primary"] else "بديل"}) — {e(x["title"])}' for x in r['review_use']) or 'لا يُستعمل في المراجعة'
    lp=('ص'+'، ص'.join(ar(p) for p in r['located_pages'])) if r['located_pages'] else 'لم يُحدَّد آليًا'
    ex=[p for p in r['located_pages'] if p not in r['summary_pages']]
    cons=('متسق مع الصفحات المسجلة' if not ex else 'وردت المعلومة أيضًا في ص'+'، ص'.join(ar(p) for p in ex)+' ('+e('، '.join(t for t in r['located_topics'] if t=='خلاصة للمراجعة') or 'موضع آخر')+')') if r['located_pages'] else '—'
    fl=''.join(f'<li>{e(x)}</li>' for x in r['flags'])
    sc=lambda s:'☒' if r['status']==s else '☐'
    return f'''<article class="q"><header><span class="n">س {ar(r["seq"])}</span><span class="qid">ID {r["id"]}</span><span class="st">{e(r["status"])}</span></header>
<div class="path">{e(r["program"])} ‹ القسم: {e(r["section"])} ‹ {e(r["part"])} ‹ الموضوع: {e(r["unit_title"])} ‹ المجموعة {ar(r["group"])} ‹ الجلسة {ar(r["session"])} ‹ السؤال {ar(r["qno"])} من {ar(r["qtotal"])}</div>
<p class="qt">{e(r["text"])}</p>{nass}<ol class="opts">{opts}</ol>
<div class="ex"><b>الشرح كما يظهر في التطبيق:</b>{expl}</div>
<table class="ref"><tr><th>صفحة الملخص (المسجلة)</th><td>ص{"، ص".join(ar(p) for p in r["summary_pages"])} — إصدار {e(r["summary_version"])}</td><th>صفحة الكتاب الأصلي</th><td class="pend">{e(r["book_page"])}</td></tr>
<tr><th>الموضع الفعلي في الملخص</th><td colspan="3">{e(r["locus"])} · الفقرة (الفقرات): {e("، ".join(sorted(r["located_blocks"])) or "—")} · {lp} · {cons}</td></tr>
<tr><th>مستوى السؤال والهدف</th><td colspan="3">{e(r["bloom"] or "")} · {ru}{(" · دُمج من: "+e("، ".join(r["merged_from"]))) if r["merged_from"] else ""}</td></tr></table>
{("<div class=fl><b>ما يحتاج إلى تحقق أو قرار:</b><ul>"+fl+"</ul></div>") if fl else ""}
<div class="sup"><div class="chk">حالة المراجعة: {sc("معتمد")} معتمد &nbsp; {sc("يحتاج تعديلًا")} يحتاج تعديلًا &nbsp; {sc("يحتاج تحققًا")} يحتاج تحققًا</div><div class="nb"><b>قرار المشرف العلمي وملاحظاته:</b> {e(r["decision"])} {e(r["note"])}</div></div></article>'''
for n in range(1,11):
    qs=[r for r in Q if r['session']==n]
    H.append(f'<section class="sess"><div class="mk">S{n:02d}</div><h2 class="h2">الجلسة {ar(n)} — {e(unit[n])}</h2><p class="pth">البرنامج التأصيلي ‹ القسم: العقائد ‹ {e(PART[n])} ‹ المجموعة ١ · {ar(len(qs))} أسئلة</p>'+''.join(f'<div class="mk">ID {r["id"]}</div>'+card(r) for r in qs)+'</section>')
# المراجعة
rows=''.join(f'<tr><td class="c">{ar(s["obj"])}</td><td>{e(s["title"])}</td><td class="c lt">{s["primary"]}</td><td class="lt">{e("، ".join(s["others"]) or "—")}</td></tr>' for s in slots)
H.append(f'''<section class="pg"><div class="mk">REVIEW</div><h1 class="h1">المراجعة العشرية للمجموعة ١ — ٢٠ موضعًا</h1>
<p>المراجعة ٢٠ سؤالًا: سؤال لكل هدف علمي من ٢٠. يُقدَّم ما أخطأ فيه الطالب عند أول محاولة، وإلا السؤال الأساسي (المفهوم المحوري) ثم يُدار بين بقية أسئلة الهدف عند التكرار. توزَّع على أربع جلسات مصغّرة (٥ أسئلة). <b>لا أسئلة إضافية:</b> كل موضع يستعمل سؤالًا من الأسئلة الاثنين والأربعين المعروضة أعلاه، فيُراجَع بالبطاقات نفسها.</p>
<table class="grid"><thead><tr><th>الهدف</th><th>الهدف العلمي</th><th>السؤال الأساسي</th><th>أسئلة بديلة</th></tr></thead><tbody>{rows}</tbody></table>
<p class="note">اجتياز المراجعة يشترط الإجابة الصحيحة عن كل الأسئلة ولو بعد التصحيح، وتُحتسب المحاولة الأولى مؤشرًا مستقلًا. أسئلة «إعادة التثبيت» اختيارية.</p></section>''')
# البرنامج الثاني
H.append(f'''<section class="pg"><div class="mk">PROG2</div><h1 class="h1">البرنامج التحصيني — ملخص «مراقي الوعي»</h1>
<div class="empty"><b>لم تُعدّ أسئلة هذا البرنامج بعد.</b><p>الملخص: {ar(tah["pages"])} صفحة، {ar(tah["chapters"])} فصلًا. لم تُنشأ له أسئلة، ولن تُنشأ إلا بعد اعتماد منهج الإعداد وطلب صريح. عند إعدادها تُضاف إلى هذا السجل نفسه: بطاقة لكل سؤال بالحقول ذاتها، مقسمة بحسب الفصول والمجموعات والجلسات.</p>
<table class="grid"><tbody><tr><td>عدد أسئلة معدّة</td><td class="c">٠</td></tr><tr><td>إصدار الملخص</td><td class="c">maraqi-sum-1</td></tr></tbody></table></div></section>''')
plan=''.join(f'<tr><td>{e(s["name"])}</td><td class="c">ص{ar(s["pages"][0])}–{ar(s["pages"][1])}</td><td class="c">{ar(s["topics"])}</td><td class="c">{ar(s["sessions"])}</td><td class="c">{"١٠ جلسات (المجموعة ١) — أسئلتها معدّة" if s["id"]=="aqeeda" else "لم تُعدّ"}</td></tr>' for s in rec['zad_plan'])
H.append(f'''<section class="pg"><div class="mk">PLAN</div><h1 class="h1">البرنامج التأصيلي: ما لم تُعدّ أسئلته</h1>
<p>خطة الأقسام (تقدير الخطة لا نتيجة إعداد). المعدّ فعلًا عشر جلسات من القسم الأول فقط.</p><table class="grid"><thead><tr><th>القسم</th><th>صفحات الكتاب (بحسب بنية الملخص)</th><th>الموضوعات</th><th>الجلسات المخططة (تقدير)</th><th>حالة الأسئلة</th></tr></thead><tbody>{plan}</tbody></table>
<h3>اعتماد المشرف العلمي</h3><table class="sign"><tr><th>اسم المشرف</th><td></td><th>التاريخ</th><td></td></tr><tr><th>قرار عام على المجموعة ١</th><td colspan="3">☐ معتمدة &nbsp; ☐ معتمدة بعد التعديلات المدوّنة &nbsp; ☐ تحتاج مراجعة</td></tr><tr><th>ملاحظات عامة</th><td colspan="3" class="big"></td></tr><tr><th>التوقيع</th><td colspan="3"></td></tr></table></section>''')
H.append('</body></html>')
open(HERE+'/record.html','w',encoding='utf8').write('\n'.join(H))
# ---------- XLSX
import openpyxl
from openpyxl.styles import Font,Alignment,PatternFill,Border,Side
from openpyxl.worksheet.datavalidation import DataValidation
wb=openpyxl.Workbook(); ws=wb.active; ws.title='الأسئلة'; ws.sheet_view.rightToLeft=True
cols=['م','المعرّف','البرنامج','القسم','الجزء','الموضوع','المجموعة','الجلسة','رقم السؤال في الجلسة','نص السؤال','النص الشرعي (آية/حديث)','الخيار أ','الخيار ب','الخيار ج','الإجابة الصحيحة','الشرح كما في التطبيق','صفحة الملخص (المسجلة)','الموضع الفعلي في الملخص (صفحات محسوبة)','الفقرات','صفحة الكتاب الأصلي','إصدار الملخص','ما يحتاج تحققًا أو قرارًا','حالة المراجعة العلمية','قرار المشرف العلمي','ملاحظات المشرف']
ws.append(cols)
for r in Q:
    o=r['options']
    ws.append([r['seq'],r['id'],r['program'],r['section'],r['part'],r['unit_title'],r['group'],r['session'],r['qno'],r['text'],'\n'.join(f"[{x['label']}] {x['text']}" for x in r['nass']),o[0]['text'],o[1]['text'],o[2]['text'] if len(o)>2 else '',f"{r['correct_text']}",'\n'.join(r['explanation']),'ص'+'، ص'.join(map(str,r['summary_pages'])),('ص'+'، ص'.join(map(str,r['located_pages']))) if r['located_pages'] else '', '، '.join(r['located_blocks']),r['book_page'],r['summary_version'],'\n'.join(r['flags']),r['status'],r['decision'],r['note']])
hdr=PatternFill('solid',fgColor='0C6A62'); thin=Side(style='thin',color='CCCCCC')
for c in ws[1]: c.font=Font(bold=True,color='FFFFFF',name='Arial'); c.fill=hdr; c.alignment=Alignment(wrap_text=True,vertical='center',horizontal='center')
widths=[5,9,22,10,18,22,8,7,8,48,52,34,34,34,34,56,14,16,16,12,11,48,16,22,36]
for i,w in enumerate(widths,1): ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width=w
for row in ws.iter_rows(min_row=2):
    for c in row: c.alignment=Alignment(wrap_text=True,vertical='top',horizontal='right'); c.border=Border(top=thin,bottom=thin,left=thin,right=thin)
    ws.cell(row=row[0].row,column=15).font=Font(color='C00000',bold=True)
ws.freeze_panes='C2'; ws.auto_filter.ref=ws.dimensions
dv=DataValidation(type='list',formula1='"'+','.join(STATUS)+'"',allow_blank=False); ws.add_data_validation(dv); dv.add(f'W2:W{len(Q)+1}')
w2=wb.create_sheet('المراجعة العشرية'); w2.sheet_view.rightToLeft=True; w2.append(['الهدف','الهدف العلمي','السؤال الأساسي','أسئلة بديلة'])
for s in slots: w2.append([s['obj'],s['title'],s['primary'],'، '.join(s['others'])])
for c in w2[1]: c.font=Font(bold=True,color='FFFFFF'); c.fill=hdr
for i,w in enumerate([8,50,16,30],1): w2.column_dimensions[openpyxl.utils.get_column_letter(i)].width=w
w3=wb.create_sheet('ملخص'); w3.sheet_view.rightToLeft=True
for row in [['السجل','بَرْد اليقين — سجل المراجعة العلمية'],['الإصدار',VERSION],['تاريخ الإصدار',ISSUE],['إصدار بنك الأسئلة',B.get('bankVersion')],['إصدار ملخص زاد العباد','zad-sum-1'],['بصمة SHA-256',sha],['الأسئلة المُعدّة',len(Q)],['مواضع المراجعة العشرية',len(slots)],['أسئلة البرنامج التحصيني','لم تُعدّ بعد'],['ملاحظة','عدّل الأعمدة: حالة المراجعة العلمية، قرار المشرف العلمي، ملاحظات المشرف. ثم أعد الإصدار بـ build_record.py --decisions هذا الملف.']]: w3.append(row)
w3.column_dimensions['A'].width=28; w3.column_dimensions['B'].width=90
wb.save(HERE+'/record.xlsx'); print('ok',len(Q),'questions; located-page mismatches:',[r['id'] for r in Q if r['pages_consistent'] is False],'; none located:',[r['id'] for r in Q if not r['located_pages']])
