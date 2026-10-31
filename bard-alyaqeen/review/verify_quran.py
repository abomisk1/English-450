import json,re,unicodedata,sys
Q=json.load(open('/tmp/vv/6509d2.json',encoding='utf8'))['quran']
T=json.load(open('/tmp/vv/f08f81.json',encoding='utf8'))
def get(c,v): return next(x['text'] for x in Q if x['chapter']==c and x['verse']==v)
def sk(s):
    out=[]
    for ch in unicodedata.normalize('NFC',s):
        cat=unicodedata.category(ch)
        if cat in('Mn','Lm','Sk','Po','Pf','Pi','Ps','Pe','Cf'): continue
        if ch in 'ا أإآٱءـ': continue
        out.append({'ى':'ي','ی':'ي','ئ':'ي','ؤ':'و','ة':'ه','ک':'ك'}.get(ch,ch))
    return ''.join(out)
# semarketir (Tanzil-derived) cross-check structure
tz=T.get('verse') or T
def tz_get(v):
    d=T['verse']; return d.get(f'verse_{v}')
SEGS=[('s1q2',2,285,"آمَنَ الرَّسُولُ بِمَا أُنزِلَ إِلَيْهِ مِن رَّبِّهِ وَالْمُؤْمِنُونَ ۚ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّن رُّسُلِهِ"),
('s3q2',2,143,"وَمَا كَانَ اللَّهُ لِيُضِيعَ إِيمَانَكُمْ"),
('s4q4a',9,124,"فَأَمَّا الَّذِينَ آمَنُوا فَزَادَتْهُمْ إِيمَانًا"),
('s4q4b',8,2,"وَإِذَا تُلِيَتْ عَلَيْهِمْ آيَاتُهُ زَادَتْهُمْ إِيمَانًا"),
('s5q3',3,103,"فَأَلَّفَ بَيْنَ قُلُوبِكُمْ فَأَصْبَحْتُم بِنِعْمَتِهِ إِخْوَانًا"),
('s5q4',59,9,"وَيُؤْثِرُونَ عَلَىٰ أَنفُسِهِمْ وَلَوْ كَانَ بِهِمْ خَصَاصَةٌ"),
('s6q3',3,110,"كُنتُمْ خَيْرَ أُمَّةٍ أُخْرِجَتْ لِلنَّاسِ تَأْمُرُونَ بِالْمَعْرُوفِ وَتَنْهَوْنَ عَنِ الْمُنكَرِ وَتُؤْمِنُونَ بِاللَّهِ"),
('s8q1',6,101,"بَدِيعُ السَّمَاوَاتِ وَالْأَرْضِ أَنَّىٰ يَكُونُ لَهُ وَلَدٌ وَلَمْ تَكُن لَّهُ صَاحِبَةٌ"),
('s9q1',6,102,"ذَٰلِكُمُ اللَّهُ رَبُّكُمْ ۖ لَا إِلَٰهَ إِلَّا هُوَ ۖ خَالِقُ كُلِّ شَيْءٍ فَاعْبُدُوهُ"),
('s10q1',10,56,"هُوَ يُحْيِي وَيُمِيتُ وَإِلَيْهِ تُرْجَعُونَ")]
res={}
def sk_idx(s):
    out=[];idx=[]
    for i,ch in enumerate(unicodedata.normalize('NFC',s)):
        cat=unicodedata.category(ch)
        if cat in('Mn','Lm','Sk','Po','Pf','Pi','Ps','Pe','Cf','Zs') or ch in 'ا أإآٱءـ\xa0': continue
        out.append({'ى':'ي','ی':'ي','ئ':'ي','ؤ':'و','ة':'ه','ک':'ك'}.get(ch,ch)); idx.append(i)
    return out,idx
def collapse(chars,idx):
    o=[];oi=[]
    for c,i in zip(chars,idx):
        if o and o[-1]==c=='ي': continue
        o.append(c);oi.append(i)
    return ''.join(o),oi
for key,c,v,mine in SEGS:
    full=unicodedata.normalize('NFC',get(c,v))
    a,ai=collapse(*sk_idx(full)); m,_=collapse(*sk_idx(mine))
    p=a.find(m)
    if p<0: print(key,c,v,'NO MATCH'); res[key]=None; continue
    s0=ai[p]; e0=ai[p+len(m)-1]
    # extend to word boundaries
    while s0>0 and full[s0-1]!=' ': s0-=1
    while e0+1<len(full) and full[e0+1]!=' ': e0+=1
    seg=full[s0:e0+1].replace('\xa0',' ')
    partial=(s0>0 or e0<len(full)-1)
    res[key]={'chapter':c,'verse':v,'uthmani':seg,'full':full,'partial':partial}
    print(key,f'{c}:{v}','MATCH',('partial' if partial else 'whole verse')); print('   ',seg)
json.dump(res,open('quran_verified.json','w',encoding='utf8'),ensure_ascii=False,indent=1)
