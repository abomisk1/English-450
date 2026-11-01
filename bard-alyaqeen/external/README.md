# التجربة الخارجية المحدودة (Netlify)

مجلد مستقل يخدم نسخة التجربة (`../trial.html`) على رابط ويب عادي دون حساب Claude.

- `build.py`: يولّد `app/app.html` من نسخة التجربة (يضيف طبقة اتصال، ويزيل صور صفحات الملخص، ويضيف منع الفهرسة).
- `netlify/functions/gate.mjs`: يقدّم التطبيق بعد التحقق من رمز الدعوة (كوكي موقّعة). بلا دعوة لا يُرسل أي محتوى علمي.
- `netlify/functions/api.mjs`: حفظ بيانات المشارك. كل مشارك يكتب ويقرأ مساره فقط (مشتق بالتجزئة من معرّفه العشوائي). قراءة الكل بمفتاح المشرف فقط.
- `netlify/functions/admin.mjs`: لوحة المشرف `/admin` (صفحة بلا بيانات؛ تطلب المفتاح).
- التخزين: Netlify Blobs. المتغيرات السرية في إعدادات الموقع: `INVITE_CODE` (اختياري، إن تُرك فارغًا فالدخول مفتوح) و`ADMIN_KEY` (٢٤ حرفًا فأكثر، إلزامي).
- الاختبار المحلي: `NODE_PATH=$(npm root -g) node test/e2e.cjs` (يستعمل الدوال نفسها بتخزين ذاكرة).
- إعداد Netlify: Base directory = `bard-alyaqeen/external`، Publish directory = `public`، Branch = `claude/bard-alyaqeen-prototype` (لا دمج في main).
