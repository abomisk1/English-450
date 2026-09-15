#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
الدفعة الثانية للمراجعة: العناصر التي تحوي نصًّا قرآنيًّا ولم تُعتمد.

**إعدادٌ ومقابلة، لا اعتماد ولا تعديل.** يستخرج الدفعة بشروط صريحة، ويعرض
كل عنصر كاملًا كما يراه المتعلّم، ويجري عليه فحصين **مستقلّين**:

  الجانب الأول — سلامة النصّ القرآني: مقابلة المقطع بالمرجع المعتمد،
  وسورته وآيته وحدوده، ورسمه وتشكيله وعلامات وقفه، وخطّ المصحف،
  وألّا يكون خيارًا مضللًا، وربطه بالبطاقة القرآنية المعتمدة.

  الجانب الثاني — سلامة السياق التعليمي: مصدر الصياغة، وصحّة الإجابة
  وتفرّدها، وسلامة الخيارات الخاطئة، ومطابقة التفسير، وسياق الآية.

ونجاح الفحص القرآني **لا يُعدّ دليلًا** على سلامة السؤال أو الشرح حوله:
النتيجتان منفصلتان في المخرج، ولا تُطوى إحداهما في الأخرى.

المخرج:  docs/quran-review/context-review-data.json
التشغيل: python3 scripts/make_context_review_data.py
"""
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))


def nfc(t):
    return unicodedata.normalize("NFC", t or "")


ORNATE = ("﴾", "﴿")
SEG = re.compile(r"﴿[^﴾﴿]*﴾")
AYAH_MARK = re.compile(r"^﴿[٠-٩\s]+﴾$")
AR = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def ar(n):
    return str(n).translate(AR)


_REF = None


def _haystacks():
    """آيات المرجع العثماني، ومعها كل آيتين متتاليتين مضمومتين."""
    global _REF
    if _REF is None:
        ref = json.load(open(os.path.join(
            ROOT, "content/quran-reference.json"), encoding="utf-8"))
        # المرجع الأساسي وحده هو المقياس؛ والشاهد مسجَّل للمراجعة لا للمطابقة.
        vals = {k: nfc(v["primary"]) for k, v in ref["verses"].items()}
        hay = list(vals.values())
        for k, v in vals.items():
            sid, a = k.split(":")
            nk = "%s:%d" % (sid, int(a) + 1)
            if nk in vals:
                hay.append(v + " " + vals[nk])
        _REF = [re.sub(r"\s+", " ", h).strip() for h in hay]
    return _REF


def _is_slice(seg):
    """هل المقطع — بلا قوسَي الاقتباس — شريحةٌ حرفية من آية في المرجع؟"""
    body = re.sub(r"\s+", " ", nfc(seg).strip("\uFD3F\uFD3E")).strip()
    body = re.sub(r"\s*\uFD3F[\u0660-\u0669\s]+\uFD3E\s*", " ", body).strip()
    body = body.rstrip("\u2026.…").strip()
    return any(body in h for h in _haystacks()) if body else True


_WORD = re.compile(r"[\u0621-\u064A]")


def _naked_quran(t):
    """نصٌّ قرآنيّ باقٍ خارج قوسَي الاقتباس — فلا يأخذ خطّ المصحف.

    يُقاس بالمطابقة الحرفية للمرجع: يُنزع ما بين القوسين، ثم يُبحث في
    الباقي عن نافذةٍ طويلة تطابق آيةً من المرجع حرفًا بحرف.
    """
    if not isinstance(t, str):
        return []
    rest = re.sub(r"\s+", " ", SEG.sub(" ", nfc(t))).strip()
    if len(_WORD.findall(rest)) < 12:
        return []
    hay = _haystacks()
    words = rest.split()
    out = []
    for n in range(len(words), 2, -1):
        for i in range(0, len(words) - n + 1):
            w = " ".join(words[i:i + n]).strip(" .،؛:")
            if len(_WORD.findall(w)) >= 12 and any(w in h for h in hay):
                out.append(w)
                return out
    return out


def has_quran(t):
    return isinstance(t, str) and any(c in t for c in ORNATE)


def q_segments(t):
    """المقاطع القرآنية في نصّ، عدا أرقام الآيات."""
    return [m.group(0) for m in SEG.finditer(t or "") if not AYAH_MARK.match(m.group(0))]


# ------------------------------------------------------------ ١) ضبط النطاق
def build_batch(nr):
    """الدفعة بشروطها الخمسة الصريحة، وكلٌّ منها يُفحص ويُسجَّل."""
    conds, batch, seen = [], [], set()
    for it in nr["items"]:
        c1 = has_quran(it.get("text"))                       # فيه نصّ قرآني
        c2 = it["kind"] != "card:quran"                      # ليس من الـ٢٤
        c3 = not it.get("approved")                          # بانتظار المراجعة
        if c1 and c2 and c3:
            if it["path"] in seen:                           # لا تكرار
                raise SystemExit("معرّف مكرّر في الدفعة: %s" % it["path"])
            seen.add(it["path"])
            batch.append(it)
        conds.append((it["path"], c1, c2, c3))
    # الشرط الخامس: ما لا نصّ قرآني فيه خارج الدفعة قطعًا
    outside = [p for p, c1, _c2, _c3 in conds if not c1]
    if seen & set(outside):
        raise SystemExit("تسرّب عنصر بلا نصّ قرآني إلى الدفعة")
    return batch, len(outside)


# --------------------------------------------------- استخراج العنصر كاملًا
def resolve(units, path):
    """يعيد كائن العنصر كما هو في المحتوى، من مساره في قائمة المراجعة."""
    parts = path.split("/")
    unit = next(u for u in units if u["id"] == parts[0])
    lesson = next(l for l in unit["lessons"] if l["id"] == parts[1])
    if parts[2] in ("hook", "objective", "summary", "family"):
        return unit, lesson, lesson[parts[2]], parts[2]
    group = {"interaction": "interactions", "quiz": "quiz"}[parts[2]]
    obj = next(q for q in lesson[group] if q["id"] == parts[3])
    return unit, lesson, obj, parts[2]


def full_view(obj, kind):
    """العنصر كاملًا كما يراه المتعلّم — لا المقطع القرآني وحده."""
    v = {"kind": kind}
    if kind == "summary":
        v["points"] = list(obj.get("points") or [])
        return v
    v["qkind"] = obj.get("kind")
    v["prompt"] = obj.get("prompt")
    v["options"] = list(obj.get("options") or [])
    v["answer"] = obj.get("answer")
    v["answerText"] = (v["options"][obj["answer"]]
                       if obj.get("answer") is not None
                       and isinstance(obj.get("answer"), int)
                       and 0 <= obj["answer"] < len(v["options"]) else None)
    v["why"] = obj.get("why")
    v["items"] = list(obj.get("items") or [])
    v["pairs"] = [list(p) for p in (obj.get("pairs") or [])]
    v["groups"] = [{"name": g.get("name"), "items": list(g.get("items") or [])}
                   for g in (obj.get("groups") or [])]
    v["before"], v["after"] = obj.get("before"), obj.get("after")
    return v


def book_anchors(lesson):
    """النصوص المنقولة من الكتاب في الدرس — بها تُقابَل الصياغة."""
    out = []
    for c in lesson.get("cards", []):
        if c.get("src") in ("book", "quran", "hadith", "dhikr"):
            txt = c.get("text") or " · ".join(
                "%s: %s" % (i["term"], i["def"]) for i in (c.get("items") or []))
            if txt:
                out.append({"cardId": c["id"], "type": c["type"], "src": c.get("src"),
                            "page": c.get("page"), "text": txt})
    return out


# ------------------------------- الجانب الأول: سلامة النصّ القرآني
def check_quran(item, view, frags_by_path, approved_cards, card_ref, obj_path):
    """فحصٌ قرآنيّ مستقلّ. يعيد (الحالة، البنود، التنبيهات، المصادر)."""
    checks, warns, sources = [], [], []
    segs = []
    for field in ("points", "prompt", "why", "options", "items"):
        val = view.get(field)
        for t in (val if isinstance(val, list) else [val]):
            segs += [(field, s) for s in q_segments(t)]
    for pr in view.get("pairs") or []:
        for t in pr:
            segs += [("pairs", s) for s in q_segments(t)]
    for g in view.get("groups") or []:
        for t in g["items"]:
            segs += [("groups", s) for s in q_segments(t)]

    checks.append(("المقاطع القرآنية في العنصر", "%s مقطعًا" % ar(len(segs)), "info"))

    # (أ) كل مقطع مسنَد إلى سورة وآية وحدَّين — من سجلّ الإسناد الصريح
    resolved = []
    for field, s in segs:
        rec = frags_by_path.get((obj_path, s))
        if rec:
            resolved.append((field, s, rec))
            sources.append({
                "segment": s, "field": field,
                "surah": rec["surah"], "ayah": rec["ayah"],
                "from": rec["from"], "to": rec["to"], "type": rec["kind"],
                "basis": rec["why"],
            })
    ok_prov = len(resolved) == len(segs)
    checks.append(("إسناد كل مقطع إلى سورة وآية وحدَّين",
                   "%s من %s" % (ar(len(resolved)), ar(len(segs))),
                   "ok" if ok_prov else "warn"))
    if not ok_prov:
        warns.append("مقطعٌ بلا إسناد صريح في سجلّ التحويل — يحتاج نظرًا.")

    # (ب) الربط بالبطاقة القرآنية المعتمدة التي يستند إليها
    linked = []
    for _f, _s, rec in resolved:
        for a in str(rec["ayah"]).split("+"):
            cands = approved_cards.get((rec["surah"], a)) or []
            if not cands:
                continue
            # ترجيح بطاقة الدرس نفسه، فهي مستند العنصر لا بطاقةٌ بعيدة
            same = [c for c in cands if c.split("/")[0] == item["lessonId"]]
            pick = (same or cands)[0]
            if pick not in linked:
                linked.append(pick)
    checks.append(("مستند إلى بطاقة قرآنية معتمدة",
                   " · ".join("%s (%s)" % (k, card_ref.get(k, "")) for k in linked)
                   if linked else "لا رابط",
                   "ok" if linked else "warn"))
    if not linked:
        warns.append("لا يستند إلى بطاقة قرآنية معتمدة — يحتاج نظرًا.")

    # (ج) الرسم والتشكيل وعلامات الوقف: تُقاس بالمطابقة الحرفية للمرجع
    # العثماني على مستوى Unicode — لا بقواعد حدسية على صور الحروف. فإن كان
    # المقطع شريحةً حرفية من آية المرجع، فرسمه وتشكيله وعلاماته رسمُ المرجع
    # وتشكيله وعلاماته بالضرورة.
    unmatched = [s for _f, s in segs if not _is_slice(s)]
    checks.append(("شريحة حرفية من المرجع العثماني (Unicode)",
                   "%s من %s" % (ar(len(segs) - len(unmatched)), ar(len(segs))),
                   "ok" if not unmatched else "bad"))
    checks.append(("الرسم والتشكيل وعلامات الوقف",
                   "رسم المرجع وتشكيله وعلاماته" if not unmatched
                   else "لا يطابق المرجع ⚠️",
                   "ok" if not unmatched else "bad"))
    if unmatched:
        warns.append("مقطعٌ ليس شريحة حرفية من المرجع: %s" % " · ".join(unmatched[:2]))

    # (هـ) خطّ المصحف: الواجهة تُلبس خطَّ المصحف ما كان **داخل قوسَي الاقتباس**
    # وحده (دالّة `qtext()`). فنصٌّ قرآنيّ خارجهما يُعرض بخطّ الواجهة.
    # والمقياس هنا: هل بقي في العنصر نصّ قرآني خارج القوسين؟
    naked = []
    for field in ("points", "prompt", "why", "options", "items"):
        val = view.get(field)
        for t in (val if isinstance(val, list) else [val]):
            naked += _naked_quran(t)
    checks.append(("خطّ المصحف على كل نصّ قرآني",
                   "كلّه داخل قوسَي الاقتباس" if not naked
                   else "نصّ قرآني خارج القوسين يُعرض بخطّ الواجهة ⚠️",
                   "ok" if not naked else "bad"))
    if naked:
        warns.append("نصّ قرآني خارج قوسَي الاقتباس، فلا يأخذ خطّ المصحف: «%s…»"
                     % naked[0][:48])

    # (ز) ترجيحٌ آليّ بين آيات متطابقة الصورة — إسنادٌ يحتاج حسمًا صريحًا
    guessed = [(s_, r_) for _f, s_, r_ in resolved
               if str(r_.get("why", "")).startswith("عدّة آيات بالصورة نفسها في المصحف")]
    checks.append(("إسناد الآية مقرَّر لا مرجَّح آليًّا",
                   "مقرَّر" if not guessed
                   else "رُجّح آليًّا بين آيات متطابقة الصورة ⚠️",
                   "ok" if not guessed else "bad"))
    for s_, r_ in guessed:
        warns.append("المقطع «%s» أُسند إلى %s:%s بترجيحٍ آليّ بين آيات متطابقة "
                     "الصورة في المصحف — يحتاج إسنادًا صريحًا بالنظر في السياق."
                     % (s_[:40], r_["surah"], r_["ayah"]))

    # (و) ألّا تكون آية أو جزء منها خيارًا مضللًا
    opts = view.get("options") or []
    ans = view.get("answer")
    wrong_q = [o for i, o in enumerate(opts) if i != ans and has_quran(o)]
    any_q_opt = [o for o in opts if has_quran(o)]
    if not opts:
        state, note = "ok", "لا خيارات في هذا العنصر"
    elif wrong_q:
        state, note = "bad", "نصّ قرآني في خيار خاطئ ⚠️"
        warns.append("آية أو جزء منها وردت خيارًا خاطئًا.")
    elif any_q_opt:
        state, note = "warn", "نصّ قرآني في الخيار الصحيح — يحتاج نظرًا"
    else:
        state, note = "ok", "لا نصّ قرآني في الخيارات"
    checks.append(("لا آية خيارًا مضللًا", note, state))

    bad = any(c[2] == "bad" for c in checks)
    warn = any(c[2] == "warn" for c in checks)
    verdict = "يحتاج نظرًا ⚠️" if bad else ("مطابق مع تنبيه" if warn else "مطابق")
    return verdict, checks, warns, sources


# ------------------------- الجانب الثاني: سلامة السياق التعليمي
SRC_LABEL = {
    "book": "منقول حرفيًّا من الكتاب",
    "quran": "نصّ قرآني منقول من المرجع",
    "hadith": "حديث منقول من الكتاب",
    "dhikr": "ذكر منقول من الكتاب",
    "derived": "مستخلص من معنى صريح في الكتاب",
    "authored": "صياغة تعليمية مساعدة",
}


def _bare(t):
    return re.sub(r"[ؐ-ًؚ-ٰٟۖ-ۭ\s⸫﴿﴾،.:؛!؟«»()\[\]]",
                  "", t or "")


def check_context(item, view, lesson, anchors):
    """فحصُ سياقٍ مستقلّ. لا يحكم على المعنى — يثبت ما يمكن إثباته، ويحيل الباقي."""
    checks, warns = [], []
    src = item.get("src") or "authored"
    label = SRC_LABEL.get(src, src)

    # (أ) مصدر الصياغة — مأخوذ من وسم المحتوى نفسه
    checks.append(("مصدر الصياغة", label, "info"))

    # (ب) هل نثرُ العنصر (غير القرآني) منقولٌ حرفيًّا من نصّ الكتاب في الدرس؟
    prose = []
    for f in ("points", "options", "items"):
        prose += [t for t in (view.get(f) or []) if isinstance(t, str)]
    for f in ("prompt", "why"):
        if view.get(f):
            prose.append(view[f])
    stripped = [SEG.sub(" ", t) for t in prose]
    hay = " ".join(_bare(a["text"]) for a in anchors)
    literal = sum(1 for t in stripped if _bare(t) and len(_bare(t)) > 12 and _bare(t) in hay)
    checks.append(("نثرٌ منقول حرفيًّا من نصّ الكتاب في الدرس",
                   "%s من %s مقطعًا" % (ar(literal), ar(len(stripped))),
                   "info"))
    if src == "authored":
        warns.append("صياغة تعليمية مساعدة: تحتاج مقابلةً بصفحة الكتاب للتأكّد "
                     "من أنها لا تستحدث معنى ولا حكمًا.")

    # (ج) الإجابة: موجودة، وواحدة لا أكثر
    opts, ans = view.get("options") or [], view.get("answer")
    if opts:
        has_ans = isinstance(ans, int) and 0 <= ans < len(opts)
        checks.append(("الإجابة الصحيحة محدَّدة",
                       opts[ans] if has_ans else "غير محدَّدة ⚠️",
                       "ok" if has_ans else "bad"))
        dupes = len(opts) != len({_bare(o) for o in opts})
        checks.append(("الخيارات متمايزة، فلا إجابتان محتملتان",
                       "متمايزة" if not dupes else "فيها تكرار ⚠️",
                       "ok" if not dupes else "bad"))
        if dupes:
            warns.append("خياران متطابقان بعد التجريد — قد تحتمل إجابتين.")
        checks.append(("عدد الخيارات", ar(len(opts)), "info"))
        # الخيارات الخاطئة: حكمٌ شرعيّ ملتبس لا يُقاس آليًّا
        warns.append("الخيارات الخاطئة تحتاج نظرًا بشريًّا: هل فيها معنى شرعيّ ملتبس؟")
    else:
        checks.append(("الإجابة الصحيحة", "لا سؤال في هذا العنصر", "info"))

    # (د) تفسير الإجابة: موجود، ويذكر مستنده
    if view.get("why"):
        cites = bool(re.search(r"ص\s*[٠-٩]+|الكتاب|نصّ الكتاب", view["why"]))
        checks.append(("تفسير الإجابة يذكر مستنده من الكتاب",
                       "يذكره" if cites else "لا يذكره — يحتاج نظرًا",
                       "ok" if cites else "warn"))
        if not cites:
            warns.append("التفسير لا يحيل إلى الكتاب صراحةً.")
    elif opts:
        checks.append(("تفسير الإجابة", "لا تفسير ⚠️", "warn"))
        warns.append("سؤال بلا تفسير للإجابة.")

    # (هـ) سياق الآية: البطاقة القرآنية في الدرس نفسه
    same = any(c["type"] == "quran" for c in lesson.get("cards", []))
    checks.append(("الآية في درسها لا في غيره",
                   "بطاقة السورة في الدرس نفسه" if same else "لا بطاقة قرآنية في الدرس",
                   "ok" if same else "warn"))
    if not same:
        warns.append("لا بطاقة قرآنية في هذا الدرس — يُنظر في سياق الآية.")

    warns.append("مقابلة الشرح بصفحة الكتاب ص %s مطلوبة بالنظر، ولا تُقاس آليًّا."
                 % ar(item.get("page") or "—"))

    bad = any(c[2] == "bad" for c in checks)
    verdict = ("يحتاج نظرًا ⚠️" if bad
               else "يحتاج مقابلة بصرية")
    return verdict, checks, warns, label


# -------------------------------------------------------------------- البناء
def main():
    nr = json.load(open(os.path.join(ROOT, "content/needs-review.json"), encoding="utf-8"))
    manifest = json.load(open(os.path.join(ROOT, "content/manifest.json"), encoding="utf-8"))
    units = [json.load(open(os.path.join(ROOT, "content", u["file"]), encoding="utf-8"))
             for u in manifest["units"]]

    ns = {}
    exec(compile(open(os.path.join(ROOT, "scripts/content/quran_uthmani.py"),
                      encoding="utf-8").read(), "quran_uthmani", "exec"), ns)
    # فهرس الإسناد: (مسار العنصر، نصّ المقطع) → السجلّ
    idx = {"u%d" % i: u for i, u in enumerate(units, 1)}
    frags_by_path = {}
    for f in ns["FRAGMENTS"]:
        p = f["path"].rsplit("#", 1)[0]
        m = re.match(r"(u\d)/lessons\[(\d+)\]/(\w+)(?:\[(\d+)\])?", p)
        if not m:
            continue
        uid, li, grp, gi = m.group(1), int(m.group(2)), m.group(3), m.group(4)
        lesson = idx[uid]["lessons"][li]
        if grp == "summary":
            key = "%s/%s/summary" % (uid, lesson["id"])
        elif grp in ("interactions", "quiz"):
            g = lesson["interactions" if grp == "interactions" else "quiz"][int(gi)]
            key = "%s/%s/%s/%s" % (uid, lesson["id"],
                                   "interaction" if grp == "interactions" else "quiz", g["id"])
        else:
            continue
        frags_by_path[(key, f["new"])] = f

    # البطاقات القرآنية المعتمدة، مفهرسة بـ(السورة، الآية) — من جدول المقابلة
    # الذي يحمل رقم السورة وآياتها لكل بطاقة، لا من تخمين على النصّ.
    apath = os.path.join(ROOT, "content/approvals.json")
    arec = json.load(open(apath, encoding="utf-8")) if os.path.exists(apath) else {"items": {}}
    coll = json.load(open(os.path.join(
        ROOT, "docs/quran-review/collation.json"), encoding="utf-8"))
    approved_cards, card_ref = {}, {}
    for row in coll["rows"]:
        key = "%s/%s" % (row["lesson"], row["card"])
        if key not in arec["items"]:
            continue
        card_ref[key] = row["ref"]
        for a in row.get("ayat") or []:
            # قد تشترك بطاقتان في آية (البسملة والفاتحة مثلًا)، فتُحفظ
            # كلّها ويُرجَّح عند الربط ما كان في درس العنصر نفسه.
            approved_cards.setdefault((row["surahNo"], str(a)), []).append(key)

    batch, n_outside = build_batch(nr)

    # وسم `quran` على العنصر — من المحتوى نفسه
    tag = {}
    for u in units:
        for l in u["lessons"]:
            if l.get("summary", {}).get("points"):
                tag["%s/%s/summary" % (u["id"], l["id"])] = any(
                    has_quran(p) for p in l["summary"]["points"])
            for grp, name in ((l["interactions"], "interaction"), (l["quiz"], "quiz")):
                for q in grp:
                    tag["%s/%s/%s/%s" % (u["id"], l["id"], name, q["id"])] = bool(q.get("quran"))

    out = []
    for it in sorted(batch, key=lambda x: x["seq"]):
        unit, lesson, obj, kind = resolve(units, it["path"])
        view = full_view(obj, kind)
        it = dict(it)
        it["_quranTag"] = tag.get(it["path"], False)
        anchors = book_anchors(lesson)
        qv, qc, qw, sources = check_quran(
            it, view, frags_by_path, approved_cards, card_ref, it["path"])
        cv, cc, cw, label = check_context(it, view, lesson, anchors)
        page = it.get("page")
        img = "pages/book-p%03d.png" % int(page) if page else None
        if img and not os.path.exists(os.path.join(ROOT, "docs/quran-review", img)):
            img = None
        out.append({
            "id": it["path"], "seq": it["seq"],
            "unit": unit["id"], "unitTitle": unit["shortTitle"],
            "lesson": lesson["id"], "lessonTitle": lesson["title"],
            "kind": it["kind"], "view": view,
            "page": page, "image": img,
            "bookAnchors": anchors,
            "sourceLabel": label, "src": it.get("src"),
            "quran": {"verdict": qv, "checks": qc, "warnings": qw, "sources": sources},
            "context": {"verdict": cv, "checks": cc, "warnings": cw},
            "status": "بانتظار المراجعة",
            "route": it["route"],
            "priority": it["priorityAr"],
        })

    doc = {
        "generatedFrom": "scripts/make_context_review_data.py",
        "note": "دفعةُ إعدادٍ ومقابلة. لا تعتمد عنصرًا، ولا تعدّل محتوى. "
                "ونجاح الفحص القرآني لا يدلّ على سلامة السياق التعليمي.",
        "scope": {
            "conditions": [
                "تحتوي آية أو مقطعًا قرآنيًّا",
                "ليست من عناصر card:quran الأربعة والعشرين المعتمدة",
                "حالتها «بانتظار المراجعة»",
                "لا تكرار في المعرّفات",
                "لا يدخل فيها عنصر لا يحتوي نصًّا قرآنيًّا",
            ],
            "total": nr["count"], "approved": nr.get("approved", 0),
            "pending": nr.get("pending", nr["count"]),
            "batch": len(out), "outsideBatch": n_outside,
        },
        "count": len(out),
        "byKind": {k: sum(1 for x in out if x["kind"] == k) for k in sorted({x["kind"] for x in out})},
        "bySource": {k: sum(1 for x in out if x["sourceLabel"] == k)
                     for k in sorted({x["sourceLabel"] for x in out})},
        "items": out,
    }
    p = os.path.join(ROOT, "docs/quran-review/context-review-data.json")
    json.dump(doc, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("الدفعة=%d · خارجها=%d · معتمَد=%d · منتظر=%d → %s"
          % (len(out), n_outside, doc["scope"]["approved"], doc["scope"]["pending"],
             os.path.relpath(p, ROOT)))
    print("   الأنواع:", " · ".join("%s=%d" % kv for kv in doc["byKind"].items()))
    print("   المصادر:", " · ".join("%s=%d" % kv for kv in doc["bySource"].items()))
    return 0


def _surah_of(row, change):
    return row.get("surahNo") or 0


if __name__ == "__main__":
    sys.exit(main())
