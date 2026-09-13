#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
تحويل النصوص القرآنية إلى الرسم العثماني — نقلًا حرفيًّا لا استبدالًا.

**المنهج المُلزِم:**
  • لا خوارزمية استبدال، ولا كتابة من الذاكرة. كل نصّ جديد **شريحةٌ حرفية
    متّصلة** مقتطعة من نصّ المرجع الأساسي، ويُتحقَّق منها على مستوى Unicode.
  • المرجع الأساسي: المكتبة القرآنية الشاملة QUL من Tarteel AI
    (حزمة quran-validator@1.3.0).
  • الشاهد المستقلّ: موسوعة القرآن الكريم quranenc.com
    (حزمة quran-json@3.1.2). لا يُحسم به خلاف، بل يُسجَّل كل خلاف للمراجعة.
  • الاقتباس الجزئي: يُحدَّد موضعه في الآية المرجعية بمطابقة النصّ القديم
    بعد طيّ فروق الرسم، ثم تُقتطع **شريحة متّصلة** من المرجع بحدودها نفسها.
    ولا تتغيّر بداية الاقتباس ولا نهايته.
  • النصّ القديم محفوظ كاملًا في تقرير التغيير، ولا يُحذف.

المخرجات:
  scripts/content/quran_uthmani.py   النصوص العثمانية المعتمدة (يقرؤها البناء)
  docs/quran-review/rasm-change.json تقرير التغيير: قبل/بعد/المصدر/الخلافات

التشغيل:  python3 scripts/convert_quran_rasm.py
"""
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from review_quran_texts import (  # noqa: E402
    AYAH_MARK, L1, L2, L3, _fold, ar, ar2int, graphemes, nfc,
    parse_ref, quran_cards, split_verses, surah_map, WAQF,
)


def load_source_units():
    """يقرأ الوحدات من مصادر المحتوى (بايثون) **قبل** تطبيق أي تحويل.

    لا يقرأ content/units/*.json لأنها ناتج البناء الذي يطبّق التحويل،
    فيصير السكربت يقرأ مخرجاته ويفقد النصّ الأصلي.
    """
    import importlib
    mods = [importlib.import_module("content.unit%d" % i) for i in range(1, 8)]
    units = [getattr(m, "UNIT%d" % i) for i, m in enumerate(mods, 1)]
    added = importlib.import_module("content.added_interactions").ADDED
    for u in units:
        for l in u["lessons"]:
            extra = added.get(l["id"])
            if extra:
                have = {q["id"] for q in l["interactions"]}
                for q in extra:
                    if q["id"] not in have:
                        l["interactions"].append(q)
    return units

# ------------------------------------------------------ جدول الإسناد الصريح
# مواضع يحتمل فيها اللفظ أكثر من آية، فلا يُحسم بالبحث النصّي. الإسناد هنا
# مقرَّر بالنظر في سياق الموضع وفي صفحة الكتاب، لا بتخمين آلي.
AYAH_HINTS = {
    # سورة الإخلاص: لفظ ﴿أَحَدٌ﴾ يرد في الآية ١ وفي الآية ٤ بصورتين.
    # وهذان الموضعان شرحُهما «المتفرّد بالألوهية والربوبية والأسماء والصفات»،
    # وهو معنى ﴿أَحَدٌ﴾ في **الآية الأولى** كما في الكتاب ص ١٣.
    "u1/lessons[6]/interactions[0]/pairs[0][0]": "112:1",
    "u1/lessons[6]/summary/points[1]": "112:1",
    # سؤال تحصيلي على مستوى الوحدة، و﴿ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ﴾ آيةٌ كاملة
    # في الفاتحة (٣)، وشرحها في الكتاب ص ٨ ضمن درس الفاتحة.
    "u1/assessment[3]/q": "1:3",
}
AYAH_HINT_WHY = {
    "u1/lessons[6]/interactions[0]/pairs[0][0]":
        "شرحه معنى ﴿أَحَدٌ﴾ في الآية الأولى، والكتاب ص ١٣ يفرد الآية ٤ بشرح آخر",
    "u1/lessons[6]/summary/points[1]":
        "شرحه معنى ﴿أَحَدٌ﴾ في الآية الأولى، والكتاب ص ١٣ يفرد الآية ٤ بشرح آخر",
    "u1/assessment[3]/q":
        "آية كاملة في الفاتحة (٣)، وشرحها في الكتاب ص ٨ ضمن درس الفاتحة",
}

PRIMARY = "qul"
WITNESS = "quranenc"
SRC_NAME = {
    "qul": "المكتبة القرآنية الشاملة QUL — Tarteel AI · حزمة quran-validator@1.3.0",
    "quranenc": "موسوعة القرآن الكريم quranenc.com · حزمة quran-json@3.1.2",
}


# ---------------------------------------------------------------- الاقتطاع
def _fold_indexed(gs, expand_small):
    out, idx = [], []
    for i, g in enumerate(gs):
        for ch in _fold(g, expand_small):
            out.append(ch)
            idx.append(i)
    return "".join(out), idx


HIZB = "۞۩"


def strip_hizb(t):
    """علامة الحزب/السجدة ليست من نصّ الآية، فتُنزع قبل الاقتطاع والمقارنة."""
    t = nfc(t)
    while t and (t[0] in HIZB or t[0].isspace()):
        t = t[1:]
    return t.strip()


def slice_from_reference(old_text, ref_verse):
    """يقتطع من الآية المرجعية الشريحة المتّصلة المقابلة للنصّ القديم.

    يعيد (الشريحة، بدايتها، نهايتها، هل هي الآية كاملة؟) أو None إن تعذّر.
    """
    gr = graphemes(strip_hizb(ref_verse))

    PROCLITIC = set("وفبلك")

    def _boundary_before(i):
        if i == 0 or not gr[i - 1].strip() or not L2(gr[i - 1]):
            return True
        # يجوز أن يبدأ الاقتباس بعد حرفٍ واحد من حروف المعاني الملتصقة
        # (و/ف/ب/ل/ك)، كاقتباس «لَا يَـُٔودُهُۥ» من «وَلَا يَـُٔودُهُۥ».
        if L2(gr[i - 1]) in PROCLITIC:
            return i - 1 == 0 or not gr[i - 2].strip()
        return False

    def at_word_boundary(i, n):
        """الاقتباس يبدأ وينتهي عند حدّ كلمة، فلا يُقتطع من وسط كلمة."""
        after_ok = n >= len(gr) or not gr[n].strip() or not L2(gr[n])
        return _boundary_before(i) and after_ok

    for expand in (False, True):
        rf, idx = _fold_indexed(gr, expand)
        pf = _fold(old_text, expand)
        if not pf or not rf:
            continue

        def foldable_letter(g):
            # حرفٌ يُطوى إلى فراغ (همزة أو كرسيّها) — لا مسافة ولا علامة وقف
            return bool(L2(g)) and not _fold(g, expand)

        start = 0
        while True:
            pos = rf.find(pf, start)
            if pos < 0:
                break
            start = pos + 1
            i0 = idx[pos]
            i1 = idx[min(pos + len(pf) - 1, len(idx) - 1)] + 1
            # الطيّ يُسقط الهمزة وكرسيّها، فقد تبدأ المطابقة بعد حرفٍ أُسقط
            # (إِنَّمَا ← نما) أو تقف قبله (شَىْءٍ ← شى).
            while i0 > 0 and foldable_letter(gr[i0 - 1]):
                i0 -= 1
            while i1 < len(gr) and foldable_letter(gr[i1]):
                i1 += 1
            if not at_word_boundary(i0, i1):
                continue
            return "".join(gr[i0:i1]).strip(), i0, i1, (i0 == 0 and i1 == len(gr))
    return None


# علامتا الحزب والسجدة ليستا من حروف الكلمة، والمرجعان يختلفان في وضع
# مسافة بعدهما لا في النصّ. تُعزل هذه الفروق وتُعلَن باسمها، ولا تُطوى صامتة.
HIZB_MARKS = "\u06DE\u06E9"


def _mark_spacing(t):
    """ينزع علامتَي الحزب والسجدة ويوحّد المسافات حولهما فقط."""
    return re.sub(r"\s+", " ", "".join(c for c in nfc(t)
                                       if c not in HIZB_MARKS)).strip()


def compare_sources(a, b):
    """يصنّف الخلاف بين المرجعين دون أن يحسمه."""
    if nfc(a) == nfc(b):
        return "متطابقان"
    # يُعلَن اختلاف المسافة حول علامة الحزب/السجدة صراحةً، ثم يُصنَّف ما بقي.
    mark_note = ""
    if _mark_spacing(a) != nfc(a) or _mark_spacing(b) != nfc(b):
        if _mark_spacing(a) == _mark_spacing(b):
            return "مسافة علامة الحزب/السجدة"
        mark_note = " + مسافة علامة الحزب/السجدة"
        a, b = _mark_spacing(a), _mark_spacing(b)
    # نزع التطويل يجري داخل L1 قبل أي تطبيع لاحق. ولو نُزع هنا ثم أُعيد
    # التطبيع، لالتصقت الهمزةُ المرسومة على التطويل بالياء قبلها فصارت «ئ»
    # في مصدر دون آخر — وهو فرقٌ يصنعه القياس لا المصدران.
    na, nb = L1(a), L1(b)
    if na == nb:
        return "تطويل فقط" + mark_note
    # الطبقات التالية تُحسب من النصّ الأصلي لا من نصٍّ نُزع تطويله، لئلّا
    # يعيد التطبيعُ تركيبَ الهمزة على ما قبلها فيُصطنع فرقٌ ليس في المصدرين.
    l2a, l2b = L2(a), L2(b)
    l3a, l3b = L3(a), L3(b)
    # توحيد صور السكون وصفر الوصل، وهي صور ترميز لا حروف
    def enc_norm(t):
        return (t.replace("ۡ", "ْ")      # سكون مستدير ← سكون
                 .replace("۟", "ْ")      # صفر مستدير ← سكون
                 .replace("ٰ", "ٰ"))
    if enc_norm(na) == enc_norm(nb):
        return "صورة ترميز السكون" + mark_note
    if l2a == l2b:
        return "تشكيل أو علامة وقف" + mark_note
    # هل الفرق في صورة الياء الأخيرة وحدها؟ (ي مقابل ى)
    if l2a.replace("ي", "ى") == l2b.replace("ي", "ى"):
        return "صورة الياء الأخيرة (ي/ى)" + mark_note
    # صورة كرسيّ الهمزة: أحد المصدرين يرسمها على التطويل (ـَٔ) والآخر على
    # كرسيّ (أٓ). تُعلَن باسمها ويبقى عليها التنبيه، فالهمزة حرف لا حركة.
    if l3a == l3b:
        return "صورة كرسيّ الهمزة ⚠️" + mark_note
    return "حروف ⚠️" + mark_note


def waqf_list(t):
    return [c for c in nfc(t) if c in WAQF]


def main():
    ref = json.load(open("/tmp/qref/reference.json", encoding="utf-8"))
    smap = surah_map("/tmp/qref/surahnames.json")
    units = load_source_units()
    cards = quran_cards(units)

    out, report = {}, []
    blocked = []

    for c in cards:
        sid, ayat = parse_ref(c["ref"], smap)
        key = "%s/%s" % (c["lesson"], c["card"])
        if sid is None:
            blocked.append((key, "تعذّر تحديد السورة"))
            continue

        segs = [(n, s.replace("﴿", " ").replace("﴾", " ").strip())
                for n, s in split_verses(c["text"])]
        segs = [(n, s) for n, s in segs if s]
        if not ayat:
            ayat = [n for n, _ in segs if n] or list(range(1, len(segs) + 1))

        pieces, verses_rep, ok = [], [], True
        for i, (num, seg) in enumerate(segs):
            a = num if num else (ayat[i] if i < len(ayat) else None)
            k = "%d:%s" % (sid, a)
            prim = ref[PRIMARY].get(k)
            wit = ref[WITNESS].get(k)
            if prim is None:
                blocked.append((key, "الآية %s ليست في المرجع الأساسي" % a))
                ok = False
                break
            got = slice_from_reference(seg, prim)
            if got is None:
                blocked.append((key, "تعذّر تحديد موضع الاقتباس في الآية %s" % a))
                ok = False
                break
            new, i0, i1, full = got
            # التحقّق على مستوى Unicode: الشريحة جزءٌ حرفيّ من نصّ المرجع
            assert new in nfc(prim), "الشريحة ليست جزءًا حرفيًّا من المرجع: %s" % k
            pieces.append((a, new, full))
            verses_rep.append({
                "ayah": a, "old": seg, "new": new, "full": full,
                "sliceFrom": i0, "sliceTo": i1,
                "refPrimary": prim, "refWitness": wit,
                "sourcesAgree": compare_sources(prim, wit) if wit else "لا شاهد",
                "waqfOld": waqf_list(seg), "waqfNew": waqf_list(new),
            })
        if not ok:
            continue

        # ------------------------------------------------ إعادة التركيب
        # قاعدة موحَّدة لإظهار أرقام الآيات (بند ثالث):
        #   • رقم الآية ﴿ن﴾ بعد كل آية **كاملة**، متى كانت البطاقة تحمل أرقامًا
        #     أصلًا أو كانت تجمع أكثر من آية. وهي صورة الكتاب نفسه (المدوّرة).
        #   • الاقتباس الجزئي لا يُعطى رقمًا — ويُنزع منه إن كان.
        #   • متى وُجدت الأرقام فلا قوسَي اقتباس حولها (الرقم يُنهي الاقتباس،
        #     كما في الكتاب وكما في بطاقات السور)؛ وإلا فقوسا اقتباس ﴿…﴾.
        n_full = sum(1 for _, _, full in pieces if full)
        had_number = bool(AYAH_MARK.search(c["text"]))
        numbered = n_full >= 1 and (had_number or n_full > 1)
        body_parts = []
        for a, new, full in pieces:
            body_parts.append(new.strip())
            if numbered and full:
                body_parts.append("﴿%s﴾" % ar(a))
        body = re.sub(r"\s+", " ", " ".join(x for x in body_parts if x)).strip()
        new_text = body if numbered else ("﴿%s﴾" % body)

        out[key] = {
            "unit": c["unit"], "lesson": c["lesson"], "card": c["card"],
            "ref": c["ref"], "page": c["page"], "surah": sid,
            "text": new_text, "source": SRC_NAME[PRIMARY],
            "numbered": numbered, "fullVerses": n_full,
        }
        report.append({
            "key": key, "unit": c["unit"], "lesson": c["lesson"],
            "lessonTitle": c["lessonTitle"], "card": c["card"],
            "ref": c["ref"], "page": c["page"],
            "old": c["text"], "new": new_text,
            "changed": nfc(c["text"]) != nfc(new_text),
            "numbered": numbered, "fullVerses": n_full,
            "structureOld": ("أرقام آيات" if AYAH_MARK.search(c["text"]) else "")
            + (" + قوسا اقتباس" if c["text"].strip().startswith("﴿") else ""),
            "structureNew": "أرقام آيات" if numbered else "قوسا اقتباس",
            "numberRemoved": had_number and not numbered,
            "verses": verses_rep,
        })

    # ------------------------------------------------- المقاطع القرآنية المقتبسة
    # كل مقطع ﴿…﴾ خارج بطاقات القرآن (في الشروح والأسئلة والخلاصات وأطراف
    # المطابقة والأسئلة التحصيلية) يُحوَّل كذلك — وإلا اختلف الرسم بين موضع
    # وآخر للنصّ نفسه.
    #
    # **الحسم ببيانات المصدر لا بالبحث النصّي:** لكل موضعٍ تُحدَّد السورةُ
    # والآية تحديدًا صريحًا، ومنها يُقتطع النصّ. فإن احتمل اللفظ أكثر من آية
    # (كلفظ ﴿أَحَدٌ﴾ في الإخلاص ١ و٤) لم يُحسم بالبحث، بل بجدول الإسناد
    # الصريح أدناه، وإلا رُفع للمراجعة البشرية.
    SEG = re.compile(r"﴿[^﴿﴾]{2,}﴾")
    ELLIPSIS = re.compile(r"(\s*(?:…|\.\.\.)\s*)$")
    SEPARATOR = re.compile(r"\s*(?:۝|﴿\s*[٠-٩0-9]+\s*﴾)\s*")
    frag_out, frag_rep, frag_blocked = [], [], []

    # آيات كل درس، مأخوذة من مراجع بطاقاته القرآنية
    lesson_verses = {}
    for c in cards:
        sid, ayat = parse_ref(c["ref"], smap)
        if sid is None:
            continue
        d_ = lesson_verses.setdefault(c["lesson"], {})
        if not ayat:
            ayat = [int(k.split(":")[1]) for k in ref[PRIMARY] if k.startswith("%d:" % sid)]
        for a in ayat:
            k = "%d:%d" % (sid, a)
            if k in ref[PRIMARY]:
                d_[k] = ref[PRIMARY][k]

    def candidates_for(frag, verses):
        """الآيات التي يمكن أن يكون المقطع منها، مع شريحة كلٍّ منها."""
        out = {}
        for k, v in verses.items():
            got = slice_from_reference(frag, v)
            if got:
                out[k] = got
        # آيتان متتاليتان معًا (كآيتي الإخلاص ٣ و٤ في مصطلح واحد)
        for k, v in list(verses.items()):
            sid_, a_ = k.split(":")
            nk = "%s:%d" % (sid_, int(a_) + 1)
            if nk in verses:
                joined = strip_hizb(v) + " " + strip_hizb(verses[nk])
                got = slice_from_reference(frag, joined)
                if got:
                    out["%s+%s" % (k, nk)] = got
        return out

    def walk_frags(obj, unit_id, path, lesson_id=None):
        if isinstance(obj, str):
            for m in SEG.finditer(obj):
                seg, at = m.group(0), m.start()
                inner = seg[1:-1].strip()
                if not L2(inner) or AYAH_MARK.fullmatch(seg):
                    continue
                fpath = "%s#%d" % (path, at)
                verses = lesson_verses.get(lesson_id or "", {})
                scope = "الدرس"
                if not verses:
                    verses = {k: v for k, v in ref[PRIMARY].items()
                              if any(k.startswith("%d:" % parse_ref(c["ref"], smap)[0])
                                     for c in cards if c["unit"] == unit_id
                                     and parse_ref(c["ref"], smap)[0])}
                    scope = "الوحدة"
                # نقاط الحذف تُنزع قبل المقابلة وتُعاد بعدها
                tail = ""
                mt = ELLIPSIS.search(inner)
                if mt:
                    tail = mt.group(1)
                    inner = inner[:mt.start()]
                # المقطع قد يجمع آيتين يفصل بينهما ۝ أو ﴿ن﴾
                parts = [x.strip() for x in SEPARATOR.split(inner) if x.strip()]
                picked, failed = [], None
                for pi, part in enumerate(parts):
                    cands = candidates_for(part, verses)
                    scope_i = scope
                    if not cands:
                        pf = _fold(part, False)
                        wide = {k: ref[PRIMARY][k] for k, fv in GLOBAL_FOLDED.items()
                                if pf and pf in fv}
                        cands = candidates_for(part, wide)
                        scope_i = "المصحف"
                    hkey = "%s|%d" % (fpath, pi) if len(parts) > 1 else fpath
                    hint = (AYAH_HINTS.get(hkey) or AYAH_HINTS.get(fpath)
                            or AYAH_HINTS.get(path))
                    if hint and hint in cands:
                        chosen, why = hint, "إسناد صريح (%s)" % AYAH_HINT_WHY.get(
                            hkey, AYAH_HINT_WHY.get(fpath,
                                  AYAH_HINT_WHY.get(path, "مقرّر")))
                    elif len(cands) == 1:
                        chosen = next(iter(cands))
                        why = "آية واحدة محتملة في %s" % scope_i
                    elif cands and len({v[0] for v in cands.values()}) == 1:
                        # الصور متطابقة، فالترجيح للأضيق إسنادًا: آية واحدة
                        # قبل آيتين مضمومتين، وآيةٌ كاملة قبل اقتباس منها.
                        chosen = sorted(cands, key=lambda k: (
                            str(k).count("+"), not cands[k][3], str(k)))[0]
                        why = "عدّة آيات بالصورة نفسها في %s" % scope_i
                    else:
                        failed = {"part": part,
                                  "candidates": {k: v[0] for k, v in cands.items()}}
                        break
                    picked.append((chosen, cands[chosen], why))
                if failed is not None or not picked:
                    frag_blocked.append({
                        "frag": seg, "where": fpath,
                        "why": "يحتمل أكثر من آية بصور مختلفة، ولا إسناد صريح",
                        **(failed or {})})
                    continue

                if len(picked) == 1:
                    chosen, (sl, i0, i1, full), why = picked[0]
                    new = "﴿%s%s﴾" % (sl, tail)
                else:
                    # أكثر من آية: يُفصل بينها برقم الآية ﴿ن﴾ كما في البطاقات
                    body = []
                    for chosen_i, (sl_i, _a, _b, full_i), _w in picked:
                        body.append(sl_i)
                        if full_i:
                            body.append("﴿%s﴾" % ar(ar2int(str(chosen_i).split(":")[1])))
                    new = re.sub(r"\s+", " ", " ".join(body)).strip() + tail
                    chosen = "+".join(str(c) for c, _v, _w in picked)
                    why = "؛ ".join(w for _c, _v, w in picked)
                    i0, i1, full = -1, -1, all(p[1][3] for p in picked)
                sid_ = int(str(chosen).split("+")[0].split(":")[0])
                ayah_ = "+".join(str(x).split(":")[1] for x in str(chosen).split("+"))
                frag_out.append({
                    "path": fpath, "old": seg, "new": new,
                    "surah": sid_, "ayah": ayah_,
                    "from": i0, "to": i1,
                    "kind": "آية كاملة" if full else "اقتباس جزئي",
                    "lesson": lesson_id, "unit": unit_id,
                    "why": why, "changed": nfc(new) != nfc(seg),
                })
                frag_rep.append(frag_out[-1])
        elif isinstance(obj, dict):
            lid = obj.get("id") if isinstance(obj.get("id"), str) and \
                obj.get("id", "").startswith("u") and "l" in obj.get("id", "") else lesson_id
            # نصّ بطاقة القرآن يُستبدل كاملًا من جدول UTHMANI، فلا يدخل
            # المقاطع المقتبسة حتى لا يُطبَّق عليه استبدالان.
            skip = {"text"} if obj.get("type") == "quran" else set()
            for kk, vv in obj.items():
                if kk in skip:
                    continue
                walk_frags(vv, unit_id, "%s/%s" % (path, kk), lid)
        elif isinstance(obj, list):
            for i, vv in enumerate(obj):
                walk_frags(vv, unit_id, "%s[%d]" % (path, i), lesson_id)

    GLOBAL_FOLDED = {k: _fold(v, False) for k, v in ref[PRIMARY].items()}
    for u in units:
        walk_frags(u, u["id"], u["id"])

    # ------------------------------------------------------------ الكتابة
    mod = ['# -*- coding: utf-8 -*-',
           '"""',
           'النصوص القرآنية بالرسم العثماني — مُولَّد آليًّا، لا يُحرَّر يدويًّا.',
           '',
           'كل نصّ هنا **شريحة حرفية متّصلة** مقتطعة من:',
           '  %s' % SRC_NAME[PRIMARY],
           'وقد قوبل كلٌّ منها بالشاهد المستقلّ:',
           '  %s' % SRC_NAME[WITNESS],
           'وسُجِّل كل خلاف بين المصدرين في docs/quran-review/rasm-change.json',
           'ولم يُحسم منه شيء آليًّا.',
           '',
           'التوليد:  python3 scripts/convert_quran_rasm.py',
           '"""',
           '',
           'PRIMARY_SOURCE = %r' % SRC_NAME[PRIMARY],
           '',
           '# مفتاح الإدخال: "<معرّف الدرس>/<معرّف البطاقة>"',
           'UTHMANI = {']
    for k, v in out.items():
        mod.append('    %r: {' % k)
        mod.append('        "ref": %r,' % v["ref"])
        mod.append('        "page": %r,' % v["page"])
        mod.append('        "text": %r,' % v["text"])
        mod.append('    },')
    mod.append('}')
    mod.append('')
    mod.append('# المقاطع القرآنية المقتبسة خارج البطاقات — لكلٍّ إسنادٌ صريح:')
    mod.append('#   path  موضعه في بنية الوحدة · old/new النصّ قبل وبعد')
    mod.append('#   surah/ayah السورة والآية · from/to حدود المقطع في الآية')
    mod.append('#   kind  آية كاملة أو اقتباس جزئي · why كيف حُسم الإسناد')
    mod.append('FRAGMENTS = [')
    for r in frag_out:
        mod.append('    %r,' % (r,))
    mod.append(']')
    path = os.path.join(ROOT, "scripts/content/quran_uthmani.py")
    open(path, "w", encoding="utf-8").write("\n".join(mod) + "\n")

    # المرجع المستعمل يُحفظ داخل المستودع، فيصير التدقيق مكتفيًا بنفسه
    used = {}
    for r in report:
        for v in r["verses"]:
            used["%d:%s" % (
                parse_ref(r["ref"], smap)[0], v["ayah"])] = {
                "primary": v["refPrimary"], "witness": v["refWitness"]}
    for f in frag_rep:
        for kk in str("%s:%s" % (f["surah"], f["ayah"])).split("+"):
            for one in kk.replace("%d:" % f["surah"], "").split("+"):
                key = "%d:%s" % (f["surah"], one)
                if key in ref[PRIMARY] and key not in used:
                    used[key] = {"primary": ref[PRIMARY][key],
                                 "witness": ref[WITNESS].get(key)}
    json.dump({"primarySource": SRC_NAME[PRIMARY],
               "witnessSource": SRC_NAME[WITNESS],
               "verses": used},
              open(os.path.join(ROOT, "content/quran-reference.json"), "w",
                   encoding="utf-8"), ensure_ascii=False, indent=1)

    rp = os.path.join(ROOT, "docs/quran-review/rasm-change.json")
    os.makedirs(os.path.dirname(rp), exist_ok=True)
    json.dump({"primary": SRC_NAME[PRIMARY], "witness": SRC_NAME[WITNESS],
               "rows": report, "blocked": blocked,
               "fragments": frag_rep, "fragmentsBlocked": frag_blocked},
              open(rp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    changed = sum(1 for r in report if r["changed"])
    import collections
    agree = collections.Counter(v["sourcesAgree"] for r in report for v in r["verses"])
    print("نصوص مُحوَّلة: %d من %d · تغيّر فعليّ: %d · متعذّرة: %d"
          % (len(out), len(cards), changed, len(blocked)))
    print("خلاف المصدرين (مسجَّل لا محسوم):")
    for k, n in agree.most_common():
        print("   %-32s %d" % (k, n))
    ch_frag = sum(1 for r in frag_out if r["changed"])
    print("مقاطع قرآنية مقتبسة: %d موضعًا (تغيّر %d) · غير محسومة: %d"
          % (len(frag_out), ch_frag, len(frag_blocked)))
    for b in blocked:
        print("   ✗", b)
    for b in frag_blocked:
        print("   ✗ مقطع:", b["frag"][:50], "·", b["where"])
    return 0 if not blocked else 1


if __name__ == "__main__":
    sys.exit(main())
