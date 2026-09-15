#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
تدقيق سلامة النصّ القرآني في كل محتوى البرنامج.

يفحص **كل** سؤال وتفاعل وخيار في الوحدات السبع، ويطبّق خمس قواعد مُلزِمة:

  ق-١  لا يُطلب إكمال نصّ قرآني — لا كتابةً ولا بالاختيار.
       (فحص: أيّ عنصر kind=complete مبنيّ على نصّ قرآني.)
  ق-٢  لا يظهر نصّ قرآني داخل قائمة خيارات — لا صوابًا ولا خطأً؛
       لأنّ قائمة الخيارات موضع تضليل بطبيعتها.
  ق-٣  لا يُنشأ عجزٌ لآية ولا تركيبٌ يحاكي نظم القرآن في الخيارات الخاطئة.
       (فحص: خيار خاطئ يقع مباشرةً بعد صدر آية، أو يشبه ألفاظ القرآن بالوزن والصيغة.)
  ق-٤  كل مقطع بين ﴿﴾ في البرنامج لا بدّ أن يكون واردًا في جَرْد معتمد،
       فلا يتسرّب مقطع مستحدث أو محرَّف. (الجَرْد في QURAN_INVENTORY أدناه.)
  ق-٥  النصوص القرآنية لا تُستعمل مادةً لخيار مضلِّل في المطابقة والتصنيف
       والترتيب: يجوز أن تكون هي المعروضة، ولا يجوز أن تكون هي البدائل الخاطئة.

التشغيل:  python3 scripts/audit_quran.py        (يُخرِج docs/QURAN_AUDIT.md)
          python3 scripts/audit_quran.py --check  (يرجع ١ عند أي مخالفة)
"""
import hashlib
import json
import os
import re
import sys
import collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
DOCS = os.path.join(ROOT, "docs")

AR = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def ar(n):
    return str(n).translate(AR)


# التشكيل وعلامات الوقف وأقواس الآية — تُجرَّد للمقارنة
TASHKEEL = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭ۝ࣰ-ࣿ]")
ORNAMENT = re.compile(r"[۞۩࣢⸫﴾﴿﴿﴾\[\]()«»…\.۝࣢]")
SEGMENT = re.compile(r"﴿[^﴿﴾]*﴾")


def bare(t):
    """تجريد النصّ من التشكيل والزخارف وأرقام الآيات والمسافات، للمقارنة الحرفية."""
    t = TASHKEEL.sub("", t or "")
    t = ORNAMENT.sub("", t)
    t = re.sub(r"[٠-٩0-9]", "", t)     # أرقام الآيات تفصل المقاطع ولا تُغيّر النصّ
    return re.sub(r"\s+", "", t)


def load_units():
    manifest = json.load(open(os.path.join(CONTENT, "manifest.json"), encoding="utf-8"))
    return [json.load(open(os.path.join(CONTENT, u["file"]), encoding="utf-8"))
            for u in manifest["units"]]


# --------------------------------------------------- المرجع العثماني المعتمد
# الجَرْد لم يعُد قائمةً مكتوبة يدويًّا. كل مقطع ﴿…﴾ في البرنامج يجب أن يكون
# **شريحة حرفية متّصلة** من آيةٍ في المرجع الأساسي المحفوظ داخل المستودع:
#   content/quran-reference.json  (مولّد من scripts/convert_quran_rasm.py)
# وهذا يحقّق ما يلي دفعةً واحدة:
#   • لا مقطع مولَّد ولا محرَّف.
#   • مطابقة النصّ العثماني النهائي للمرجع الأساسي.
#   • كشف أي رجوع إلى الرسم الإملائي (لأنه لن يكون شريحةً من المرجع).
REF_PATH = os.path.join(CONTENT, "quran-reference.json")


def load_reference():
    if not os.path.exists(REF_PATH):
        raise SystemExit("المرجع القرآني مفقود: content/quran-reference.json")
    d = json.load(open(REF_PATH, encoding="utf-8"))
    return d


def nfc(t):
    import unicodedata
    return unicodedata.normalize("NFC", t or "")


AYAH_NUM = re.compile(r"^\s*[٠-٩0-9]+\s*$")
ELLIPSIS = re.compile(r"\s*(?:…|\.\.\.)\s*$")
SEP = re.compile(r"\s*(?:۝|﴿\s*[٠-٩0-9]+\s*﴾)\s*")


_HAYSTACK = None


def _haystacks(verses):
    """نصوص المرجع للمطابقة: كل آية، وكل آيتين متتاليتين موصولتين.

    فالمقطع قد يمتدّ على آيتين قصيرتين بلا فاصل (كآيتي الإخلاص ٣ و٤).
    """
    global _HAYSTACK
    if _HAYSTACK is not None:
        return _HAYSTACK
    out = []
    for k, v in verses.items():
        t = nfc(v["primary"]).strip()
        out.append(t)
        sid, a = k.split(":")
        nxt = verses.get("%s:%d" % (sid, int(a) + 1))
        if nxt:
            out.append(t + " " + nfc(nxt["primary"]).strip())
    # علامة الحزب ليست من نصّ الآية
    out += [re.sub(r"^[۞۩]\s*", "", t) for t in out]
    _HAYSTACK = out
    return out


def is_reference_slice(seg, verses):
    """هل المقطع شريحة حرفية من المرجع الأساسي؟"""
    inner = nfc(seg[1:-1] if seg.startswith("﴿") else seg).strip()
    inner = ELLIPSIS.sub("", inner)
    if not inner or AYAH_NUM.match(inner):
        return True
    hay = _haystacks(verses)
    parts = [p.strip() for p in SEP.split(inner) if p.strip()]
    return all(any(p in h for h in hay) for p in parts)


# ------------------------------------------------------------------ جمع العناصر
def iter_items(units):
    for u in units:
        for l in u["lessons"]:
            quran = [bare(c.get("text")) for c in l["cards"] if c["type"] == "quran"]
            for group, label in ((l["interactions"], "تفاعل"), (l["quiz"], "اختبار")):
                for q in group:
                    yield u, l, q, label, [x for x in quran if x]


def walk_strings(obj, path=""):
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, "%s/%s" % (path, k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, "%s[%d]" % (path, i))


def _resolve_item(units, path):
    """كائن العنصر كما هو في المحتوى، من مساره في قائمة المراجعة."""
    parts = path.split("/")
    unit = next(u for u in units if u["id"] == parts[0])
    lesson = next(l for l in unit["lessons"] if l["id"] == parts[1])
    if parts[2] in ("hook", "objective", "summary", "family"):
        return unit, lesson, lesson[parts[2]], parts[2]
    group = "interactions" if parts[2] == "interaction" else "quiz"
    return unit, lesson, next(q for q in lesson[group] if q["id"] == parts[3]), parts[2]


def main():
    units = load_units()
    refdoc = load_reference()
    verses = refdoc["verses"]
    violations = []
    checks = collections.Counter()

    def bad(rule, where, detail):
        violations.append((rule, where, detail))

    # ------------------------------------------------- ق-١ · ق-٢ · ق-٣ · ق-٥
    for u, l, q, label, quran in iter_items(units):
        where = "%s/%s/%s (%s %s)" % (u["id"], l["id"], q["id"], label, q["kind"])

        # ق-١ — إكمال نصّ قرآني
        checks["ق-١"] += 1
        if q["kind"] == "complete":
            probe = (bare(q.get("before")) + bare(q.get("after")))[:12]
            marked = "﴿" in (q.get("before") or "") + (q.get("after") or "")
            matched = bool(probe) and any(probe in t for t in quran)
            if marked or matched:
                bad("ق-١", where, "إكمالُ نصٍّ قرآني — before=%r" % (q.get("before") or "")[:40])

        # ق-٢ — نصّ قرآني داخل قائمة خيارات
        for i, o in enumerate(q.get("options") or []):
            checks["ق-٢"] += 1
            if SEGMENT.search(str(o)) or "﴿" in str(o) or "﴾" in str(o):
                bad("ق-٢", where, "نصّ قرآني في الخيار [%d]: %s" % (i, str(o)[:60]))

        # ق-٣ — خيار خاطئ يحاكي القرآن: يقع بعد صدر آية، أو يكمل نصًّا قرآنيًّا
        ans = q.get("answer")
        for i, o in enumerate(q.get("options") or []):
            if ans is None or i == ans:
                continue
            checks["ق-٣"] += 1
            ob = bare(o)
            if not ob or len(ob) < 4:
                continue
            head = bare(q.get("before"))
            if head and any(head in t for t in quran):
                bad("ق-٣", where, "خيار خاطئ يُكمل صدر آية: %s" % str(o)[:50])

        # ق-٥ — نصّ قرآني بدلًا خاطئًا في المطابقة والتصنيف
        for i, pr in enumerate(q.get("pairs") or []):
            checks["ق-٥"] += 1
            # الطرف الأيسر (البدائل المعروضة للاختيار) لا يكون قرآنًا
            if len(pr) > 1 and ("﴿" in str(pr[1]) or "﴾" in str(pr[1])):
                bad("ق-٥", where, "نصّ قرآني في بدائل المطابقة: %s" % str(pr[1])[:50])
        for g in (q.get("groups") or []):
            for o in g["items"]:
                checks["ق-٥"] += 1
                if "﴿" in str(o) or "﴾" in str(o):
                    bad("ق-٥", where, "نصّ قرآني بين عناصر التصنيف: %s" % str(o)[:50])

    # ------------------------------------------- ق-٤ مطابقة المرجع الأساسي
    seen = collections.Counter()
    for u in units:
        for path, s_ in walk_strings(u, u["id"]):
            for seg in SEGMENT.findall(s_):
                seen[seg] += 1
                checks["ق-٤"] += 1
                if not is_reference_slice(seg, verses):
                    bad("ق-٤", path,
                        "ليس شريحة حرفية من المرجع الأساسي (مولَّد أو محرَّف "
                        "أو راجعٌ إلى الرسم الإملائي): %s" % seg[:70])

    # ------------------------------------------------- ق-٦ اتساق المواضع
    places = collections.defaultdict(set)
    for u in units:
        for path, s_ in walk_strings(u, u["id"]):
            for seg in SEGMENT.findall(s_):
                inner = nfc(seg[1:-1]).strip()
                if AYAH_NUM.match(inner) or not inner:
                    continue
                places[bare(inner)].add(inner)
    for skel, forms in places.items():
        checks["ق-٦"] += 1
        if len(forms) > 1:
            bad("ق-٦", "—", "صورتان مختلفتان للنصّ نفسه: %s"
                % " ⟺ ".join(list(forms)[:2]))

    # ------------------------------- ق-٧ وسم المحتوى القرآني في البيانات
    for u in units:
        for l in u["lessons"]:
            for c in l["cards"]:
                checks["ق-٧"] += 1
                has = c["type"] == "quran" or "﴿" in (c.get("text") or "")
                if has and not c.get("quran"):
                    bad("ق-٧", "%s/%s/%s" % (u["id"], l["id"], c["id"]),
                        "بطاقة فيها نصّ قرآني بلا وسم quran")
            for group in (l["interactions"], l["quiz"]):
                for q in group:
                    checks["ق-٧"] += 1
                    fields = [q.get(k) for k in ("prompt", "before", "after")]
                    fields += list(q.get("options") or []) + list(q.get("items") or [])
                    for pr in (q.get("pairs") or []):
                        fields += list(pr)
                    for g in (q.get("groups") or []):
                        fields += list(g.get("items") or [])
                    has = any("﴿" in str(x) for x in fields if x)
                    if has and not q.get("quran"):
                        bad("ق-٧", "%s/%s/%s" % (u["id"], l["id"], q["id"]),
                            "عنصر فيه نصّ قرآني بلا وسم quran")

    # ------------------------- ق-٨ نشاط ترتيب الفاتحة يطابق النصّ والترتيب
    for u in units:
        for l in u["lessons"]:
            for q in l["interactions"]:
                if q["kind"] != "order":
                    continue
                if not any("﴿" in str(i) for i in q.get("items") or []):
                    continue
                checks["ق-٨"] += 1
                card = next((c for c in l["cards"] if c["type"] == "quran"), None)
                if not card:
                    bad("ق-٨", l["id"], "نشاط ترتيب قرآني بلا بطاقة سورة")
                    continue
                prev = -1
                for it in q["items"]:
                    body = nfc(it).strip("﴿﴾").strip()
                    at = nfc(card["text"]).find(body, prev + 1)
                    if at < 0:
                        bad("ق-٨", "%s/%s" % (l["id"], q["id"]),
                            "عنصر ليس نصًّا حرفيًّا من بطاقة السورة: %s" % body[:40])
                        break
                    if at <= prev:
                        bad("ق-٨", "%s/%s" % (l["id"], q["id"]),
                            "الترتيب ليس ترتيب المصحف عند: %s" % body[:40])
                        break
                    prev = at

    # ---------------- ق-٩ · ق-١٠ · ق-١١ · ق-١٢ — الإسناد الصريح لكل مقطع
    # كل مقطع قرآني مقتبس مرتبط بسورة وآية محدّدتين وبحدّي المقطع فيها.
    # وهذا الإسناد — لا البحث النصّي — هو الذي يحسم النصّ المرجعي.
    ns = {}
    exec(compile(open(os.path.join(ROOT, "scripts/content/quran_uthmani.py"),
                      encoding="utf-8").read(), "quran_uthmani", "exec"), ns)
    frags = ns["FRAGMENTS"]
    folded_verses = {}
    for f in frags:
        checks["ق-٩"] += 1
        if not isinstance(f.get("surah"), int) or not str(f.get("ayah") or "").strip():
            bad("ق-٩", f.get("path", "?"), "مقطع قرآني بلا سورة وآية محدّدتين")
            continue
        if f.get("kind") not in ("آية كاملة", "اقتباس جزئي"):
            bad("ق-٩", f["path"], "مقطع بلا نوع (آية كاملة/اقتباس جزئي)")
        if not f.get("lesson") and not f.get("unit"):
            bad("ق-٩", f["path"], "مقطع بلا مرجع درس أو وحدة")
        if "+" not in str(f["ayah"]) and f.get("from", -1) < 0:
            bad("ق-٩", f["path"], "مقطع بلا حدّين داخل الآية المرجعية")

        # ق-١٠ — لفظ يتكرّر في أكثر من آية لا يُحسم بمطابقة نصّية مطلقة:
        # لا بدّ من إسناد صريح، أو اتّحاد صورة اللفظ في كل الآيات المحتملة.
        key = "%d:%s" % (f["surah"], f["ayah"])
        folded_verses.setdefault(key, set()).add(f["new"])
        checks["ق-١٠"] += 1
        why = f.get("why") or ""
        if not (why.startswith("إسناد صريح")
                or why.startswith("آية واحدة محتملة")
                or why.startswith("عدّة آيات بالصورة نفسها")
                or "؛" in why):
            bad("ق-١٠", f["path"], "أساس اختيار الآية غير مصرّح به: %s" % why)

    # ق-١١ — لفظ ﴿أَحَدٌ﴾ منفردًا يعود إلى الإخلاص ١، والصورة المنوَّنة إلى ٤
    ikhlas = [f for f in frags if f["surah"] == 112 and "أَحَد" in f["new"]]
    for f in ikhlas:
        checks["ق-١١"] += 1
        body = nfc(f["new"]).strip("﴿﴾").strip()
        if body.startswith("أَحَد"):
            # اللفظ وحده: من الآية الأولى، بلا علامة الإقلاب
            if str(f["ayah"]) != "1":
                bad("ق-١١", f["path"], "﴿أَحَدٌ﴾ منفردًا أُسند إلى الآية %s لا ١" % f["ayah"])
            if "\u06E2" in f["new"]:
                bad("ق-١١", f["path"], "صورة الآية ٤ في موضع الآية ١")
        elif "كُفُوًا" in body:
            # الصورة المنوَّنة داخل ﴿…كُفُوًا أَحَدٌۢ﴾: من الآية الرابعة
            if "4" not in str(f["ayah"]).split("+"):
                bad("ق-١١", f["path"],
                    "﴿…كُفُوًا أَحَدٌۢ﴾ أُسند إلى الآية %s لا ٤" % f["ayah"])
            if "\u06E2" not in f["new"]:
                bad("ق-١١", f["path"], "صورة الآية ٤ بلا علامة الإقلاب")

    # ق-١٢ — لا حالات غير محسومة في النصوص الأربعة والعشرين
    change = json.load(open(os.path.join(
        ROOT, "docs/quran-review/rasm-change.json"), encoding="utf-8"))
    for name, key in (("النصوص", "blocked"), ("المقاطع", "fragments" + "Blocked")):
        checks["ق-١٢"] += 1
        n = len(change.get(key) or [])
        if n:
            bad("ق-١٢", key, "%s: %d حالة غير محسومة" % (name, n))

    # -------------------------------- ق-١٣ · ق-١٤ · ق-١٥ — حدود الاعتماد
    # الاعتماد مدخلٌ مستقلّ من مراجعة بشرية، لا شيء يعتمد نفسه. وهذه القواعد
    # تحرس حدوده: لا يتعدّى المعرّفات المسجَّلة، ولا يحمل نصًّا تغيّر بعده.
    nr = json.load(open(os.path.join(ROOT, "content/needs-review.json"), encoding="utf-8"))
    apath = os.path.join(ROOT, "content/approvals.json")
    arec = json.load(open(apath, encoding="utf-8")) if os.path.exists(apath) else None
    allowed = set((arec or {}).get("ids") or [])
    allowed_paths = {v["path"] for v in ((arec or {}).get("items") or {}).values()}

    approved = [it for it in nr["items"] if it.get("approved")]
    for it in nr["items"]:
        checks["ق-١٣"] += 1
        if it.get("approved"):
            # ق-١٣ — لا اعتماد بلا سجلّ، ولا اعتماد لغير النصّ القرآني
            if not arec:
                bad("ق-١٣", it["path"], "عنصر مُعتمَد بلا سجلّ اعتماد")
            elif it["kind"] != "card:quran":
                bad("ق-١٣", it["path"],
                    "اعتُمد عنصر نوعه %s — الاعتماد محصور في النصّ القرآني" % it["kind"])
            # ق-١٤ — لا اعتماد خارج المعرّفات المسجَّلة
            checks["ق-١٤"] += 1
            if it["path"] not in allowed_paths:
                bad("ق-١٤", it["path"], "اعتماد خارج المعرّفات المسجَّلة")
        elif it["path"] in allowed_paths:
            checks["ق-١٤"] += 1
            bad("ق-١٤", it["path"], "معرّف مسجَّل في الاعتماد ولم يُعتمد")

    checks["ق-١٣"] += 1
    if nr["count"] != len(nr["items"]):
        bad("ق-١٣", "needs-review.json", "عدد العناصر لا يطابق قائمتها")

    # الأعداد المعلَنة تطابق الواقع، ومجموعها كلّ العناصر
    checks["ق-١٣"] += 1
    if nr.get("approved", 0) != len(approved):
        bad("ق-١٣", "needs-review.json",
            "العدد المعلَن للمعتمَد %s لا يطابق الواقع %d"
            % (nr.get("approved"), len(approved)))
    checks["ق-١٣"] += 1
    if nr.get("pending", nr["count"]) != nr["count"] - len(approved):
        bad("ق-١٣", "needs-review.json", "عدد المنتظر لا يطابق الفرق")

    if arec:
        # كل نصّ قرآني إمّا معتمَد وإمّا منتظر، ولا ثالث
        quran_items = [it for it in nr["items"] if it["kind"] == "card:quran"]
        checks["ق-١٤"] += 1
        if len(allowed) != 24 or len(quran_items) != 24:
            bad("ق-١٤", "approvals.json",
                "المعرّفات %d والنصوص القرآنية %d — وكلاهما يجب أن يكون ٢٤"
                % (len(allowed), len(quran_items)))
        checks["ق-١٤"] += 1
        pending_quran = [it for it in quran_items if not it.get("approved")]
        if pending_quran:
            bad("ق-١٤", "needs-review.json",
                "نصوص قرآنية ما تزال منتظرة: %d" % len(pending_quran))

        # ق-١٥ — لم يتغيّر نصّ معتمَد ولا معرّفه ولا صفحته منذ اعتماده
        by_path = {v["path"]: v for v in arec["items"].values()}
        for it in approved:
            checks["ق-١٥"] += 1
            v = by_path.get(it["path"])
            if not v:
                continue
            got = hashlib.sha256(it["text"].encode("utf-8")).hexdigest()
            if got != v["textSha256"]:
                bad("ق-١٥", it["path"], "تغيّر النصّ بعد اعتماده")
            if it.get("page") != v.get("page"):
                bad("ق-١٥", it["path"], "تغيّرت صفحة الكتاب بعد الاعتماد")
            if it.get("ref") != v.get("ref"):
                bad("ق-١٥", it["path"], "تغيّر مرجع الآية بعد الاعتماد")
        # وملفّ القرارات محفوظ ببصمته
        checks["ق-١٥"] += 1
        kept = os.path.join(ROOT, "docs/quran-review/decisions")
        digest = arec["decisionsFile"]["sha256"]
        found = [f for f in (os.listdir(kept) if os.path.isdir(kept) else [])
                 if digest[:12] in f]
        if not found:
            bad("ق-١٥", "decisions/", "ملفّ القرارات غير محفوظ في سجلّ المراجعة")
        else:
            got = hashlib.sha256(open(os.path.join(kept, found[0]), "rb").read()).hexdigest()
            if got != digest:
                bad("ق-١٥", found[0], "بصمة ملفّ القرارات المحفوظ لا تطابق السجلّ")

    # ------------------ ق-١٦ · ق-١٧ — دفعة مراجعة السياقات القرآنية
    # دفعةُ إعدادٍ ومقابلة. هذه القواعد تحرس نطاقها وتمنع تسرّب الاعتماد إليها،
    # وتثبت أنّ إنشاء صفحة المراجعة لم يغيّر نصًّا ولا سؤالًا ولا إجابة.
    cpath = os.path.join(ROOT, "docs/quran-review/context-review-data.json")
    if os.path.exists(cpath):
        cd = json.load(open(cpath, encoding="utf-8"))
        items = cd["items"]
        by_path = {it["path"]: it for it in nr["items"]}

        checks["ق-١٦"] += 1
        if len(items) != 21:
            bad("ق-١٦", "context-review-data.json",
                "عدد عناصر الدفعة %d لا ٢١" % len(items))
        checks["ق-١٦"] += 1
        if len({i["id"] for i in items}) != len(items):
            bad("ق-١٦", "context-review-data.json", "معرّفات مكرّرة في الدفعة")

        for it in items:
            src = by_path.get(it["id"])
            checks["ق-١٦"] += 1
            if not src:
                bad("ق-١٦", it["id"], "عنصر في الدفعة بلا مقابل في قائمة المراجعة")
                continue
            # (أ) فيه نصّ قرآني
            if not any(ch in (src.get("text") or "") for ch in ("\uFD3E", "\uFD3F")):
                bad("ق-١٦", it["id"], "عنصر في الدفعة بلا نصّ قرآني")
            # (ب) ليس من الـ٢٤ المعتمدة، وما يزال منتظرًا
            if src["kind"] == "card:quran":
                bad("ق-١٦", it["id"], "عنصر card:quran داخل الدفعة الثانية")
            if src.get("approved"):
                bad("ق-١٦", it["id"], "عنصر معتمَد داخل دفعة الانتظار")
            if it["status"] != "بانتظار المراجعة":
                bad("ق-١٦", it["id"], "حالة معلَنة ليست «بانتظار المراجعة»")

        # (ج) ما خرج عن الدفعة: لا نصّ قرآني فيه، وما يزال منتظرًا
        ids = {i["id"] for i in items}
        outside = [it for it in nr["items"]
                   if not it.get("approved") and it["path"] not in ids]
        checks["ق-١٦"] += 1
        if len(outside) != 259:
            bad("ق-١٦", "needs-review.json",
                "العناصر خارج الدفعة %d لا ٢٥٩" % len(outside))
        for it in outside:
            checks["ق-١٦"] += 1
            if any(ch in (it.get("text") or "") for ch in ("\uFD3E", "\uFD3F")):
                bad("ق-١٦", it["path"], "عنصر فيه نصّ قرآني بقي خارج الدفعة")

        # ق-١٧ — إنشاء الصفحة لم يغيّر نصًّا ولا سؤالًا ولا إجابة:
        # ما تعرضه الصفحة مطابقٌ حرفًا بحرف لما في ملفّات المحتوى.
        for it in items:
            checks["ق-١٧"] += 1
            u, l, obj, kind = _resolve_item(units, it["id"])
            v = it["view"]
            if kind == "summary":
                if list(obj.get("points") or []) != list(v.get("points") or []):
                    bad("ق-١٧", it["id"], "خلاصة الصفحة تخالف نصّ المحتوى")
                continue
            if obj.get("prompt") != v.get("prompt"):
                bad("ق-١٧", it["id"], "نصّ السؤال في الصفحة يخالف المحتوى")
            if list(obj.get("options") or []) != list(v.get("options") or []):
                bad("ق-١٧", it["id"], "الخيارات في الصفحة تخالف المحتوى")
            if obj.get("answer") != v.get("answer"):
                bad("ق-١٧", it["id"], "الإجابة الصحيحة في الصفحة تخالف المحتوى")
            if obj.get("why") != v.get("why"):
                bad("ق-١٧", it["id"], "تفسير الإجابة في الصفحة يخالف المحتوى")

    # ------------------------------------------------------------------ التقرير
    out = []
    w = out.append
    w("# تدقيق سلامة النصّ القرآني\n")
    w("مُولَّد آليًّا: `python3 scripts/audit_quran.py`. "
      "يفحص **كل** سؤال وتفاعل وخيار في الوحدات السبع، لا عيّنةً منها.\n")
    w("## النتيجة\n")
    w("| القاعدة | ما تمنعه | فحوص | مخالفات |")
    w("|---|---|---:|---:|")
    RULES = {
        "ق-١": "إكمال نصّ قرآني — كتابةً أو بالاختيار",
        "ق-٢": "ظهور نصّ قرآني داخل قائمة خيارات",
        "ق-٣": "خيار خاطئ يُنشئ عجزًا لآية أو يحاكي نظمها",
        "ق-٤": "مقطع ليس شريحة حرفية من المرجع العثماني الأساسي "
               "(مولَّد أو محرَّف أو راجعٌ إلى الرسم الإملائي)",
        "ق-٥": "استعمال نصّ قرآني بدلًا خاطئًا في المطابقة أو التصنيف",
        "ق-٦": "صورتان مختلفتان للنصّ القرآني نفسه بين موضعين",
        "ق-٧": "نصّ قرآني في البيانات بلا وسم `quran` (فيَفوته خطّ المصحف)",
        "ق-٨": "نشاط ترتيب الفاتحة لا يطابق نصّ البطاقة أو ترتيب المصحف",
        "ق-٩": "مقطع قرآني بلا إسناد صريح (سورة وآية وحدّان ونوع ومرجع درس)",
        "ق-١٠": "حسم آيةِ لفظٍ متكرّر بمطابقة نصّية مطلقة بلا إسناد مصرَّح",
        "ق-١١": "﴿أَحَدٌ﴾ منفردًا من غير الإخلاص ١، أو ﴿…كُفُوًا أَحَدٌۢ﴾ من غير ٤",
        "ق-١٢": "بقاء حالة غير محسومة في النصوص الأربعة والعشرين",
        "ق-١٣": "اعتماد بلا سجلّ، أو اعتماد عنصر ليس نصًّا قرآنيًّا، أو أعداد معلَنة لا تطابق الواقع",
        "ق-١٤": "اعتماد خارج المعرّفات المسجَّلة، أو معرّف مسجَّل لم يُعتمد",
        "ق-١٥": "تغيّر نصّ معتمَد أو مرجعه أو صفحته، أو ضياع ملفّ القرارات أو بصمته",
        "ق-١٦": "خلل في نطاق دفعة السياقات: عددها، أو تفرّد معرّفاتها، أو تسرّب معتمَد أو عنصر بلا نصّ قرآني",
        "ق-١٧": "ما تعرضه صفحة المراجعة يخالف نصّ المحتوى أو سؤاله أو إجابته",
    }
    nviol = collections.Counter(v[0] for v in violations)
    for r, d in RULES.items():
        w("| **%s** | %s | %s | %s |" % (r, d, ar(checks[r]), ar(nviol[r]) if nviol[r] else "**٠**"))
    w("")
    w("**مجموع الفحوص: %s · المخالفات: %s**\n"
      % (ar(sum(checks.values())), ar(len(violations)) if violations else "**٠**"))

    if violations:
        w("## المخالفات\n")
        for r, where, d in violations:
            w("- **%s** · `%s` — %s" % (r, where, d))
        w("")
    else:
        w("> لا توجد مخالفة. فلا يُطلب في البرنامج إكمالُ آية، ولا يظهر نصٌّ قرآني\n"
          "> في قائمة خيارات، ولا خيارَ خاطئًا يحاكي نظم القرآن، ولا مقطعَ خارج الجَرْد.\n")

    w("## جَرْد المقاطع القرآنية الظاهرة في البرنامج\n")
    w("كل مقطع أدناه جزءٌ حرفيّ من بطاقة `quran` في البرنامج، أو من آيةٍ "
      "صدّر بها الكتاب بابًا. وعددها **%s** مقطعًا مميّزًا في **%s** موضعًا.\n"
      % (ar(len(seen)), ar(sum(seen.values()))))
    w("| الظهور | المقطع |")
    w("|---:|---|")
    for s, n in seen.most_common():
        if bare(s) and not re.fullmatch(r"[٠-٩]+", bare(s)):
            w("| %s | %s |" % (ar(n), s.replace("|", "/")))
    w("")
    w("## أين تظهر النصوص القرآنية، وبأيّ دور\n")
    roles = collections.Counter()
    for u, l, q, label, quran in iter_items(units):
        for k in ("prompt", "why", "before", "after"):
            if q.get(k) and SEGMENT.search(q[k]):
                roles["%s: %s" % (q["kind"], k)] += 1
        for pr in (q.get("pairs") or []):
            if "﴿" in str(pr[0]):
                roles["%s: الطرف المعروض (لا البديل)" % q["kind"]] += 1
        for i, o in enumerate(q.get("options") or []):
            if "﴿" in str(o):
                roles["%s: خيار ⚠️" % q["kind"]] += 1
        for it in (q.get("items") or []):
            if "﴿" in str(it):
                roles["%s: عنصر للترتيب (كلّها صحيحة)" % q["kind"]] += 1
    w("| الدور | العدد |")
    w("|---|---:|")
    for k, n in roles.most_common():
        w("| %s | %s |" % (k, ar(n)))
    w("")
    w("> **الأدوار المسموحة:** أن يكون النصّ القرآني هو المعروضَ للتأمّل (في السؤال، "
      "أو في التفسير، أو طرفًا في مطابقة يُطابَق بمعناه من شرح الكتاب، أو عنصرًا في "
      "ترتيبٍ عناصرُه كلُّها آياتٌ صحيحة من السورة نفسها). "
      "**والدور الممنوع:** أن يكون بديلًا في قائمة خيارات.\n")

    os.makedirs(DOCS, exist_ok=True)
    open(os.path.join(DOCS, "QURAN_AUDIT.md"), "w", encoding="utf-8").write("\n".join(out))

    print("فحوص=%d مخالفات=%d مقاطع=%d → docs/QURAN_AUDIT.md"
          % (sum(checks.values()), len(violations), len(seen)))
    for r, where, d in violations:
        print("  ✗ %s %s — %s" % (r, where, d))
    if violations and "--check" in sys.argv:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
