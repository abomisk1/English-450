import json,collections
P=json.load(open('_pieces.json',encoding='utf8'))
B=json.load(open('../data/question-bank.json',encoding='utf8'))
OLD=json.load(open('question-bank.before-review.json',encoding='utf8'))
AD='٠١٢٣٤٥٦٧٨٩'; ar=lambda n:str(n).translate(str.maketrans('0123456789',AD))
qs=[q for s in B['sessions'] for q in s['questions']]
two=[q['id'] for q in qs if len(q['options'])==2]
cue=[q['id'] for q in qs if len(q['options'][0].split())>max(len(o.split()) for o in q['options'][1:])*1.5]
old_two=sum(1 for s in OLD['sessions'] for q in s['questions'] if len(q['options'])==2)
old_cue=sum(1 for s in OLD['sessions'] for q in s['questions'] if len(q['options'][0].split())>max(len(o.split()) for o in q['options'][1:])*1.5)
dec=P['dec']; info=P['info']
css=open('../review/report.css',encoding='utf8').read() if False else ''
html=f'''<title>تقرير مراجعة المجموعة الأولى</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Amiri:wght@400;700&display=swap">
<style>
/* Layout concept: an audit report — verdict first, evidence tables after, one column with wide tables scrolling inside their own boxes. */
:root{{--bg:#EAF0ED;--surface:#FAFCFB;--surface-2:#DFE9E6;--ink:#0D2829;--ink-2:#4A6362;--line:#CCDBD7;--brand:#0C6A62;--brand-soft:#D3EAE5;--night:#14304A;--night-ink:#EAF2F7;--gold:#A9781F;--gold-soft:#F1E6CC;--ok:#2A7B58;--ok-soft:#D9EFE3;--redo:#BE4F3A;--redo-soft:#F5DBD4;--font-ui:"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;--font-display:"Amiri","Traditional Arabic",serif}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#081415;--surface:#112527;--surface-2:#183033;--ink:#E5F0EE;--ink-2:#9BB5B2;--line:#25403F;--brand:#4CC0B1;--brand-soft:#133836;--night:#0E2236;--night-ink:#E4EEF5;--gold:#DCAE55;--gold-soft:#3A2F17;--ok:#5DC796;--ok-soft:#153A2A;--redo:#EE8B74;--redo-soft:#43221B;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#081415;--surface:#112527;--surface-2:#183033;--ink:#E5F0EE;--ink-2:#9BB5B2;--line:#25403F;--brand:#4CC0B1;--brand-soft:#133836;--night:#0E2236;--night-ink:#E4EEF5;--gold:#DCAE55;--gold-soft:#3A2F17;--ok:#5DC796;--ok-soft:#153A2A;--redo:#EE8B74;--redo-soft:#43221B;color-scheme:dark}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font-ui);font-size:15.5px;line-height:1.8;direction:rtl;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:20px 60px;font-variant-numeric:tabular-nums}}
.wrap{{max-width:900px;margin-inline:auto;display:flex;flex-direction:column;gap:26px}}
h1,h2,h3,p,ul,ol{{margin:0}}
a{{color:var(--brand);font-weight:600}}
.hero{{background:var(--night);color:var(--night-ink);border-radius:22px;padding:24px 22px;display:flex;flex-direction:column;gap:10px}}
.hero small{{color:#9FC0CF}}
.hero h1{{font-size:30px;line-height:1.4;text-wrap:balance}}
.verdict{{border:2px solid var(--gold);background:var(--gold-soft);border-radius:18px;padding:16px 18px;display:flex;flex-direction:column;gap:8px}}
.verdict h2{{font-size:21px}}
section{{display:flex;flex-direction:column;gap:12px}}
h2{{font-size:23px;line-height:1.4;text-wrap:balance}}
h3{{font-size:17px;margin-top:4px}}
.lead{{color:var(--ink-2)}}
.card{{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:6px}}
.grid4{{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}}
@media (max-width:640px){{.grid4{{grid-template-columns:1fr 1fr}}}}
.stat{{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px 12px}}
.stat b{{display:block;font-size:26px;line-height:1.2}}
.stat span{{font-size:12.5px;color:var(--ink-2)}}
.tw{{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface)}}
table{{border-collapse:collapse;width:100%;min-width:640px;font-size:13.5px;line-height:1.65}}
th,td{{padding:8px 10px;text-align:start;border-bottom:1px solid var(--line);vertical-align:top}}
th{{background:var(--surface-2);font-weight:600;font-size:12.5px}}
tr:last-child td{{border-bottom:0}}
td.num,th.num{{text-align:center;white-space:nowrap}}
td.bad{{background:var(--redo-soft);color:var(--redo);font-weight:700}}
.mono{{font-family:ui-monospace,Menlo,Consolas,monospace;direction:ltr;unicode-bidi:isolate;font-size:12px;white-space:nowrap}}
.tiny{{font-size:12px;color:var(--ink-2)}}
.pill{{display:inline-block;border-radius:999px;padding:0 9px;font-size:12px;background:var(--surface-2);color:var(--ink-2);white-space:nowrap}}
.pill.ok{{background:var(--ok-soft);color:var(--ok)}}.pill.warn{{background:var(--gold-soft);color:var(--gold)}}.pill.redo{{background:var(--redo-soft);color:var(--redo)}}
td.aya{{font-family:var(--font-display);font-size:18px;line-height:2}}
.callout{{border-inline-start:4px solid var(--brand);background:var(--brand-soft);border-radius:10px;padding:10px 14px;font-size:14.5px}}
.callout.warn{{border-color:var(--gold);background:var(--gold-soft)}}
.callout.stop{{border-color:var(--redo);background:var(--redo-soft)}}
ul.tight,ol.tight{{padding-inline-start:22px;display:flex;flex-direction:column;gap:4px}}
</style>
<div class="wrap">
<header class="hero"><small>بَرْد اليقين · مراجعة المجموعة العشرية الأولى (١٠ جلسات · ٥٠ سؤالًا · مراجعة شاملة من ٢٠ سؤالًا)</small><h1>تقرير المراجعة العلمية والتربوية والتقنية</h1><p>النموذج: <a style="color:#8FD3C8" href="https://claude.ai/artifact/CXtf9CQvPEuYHwZJPCrExP">النموذج التفاعلي</a> · <a style="color:#8FD3C8" href="https://claude.ai/artifact/7UQVdUAmjcuT3xBc4BaPuy">وثيقة التصميم</a>. الجداول الكاملة أيضًا ملفًا في المستودع: <span class="mono" style="color:#8FD3C8">bard-alyaqeen/review/question-review.csv</span></p></header>

<div class="verdict"><h2>القرار: جاهزة للعرض على المشرف العلمي، وغير جاهزة للاعتماد النهائي</h2>
<p>أنهيتُ مراجعة الأسئلة الخمسين كلها وأسئلة المراجعة العشرين، وأصلحتُ ما تأكد لي أنه خلل، وتحققتُ من نصوص الآيات والأحاديث بمصادر مفتوحة. لكن شروطًا من معايير القبول لم تتحقق بعد، ولا يصح وصف أي سؤال بأنه معتمد قبل موافقة المشرف العلمي المخول:</p>
<ul class="tight"><li><b>خلل في المصدر نفسه:</b> الملخص أورد لفظ البخاري لحديث جبريل بزيادة «وكتبه» وبترتيب لا يوافق لفظ البخاري ٥٠. عرضتُ النص المتحقق منه، وبقي قرار اعتماد لفظ الملخص أو لفظ البخاري للمشرف.</li>
<li><b>مصادر التحقق مفتوحة وليست رسمية:</b> قارنتُ الآيات بمجموعتين مفتوحتين على GitHub، والأحاديث بمجموعتي البخاري ومسلم المفتوحتين، فلم أطابق التشكيل بمصحف المدينة ولا بطبعات الأحاديث.</li>
<li><b>زمن الجلسات تقدير حسابي فقط:</b> لم تُجرَّب الجلسات مع طلاب. والتقدير يتجاوز ثلاث دقائق في الجلستين ٧ و٨ بقراءة متوسطة ونسبة خطأ ٢٥٪، وفي سبع جلسات بقراءة بطيئة.</li>
<li><b>خمسة أسئلة صحتها مفتوحة:</b> انظر «المسائل المعلقة».</li></ul></div>

<section><h2>الملخص التنفيذي</h2>
<div class="grid4"><div class="stat"><b>{ar(dec.get('صالح مبدئيًا',0))}</b><span>صالح مبدئيًا بلا تعديل</span></div><div class="stat"><b>{ar(dec.get('معدّل',0))}</b><span>معدّل (صياغة أو خيارات أو نص)</span></div><div class="stat"><b>{ar(dec.get('معلق',0))}</b><span>معلق</span></div><div class="stat"><b>{ar(dec.get('مستبعد',0))}</b><span>مستبعد</span></div></div>
<div class="grid4"><div class="stat"><b>{ar(info.get('سليمة',0))}</b><span>معلومتها سليمة وفق الملخص</span></div><div class="stat"><b>{ar(info.get('تحتاج تحققًا',0))}</b><span>معلومتها تحتاج تحققًا</span></div><div class="stat"><b>٠</b><span>معلومتها غير سليمة</span></div><div class="stat"><b>{ar(P['nlog'])}</b><span>تعديلًا موثقًا في {ar(P['ntouched'])} سؤالًا</span></div></div>
<div class="callout warn">«معدّل» لا يعني خطأ علميًا في كل حالة. أكثر التعديلات موازنة طول الخيارات وإضافة خيار ثالث. أما الأخطاء المؤكدة فاثنان: <b>s1q3</b> (إجابتان صحيحتان محتملتان لأن رواية مسلم تزيد أيضًا «وكتابه»، مع اختلاف لفظ الملخص عن لفظ البخاري) و<b>s2q4</b> (أسقطت الصياغة كلمة «هنا» فصار الخيار «في العبادة والمعاملة معًا» محتملًا). وصلحتُ أيضًا خياري <b>s9q1</b> و<b>s8q4</b> غير المعقولين، وخيارَي <b>s10q4</b> اللذين كانا يختلقان وقائع في قصة الحديث.</div>
<div class="callout">لم أُدرج أسئلة جديدة، ولم أضف معلومة علمية. نسخة الأسئلة قبل المراجعة محفوظة في <span class="mono">review/question-bank.before-review.json</span> وسجل كل تعديل في <span class="mono">review/change-log.json</span>.</div></section>

<section><h2>معايير القبول العشرة</h2>
<div class="tw"><table><thead><tr><th class="num">#</th><th>المعيار</th><th>الحالة</th><th>الدليل أو السبب</th></tr></thead><tbody>
<tr><td class="num">١</td><td>مراجعة ١٠٠٪ من الأسئلة التعليمية وأسئلة المراجعة</td><td><span class="pill ok">تحقق</span></td><td>٥٠ سؤالًا و٢٠ موضعًا في المراجعة، في الجدول أدناه. المراجعة مني، لا من مشرف علمي.</td></tr>
<tr><td class="num">٢</td><td>معالجة الأخطاء العلمية المؤكدة</td><td><span class="pill ok">تحقق</span></td><td>أُصلح s1q3 وs2q4 وخيارات ثلاثة أسئلة (s9q1 وs8q4 وs10q4). لكن اختلاف لفظ الملخص عن البخاري ليس من اختصاصي وهو معلق.</td></tr>
<tr><td class="num">٣</td><td>لا نص شرعي غير متحقق منه</td><td><span class="pill warn">تحقق جزئيًا</span></td><td>كل الآيات والأحاديث طُوبقت بمصادر مفتوحة. لم يتحقق: التشكيل بمصحف رسمي، وعزو «ومسلم» في حديث أنس، وسرد حديث الرجل بصيغة الكتاب.</td></tr>
<tr><td class="num">٤</td><td>لا سؤال يحتمل أكثر من إجابة صحيحة</td><td><span class="pill warn">تحقق جزئيًا</span></td><td>حُلّ احتمالان مؤكدان. لا أستطيع الجزم بغياب غيرهما قبل مراجعة المشرف.</td></tr>
<tr><td class="num">٥</td><td>توثيق الأسئلة والشروح بمواضعها</td><td><span class="pill ok">تحقق</span></td><td>كل سؤال بصفحة الملخص وموضعه وإصدار الملخص وبصمته، وإحالة للكتاب بلا صفحة غير متحقق منها.</td></tr>
<tr><td class="num">٦</td><td>التصحيح والتكرار وحفظ التقدم</td><td><span class="pill ok">تحقق</span></td><td>اختبارات آلية: خطأ وإعادة بعد سؤالين، انتهاء الوقت والاستئناف، إعادة فتح الصفحة.</td></tr>
<tr><td class="num">٧</td><td>سلامة المؤشرات الحسابية</td><td><span class="pill ok">تحقق</span></td><td>حُسبت بعد ٣ جلسات وبعد المراجعة وقورنت بالصيغ المعتمدة؛ والعدد الكلي للجلسات تقديري ومعلَّم.</td></tr>
<tr><td class="num">٨</td><td>اكتمال اختبارات المسار التعليمي</td><td><span class="pill ok">تحقق (آليًا)</span></td><td>من الجلسة ١ إلى اجتياز المراجعة، ٣٥ فحصًا. لا يغني عن تجربة بشرية.</td></tr>
<tr><td class="num">٩</td><td>توثيق نتائج اختبار الوقت</td><td><span class="pill warn">توثّق، ولم يتحقق</span></td><td>تقدير حسابي موثق أدناه. لا تجربة مع مستخدمين فعليين.</td></tr>
<tr><td class="num">١٠</td><td>قائمة منفصلة بالمسائل المعلقة</td><td><span class="pill ok">تحقق</span></td><td>في قسم «المسائل المعلقة».</td></tr>
</tbody></table></div></section>

<section><h2>١. التحقق من الآيات والأحاديث</h2>
<p class="lead">الطريقة: أخذتُ نص كل آية من مجموعة مفتوحة (fawazahmed0/quran-api، ara-quranuthmanienc) وقارنتُ هيكلها الحرفي بمجموعة ثانية (semarketir/quranjson)، ثم استبدلتُ نص الأسئلة بنص المجموعة الأولى بتشكيله. والأحاديث من مجموعتي البخاري ومسلم في fawazahmed0/hadith-api. لم أعتمد على ذاكرتي في أي نص. لكنها ليست مصادر رسمية، فالمطابقة الرسمية بمصحف المدينة وطبعات الحديث تبقى للمشرف.</p>
<h3>الآيات (١٠ مواضع)</h3>
<div class="tw"><table><thead><tr><th>الموضع</th><th>النص المعروض الآن</th><th>الأسئلة</th><th>المقطع</th><th>الحالة</th></tr></thead><tbody>{P['qrows']}</tbody></table></div>
<p class="tiny">تحويل مقصود: علامات التنوين المفتوح (U+08F0–08F2) حُوّلت إلى التنوين العادي ليدعمها الخط. وقد حُذفت علامات الوقف الزائدة في آخر المقطع.</p>
<h3>الأحاديث</h3>
<div class="tw"><table><thead><tr><th>الحديث</th><th>الأسئلة</th><th>المصدر المطابق</th><th>الراوي</th><th>النتيجة</th></tr></thead><tbody>{P['hrows']}</tbody></table></div>
<h3>النصوص الستة التي سبق وسمها بالاقتطاع أو السرد</h3>
<div class="tw"><table><thead><tr><th>النص</th><th>الحكم</th><th>الإجراء</th></tr></thead><tbody>
<tr><td>اللفظ الأول في s1q3 (ورواية مسلم)</td><td>اللفظان لا يطابقان لفظ الملخص، ورواية مسلم تزيد «وكتابه» أيضًا</td><td>استُبدل بلفظ البخاري ٥٠ ولفظ مسلم ٩٩ كاملين، وحُصرت الخيارات. المسألة معلقة للمشرف.</td></tr>
<tr><td>الحديث القدسي (s8q2, s8q3)</td><td>مقتطع بنقاط في الملخص</td><td>استُكمل من صحيح البخاري ٤٤٨٢، <b>يمكن اعتماده</b> بعد مراجعة المشرف.</td></tr>
<tr><td>حديث الرجل (s10q3, s10q4)</td><td>سرد الكتاب لا لفظ الحديث</td><td>بقي موسومًا «كما أورده الكتاب». الشاهد مطابق لفظ البخاري ٧٥٠٦. <b>يحتاج قرار المشرف</b> هل يُعرض لفظ الحديث بدل السرد.</td></tr>
</tbody></table></div></section>

<section><h2>٢. مراجعة الأسئلة الخمسين (والمراجعة العشرين)</h2>
<p class="lead">كل صف مثبّت بمعرّف السؤال، وصفحة الملخص وموضع المعلومة. «معدّل» تعني أن الصياغة أو الخيارات أو النص المعروض تغيّر مع بقاء المعنى والمرجع. لم يُنشأ سؤال بديل.</p>
<div class="tw"><table style="min-width:980px"><thead><tr><th>السؤال</th><th class="num">الجلسة</th><th>المرجع</th><th>صحة المعلومة</th><th>الصياغة</th><th>الخيارات</th><th>الشرح</th><th>القرار</th><th>الملاحظة</th></tr></thead><tbody>{P['tb']}</tbody></table></div>
<h3>جودة الأسئلة تربويًا</h3>
<ul class="tight">
<li><b>مستويات السؤال:</b> تذكر {ar(P['bl'].get('تذكر',0))}، فهم {ar(P['bl'].get('فهم',0))}، تمييز بين مفهومين {ar(P['bl'].get('تمييز',0))}، تطبيق ٠. لا أسئلة تطبيقية لأن الملخص لا يتيح مثالًا تطبيقيًا في المجموعة غير مثال «خلاصة للمراجعة» الذي استبعدته مع المربع كله. هذا قصور تربوي معلَّم لا حلّ له دون إضافة.</li>
<li><b>قرينة الطول:</b> كان الخيار الصحيح أطول بمرة ونصف على الأقل في {ar(old_cue)} سؤالًا. بعد الموازنة بقي {ar(len(cue))} ({', '.join(cue) or '—'}) وهو لا يُعدّ قرينة لأن الخيارات نصوص من الحديث والمطلوب ترتيبها.</li>
<li><b>عدد الخيارات:</b> كانت الأسئلة ثنائية الخيارات {ar(old_two)} فصارت {ar(len(two))} ({', '.join(two)}). وجميعها لا تتجاوز ثلاثة.</li>
<li><b>أسئلة ضعيفة التمييز تُرك الحكم فيها:</b> s9q3 (نقيضان) وs8q2/s8q3 (بعد عرض اللفظ الكامل صارت الإجابة ظاهرة في النص) وs6q2 وs5q1 (الجواب مقروء من النص المعروض). والتعديل الأنسب دمج s8q2 وs8q3 في سؤال، وهو يغيّر العدد المعتمد فلم أفعله.</li>
<li><b>تكرار الفكرة:</b> s5q3 وs5q5 على جملة واحدة، وs7q1 وs7q2 على حديث واحد، وs3q4 وs4q3 وs3q3 تعرض حديث الشعب نفسه. لا يزال مبررًا لأن المطلوب مختلف.</li></ul></section>

<section><h2>٣. تغطية المراجعة العشرية للأهداف العلمية</h2>
<p class="lead">كان السحب السابق «سؤالان من كل جلسة» آليًا، ولم يراعِ أهمية المعلومة. استبدلتُ به <b>عشرين هدفًا علميًا</b> للمجموعة، حددتُها من موضوعات الملخص، وللمراجعة سؤال واحد لكل هدف. العدد المعتمد (٢٠ سؤالًا في أربع جلسات مصغّرة) لم يتغير.</p>
<div class="tw"><table><thead><tr><th>الفتحة</th><th>الهدف العلمي</th><th>السؤال الأساسي</th><th>البدائل</th><th class="num">أسئلة الهدف</th><th>القرار</th><th>المستوى</th></tr></thead><tbody>{P['rv']}</tbody></table></div>
<ul class="tight">
<li><b>قاعدة الاختيار:</b> لكل هدف: ١) السؤال الذي أخطأ فيه الطالب عند أول محاولة، وإلا ٢) يُدار بين أسئلة الهدف بحسب عدد مرات مراجعته (يبدأ بالأساسي)، فلا يثبت موضع الإجابة. ثم تُوزَّع الأسئلة على الجلسات المصغّرة الأربع بتوازن زمن القراءة المقدّر.</li>
<li><b>ما تحقق:</b> كل هدف يظهر مرة واحدة، فالمراجعة تغطي الأهداف العشرين كلها، وما أُخطئ فيه يدخل في المراجعة دون أن يُهمل هدف آخر. اختبرتُ ذلك آليًا.</li>
<li><b>ما لم يتحقق:</b> ثلاثة أهداف كثيفة (١٦ حلاوة الإيمان، ١٩ تفرد الله بالخلق، ٢٠ الإحياء والإماتة) لكل منها خمسة أسئلة وفتحة واحدة. فإذا أخطأ الطالب في أكثر من سؤال في هدف واحد دخل أحدها فقط، وبقي الآخر خارج المراجعة. والحل المحتمل رفع المراجعة إلى ٢٤ سؤالًا، فلا أغيّر العدد دون موافقتك.</li>
<li>الاجتياز: الإجابة الصحيحة عن كل أسئلة المراجعة ولو بعد إعادة الخاطئ، والمحاولة الأولى مؤشر مستقل. وكلاهما يعمل ومُختبَر.</li></ul></section>

<section><h2>٤. ملاءمة مدة الجلسات (تقدير لا تجربة)</h2>
<div class="callout stop"><b>تنبيه:</b> الأرقام أدناه من نموذج حسابي، ولم تُجرَّب الجلسات مع أي طالب. لا تُعدّ نتيجة تجربة بشرية.</div>
<p class="lead">النموذج: زمن قراءة السؤال والنص والخيارات بسرعة معينة، وثانية وربع لكل خيار للمقارنة، وثلاث ثوانٍ للنقر والانتقال، وثانيتان لقراءة التأكيد عند الصواب. وعند الخطأ يُضاف زمن قراءة الشرح، ثم يُعاد السؤال بنسبة ٥٥٪ من زمن قراءته الأول. السرعات: ١٧٠ كلمة في الدقيقة (سريع)، ١٣٠ (متوسط، وهو تقدير متحفظ لنص مشكول على هاتف)، ١٠٠ (بطيء). نسب الخطأ: ٠٪ و٢٥٪ و٤٠٪. الأحمر ما تجاوز ١٨٠ ثانية.</p>
<div class="tw"><table style="min-width:760px"><thead><tr><th rowspan="2" class="num">الجلسة</th><th rowspan="2" class="num">كلمات الشاشة</th><th colspan="3" class="num">سريع (١٧٠)</th><th colspan="3" class="num">متوسط (١٣٠)</th><th colspan="3" class="num">بطيء (١٠٠)</th></tr><tr><th class="num">٠٪</th><th class="num">٢٥٪</th><th class="num">٤٠٪</th><th class="num">٠٪</th><th class="num">٢٥٪</th><th class="num">٤٠٪</th><th class="num">٠٪</th><th class="num">٢٥٪</th><th class="num">٤٠٪</th></tr></thead><tbody>{P['trow']}</tbody></table></div>
<h3>الجلسات المصغّرة الأربع للمراجعة (عند أول مراجعة بلا أخطاء مسبقة)</h3>
<div class="tw"><table style="min-width:760px"><thead><tr><th>الجلسة</th><th class="num">سريع ٠٪</th><th class="num">٢٥٪</th><th class="num">٤٠٪</th><th class="num">متوسط ٠٪</th><th class="num">٢٥٪</th><th class="num">٤٠٪</th><th class="num">بطيء ٠٪</th><th class="num">٢٥٪</th><th class="num">٤٠٪</th></tr></thead><tbody>{P['mrow']}</tbody></table></div>
<ul class="tight">
<li><b>الخلاصة التقديرية:</b> بقراءة متوسطة وخطأ ٢٥٪ تقع ثماني جلسات من عشر داخل ثلاث دقائق، وتتجاوزها الجلستان {ar(7)} و{ar(8)} (١٨٦ و١٨١ ثانية). بقراءة بطيئة تتجاوزها {ar(len(P['over_slow25']))} جلسات ({', '.join(ar(x) for x in P['over_slow25'])}). وجلسات المراجعة المصغّرة داخل الحد للقارئ المتوسط (١٥٥–١٦٢ ثانية) وتتجاوزه قليلًا للقارئ البطيء.</li>
<li><b>سبب الثقل:</b> الجلستان ٧ و٨ تعرضان حديثًا في سؤالين أو أكثر (حديث أنس مرتين، والحديث القدسي مرتين)، فتقرأ الشاشة النص نفسه أكثر من مرة.</li>
<li><b>على الهاتف:</b> في شاشة ٣٩٠×٨٠٠ يظهر كل سؤال بخياراته دون تمرير إلا سؤالًا واحدًا، وزر «فهمت، تابع» و«التالي» صار ثابتًا أسفل الشاشة بعد أن كان ٣٠ من شاشات الخطأ تحتاج تمريرًا للوصول إليه. أما في ٣٦٠×٦٤٠ فيحتاج ٢٧ سؤالًا إلى تمرير يضيف ثوانيَ لم تدخل في التقدير. لم تظهر أي حالة تحتاج إلى تمرير أفقي.</li>
<li><b>لم أرفع الحد.</b> وبقي حفظ التقدم عند انتهاء الوقت، فلا يضيع على الطالب شيء إذا تجاوزت الجلسة ثلاث دقائق، ويكمل الأسئلة المتبقية بعداد جديد.</li>
<li><b>مقترحات تحتاج موافقتك:</b> (أ) دمج s8q2 وs8q3 وs7q1 وs7q2 في سؤال لكل زوج: يوفر نحو ٣٥–٤٠ ثانية في الجلستين، لكنه يخفض عدد الأسئلة. (ب) إعادة توزيع سؤال بين الجلسات: يخالف ترتيب الموضوعات فلا أنصح به. (ج) إبقاؤها كما هي لأن الانتهاء لا يضيّع التقدم، ثم قياس زمن فعلي في تجربة مغلقة.</li></ul></section>

<section><h2>٥. القراءة الاختيارية</h2>
<p class="lead">فحصتُ الضوابط الثمانية آليًا وعلى الهاتف:</p>
<div class="tw"><table><thead><tr><th>الضابط</th><th>النتيجة</th></tr></thead><tbody>
<tr><td>القراءة اختيارية، والبدء بالأسئلة بلا قراءة</td><td><span class="pill ok">نجح</span> زر «ابدأ الجلسة مباشرة» مستقل</td></tr>
<tr><td>تظهر صفحات الملخص الأصلية بلا تغيير</td><td><span class="pill ok">نجح</span> صور الصفحات ٤–٨ بدقة ١٢٤٢ بكسل</td></tr>
<tr><td>يتوقف العداد أثناء العرض</td><td><span class="pill ok">نجح</span> بقيت قائمة الأسئلة والوقت كما هما</td></tr>
<tr><td>لا يُسجَّل أن الطالب قرأ ولا المدة</td><td><span class="pill ok">نجح</span> قورنت حالة التطبيق كاملة قبل العرض وبعده</td></tr>
<tr><td>لا أثر في الإنجاز أو الإتقان</td><td><span class="pill ok">نجح</span></td></tr>
<tr><td>صفحات الكتاب منفصلة عن صفحات الملخص</td><td><span class="pill ok">نجح</span> الإحالة أسفل الإجابة: كتاب وموضوع و«الصفحة قيد التحقق»</td></tr>
<tr><td>لا أرقام صفحات غير متحقق منها</td><td><span class="pill ok">نجح</span> فُحصت شاشات السؤال والخطأ للأسئلة الخمسين: لا رقم صفحة خارج عنصر «قراءة اختيارية من الملخص»</td></tr>
<tr><td>ربط كل جلسة بصفحاتها</td><td><span class="pill ok">نجح</span> ١←ص٤، ٢←ص٤، ٣–٤←ص٥، ٥←ص٥–٦، ٦–٧←ص٦، ٨←ص٧، ٩←ص٧–٨، ١٠←ص٨</td></tr>
</tbody></table></div></section>

<section><h2>٦. نتائج الاختبارات التقنية</h2>
<p class="lead">الاختبارات آلية بمتصفح Chromium. نجاحها يدل على سلامة البرمجة ولا يدل على جودة التعلم ولا على صحة المحتوى.</p>
<div class="tw"><table><thead><tr><th>الاختبار</th><th>النتيجة</th></tr></thead><tbody>
<tr><td>المسار الكامل: دخول، بدء بلا قراءة، خطأ وإعادة، إكمال الجلسات العشر، جلستان ثم خروج وعودة إلى الثالثة، المراجعة الشاملة، اجتيازها، فتح المجموعة التالية</td><td><span class="pill ok">٣٥ فحصًا نجح</span></td></tr>
<tr><td>انتهاء الوقت وحفظ الأسئلة المتبقية واستئنافها وبقاؤها بعد إعادة فتح الصفحة</td><td><span class="pill ok">نجح</span> (ضمن المسار وفحوص مستقلة)</td></tr>
<tr><td>فتح صفحات الملخص والعودة إلى السؤال أثناء الجلسة</td><td><span class="pill ok">٢٣ فحصًا نجح</span></td></tr>
<tr><td>بطاقة الكتاب والمجموعة والنطاق والمؤشرات ومراجعة المجموعة</td><td><span class="pill ok">٣٠ فحصًا نجح</span></td></tr>
<tr><td>مؤشرات التقدم والإتقان: بعد ٣ جلسات (٣ ÷ ٦٢٨، المراجعة بعد ٧ جلسات)، وبعد المراجعة (مراجعة ١، ١٤ نقطة، الإتقان محسوب، المحاولة الأولى مستقلة عن الاجتياز)</td><td><span class="pill ok">نجح</span></td></tr>
<tr><td>التخطيط على الهاتف: الأسئلة الخمسون وشاشة خطئها، بعرضين (٣٩٠ و٣٦٠) وفي الوضعين الفاتح والداكن</td><td><span class="pill ok">لا تمرير أفقي، ولا نص مخفي، ولا تسرب لأرقام صفحات</span></td></tr>
<tr><td>إصلاح تقني وُثّق: زر المتابعة صار ثابتًا أسفل الشاشة بعد أن كان يختفي أسفل ٣٠ شاشة خطأ في ٣٩٠×٨٠٠</td><td><span class="pill ok">تم</span></td></tr>
</tbody></table></div>
<div class="callout warn"><b>لم يُختبر:</b> جهاز iOS أو Android حقيقي (اللمس، الخطوط الفعلية)، قارئ الشاشة، تجربة مع طلاب (فهم الأسئلة والزمن)، وعارض PDF أصلي. والخط Amiri لم يُحمَّل في بيئة الاختبار (بلا إنترنت)، فشكل الآيات المشكولة رأيتُه بخط النظام فقط.</div></section>

<section><h2>٧. سجل التعديلات</h2>
<p class="lead">{ar(P['nlog'])} تعديلًا في {ar(P['ntouched'])} سؤالًا ({ar(P['nass_changes'])} منها على النصوص المعروضة، والباقي صياغة وخيارات). يلي تعديلات الصياغة والخيارات، أما تعديلات النصوص فهي استبدال نص الآية أو الحديث بالنص المتحقق منه، وهي مسجلة بقيمها في <span class="mono">review/change-log.json</span>.</p>
<div class="tw"><table style="min-width:900px"><thead><tr><th>السؤال</th><th>الحقل</th><th>قبل</th><th>بعد</th><th>السبب</th></tr></thead><tbody>{P['chrows']}</tbody></table></div></section>

<section><h2>٨. المسائل المعلقة وما يحتاج إلى قرارك أو اعتماد المشرف</h2>
<div class="tw"><table><thead><tr><th class="num">#</th><th>المسألة</th><th>من يقرر</th></tr></thead><tbody>
<tr><td class="num">١</td><td>لفظ الملخص لحديث جبريل («وكتبه») يخالف لفظ البخاري ٥٠. أيُّ اللفظين يُعتمد، وهل يُصحَّح الملخص؟ (s1q3)</td><td>المشرف</td></tr>
<tr><td class="num">٢</td><td>رواية مسلم تزيد «وكتابه» أيضًا، وقد حصرتُ الخيارات لتبقى إجابة واحدة. هل يُبقى سؤال المقارنة بهذه الصورة؟</td><td>المشرف</td></tr>
<tr><td class="num">٣</td><td>عزو حديث أنس «البخاري ومسلم»: لم أجده في مجموعة مسلم المستخدمة (s7q1, s7q2).</td><td>المشرف بمراجعة الكتاب</td></tr>
<tr><td class="num">٤</td><td>مطابقة الآيات العشر بمصحف المدينة، وهل يُقبل تحويل التنوين المفتوح إلى العادي؟</td><td>المشرف</td></tr>
<tr><td class="num">٥</td><td>مطابقة الأحاديث بالطبعات المعتمدة بدل المجموعات المفتوحة.</td><td>المشرف</td></tr>
<tr><td class="num">٦</td><td>حديث الرجل: هل يُعرض سرد الكتاب كما هو أم لفظ الحديث؟ وتفسير «لم يعمل خيرًا قط» وتعليل فعله مسألتان تفسيريتان دقيقتان (s10q3, s10q4).</td><td>المشرف</td></tr>
<tr><td class="num">٧</td><td>دمج الأسئلة المتقاربة (s8q2/s8q3، s7q1/s7q2) وتغيير s9q3 الضعيف: يخفض العدد أو يغيّره.</td><td>أنت</td></tr>
<tr><td class="num">٨</td><td>زمن الجلستين ٧ و٨ (تقديرًا ١٨٦ و١٨١ ثانية)، وتجربة بشرية تقيس الزمن الفعلي.</td><td>أنت</td></tr>
<tr><td class="num">٩</td><td>هل تُوسَّع المراجعة إلى ٢٤ سؤالًا لتغطية الأهداف الكثيفة؟ (لم أغيّر العدد)</td><td>أنت</td></tr>
<tr><td class="num">١٠</td><td>صفحات الكتاب الأصلي وروابط الكتابين: لا تزال «قيد التحقق»، وأحتاج الكتابين أو روابطهما.</td><td>أنت</td></tr>
<tr><td class="num">١١</td><td>الخيارات الخاطئة المبتكرة: بعضها نقيض بسيط لما قرره الملخص، وراجعتُها مرة واحدة. يُنظر فيها لأنها تُعرض للطالب.</td><td>المشرف</td></tr>
<tr><td class="num">١٢</td><td>الحقوق: صور صفحات الملخص ونصوص الكتابين المنقولة لا تُنشر للعامة قبل المراجعة القانونية (قرارك السابق).</td><td>أنت</td></tr>
</tbody></table></div></section>

<section><h2>الجواب النهائي</h2>
<div class="verdict"><p><b>المجموعة العشرية الأولى جاهزة للعرض على المشرف العلمي، ولا تزال تحتاج إلى معالجة قبل الاعتماد النهائي.</b> الأدلة: لا خلل برمجيًا ظاهرًا في المسار، والنصوص الشرعية مطابقة لمصادر مفتوحة، وأُصلحت الأخطاء المؤكدة. لكن ثلاثة أمور تمنع وصفها بالمعتمدة: اختلاف لفظ الملخص عن لفظ البخاري، وغياب تحقق رسمي وبشري (مصحف وطبعات حديث وتجربة طلاب)، وتجاوز جلستين الحد الزمني تقديرًا.</p><p>لم أنتقل إلى الجلسة ١١ ولا إلى المجموعة الثانية، ولم أوسّع بنك الأسئلة، ولم أدمج الفرع في main.</p></div></section>
</div>'''
open('../review-report.html','w',encoding='utf8').write(html)
print(len(html))
