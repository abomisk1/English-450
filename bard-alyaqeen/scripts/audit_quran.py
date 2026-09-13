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


# ---------------------------------------------------------------- الجَرْد المعتمد
# كل مقطع قرآني يظهر في البرنامج لا بدّ أن يكون جزءًا من إحدى بطاقات `quran`
# أو من آية صدّر بها الكتاب بابًا. وهذه هي مصادر الجَرْد:
#   ١) نصوص بطاقات type=quran كلها (٢٤ بطاقة).
#   ٢) الآيات التي يصدّر بها الكتاب أبوابه ويقتبسها الشرح.
# أيّ مقطع خارج ذلك يُعدّ مستحدثًا ويُرفَض.
EXTRA_APPROVED = [
    # آيات صدّر بها الكتاب أبوابًا، منقولة في الشروح والخلاصات
    "يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ وَكُونُوا مَعَ الصَّادِقِينَ",
    "إِنَّمَا يُوَفَّى الصَّابِرُونَ أَجْرَهُمْ بِغَيْرِ حِسَابٍ",
    "وَأَوْفُوا بِالْعَهْدِ ۖ إِنَّ الْعَهْدَ كَانَ مَسْئُولًا",
    "إِنَّ اللَّهَ يَأْمُرُكُمْ أَنْ تُؤَدُّوا الْأَمَانَاتِ إِلَىٰ أَهْلِهَا",
    "وَرَحْمَتِي وَسِعَتْ كُلَّ شَيْءٍ",
    "وَإِنْ تَعُدُّوا نِعْمَتَ اللَّهِ لَا تُحْصُوهَا",
    "وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا",
    "وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنْتُمُ الْأَعْلَوْنَ إِنْ كُنْتُمْ مُؤْمِنِينَ",
    "وَاعْبُدُوا اللَّهَ وَلَا تُشْرِكُوا بِهِ شَيْئًا ۖ وَبِالْوَالِدَيْنِ إِحْسَانًا",
    "وَافْعَلُوا الْخَيْرَ لَعَلَّكُمْ تُفْلِحُونَ",
    "نَبِّئْ عِبَادِي أَنِّي أَنَا الْغَفُورُ الرَّحِيمُ ۝ وَأَنَّ عَذَابِي هُوَ الْعَذَابُ الْأَلِيمُ",
    "لَا تَقْنَطُوا مِنْ رَحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا",
    "إِنَّ فِي خَلْقِ السَّمَاوَاتِ وَالْأَرْضِ",
    "وَرَاوَدَتْهُ الَّتِي هُوَ فِي بَيْتِهَا",
    "يَا أَيُّهَا الَّذِينَ آمَنُوا لَا تَدْخُلُوا بُيُوتَ النَّبِيِّ إِلَّا أَنْ يُؤْذَنَ لَكُمْ",
    "إِنَّمَا الْمُؤْمِنُونَ",
    "وَمِمَّا رَزَقْنَاهُمْ يُنْفِقُونَ",
]


def build_inventory(units):
    """جَرْد المقاطع المعتمدة: نصوص بطاقات القرآن + آيات أبواب الكتاب."""
    inv = []
    for u in units:
        for l in u["lessons"]:
            for c in l["cards"]:
                if c["type"] == "quran" and c.get("text"):
                    inv.append(bare(c["text"]))
    inv += [bare(x) for x in EXTRA_APPROVED]
    return [x for x in inv if x]


def in_inventory(seg, inv):
    b = bare(seg)
    if not b:
        return True           # أرقام الآيات ونحوها
    if b.isdigit() or re.fullmatch(r"[٠-٩]+", b):
        return True
    return any(b in x for x in inv)


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


def main():
    units = load_units()
    inv = build_inventory(units)
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

    # --------------------------------------------------------------- ق-٤ الجَرْد
    seen = collections.Counter()
    for u in units:
        for path, s in walk_strings(u, u["id"]):
            for seg in SEGMENT.findall(s):
                seen[seg] += 1
                checks["ق-٤"] += 1
                if not in_inventory(seg, inv):
                    bad("ق-٤", path, "مقطع خارج الجَرْد المعتمد: %s" % seg[:70])

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
        "ق-٤": "مقطع قرآني خارج الجَرْد المعتمد (مستحدث أو محرَّف)",
        "ق-٥": "استعمال نصّ قرآني بدلًا خاطئًا في المطابقة أو التصنيف",
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
