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
