import json,html,csv,collections,re
e=html.escape
AD='٠١٢٣٤٥٦٧٨٩'; ar=lambda n:str(n).translate(str.maketrans('0123456789',AD))
B=json.load(open('../data/question-bank.json',encoding='utf8'))
OLD=json.load(open('question-bank.before-restructure.json',encoding='utf8'))
ORIG=json.load(open('question-bank.before-review.json',encoding='utf8'))
T=json.load(open('timing-comparison.json',encoding='utf8'))
V1=json.load(open('change-log.json',encoding='utf8'))
V2=json.load(open('change-log-restructure.json',encoding='utf8'))
V3=json.load(open('change-log-verses.json',encoding='utf8'))
qs=[q for s in B['sessions'] for q in s['questions']]; byid={q['id']:q for q in qs}
sess_of={q['id']:s['n'] for s in B['sessions'] for q in s['questions']}
arch=B['archivedQuestions']; oldsess={q['id']:s['n'] for s in OLD['sessions'] for q in s['questions']}
bp=B['reviewBlueprint']['objectives']; OBJ={o['id']:o['title'] for o in bp}
prim=dict(zip([o['id'] for o in bp],T['primaries']))
def pgs(q):
    p=sorted(set(q['src'].get('pages',[q['src']['sp']]))); return '–'.join(ar(x) for x in (p if len(p)==1 else [p[0],p[-1]]))
dec=collections.Counter(q['review']['decision'] for q in qs); info=collections.Counter(q['review']['info'] for q in qs)
bl=collections.Counter(q['bloom'] for q in qs); nopt=collections.Counter(len(q['options']) for q in qs)
def pill(t):
    cls={'صالح مبدئيًا':'ok','معدّل':'warn','مدموج':'','سليمة':'ok','معدّلة':'warn','مناسبة':'ok','سليم':'ok','تحتاج تحققًا':'warn'}.get(t,'')
    return f'<span class="pill {cls}">{e(t)}</span>'
# ---------- CSV
HDR=['رقم السؤال','الجلسة','المرجع (صفحة الملخص وموضع المعلومة)','صحة المعلومة','جودة الصياغة','جودة الخيارات','سلامة الشرح','القرار','الملاحظة','الهدف العلمي','مستوى السؤال']
rows=[]
for q in qs:
    r=q['review']; rows.append([q['id'],sess_of[q['id']],f"ملخص زاد العباد ص{pgs(q)} — {q['src']['locus']}",r['info'],r['wording'],r['options'],r['explain'],r['decision'],r['note']+(' | '+r['info_note'] if r['info']!='سليمة' else ''),OBJ[q['objective']],q['bloom']])
for a in arch:
    rows.append([a['id'],oldsess[a['id']],f"ملخص زاد العباد ص{pgs(a)} — {a['src']['locus']}",'—','—','—','—','مدموج',f"دُمج في {a['mergedInto']}: لا يُحتسب ضمن المتبقي ولا المطلوب للإتقان.",OBJ[a['objective']],a['bloom']])
for i,o in enumerate(bp,1):
    p=byid[prim[o['id']]]; rows.append([f"R-{i:02d}",'مراجعة المجموعة ١',f"السؤال الأساسي {p['id']} (ملخص ص{pgs(p)}) · بدائل: {'، '.join(x for x in o['questions'] if x!=p['id']) or '—'}",p['review']['info'],'مناسبة','مناسبة','سليم',p['review']['decision'],f"هدف المراجعة: {o['title']}. الأساسي هو الأقل زمنًا؛ ويُقدَّم ما أُخطئ فيه.",o['title'],p['bloom']])
with open('question-review.csv','w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f); w.writerow(HDR); w.writerows(rows)
# ---------- tables
tb=''.join(f"<tr><td class='mono'>{q['id']}</td><td class='num'>{ar(sess_of[q['id']])}</td><td>ص{pgs(q)}<div class='tiny'>{e(q['src']['locus'])}</div></td><td>{pill(q['review']['info'])}</td><td>{pill(q['review']['wording'])}</td><td>{pill(q['review']['options'])}</td><td>{pill(q['review']['explain'])}</td><td>{pill(q['review']['decision'])}</td><td>{e(q['review']['note'])}{('<div class=tiny>'+e(q['review']['info_note'])+'</div>') if q['review']['info_note'] and q['review']['info']!='سليمة' else ''}{('<div class=tiny>مدموج من: '+'، '.join(q['mergedFrom'])+'</div>') if q.get('mergedFrom') else ''}</td></tr>" for q in qs)
atb=''.join(f"<tr><td class='mono'>{a['id']}</td><td class='num'>{ar(oldsess[a['id']])}</td><td>{e(a['text'])}</td><td class='mono'>{a['mergedInto']}</td><td>{pill('مدموج')}</td></tr>" for a in arch)
rv=''.join(f"<tr><td class='mono'>R-{i:02d}</td><td>{e(o['title'])}</td><td class='mono'>{prim[o['id']]}</td><td class='mono'>{'، '.join(x for x in o['questions'] if x!=prim[o['id']]) or '—'}</td><td class='num'>{ar(len(o['questions']))}</td><td>{byid[prim[o['id']]]['bloom']}</td></tr>" for i,o in enumerate(bp,1))
def cell(v): return f"<td class='num {'bad' if v>180 else ''}'>{ar(v)}</td>"
cmp=''
for b_,a_ in zip(T['before'],T['after']):
    objs='، '.join(OBJ[x] for x in a_['objectives'])
    cmp+=f"<tr><td class='num'>{ar(b_['session'])}</td><td class='num'>{ar(b_['n'])} ← {ar(a_['n'])}</td>{cell(b_['base'][1])}{cell(a_['base'][1])}{cell(b_['slow'][1])}{cell(a_['slow'][1])}<td class='tiny'>{e(objs)}</td></tr>"
trow=''.join(f"<tr><td class='num'>{ar(r['session'])}</td><td class='num'>{ar(r['n'])}</td>{''.join(cell(v) for v in r['fast'])}{''.join(cell(v) for v in r['base'])}{''.join(cell(v) for v in r['slow'])}</tr>" for r in T['after'])
mrow=''.join(f"<tr><td>جلسة مصغّرة {ar(i+1)}</td>{''.join(cell(v) for v in m['fast'])}{''.join(cell(v) for v in m['base'])}{''.join(cell(v) for v in m['slow'])}</tr>" for i,m in enumerate(T['review_minis']))
over_slow25=[r['session'] for r in T['after'] if r['slow'][1]>180]; over_base25=[r['session'] for r in T['after'] if r['base'][1]>180]
verse_q=[q['id'] for q in qs if any(n['k']=='آية' for n in q.get('nass',[]))]
chrows=''
for l in V2['log']: chrows+=f"<tr><td class='mono'>{l['id']}</td><td>{e(l['field'])}</td><td class='tiny'>{e(str(l['before'])[:140])}</td><td class='tiny'>{e(str(l['after'])[:140])}</td><td class='tiny'>{e(l['reason'])}</td></tr>"
for l in V3: chrows+=f"<tr><td class='mono'>{l['id']}</td><td>نص الآية</td><td class='tiny'>{e(l['before'])}</td><td class='tiny'>{e(l['after'])}</td><td class='tiny'>{e(l['reason'])}</td></tr>"
for m_,n_ in V2['merged'].items(): pass
mergelist=''.join(f"<li><span class='mono'>{'، '.join(k for k,v in V2['merged'].items() if v==n)}</span> ← <span class='mono'>{n}</span></li>" for n in sorted(set(V2['merged'].values())))
head=open('../review-report.html',encoding='utf8').read().split('<div class="wrap">')[0]
body=f'''<div class="wrap">
<header class="hero"><small>بَرْد اليقين · المجموعة العشرية الأولى · الإصدار ٢ من المراجعة (بعد قرارات التحسين)</small><h1>تقرير المراجعة العلمية والتربوية والتقنية</h1><p>الروابط: <a style="color:#8FD3C8" href="https://claude.ai/artifact/CXtf9CQvPEuYHwZJPCrExP">النموذج التفاعلي</a> · <a style="color:#8FD3C8" href="https://claude.ai/artifact/7UQVdUAmjcuT3xBc4BaPuy">وثيقة التصميم</a>. جدول الأسئلة ملفًا: <span class="mono" style="color:#8FD3C8">bard-alyaqeen/review/question-review.csv</span></p></header>
<div class="verdict"><h2>القرار: جاهزة للعرض على المشرف العلمي، وغير جاهزة للاعتماد النهائي</h2>
<p>نفّذتُ قرارات التحسين، وأُغلق معظم ما كان معلقًا. وما يمنع الاعتماد النهائي الآن:</p>
<ul class="tight"><li><b>الزمن تقدير لا تجربة:</b> لا تجربة مع طلاب. التقدير يدخل كل الجلسات في ثلاث دقائق بقراءة متوسطة وخطأ ٢٥٪، ويتجاوزها قارئ بطيء في الجلسة {ar(7)} (١٩٥ ثانية).</li>
<li><b>تشكيل الآيات:</b> لم أجد نصًّا مشكولًا رسميًا أستطيع قراءته، فتُعرض الآيات الآن بنص مجمع الملك فهد الإملائي بلا تشكيل بدل تشكيل غير معتمد.</li>
<li><b>الملخص نفسه:</b> يحتاج تصحيح لفظ حديث جبريل (زيادة «وكتبه»). لا يؤثر في الأسئلة لأنها تعرض نصين متحقق منهما.</li>
<li><b>اعتماد المشرف:</b> لا وصف «معتمد علميًا» قبل موافقته، ومنها تفسيرات الكتاب عبر الملخص.</li></ul></div>

<section><h2>١. المقارنة قبل التعديل وبعده</h2>
<div class="grid4"><div class="stat"><b>{ar(sum(x['n'] for x in T['before']))} ← {ar(sum(x['n'] for x in T['after']))}</b><span>الأسئلة الكلية</span></div><div class="stat"><b>٣–٥</b><span>أسئلة كل جلسة (غير متساوية)</span></div><div class="stat"><b>٢٠ / ٢٠</b><span>الأهداف العلمية المغطاة (قبل / بعد)</span></div><div class="stat"><b>{ar(max(r['base'][1] for r in T['after']))} ث</b><span>أطول جلسة تقديرًا (متوسط، خطأ ٢٥٪)، كانت {ar(max(r['base'][1] for r in T['before']))}</span></div></div>
<div class="tw"><table style="min-width:900px"><thead><tr><th rowspan="2" class="num">الجلسة</th><th rowspan="2" class="num">عدد الأسئلة</th><th colspan="2" class="num">الزمن التقديري: قراءة متوسطة، خطأ ٢٥٪ (ث)</th><th colspan="2" class="num">قراءة بطيئة، خطأ ٢٥٪ (ث)</th><th rowspan="2">الأهداف العلمية المغطاة بعد التعديل</th></tr><tr><th class="num">قبل</th><th class="num">بعد</th><th class="num">قبل</th><th class="num">بعد</th></tr></thead><tbody>{cmp}</tbody></table></div>
<p class="tiny">الأحمر ما تجاوز ١٨٠ ثانية. «قبل» هي النسخة المراجعة في التقرير السابق (٥٠ سؤالًا)، وتعرض النص كل مرة. «بعد» تعرض النص الطويل مرة واحدة ويبقى متاحًا للاطلاع. هذه تقديرات حسابية لا نتائج تجربة بشرية.</p>
<h3>الأسئلة المدموجة (١٦ ← ٨)</h3><ul class="tight">{mergelist}</ul>
<p class="lead">كل سؤال مدموج يقيس المفهومين معًا بخيارات تجمعهما، فلم يسقط مفهوم أساسي. نسخ الأسئلة القديمة في <span class="mono">archivedQuestions</span> داخل البنك، ولا تُحتسب في الجلسات ولا المتبقي ولا الإتقان.</p></section>

<section><h2>٢. المسائل العلمية: ما أُغلق وما بقي</h2>
<div class="tw"><table><thead><tr><th>المسألة</th><th>الحالة</th><th>ما تحقق</th></tr></thead><tbody>
<tr><td>اختلاف لفظ حديث جبريل بين الملخص والبخاري ومسلم</td><td><span class="pill ok">أُغلقت في التطبيق</span></td><td>لفظ الملخص («وكتبه» بذلك الترتيب) غير موجود في البخاري ٥٠ ولا مسلم ٩٩. السؤال يعرض لفظ البخاري ولفظ مسلم المتحقق منهما، فلا يتوقف على لفظ الملخص. <b>تبقى</b> مسألة تصحيح الملخص للمشرف.</td></tr>
<tr><td>عزو حديث أنس «البخاري ومسلم»</td><td><span class="pill ok">أُغلقت</span></td><td>في البخاري ١٦ و٦٩٤١ بلفظ الملخص، وفي مسلم ١٦٥ بلفظ قريب («وجد بهن» و«بعد أن أنقذه الله منه»). العزو صحيح.</td></tr>
<tr><td>اللفظ النبوي والنقل بالمعنى في حديث الرجل</td><td><span class="pill ok">أُغلقت</span></td><td>كان المعروض سرد الكتاب. صار المعروض لفظ البخاري ٧٥٠٦ كاملًا (ومسلم ٧٠٠٨ بنحوه) يُعرض مرة واحدة مرجعًا للسؤالين.</td></tr>
<tr><td>الحديث القدسي المقتطع (الجلسة ٨)</td><td><span class="pill ok">أُغلقت</span></td><td>اللفظ الكامل من البخاري ٤٤٨٢ (سابقًا).</td></tr>
<tr><td>حروف الآيات العشر</td><td><span class="pill ok">أُغلقت بمصدر رسمي</span></td><td>طابقتُ كل مقطع ببيانات مجمع الملك فهد لطباعة المصحف الشريف (الحفص الذكي ٨، الحقل الإملائي) ومجموعتين مفتوحتين.</td></tr>
<tr><td>تشكيل الآيات</td><td><span class="pill warn">تعذّر التحقق، فتغيّر العرض</span></td><td>بيانات المجمع المشكولة بترميز الخط الخاص ولا يمكن قراءتها. بدل عرض تشكيل من مصدر مفتوح غير معتمد عرضتُ نص المجمع الإملائي بلا تشكيل. والتشكيل المقترح محفوظ للمراجع في الحقل <span class="mono">tm</span> ويظهر في «وضع المراجع» فقط.</td></tr>
<tr><td>الأسئلة الخمسة التي كانت تحتاج تحققًا (s1q3، s7q1، s7q2، s10q3، s10q4)</td><td><span class="pill ok">أُغلقت مسائلها</span></td><td>أُغلقت المسائل الأربع المذكورة أعلاه. لم يُعلَّق منها سؤال لأن كلًّا منها يعرض الآن نصًّا متحققًا منه. يبقى اعتماد المشرف لتفسيرات الكتاب (معنى «لم يعمل خيرًا قط»، وتعليل فعل الرجل).</td></tr>
<tr><td>أسئلة في حالة «معلق للمراجعة العلمية»</td><td><span class="pill ok">لا يوجد</span></td><td>لا سؤال معلق حاليًا. والآلية موجودة: أي سؤال بحالة معلق أو مستبعد لا يدخل الجلسات.</td></tr>
</tbody></table></div>
<div class="callout warn">إن رأيتَ أن عدم توفر تشكيل رسمي يوجب تعليق الأسئلة التي فيها آيات، فهي {ar(len(verse_q))} سؤالًا: {', '.join(verse_q)}. تعليقها يترك الجلستين ٥ و٩ بسؤالين لكل منهما، وهو دون الحد الأدنى (٣)، فلم أفعل ذلك.</div></section>

<section><h2>٣. التحقق من الآيات والأحاديث (تحديث)</h2>
<div class="tw"><table><thead><tr><th>الحديث</th><th>الأسئلة</th><th>المصدر المطابق</th><th>النتيجة</th></tr></thead><tbody>
<tr><td>لفظ البخاري لحديث جبريل</td><td class="mono">s1q3</td><td>البخاري ٥٠ (أبو هريرة)</td><td>{pill('سليمة')} مخالف للفظ الملخص</td></tr>
<tr><td>رواية مسلم لحديث جبريل</td><td class="mono">s1q3</td><td>مسلم ٩٩ (أبو هريرة)</td><td>{pill('سليمة')} فيها «وكتابه» و«وتؤمن بالقدر كله»</td></tr>
<tr><td>شعب الإيمان</td><td class="mono">s3q3, s3q4, s4q3</td><td>مسلم ١٥٣</td><td>{pill('سليمة')} «واللفظ له» لمسلم</td></tr>
<tr><td>التحاب</td><td class="mono">s5q1, s5q2</td><td>مسلم ١٩٤</td><td>{pill('سليمة')}</td></tr>
<tr><td>تغيير المنكر</td><td class="mono">s6m1, s6q4</td><td>مسلم ١٧٧ (أبو سعيد)</td><td>{pill('سليمة')}</td></tr>
<tr><td>حلاوة الإيمان</td><td class="mono">s7q1, s7q2</td><td>البخاري ١٦ و٦٩٤١، ومسلم ١٦٥ بلفظ قريب</td><td>{pill('سليمة')} العزو صحيح</td></tr>
<tr><td>طعم الإيمان</td><td class="mono">s7q3</td><td>مسلم ١٥١ (العباس)</td><td>{pill('سليمة')}</td></tr>
<tr><td>الحديث القدسي</td><td class="mono">s8m1</td><td>البخاري ٤٤٨٢ (ابن عباس)</td><td>{pill('سليمة')} اللفظ كامل</td></tr>
<tr><td>حديث العزل</td><td class="mono">s9m2</td><td>البخاري ٧٤٠٩، ومسلم ٣٥٥٣</td><td>{pill('سليمة')}</td></tr>
<tr><td>حديث الرجل</td><td class="mono">s10q3, s10q4</td><td>البخاري ٧٥٠٦ (ومسلم ٧٠٠٨)</td><td>{pill('سليمة')} لفظ البخاري كاملًا</td></tr>
</tbody></table></div>
<p class="tiny">الأرقام فهارس مجموعات fawazahmed0/hadith-api المفتوحة (ara-bukhari، ara-muslim)، وليست ترقيم طبعة بعينها. مطابقة الطبعات المعتمدة للمشرف.</p></section>

<section><h2>٤. مراجعة الأسئلة (٤٢ سؤالًا) والمراجعة الشاملة</h2>
<div class="grid4"><div class="stat"><b>{ar(dec.get('صالح مبدئيًا',0))}</b><span>صالح مبدئيًا</span></div><div class="stat"><b>{ar(dec.get('معدّل',0))}</b><span>معدّل</span></div><div class="stat"><b>٠</b><span>معلق للمراجعة العلمية</span></div><div class="stat"><b>٠</b><span>مستبعد (و١٦ مدموجة)</span></div></div>
<div class="tw"><table style="min-width:980px"><thead><tr><th>السؤال</th><th class="num">الجلسة</th><th>المرجع</th><th>صحة المعلومة</th><th>الصياغة</th><th>الخيارات</th><th>الشرح</th><th>القرار</th><th>الملاحظة</th></tr></thead><tbody>{tb}</tbody></table></div>
<h3>الأسئلة المدموجة (لا تُحتسب)</h3>
<div class="tw"><table><thead><tr><th>السؤال القديم</th><th class="num">الجلسة</th><th>نصه</th><th>دُمج في</th><th>القرار</th></tr></thead><tbody>{atb}</tbody></table></div>
<h3>أسئلة المراجعة العشرين: سؤال لكل هدف علمي</h3>
<div class="tw"><table><thead><tr><th>الفتحة</th><th>الهدف العلمي</th><th>الأساسي (الأقل زمنًا)</th><th>البدائل</th><th class="num">أسئلة الهدف</th><th>المستوى</th></tr></thead><tbody>{rv}</tbody></table></div>
<ul class="tight"><li>تغطي المراجعة الأهداف العشرين كلها كما كانت قبل الدمج، ولم يسقط هدف. وصار لهدفين أو أكثر سؤال واحد فقط بعد الدمج، فتقل أسئلة التناوب عليها.</li>
<li>يُقدَّم ما أخطأ فيه الطالب أولًا، وإلا يُختار الأقل زمنًا ثم يُدار عند تكرار المراجعة. وتُوزَّع على أربع جلسات مصغّرة متوازنة الزمن.</li>
<li>تقدير جلسات المراجعة الأربع في الجدول التالي، وهي بين {ar(min(m['base'][1] for m in T['review_minis']))} و{ar(max(m['base'][1] for m in T['review_minis']))} ثانية للقارئ المتوسط.</li></ul></section>

<section><h2>٥. ملاءمة المدة (تقدير)</h2>
<div class="callout stop"><b>تنبيه:</b> أرقام هذا القسم من نموذج حسابي، ولم تُجرَّب الجلسات مع طلاب. لا تُعدّ بديلًا عن التجربة الفعلية.</div>
<p class="lead">النموذج: وقت قراءة السؤال والنص والخيارات بسرعة محددة، وثانية وربع لكل خيار، وثلاث ثوانٍ للنقر، وثانيتان لتأكيد الصواب. وعند الخطأ يُضاف زمن قراءة الشرح ثم إعادة السؤال بنسبة ٥٥٪ من زمن قراءته الأول. يُحسب النص الطويل مرة واحدة في الجلسة لأنه يُعرض مرة ويبقى مرجعًا. السرعات: ١٧٠ و١٣٠ (متوسطة) و١٠٠ كلمة في الدقيقة. نسب الخطأ: ٠٪ و٢٥٪ و٤٠٪.</p>
<div class="tw"><table style="min-width:760px"><thead><tr><th rowspan="2" class="num">الجلسة</th><th rowspan="2" class="num">الأسئلة</th><th colspan="3" class="num">سريع (١٧٠)</th><th colspan="3" class="num">متوسط (١٣٠)</th><th colspan="3" class="num">بطيء (١٠٠)</th></tr><tr><th class="num">٠٪</th><th class="num">٢٥٪</th><th class="num">٤٠٪</th><th class="num">٠٪</th><th class="num">٢٥٪</th><th class="num">٤٠٪</th><th class="num">٠٪</th><th class="num">٢٥٪</th><th class="num">٤٠٪</th></tr></thead><tbody>{trow}</tbody></table></div>
<h3>جلسات المراجعة المصغّرة الأربع</h3>
<div class="tw"><table style="min-width:760px"><thead><tr><th>الجلسة</th><th class="num">سريع ٠٪</th><th class="num">٢٥٪</th><th class="num">٤٠٪</th><th class="num">متوسط ٠٪</th><th class="num">٢٥٪</th><th class="num">٤٠٪</th><th class="num">بطيء ٠٪</th><th class="num">٢٥٪</th><th class="num">٤٠٪</th></tr></thead><tbody>{mrow}</tbody></table></div>
<ul class="tight"><li><b>الخلاصة:</b> بقراءة متوسطة وخطأ ٢٥٪ تقع الجلسات العشر كلها داخل ثلاث دقائق (الأطول {ar(max(r['base'][1] for r in T['after']))} ثانية). وبقراءة بطيئة تتجاوزها {ar(len(over_slow25))} جلسة ({', '.join(ar(x) for x in over_slow25) or '—'}). ومع خطأ ٤٠٪ تتجاوزها عدة جلسات للبطيء.</li>
<li><b>ثمن الدمج:</b> الأسئلة المدموجة خياراتها أطول، فلا يوفر الدمج الزمن وحده. الوفر الأكبر من عرض النص مرة واحدة. جرّبتُ حساب الجلسة ٧ بلا دمج s7q4 وs7q5 فكانت أبطأ، فأبقيتُ الدمج.</li>
<li><b>الجلسة ٧:</b> هي الوحيدة التي تتجاوز ثلاث دقائق للقارئ البطيء بخطأ ٢٥٪ (١٩٥ ثانية). الخيارات: (أ) إبقاؤها، فلا يضيع التقدم عند انتهاء الوقت؛ (ب) تقصير خيارات s7m1؛ (ج) إعادة توزيع مادة الجلسة بإضافة جلسة، وهي تغيّر حجم المجموعة فلم أنفذها. أقترح (أ) ثم قياس الزمن بتجربة مغلقة.</li>
<li><b>الهاتف:</b> على ٣٩٠×٨٠٠ يحتاج ٤ أسئلة من ٤٢ إلى تمرير لرؤية آخر خيار، وعلى ٣٦٠×٦٤٠ يحتاجه ١٩. وزر المتابعة ثابت في كل الحالات، ولا تمرير أفقيًا.</li></ul></section>

<section><h2>٦. مؤشرات التقدم بعد تغيير عدد الأسئلة</h2>
<div class="tw"><table><thead><tr><th>المؤشر</th><th>التحقق</th></tr></thead><tbody>
<tr><td>الجلسات المكتملة، وتقدم المجموعة (x من ١٠)</td><td><span class="pill ok">نجح</span> مستقلان عن عدد أسئلة الجلسة</td></tr>
<tr><td>الأسئلة المتبقية في الجلسة</td><td><span class="pill ok">نجح</span> يظهر في رأس الجلسة ويتناقص، وتحسب الإعادات مرة واحدة</td></tr>
<tr><td>حالة الجلسات غير المكتملة</td><td><span class="pill ok">نجح</span> جلسة ٩ (٣ أسئلة): بعد الانتهاء المبكر يُحفظ سؤالان وتبقى غير مكتملة بعد إعادة فتح الصفحة</td></tr>
<tr><td>الصواب من المحاولة الأولى، والإتقان بعد المراجعة</td><td><span class="pill ok">نجح</span> يُحسبان من الأسئلة الحالية وحدها</td></tr>
<tr><td>ترحيل تقدم محفوظ بالأسئلة القديمة</td><td><span class="pill ok">نجح</span> جلسة قيد التنفيذ تفقد المعرّفات المدموجة وتُضاف إليها الأسئلة الجديدة، وجلسة مكتملة تبقى مكتملة، وتُحذف سجلات الإتقان للأسئلة المحذوفة</td></tr>
<tr><td>سؤال محذوف أو مدمج</td><td><span class="pill ok">نجح</span> لا يدخل المتبقي ولا المطلوب للإتقان</td></tr>
</tbody></table></div>
<p class="tiny">حد معروف: الرسم البياني اليومي (الجلسات والمحاولة الأولى) يحتفظ بأعداد الأيام السابقة كما سُجلت، فقد تتضمن أسئلة دُمجت لاحقًا. ولا يدخل ذلك في أي شرط إنجاز أو إتقان.</p></section>

<section><h2>٧. الاختبارات</h2>
<p class="lead">آلية بمتصفح Chromium. نجاحها يدل على سلامة البرمجة لا على جودة التعلم ولا صحة المحتوى.</p>
<div class="tw"><table><thead><tr><th>الاختبار</th><th>النتيجة</th></tr></thead><tbody>
<tr><td>المسار الكامل للمجموعة (١٠ جلسات غير متساوية، خروج وعودة، المراجعة الشاملة، فتح التالية)، وتغطية الأهداف العشرين، وإدراج الأخطاء، وتوازن زمن الجلسات المصغّرة</td><td><span class="pill ok">٣٥ فحصًا نجح</span></td></tr>
<tr><td>هيكل البنك (٣–٥ أسئلة، ٤٢ سؤالًا)، النص المشترك (يُعرض كاملًا ثم مرجعًا قابلًا للفتح، ويبقى في شاشة الخطأ)، المتبقي، انتهاء الوقت وحفظ الأسئلة، ترحيل الحالة، التقدير ≤ ١٨٠ ث</td><td><span class="pill ok">١٨ فحصًا نجح</span></td></tr>
<tr><td>قراءة صفحات الملخص (لا أثر ولا تسجيل)</td><td><span class="pill ok">٢٣ فحصًا نجح</span></td></tr>
<tr><td>بقية الوظائف (بطاقة الكتاب، المراجعة، المؤشرات...)</td><td><span class="pill ok">٣٠ فحصًا نجح</span></td></tr>
<tr><td>التخطيط: الأسئلة الاثنان والأربعون وشاشات خطئها بعرضين وفي الوضعين الفاتح والداكن</td><td><span class="pill ok">لا تمرير أفقي، ولا نص مخفي، ولا رقم صفحة خارج العناصر الاختيارية</span></td></tr>
<tr><td>خلل اكتُشف وأُصلح أثناء الاختبار: معرّفات الأسئلة المدموجة (s7m1) لم تُقرأ جلستها، فتعطلت شاشة السؤال</td><td><span class="pill ok">أُصلح وأُضيف له اختبار</span></td></tr>
</tbody></table></div>
<div class="callout warn"><b>لم يُختبر:</b> جهاز iOS أو Android حقيقي، وقارئ الشاشة، وأي تجربة مع طلاب. والجلسات ٤–١٠ نُفِّذت عبر الواجهة بأجوبة آلية.</div></section>

<section><h2>٨. سجل التغييرات</h2>
<p class="lead">نسخة البنك قبل هذه المرحلة: <span class="mono">review/question-bank.before-restructure.json</span>. وقبل المراجعة الأولى: <span class="mono">question-bank.before-review.json</span>. السجلات: <span class="mono">change-log.json</span> (المراجعة الأولى، {ar(len(V1))} تعديلًا)، <span class="mono">change-log-restructure.json</span>، <span class="mono">change-log-verses.json</span>.</p>
<div class="tw"><table style="min-width:900px"><thead><tr><th>السؤال</th><th>الحقل</th><th>قبل</th><th>بعد</th><th>السبب</th></tr></thead><tbody>{chrows}</tbody></table></div></section>

<section><h2>٩. المسائل التي لا تزال معلقة</h2>
<div class="tw"><table><thead><tr><th class="num">#</th><th>المسألة</th><th>من يقرر</th></tr></thead><tbody>
<tr><td class="num">١</td><td>تصحيح لفظ حديث جبريل في الملخص نفسه (زيادة «وكتبه»).</td><td>المشرف</td></tr>
<tr><td class="num">٢</td><td>تشكيل الآيات: أعرضها الآن بلا تشكيل من نص المجمع الإملائي. هل يُضاف التشكيل بعد أن يؤكده المشرف بمصحف المدينة؟</td><td>المشرف</td></tr>
<tr><td class="num">٣</td><td>مطابقة الأحاديث بالطبعات المعتمدة بدل المجموعات المفتوحة.</td><td>المشرف</td></tr>
<tr><td class="num">٤</td><td>اعتماد تفسيرات الكتاب: «لم يعمل خيرًا قط»، وتعليل فعل الرجل، وغيرها.</td><td>المشرف</td></tr>
<tr><td class="num">٥</td><td>الخيارات الخاطئة المبتكرة (نقيض بسيط لما قرره الملخص) تُعرض للطالب فتُراجَع.</td><td>المشرف</td></tr>
<tr><td class="num">٦</td><td>الجلسة ٧: ١٩٥ ثانية تقديرًا لقارئ بطيء. إبقاء أم إعادة توزيع (تغيير حجم المجموعة)؟</td><td>أنت</td></tr>
<tr><td class="num">٧</td><td>تجربة مغلقة مع طلاب لقياس الزمن الفعلي وفهم الأسئلة المدموجة (خياراتها أطول).</td><td>أنت</td></tr>
<tr><td class="num">٨</td><td>أهداف كثيفة (١٦ و١٩ و٢٠) بسؤال واحد في المراجعة: هل ترفع إلى ٢٤؟</td><td>أنت</td></tr>
<tr><td class="num">٩</td><td>صفحات الكتاب الأصلي وروابط الكتابين.</td><td>أنت</td></tr>
<tr><td class="num">١٠</td><td>الحقوق قبل أي نشر عام (قرارك السابق).</td><td>أنت</td></tr>
</tbody></table></div></section>

<section><h2>الجواب النهائي</h2>
<div class="verdict"><p><b>المجموعة العشرية الأولى جاهزة للعرض على المشرف العلمي، ولا تزال غير جاهزة للاعتماد النهائي.</b> الأدلة: أُغلقت مسائل النصوص الشرعية الأربع، ونُفّذت قرارات الأسئلة المرنة (٤٢ سؤالًا بين ٣ و٥ لكل جلسة) بلا فقد هدف علمي، وكل الجلسات داخل ثلاث دقائق تقديرًا للقارئ المتوسط. ويمنع الاعتماد: غياب تشكيل رسمي، وغياب تجربة بشرية للزمن، وبقاء اعتماد المشرف. لم أنتقل إلى الجلسة ١١ ولا إلى المجموعة الثانية، ولم أدمج الفرع في main.</p></div></section>
</div>'''
open('../review-report.html','w',encoding='utf8').write(head+body)
print(len(head+body),dec,info,bl,nopt,over_slow25,over_base25)
