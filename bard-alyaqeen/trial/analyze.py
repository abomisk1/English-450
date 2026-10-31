"""تحليل نتائج التجربة المغلقة (CSV مُصدَّر من التطبيق: code,seq,date,dev,kind,id,nq,sec,est,completed,timeout,exited,resumed,wrong,ft,dry,ease,textlen,clarity,comment,qs).
الاستعمال: python3 analyze.py results1.csv results2.csv ...   (كل ملف لمشارك أو ملف مجمّع)
يقارن بمعايير القبول في خطة التجربة. لا يستعمل أي بيانات شخصية."""
import csv,sys,statistics as st,collections
rows=[]
for f in sys.argv[1:]:
    with open(f,encoding='utf-8-sig',newline='') as fh:
        rows+= [r for r in csv.DictReader(fh) if r.get('code')]
b=lambda v:str(v).lower()=='true'
real=[r for r in rows if b(r.get('dry','false'))==False]
S=[r for r in real if r['kind']=='S']; RM=[r for r in real if r['kind']=='RM']
parts={r['code'] for r in real}
print('المشاركون:',len(parts),'| السجلات:',len(real))
def med(a): return round(st.median(a),1) if a else None
done=[r for r in S if b(r['completed'])]
first=[r for r in done if not b(r['resumed'])]
ok180=[r for r in first if float(r['sec'])<=180 and not b(r['timeout'])]
print('C2 جلسات أُكملت من أول مرة داخل ١٨٠ث:',len(ok180),'/',len(first),f'= {100*len(ok180)/max(1,len(first)):.0f}% (المطلوب ≥٨٠٪)')
s7=[r for r in S if r['id']=='7']; s7t=sum(b(r['timeout']) for r in s7)
print('الجلسة ٧: سجلات',len(s7),'| انتهى وقتها',s7t,f"({100*s7t/max(1,len(s7)):.0f}%، المطلوب ≤٣٠٪)",'| وسيط الزمن',med([float(r['sec']) for r in s7]))
ratio=[float(r['sec'])/float(r['est']) for r in done if float(r['est'])>0]
print('C3 نسبة الزمن الفعلي إلى التقدير (وسيط):',med(ratio),'(المطلوب ٠٫٧–١٫٣)')
rmok=[r for r in RM if float(r['sec'])<=180 and not b(r['timeout'])]
print('C4 جلسات المراجعة المصغّرة داخل ١٨٠ث:',len(rmok),'/',len(RM))
ftr=collections.defaultdict(list)
for r in S: ftr[r['id']].append(int(r['ft'])/max(1,int(r['nq'])))
print('C5 المحاولة الأولى لكل جلسة (وسيط):',{k:round(st.median(v),2) for k,v in sorted(ftr.items(),key=lambda x:int(x[0]))})
q=collections.defaultdict(lambda:[0,0])
for r in S+RM:
    for item in (r.get('qs') or '').split():
        try: qid,f,a=item.split(':')
        except ValueError: continue
        q[qid][0]+=int(f); q[qid][1]+=1
flag=[(k,v[0],v[1]) for k,v in q.items() if v[1]>=5 and (v[0]/v[1]<0.4 or v[0]/v[1]>0.95)]
print('أسئلة تحتاج مراجعة (≥٥ مشاهدات، محاولة أولى <٤٠٪ أو >٩٥٪):',flag or 'لا شيء')
ease=[int(r['ease']) for r in real if r.get('ease')]
print('C6 السهولة (وسيط):',med(ease),'(المطلوب ≥٤) | ن =',len(ease))
tl=[r['textlen'] for r in real if r.get('textlen')]; cl=[r['clarity'] for r in real if r.get('clarity')]
print('طول النص «مناسبة»:',f"{100*tl.count('مناسبة')/max(1,len(tl)):.0f}%",'| «واضحة»:',f"{100*cl.count('واضحة')/max(1,len(cl)):.0f}%",'(المطلوب ≥٨٠٪ لكل منهما)')
print('C7 جلسات انتهى وقتها:',sum(b(r['timeout']) for r in S),'| غادرها المشارك قبل الإتمام:',sum(b(r['exited']) for r in S))
