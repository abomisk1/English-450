#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""يولّد خريطة المحتوى وقائمة المراجعة البشرية بصيغة Markdown من ملفات JSON."""
import json, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, 'content')
D = os.path.join(ROOT, 'docs')
os.makedirs(D, exist_ok=True)

manifest = json.load(open(os.path.join(C, 'manifest.json'), encoding='utf-8'))
units = [json.load(open(os.path.join(C, u['file']), encoding='utf-8')) for u in manifest['units']]
review = json.load(open(os.path.join(C, 'needs-review.json'), encoding='utf-8'))

AR = str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩')
def ar(n): return str(n).translate(AR)

TYPE_AR = {'quran': 'نصّ قرآني', 'hadith': 'حديث نبوي', 'dhikr': 'ذكر/دعاء',
           'text': 'نصّ من الكتاب', 'list': 'قائمة من الكتاب', 'note': 'صياغة تعليمية مساعدة'}
KIND_AR = {'mcq': 'اختيار', 'truefalse': 'صحيح/خطأ', 'order': 'ترتيب خطوات',
           'match': 'مطابقة', 'complete': 'إكمال نصّ', 'scenario': 'موقف حياتي',
           'flashcards': 'بطاقات تذكّر'}

# ------------------------------ خريطة المحتوى ------------------------------
out = []
w = out.append
book = manifest['parts'][0]['book']
w('# خريطة المحتوى — بَرْدُ اليقين، الجزء الأول\n')
w('مُستخرَجة آليًّا من ملفات المحتوى في `content/`. لإعادة توليدها: `python3 scripts/build_docs.py`.\n')
w('## المصدر\n')
w(f"- **الكتاب:** {book['title']}")
w(f"- **المؤلف:** {book['author']}")
w(f"- **الطبعة:** {book['edition']} — {book['year']}")
w(f"- **عدد الصفحات:** {ar(book['pages'])}")
w(f"- **ملحوظة المؤلف:** {book['note']}\n")
w('## الإحصاءات\n')
st = manifest['stats']
w('| البند | العدد |')
w('|---|---|')
for k, lbl in [('units', 'الوحدات'), ('lessons', 'الدروس'), ('cards', 'بطاقات المحتوى'),
               ('quizItems', 'أسئلة الاختبارات'), ('tasks', 'المهام الأدائية'),
               ('needsReview', 'عناصر تحتاج مراجعة بشرية')]:
    w(f'| {lbl} | {ar(st[k])} |')
w('')

kinds = collections.Counter()
types = collections.Counter()
for u in units:
    for l in u['lessons']:
        for c in l['cards']:
            types[c['type']] += 1
        for q in l['interactions'] + l['quiz']:
            kinds[q['kind']] += 1
w('### أنواع بطاقات المحتوى\n')
w('| النوع | العدد |')
w('|---|---|')
for t, n in types.most_common():
    w(f'| {TYPE_AR.get(t, t)} | {ar(n)} |')
w('')
w('### أنواع التفاعل والأسئلة\n')
w('| النوع | العدد |')
w('|---|---|')
for k, n in kinds.most_common():
    w(f'| {KIND_AR.get(k, k)} | {ar(n)} |')
w('')

w('## الوحدات والدروس\n')
for u in units:
    p = u['source']['pages']
    w(f"### {ar(u['order'])}. {u['title']}\n")
    w(f"**صفحات الكتاب:** {ar(p[0])}–{ar(p[1])} · "
      f"**الدروس:** {ar(len(u['lessons']))} · "
      f"**أسئلة تحصيلية:** {ar(len(u['assessment']))} · "
      f"**مهام أدائية:** {ar(len(u['tasks']))}\n")
    w('**النتائج التعليمية المستهدفة (من الكتاب):**\n')
    for i, o in enumerate(u['outcomes']['points'], 1):
        w(f'{ar(i)}. {o}')
    w('')
    w('| # | الدرس | صفحات | بطاقات | تفاعلات | أسئلة | نصوص الكتاب |')
    w('|---|---|---|---|---|---|---|')
    for i, l in enumerate(u['lessons'], 1):
        src = collections.Counter(c['type'] for c in l['cards'] if c['type'] in ('quran', 'hadith', 'dhikr'))
        srctxt = '، '.join(f'{TYPE_AR[t]} ×{ar(n)}' for t, n in src.items()) or '—'
        w(f"| {ar(i)} | {l['title']} | {'، '.join(ar(x) for x in l['source']['pages'])} "
          f"| {ar(len(l['cards']))} | {ar(len(l['interactions']))} | {ar(len(l['quiz']))} | {srctxt} |")
    w('')
    w('**الأسئلة التحصيلية كما وردت في الكتاب:**\n')
    for i, a in enumerate(u['assessment'], 1):
        w(f"{ar(i)}. {a['q']}  _(ص {ar(a['page'])})_")
    w('')
    w('**المهام الأدائية كما وردت في الكتاب:**\n')
    for i, t in enumerate(u['tasks'], 1):
        w(f"{ar(i)}. {t['text']}  _(ص {ar(t['page'])})_")
    w('')

open(os.path.join(D, 'CONTENT_MAP.md'), 'w', encoding='utf-8').write('\n'.join(out))

# ------------------------- قائمة المراجعة البشرية -------------------------
out = []
w = out.append
w('# النصوص التي تحتاج إلى مراجعة بشرية واعتماد شرعي\n')
w('مُستخرَجة آليًّا من `content/needs-review.json`. '
  'وتظهر نفسها في **لوحة إدارة المحتوى** (`admin/index.html`) مع إمكانية الاعتماد أو طلب التعديل.\n')
w(f"**{review['policy']}**\n")

by_src = collections.Counter(i['src'] for i in review['items'])
by_kind = collections.Counter(i['kind'] for i in review['items'])
w('## الإجمالي\n')
w(f"العدد الكلي: **{ar(review['count'])}** عنصرًا.\n")
w('| المصدر | العدد | سبب المراجعة |')
w('|---|---|---|')
w(f"| `quran` نصّ قرآني | {ar(by_src.get('quran', 0))} | "
  "لم يُستخرج من ملف PDF (الآيات فيه بخطوط مصحفية لا تُستخرج نصًّا صحيحًا)، "
  "بل كُتب بالرسم المعتمد ويحتاج تدقيقًا حرفيًّا وتشكيليًّا. |")
w(f"| `authored` صياغة تعليمية مساعدة | {ar(by_src.get('authored', 0))} | "
  "مدخل الدرس وهدفه وخلاصته والمواقف الحياتية وسؤال النقاش الأسري — "
  "ليست من الكتاب، فتحتاج اعتمادًا قبل النشر. |")
w('')
w('## التوزيع بحسب نوع العنصر\n')
w('| النوع | العدد |')
w('|---|---|')
NA = {'card:quran': 'بطاقة نصّ قرآني', 'card:note': 'بطاقة ملحوظة تعليمية',
      'hook': 'مدخل الدرس', 'objective': 'هدف الدرس', 'summary': 'خلاصة الدرس',
      'family': 'سؤال النقاش الأسري', 'interaction:scenario': 'موقف حياتي (تفاعل)',
      'quiz:scenario': 'موقف حياتي (اختبار)'}
for k, n in by_kind.most_common():
    w(f'| {NA.get(k, k)} | {ar(n)} |')
w('')

w('## النصوص القرآنية (أولوية المراجعة)\n')
w('| الموضع | المرجع | ص | مطلع النصّ |')
w('|---|---|---|---|')
for it in review['items']:
    if it['src'] != 'quran':
        continue
    ex = it['text'].replace('|', '/').replace('\n', ' ')[:90]
    w(f"| `{it['path']}` | {it.get('ref') or '—'} | {ar(it['page']) if it.get('page') else '—'} | {ex}… |")
w('')
w('> لكل نصّ قرآني بطاقةٌ في البرنامج تحمل `needsReview: true`، '
  'ولا يعمل فيها زرّ الاستماع إلا بعد إرفاق تسجيل صوتي معتمد. '
  'ولا تُستخدم القراءة الآلية للقرآن في أي حال، وهذا مُلزَم في الشفرة لا في السياسة فقط '
  '(`js/lib/speech.js`).\n')

w('## الصياغات التعليمية المساعدة\n')
w('هذه ليست من الكتاب، وهي بصياغة تعليمية تُعين على الفهم والتشويق. '
  'وتظهر في الواجهة بلصيقة صفراء واضحة: «صياغة تعليمية مساعدة».\n')
w('| الموضع | النوع | الأولوية | ص | مطلع النصّ |')
w('|---|---|---|---|---|')
for it in review['items']:
    if it['src'] != 'authored':
        continue
    ex = it['text'].replace('|', '/').replace('\n', ' ')[:90]
    w(f"| `{it['path']}` | {NA.get(it['kind'], it['kind'])} | {it['priorityAr']} | "
      f"{ar(it['page']) if it.get('page') else '—'} | {ex}… |")
w('')

w('## ما لا يحتاج مراجعة\n')
w('- نصوص الكتاب المنقولة حرفيًّا (`src: "book"`): استُخرجت من ملف PDF عبر فكّ ترميز الخطوط '
  'المضمَّنة ثم قوبلت بصريًّا بصفحات الكتاب.\n'
  '- الأسئلة المشتقّة (`src: "derived"`): أسئلة اختيار وترتيب ومطابقة مبنيّة حرفيًّا على نصّ الكتاب، '
  'وتفسير كل إجابة يشير إلى موضعه من الكتاب.\n')

open(os.path.join(D, 'NEEDS_REVIEW.md'), 'w', encoding='utf-8').write('\n'.join(out))
print('CONTENT_MAP.md + NEEDS_REVIEW.md')
