#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
استيراد قرارات المقابلة البصرية، واعتمادٌ **محدود** للنصوص القرآنية وحدها.

بوّابة مغلقة: لا يمرّ الاستيراد إلا إذا نجحت كل الفحوص. وأيّ نقص أو زيادة
أو تكرار في المعرّفات، أو قرارٌ واحد ليس «مطابق» — يُرفض الملفّ كلّه ولا
يُعتمد منه شيء. ولا يُعدَّل حرفٌ واحد من النصوص في أثناء الاستيراد.

المخرج:  content/approvals.json  — سجلّ الاعتماد الذي يقرؤه البناء،
         ونسخةٌ من ملفّ القرارات في docs/quran-review/decisions/ ببصمته.

التشغيل:  python3 scripts/import_visual_check.py <ملفّ القرارات .csv أو .json>
          python3 scripts/import_visual_check.py <الملفّ> --dry-run
"""
import csv
import datetime
import hashlib
import io
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPROVALS = os.path.join(ROOT, "content", "approvals.json")
DEC_DIR = os.path.join(ROOT, "docs", "quran-review", "decisions")

# القرار الوحيد الذي يفتح الاعتماد. وما عداه يوقف الاستيراد كلّه.
DECISION_OK = "طابقته بصريًّا: مطابق"
DECISION_ALT = {"طابقته بصريا: مطابق", "مطابق", "matched"}
ID_COL = ("المعرّف", "المعرف", "id")
DEC_COL = ("قرار المقابلة البصرية", "قرار المقابلة", "decision")
NOTE_COL = ("الملاحظة", "note")
AT_COL = ("وقت القرار", "at")


class Reject(SystemExit):
    """رفضٌ للملفّ كلّه — لا اعتماد جزئيّ."""

    def __init__(self, why, detail=""):
        super().__init__("⛔ رُفض الاستيراد: %s%s" % (why, ("\n   " + detail) if detail else ""))


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def known_quran_items():
    """النصوص القرآنية المعروفة في البرنامج — مصدر الحقيقة للمطابقة."""
    nr = json.load(open(os.path.join(ROOT, "content/needs-review.json"), encoding="utf-8"))
    out = {}
    for it in nr["items"]:
        if it["kind"] == "card:quran":
            out["%s/%s" % (it["lessonId"], it["path"].rsplit("/", 1)[-1])] = it
    return out, nr


# ------------------------------------------------------------- ١) سلامة الملفّ
def read_decisions(path):
    """يتحقّق من الترميز والبنية، ثم يعيد [(المعرّف، القرار، الملاحظة، الوقت)]."""
    if not os.path.exists(path):
        raise Reject("الملفّ غير موجود", path)
    raw = open(path, "rb").read()
    if not raw.strip():
        raise Reject("الملفّ فارغ")
    if b"\x00" in raw:
        raise Reject("الملفّ ثنائيّ لا نصّيّ (فيه بايت صفر)")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise Reject("الترميز ليس UTF-8", str(e))

    ext = os.path.splitext(path)[1].lower()
    if ext == ".json" or text.lstrip().startswith("{"):
        return _read_json(text)
    return _read_csv(text)


def _pick(row, names):
    for n in names:
        if n in row and row[n] not in (None, ""):
            return row[n]
    return ""


def _read_json(text):
    try:
        d = json.loads(text)
    except json.JSONDecodeError as e:
        raise Reject("ملفّ JSON غير سليم البنية", str(e))
    items = d.get("decisions") if isinstance(d, dict) else d
    if not isinstance(items, list):
        raise Reject("بنية JSON غير متوقَّعة: لا توجد قائمة «decisions»")
    out = []
    for i, r in enumerate(items, 1):
        if not isinstance(r, dict):
            raise Reject("عنصر رقم %d ليس كائنًا" % i)
        out.append((str(_pick(r, ID_COL)).strip(), str(_pick(r, DEC_COL)).strip(),
                    str(_pick(r, NOTE_COL)).strip(), str(_pick(r, AT_COL)).strip()))
    return out, "JSON"


def _read_csv(text):
    try:
        rows = list(csv.DictReader(io.StringIO(text)))
    except csv.Error as e:
        raise Reject("ملفّ CSV غير سليم البنية", str(e))
    if not rows:
        raise Reject("ملفّ CSV بلا صفوف بيانات")
    head = set(rows[0].keys())
    if not (head & set(ID_COL)):
        raise Reject("عمود المعرّف مفقود", "الأعمدة الموجودة: " + " · ".join(sorted(head)))
    if not (head & set(DEC_COL)):
        raise Reject("عمود قرار المقابلة مفقود", "الأعمدة الموجودة: " + " · ".join(sorted(head)))
    out = []
    for i, r in enumerate(rows, 2):
        if None in r or any(v is None for v in r.values()):
            raise Reject("صفّ غير مكتمل الأعمدة في السطر %d" % i)
        out.append((str(_pick(r, ID_COL)).strip(), str(_pick(r, DEC_COL)).strip(),
                    str(_pick(r, NOTE_COL)).strip(), str(_pick(r, AT_COL)).strip()))
    return out, "CSV"


# --------------------------------------------- ٢ · ٣ · ٤) المعرّفات والقرارات
def validate(decisions, known):
    ids = [d[0] for d in decisions]
    if not ids or any(not i for i in ids):
        raise Reject("سطرٌ بلا معرّف")

    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        raise Reject("معرّفات مكرّرة: %d" % len(dupes), " · ".join(dupes))

    got, want = set(ids), set(known)
    missing, extra = sorted(want - got), sorted(got - want)
    if missing:
        raise Reject("معرّفات مفقودة: %d" % len(missing), " · ".join(missing))
    if extra:
        raise Reject("معرّفات زائدة لا تقابل نصًّا قرآنيًّا معروفًا: %d" % len(extra),
                     " · ".join(extra))
    if len(got) != 24:
        raise Reject("عدد المعرّفات الفريدة %d لا ٢٤" % len(got))

    bad = [(i, dec) for i, dec, _n, _a in decisions
           if dec != DECISION_OK and dec not in DECISION_ALT]
    if bad:
        raise Reject("قرارات ليست «مطابق»: %d" % len(bad),
                     " · ".join("%s → «%s»" % (i, d or "بلا قرار") for i, d in bad))

    noted = [i for i, _d, n, _a in decisions if n]
    if noted:
        raise Reject("ملاحظات مسجَّلة على: %d" % len(noted),
                     " · ".join(noted) + "\n   الاعتماد لا يمرّ مع وجود ملاحظة.")
    return True


# -------------------------------------------------------------------- التنفيذ
def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if len(args) != 1:
        print(__doc__)
        return 2
    src = os.path.abspath(args[0])

    known, nr = known_quran_items()
    decisions, fmt = read_decisions(src)
    print("١) سلامة الملفّ: %s · UTF-8 · %d صفًّا" % (fmt, len(decisions)))

    validate(decisions, known)
    print("٢) معرّفات فريدة: ٢٤ ✔")
    print("٣) مطابقة قائمة النصوص القرآنية المعروفة: ٢٤ من ٢٤ ✔")
    print("٤) كل القرارات «مطابق»، ولا ملاحظة ولا «تعذّر التحقّق» ✔")

    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    digest = sha256(src)

    # ٥) تسجيل القرار وتاريخه، ولقطةٌ من النصّ تُمنع بعدها أيّ تغيير صامت.
    items = {}
    for i, dec, note, at in sorted(decisions):
        it = known[i]
        items[i] = {
            "path": it["path"], "kind": it["kind"],
            "lessonId": it["lessonId"], "ref": it["ref"], "page": it["page"],
            "decision": DECISION_OK,
            "decidedAt": at or now,
            "note": note,
            # لقطة تُقارَن في كل بناء: لا يتغيّر نصّ ولا معرّف ولا صفحة بعد الاعتماد.
            "textSha256": hashlib.sha256(it["text"].encode("utf-8")).hexdigest(),
            "textLength": len(it["text"]),
        }

    record = {
        "generatedFrom": "scripts/import_visual_check.py",
        "policy": "اعتمادٌ محدود بالنصوص القرآنية الأربعة والعشرين وحدها. "
                  "لا يُعتمد مقطعٌ ولا صياغة تعليمية لمجرّد احتوائه نصًّا قرآنيًّا.",
        "approvedAt": now,
        "approvedBy": "مراجعة بصرية بشرية مقابل صفحات الكتاب",
        "decisionsFile": {
            "name": os.path.basename(src),
            "format": fmt,
            "sha256": digest,
            "bytes": os.path.getsize(src),
        },
        "count": len(items),
        "ids": sorted(items),
        "items": items,
    }

    if dry:
        print("\n(تجربة جافّة — لم يُكتب شيء)")
        print("   بصمة ملفّ القرارات: %s" % digest)
        return 0

    os.makedirs(DEC_DIR, exist_ok=True)
    kept = os.path.join(DEC_DIR, "%s-%s%s" % (
        now[:10], digest[:12], os.path.splitext(src)[1] or ".csv"))
    shutil.copy2(src, kept)
    json.dump(record, open(APPROVALS, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    print("٥) سُجّل القرار ووقته لكل عنصر ✔")
    print("١٠) حُفظ ملفّ القرارات: %s" % os.path.relpath(kept, ROOT))
    print("    SHA-256: %s" % digest)
    print("→ %s — شغّل الآن: python3 scripts/build_content.py"
          % os.path.relpath(APPROVALS, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
