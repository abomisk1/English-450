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
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from content.unit1 import UNIT1  # noqa: E402
from content.unit2 import UNIT2  # noqa: E402
from content.unit3 import UNIT3  # noqa: E402
from content.unit4 import UNIT4  # noqa: E402
from content.unit5 import UNIT5  # noqa: E402
from content.unit6 import UNIT6  # noqa: E402
from content.unit7 import UNIT7  # noqa: E402

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


def walk_review(unit):
    """يجمع كل عنصر يحتاج إلى مراجعة شرعية داخل وحدة."""
    out = []

    def push(kind, path, obj, text=None, ref=None, page=None):
        out.append({
            "unit": unit["id"], "kind": kind, "path": path,
            "src": obj.get("src") if isinstance(obj, dict) else None,
            "ref": ref, "page": page,
            "excerpt": (text or "")[:400],
        })

    for lesson in unit["lessons"]:
        base = "%s/%s" % (unit["id"], lesson["id"])
        for key in ("hook", "objective", "summary", "family"):
            node = lesson.get(key)
            if node and node.get("needsReview"):
                txt = node.get("text") or " | ".join(node.get("points", []))
                push(key, "%s/%s" % (base, key), node, txt, page=lesson["source"]["pages"][0])
        for c in lesson["cards"]:
            if c.get("needsReview"):
                txt = c.get("text") or " | ".join(
                    "%s: %s" % (i["term"], i["def"]) for i in (c.get("items") or []))
                push("card:" + c["type"], "%s/cards/%s" % (base, c["id"]), c,
                     txt, c.get("ref"), c.get("page"))
        for group, label in ((lesson["interactions"], "interaction"), (lesson["quiz"], "quiz")):
            for q in group:
                if q.get("needsReview"):
                    push(label + ":" + q["kind"], "%s/%s/%s" % (base, label, q["id"]),
                         q, q.get("prompt"), None, q.get("page"))
    return out


def strip_nulls(obj):
    if isinstance(obj, dict):
        return {k: strip_nulls(v) for k, v in obj.items() if v is not None}
    if isinstance(obj, list):
        return [strip_nulls(v) for v in obj]
    return obj


def main():
    os.makedirs(os.path.join(CONTENT, "units"), exist_ok=True)
    index, review = [], []
    total_lessons = total_cards = total_quiz = total_tasks = 0

    for u in UNITS:
        u = strip_nulls(u)
        path = os.path.join(CONTENT, "units", "%s.json" % u["id"])
        with open(path, "w", encoding="utf-8") as f:
            json.dump(u, f, ensure_ascii=False, indent=1)
        n_cards = sum(len(l["cards"]) for l in u["lessons"])
        n_quiz = sum(len(l["quiz"]) for l in u["lessons"])
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
        "cards": total_cards, "quizItems": total_quiz, "tasks": total_tasks,
        "needsReview": len(review),
    }
    with open(os.path.join(CONTENT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    with open(os.path.join(CONTENT, "needs-review.json"), "w", encoding="utf-8") as f:
        json.dump({
            "generatedFrom": "scripts/build_content.py",
            "policy": "كل نصّ قرآني (src=quran) وكل صياغة تعليمية مساعدة (src=authored) "
                      "يحتاج إلى مراجعة واعتماد قبل النشر.",
            "count": len(review),
            "items": review,
        }, f, ensure_ascii=False, indent=1)

    print("units=%d lessons=%d cards=%d quiz=%d tasks=%d needsReview=%d"
          % (len(UNITS), total_lessons, total_cards, total_quiz, total_tasks, len(review)))


if __name__ == "__main__":
    main()
