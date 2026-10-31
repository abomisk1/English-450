import json,re,unicodedata
def _keep(c): return unicodedata.category(c) not in('Mn','Lm','Po','Ps','Pe','Pi','Pf','Cf','Sk','Zs','Cc')
def skel(s):
    out=[];idx=[]
    for i,c in enumerate(unicodedata.normalize('NFC',s)):
        if not _keep(c) and c!=' ': continue
        if c==' ': continue
        c={'آ':'ا','أ':'ا','إ':'ا','ٱ':'ا','ى':'ي','ة':'ه','ؤ':'و','ئ':'ي','ـ':''}.get(c,c)
        if c=='': continue
        out.append(c); idx.append(i)
    return ''.join(out),idx
BK={h['hadithnumber']:unicodedata.normalize('NFC',h['text']) for h in json.load(open('/tmp/vv/d1a2d2.json',encoding='utf8'))['hadiths']}
MS={h['hadithnumber']:unicodedata.normalize('NFC',h['text']) for h in json.load(open('/tmp/vv/ara-muslim.json',encoding='utf8'))['hadiths']}
def locate(db,n,phrase,after=0):
    t=db[n]; s,idx=skel(t); p,_=skel(phrase); i=s.find(p,after)
    if i<0: return None
    return idx[i], idx[i+len(p)-1]+1
def find_all(db,phrase):
    p,_=skel(phrase); return [n for n,t in db.items() if p in skel(t)[0]]
def clean(t):
    return re.sub(r'\s+',' ',t.replace('‏"‏','«').replace('‏','').replace('"','»')).strip()
