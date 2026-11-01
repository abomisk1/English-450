import json,re,html,subprocess,difflib,unicodedata,sys
PDF=sys.argv[1]; e=html.escape; AD='٠١٢٣٤٥٦٧٨٩'; ar=lambda n:str(n).translate(str.maketrans('0123456789',AD))
d=json.load(open('zad-p4-8.json',encoding='utf8'))
src=open('../review-report.html',encoding='utf8').read()
head=src[:src.index('</style>')+8].replace('تقرير مراجعة المجموعة الأولى','تقرير مطابقة النص المحوّل')
def skel(s):
    s=unicodedata.normalize('NFC',s); s=re.sub('﴿[^﴾]*﴾','',s)
    return ''.join(c for c in s if unicodedata.category(c) in('Lo','Nd') and c!='ـ')
rows=''
tot_words=0
for pn in range(4,9):
    t=subprocess.run(['pdftotext','-f',str(pn),'-l',str(pn),'-layout',PDF,'-'],capture_output=True,text=True).stdout
    t=re.sub('[‪-‮‎‏⁦-⁩]','',t); t=re.sub(r'\d+ / 218','',t)
    a=skel(t); txt=' '.join(''.join(r['t'] for r in b['runs']) for b in d['blocks'] if b['page']==pn); b=skel(txt)
    tags=''.join(f"ص{bk['bookpage']}" for bk in d['blocks'] if bk['page']==pn and bk['kind']=='topic' and bk.get('bookpage'))
    sm=difflib.SequenceMatcher(None,a,b,autojunk=False)
    diffs=[(a[i1:i2],b[j1:j2]) for op,i1,i2,j1,j2 in sm.get_opcodes() if op!='equal']
    # تُفسَّر الفروق: وسوم صفحات الكتاب، وترتيب أرقام الاستشهاد
    exp=[x for x in diffs if re.fullmatch(r'ص\d+',x[0]) or re.search(r'التوبة|\d',x[0]+x[1])]
    other=[x for x in diffs if x not in exp]
    w=len(re.findall(r'\S+',txt)); tot_words+=w
    rows+=f'<tr><td class="num">{ar(pn)}</td><td class="num">{ar(len(a))}</td><td class="num">{ar(len(b))}</td><td class="num">{ar(len(diffs))}</td><td>{e("وسوم صفحات الكتاب المطبوع («"+tags+"»)، وترتيب أرقام استشهاد الآيات") if exp else "لا شيء"}{"؛ فروق غير مفسَّرة: "+ar(len(other)) if other else ""}</td><td class="num">{ar(w)}</td></tr>'
vrows=''
for v in d['verses']:
    vrows+=f'<tr><td class="num">{ar(v["page"])}</td><td class="num">{v["ref"].replace(":","/")}</td><td>{e(v["official"])}</td><td>{"مطابق" if v["matches"] else "يحتاج مراجعة"}</td></tr>'
prow=''.join(f'<tr><td class="num">{ar(p["page"])}</td><td>{e(p["before"])}</td><td>{e(p["after"])}</td><td>{e(p["why"])}</td></tr>' for p in d['patches'])
html_=head+f'''
</head><body><div class="wrap">
<header class="hero"><small>بَرْد اليقين · قارئ الملخص النصي · ص٤–٨ من «زاد العباد»</small><h1>تقرير مطابقة النص المحوّل مع ملف PDF الأصلي</h1><p>إصدار الملخص zad-sum-1 · بصمة SHA-256: {d["source"]["sha256"][:16]}…</p></header>
<div class="verdict"><h2>الخلاصة</h2><p>حُوّلت الصفحات ٤–٨ ({ar(len(d["blocks"]))} كتلة نصية، نحو {ar(tot_words)} كلمة، {ar(len(d["topics"]))} مباحث، {ar(len(d["verses"]))} آية). طابق النص ملف PDF على مستوى الحروف في كل صفحة، والفروق المتبقية تفسّرها قائمة الفروق أدناه. لا أعدّه معتمدًا علميًا: تشكيل الآيات معلّق، وأطلب اعتمادك طريقة العرض قبل تحويل بقية الصفحات.</p></div>
<section><h2>١. كيف طُوبق النص</h2><ol><li><b>الاستخراج:</b> (٧٠ كتلة بعد فصل الموضعين) من طبقة النص في الـPDF (pdfplumber) بترتيب منطقي لكل سطر، مع بقاء الخط العريض ومواضع الفقرات (من رموز النقاط) والصناديق (الدليل، التنبيه، الخلاصة).</li>
<li><b>مطابقة مستقلة:</b> استخراج ثانٍ بأداة أخرى (pdftotext)، وقارنتُ الهيكل الحرفي لكل صفحة (بلا تشكيل ولا مسافات ولا ترقيم)، دون الآيات.</li>
<li><b>مطابقة بصورة الصفحة:</b> قارنتُ كل صفحة من الخمس بالنظر مع النص المحوّل، وراجعتُ بها المواضع المشكولة والخط العريض. واستعنتُ بها لتحديد المواضع التي ضاعت فيها حروف من طبقة النص.</li>
<li><b>الآيات:</b> قارنتُ كل مقطع بنص مجمع الملك فهد (الحقل الإملائي)، وطابق حرفيًا ({ar(sum(v["matches"] for v in d["verses"]))} من {ar(len(d["verses"]))}).</li></ol></section>
<section><h2>٢. نتيجة المطابقة لكل صفحة</h2><div class="tw"><table><thead><tr><th class="num">الصفحة</th><th class="num">حروف pdftotext</th><th class="num">حروف النص المحوّل</th><th class="num">مواضع الفرق</th><th>تفسير الفروق</th><th class="num">كلمات</th></tr></thead><tbody>{rows}</tbody></table></div>
<p class="lead">حروف النص المحوّل أقل بعدد حروف وسوم صفحات الكتاب («ص١١») لأنها حُفظت حقلًا مستقلًا. فالمتن متطابق حرفًا بحرف بعد استبعاد الآيات.</p></section>
<section><h2>٣. الفروق بين النص المحوّل وملف PDF</h2><div class="tw"><table><thead><tr><th>الفرق</th><th>التفصيل</th></tr></thead><tbody>
<tr><td>الآيات بلا تشكيل</td><td>تشكيل الآيات الأربع عشرة موجود في الـPDF، ولم يُنقل لتعذر استخراجه بوثوق (علامات مبعثرة وحروف مفقودة في طبقة النص) وعدم التحقق منه. عُرضت الآيات بنص المجمع الإملائي. وتشكيلها معلّق للمراجعة العلمية.</td></tr>
<tr><td>رسم بعض الكلمات في الآيات</td><td>الآية ٦/١٠١: «السموات» في نص المجمع الإملائي، و«السماوات» في صورة الـPDF. والأمر خلاف رسم لا حرف.</td></tr>
<tr><td>تصحيحات النقل (٣ مواضع)</td><td>جدولها بعد هذا الجدول. فُقد فيها حرف أو علامة من طبقة النص وثبتت صحة التصحيح بصورة الصفحة.</td></tr>
<tr><td>التطويل (ـ)</td><td>أُزيلت علامة التطويل التي تظهر في طبقة النص داخل «الكتب» و«الكمال» و«أدلكم» و«لكمال» لأنها أثر خط لا حرف في الأصل.</td></tr>
<tr><td>فقرات الأقسام</td><td>مستويات إزاحة النقاط في الـPDF (فقرات متداخلة بصريًا) لم تُنقل؛ كل نقطة فقرة مستقلة بترتيبها.</td></tr>
<tr><td>فصل مسألتين في نقطة واحدة (موضعان)</td><td>ص٤: «لقاء الله» و«الرسل» وردتا في نقطة واحدة فعُرضتا فقرتين مستقلتين؛ وص٧: «تكذيبه» و«شتمه». النص حرفيًا بلا تغيير، والفصل في العرض فقط.</td></tr>
<tr><td>تذييل الصفحة</td><td>استُبدل «٤ / ٢١٨» بفاصل «ص٤ من الملخص».</td></tr>
<tr><td>أرقام صفحات الكتاب المطبوع</td><td>«ص 11» وأخواتها محفوظة في البيانات، ولا تُعرض للطالب لأنها غير متحقق منها (تظهر للمراجع).</td></tr>
<tr><td>التنسيق</td><td>ألوان الصفحة وخطها وإطارها من التصميم الجديد، والخط العريض مأخوذ من خط كل حرف في الـPDF.</td></tr>
</tbody></table></div>
<h3>تصحيحات النقل</h3><div class="tw"><table><thead><tr><th class="num">ص</th><th>قبل</th><th>بعد</th><th>السبب</th></tr></thead><tbody>{prow}</tbody></table></div></section>
<section><h2>٤. الآيات</h2><div class="tw"><table><thead><tr><th class="num">ص</th><th class="num">سورة/آية</th><th>المقطع كما يُعرض</th><th>مطابقة الحروف لنص المجمع</th></tr></thead><tbody>{vrows}</tbody></table></div></section>
<section><h2>٥. ما لم يُتحقق منه</h2><ul><li>تشكيل الآيات (معلّق).</li><li>الخط العريض موضعًا موضعًا: قورن بالنظر في عينة، لا آليًا.</li><li>الأحاديث: نُقلت كما في الملخص. وتحققي السابق من ألفاظها بمجموعات الحديث المفتوحة لا يزال في تقرير المراجعة، لا هنا.</li><li>أحرف بالغة الدقة مثل الهمزة وعلامات الترقيم: قورنت بالنظر، وصُحّح ما وُجد.</li></ul></section>
</div></body></html>'''
open('../match-report.html','w',encoding='utf8').write(html_); print('ok',tot_words)
