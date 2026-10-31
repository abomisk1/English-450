import json,unicodedata,re,copy
B=json.load(open('../data/question-bank.json',encoding='utf8'))
K=json.load(open('/tmp/vv/kfgqpc.json',encoding='utf8'))
V=json.load(open('quran_verified.json',encoding='utf8'))
def sk(w):
    w=unicodedata.normalize('NFC',w)
    out=''.join(c for c in w if unicodedata.category(c) not in('Mn','Lm','Zs','Po','Cf'))
    for a,b in (('أ','ا'),('إ','ا'),('آ','ا'),('ٱ','ا'),('ى','ي'),('ی','ي'),('ة','ه'),('ؤ','و'),('ئ','ي'),('ء','')): out=out.replace(a,b)
    return re.sub('ي+','ي',out.replace('ا',''))
LOG=[]
done={}
for s in B['sessions']:
    for q in s['questions']:
        for n in q.get('nass',[]):
            if n['k']!='آية' or 'dataset_ref' not in n: continue
            c,v=map(int,n['dataset_ref'].split(':'))
            row=next(x for x in K if x['sura_no']==c and x['aya_no']==v)
            words=row['aya_text_emlaey'].split()
            segsk=re.sub('ي+','ي',sk(re.sub('[﴿﴾]','',n.get('tm') or n['t']).replace(' ','')))
            chars=[];owner=[]
            for wi,w in enumerate(words):
                for ch in sk(w):
                    if ch=='ي' and chars and chars[-1]=='ي': continue
                    chars.append(ch); owner.append(wi)
            joined=''.join(chars)
            pos=joined.find(segsk)
            if pos<0: raise SystemExit('no align '+n['dataset_ref'])
            i=owner[pos]; j=owner[pos+len(segsk)-1]
            seg_words=words[i:j+1]
            official='﴿'+' '.join(seg_words)+'﴾'
            if 'tm' not in n: n['tm']=n['t']
            LOG.append({'id':q['id'],'field':'nass.verse','before':n['t'],'after':official,'reason':'عرض نص الآية من بيانات مجمع الملك فهد (النص الإملائي) المتحقق منه رسميًا؛ والتشكيل المفتوح المصدر محفوظ في الحقل tm ولا يُعرض للطالب حتى يؤكده المشرف'})
            n['t']=official
            n['verify']=("نص الآية من بيانات مجمع الملك فهد لطباعة المصحف الشريف (الحفص الذكي ٨، الحقل الإملائي) في موضعها: سورة %d آية %d، صفحة المصحف %d. حروفها مطابقة لمجموعتين مفتوحتين أيضًا. لا تشكيل مُعتمد في هذا العرض لأن بيانات المجمع المشكولة بترميز الخط الخاص؛ والتشكيل المقترح من مصدر مفتوح محفوظ للمراجع (tm) ويُعرض بعد تأكيد المشرف." % (c,v,row['page']))
            done[q['id']]=official
json.dump(B,open('../data/question-bank.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
json.dump(LOG,open('change-log-verses.json','w',encoding='utf8'),ensure_ascii=False,indent=1)
for k,v in done.items(): print(k,v)
