"""مقارنة مستقلة: نص الاستخراج الأول (pdfplumber) مع استخراج ثانٍ (pdftotext) بعد تجريد الهيكل الحرفي (بلا تشكيل ولا مسافات ولا ترقيم). تُستبعد الآيات (تُطابَق بالبيانات الرسمية)."""
import sys,re,json,subprocess,difflib,unicodedata
PDF,JS=sys.argv[1],sys.argv[2]
d=json.load(open(JS,encoding='utf8'))
def skel(s):
    s=unicodedata.normalize('NFC',s)
    s=re.sub('﴿[^﴾]*﴾','',s)
    return ''.join(c for c in s if unicodedata.category(c) in('Lo','Nd') and c not in 'ـ')
res=[]
for pn in range(4,9):
    t=subprocess.run(['pdftotext','-f',str(pn),'-l',str(pn),'-layout',PDF,'-'],capture_output=True,text=True).stdout
    t=re.sub('[‪-‮‎‏⁦-⁩]','',t)
    t=re.sub(r'\d+ / 218','',t)   # التذييل
    a=skel(t)
    b=skel(' '.join(''.join(r['t'] for r in blk['runs']) for blk in d['blocks'] if blk['page']==pn))
    sm=difflib.SequenceMatcher(None,a,b,autojunk=False)
    diffs=[(op,a[i1:i2],b[j1:j2],a[max(0,i1-12):i1],a[i2:i2+12]) for op,i1,i2,j1,j2 in sm.get_opcodes() if op!='equal']
    res.append((pn,len(a),len(b),diffs))
    print('page',pn,'pdftotext letters',len(a),'extracted',len(b),'diffs',len(diffs))
    for op,x,y,l,r in diffs[:40]: print('   ',op,'pdftotext=',repr(x),'extract=',repr(y),'| ctx:',l,'|',r)
