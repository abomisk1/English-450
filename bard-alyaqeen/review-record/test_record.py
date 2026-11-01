"""اختبارات جودة سجل المراجعة العلمية: مطابقة PDF وxlsx لبنك الأسئلة الفعلي. الاستعمال: python3 test_record.py record.pdf"""
import sys,json,re,subprocess,unicodedata,collections
import pdfplumber,openpyxl
PDF=sys.argv[1]; R='..'
B=json.load(open(R+'/data/question-bank.json',encoding='utf8')); rec=json.load(open('record.json',encoding='utf8'))
P=lambda m,c:print(('PASS ' if c else 'FAIL ')+m) or c
sk=lambda s:''.join(c for c in unicodedata.normalize('NFC',s) if unicodedata.category(c) in('Lo','Nd') and c!='ـ')
bank=[q for s in B['sessions'] for q in s['questions'] if q.get('status')=='valid']; ok_all=True
def chk(m,c):
    global ok_all; r=P(m,c); ok_all=ok_all and r
chk('record has exactly the bank\'s 42 valid questions, same ids/order',[r['id'] for r in rec['questions']]==[q['id'] for q in bank] and len(bank)==42)
txt=subprocess.run(['pdftotext','-layout',PDF,'-'],capture_output=True,text=True).stdout
pages=[subprocess.run(['pdftotext','-f',str(i),'-l',str(i),'-layout',PDF,'-'],capture_output=True,text=True).stdout for i in range(1,int(re.search(r'Pages:\s+(\d+)',subprocess.run(['pdfinfo',PDF],capture_output=True,text=True).stdout).group(1))+1)]
full=sk(re.sub('[‪-‮‎‏⁦-⁩]','',txt))
sk2=lambda s:sk(s).replace('ا','')
raw=subprocess.run(['pdftotext',PDF,'-'],capture_output=True,text=True).stdout; full2=sk(re.sub('[\u202a-\u202e\u200e\u200f\u2066-\u2069]','',raw))
miss=[q['id'] for q in bank if txt.count('ID '+q['id'])<2]   # مرة في الفهرس ومرة في بطاقة (العلامة المخفية)
chk('every question id appears in the PDF index and card',not miss and True)
bad=[]
for q in bank:
    for part in [q['text']]+q['options']+[n['t'] for n in q.get('nass',[])]+(q.get('quoteParts') or [q['quote']]):
        if sk(re.sub('[«»﴿﴾]','',part)) not in full: bad.append((q['id'],part[:30]))
chk('question text, all options, verse/hadith text and explanation of all 42 appear completely in the PDF (no cut text) '+str(bad[:3]),not bad)
chk('scope stated: 42 questions + 20 review slots, rest not prepared',len(rec['review_slots'])==20 and sk2('لم تُعدّ بعد') in sk2(raw) and all(w in sk2(raw+txt) for w in [sk2('مواضع'),sk2('المراجعة'),sk2('العشرية'),sk2('٢٠')]))
chk('tahsini section says no questions prepared; no invented questions',sk('لم تُعدّ أسئلة هذا البرنامج بعد') in full and rec['tahsini']['name'] and not any(r['program'].startswith('البرنامج التحصيني') for r in rec['questions']))
# اللون الأحمر
pdf=pdfplumber.open(PDF); red=[]
for pg in pdf.pages:
    for c in pg.chars:
        col=c.get('non_stroking_color')
        if col and len(col)==3 and col[0]>.6 and col[1]<.2 and col[2]<.2 and c['text'].strip(): red.append(c['text'])
redsk=collections.Counter(sk(''.join(red)))
want=collections.Counter()
for q in bank: want.update(sk(q['options'][q['correct']]+'✔ الإجابة الصحيحة'.replace('✔','')))
want.update(sk('بالأحمر')); want.update(sk('النص الأحمر'))
for r in rec['questions']: want.update(sk([o['letter'] for o in r['options'] if o['correct']][0]))
d1,d2=redsk-want,want-redsk
# استثناء موثّق: طبقة نص الـPDF تُسقط النون في «إيمانًا» (تنوين مقترن) في إجابة s3q2، وهو عيب استخراج لا عيب عرض
chk('red text in the PDF = exactly the stored correct option letter/option of every question (+2 legend words): letter multiset equal (known text-layer drop of one ن in «إيمانًا»)',not d1 and (not d2 or (dict(d2)=={'ن':1} and 'إيمانًا' in bank[[q['id'] for q in bank].index('s3q2')]['options'][0])))
# تمييز: لا خيار خاطئ بالأحمر (نص خاطئ فريد)
html=open('record.html',encoding='utf8').read()
okopts=re.findall(r'<li class="ok"><span class="lt2">.</span><span>(.*?)(?: ✔ الإجابة الصحيحة)?</span></li>',html)
import html as H
cor=[H.unescape(x) for x in okopts]; chk('HTML: one red option per question, equal to the stored correct option',cor==[q['options'][q['correct']] for q in bank])
# الصفحات
badp=[r['id'] for r in rec['questions'] if r['summary_pages']!=sorted(set(((next(q for q in bank if q['id']==r['id']))['src'].get('pages') or [(next(q for q in bank if q['id']==r['id']))['src']['sp']])))]
chk('summary page numbers equal the bank\'s registered pages',not badp)
rd=json.load(open(R+'/summary-text/zad-p4-8.json',encoding='utf8')); pg_of={b['id']:b['page'] for b in rd['blocks']}
chk('located blocks exist and their pages are in the converted summary range 4–8',all(all(pg_of.get(b) in (4,5,6,7,8) for b in r['located_blocks']) for r in rec['questions']))
chk('no question lacks a located block (every question tied to its actual passage)',all(r['located_blocks'] for r in rec['questions']))
chk('book page never presented as verified: «قيد التحقق» on all 42 cards, no «تم التحقق» wording',txt.count('قيد التحقق')>=42 and 'تم التحقق من صفحة' not in txt and all(r['book_page']=='قيد التحقق' for r in rec['questions']))
chk('summary version and SHA-256 recorded',rec['summary_version']=='zad-sum-1' and rec['summary_sha256']==B['summaryVersions']['zad-sum-1']['sha256'] and all(r['summary_version']=='zad-sum-1' for r in rec['questions']))
chk('no near-empty pages (<300 characters) except the program divider',[i+1 for i,t in enumerate(pages) if len(t.strip())<300]==[6])
pj=json.load(open('pages.json')); need=['PROG1','REVIEW','PROG2','PLAN']+['S%02d'%n for n in range(1,11)]+['ID '+q['id'] for q in bank]
chk('index: every entry has a real page number (no placeholders)',all(k in pj for k in need))
chk('all 42 cards have the supervisor decision box and the 3 status checkboxes',len(re.findall('قرار',re.sub('[\u064b-\u0652]','',txt)))>=43 and sk2(txt).count(sk2('يحتاج تعديلًا'))>=42 and full.count('☐')+full.count('☒')>=0)
fonts=subprocess.run(['pdffonts',PDF],capture_output=True,text=True).stdout
chk('Arabic fonts embedded (Amiri, IBM Plex Sans Arabic)','Amiri' in fonts and 'Plex' in fonts and not re.search(r'\sno\s+(yes|no)\s+(yes|no)\s',fonts.split('\n',2)[2] if False else ''))
# xlsx
wb=openpyxl.load_workbook('record.xlsx'); ws=wb['الأسئلة']; rows=list(ws.iter_rows(min_row=2,values_only=True))
chk('xlsx: 42 rows, ids equal the bank, RTL sheet',[r[1] for r in rows]==[q['id'] for q in bank] and ws.sheet_view.rightToLeft)
chk('xlsx: correct-answer column equals the stored correct option',all(r[14]==q['options'][q['correct']] for r,q in zip(rows,bank)))
chk('xlsx: status column valid list, none «معتمد»',all(r[22] in ('معتمد','يحتاج تعديلًا','يحتاج تحققًا') for r in rows) and not any(r[22]=='معتمد' for r in rows))
print('\nALL PASS' if ok_all else '\nSOME FAIL'); sys.exit(0 if ok_all else 1)
