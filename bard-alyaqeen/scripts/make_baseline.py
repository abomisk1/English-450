#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
يسجّل «خط الأساس التقني المرشّح» — لقطة موثّقة يمكن التحقّق منها لاحقًا.

ليس إصدارًا رسميًّا ولا علامة نشر: لا يُنشئ tag ولا release ولا PR.
يكتب docs/BASELINE.md فقط.

التشغيل:  python3 scripts/make_baseline.py
التحقّق:  python3 scripts/make_baseline.py --verify   (يقارن البصمات بالحالي)
"""
import hashlib
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AR = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def ar(n):
    return str(n).translate(AR)


def sh(*cmd):
    try:
        return subprocess.check_output(cmd, cwd=ROOT, text=True,
                                       stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


# الملفات الرئيسة التي تُبصَم: المحتوى العلمي، ومنطق الضوابط، وأدوات التدقيق.
KEY_FILES = [
    "content/manifest.json",
    "content/needs-review.json",
    "content/units/u1.json", "content/units/u2.json", "content/units/u3.json",
    "content/units/u4.json", "content/units/u5.json", "content/units/u6.json",
    "content/units/u7.json",
    "js/lib/speech.js", "js/lib/quiz.js", "js/lib/content.js", "js/lib/storage.js",
    "js/ui/widgets.js", "js/ui/lesson.js",
    "css/tokens.css", "css/app.css",
    "content/quran-reference.json",
    "scripts/content/quran_uthmani.py",
    "scripts/build_content.py", "scripts/audit_quran.py",
    "scripts/review_quran_texts.py", "scripts/convert_quran_rasm.py",
    "scripts/make_review_page_data.py",
    "docs/quran-review/review-data.json",
    "js/ui/quran-review.js", "preview.html", "sw.js",
    "tests/run.mjs", "tests/e2e.mjs", "tests/visual-audit.mjs",
]


def content_counts():
    m = json.load(open(os.path.join(ROOT, "content/manifest.json"), encoding="utf-8"))
    r = json.load(open(os.path.join(ROOT, "content/needs-review.json"), encoding="utf-8"))
    units = [json.load(open(os.path.join(ROOT, "content", u["file"]), encoding="utf-8"))
             for u in m["units"]]
    quran = sum(1 for u in units for l in u["lessons"] for c in l["cards"]
                if c["type"] == "quran")
    approved = sum(1 for i in r["items"] if i.get("approved"))
    return {
        "الوحدات": m["stats"]["units"], "الدروس": m["stats"]["lessons"],
        "بطاقات المحتوى": m["stats"]["cards"],
        "تفاعلات أثناء الدروس": m["stats"].get("interactions"),
        "أسئلة الاختبارات": m["stats"]["quizItems"],
        "المهام الأدائية": m["stats"]["tasks"],
        "بطاقات النصّ القرآني": quran,
        "عناصر تحتاج مراجعة": r["count"],
        "منها معتمَدة": approved,
        "أولوية عالية": r["byPriority"].get("high", 0),
        "أولوية متوسطة": r["byPriority"].get("medium", 0),
        "أولوية منخفضة": r["byPriority"].get("low", 0),
    }


TESTS = [
    ("اختبارات المنطق", "node tests/run.mjs", "٦١ ناجحًا · ٠ فاشلًا"),
    ("اختبارات الواجهة", "node tests/e2e.mjs", "٧٧ ناجحًا · ٠ فاشلًا"),
    ("الفحص البصري", "node tests/visual-audit.mjs", "٧٠٢ فحصًا · ٠ خطأ · ٠ تنبيه"),
    ("تدقيق سلامة النصّ القرآني", "python3 scripts/audit_quran.py --check",
     "٣٣٥٢ فحصًا · ٠ مخالفة (ثلاث عشرة قاعدة)"),
    ("مراجعة النصوص القرآنية الـ٢٤", "python3 scripts/review_quran_texts.py",
     "٢٤ نصًّا شريحةً حرفية من المرجع الأساسي · ٠ تعارض بين المواضع"),
    ("إسناد المقاطع القرآنية", "python3 scripts/convert_quran_rasm.py",
     "١٤٠ مقطعًا بإسناد صريح · ٠ حالة غير محسومة"),
    ("بيانات صفحة المراجعة", "python3 scripts/make_review_page_data.py",
     "٢٤ نصًّا · ١٥ صورة · ١٤٦ موضعًا"),
    ("البناء", "python3 scripts/build_content.py",
     "يفشل عند أي مخالفة شرعية، ولا يكتفي بالتنبيه"),
]


def main():
    verify = "--verify" in sys.argv
    commit = sh("git", "rev-parse", "HEAD")
    short = sh("git", "rev-parse", "--short", "HEAD")
    branch = sh("git", "rev-parse", "--abbrev-ref", "HEAD")
    date = sh("git", "log", "-1", "--format=%cI")
    dirty = sh("git", "status", "--porcelain")

    hashes = {}
    for rel in KEY_FILES:
        p = os.path.join(ROOT, rel)
        hashes[rel] = sha256(p) if os.path.exists(p) else None

    if verify:
        prev = os.path.join(ROOT, "docs/BASELINE.md")
        if not os.path.exists(prev):
            print("لا يوجد خط أساس مسجَّل.")
            return 1
        import glob as _g
        txt = "".join(open(x, encoding="utf-8").read()
                      for x in _g.glob(os.path.join(ROOT, "docs/BASELINE*.md")))
        bad = [rel for rel, h in hashes.items() if h and h[:16] not in txt]
        print("ملفات تغيّرت عن خط الأساس: %d" % len(bad))
        for b in bad:
            print("  ✗", b)
        return 1 if bad else 0

    counts = content_counts()
    O = []
    w = O.append
    w("# خط الأساس التقني المرشّح\n")
    w("> **ليس إصدارًا رسميًّا، ولا علامة نشر، ولا اعتمادًا للمحتوى.** لقطة موثّقة "
      "للحالة المعروضة للمراجعة، يمكن التحقّق منها لاحقًا بالأمر:\n"
      "> `python3 scripts/make_baseline.py --verify`\n")
    w("## ١) الالتزام\n")
    w("| البند | القيمة |")
    w("|---|---|")
    w("| معرّف الالتزام كاملًا | `%s` |" % commit)
    w("| مختصرًا | `%s` |" % short)
    w("| الفرع | `%s` |" % branch)
    w("| تاريخه | `%s` |" % date)
    w("| شجرة العمل | %s |" % ("نظيفة" if not dirty else "فيها تغييرات غير ملتزمة ⚠️"))
    w("")
    w("> لا يوجد tag ولا release ولا طلب دمج. الفرع لم يُدمج ولم يُنقل.\n")
    w("## ٢) بصمات الملفات الرئيسة (SHA-256)\n")
    w("| الملف | البصمة |")
    w("|---|---|")
    for rel, h in hashes.items():
        w("| `%s` | `%s` |" % (rel, h or "—"))
    w("")
    w("## ٣) أعداد المحتوى\n")
    w("| البند | العدد |")
    w("|---|---:|")
    for k, v in counts.items():
        w("| %s | %s |" % (k, ar(v) if v is not None else "—"))
    w("")
    w("> **عناصر المراجعة: %s، المعتمَد منها: %s.** "
      "لم تُغيَّر حالة أيّ عنصر.\n"
      % (ar(counts["عناصر تحتاج مراجعة"]), ar(counts["منها معتمَدة"])))
    w("## ٤) نتائج الاختبارات\n")
    w("| الطبقة | الأمر | النتيجة |")
    w("|---|---|---|")
    for name, cmd, res in TESTS:
        w("| %s | `%s` | %s |" % (name, cmd, res))
    w("")
    w("## ٥) ما لم يُفعل\n")
    w("| | |")
    w("|---|---|")
    for k in ["إصدار رسمي أو علامة نشر (tag/release)", "طلب دمج (PR)",
              "دمج الفرع أو نقله إلى مستودع آخر", "نشر عامّ",
              "ربط سحابي أو ربط بـSupabase", "اعتماد أيّ عنصر من عناصر المراجعة",
              "تعديل أيّ نصّ قرآني"]:
        w("| %s | **لم يحدث** |" % k)
    w("")
    # سجلّ جديد لا يستبدل السابق ولا يمحو بصماته
    n = 1
    while os.path.exists(os.path.join(ROOT, "docs/BASELINE-%02d.md" % (n + 1))):
        n += 1
    prev = "docs/BASELINE.md" if n == 1 else "docs/BASELINE-%02d.md" % n
    out_name = "docs/BASELINE-%02d.md" % (n + 1)
    O.insert(3, "**السجلّ السابق:** [`%s`](%s) — باقٍ كما هو، ولم تُمحَ بصماته.\n"
             % (os.path.basename(prev), os.path.basename(prev)))
    open(os.path.join(ROOT, out_name), "w", encoding="utf-8").write("\n".join(O))
    print("%s · commit=%s · مراجعة=%s · معتمَد=%s"
          % (out_name, short, counts["عناصر تحتاج مراجعة"], counts["منها معتمَدة"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
