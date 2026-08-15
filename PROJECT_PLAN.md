# English 450 — خطة المشروع (PROJECT_PLAN)

تطبيق ويب مجاني وسهل للناطقين بالعربية لإتقان **350 كلمة** و**100 جملة** إنجليزية عملية،
عبر تجربة تفاعلية قائمة على التعلم النشط والمراجعة المتباعدة.

> ملاحظة: النسخة الأولى (MVP) تبدأ بمحتوى عالي الجودة (~40 كلمة + ~12 جملة)
> مع بنية بيانات مصممة من البداية لاستيعاب 350/100 كاملة دون تغيير في الكود.

---

## 1) المعمارية

- **التقنية:** Vanilla JavaScript (وحدات ES الأصلية) + HTML + CSS. **بلا خطوة بناء
  وبلا أي اعتماديات (zero-dependency, no-build).**
- **بدون Backend، بدون API مدفوعة، بدون مفاتيح.** 100% client-side.
- **التنقل:** موجّه بسيط قائم على الحالة (view state)، 3 شاشات فقط.
- **الحالة:** مخزن `store.js` بنمط observable (subscribe/emit) + `useReducer`-like actions،
  مع طبقة تخزين (storage) قابلة للاستبدال لاحقًا بمزامنة سحابية.
- **طبقة العرض:** مساعد `h()` صغير لإنشاء عناصر DOM (بديل خفيف عن أطر الواجهة).
- **الأنماط:** ملف `styles.css` واحد بمتغيرات تصميم (design tokens)، دعم RTL للعربية
  وLTR للإنجليزية، Mobile-First، ووضع داكن تلقائي.

### قرار مهم: لماذا Vanilla بدل React/Next.js؟

كانت الخطة الأولى React + Vite + TypeScript. لكن بيئة التطوير هنا **تمنع الوصول إلى
سجلّ npm** (سياسة إغلاق الشبكة — 403 على `registry.npmjs.org`، وتعذّر الوصول إلى CDNs
مثل esm.sh/unpkg)، فتعذّر تثبيت React أو أي حزمة أو إنتاج build قابل للاختبار.

بدل تسليم مشروع لا يعمل ولا يمكن التحقق منه، اتُّخذ القرار الهندسي بالتحوّل إلى تطبيق
**vanilla بلا اعتماديات ولا خطوة بناء**. هذا القرار:

- **يعمل ويُختبر فعليًا** في هذه البيئة (تم التحقق عبر متصفح Chromium حقيقي).
- **يقوّي** أهداف المشروع: أسرع، أخف، وأسهل نشرًا مجانًا (ارفع الملفات كما هي).
- **يحافظ على نفس المعمارية والمنطق** المصمَّمين أصلًا؛ فقط طبقة المكوّنات صارت
  vanilla DOM بدل React. ملفات المنطق (`lib/*`) خالية من الواجهة وقابلة للاختبار
  مباشرة بـ Node.
- **قابل للترقية لاحقًا** إلى إطار حديث إن لزم، لأن المنطق منفصل عن العرض.

طبقات قابلة للاستبدال مستقبلًا (Clean architecture):
- `lib/speech.ts` — طبقة الصوت (اليوم SpeechSynthesis، غدًا ملفات بشرية/TTS).
- `lib/storage.ts` — طبقة التخزين (اليوم localStorage، غدًا API + حساب مستخدم).
- `lib/srs.ts` — خوارزمية المراجعة (قابلة للتحسين دون لمس الواجهة).

---

## 2) الصفحات (Pages)

1. **الرئيسية (Home):** ترحيب + زر "ابدأ جلسة اليوم" + ملخص بصري للتقدم.
2. **الجلسة (Session):** تدفّق تعلم كامل (تعلّم → تمارين → مراجعة → نتيجة).
3. **التقدم (Progress):** لوحة تفصيلية للإحصاءات والإتقان والاستمرارية.

تنقّل سفلي (Bottom Nav) مناسب للجوال بين الثلاث شاشات.

---

## 3) المكونات (Components)

- عناصر أساسية: `Button`, `Card`, `ProgressRing`, `ProgressBar`, `StatCard`, `SpeakButton`, `BottomNav`, `Chip`.
- بطاقات التعلّم: `WordLearnCard`, `PhraseLearnCard`.
- التمارين (`components/exercises/`):
  - `MultipleChoiceMeaning` — اختر المعنى العربي الصحيح.
  - `MultipleChoiceEnglish` — اختر الكلمة الإنجليزية للمعنى العربي.
  - `ListenAndChoose` — استمع واختر ما سمعت.
  - `FillBlank` — أكمل الكلمة/الجملة الناقصة (بخيارات).
  - `WordOrder` — رتّب كلمات الجملة.
  - `MatchPairs` — طابق الكلمة مع معناها.
  - `SituationChoice` — موقف بسيط واختر العبارة المناسبة.
- تغذية راجعة فورية: `Feedback` (صحيح / حاول مرة أخرى + توضيح مختصر).
- نتيجة الجلسة: `SessionSummary`.

---

## 4) نموذج البيانات (Data Model)

```ts
type Word = {
  id: string; english: string; arabic: string;
  partOfSpeech: string;
  exampleEnglish: string; exampleArabic: string;
  category: string; difficulty: 1|2|3;
  order: number;              // ترتيب التقديم
  // النطق: يُشتق من english/example عبر طبقة الصوت (لا نخزّن audioUrl الآن،
  // لكن الحقل مدعوم مستقبلًا: audioUrl?: string)
};

type Phrase = {
  id: string; english: string; arabic: string;
  context: string;            // متى تُستخدم
  category: string; difficulty: 1|2|3;
  order: number; audioUrl?: string;
};

// حالة المراجعة لكل عنصر (كلمة أو جملة) — تُحفظ في localStorage
type ItemProgress = {
  id: string; kind: 'word'|'phrase';
  status: 'new'|'learning'|'review'|'mastered';
  reps: number; lapses: number; correctStreak: number;
  ease: number; intervalDays: number;
  dueAt: number;              // timestamp للمراجعة القادمة
  seenAt: number; masteredAt?: number;
};

type UserProgress = {
  items: Record<string, ItemProgress>;
  points: number; streak: number; lastSessionDate: string|null;
  sessionsCompleted: number; achievements: string[];
};
```

---

## 5) آلية التعلّم (Learning Engine)

مبادئ مطبّقة بشكل غير مرئي للمستخدم:
- **Active Recall / Retrieval:** كل عنصر يمرّ عبر تمرين استرجاع بعد تقديمه.
- **Spaced Repetition:** خوارزمية مبسّطة (Leitner/SM-2 lite) في `lib/srs.ts`.
- **Interleaving:** تنويع أنواع التمارين داخل الجلسة.
- **Microlearning:** جلسة 5–10 دقائق، عدد صغير من العناصر الجديدة.
- **Immediate Feedback + Mastery:** تصحيح فوري، والعنصر لا يُعتبر متقنًا إلا بتكرار نجاح.

**خوارزمية المراجعة (مبسّطة):**
- إجابة صحيحة: `reps++`، يزداد `intervalDays` عبر `ease`، ويتحدّث `status`
  (new→learning→review→mastered عند تجاوز عتبة `reps`/`interval`).
- إجابة خاطئة: `lapses++`، `correctStreak=0`، يعود إلى `learning` مع `interval` صغير
  (مراجعة قريبة). فترات تقريبية: 10د، 1ي، 3ي، 7ي، 16ي، 35ي.

**بناء الجلسة (`lib/session.ts`):**
1. عناصر مستحقة المراجعة اليوم (`dueAt <= now`) — أولوية.
2. عناصر جديدة (حصة محددة: كلمات + جمل).
3. تمرين لكل عنصر بنوع مناسب + تنويع (interleaving).
4. تحدٍّ ختامي قصير على عناصر الجلسة.

---

## 6) مراحل التنفيذ

- **المرحلة 1 (هذا الـMVP):** البنية الكاملة + الشاشات الثلاث + تدفق جلسة كامل +
  7 أنواع تمارين + الصوت + SRS + حفظ محلي + محتوى تجريبي كافٍ. ✅
- **المرحلة 2:** توسيع المحتوى إلى 350 كلمة + 100 جملة كاملة عبر خط توليد آلي
  (`content-src/` + `scripts/generate-content.mjs`) يضمن عدم التكرار والترتيب التدريجي. ✅
- **المرحلة 3:** حسابات ومزامنة سحابية اختيارية، ملفات صوت بشرية، مزيد من أنواع التمارين،
  اختبارات آلية، PWA (عمل دون اتصال).

---

## 7) قرارات مدوّنة

- **Vanilla بلا اعتماديات ولا build بدل React/Next.js:** فرضته سياسة إغلاق الشبكة (منع
  سجلّ npm)، وتبيّن أنه الأنسب فعلًا (أخف، أسرع، أسهل نشرًا، وقابل للاختبار هنا). التفاصيل
  في القسم 1.
- **Web Speech API للنطق:** مجاني، بلا مفاتيح، بلا تكلفة؛ مع طبقة عازلة للاستبدال لاحقًا.
- **localStorage للتقدم:** كافٍ وموثوق للنسخة الأولى؛ الطبقة مجرّدة للترقية إلى IndexedDB/سحابة.
- **موجّه بالحالة:** تقليل التعقيد لثلاث شاشات فقط.
- **CSS بمتغيرات تصميم بدل إطار UI ضخم:** تحكم كامل، حزمة أصغر، أداء أعلى.

> ملاحظة: نموذج البيانات في القسم 4 مكتوب بصيغة TypeScript لأغراض التوثيق فقط؛ التنفيذ
> الفعلي بـ JavaScript عادي (بلا خطوة ترجمة) وبنفس الحقول تمامًا.
