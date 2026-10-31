import json,re,unicodedata,sys
def norm(s):
    s=unicodedata.normalize('NFC',s)
    s=''.join(c for c in s if unicodedata.category(c) not in('Mn','Lm','Po','Ps','Pe','Pi','Pf','Cf','Sk') )
    s=re.sub('[آأإٱ]','ا',s); s=s.replace('ى','ي').replace('ة','ه').replace('ؤ','و').replace('ئ','ي').replace('ـ','')
    s=re.sub(r'[\s\-–—«»()،؛:!؟?]+',' ',s).strip()
    return s
B=json.load(open('/tmp/vv/d1a2d2.json',encoding='utf8'))['hadiths']
M=json.load(open('/tmp/vv/ara-muslim.json',encoding='utf8'))['hadiths'] if False else None
