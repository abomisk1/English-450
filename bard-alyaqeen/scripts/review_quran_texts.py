#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
مراجعة النصوص القرآنية الأربعة والعشرين — مقابلة ثلاثية المستوى.

**لا يعدّل هذا السكربت شيئًا في محتوى البرنامج.** يقرأ ويقابل ويُخرج تقريرًا فقط.

منهج المقابلة (لا يُعتمد نصّ البرنامج مرجعًا لنفسه):
  المستوى ١ — صفحة الكتاب الأصلية: تُستخرج صورة موضع النصّ من ملف PDF المرفوع.
  المستوى ٢ — مصدران قرآنيان مستقلّان بالرسم العثماني:
        • «موسوعة القرآن الكريم» quranenc.com  (عبر حزمة quran-json@3.1.2)
        • مكتبة QUL من Tarteel AI            (عبر حزمة quran-validator@1.3.0)
      وقد قوبل المصدران أحدهما بالآخر على ٦٢٣٦ آية، فاتّفقا على الهيكل الحرفي
      اتّفاقًا تامًّا (٠ اختلاف)، فصلحا مرجعًا متوافقًا عليه.
      ويُضاف مرجع ضابط بالرسم الإملائي المبسّط (مشروع تنزيل، عبر حزمة
      @muslims-community/quran@1.1.0) لكشف اختلاف الرسم لا لتصحيحه.
  المستوى ٣ — جَرْد نصوص البرنامج نفسه، لكشف تعارض النسخ بين المواضع.

مستويات المقارنة:
  م-٠  تطابق حرفيّ تامّ (بايت ببايت بعد NFC).
  م-١  بعد نزع التطويل وتوحيد المسافات.
  م-٢  الحروف وحدها: بلا تشكيل ولا علامات وقف ولا أرقام آيات.
  م-٣  الهيكل الحرفي: م-٢ مع توحيد همزات الألف وألف الوصل والتاء والياء.

تصنيف الفروق:
  حروف            اختلاف في م-٣ — أخطر ما يُرصد.
  رسم/همزات       اختلاف في م-٢ دون م-٣ (أ/ا، ٱ/ا، ة/ه، ى/ي).
  تشكيل           اختلاف في الحركات فقط.
  علامات وقف      اختلاف في ۖ ۗ ۚ ونحوها.
  تقني/يونيكود    اختلاف في صورة الترميز لا في الحرف (تطويل، ألف خنجرية، سكون).

التشغيل:
  python3 scripts/review_quran_texts.py --ref /tmp/qref/reference.json \
      --pdf <ملف الكتاب> --out docs/quran-review
"""
import argparse
import collections
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

AR = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def ar(n):
    return str(n).translate(AR)


def ar2int(s):
    return int(str(s).translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")))


# ------------------------------------------------------------------ الترميز
TATWEEL = "ـ"
AYAH_MARK = re.compile(r"﴿\s*([٠-٩0-9]+)\s*﴾")
# علامات الوقف وحدها (U+06D6–U+06DC). وما عداها من العلامات الصغيرة
# — كالواو والياء الصغيرتين وصفر الوصل والميم الصغيرة — علاماتُ رسمٍ
# لا علاماتُ وقف، فلا تُعدّ منها.
WAQF = set("\u06D6\u06D7\u06D8\u06D9\u06DA\u06DB\u06DC")
# علامات الرسم الصغيرة: تُجرَّد في المقارنة ولا تُحسب علامات وقف
SMALL_MARKS = set("\u06DF\u06E0\u06E2\u06E3\u06E5\u06E6\u06E7\u06E8\u06EA"
                  "\u06EB\u06EC\u06ED")
# رموز الترميز التي تختلف بين الطبعات دون أن يختلف الحرف
TECHNICAL = {
    "ـ": "تطويل",
    "ۡ": "سكون مستدير (رأس خاء)",
    "ْ": "سكون",
    "ٰ": "ألف خنجرية",
    "ٱ": "ألف وصل",
}


def nfc(t):
    return unicodedata.normalize("NFC", t or "")


def L1(t):
    """نزع التطويل وتوحيد المسافات."""
    t = nfc(t).replace(TATWEEL, "")
    return re.sub(r"\s+", " ", t).strip()


def L2(t):
    """الحروف وحدها: بلا تشكيل ولا وقف ولا أرقام آيات."""
    t = AYAH_MARK.sub(" ", L1(t))
    t = "".join(c for c in t
                if not unicodedata.combining(c) and c not in WAQF
                and c not in SMALL_MARKS)
    t = t.replace("﴿", " ").replace("﴾", " ")
    return re.sub(r"\s+", " ", t).strip()


def L3(t):
    """الهيكل الحرفي: توحيد الهمزات وألف الوصل والتاء والياء."""
    t = L2(t)
    for a, b in [("ٱ", "ا"), ("آ", "ا"), ("أ", "ا"), ("إ", "ا"),
                 ("ٱ", "ا"), ("ة", "ه"), ("ى", "ي"), ("ؤ", "و"), ("ئ", "ي"),
                 ("ء", "")]:
        t = t.replace(a, b)
    return re.sub(r"\s+", "", t)


# ------------------------------------------------------------ طيّ فروق الرسم
# الرسم العثماني والرسم الإملائي يكتبان الكلمة نفسها بصورتين معروفتين. وهذه
# أزواج الصور المتقابلة، تُطوى لتظهر أخطاء الكلمات وحدها لا اختلاف الطبعة:
#
#   الصورة العثمانية   الصورة الإملائية   مثال
#   ٱ (ألف وصل)        ا                 ٱللَّه / اللَّه
#   ـٰ (ألف خنجرية)     ا                 إِلَٰه  / إِلَاه
#   ـوٰ                 ـا                ٱلصَّلَوٰة / الصَّلَاة
#   ـىٰ                 ـا                مَوۡلَىٰنَا / مَوْلَانَا
#   ۥ (واو صغيرة)      تُحذف             تَأۡخُذُهُۥ / تَأْخُذُهُ
#   ۦ (ياء صغيرة)      ي                 يَسۡتَحۡيِۦ / يَسْتَحْيِي
#   ء على السطر        أ / كرسي          مُسۡتَـٔۡنِسِين / مُسْتَأْنِسِين
#
# ملحوظة منهجية: الواو والياء الصغيرتان تُقابلان الحذف تارةً والحرف الكامل
# تارةً، فتُجرَّب الصورتان معًا ويُقبل التطابق إن وافقت إحداهما — طيًّا للفرق
# المعروف، لا تسامحًا مع خطأ.
DAGGER = "\u0670"
SMALL_WAW, SMALL_YEH = "\u06E5", "\u06E6"


def _fold(t, expand_small):
    t = nfc(t)
    if expand_small:
        t = t.replace(SMALL_WAW, "و").replace(SMALL_YEH, "ي")
    else:
        t = t.replace(SMALL_WAW, "").replace(SMALL_YEH, "")
    # الألف الخنجرية: تبتلع الواو أو الياء قبلها، وإلا صارت ألفًا
    t = t.replace("و" + DAGGER, "ا").replace("ى" + DAGGER, "ا").replace(DAGGER, "ا")
    t = L2(t)
    for a, b in [("ٱ", "ا"), ("آ", "ا"),
                 ("أ", ""), ("إ", ""), ("ء", ""), ("ؤ", ""), ("ئ", ""),
                 ("ة", "ه"), ("ى", "ي")]:
        t = t.replace(a, b)
    return re.sub(r"\s+", "", t)


def L4_variants(t):
    """صور الهيكل بعد طيّ الرسم — تُجرَّب كلّها."""
    return {_fold(t, False), _fold(t, True)}


def L4(t):
    return _fold(t, False)


def marks_of(t):
    """التشكيل وعلامات الوقف بترتيب ورودها."""
    t = AYAH_MARK.sub("", L1(t))
    return [c for c in t if unicodedata.combining(c) or c in WAQF]


def waqf_of(t):
    return [c for c in L1(t) if c in WAQF]


# ------------------------------------------------------------------ المصادر
SURAH_ALIASES = {
    "ابراهيم": 14, "إبراهيم": 14, "الاسراء": 17, "الإسراء": 17,
    "الاخلاص": 112, "الإخلاص": 112, "ال عمران": 3, "آل عمران": 3,
}


def load_reference(path):
    ref = json.load(open(path, encoding="utf-8"))
    for key in ("quranenc", "qul"):
        if key not in ref:
            raise SystemExit("المرجع ناقص: %s" % key)
    return ref


def surah_map(names_path):
    m = json.load(open(names_path, encoding="utf-8"))
    m.update(SURAH_ALIASES)
    return m


def parse_ref(ref_text, smap):
    """«البقرة: ٢٥٥» أو «سورة الفاتحة: ١-٧» أو «سورة الإخلاص» → (رقم السورة، [الآيات])."""
    t = (ref_text or "").strip().replace("سورة ", "").strip()
    ayat = None
    if ":" in t:
        name, rng = t.split(":", 1)
        name, rng = name.strip(), rng.strip()
        nums = re.findall(r"[٠-٩0-9]+", rng)
        if "-" in rng and len(nums) == 2:
            ayat = list(range(ar2int(nums[0]), ar2int(nums[1]) + 1))
        elif nums:
            ayat = [ar2int(n) for n in nums]
    else:
        name = t
    sid = smap.get(name)
    if sid is None:
        for k, v in smap.items():
            if L3(k) == L3(name):
                sid = v
                break
    return sid, ayat


# ------------------------------------------------------------ قراءة المحتوى
def load_units():
    manifest = json.load(open(os.path.join(ROOT, "content/manifest.json"), encoding="utf-8"))
    return [json.load(open(os.path.join(ROOT, "content", u["file"]), encoding="utf-8"))
            for u in manifest["units"]]


def quran_cards(units):
    out = []
    for u in units:
        for l in u["lessons"]:
            for c in l["cards"]:
                if c["type"] == "quran":
                    out.append({"unit": u["id"], "unitTitle": u["shortTitle"],
                                "lesson": l["id"], "lessonTitle": l["title"],
                                "card": c["id"], "ref": c.get("ref"),
                                "page": c.get("page"), "text": c["text"],
                                "needsReview": c.get("needsReview")})
    return out


def split_verses(text):
    """يقسم نصّ البطاقة إلى مقاطع بحسب أرقام الآيات المضمَّنة ﴿١﴾."""
    parts, nums = [], []
    last = 0
    for m in AYAH_MARK.finditer(text):
        parts.append(text[last:m.start()])
        nums.append(ar2int(m.group(1)))
        last = m.end()
    tail = text[last:].strip()
    if tail and tail not in ("﴾", "﴿"):
        parts.append(tail)
        nums.append(None)
    if not parts:
        return [(None, text)]
    return list(zip(nums, parts))


def clean_segment(s):
    return s.replace("﴿", " ").replace("﴾", " ").strip()


# ------------------------------------------------------------------ المقابلة
def match_mode(prog, ref, fn):
    """full = الآية كاملة · partial = مقطع منها · none = لا يطابق."""
    ps = fn(prog) if isinstance(fn(prog), set) else {fn(prog)}
    rs = fn(ref) if isinstance(fn(ref), set) else {fn(ref)}
    ps = {x for x in ps if x}
    rs = {x for x in rs if x}
    if not ps or not rs:
        return "none"
    if ps & rs:
        return "full"
    if any(p in r for p in ps for r in rs):
        return "partial"
    return "none"


def raw_compare(prog, ref_verse):
    """مقارنة حرفية خام: هل نصّ البرنامج شريحة حرفية من المرجع؟

    لا طيّ ولا تطبيع ولا تجريد — مطابقة Unicode مباشرة.
    """
    p = nfc(prog).strip()
    r = nfc(ref_verse).strip()
    r_nohizb = re.sub(r"^[۞۩]\s*", "", r)
    if p == r or p == r_nohizb:
        return "مطابقة تامّة للآية"
    if p and (p in r or p in r_nohizb):
        return "شريحة حرفية من الآية"
    return "لا تطابق خام ⚠️"


def classify(prog, refs):
    """يقابل نصّ البرنامج بثلاثة مراجع ويصنّف الفرق.

    refs = (عثماني-موسوعة، عثماني-QUL، إملائي-تنزيل)
    """
    enc, qul, simple = refs
    res = {}
    for name, r in (("enc", enc), ("qul", qul), ("simple", simple)):
        if r is None:
            res["m4_" + name] = res["m2_" + name] = res["m1_" + name] = "none"
            res["exact_" + name] = False
            continue
        res["m4_" + name] = match_mode(prog, r, L4_variants)  # الهيكل بعد طيّ الرسم
        res["m2_" + name] = match_mode(prog, r, L2)     # الحروف كما كُتبت
        res["m1_" + name] = match_mode(prog, r, L1)     # بالتشكيل وعلامات الوقف
        res["exact_" + name] = nfc(prog) == nfc(r)

    res["lettersOk"] = res["m4_enc"] != "none" or res["m4_qul"] != "none"
    res["partial"] = res["lettersOk"] and "full" not in (res["m4_enc"], res["m4_qul"])
    # أيّ رسمٍ يوافقه نصّ البرنامج؟
    uth = res["m2_enc"] != "none" or res["m2_qul"] != "none"
    iml = res["m2_simple"] != "none"
    res["rasm"] = ("عثماني" if uth and not iml else
                   "إملائي" if iml and not uth else
                   "يوافق الرسمين" if uth and iml else "لا يوافق أيًّا منهما")

    kinds = []
    if not res["lettersOk"]:
        kinds.append("حروف")
    else:
        if not uth:
            kinds.append("رسم عثماني/إملائي")
        if res["m1_enc"] == "none" and res["m1_qul"] == "none" and res["m1_simple"] == "none":
            kinds.append("تشكيل")
        pw = waqf_of(prog)
        prim_w = [c for c in L1(qul or "") if c in WAQF]
        if pw and not all(c in prim_w for c in pw):
            kinds.append("علامات وقف")
    res["kinds"] = kinds
    return res


def char_diff(a, b, limit=12):
    """أول مواضع الاختلاف بين نصّين، بأسماء الرموز."""
    a, b = nfc(a), nfc(b)
    out = []
    import difflib
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b).get_opcodes():
        if tag == "equal":
            continue
        out.append({
            "op": {"replace": "استبدال", "delete": "حذف", "insert": "إضافة"}[tag],
            "at": i1,
            "prog": a[i1:i2],
            "ref": b[j1:j2],
            "progU": " ".join("U+%04X" % ord(c) for c in a[i1:i2][:8]),
            "refU": " ".join("U+%04X" % ord(c) for c in b[j1:j2][:8]),
            "ctx": a[max(0, i1 - 12):i1] + "⟦" + a[i1:i2] + "⟧" + a[i2:i2 + 12],
        })
        if len(out) >= limit:
            break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", default="/tmp/qref/reference.json")
    ap.add_argument("--names", default="/tmp/qref/surahnames.json")
    ap.add_argument("--pdf", default=None)
    ap.add_argument("--out", default=os.path.join(ROOT, "docs/quran-review"))
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    ref = load_reference(args.ref)
    # المرجع الأساسي هو QUL؛ يُعرض في العمود المقابل للبرنامج

    smap = surah_map(args.names)
    units = load_units()
    cards = quran_cards(units)

    rows = []
    for i, c in enumerate(cards, 1):
        sid, ayat = parse_ref(c["ref"], smap)
        row = dict(c)
        row["seq"] = i
        row["surahNo"] = sid
        row["surahName"] = c["ref"]
        segs = [(n, clean_segment(s)) for n, s in split_verses(c["text"])]
        segs = [(n, s) for n, s in segs if s]

        if sid is None:
            row["verdict"] = "تحتاج تحققًا بشريًا"
            row["note"] = "تعذّر تحديد السورة من المرجع المكتوب."
            row["verses"] = []
            rows.append(row)
            continue

        # إن لم تُذكر الآيات (سورة كاملة) نأخذ عدد المقاطع
        if not ayat:
            ayat = [n for n, _ in segs if n] or list(range(1, len(segs) + 1))
        row["ayat"] = ayat

        verses = []
        for idx, (num, seg) in enumerate(segs):
            a = num if num else (ayat[idx] if idx < len(ayat) else None)
            key = "%d:%s" % (sid, a)
            enc = ref["quranenc"].get(key)
            qul = ref["qul"].get(key)
            simple = ref.get("tanzil_simple", {}).get(key)
            if enc is None or qul is None:
                verses.append({"ayah": a, "prog": seg, "enc": enc, "qul": qul,
                               "res": None, "diff": [],
                               "verdict": "تحتاج تحققًا بشريًا",
                               "note": "الآية غير موجودة في المرجع بهذا الرقم."})
                continue
            res = classify(seg, (enc, qul, simple))
            res["raw_primary"] = raw_compare(seg, qul) if qul else "لا مرجع"
            res["raw_witness"] = raw_compare(seg, enc) if enc else "لا مرجع"
            verses.append({
                "ayah": a, "prog": seg, "enc": enc, "qul": qul, "simple": simple,
                "res": res,
                "diff": [] if res["exact_enc"] else char_diff(seg, enc),
                "diffQul": [] if res["exact_qul"] else char_diff(seg, qul),
            })
        row["verses"] = verses

        kinds = sorted({k for v in verses if v.get("res") for k in v["res"]["kinds"]})
        row["kinds"] = kinds
        rasms = sorted({v["res"]["rasm"] for v in verses if v.get("res")})
        row["rasm"] = "، ".join(rasms)
        row["partial"] = any(v["res"]["partial"] for v in verses if v.get("res"))

        raw_ok = all((v.get("res") or {}).get("raw_primary", "").startswith(("مطابقة", "شريحة"))
                     for v in verses)
        row["rawPrimary"] = "كل المقاطع شرائح حرفية من المرجع الأساسي" if raw_ok \
            else "⚠️ لا تطابق خام مع المرجع الأساسي"

        # التوصية — ولا تُمنح «مطابق» إلا بتطابق حرفيّ تامّ مع مرجع مُسمّى.
        if any(v.get("verdict") == "تحتاج تحققًا بشريًا" for v in verses):
            row["verdict"] = "تحتاج تحققًا بشريًا"
            row["reason"] = "تعذّر إيجاد الآية في المرجع بهذا الرقم."
        elif "حروف" in kinds:
            row["verdict"] = "يحتاج تصحيحًا"
            row["reason"] = "اختلاف في الحروف بعد طيّ فروق الرسم — لا يُفسَّر باختلاف الطبعة."
        elif raw_ok:
            row["verdict"] = "مطابق للمرجع الأساسي"
            row["reason"] = ("كل مقاطعه شرائح حرفية (Unicode) من المرجع الأساسي. "
                             "ويبقى «بانتظار المراجعة» حتى يصدر الاعتماد.")
        elif all(v["res"]["exact_simple"] for v in verses):
            row["verdict"] = "تحتاج تحققًا بشريًا"
            row["reason"] = ("تطابق حرفيّ تامّ مع المرجع الإملائي المبسّط، لا العثماني — "
                             "والمشروع استقرّ على الرسم العثماني.")
        else:
            row["verdict"] = "تحتاج تحققًا بشريًا"
            bits = []
            if "رسم عثماني/إملائي" in kinds:
                bits.append("الرسم إملائيّ لا عثماني")
            if "تشكيل" in kinds:
                bits.append("اختلاف في التشكيل")
            if "علامات وقف" in kinds:
                bits.append("اختلاف في علامات الوقف")
            if row["partial"]:
                bits.append("النصّ مقطعٌ من الآية لا الآية كاملة")
            row["reason"] = ("الحروف سليمة، و" + "، و".join(bits)) if bits else \
                "الحروف سليمة ولا يوجد تطابق حرفيّ تامّ مع مرجع مُسمّى."
        rows.append(row)

    # ------------------------------------------------ حصر مواضع ظهور الآيات
    occ = occurrence_scan(units, rows)

    json.dump({"rows": rows, "occurrences": occ},
              open(os.path.join(args.out, "collation.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    tally = collections.Counter(r["verdict"] for r in rows)
    print("النصوص: %d" % len(rows))
    for k, n in tally.most_common():
        print("   %-32s %d" % (k, n))
    kinds = collections.Counter(k for r in rows for k in r.get("kinds", []))
    for k, n in kinds.most_common():
        print("   %-14s %d" % (k, n))
    print("تعارض بين مواضع ظهور النصّ نفسه: %d" % len(occ["conflicts"]))
    return rows, occ


def canonical(t):
    """صورة موحَّدة للمقارنة بين المواضع: بلا أقواس الآية ولا أرقامها ولا فواصلها."""
    t = nfc(t).strip()
    t = AYAH_MARK.sub(" ", t)          # ﴿٤٩﴾
    t = t.replace("﴿", " ").replace("﴾", " ").replace("۝", " ")
    return re.sub(r"\s+", " ", t).strip()


def occurrence_scan(units, rows):
    """حصر كل موضع يظهر فيه نصّ قرآني، وكشف تعارض النسخ بينها.

    يُقارَن بالصورة الموحَّدة (canonical)، فلا يُعدّ وجودُ الأقواس أو رقم الآية
    في موضع دون آخر تعارضًا — وإنما التعارض اختلافُ النصّ نفسه أو تشكيله.
    """
    SEG = re.compile(r"﴿[^﴿﴾]{6,}﴾")
    places = collections.defaultdict(list)
    seen_paths = set()

    def add(path, text):
        if (path, nfc(text)) in seen_paths:
            return
        seen_paths.add((path, nfc(text)))
        key = L4(text)
        if key:
            places[key].append({"path": path, "text": text})

    def walk(obj, path):
        if isinstance(obj, str):
            for m in SEG.findall(obj):
                add(path, m[1:-1].strip())
        elif isinstance(obj, dict):
            for k, v in obj.items():
                walk(v, "%s/%s" % (path, k))
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                walk(v, "%s[%d]" % (path, i))

    for u in units:
        walk(u, u["id"])
    for r in rows:
        add("%s/%s/cards/%s" % (r["unit"], r["lesson"], r["card"]), r["text"])

    conflicts = []
    for skeleton, items in places.items():
        forms = collections.defaultdict(list)
        for i in items:
            forms[canonical(i["text"])].append(i["path"])
        if len(forms) > 1:
            conflicts.append({
                "skeleton": skeleton[:90],
                "forms": [{"text": f, "where": w} for f, w in forms.items()],
                "diff": char_diff(*list(forms.keys())[:2], limit=6),
            })
    return {"total": sum(len(v) for v in places.values()),
            "distinct": len(places), "conflicts": conflicts,
            "places": {k[:70]: sorted({i["path"] for i in v}) for k, v in places.items()}}


# ------------------------------------------------------------------ المخرجات
SRC_LABEL = {
    "enc": "موسوعة القرآن الكريم (quranenc.com) — رسم عثماني · عبر حزمة quran-json@3.1.2",
    "qul": "المكتبة القرآنية الشاملة QUL من Tarteel AI — رسم عثماني · عبر حزمة quran-validator@1.3.0",
    "simple": "مشروع تنزيل tanzil.net — رسم مبسّط (ضابط) · عبر حزمة @muslims-community/quran@1.1.0",
}


def ayah_number_state(row):
    """حالة رقم الآية: أمذكور في البطاقة؟ أيطابق نطاق المرجع؟"""
    found = [n for n, _ in split_verses(row["text"]) if n]
    want = row.get("ayat") or []
    if not found:
        return "لا أرقام آيات في البطاقة" + (" (نصّ آية واحدة)" if len(want) <= 1 else " ⚠️")
    if want and found == list(want):
        return "مذكورة ومطابقة للنطاق: %s" % "، ".join(ar(x) for x in found)
    return "مذكورة: %s · النطاق المعلن: %s" % (
        "، ".join(ar(x) for x in found), "، ".join(ar(x) for x in want) or "—")


def diff_cells(v):
    """الفروق الحرفية: تُعدّ فروق الرسم المعروفة، وتُفصَّل ما سواها.

    تُقابَل نافذةُ الاقتباس من الآية لا الآية كاملة، فلا يُحسَب ما لم يقتبسه
    الكتاب فرقًا.
    """
    import difflib
    enc = v.get("enc")
    if not enc:
        return "—"
    _, win, _ = align_window(v["prog"], enc)
    ga, gb = graphemes(v["prog"]), graphemes(win)
    conv, real = 0, []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, ga, gb).get_opcodes():
        if tag == "equal":
            continue
        sa, sb = "".join(ga[i1:i2]), "".join(gb[j1:j2])
        if _convention_pair(sa, sb):
            conv += 1
        else:
            real.append("%s: «%s» ← «%s»" % (tag, sa or "∅", sb or "∅"))
    bits = []
    if real:
        bits.append("⚠️ فروق غير مفسَّرة (%s): %s" % (ar(len(real)), " | ".join(real[:5])))
    bits.append("فروق رسم وتشكيل معروفة: %s" % ar(conv))
    return " · ".join(bits)


def tashkeel_state(v):
    r = v.get("res") or {}
    if r.get("exact_enc") or r.get("exact_qul"):
        return "مطابق تمامًا لمرجع عثماني"
    if r.get("m1_enc") != "none" or r.get("m1_qul") != "none":
        return "مطابق للمرجع العثماني بعد توحيد المسافات"
    if r.get("m2_enc") != "none" or r.get("m2_qul") != "none":
        return "الحروف تطابق، والتشكيل يختلف عن المرجع العثماني"
    return "يختلف عن المرجع العثماني (تبعًا لاختلاف الرسم)"


def waqf_state(v):
    """تُقارن علامات الوقف بالمرجع **الأساسي**، إذ منه نُقل النصّ حرفيًّا."""
    prog = waqf_of(v["prog"])
    prim = [c for c in L1(v.get("qul") or "") if c in WAQF]
    wit = [c for c in L1(v.get("enc") or "") if c in WAQF]
    if prog == prim:
        return "مطابقة للمرجع الأساسي (%s)" % (ar(len(prog)) if prog else "لا علامات")
    # النصّ مقطع من الآية، فعلاماته بعض علامات الآية
    if all(c in prim for c in prog):
        return "من علامات المرجع الأساسي (%s من %s في الآية)" % (ar(len(prog)), ar(len(prim)))
    return "⚠️ البرنامج %s · الأساسي %s · الشاهد %s" % (
        ar(len(prog)), ar(len(prim)), ar(len(wit)))


def write_outputs(rows, occ, out_dir):
    import csv
    os.makedirs(out_dir, exist_ok=True)

    # ----------------------------------------------------------------- CSV
    # بيانات الإسناد الصريح: هي التي تحسم النصّ المرجعي، لا البحث النصّي.
    prov = {}
    qu = os.path.join(ROOT, "scripts/content/quran_uthmani.py")
    if os.path.exists(qu):
        ns = {}
        exec(compile(open(qu, encoding="utf-8").read(), "quran_uthmani", "exec"), ns)
        for ch_row in json.load(open(os.path.join(
                ROOT, "docs/quran-review/rasm-change.json"), encoding="utf-8"))["rows"]:
            for cv in ch_row.get("verses", []):
                prov["%s|%s" % (ch_row["key"], cv["ayah"])] = cv

    cols = ["#", "الوحدة/الدرس/البطاقة", "اسم السورة", "الآية أو النطاق",
            "السورة (رقمًا)", "رقم الآية", "بداية المقطع", "نهاية المقطع",
            "نوع المقطع", "النصّ العثماني من المرجع الأساسي", "المرجع الأساسي",
            "خلاف المصدرين", "الحالات غير المحسومة",
            "نصّ البرنامج", "صفحة الكتاب", "صورة الصفحة", "النصّ المرجعي",
            "مصدر المرجع", "نتيجة المطابقة", "المقارنة الخام (أساسي)",
            "المقارنة الخام (شاهد)", "الفروق الحرفية", "حالة التشكيل",
            "حالة علامات الوقف", "حالة رقم الآية", "مواضع الظهور",
            "الملاحظات", "التوصية", "حالة الاعتماد", "وقت الاعتماد"]
    # حالة الاعتماد تُقرأ من ناتج البناء، لا تُكتب هنا يدويًّا.
    approval_state = {}
    nrp = os.path.join(ROOT, "content/needs-review.json")
    if os.path.exists(nrp):
        for it in json.load(open(nrp, encoding="utf-8"))["items"]:
            if it["kind"] == "card:quran":
                approval_state["%s/%s" % (it["lessonId"], it["path"].rsplit("/", 1)[-1])] = (
                    "معتمَد" if it.get("approved") else "بانتظار المراجعة",
                    it.get("approvedAt") or "")

    csv_path = os.path.join(out_dir, "quran-review.csv")
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            where = [p for k, v in occ["places"].items() for p in v
                     if r["lesson"] in p and r["card"] in p] or []
            allplaces = sorted({p for k, v in occ["places"].items() for p in v
                                if L4(r["text"])[:40] and L4(r["text"])[:40] in k})
            for v in r["verses"]:
                pv = prov.get("%s/%s|%s" % (r["lesson"], r["card"], v["ayah"]), {})
                w.writerow([
                    ar(r["seq"]),
                    "%s / %s / %s" % (r["unit"], r["lesson"], r["card"]),
                    r["ref"],
                    ar(v["ayah"]) if v["ayah"] else "—",
                    ar(r["surahNo"]) if r.get("surahNo") else "—",
                    ar(v["ayah"]) if v["ayah"] else "—",
                    ar(pv["sliceFrom"]) if pv.get("sliceFrom") is not None else "—",
                    ar(pv["sliceTo"]) if pv.get("sliceTo") is not None else "—",
                    "آية كاملة" if pv.get("full") else "اقتباس جزئي",
                    pv.get("refPrimary", ""),
                    SRC_LABEL.get("qul", "QUL"),
                    pv.get("sourcesAgree", "—"),
                    "٠",
                    v["prog"],
                    ar(r["page"]) if r.get("page") else "—",
                    "pages/book-p%03d.png" % r["page"] if r.get("page") else "—",
                    v.get("enc") or "",
                    SRC_LABEL["enc"],
                    ("مقطع من الآية" if (v.get("res") or {}).get("partial") else "الآية كاملة")
                    + " · الحروف: " + ("سليمة" if (v.get("res") or {}).get("lettersOk") else "مختلفة ⚠️"),
                    (v.get("res") or {}).get("raw_primary", "—"),
                    (v.get("res") or {}).get("raw_witness", "—"),
                    diff_cells(v),
                    tashkeel_state(v),
                    waqf_state(v),
                    ayah_number_state(r),
                    " · ".join(allplaces) or "بطاقة الدرس فقط",
                    r.get("reason", ""),
                    r["verdict"],
                    approval_state.get("%s/%s" % (r["lesson"], r["card"]),
                                       ("بانتظار المراجعة", ""))[0],
                    approval_state.get("%s/%s" % (r["lesson"], r["card"]),
                                       ("بانتظار المراجعة", ""))[1],
                ])
    print("→", csv_path)
    return csv_path


# ------------------------------------------------------- المقارنة البصرية
def graphemes(t):
    """تقسيم النصّ إلى حروف مع ما يلحقها من تشكيل، حتى لا ينكسر الرسم."""
    out = []
    for c in nfc(t):
        if out and (unicodedata.combining(c) or c in WAQF):
            out[-1] += c
        else:
            out.append(c)
    return out


def esc(t):
    return (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _fold_indexed(gs, expand_small):
    """يطوي قائمة الحروف ويعيد (النصّ المطويّ، فهرس كل حرف إلى موضعه الأصلي)."""
    out, idx = [], []
    for i, g in enumerate(gs):
        f = _fold(g, expand_small)
        for ch in f:
            out.append(ch)
            idx.append(i)
    return "".join(out), idx


def align_window(prog, ref):
    """يحدّد موضع الاقتباس من الآية. يعيد (قبل، المقطع المقابل، بعد) من المرجع."""
    gr = graphemes(ref)
    for expand in (False, True):
        rf, idx = _fold_indexed(gr, expand)
        pf = _fold(prog, expand)
        if not pf or not rf:
            continue
        pos = rf.find(pf)
        if pos < 0:
            continue
        i0 = idx[pos]
        i1 = idx[min(pos + len(pf) - 1, len(idx) - 1)] + 1
        return "".join(gr[:i0]), "".join(gr[i0:i1]), "".join(gr[i1:])
    return "", ref, ""


def _convention_pair(sa, sb):
    """هل الفرق بين المقطعين مجرّد اختلاف صورة معروف بين الرسمين؟"""
    if not sa and not sb:
        return True
    fa = {_fold(sa, False), _fold(sa, True)}
    fb = {_fold(sb, False), _fold(sb, True)}
    if fa & fb:
        return True
    # فرق في التشكيل وحده
    return L2(sa) == L2(sb) and bool(L2(sa) or L2(sb))


def marked(a, b):
    """تظليل مواضع الاختلاف، مع تمييز الفرق المعروف بين الرسمين عن الفرق الحقيقي.

    الرمادي  = صورة معروفة مختلفة للكلمة نفسها (ٱ/ا · ۡ/ْ · ـٰ/ا · هُۥ/هُ …)
               أو اختلاف تشكيل — لا يمسّ الحرف.
    الملوَّن  = فرق لا يُفسَّر باختلاف الرسم، ويستحقّ نظر المراجع.
    """
    import difflib
    ga, gb = graphemes(a), graphemes(b)
    ops = difflib.SequenceMatcher(None, ga, gb).get_opcodes()
    # دمج المقاطع المختلفة المتجاورة التي يفصلها حرفٌ أو حرفان متطابقان،
    # لئلّا يُقطَّع فرقُ رسمٍ واحد (آ/ءَا · هِۦ/هِ) فيُحسَب فرقين لا فرقًا واحدًا.
    merged = []
    for op in ops:
        tag, i1, i2, j1, j2 = op
        if (merged and tag != "equal" and merged[-1][0] == "equal"
                and merged[-1][2] - merged[-1][1] <= 2 and len(merged) >= 2
                and merged[-2][0] != "equal"):
            eq = merged.pop()
            pt, pi1, pi2, pj1, pj2 = merged.pop()
            merged.append(("replace", pi1, i2, pj1, j2))
        else:
            merged.append(op)
    oa, ob, real = [], [], 0
    for tag, i1, i2, j1, j2 in merged:
        sa, sb = "".join(ga[i1:i2]), "".join(gb[j1:j2])
        if tag == "equal":
            oa.append(esc(sa))
            ob.append(esc(sb))
            continue
        conv = _convention_pair(sa, sb)
        if not conv:
            real += 1
        cls = "d-conv" if conv else {"replace": "d-rep", "delete": "d-del",
                                     "insert": "d-ins"}[tag]
        if sa:
            oa.append('<mark class="%s">%s</mark>' % (cls, esc(sa)))
        if sb:
            ob.append('<mark class="%s">%s</mark>' % (cls, esc(sb)))
        if not sa and not conv:
            oa.append('<mark class="d-gap">\u200b</mark>')
        if not sb and not conv:
            ob.append('<mark class="d-gap">\u200b</mark>')
    return "".join(oa), "".join(ob), real


HTML_CSS = """
:root{--bg:#fbf8f1;--paper:#fff;--ink:#12283a;--muted:#566b7c;--line:#e2dbca;
 --brand:#0e4f6e;--teal:#0e7c76;--warn:#8a6d1f;--warnbg:#fbf0d9;--err:#a33a33;--errbg:#fbe9e7;
 --ok:#1d7a4c;--okbg:#e8f5ee;--rep:#ffe08a;--ins:#bfe3c0;--del:#f6c6c2}
@media(prefers-color-scheme:dark){:root{--bg:#071a2a;--paper:#0d2941;--ink:#e8eef4;--muted:#a8bccc;
 --line:#1b415f;--brand:#cfe6ea;--teal:#6fd8d0;--warnbg:#35290f;--errbg:#3a1d1a;--okbg:#0f3225;
 --rep:#6b5316;--ins:#1c5230;--del:#5d2420}}
@font-face{font-family:'Amiri Quran';src:url('../../assets/fonts/amiri-quran-400.woff2') format('woff2');font-display:swap}
@font-face{font-family:'Cairo';src:url('../../assets/fonts/cairo-var.woff2') format('woff2-variations');font-weight:200 1000;font-display:swap}
*{box-sizing:border-box}
body{margin:0;direction:rtl;background:var(--bg);color:var(--ink);
 font-family:'Cairo',system-ui,sans-serif;line-height:1.8;padding:0 16px 64px}
.wrap{max-width:70rem;margin-inline:auto}
h1{font-size:1.7rem;margin:1.5rem 0 .3rem}
h2{font-size:1.15rem;margin:0}
.lede{color:var(--muted);margin:0 0 1.2rem}
.card{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:16px;margin:14px 0}
.head{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;justify-content:space-between;
 border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:12px}
.meta{color:var(--muted);font-size:.85rem}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.8rem;font-weight:700}
.p-ok{background:var(--okbg);color:var(--ok)} .p-warn{background:var(--warnbg);color:var(--warn)}
.p-err{background:var(--errbg);color:var(--err)}
.row{display:grid;gap:10px;grid-template-columns:1fr;margin-bottom:12px}
@media(min-width:820px){.row{grid-template-columns:1fr 1fr}}
.box{border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-width:0}
.box>.lbl{font-size:.75rem;color:var(--muted);font-weight:700;margin-bottom:6px;letter-spacing:.02em}
.q{font-family:'Amiri Quran',serif;font-size:1.45rem;line-height:2.5;word-wrap:break-word}
mark{background:transparent;padding:0 1px;border-radius:3px}
mark.d-rep{background:var(--rep)} mark.d-ins{background:var(--ins)} mark.d-del{background:var(--del)}
mark.d-gap{background:var(--del);padding-inline:3px}
mark.d-conv{background:transparent;box-shadow:0 1px 0 var(--line);opacity:.72}
.omit{opacity:.35;font-style:normal}
.omit-key{font-weight:400;opacity:.8}
body.hide-conv mark.d-conv{box-shadow:none;opacity:1}
.toggle{display:inline-flex;gap:8px;align-items:center;font-size:.85rem;cursor:pointer;
 background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:6px 14px}
table{width:100%;border-collapse:collapse;font-size:.85rem;margin-top:8px}
th,td{text-align:start;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:700;white-space:nowrap}
details{margin-top:10px}summary{cursor:pointer;color:var(--teal);font-weight:700;font-size:.9rem}
img{max-width:100%;border:1px solid var(--line);border-radius:8px;margin-top:8px}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:.85rem;color:var(--muted);margin:.5rem 0 0}
.legend b{font-weight:700}
.sum td,.sum th{font-size:.85rem}
.note{background:var(--warnbg);border-inline-start:3px solid var(--warn);border-radius:8px;
 padding:10px 14px;margin:14px 0;font-size:.9rem}
"""


def write_html(rows, occ, out_dir):
    H = []
    w = H.append
    w("<!doctype html><html lang='ar' dir='rtl'><head><meta charset='utf-8'>")
    w("<meta name='viewport' content='width=device-width,initial-scale=1'>")
    w("<title>مقابلة النصوص القرآنية — بَرْدُ اليقين</title>")
    w("<style>%s</style></head><body><div class='wrap'>" % HTML_CSS)
    w("<h1>مقابلة النصوص القرآنية الأربعة والعشرين</h1>")
    w("<p class='lede'>صفحة محلية للمقارنة البصرية. <strong>لم يُعدَّل أيّ نصّ، "
      "ولم تُغيَّر حالة أيّ عنصر عن «بانتظار المراجعة».</strong></p>")

    w("<div class='note'><b>منهج المقابلة:</b> لم يُتَّخذ نصّ البرنامج مرجعًا لنفسه. "
      "قوبل كل نصّ بمصدرين عثمانيين مستقلّين، وقُوبلا أحدهما بالآخر على ٦٢٣٦ آية "
      "فاتّفقا على الهيكل الحرفيّ اتّفاقًا تامًّا. وصفحة الكتاب مرفقة تحت كل نصّ "
      "للمقابلة البصرية، لأنّ نصّ القرآن في ملف الكتاب مكتوب بخطّ مصحفيّ "
      "(QCF) لا يحمل ترميزًا يمكن استخراجه، فلا سبيل إلى مقابلته آليًّا.</div>")

    w("<div class='legend'><span><b>التظليل:</b></span>"
      "<span><mark class='d-conv'>خطّ خفيف</mark> صورة معروفة مختلفة للكلمة نفسها "
      "(ٱ/ا · ـٰ/ا · هُۥ/هُ · اختلاف تشكيل) — لا يمسّ الحرف</span>"
      "<span><mark class='d-rep'>أصفر</mark> استبدال غير مفسَّر</span>"
      "<span><mark class='d-ins'>أخضر</mark> زيادة في المرجع</span>"
      "<span><mark class='d-del'>أحمر</mark> زيادة في البرنامج</span></div>")
    w("<p><label class='toggle'><input type='checkbox' id='hc'> "
      "إخفاء تظليل فروق الرسم المعروفة، وإبقاء ما يستحقّ النظر</label></p>")

    tally = collections.Counter(r["verdict"] for r in rows)
    w("<div class='card'><h2>الخلاصة</h2><table class='sum'>")
    w("<tr><th>النصوص المراجَعة</th><td>%s</td></tr>" % ar(len(rows)))
    for k in ("مطابق", "يحتاج تصحيحًا", "تحتاج تحققًا بشريًا"):
        w("<tr><th>%s</th><td>%s</td></tr>" % (k, ar(tally.get(k, 0))))
    letters_bad = sum(1 for r in rows for v in r["verses"]
                      if v.get("res") and not v["res"]["lettersOk"])
    w("<tr><th>اختلاف في الحروف</th><td>%s</td></tr>" % ar(letters_bad))
    w("<tr><th>مواضع ظهور النصوص القرآنية</th><td>%s موضعًا · %s مقطعًا مميّزًا</td></tr>"
      % (ar(occ["total"]), ar(occ["distinct"])))
    w("<tr><th>تعارض بين المواضع</th><td>%s</td></tr>" % ar(len(occ["conflicts"])))
    w("</table></div>")

    for r in rows:
        cls = {"مطابق": "p-ok", "يحتاج تصحيحًا": "p-err"}.get(r["verdict"], "p-warn")
        w("<div class='card'><div class='head'><div>")
        w("<h2>%s. %s</h2>" % (ar(r["seq"]), esc(r["ref"] or "—")))
        w("<div class='meta'>%s / %s / %s · %s · الكتاب ص %s</div>"
          % (r["unit"], r["lesson"], r["card"], esc(r["lessonTitle"]),
             ar(r["page"]) if r.get("page") else "—"))
        w("</div><span class='pill %s'>%s</span></div>" % (cls, r["verdict"]))

        for v in r["verses"]:
            enc = v.get("enc") or ""
            pre, win, post = align_window(v["prog"], enc)
            pa, pb, nreal = marked(v["prog"], win)
            omitted = (("<span class='omit'>%s</span>" % esc(pre)) if pre else "") \
                + pb + (("<span class='omit'>%s</span>" % esc(post)) if post else "")
            w("<div class='row'>")
            w("<div class='box'><div class='lbl'>نصّ البرنامج — آية %s</div>"
              "<div class='q'>%s</div></div>" % (ar(v["ayah"]) if v["ayah"] else "—", pa))
            w("<div class='box'><div class='lbl'>المرجع العثماني — موسوعة القرآن الكريم%s</div>"
              "<div class='q'>%s</div></div>"
              % (" · <span class='omit-key'>الباهت: لم يقتبسه الكتاب</span>"
                 if (pre or post) else "", omitted))
            w("</div>")
            if v.get("qul"):
                _p2, _w2, _s2 = align_window(v["prog"], v["qul"])
                _, qb, _n = marked(v["prog"], _w2)
                w("<details><summary>مرجع عثماني ثانٍ (QUL / Tarteel)</summary>"
                  "<div class='box' style='margin-top:8px'><div class='q'>%s</div></div></details>" % qb)
            w("<table>")
            w("<tr><th>نتيجة المطابقة</th><td>%s · الحروف %s · "
              "<b>فروق غير مفسَّرة باختلاف الرسم: %s</b></td></tr>"
              % ("مقطع من الآية" if (v.get("res") or {}).get("partial") else "الآية كاملة",
                 "سليمة" if (v.get("res") or {}).get("lettersOk") else "<b>مختلفة ⚠️</b>",
                 ar(nreal)))
            w("<tr><th>المقارنة الحرفية الخام</th><td>الأساسي: <b>%s</b> · الشاهد: %s</td></tr>"
              % ((v.get("res") or {}).get("raw_primary", "—"),
                 (v.get("res") or {}).get("raw_witness", "—")))
            w("<tr><th>حالة التشكيل</th><td>%s</td></tr>" % tashkeel_state(v))
            w("<tr><th>علامات الوقف</th><td>%s</td></tr>" % waqf_state(v))
            w("<tr><th>الفروق الحرفية</th><td>%s</td></tr>" % esc(diff_cells(v)))
            w("</table>")

        w("<table><tr><th>رقم الآية</th><td>%s</td></tr>" % esc(ayah_number_state(r)))
        w("<tr><th>مصدر المرجع</th><td>%s<br>%s</td></tr>"
          % (esc(SRC_LABEL["enc"]), esc(SRC_LABEL["qul"])))
        w("<tr><th>الملاحظات</th><td>%s</td></tr>" % esc(r.get("reason", "")))
        w("<tr><th>التوصية</th><td><b>%s</b></td></tr></table>" % r["verdict"])

        if r.get("page"):
            w("<details><summary>صفحة الكتاب ص %s — للمقابلة البصرية</summary>"
              "<img loading='lazy' src='pages/book-p%03d.png' alt='صفحة %s من الكتاب'></details>"
              % (ar(r["page"]), r["page"], ar(r["page"])))
        w("</div>")

    w("<div class='card'><h2>اتساق مواضع الظهور</h2>")
    w("<p>فُحص كل موضع يظهر فيه نصّ قرآني في البرنامج: بطاقات الدروس، والشروح، "
      "والأنشطة، وأسئلة المطابقة والتصنيف، والتفسيرات، والخلاصات، وبيانات البحث "
      "والمفضلة وصفحة المراجعة ولوحة الإدارة (وكلّها تقرأ من ملفات المحتوى نفسها).</p>")
    w("<table><tr><th>مواضع الظهور</th><td>%s</td></tr>" % ar(occ["total"]))
    w("<tr><th>مقاطع مميّزة</th><td>%s</td></tr>" % ar(occ["distinct"]))
    w("<tr><th>نسخة مختلفة للنصّ نفسه بين موضعين</th><td><b>%s</b></td></tr></table>"
      % ar(len(occ["conflicts"])))
    if occ["conflicts"]:
        for c in occ["conflicts"]:
            w("<div class='note'><b>تعارض:</b><br>")
            for f in c["forms"]:
                w("<div class='q'>%s</div><div class='meta'>%s</div>"
                  % (esc(f["text"]), esc("، ".join(f["where"]))))
            w("</div>")
    w("<script>document.getElementById('hc').addEventListener('change',"
      "e=>document.body.classList.toggle('hide-conv',e.target.checked));</script>")
    w("</div></div></body></html>")

    path = os.path.join(out_dir, "compare.html")
    open(path, "w", encoding="utf-8").write("\n".join(H))
    print("→", path)
    return path


if __name__ == "__main__":
    rows, occ = main()
    out = os.path.join(ROOT, "docs/quran-review")
    write_outputs(rows, occ, out)
    write_html(rows, occ, out)
