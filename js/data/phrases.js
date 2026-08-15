// محتوى الجمل والعبارات العملية — النسخة الأولى (MVP).
// البنية مصمّمة لاستيعاب 100 جملة كاملة لاحقًا بإضافة عناصر فقط.
// كل جملة: { id, english, arabic, context, category, difficulty, order, audioUrl? }

export const PHRASES = [
  { id: 'p-name', english: 'What is your name?', arabic: 'ما اسمك؟', context: 'عند التعارف مع شخص جديد.', category: 'التعارف', difficulty: 1, order: 1 },
  { id: 'p-myname', english: 'My name is Ahmed.', arabic: 'اسمي أحمد.', context: 'تعرّف عن نفسك.', category: 'التعارف', difficulty: 1, order: 2 },
  { id: 'p-nice', english: 'Nice to meet you.', arabic: 'سعيد بلقائك.', context: 'عند مقابلة شخص لأول مرة.', category: 'التعارف', difficulty: 1, order: 3 },
  { id: 'p-howareyou', english: 'How are you?', arabic: 'كيف حالك؟', context: 'تحية بعد السلام.', category: 'التحية', difficulty: 1, order: 4 },
  { id: 'p-fine', english: 'I am fine, thank you.', arabic: 'أنا بخير، شكرًا.', context: 'رد على سؤال كيف حالك.', category: 'التحية', difficulty: 1, order: 5 },
  { id: 'p-where', english: 'Where are you from?', arabic: 'من أين أنت؟', context: 'للسؤال عن بلد الشخص.', category: 'السؤال', difficulty: 1, order: 6 },
  { id: 'p-help', english: 'Can you help me?', arabic: 'هل يمكنك مساعدتي؟', context: 'عند الحاجة إلى مساعدة.', category: 'طلب المساعدة', difficulty: 1, order: 7 },
  { id: 'p-water', english: 'I would like some water, please.', arabic: 'أريد بعض الماء، من فضلك.', context: 'في المطعم أو المقهى.', category: 'المطعم', difficulty: 2, order: 8 },
  { id: 'p-bill', english: 'Can I have the bill, please?', arabic: 'هل يمكنني الحصول على الفاتورة من فضلك؟', context: 'لطلب الحساب في المطعم.', category: 'المطعم', difficulty: 2, order: 9 },
  { id: 'p-howmuch', english: 'How much is this?', arabic: 'كم سعر هذا؟', context: 'عند التسوق للسؤال عن السعر.', category: 'التسوق', difficulty: 1, order: 10 },
  { id: 'p-whereis', english: 'Where is the bathroom?', arabic: 'أين الحمام؟', context: 'للسؤال عن مكان.', category: 'الاتجاهات', difficulty: 1, order: 11 },
  { id: 'p-sorrylate', english: 'Sorry, I am late.', arabic: 'آسف، لقد تأخرت.', context: 'عند الاعتذار عن التأخير.', category: 'الاعتذار', difficulty: 1, order: 12 },
  { id: 'p-thankshelp', english: 'Thank you for your help.', arabic: 'شكرًا على مساعدتك.', context: 'لشكر شخص ساعدك.', category: 'الشكر', difficulty: 1, order: 13 },
  { id: 'p-repeat', english: 'Can you repeat that, please?', arabic: 'هل يمكنك إعادة ذلك من فضلك؟', context: 'عندما لا تسمع أو تفهم جيدًا.', category: 'المحادثات اليومية', difficulty: 2, order: 14 },
  { id: 'p-checkin', english: 'I have a reservation.', arabic: 'لديّ حجز.', context: 'عند الوصول إلى الفندق.', category: 'الفندق', difficulty: 2, order: 15 },
];
