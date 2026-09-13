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
    AYAH_MARK, L2, _fold, ar, ar2int, graphemes, nfc,
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


def compare_sources(a, b):
    """يصنّف الخلاف بين المرجعين دون أن يحسمه."""
    if nfc(a) == nfc(b):
        return "متطابقان"
    TAT = "ـ"
    na = nfc(a).replace(TAT, "")
    nb = nfc(b).replace(TAT, "")
    if na == nb:
        return "تطويل فقط"
    # توحيد صور السكون وصفر الوصل، وهي صور ترميز لا حروف
    def enc_norm(t):
        return (t.replace("ۡ", "ْ")      # سكون مستدير ← سكون
                 .replace("۟", "ْ")      # صفر مستدير ← سكون
                 .replace("ٰ", "ٰ"))
    if enc_norm(na) == enc_norm(nb):
        return "صورة ترميز السكون"
    if L2(na) == L2(nb):
        return "تشكيل أو علامة وقف"
    # هل الفرق في صورة الياء الأخيرة وحدها؟ (ي مقابل ى)
    if L2(na).replace("ي", "ى") == L2(nb).replace("ي", "ى"):
        return "صورة الياء الأخيرة (ي/ى)"
    return "حروف ⚠️"


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
    # كل مقطع ﴿…﴾ يظهر خارج بطاقات القرآن (في الشروح والأسئلة والخلاصات
    # والأسئلة التحصيلية وأطراف المطابقة) يُحوَّل كذلك — وإلا اختلف الرسم بين
    # موضع وآخر للنصّ نفسه. ولا يُكتب شيء يدويًّا: كلّه شرائح من المرجع.
    SEG = re.compile(r"﴿[^﴿﴾]{2,}﴾")
    frag_out, frag_rep, frag_blocked = {}, [], []

    # الآيات المرشَّحة لكل وحدة: كل آية أُشير إليها في بطاقاتها القرآنية،
    # ويُضاف إليها كل آيات تلك السور (فالشرح قد يقتبس آية مجاورة).
    unit_pool = {}
    for c in cards:
        sid, ayat = parse_ref(c["ref"], smap)
        if sid is None:
            continue
        pool = unit_pool.setdefault(c["unit"], {})
        for k, v in ref[PRIMARY].items():
            if k.startswith("%d:" % sid):
                pool[k] = v

    # فهرس مطويّ لكل القرآن، للبحث عن مقطع لم تُعرف سورته من سياق الوحدة
    GLOBAL_FOLDED = {k: _fold(v, False) for k, v in ref[PRIMARY].items()}

    def _pool_with_pairs(pool):
        """يضيف إلى المرشَّحات كل آيتين متتاليتين، فقد يمتدّ المقطع عليهما."""
        out = dict(pool)
        for k, v in list(pool.items()):
            sid_, a_ = k.split(":")
            nxt = "%s:%d" % (sid_, int(a_) + 1)
            if nxt in pool:
                out["%s+%s" % (k, nxt)] = strip_hizb(v) + " " + strip_hizb(pool[nxt])
        return out

    def _search(frag, pool):
        hits = []
        for k, verse in _pool_with_pairs(pool).items():
            got = slice_from_reference(frag, verse)
            if got:
                hits.append((k, got[0]))
        return hits

    def find_fragment(frag, pools):
        """يجد الآية التي منها المقطع، ويقتطع الشريحة الحرفية المقابلة.

        يُبحث أولًا في آيات الدرس نفسه، ثم في سور الوحدة، ثم في المصحف كلّه.
        وإن تعدّدت الصور المحتملة في أيّ مستوى فلا يُحسم تلقائيًّا — يُرفع
        للمراجعة البشرية (أَمْثِلَتُه: ﴿ٱلرَّحْمَـٰنِ﴾ بالكسر في الفاتحة
        و﴿ٱلرَّحْمَـٰنُ﴾ بالضمّ في البقرة).
        """
        for pool in pools:
            hits = _search(frag, pool)
            if not hits:
                continue
            forms = {h[1] for h in hits}
            if len(forms) > 1:
                return ("ملتبس", sorted(forms, key=len, reverse=True),
                        [h[0] for h in hits])
            return (hits[0][0], hits[0][1], [h[0] for h in hits])
        # بحثٌ شامل في المصحف كلّه
        pf = _fold(frag, False)
        if pf:
            cand = {k: ref[PRIMARY][k] for k, fv in GLOBAL_FOLDED.items()
                    if pf in fv}
            hits = _search(frag, cand)
            forms = {h[1] for h in hits}
            if len(forms) == 1:
                return (hits[0][0], hits[0][1], [h[0] for h in hits])
            if len(forms) > 1:
                return ("ملتبس", sorted(forms, key=len, reverse=True),
                        [h[0] for h in hits])
        return None

    ELLIPSIS = re.compile(r"(\s*(?:…|\.\.\.)\s*)$")
    SEPARATOR = re.compile(r"\s*(?:۝|﴿\s*[٠-٩0-9]+\s*﴾)\s*")

    def convert_fragment(inner, pools):
        """يحوّل مقطعًا قرآنيًّا، ولو امتدّ على أكثر من آية أو انتهى بنقاط حذف.

        يعيد (النصّ الجديد، الآيات، ملحوظة) أو None.
        """
        tail = ""
        mt = ELLIPSIS.search(inner)
        if mt:
            tail = mt.group(1)
            inner = inner[:mt.start()]
        parts = [x for x in SEPARATOR.split(inner) if x.strip()]
        outs, verses, full_flags = [], [], []
        for part in parts:
            got = find_fragment(part.strip(), pools)
            if not got:
                return None
            k, sl, _ = got
            if k == "ملتبس":
                return ("ملتبس", sl, "")
            outs.append(sl)
            verses.append(k)
            prim = next((p.get(k) for p in pools if p.get(k)), None)
            full_flags.append(bool(prim) and strip_hizb(prim) == sl)
        if len(outs) == 1:
            return "﴿%s%s﴾" % (outs[0], tail), verses, ""
        # أكثر من آية: يُفصل بينها برقم الآية ﴿ن﴾ كما في البطاقات (بند ثالث)
        body = []
        for i, (o, k, full) in enumerate(zip(outs, verses, full_flags)):
            body.append(o)
            if full and ":" in str(k) and i < len(outs) - 1:
                body.append("﴿%s﴾" % ar(ar2int(str(k).split(":")[1])))
        last_k = verses[-1]
        if full_flags[-1] and ":" in str(last_k):
            body.append("﴿%s﴾" % ar(ar2int(str(last_k).split(":")[1])))
            return " ".join(body) + tail, verses, "فاصل الآية وُحِّد إلى ﴿ن﴾"
        return "﴿%s%s﴾" % (" ".join(body), tail), verses, "فاصل الآية وُحِّد إلى ﴿ن﴾"

    lesson_pool = {}
    for c in cards:
        sid, ayat = parse_ref(c["ref"], smap)
        if sid is None:
            continue
        p_ = lesson_pool.setdefault(c["lesson"], {})
        if ayat:
            for a in ayat:
                k = "%d:%d" % (sid, a)
                if k in ref[PRIMARY]:
                    p_[k] = ref[PRIMARY][k]
        else:
            for k, v in ref[PRIMARY].items():
                if k.startswith("%d:" % sid):
                    p_[k] = v

    def walk_frags(obj, unit_id, path, lesson_id=None):
        if isinstance(obj, str):
            for m in SEG.findall(obj):
                inner = m[1:-1].strip()
                if not L2(inner) or AYAH_MARK.fullmatch(m):
                    continue
                if m in frag_out:
                    continue
                pools = [p for p in (lesson_pool.get(lesson_id or ""),
                                     unit_pool.get(unit_id, {})) if p]
                got = convert_fragment(inner, pools)
                if not got:
                    frag_blocked.append({"frag": m, "where": path,
                                         "why": "لم يُعثر عليه في المصحف"})
                    continue
                new, verses, note = got
                if new == "ملتبس":
                    frag_blocked.append({
                        "frag": m, "where": path,
                        "why": "يحتمل أكثر من صورة، فلم يُحسم تلقائيًّا",
                        "options": verses})
                    continue
                if nfc(new) == nfc(m):
                    continue
                frag_out[m] = new
                frag_rep.append({"old": m, "new": new, "verse": verses,
                                 "note": note, "where": path})
        elif isinstance(obj, dict):
            lid = obj.get("id") if isinstance(obj.get("id"), str) and \
                obj.get("id", "").startswith("u") and "l" in obj.get("id", "") else lesson_id
            for kk, vv in obj.items():
                walk_frags(vv, unit_id, "%s/%s" % (path, kk), lid)
        elif isinstance(obj, list):
            for i, vv in enumerate(obj):
                walk_frags(vv, unit_id, "%s[%d]" % (path, i), lesson_id)

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
    mod.append('# المقاطع القرآنية المقتبسة خارج البطاقات (شروح وأسئلة وخلاصات):')
    mod.append('#   المفتاح: المقطع القديم كما هو · القيمة: الشريحة العثمانية الحرفية')
    mod.append('FRAGMENTS = {')
    for k, v in frag_out.items():
        mod.append('    %r: %r,' % (k, v))
    mod.append('}')
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
        for k in (f["verse"] if isinstance(f["verse"], list) else [f["verse"]]):
            for kk in str(k).split("+"):
                if kk in ref[PRIMARY] and kk not in used:
                    used[kk] = {"primary": ref[PRIMARY][kk],
                                "witness": ref[WITNESS].get(kk)}
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
    print("مقاطع قرآنية مقتبسة حُوِّلت: %d · متعذّرة: %d"
          % (len(frag_out), len(frag_blocked)))
    for b in blocked:
        print("   ✗", b)
    for b in frag_blocked:
        print("   ✗ مقطع:", b["frag"][:50], "·", b["where"])
    return 0 if not blocked else 1


if __name__ == "__main__":
    sys.exit(main())
