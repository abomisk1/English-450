#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
يُعدّ بيانات صفحة «مراجعة النصوص القرآنية» داخل المعاينة الخاصة.

لا يحسم شيئًا ولا يعتمد شيئًا: يجمع ما أنتجته أدوات المقابلة (collation.json)
وتقرير التحويل (rasm-change.json) وسجلّ الإسناد (quran_uthmani.FRAGMENTS)
في ملف واحد يقرؤه العرض، ليقابل المراجعُ النصَّ بصورة صفحة الكتاب بعينه.

المخرج:  docs/quran-review/review-data.json
التشغيل: python3 scripts/make_review_page_data.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

REVIEW_DIR = os.path.join(ROOT, "docs", "quran-review")
AR = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def ar(n):
    return str(n).translate(AR)


# وصف الموضع في واجهة المتعلّم، مشتقًّا من مسار الإسناد لا مكتوبًا يدويًّا.
PLACE_WORDS = [
    (r"cards\[(\d+)\]/items\[(\d+)\]/term", "بطاقة {0} · مصطلح {1}"),
    (r"cards\[(\d+)\]/items\[(\d+)\]/def", "بطاقة {0} · شرح {1}"),
    (r"cards\[(\d+)\]/text", "نصّ البطاقة {0}"),
    (r"interactions\[(\d+)\]/pairs\[(\d+)\]\[(\d+)\]", "تفاعل {0} · زوج {1}"),
    (r"interactions\[(\d+)\]/items\[(\d+)\]", "تفاعل {0} · عنصر {1}"),
    (r"interactions\[(\d+)\]/options\[(\d+)\]", "تفاعل {0} · خيار {1}"),
    (r"interactions\[(\d+)\]/groups\[(\d+)\]/items\[(\d+)\]", "تفاعل {0} · مجموعة {1}"),
    (r"interactions\[(\d+)\]/prompt", "نصّ تفاعل {0}"),
    (r"interactions\[(\d+)\]/why", "تعليل تفاعل {0}"),
    (r"quiz\[(\d+)\]/options\[(\d+)\]", "سؤال {0} · خيار {1}"),
    (r"quiz\[(\d+)\]/prompt", "نصّ سؤال {0}"),
    (r"quiz\[(\d+)\]/why", "تعليل سؤال {0}"),
    (r"summary/points\[(\d+)\]", "خلاصة · نقطة {0}"),
    (r"assessment\[(\d+)\]/q", "تقويم الوحدة · سؤال {0}"),
    (r"assessment\[(\d+)\]/options\[(\d+)\]", "تقويم الوحدة · سؤال {0} · خيار {1}"),
]


def place_label(path):
    for pat, word in PLACE_WORDS:
        m = re.search(pat, path)
        if m:
            return word.format(*[ar(int(g) + 1) for g in m.groups()])
    return path.split("/")[-1]


def main():
    coll = json.load(open(os.path.join(REVIEW_DIR, "collation.json"), encoding="utf-8"))
    # حالة كل نصّ تُقرأ من ناتج البناء، لا تُكتب هنا يدويًّا.
    nr = json.load(open(os.path.join(ROOT, "content/needs-review.json"), encoding="utf-8"))
    state = {"%s/%s" % (i["lessonId"], i["path"].rsplit("/", 1)[-1]): i
             for i in nr["items"] if i["kind"] == "card:quran"}
    change = json.load(open(os.path.join(REVIEW_DIR, "rasm-change.json"), encoding="utf-8"))
    ns = {}
    exec(compile(open(os.path.join(ROOT, "scripts/content/quran_uthmani.py"),
                      encoding="utf-8").read(), "quran_uthmani", "exec"), ns)
    frags = ns["FRAGMENTS"]
    by_key = {r["key"]: r for r in change["rows"]}

    # مواضع كل آية في البرنامج، مأخوذة من الإسناد الصريح (سورة + آية)
    places = {}
    for f in frags:
        for a in str(f["ayah"]).split("+"):
            places.setdefault("%d:%s" % (f["surah"], a), []).append(f)

    texts, missing_img = [], []
    for row in coll["rows"]:
        key = "%s/%s" % (row["lesson"], row["card"])
        ch = by_key.get(key, {})
        img = "pages/book-p%03d.png" % int(row["page"])
        if not os.path.exists(os.path.join(REVIEW_DIR, img)):
            missing_img.append(img)
            img = None

        verses = []
        for v, cv in zip(row["verses"], ch.get("verses", [])):
            verses.append({
                "ayah": v["ayah"],
                "prog": v["prog"],
                "refPrimary": cv.get("refPrimary", v.get("qul")),
                "refWitness": cv.get("refWitness", v.get("enc")),
                "raw": v["res"].get("raw_primary"),
                "sliceFrom": cv.get("sliceFrom"),
                "sliceTo": cv.get("sliceTo"),
                "full": cv.get("full"),
                "sourcesAgree": cv.get("sourcesAgree"),
                "diffWitness": v.get("diff") or [],
            })

        # جميع مواضع ظهور آيات هذا النصّ في البرنامج
        occ = []
        for v in row["verses"]:
            for f in places.get("%d:%d" % (row["surahNo"], v["ayah"]), []):
                occ.append({
                    "path": f["path"].rsplit("#", 1)[0],
                    "where": place_label(f["path"]),
                    "lesson": f["lesson"], "unit": f["unit"],
                    "text": f["new"], "kind": f["kind"],
                    "ayah": f["ayah"], "basis": f["why"],
                })
        seen, uniq = set(), []
        for o in occ:
            if o["path"] not in seen:
                seen.add(o["path"])
                uniq.append(o)

        texts.append({
            "id": key,
            # ١) اسم السورة ورقم الآية
            "surah": row["surahName"], "ayat": row["ayat"],
            # ٢) معرّف الوحدة والدرس والبطاقة
            "unit": row["unit"], "unitTitle": row["unitTitle"],
            "lesson": row["lesson"], "lessonTitle": row["lessonTitle"],
            "card": row["card"],
            # ٣) النصّ الحالي في البرنامج
            "prog": row["text"],
            # ٤) النصّ من المرجع الأساسي  ٥) نتيجة المقارنة الحرفية الخام
            "verses": verses,
            "rawPrimary": row["rawPrimary"],
            "verdict": row["verdict"], "reason": row["reason"],
            # ٦) صورة موضعه من صفحة الكتاب  ٧) رقم الصفحة
            "image": img, "page": row["page"],
            # ٨) جميع مواضع ظهوره في البرنامج
            "places": uniq,
            # ٩) الفروق بين المصدرين
            "sourceDiff": [v["sourcesAgree"] for v in verses if v["sourcesAgree"]],
            # ١٠) حالة المراجعة الحالية — مقروءة من ناتج البناء، لا تتغيّر من هذه الصفحة
            "status": "معتمد" if state.get(key, {}).get("approved")
                      else "بانتظار المراجعة",
            "approvedAt": state.get(key, {}).get("approvedAt"),
            "visualCheck": state.get(key, {}).get("visualCheck"),
            "textBefore": ch.get("old"),
        })

    if missing_img:
        raise SystemExit("صور صفحات ناقصة: %s" % ", ".join(missing_img))

    out = {
        "generatedFrom": "scripts/make_review_page_data.py",
        "note": "بيانات مقابلةٍ بصرية للمراجع. لا تُغيّر حالة أيّ عنصر، "
                "ولا تُعدّل نصًّا، ولا تُعدّ اعتمادًا.",
        "primary": change["primary"], "witness": change["witness"],
        "count": len(texts),
        "approved": sum(1 for t in texts if t["status"] == "معتمد"),
        "pendingTotal": nr.get("pending", nr["count"]),
        "approvedTotal": nr.get("approved", 0),
        "unresolved": len(change.get("blocked", [])) + len(change.get("fragmentsBlocked", [])),
        "texts": texts,
    }
    path = os.path.join(REVIEW_DIR, "review-data.json")
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("نصوص=%d · صور=%d · مواضع=%d · غير محسومة=%d → %s"
          % (len(texts), len({t["image"] for t in texts}),
             sum(len(t["places"]) for t in texts), out["unresolved"],
             os.path.relpath(path, ROOT)))


if __name__ == "__main__":
    main()
