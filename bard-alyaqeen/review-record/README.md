# سجل المراجعة العلمية

- `build_record.py`: يبني `record.json` و`record.html` و`record.xlsx` من `../data/question-bank.json` (الأسئلة المُعدّة فعلًا فقط، لا يُنشئ أسئلة). `--decisions edited.xlsx` يدرج قرارات المشرف، و`--pages pages.json` يملأ أرقام الفهرس.
- `render.cjs`: `NODE_PATH=$(npm root -g) node render.cjs scientific-review-record-v1.0.pdf` (مرورين لأرقام الفهرس). وللقرارات: `DECISIONS=edited.xlsx` قبل الأمر.
- `test_record.py <pdf>`: يقارن PDF وxlsx بالبنك (الأسئلة والخيارات والنصوص والإجابة الحمراء والصفحات).
- `fonts/`: Amiri وIBM Plex Sans Arabic (ترخيص OFL).
- عند إعداد مجموعات جديدة تُضاف أسئلتها إلى البنك ثم يُعاد بناء السجل نفسه (يلزم توسيع PROGRAM/الأقسام في `build_record.py`).
- حالة «معتمد» لا تُسند إلا بقرار المشرف. صفحة الكتاب الأصلي «قيد التحقق» حتى تثبت.
