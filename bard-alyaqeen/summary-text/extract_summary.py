"""يستخرج نص صفحات الملخص (٤–٨ من «زاد العباد») من ملف PDF الأصلي إلى بنية منسّقة للقراءة.
الاستعمال: python3 extract_summary.py <summary.pdf> <out.json>
لا يعدّل ملف PDF. يحتفظ برقم صفحة الملخص وبصمة الملف وإصداره لكل فقرة.
الآيات: نص الآية في الـPDF لا يُستخرج بوثوق (حروف مفقودة وعلامات تشكيل مبعثرة)، فتُستبدل بنص مجمع الملك فهد (الحقل الإملائي) في المواضع المحددة في VERSES، وتُسجَّل المقارنة في verify.
"""
import sys,re,json,hashlib,collections,unicodedata
import pdfplumber
PDF,OUT=sys.argv[1],sys.argv[2]
KF=json.load(open('/tmp/vv/kfgqpc.json',encoding='utf8'))   # بيانات مجمع الملك فهد (الحفص الذكي ٨، الحقل الإملائي) للمطابقة
MIR=str.maketrans('()[]«»',')(][»«')
PAGES=[4,5,6,7,8]
# الآيات كما تظهر مقتطعة في الملخص: (السورة:الآية، نص المقطع كما قرأته من صورة الصفحة بلا تشكيل)
VERSES={
 4:[('2:285','آمن الرسول بما أنزل إليه من ربه والمؤمنون كل آمن بالله وملائكته وكتبه ورسله لا نفرق بين أحد من رسله')],
 5:[('2:143','وما كان الله ليضيع إيمانكم'),('9:124','فأما الذين آمنوا فزادتهم إيمانا'),('8:2','وإذا تليت عليهم آياته زادتهم إيمانا'),('3:103','فألف بين قلوبكم فأصبحتم بنعمته إخوانا'),('59:9','ويؤثرون على أنفسهم ولو كان بهم خصاصة')],
 6:[('3:110','كنتم خير أمة أخرجت للناس تأمرون بالمعروف وتنهون عن المنكر وتؤمنون بالله'),('9:71','والمؤمنون والمؤمنات بعضهم أولياء بعض')],
 7:[('6:101','بديع السماوات والأرض أنى يكون له ولد ولم تكن له صاحبة'),('6:102','ذلكم الله ربكم لا إله إلا هو خالق كل شيء فاعبدوه')],
 8:[('10:56','هو يحيي ويميت وإليه ترجعون'),('6:2','هو الذي خلقكم من طين ثم قضى أجلا'),('11:6','وما من دابة في الأرض إلا على الله رزقها'),('30:40','الله الذي خلقكم ثم رزقكم ثم يميتكم ثم يحييكم')],
}
def sk(w):
    w=unicodedata.normalize('NFC',w); out=''.join(c for c in w if unicodedata.category(c) not in('Mn','Lm','Zs','Po','Cf','Pd','Ps','Pe') and c!='ـ')
    for a,b in (('أ','ا'),('إ','ا'),('آ','ا'),('ٱ','ا'),('ى','ي'),('ی','ي'),('ة','ه'),('ؤ','و'),('ئ','ي'),('ء','')): out=out.replace(a,b)
    return out.replace('ا','')
def official(ref,typed):
    c,v=map(int,ref.split(':')); row=next(x for x in KF if x['sura_no']==c and x['aya_no']==v); words=row['aya_text_emlaey'].split()
    tw=typed.split(); skw=[sk(w) for w in words]; skt=[sk(w) for w in tw]
    for i in range(len(words)-len(tw)+1):
        if skw[i:i+len(tw)]==skt: return ' '.join(words[i:i+len(tw)]),True,row['aya_text_emlaey']
    # محاذاة تقريبية: أقرب نافذة
    best=max(range(max(1,len(words)-len(tw)+1)),key=lambda i:sum(a==b for a,b in zip(skw[i:i+len(tw)],skt)))
    return ' '.join(words[best:best+len(tw)]),False,row['aya_text_emlaey']
sha=hashlib.sha256(open(PDF,'rb').read()).hexdigest()
pdf=pdfplumber.open(PDF)
def inside(y,rng): return any(a-1<=y<=b+1 for a,b in rng)
blocks=[]; verify=[]; vlog=[]
for pn in PAGES:
    pg=pdf.pages[pn-1]
    # مناطق: لوحات الدليل (مستطيلات فاتحة) والبانر والتنبيه والخلاصة (منحنيات)
    ev=[(r['top'],r['bottom']) for r in pg.rects if r['x1']-r['x0']>400 and r.get('non_stroking_color') and abs(r['non_stroking_color'][0]-0.96)<.02 and r['bottom']-r['top']>20]
    cur=[(c['top'],c['bottom'],c['x0'],c['x1']) for c in pg.curves if c['x1']-c['x0']>400]
    bullets=sorted((c['top']+c['bottom'])/2 for c in pg.curves if c['x1']-c['x0']<12 and c['bottom']-c['top']<12)
    L=collections.OrderedDict()
    ys=sorted({c['matrix'][5] for c in pg.chars if c['text']!='\x00'})
    cl={};g=0
    for i,y in enumerate(ys):
        if i and y-ys[i-1]>2.5: g+=1
        cl[y]=g
    for c in pg.chars:
        if c['text']=='\x00': continue
        L.setdefault(cl[c['matrix'][5]],[]).append(c)
    lines=[]
    for k in sorted(L,reverse=True):
        cs=L[k]; base=[c for c in cs if unicodedata.category(c['text'][0])!='Mn']
        if not base: continue
        chs=[(c['text'],'Bold' in c['fontname']) for c in cs]
        chs=chs[::-1]
        # نعكس الترتيب البصري إلى المنطقي، ثم نعيد أرقام الأعداد وقوسَي الاقتباس
        txt=[(t.translate(MIR),b) for t,b in chs]
        s=''.join(t for t,_ in txt); bold=[b for t,b in txt for _ in t]
        # إعادة ترتيب سلاسل الأرقام اللاتينية
        out=[];flags=[];i=0
        while i<len(s):
            if s[i].isascii() and s[i].isdigit():
                j=i
                while j<len(s) and s[j].isascii() and s[j].isdigit(): j+=1
                out.extend(s[i:j][::-1]); flags.extend(bold[i:j][::-1]); i=j
            else: out.append(s[i]); flags.append(bold[i]); i+=1
        import statistics as _st
        top=_st.median(c['top'] for c in base); bot=_st.median(c['bottom'] for c in base)
        lines.append(dict(top=top,bot=bot,mid=(top+bot)/2,x0=min(c['x0'] for c in base),x1=max(c['x1'] for c in base),size=max(c['size'] for c in base),chars=list(zip(out,flags)),
                          bold0=bool(flags and flags[0])))
    def clean(chars):
        t=''.join(c for c,_ in chars).replace('ـ','')
        fl=[b for c,b in chars if c!='ـ']
        return list(zip(t,fl))
    def runs(chars):
        chars=clean(chars); res=[]
        # دمج المسافات المتتالية وإزالة المسافات الطرفية
        s=''.join(c for c,_ in chars); fl=[b for _,b in chars]
        o=[]
        for c,b in zip(s,fl):
            if c==' ' and o and o[-1][0]==' ': continue
            o.append((c,b))
        while o and o[0][0]==' ': o.pop(0)
        while o and o[-1][0]==' ': o.pop()
        for c,b in o:
            if res and res[-1]['b']==b: res[-1]['t']+=c
            else: res.append({'t':c,'b':b})
        return res
    def kind_of(l):
        y=l['mid']
        for (a,b,x0,x1) in cur:
            if a-1<=y<=b+1:
                txt=''.join(c for c,_ in l['chars'])
                return 'banner' if (pn==4 and b<200) else ('review' if (pn==7 and a<100) else 'note')
        if inside(y,ev): return 'evidence'
        return 'body'
    seq=[]
    for l in lines:
        txt=''.join(c for c,_ in l['chars']).strip()
        if re.fullmatch(r'\d+ / \d+',txt) or re.fullmatch(r'\d+ \d+ / ?',txt): continue
        l['kind']=kind_of(l); l['txt']=txt; seq.append(l)
    # فقرات
    cur_para=None
    def flush():
        global cur_para
        if cur_para: blocks.append(cur_para); cur_para=None
    vq=list(VERSES.get(pn,[]))
    for l in seq:
        kind=l['kind']; txt=l['txt']
        if kind=='body' and l['size']>=16.5: flush(); blocks.append(dict(kind='h1',page=pn,runs=runs(l['chars']))); continue
        if kind=='body' and l['size']>=14 and l['bold0']:
            flush()
            ch=l['chars']; t=''.join(c for c,_ in ch)
            m=re.search(r'ص\s*(\d+)\s*$',t)
            bp=None
            if m: bp=int(m.group(1)); ch=ch[:m.start()]
            blocks.append(dict(kind='topic',page=pn,bookpage=bp,runs=runs(ch))); continue
        if kind=='body' and re.fullmatch(r'ص\s*\d+',txt) and blocks and blocks[-1]['kind']=='topic':
            blocks[-1]['bookpage']=int(re.sub(r'\D','',txt)); continue
        if kind in('evidence','note','banner','review'):
            if cur_para and cur_para['kind']==kind and not cur_para.get('title') and not (kind=='banner' and l['size']>=17) and not (kind=='review' and any(abs(l['mid']-b)<8 for b in bullets)):
                cur_para['chars']+= [(' ',False)]+l['chars']; cur_para['end']=pn; continue
            flush()
            cur_para=dict(kind=kind,page=pn,chars=list(l['chars']),end=pn)
            if (kind=='banner' and l['size']>=17) or (kind=='review' and l['bold0'] and not any(abs(l['mid']-b)<8 for b in bullets)): cur_para['title']=True
            if kind=='review':
                cur_para['bullet']=any(abs(l['mid']-b)<8 for b in bullets)
            continue
        # body bullet
        is_start=any(l['top']-2<=b<=l['bot']+2 for b in bullets)
        if is_start or not cur_para or cur_para['kind']!='bullet':
            flush(); cur_para=dict(kind='bullet',page=pn,chars=list(l['chars']),end=pn)
        else:
            cur_para['chars']+= [(' ',False)]+l['chars']
    flush()
    # استبدال الآيات في كتل الدليل لهذه الصفحة
    for b in blocks:
        if b.get('page')==pn and b['kind']=='evidence' and 'chars' in b and 'vdone' not in b:
            t=''.join(c for c,_ in b['chars'])
            n=len(re.findall('﴿',t)); b['_nv']=n
    # بناء الـruns
    for b in blocks:
        if 'chars' in b:
            if b.get('page')==pn and b['kind']=='evidence' and 'vdone' not in b:
                ch=b['chars']; t=''.join(c for c,_ in ch)
                # تحويل الأقواس المزخرفة إلى مواضع
                out=[];i=0; spans=[]
                while i<len(ch):
                    if ch[i][0]=='﴿':
                        j=i
                        while j<len(ch) and ch[j][0]!='﴾': j+=1
                        raw=''.join(c for c,_ in ch[i:j+1])
                        ref,typed=vq.pop(0)
                        off,ok,full=official(ref,typed)
                        vlog.append(dict(page=pn,ref=ref,typed_from_image=typed,official=off,matches=ok,pdf_text_layer=raw))
                        out.extend([(c,False) for c in '﴿'+off+'﴾']); i=j+1
                    else: out.append(ch[i]); i+=1
                b['chars']=out; b['vdone']=True
            b['runs']=runs(b['chars']); del b['chars']
            b.pop('vdone',None); b.pop('_nv',None)
    if vq: raise SystemExit(f'page {pn}: {len(vq)} verse(s) not consumed')
# تصحيحات موثّقة: مواضع فُقد فيها حرف أو علامة من طبقة النص في الـPDF، وثبتت صحتها بصورة الصفحة وباستخراج pdftotext المستقل
PATCHES=[(5,'إيماًا','إيمانًا','فُقد حرف النون والتنوين في طبقة النص؛ صورة الصفحة ٥ وpdftotext تثبتان «إيمانًا»'),
 (6,'ربّا','ربًّا','فُقد التنوين المقترن بالشدة؛ صورة الصفحة ٦ تثبت «ربًّا» في موضعين'),
 (5,'لما أعطي','لما أُعطي','فُقدت الضمة على الهمزة؛ صورة الصفحة ٥ وpdftotext تثبتانها')]
plog=[]
for pn,a,b_,why in PATCHES:
    n=0
    for blk in blocks:
        if blk['page']==pn:
            for r in blk['runs']:
                if a in r['t']: r['t']=r['t'].replace(a,b_); n+=1
    plog.append(dict(page=pn,before=a,after=b_,occurrences=n,why=why))
# إسناد المتن إلى المباحث
cur_topic=None; part=None; topics=[]
for blk in blocks:
    k=blk['kind']
    if k=='banner': blk['topic']='intro'
    elif k=='h1': blk['topic']='part'; part=''.join(r['t'] for r in blk['runs'])
    elif k=='topic':
        cur_topic='T%d'%(len(topics)+1); blk['topic']=cur_topic
        topics.append(dict(id=cur_topic,title=''.join(r['t'] for r in blk['runs']),bookpage=blk.get('bookpage'),part=part,page=blk['page']))
    elif k=='review': blk['topic']='R1'
    else: blk['topic']=cur_topic
# إضافة معرّفات
for i,b in enumerate(blocks): b['id']='b%03d'%(i+1); b['end']=b.get('end',b['page'])
json.dump(dict(source=dict(id='zad-sum-1',sha256=sha,pages=PAGES,total_pages=len(pdf.pages),title='ملخص كتاب «زاد العباد»'),topics=topics,blocks=blocks,verses=vlog,patches=plog),open(OUT,'w',encoding='utf8'),ensure_ascii=False,indent=1)
print(len(blocks),'blocks',len(vlog),'verses', all(v['matches'] for v in vlog))
