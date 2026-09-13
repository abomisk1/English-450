#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ضبط الأعداد: يفسّر العلاقة بين أرقام المحتوى، ويتحقّق من عدم التكرار أو السقوط.

المخرجات:
  docs/COUNTS.md        جدول تفسير الأعداد وتعريف كل نوع وطريقة احتسابه.
  (ويطبع تحذيرات إن وُجد تكرار أو سقوط)

التشغيل:  python3 scripts/audit_counts.py
"""
import json, os, re, collections, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, 'content')
D = os.path.join(ROOT, 'docs')

manifest = json.load(open(os.path.join(C, 'manifest.json'), encoding='utf-8'))
units = [json.load(open(os.path.join(C, u['file']), encoding='utf-8')) for u in manifest['units']]
review = json.load(open(os.path.join(C, 'needs-review.json'), encoding='utf-8'))

AR = str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩')
def ar(n): return str(n).translate(AR)

def norm(s):
    """تطبيع عربي لكشف التكرار: إزالة التشكيل وتوحيد الألف والياء والمسافات."""
    s = unicodedata.normalize('NFKC', str(s or ''))
    s = re.sub(r'[ؐ-ًؚ-ٰٟۖ-ۭ]', '', s)
    s = s.replace('ـ', '')
    s = re.sub(r'[آأإٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه')
    s = re.sub(r'[^\w\s]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

warn = []

# ---------------------------------------------------------------- الأعداد
counts = collections.Counter()
card_types = collections.Counter()
inter_kinds = collections.Counter()
BARE = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\s\u2E2B﴿﴾]")
quiz_kinds = collections.Counter()
authored = collections.Counter()

for u in units:
    counts['units'] += 1
    counts['assessment'] += len(u['assessment'])
    counts['tasks'] += len(u['tasks'])
    counts['outcomes'] += len(u['outcomes']['points'])
    if u.get('intro'):
        counts['intro'] += 1
    for l in u['lessons']:
        counts['lessons'] += 1
        for c in l['cards']:
            counts['cards'] += 1
            card_types[c['type']] += 1
            if c.get('needsReview') and c.get('src') == 'authored':
                authored['card:note'] += 1
            if c.get('src') == 'quran':
                authored['quran'] += 1
        quran_txt = [BARE.sub('', c.get('text') or '')
                     for c in l['cards'] if c['type'] == 'quran']
        for q in l['interactions']:
            counts['interactions'] += 1
            inter_kinds[q['kind']] += 1
            if q.get('src') == 'authored':
                authored['interaction:' + q['kind']] += 1
            # إكمال مقطع قرآني بالاختيار: يدخل المراجعة ولو كان مشتقًّا
            if q['kind'] == 'complete' and quran_txt and q.get('src') != 'authored':
                probe = (BARE.sub('', q.get('before') or '')
                         + BARE.sub('', q.get('after') or ''))[:12]
                if probe and any(probe in t for t in quran_txt):
                    authored['interaction:complete-quran'] += 1
        for q in l['quiz']:
            counts['quiz'] += 1
            quiz_kinds[q['kind']] += 1
            if q.get('src') == 'authored':
                authored['quiz:' + q['kind']] += 1
        for k in ('hook', 'objective', 'summary', 'family'):
            if l.get(k):
                counts[k] += 1
                authored[k] += 1

counts['authored_total'] = sum(authored[k] for k in authored if k != 'quran')
counts['quran'] = authored['quran']
counts['needsReview'] = counts['authored_total'] + counts['quran']

if counts['needsReview'] != review['count']:
    warn.append(f"عدد عناصر المراجعة المحسوب {counts['needsReview']} "
                f"لا يطابق needs-review.json ({review['count']})")

# --------------------------------------------------- كشف التكرار والسقوط
# ١) تكرار معرّفات
ids = [l['id'] for u in units for l in u['lessons']]
dup_ids = [i for i, n in collections.Counter(ids).items() if n > 1]
if dup_ids:
    warn.append('معرّفات دروس مكرّرة: ' + ', '.join(dup_ids))

for u in units:
    for l in u['lessons']:
        for group, label in ((l['cards'], 'بطاقات'), (l['interactions'], 'تفاعلات'), (l['quiz'], 'أسئلة')):
            gids = [x['id'] for x in group]
            d = [i for i, n in collections.Counter(gids).items() if n > 1]
            if d:
                warn.append(f"{l['id']}: معرّفات {label} مكرّرة: {d}")

# ٢) تكرار نصوص شرعية (قرآن/حديث/ذكر) داخل الوحدة الواحدة
seen_src = collections.defaultdict(list)
for u in units:
    for l in u['lessons']:
        for c in l['cards']:
            if c['type'] in ('quran', 'hadith', 'dhikr'):
                seen_src[norm(c.get('text'))].append(f"{u['id']}/{l['id']}/{c['id']}")
repeats = {k: v for k, v in seen_src.items() if len(v) > 1}
# التكرار بين أذكار الصباح والمساء مقصود وموجود في الكتاب نفسه
intended = []
for k, v in list(repeats.items()):
    us = {p.split('/')[0] for p in v}
    ls = {p.split('/')[1] for p in v}
    if us == {'u5'} and ls <= {'u5l1', 'u5l2', 'u5l3', 'u5l4'}:
        intended.append((k, v))
        del repeats[k]
if repeats:
    for k, v in repeats.items():
        warn.append('نصّ شرعي مكرّر في مواضع: ' + ', '.join(v) + ' — ' + k[:60])

# ٣) تكرار نصوص الأسئلة داخل الدرس الواحد
for u in units:
    for l in u['lessons']:
        prompts = [norm(q.get('prompt')) for q in l['quiz'] + l['interactions'] if q.get('prompt')]
        d = [p for p, n in collections.Counter(prompts).items() if n > 1]
        if d:
            warn.append(f"{l['id']}: سؤال مكرّر — {d[0][:60]}")

# ٤) السقوط: كل عنوان في فهرس الكتاب له درس
#    الفهرس مأخوذ من صفحات ٧٥-٧٩ من الكتاب (فهرس الموضوعات).
TOC = [
    ('الاستعاذة', 7), ('البسملة', 7), ('سورة الفاتحة', 8), ('آية الكرسي', 10),
    ('آخر آيتين من سورة البقرة', 11), ('سورة الكافرون', 12), ('سورة الإخلاص', 13),
    ('سورة الفلق', 13), ('سورة الناس', 14),
    ('الحديث الأول', 18), ('الحديث الثاني', 18), ('الحديث الثالث', 18),
    ('أركان الإسلام', 23), ('أركان الإيمان', 24), ('الإحسان', 26),
    ('شروط الوضوء', 30), ('أركان الوضوء', 30), ('من سنن الوضوء', 30),
    ('نواقض الوضوء', 32), ('شروط الصلاة', 32), ('أركان الصلاة', 32),
    ('واجبات الصلاة', 33), ('من سنن الصلاة', 34), ('مبطلات الصلاة', 36),
    ('من صلاة التطوع', 36),
    ('أذكار الصباح', 41), ('أذكار المساء', 44), ('الأذكار بعد الصلوات الخمس', 47),
    ('أذكار النوم', 49), ('أذكار الاستيقاظ من النوم', 50),
    ('إن رأى في نومه ما يكره', 50), ('من استيقظ من الليل', 51),
    ('الأكل والشرب', 51), ('الخلاء', 52), ('السلام', 52), ('الاستئذان', 52),
    ('المسجد', 53), ('عند العطاس', 53), ('التثاؤب', 54), ('عند الكرب', 54),
    ('الاستخارة', 54), ('صلة الرحم', 55),
    ('الصدق', 59), ('الصبر', 59), ('الأمانة', 60), ('العفاف', 60), ('الحياء', 61),
    ('الشجاعة', 61), ('الكرم', 62), ('الوفاء', 62), ('حسن الجوار', 63),
    ('مساعدة ذي الحاجة', 63),
    ('الخوف والرجاء', 67), ('الصحة والفراغ', 67), ('المبادرة بالأعمال الصالحة', 67),
    ('عابر سبيل', 68), ('الصور والأعمال', 68), ('لا يتبعك إلا عملك', 68),
    ('برحمة الله لا بالعمل', 69), ('رحمة الله', 69), ('فتنة النساء', 70),
    ('فتنة المال', 70), ('المجاهدة', 70), ('بين حُبّ لقاء الله وكُرهه', 71),
]
lesson_titles = {norm(l['title']): (u['id'], l['id'], l['source']['pages'])
                 for u in units for l in u['lessons']}
missing, page_mismatch = [], []
for title, page in TOC:
    key = norm(title)
    hit = lesson_titles.get(key)
    if not hit:
        cands = [v for k, v in lesson_titles.items() if key in k or k in key]
        if cands:
            hit = cands[0]
    if not hit:
        missing.append(title)
    elif page not in hit[2]:
        page_mismatch.append((title, page, hit[2], hit[1]))

if missing:
    warn.append('عناوين من فهرس الكتاب بلا درس مقابل: ' + '، '.join(missing))
for t, p, got, lid in page_mismatch:
    warn.append(f'صفحة غير مطابقة للفهرس: «{t}» الفهرس ص{p} والدرس {lid} ص{got}')

# دروس زائدة على الفهرس (مقدّمات فصول أضفناها)
toc_norm = {norm(t) for t, _ in TOC}
extra = [(u['id'], l['id'], l['title']) for u in units for l in u['lessons']
         if norm(l['title']) not in toc_norm
         and not any(norm(l['title']) in t or t in norm(l['title']) for t in toc_norm)]

# ٥) تغطية صفحات الكتاب
pages_covered = set()
for u in units:
    a, b = u['source']['pages']
    pages_covered |= set(range(a, b + 1))
content_pages = set(range(6, 74))   # المحتوى العلمي: من ص٦ إلى ص٧٣
uncovered = sorted(content_pages - pages_covered)
if uncovered:
    warn.append('صفحات محتوى غير مغطّاة بأي وحدة: ' + str(uncovered))

# ------------------------------------------------------------------ التقرير
o = []
w = o.append
w('# ضبط الأعداد — بَرْدُ اليقين، الجزء الأول\n')
w('مُولَّد آليًّا من `content/*.json`. لإعادة التوليد: `python3 scripts/audit_counts.py`.\n')

w('## ١) جدول تفسير الأعداد\n')
w('| العدد | البند | التعريف | طريقة الاحتساب | مصدره |')
w('|---:|---|---|---|---|')
rows = [
 (counts['units'], 'الوحدات',
  'الفصول السبعة كما في الكتاب.',
  'عدد ملفات `content/units/*.json`.', 'الكتاب'),
 (counts['lessons'], 'الدروس',
  'وحدة تعلّم واحدة تُدرَس في جلسة؛ تقابل عنوانًا فرعيًّا في فهرس الكتاب.',
  'مجموع `lessons[]` في الوحدات السبع.', 'تقسيم مبنيّ على فهرس الكتاب'),
 (counts['cards'], 'بطاقات المحتوى',
  'قطعة عرض واحدة داخل الدرس: نصّ قرآني أو حديث أو ذكر أو نصّ من الكتاب أو قائمة أو ملحوظة.',
  'مجموع `cards[]` في كل الدروس.', 'أغلبها من الكتاب — التفصيل أدناه'),
 (counts['interactions'], 'التفاعلات أثناء الدرس',
  'نشاط يُعرض داخل الدرس نفسه قبل الاختبار؛ لا يُحتسب في الدرجة.',
  'مجموع `interactions[]` في كل الدروس.', 'مشتقّة من نصّ الكتاب'),
 (counts['quiz'], 'أسئلة الاختبارات',
  'أسئلة الاختبار القصير في نهاية كل درس؛ تُحتسب في الدرجة وتدخل المراجعة المتباعدة.',
  'مجموع `quiz[]` في كل الدروس.', 'مشتقّة من نصّ الكتاب'),
 (counts['assessment'], 'الأسئلة التحصيلية',
  'الأسئلة المقالية في صفحات «أنشطة» من الكتاب، منقولة حرفيًّا بلا تعديل.',
  '٥ أسئلة × ٧ وحدات.', 'الكتاب حرفيًّا'),
 (counts['tasks'], 'المهام الأدائية',
  'مهام التطبيق في صفحات «مهام أدائية» من الكتاب، منقولة حرفيًّا بلا تعديل.',
  '٥ مهام × ٧ وحدات.', 'الكتاب حرفيًّا'),
 (counts['outcomes'], 'النتائج التعليمية',
  'بنود «المأمول أن يخرج الطالب من هذا الفصل بأمور»، منقولة حرفيًّا.',
  '٥ بنود × ٧ وحدات.', 'الكتاب حرفيًّا'),
]
for n, name, define, how, src in rows:
    w(f'| **{ar(n)}** | {name} | {define} | {how} | {src} |')
w('')

w('## ٢) من أين جاء الرقم ٢٣٦؟\n')
w('«الصياغة التعليمية المساعدة» ليست نوعًا واحدًا، بل مجموع خمسة أنواع. '
  'وكلها تظهر في الواجهة بلصيقة صفراء صريحة: «صياغة تعليمية مساعدة».\n')
w('| العدد | النوع | أين يظهر | لماذا ليس من الكتاب |')
w('|---:|---|---|---|')
AUTH = [
 ('hook', 'مدخل الدرس', 'أول الدرس', 'سؤال أو موقف يشدّ المتعلّم؛ الكتاب لا يحتوي مداخل.'),
 ('objective', 'هدف الدرس', 'بعد المدخل', 'صياغة هدف إجرائي للدرس الواحد؛ الكتاب يذكر أهداف الفصل لا الدرس.'),
 ('summary', 'خلاصة الدرس', 'آخر الدرس', 'تلخيص في ٢-٤ نقاط؛ الكتاب لا يحتوي خلاصات.'),
 ('interaction:scenario', 'موقف حياتي (تفاعل)', 'داخل الدرس', 'موقف واقعي مُصاغ؛ الحكم فيه من الكتاب والصياغة مساعدة.'),
 ('family', 'سؤال النقاش الأسري', 'آخر الدرس، في الاثني عشر درسًا التي فيها نشاط أسري', 'اقتراح نشاط أسري؛ ليس من الكتاب.'),
 ('card:note', 'بطاقة ملحوظة تعليمية', 'داخل محتوى الدرس', 'ربط أو تنبيه يعين على الحفظ؛ لا يضيف حكمًا.'),
 ('quiz:scenario', 'موقف حياتي (اختبار)', 'في الاختبار القصير', 'كسابقه، لكنه يُحتسب في الدرجة.'),
 # تفاعلات مضافة للدروس ذات السؤال الواحد — مستمدّة من نصّ الدرس، صياغتها مساعدة.
 ('interaction:complete', 'إكمال نصّ (تفاعل مضاف)', 'داخل الدرس',
  'إكمال عبارة من نصّ الكتاب بالاختيار؛ لا يضيف حكمًا ولا معلومة من خارجه.'),
 ('interaction:mcq', 'اختيار (تفاعل مضاف)', 'داخل الدرس',
  'سؤال اختيار مبنيّ على نصّ الدرس نفسه.'),
 ('interaction:match', 'مطابقة (تفاعل مضاف)', 'داخل الدرس',
  'مطابقة بين لفظ الكتاب وموضعه أو معناه كما ورد فيه.'),
 ('interaction:order', 'ترتيب خطوات (تفاعل مضاف)', 'داخل الدرس',
  'ترتيب خطوات ثابت في نصّ الكتاب.'),
 ('interaction:classify', 'تصنيف (تفاعل مضاف)', 'داخل الدرس',
  'تصنيف أمثلة ذكرها الكتاب أو نفاها.'),
 ('interaction:truefalse', 'صحيح/خطأ (تفاعل مضاف)', 'داخل الدرس',
  'حكم على عبارة مأخوذ من نصّ الكتاب.'),
 ('interaction:complete-quran', 'إكمال مقطع قرآني بالاختيار', 'داخل الدرس',
  'موجود من قبل ومشتقّ من الآية، لكنّ خيارات الإلهاء تُشبه القرآن وليست منه '
  '— فرُفع إلى أعلى أولوية مراجعة.'),
]
tot = 0
for key, name, where, why in AUTH:
    n = authored.get(key, 0)
    tot += n
    w(f'| {ar(n)} | {name} | {where} | {why} |')
w(f'| **{ar(tot)}** | **المجموع** | | |')
w('')
w(f"وإليها تُضاف **{ar(counts['quran'])}** بطاقة نصّ قرآني (سببها مختلف: لم تُستخرج من ملف PDF "
  f"بل كُتبت بالرسم المعتمد)، فيكون إجمالي ما يحتاج مراجعة **{ar(counts['needsReview'])}**.\n")

w('## ٣) تفصيل بطاقات المحتوى\n')
TA = {'quran': 'نصّ قرآني', 'hadith': 'حديث نبوي', 'dhikr': 'ذكر أو دعاء',
      'text': 'نصّ منقول من الكتاب', 'list': 'قائمة منقولة من الكتاب', 'note': 'ملحوظة تعليمية مساعدة'}
w('| العدد | النوع | المصدر |')
w('|---:|---|---|')
for t, n in card_types.most_common():
    src = 'الكتاب حرفيًّا' if t in ('hadith', 'dhikr', 'text', 'list') else (
        'كُتب بالرسم المعتمد — يحتاج مراجعة' if t == 'quran' else 'صياغة مساعدة — تحتاج مراجعة')
    w(f'| {ar(n)} | {TA.get(t, t)} | {src} |')
w(f"| **{ar(counts['cards'])}** | **المجموع** | |")
w('')
book_cards = sum(card_types[t] for t in ('hadith', 'dhikr', 'text', 'list'))
w(f"أي أن **{ar(book_cards)}** بطاقة من أصل {ar(counts['cards'])} "
  f"({round(book_cards / counts['cards'] * 100)}٪) منقولة من الكتاب حرفيًّا.\n")

w('## ٤) تفصيل التفاعلات والأسئلة\n')
KA = {'mcq': 'اختيار من متعدّد', 'truefalse': 'صحيح وخطأ', 'order': 'ترتيب الخطوات',
      'match': 'مطابقة مصطلح بمعناه', 'complete': 'إكمال النصّ',
      'scenario': 'موقف حياتي', 'flashcards': 'بطاقات تذكّر'}
w('| النوع | داخل الدرس | في الاختبار | المجموع |')
w('|---|---:|---:|---:|')
for k in sorted(set(inter_kinds) | set(quiz_kinds), key=lambda x: -(inter_kinds[x] + quiz_kinds[x])):
    w(f'| {KA.get(k, k)} | {ar(inter_kinds[k])} | {ar(quiz_kinds[k])} | {ar(inter_kinds[k] + quiz_kinds[k])} |')
w(f"| **المجموع** | **{ar(counts['interactions'])}** | **{ar(counts['quiz'])}** "
  f"| **{ar(counts['interactions'] + counts['quiz'])}** |")
w('')
w('> **فرق مهم:** «التفاعل» يُعرض أثناء الدرس للتثبيت ولا يدخل في الدرجة. '
  'و«سؤال الاختبار» يُحتسب في الدرجة ويدخل خطة المراجعة المتباعدة عند الخطأ. '
  'وبطاقات التذكّر لا تُحتسب في الدرجة حتى لو وردت في قائمة الأسئلة.\n')

w('## ٥) متوسّطات لكل درس\n')
w('| البند | المتوسّط | الأدنى | الأعلى |')
w('|---|---:|---:|---:|')
for label, key in (('بطاقات', 'cards'), ('تفاعلات', 'interactions'), ('أسئلة', 'quiz')):
    vals = [len(l[key]) for u in units for l in u['lessons']]
    w(f'| {label} | {ar(round(sum(vals) / len(vals), 1))} | {ar(min(vals))} | {ar(max(vals))} |')
w('')

w('## ٦) التحقّق من عدم التكرار والسقوط\n')
w('| الفحص | النتيجة |')
w('|---|---|')
w(f"| معرّفات الدروس فريدة | {'✅ لا تكرار' if not dup_ids else '❌ ' + str(dup_ids)} |")
w('| معرّفات البطاقات والأسئلة فريدة داخل كل درس | '
  f"{'✅ لا تكرار' if not any('مكرّرة' in x for x in warn) else '❌ انظر التحذيرات'} |")
w(f"| نصّ شرعي مكرّر بلا قصد | {'✅ لا يوجد' if not repeats else '❌ ' + str(len(repeats))} |")
w(f"| تكرار مقصود (ألفاظ مشتركة بين أذكار الصباح والمساء، وهو في الكتاب نفسه) "
  f"| ℹ️ {ar(len(intended))} نصًّا |")
w(f"| عناوين فهرس الكتاب ({ar(len(TOC))} عنوانًا) لها دروس | "
  f"{'✅ كلها مغطّاة' if not missing else '❌ ناقص: ' + '، '.join(missing)} |")
w(f"| مطابقة صفحات الدروس لصفحات الفهرس | "
  f"{'✅ مطابقة' if not page_mismatch else '⚠️ ' + str(len(page_mismatch)) + ' اختلاف'} |")
w(f"| تغطية صفحات المحتوى (٦–٧٣) | "
  f"{'✅ كاملة' if not uncovered else '❌ ناقص: ' + str(uncovered)} |")
w('')
w(f"### دروس زائدة على فهرس الكتاب ({ar(len(extra))})\n")
if extra:
    w('هذه ليست محتوًى مستحدثًا، بل مقدّمات نقلتها من متن الفصل نفسه لتكون مدخلًا له:\n')
    w('| الوحدة | الدرس | العنوان |')
    w('|---|---|---|')
    for uid, lid, t in extra:
        w(f'| {uid} | `{lid}` | {t} |')
else:
    w('لا يوجد.')
w('')
w(f"إذًا: {ar(len(TOC))} عنوانًا من الفهرس + {ar(len(extra))} مقدّمات فصول "
  f"= **{ar(counts['lessons'])}** درسًا.\n")

if intended:
    w('### التكرار المقصود\n')
    w('ألفاظ تتكرّر بين أذكار الصباح والمساء وأذكار ما بعد الصلاة، وهي مكرّرة في الكتاب نفسه '
      '(سيّد الاستغفار، ودعاء العافية، والتسبيح والتهليل…). إبقاؤها مقصود حتى يقرأ المستخدم '
      'كل باب كاملًا دون إحالة:\n')
    w('| النصّ (مطلعه) | المواضع |')
    w('|---|---|')
    for k, v in intended[:12]:
        w(f"| {k[:55]}… | {'، '.join(v)} |")
    w('')

if warn:
    w('## ⚠️ تحذيرات\n')
    for x in warn:
        w(f'- {x}')
    w('')
else:
    w('## ✅ لا تحذيرات\n')
    w('لم يُكتشف تكرار غير مقصود ولا سقوط في المحتوى.\n')

open(os.path.join(D, 'COUNTS.md'), 'w', encoding='utf-8').write('\n'.join(o))
print('docs/COUNTS.md')
for x in warn:
    print('WARN:', x)
print('lessons=%d cards=%d inter=%d quiz=%d authored=%d quran=%d review=%d'
      % (counts['lessons'], counts['cards'], counts['interactions'], counts['quiz'],
         counts['authored_total'], counts['quran'], counts['needsReview']))
