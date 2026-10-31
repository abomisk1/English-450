# مراجعة المجموعة العشرية الأولى

- `question-bank.before-review.json`: نسخة الأسئلة قبل المراجعة (للمقارنة والتراجع).
- `../data/question-bank.json`: النسخة بعد المراجعة (حقل `review` لكل سؤال، و`reviewBlueprint` لأهداف المراجعة).
- `change-log.json`: كل تعديل بقيمتي قبل وبعد وسببه.
- `question-review.csv`: جدول مراجعة ٥٠ سؤالًا و٢٠ موضعًا في المراجعة.
- `quran_verified.json`, `hadith_verified.json`: نتائج مطابقة الآيات والأحاديث.
- `timing-estimate.json`: تقدير زمن الجلسات (حسابي، لا تجربة بشرية).
- `verify_quran.py`, `verify_hadith.py`, `hlib.py`: سكربتات التحقق. تحتاج تنزيل مجموعات البيانات المفتوحة إلى `/tmp/vv` (fawazahmed0/quran-api ara-quranuthmanienc، semarketir/quranjson، fawazahmed0/hadith-api ara-bukhari وara-muslim).
- `apply_edits.py`, `annotate.py`: تُعيد بناء النسخة المراجَعة من نسخة ما قبل المراجعة.
- `build_reports.py`, `assemble_report.py`: يولّدان الجدول والتقرير.

لا اعتماد علمي نهائي قبل موافقة المشرف العلمي المخول.

## المرحلة الثانية (بعد قرارات التحسين)
- `question-bank.before-restructure.json`: البنك قبل الدمج (٥٠ سؤالًا).
- `restructure.py`: يدمج ١٦ سؤالًا في ٨ ويُغلق مسائل العزو والنقل بالمعنى، ويكتب `change-log-restructure.json`.
- `apply_official_verses.py`: يعرض نص الآيات من بيانات مجمع الملك فهد (الحقل الإملائي)، ويحفظ التشكيل المفتوح المصدر في `tm`، ويكتب `change-log-verses.json`.
- `kfgqpc_letters_check.json`: مطابقة حروف الآيات برقم صفحة المصحف.
- `timing2.py` → `timing-comparison.json`: مقارنة الزمن قبل الدمج وبعده (تقدير حسابي).
- `build_report2.py`: يولّد `../review-report.html` و`question-review.csv`.
ترتيب إعادة البناء: `apply_edits.py` ثم `restructure.py` ثم `apply_official_verses.py`.
