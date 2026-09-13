#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
يبني ملفات المحتوى (JSON) لبرنامج «بَرْدُ اليقين» من مصادر المحتوى في scripts/content.

المخرجات (وهي المصدر المعتمد للمراجعة والتحرير):
  content/manifest.json        فهرس البرنامج والأجزاء والوحدات.
  content/units/<id>.json      محتوى كل وحدة.
  content/needs-review.json    قائمة كل نصّ يحتاج إلى مراجعة واعتماد شرعي.

التشغيل:  python3 scripts/build_content.py
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from content.unit1 import UNIT1  # noqa: E402
from content.unit2 import UNIT2  # noqa: E402
from content.unit3 import UNIT3  # noqa: E402
from content.unit4 import UNIT4  # noqa: E402
from content.unit5 import UNIT5  # noqa: E402
from content.unit6 import UNIT6  # noqa: E402
from content.unit7 import UNIT7  # noqa: E402
from content.added_interactions import ADDED  # noqa: E402
from content.quran_uthmani import UTHMANI, FRAGMENTS, PRIMARY_SOURCE  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
UNITS = [UNIT1, UNIT2, UNIT3, UNIT4, UNIT5, UNIT6, UNIT7]

PROGRAM = {
    "id": "bard-al-yaqeen",
    "name": "بَرْدُ اليقين",
    "tagline": "رحلة علمية تجمع بين الثقافة الشرعية والحصانة الفكرية، في محتوى تفاعلي ميسّر ومتدرّج.",
    "contentVersion": "1.0.0",
    "schemaVersion": 1,
    "parts": [
        {
            "id": "part1",
            "order": 1,
            "title": "الجزء الأول",
            "status": "published",
            "book": {
                "id": "al-muhim-li-kulli-muslim",
                "title": "الْمُهِمّ لِكُلِّ مُسْلِم",
                "author": "سلطان بن جابر الجعدبي الظفيري",
                "edition": "الطبعة الأولى",
                "year": "١٤٤٨هـ - ٢٠٢٦م",
                "note": "اقتفى فيه المؤلف أثر الإمام عبدالعزيز بن باز رحمه الله في كتابه "
                        "(الدروس المهمة لعامة الأمة)، فأضاف وحذف وقدّم وأخّر وزاد مسائل ومباحث.",
                "pages": 79,
            },
        },
        {"id": "part2", "order": 2, "title": "الجزء الثاني", "status": "planned"},
        {"id": "part3", "order": 3, "title": "الجزء الثالث", "status": "planned"},
    ],
}


# أولوية المراجعة وسببها لكل نوع عنصر.
#   high   : خطؤه يمسّ نصًّا شرعيًّا أو يُحتسب في درجة المتعلّم.
#   medium : محتوى تعليمي يُعرض داخل الدرس ويؤثّر في الفهم.
#   low    : إطار تربوي حول الدرس لا يضيف حكمًا.
PRIORITY = {
    "interaction:complete-quran": ("high",
        "إكمال مقطع من آية بالاختيار — الخيارات الثلاثة الأخرى صياغات تُشبه القرآن "
        "وليست منه، فيحتاج إقرارًا صريحًا لأسلوب السؤال قبل النشر، لا لنصّه فقط."),
    "card:quran":          ("high", "نصّ قرآني كُتب بالرسم المعتمد ولم يُستخرج من ملف الكتاب؛ "
                                    "يحتاج تدقيقًا حرفيًّا وتشكيليًّا وتحقّقًا من حدود المقطع."),
    "quiz:scenario":       ("high", "موقف تطبيقي يُحتسب في درجة المتعلّم؛ "
                                    "يحتاج تأكيد أنّ الحكم فيه مطابق لنصّ الكتاب."),
    "interaction:scenario": ("medium", "موقف تطبيقي بصياغة مستحدثة يُعرض داخل الدرس؛ "
                                       "يحتاج تأكيد أنّ الحكم فيه مطابق لنصّ الكتاب."),
    # تفاعلات تعليمية مساعدة أُضيفت للدروس ذات السؤال الواحد (مستمدّة من نصّ الدرس).
    "interaction:complete":  ("medium", "إكمال نصّ بصياغة تعليمية مساعدة مستمدّة من نصّ الدرس؛ "
                                        "يحتاج تأكيد مطابقة النصّ للكتاب وسلامة الخيارات."),
    "interaction:mcq":       ("medium", "سؤال اختيار بصياغة تعليمية مساعدة مستمدّة من نصّ الدرس؛ "
                                        "يحتاج تأكيد أنه لا يضيف حكمًا ولا معلومة من خارج الكتاب."),
    "interaction:match":     ("medium", "مطابقة بصياغة تعليمية مساعدة مستمدّة من نصّ الدرس؛ "
                                        "يحتاج تأكيد صحّة الأزواج ومطابقتها لنصّ الكتاب."),
    "interaction:order":     ("medium", "ترتيب خطوات بصياغة تعليمية مساعدة مستمدّة من نصّ الدرس؛ "
                                        "يحتاج تأكيد أنّ الترتيب ثابت في نصّ الكتاب."),
    "interaction:classify":  ("medium", "تصنيف بصياغة تعليمية مساعدة مستمدّ من نصّ الدرس؛ "
                                        "يحتاج تأكيد أنّ التصنيف مأخوذ من الكتاب لا من اجتهاد."),
    "interaction:truefalse": ("medium", "صحيح/خطأ بصياغة تعليمية مساعدة مستمدّ من نصّ الدرس؛ "
                                        "يحتاج تأكيد أنّ الحكم فيه مطابق لنصّ الكتاب."),
    "card:note":           ("medium", "ملحوظة تعليمية مستحدثة تُعرض ضمن محتوى الدرس؛ "
                                      "يحتاج تأكيد أنها لا تضيف حكمًا ولا تفسيرًا من خارج الكتاب."),
    "summary":             ("medium", "خلاصة مستحدثة تلخّص الدرس؛ "
                                      "يحتاج تأكيد أنها لا تخلّ بمعنى النصّ ولا تختصره اختصالًا مخلًّا."),
    "hook":                ("low", "مدخل تشويقي مستحدث ليس من الكتاب؛ يحتاج إقرار الصياغة والأسلوب."),
    "objective":           ("low", "هدف إجرائي مستحدث للدرس؛ يحتاج إقرار الصياغة."),
    "family":              ("low", "اقتراح نشاط أسري مستحدث؛ يحتاج إقرار الصياغة."),
}

PRIORITY["quiz:complete-quran"] = PRIORITY["interaction:complete-quran"]

PRIORITY_AR = {"high": "عالية", "medium": "متوسطة", "low": "منخفضة"}


_TASHKEEL = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\s\u2E2B﴿﴾]")


def _bare(t):
    """تجريد النصّ من التشكيل والمسافات لمقارنة المقاطع القرآنية."""
    return _TASHKEEL.sub("", t or "")


def _book_anchor(lesson):
    """أقرب نصّ منقول من الكتاب داخل الدرس، ليُعرض بجوار الصياغة المستحدثة."""
    for c in lesson.get("cards", []):
        if c.get("src") == "book" and c.get("type") != "note":
            txt = c.get("text") or " | ".join(
                "%s: %s" % (i["term"], i["def"]) for i in (c.get("items") or []))
            if txt:
                return {"text": txt[:600], "page": c.get("page"), "cardId": c.get("id"),
                        "type": c.get("type")}
    for c in lesson.get("cards", []):
        if c.get("type") in ("hadith", "dhikr") and c.get("text"):
            return {"text": c["text"][:600], "page": c.get("page"), "cardId": c.get("id"),
                    "type": c.get("type")}
    return None


def walk_review(unit):
    """يجمع كل عنصر يحتاج إلى مراجعة شرعية داخل وحدة، مع ما يلزم المراجعَ."""
    out = []
    seq = [0]

    def push(kind, lesson, path, obj, text=None, ref=None, page=None, anchor=None):
        prio, reason = PRIORITY.get(kind, ("medium", "عنصر مستحدث يحتاج اعتمادًا قبل النشر."))
        seq[0] += 1
        out.append({
            "seq": seq[0],
            "unitId": unit["id"],
            "unit": unit["shortTitle"],
            "lessonId": lesson["id"],
            "lesson": lesson["title"],
            "kind": kind,
            "path": path,
            "src": obj.get("src") if isinstance(obj, dict) else None,
            "ref": ref,
            "page": page,
            "priority": prio,
            "priorityAr": PRIORITY_AR[prio],
            "reason": reason,
            # النصّ كاملًا — لا يُقتطع، لأنّ المراجع يحتاج قراءته ثم تحريره.
            "text": text or "",
            # مرساة من الكتاب تُعرض بجوار الصياغة المستحدثة (متى أمكن).
            "bookContext": anchor,
            # موضع ظهوره في واجهة المتعلّم.
            "route": "#/lesson/%s/%s" % (unit["id"], lesson["id"]),
        })

    for lesson in unit["lessons"]:
        base = "%s/%s" % (unit["id"], lesson["id"])
        anchor = _book_anchor(lesson)
        for key in ("hook", "objective", "summary", "family"):
            node = lesson.get(key)
            if node and node.get("needsReview"):
                txt = node.get("text") or "\n".join("• " + p for p in node.get("points", []))
                push(key, lesson, "%s/%s" % (base, key), node, txt,
                     page=lesson["source"]["pages"][0], anchor=anchor)
        for c in lesson["cards"]:
            if c.get("needsReview"):
                txt = c.get("text") or "\n".join(
                    "%s: %s" % (i["term"], i["def"]) for i in (c.get("items") or []))
                push("card:" + c["type"], lesson, "%s/cards/%s" % (base, c["id"]), c,
                     txt, c.get("ref"), c.get("page"),
                     anchor=None if c["type"] == "quran" else anchor)
        quran_texts = [_bare(c.get("text")) for c in lesson["cards"] if c.get("type") == "quran"]
        for group, label in ((lesson["interactions"], "interaction"), (lesson["quiz"], "quiz")):
            for q in group:
                # إكمال مقطع قرآني بالاختيار: يدخل المراجعة بأعلى أولوية ولو كان مشتقًّا،
                # لأنّ خيارات الإلهاء صياغات تُشبه القرآن وليست منه.
                if q.get("kind") == "complete" and quran_texts:
                    probe = (_bare(q.get("before")) + _bare(q.get("after")))[:12]
                    if probe and any(probe in t for t in quran_texts):
                        body = q.get("prompt", "") + "\n" + "\n".join(
                            ("✔ " if i == q.get("answer") else "— ") + o
                            for i, o in enumerate(q.get("options") or []))
                        if q.get("why"):
                            body += "\nالتفسير: " + q["why"]
                        push("interaction:complete-quran" if label == "interaction"
                             else "quiz:complete-quran",
                             lesson, "%s/%s/%s" % (base, label, q["id"]), q, body,
                             None, q.get("page"), anchor=anchor)
                        continue
                if q.get("needsReview"):
                    body = q.get("prompt", "")
                    if q.get("options"):
                        body += "\n" + "\n".join(
                            ("✔ " if i == q.get("answer") else "— ") + o
                            for i, o in enumerate(q["options"]))
                    if q.get("why"):
                        body += "\nالتفسير: " + q["why"]
                    push(label + ":" + q["kind"], lesson,
                         "%s/%s/%s" % (base, label, q["id"]),
                         q, body, None, q.get("page"), anchor=anchor)
    return out


def merge_added_interactions():
    """يدمج التفاعلات التعليمية المساعدة المضافة للدروس ذات السؤال الواحد.

    الشرط: أن يكون معرّف الدرس معروفًا، وألّا يتكرّر معرّف التفاعل داخل الدرس.
    وكلّها `src="authored"` فتدخل قائمة المراجعة تلقائيًّا ولا تُعتمد إلا بإقرار.
    """
    seen = set()
    added = 0
    for u in UNITS:
        for l in u["lessons"]:
            extra = ADDED.get(l["id"])
            if not extra:
                continue
            seen.add(l["id"])
            have = {q["id"] for q in l["interactions"]}
            for q in extra:
                if q["id"] in have:
                    raise SystemExit("تكرار معرّف تفاعل في الدرس %s: %s" % (l["id"], q["id"]))
                have.add(q["id"])
                l["interactions"].append(q)
                added += 1
    missing = set(ADDED) - seen
    if missing:
        raise SystemExit("دروس غير موجودة في المحتوى: %s" % ", ".join(sorted(missing)))
    return added


ORNATE = ("\uFD3E", "\uFD3F")


def is_quran_string(t):
    """وسمٌ دلاليّ: النصّ القرآني يُعرف بقوسَي الآية المزخرفين."""
    return isinstance(t, str) and any(ch in t for ch in ORNATE)


def apply_uthmani():
    """يستبدل نصوص بطاقات القرآن بالنصّ العثماني المنقول حرفيًّا من المرجع.

    لا استبدال بخوارزمية ولا كتابة من الذاكرة: النصوص مولّدة في
    scripts/content/quran_uthmani.py شرائحَ حرفية من المرجع الأساسي.
    """
    seen, applied = set(), 0
    for u in UNITS:
        for l in u["lessons"]:
            for c in l["cards"]:
                if c["type"] != "quran":
                    continue
                key = "%s/%s" % (l["id"], c["id"])
                rec = UTHMANI.get(key)
                if not rec:
                    raise SystemExit("بطاقة قرآنية بلا نصّ عثماني معتمد: %s" % key)
                seen.add(key)
                if c["text"] != rec["text"]:
                    applied += 1
                c["text"] = rec["text"]
                c["rasm"] = "عثماني"
                c["textSource"] = PRIMARY_SOURCE
    missing = set(UTHMANI) - seen
    if missing:
        raise SystemExit("نصوص عثمانية بلا بطاقة: %s" % ", ".join(sorted(missing)))
    return applied


_FRAG_RE = None


def apply_fragments():
    """يستبدل المقاطع القرآنية المقتبسة في الشروح والأسئلة والخلاصات.

    **مرورٌ واحد** بتعبير نمطيّ يجمع كل المقاطع مرتَّبةً من الأطول إلى الأقصر،
    فلا يُعاد المسح على ناتج الاستبدال ولا تتداخل القواعد بعضها في بعض.
    والقيم شرائح حرفية من المرجع الأساسي — لا خوارزمية ولا كتابة يدوية.
    """
    global _FRAG_RE
    if not FRAGMENTS:
        return 0
    if _FRAG_RE is None:
        keys = sorted(FRAGMENTS, key=len, reverse=True)
        _FRAG_RE = re.compile("|".join(re.escape(k) for k in keys))
    n = [0]

    def fix(t):
        def rep(m):
            n[0] += 1
            return FRAGMENTS[m.group(0)]
        return _FRAG_RE.sub(rep, t)

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if isinstance(v, str):
                    o[k] = fix(v)
                else:
                    walk(v)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                if isinstance(v, str):
                    o[i] = fix(v)
                else:
                    walk(v)

    for u in UNITS:
        walk(u)
    return n[0]


def tag_quran_content():
    """يضع وسم `quran` على كل عنصر يعرض نصًّا قرآنيًّا — مشتقًّا لا مكتوبًا يدويًّا.

    فلا يُنسى موضع مستقبليّ: الوسم يُحسب من المحتوى نفسه في كل بناء.
    """
    n = 0
    for u in UNITS:
        for l in u["lessons"]:
            for c in l["cards"]:
                if c["type"] == "quran" or is_quran_string(c.get("text")):
                    c["quran"] = True
                    n += 1
            for group in (l["interactions"], l["quiz"]):
                for q in group:
                    fields = []
                    for k in ("prompt", "before", "after"):
                        fields.append(q.get(k))
                    fields += list(q.get("options") or [])
                    fields += list(q.get("items") or [])
                    for pr in (q.get("pairs") or []):
                        fields += list(pr)
                    for g in (q.get("groups") or []):
                        fields += list(g.get("items") or [])
                    if any(is_quran_string(x) for x in fields):
                        q["quran"] = True
                        n += 1
    return n


def strip_nulls(obj):
    if isinstance(obj, dict):
        return {k: strip_nulls(v) for k, v in obj.items() if v is not None}
    if isinstance(obj, list):
        return [strip_nulls(v) for v in obj]
    return obj


def main():
    os.makedirs(os.path.join(CONTENT, "units"), exist_ok=True)
    n_added = merge_added_interactions()
    n_uthmani = apply_uthmani()
    n_frag = apply_fragments()
    n_tagged = tag_quran_content()
    index, review = [], []
    total_lessons = total_cards = total_quiz = total_tasks = 0
    total_interactions = 0

    for u in UNITS:
        u = strip_nulls(u)
        path = os.path.join(CONTENT, "units", "%s.json" % u["id"])
        with open(path, "w", encoding="utf-8") as f:
            json.dump(u, f, ensure_ascii=False, indent=1)
        n_cards = sum(len(l["cards"]) for l in u["lessons"])
        n_quiz = sum(len(l["quiz"]) for l in u["lessons"])
        total_interactions += sum(len(l["interactions"]) for l in u["lessons"])
        total_lessons += len(u["lessons"])
        total_cards += n_cards
        total_quiz += n_quiz
        total_tasks += len(u["tasks"])
        index.append({
            "id": u["id"], "order": u["order"], "title": u["title"],
            "shortTitle": u["shortTitle"], "part": "part1",
            "pages": u["source"]["pages"],
            "lessonCount": len(u["lessons"]),
            "lessons": [{"id": l["id"], "title": l["title"],
                         "pages": l["source"]["pages"],
                         "tags": l.get("tags", [])} for l in u["lessons"]],
            "taskCount": len(u["tasks"]),
            "file": "units/%s.json" % u["id"],
        })
        review += walk_review(u)

    manifest = dict(PROGRAM)
    manifest["units"] = index
    manifest["stats"] = {
        "units": len(UNITS), "lessons": total_lessons,
        "cards": total_cards, "quizItems": total_quiz,
        "interactions": total_interactions, "tasks": total_tasks,
        "needsReview": len(review),
    }
    with open(os.path.join(CONTENT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    # ترقيم تسلسلي عامّ عبر كل الوحدات
    for i, it in enumerate(review, 1):
        it["seq"] = i
    by_priority = {}
    for it in review:
        by_priority[it["priority"]] = by_priority.get(it["priority"], 0) + 1
    with open(os.path.join(CONTENT, "needs-review.json"), "w", encoding="utf-8") as f:
        json.dump({
            "generatedFrom": "scripts/build_content.py",
            "policy": "كل نصّ قرآني (src=quran) وكل صياغة تعليمية مساعدة (src=authored) "
                      "يحتاج إلى مراجعة واعتماد قبل النشر.",
            "count": len(review),
            "byPriority": by_priority,
            "items": review,
        }, f, ensure_ascii=False, indent=1)

    print("units=%d lessons=%d cards=%d interactions=%d (+%d مساعدة) "
          "quiz=%d tasks=%d needsReview=%d"
          % (len(UNITS), total_lessons, total_cards, total_interactions, n_added,
             total_quiz, total_tasks, len(review)))
    print("رسم عثماني: %d بطاقة · %d مقطعًا مقتبسًا · وسم قرآني: %d عنصرًا"
          % (n_uthmani, n_frag, n_tagged))

    # البناء يفشل عند أي مخالفة شرعية، ولا يكتفي بالتنبيه (بند سادس).
    import subprocess
    r = subprocess.run([sys.executable,
                        os.path.join(ROOT, "scripts", "audit_quran.py"), "--check"])
    if r.returncode != 0:
        raise SystemExit("فشل البناء: تدقيق سلامة النصّ القرآني رصد مخالفة.")


if __name__ == "__main__":
    main()
