# خط الأساس التقني المرشّح

> **ليس إصدارًا رسميًّا، ولا علامة نشر، ولا اعتمادًا للمحتوى.** لقطة موثّقة للحالة المعروضة للمراجعة، يمكن التحقّق منها لاحقًا بالأمر:
> `python3 scripts/make_baseline.py --verify`

## ١) الالتزام

| البند | القيمة |
|---|---|
| معرّف الالتزام كاملًا | `6f6868291cb5a6713a4483e2e6b0e6394df442eb` |
| مختصرًا | `6f68682` |
| الفرع | `claude/bard-al-yaqeen-program-jckzr0` |
| تاريخه | `2026-09-13T18:08:24+00:00` |
| شجرة العمل | نظيفة |

> لا يوجد tag ولا release ولا طلب دمج. الفرع لم يُدمج ولم يُنقل.

## ٢) بصمات الملفات الرئيسة (SHA-256)

| الملف | البصمة |
|---|---|
| `content/manifest.json` | `5849b631cf86b1d930c7b70919b2ad61443180c7a227d12746f718a62eec2694` |
| `content/needs-review.json` | `5598df8255a61b0c9a195b7fed198c892d827d50313459813a00ac2893047d68` |
| `content/units/u1.json` | `fa617ee389552fc750dbddd364ea6a7b90755d43760270077cfa4b80e89924ee` |
| `content/units/u2.json` | `eadcd3eafdd3280b7ba72ea61b1ba1c11ebfca515026bb9ff4c923e7eb092456` |
| `content/units/u3.json` | `690de68b787387798bd142c6d10533df3aee4a60ee194d368d4e0358dd093ed7` |
| `content/units/u4.json` | `0be74d7ecc058887200d141fbe19d8af0f74fe6cd4f6d687a49f9d52886c3b83` |
| `content/units/u5.json` | `c3b00a379dfb70357ef8f856be34ebad74f0bf4e309cd371e89030a094702913` |
| `content/units/u6.json` | `a71616ee600b007e0f297b7c114b54b31f607cdfb44fd8cf3a30e7245ca6e8e6` |
| `content/units/u7.json` | `9fb480b3262849bcb88132201fc1e697d07d7a3cea22a4e3d31c125231d4183f` |
| `js/lib/speech.js` | `a0a293d2d319c75935b12f5e4d1743aa5983c0c78d50bfeef613193588e5af13` |
| `js/lib/quiz.js` | `3854054c68fb94da6166c2df320ec90e7db04ce4a9b9de0849527962c9e6b444` |
| `js/lib/content.js` | `8089016666a904f4eaefbb4718bd5273fcfb190c5ce7a8d3de89c5a8c0b1ed02` |
| `js/lib/storage.js` | `8609f984b8ac34c2a77468421f42d38f9a1ef784e080f381883b631532b18ccc` |
| `js/ui/widgets.js` | `c687144f59959fb4d0bb73774d8197ffe46e5ef3780e2f485e29da62bff801fc` |
| `js/ui/lesson.js` | `06ace1f90adc57b6e0bc5a4706236677ba4a50ee350b288bbcaf8f19b8be7bd5` |
| `css/tokens.css` | `ce47b4215ed3fe6028ea42ad26549975ad79a8e330ad4cb9cae76e93bfca2251` |
| `css/app.css` | `424f1ab913c428a193db16bd2f3b308ec10b18e7145e55b6e0fc441956d4b57d` |
| `scripts/build_content.py` | `f656d3d7be047286202630a00e30aa7c2f03428c41b5e673d3e326ff5e172700` |
| `scripts/audit_quran.py` | `15203466d46b7c33c94aa98fcec3737261c0fea0a5aa6f92217d3c341dc04e17` |
| `scripts/review_quran_texts.py` | `0a5bafb62d10eb96a83c4f8c097a6da52e4e664eac139fdf86a0b841e1963cf5` |
| `tests/run.mjs` | `a3f36a03e2a4f86495a3145dbb895672975c8aa05afe6b4f3685492621929f5c` |
| `tests/e2e.mjs` | `beb5bb064e50c8b376fa987bd7fe0cd0d751e9ac7a6fa8e80f31d51a620ba043` |
| `tests/visual-audit.mjs` | `ece5f90ca8949c0aa228fb7809958eca67f2808064d2a3a7388de00059858c6b` |

## ٣) أعداد المحتوى

| البند | العدد |
|---|---:|
| الوحدات | ٧ |
| الدروس | ٦٦ |
| بطاقات المحتوى | ١٩٢ |
| تفاعلات أثناء الدروس | ١٦٧ |
| أسئلة الاختبارات | ١٤٨ |
| المهام الأدائية | ٣٥ |
| بطاقات النصّ القرآني | ٢٤ |
| عناصر تحتاج مراجعة | ٣٠٤ |
| منها معتمَدة | ٠ |
| أولوية عالية | ٢٤ |
| أولوية متوسطة | ١٣٦ |
| أولوية منخفضة | ١٤٤ |

> **عناصر المراجعة: ٣٠٤، المعتمَد منها: ٠.** لم تُغيَّر حالة أيّ عنصر.

## ٤) نتائج الاختبارات

| الطبقة | الأمر | النتيجة |
|---|---|---|
| اختبارات المنطق | `node tests/run.mjs` | ٦١ ناجحًا · ٠ فاشلًا |
| اختبارات الواجهة | `node tests/e2e.mjs` | ٦٤ ناجحًا · ٠ فاشلًا |
| الفحص البصري | `node tests/visual-audit.mjs` | ٧٠٢ فحصًا · ٠ خطأ · ٠ تنبيه |
| تدقيق سلامة النصّ القرآني | `python3 scripts/audit_quran.py --check` | ٢١٧١ فحصًا · ٠ مخالفة |
| مراجعة النصوص القرآنية الـ٢٤ | `python3 scripts/review_quran_texts.py` | ٠ اختلاف في الحروف · ٠ تعارض بين المواضع |

## ٥) ما لم يُفعل

| | |
|---|---|
| إصدار رسمي أو علامة نشر (tag/release) | **لم يحدث** |
| طلب دمج (PR) | **لم يحدث** |
| دمج الفرع أو نقله إلى مستودع آخر | **لم يحدث** |
| نشر عامّ | **لم يحدث** |
| ربط سحابي أو ربط بـSupabase | **لم يحدث** |
| اعتماد أيّ عنصر من عناصر المراجعة | **لم يحدث** |
| تعديل أيّ نصّ قرآني | **لم يحدث** |
