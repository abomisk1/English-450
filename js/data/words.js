// محتوى الكلمات — النسخة الأولى (MVP) تبدأ بمجموعة عالية الجودة.
// البنية مصمّمة لاستيعاب 350 كلمة كاملة لاحقًا بإضافة عناصر فقط (لا تغيير في الكود).
// كل كلمة: { id, english, arabic, partOfSpeech, exampleEnglish, exampleArabic,
//            category, difficulty (1..3), order, audioUrl? }

export const WORDS = [
  // ——— المحادثة والتحية ———
  { id: 'w-hello', english: 'hello', arabic: 'مرحبًا', partOfSpeech: 'تعبير', exampleEnglish: 'Hello, how are you?', exampleArabic: 'مرحبًا، كيف حالك؟', category: 'المحادثة', difficulty: 1, order: 1 },
  { id: 'w-please', english: 'please', arabic: 'من فضلك', partOfSpeech: 'ظرف', exampleEnglish: 'Please sit down.', exampleArabic: 'من فضلك اجلس.', category: 'المحادثة', difficulty: 1, order: 2 },
  { id: 'w-thanks', english: 'thank you', arabic: 'شكرًا لك', partOfSpeech: 'تعبير', exampleEnglish: 'Thank you very much.', exampleArabic: 'شكرًا جزيلًا لك.', category: 'المحادثة', difficulty: 1, order: 3 },
  { id: 'w-yes', english: 'yes', arabic: 'نعم', partOfSpeech: 'ظرف', exampleEnglish: 'Yes, I agree.', exampleArabic: 'نعم، أوافق.', category: 'المحادثة', difficulty: 1, order: 4 },
  { id: 'w-no', english: 'no', arabic: 'لا', partOfSpeech: 'ظرف', exampleEnglish: 'No, thank you.', exampleArabic: 'لا، شكرًا.', category: 'المحادثة', difficulty: 1, order: 5 },
  { id: 'w-sorry', english: 'sorry', arabic: 'آسف', partOfSpeech: 'صفة', exampleEnglish: 'I am sorry for being late.', exampleArabic: 'أنا آسف على التأخير.', category: 'المحادثة', difficulty: 1, order: 6 },

  // ——— الأشخاص والعائلة ———
  { id: 'w-family', english: 'family', arabic: 'عائلة', partOfSpeech: 'اسم', exampleEnglish: 'I love my family.', exampleArabic: 'أحب عائلتي.', category: 'الأشخاص والعائلة', difficulty: 1, order: 7 },
  { id: 'w-friend', english: 'friend', arabic: 'صديق', partOfSpeech: 'اسم', exampleEnglish: 'She is my best friend.', exampleArabic: 'هي أعز صديقاتي.', category: 'الأشخاص والعائلة', difficulty: 1, order: 8 },
  { id: 'w-mother', english: 'mother', arabic: 'أم', partOfSpeech: 'اسم', exampleEnglish: 'My mother is a teacher.', exampleArabic: 'أمي معلمة.', category: 'الأشخاص والعائلة', difficulty: 1, order: 9 },
  { id: 'w-father', english: 'father', arabic: 'أب', partOfSpeech: 'اسم', exampleEnglish: 'His father works here.', exampleArabic: 'أبوه يعمل هنا.', category: 'الأشخاص والعائلة', difficulty: 1, order: 10 },
  { id: 'w-child', english: 'child', arabic: 'طفل', partOfSpeech: 'اسم', exampleEnglish: 'The child is playing.', exampleArabic: 'الطفل يلعب.', category: 'الأشخاص والعائلة', difficulty: 1, order: 11 },
  { id: 'w-people', english: 'people', arabic: 'أشخاص / ناس', partOfSpeech: 'اسم', exampleEnglish: 'Many people are here.', exampleArabic: 'كثير من الناس هنا.', category: 'الأشخاص والعائلة', difficulty: 2, order: 12 },

  // ——— المنزل ———
  { id: 'w-house', english: 'house', arabic: 'منزل', partOfSpeech: 'اسم', exampleEnglish: 'This is my house.', exampleArabic: 'هذا منزلي.', category: 'المنزل', difficulty: 1, order: 13 },
  { id: 'w-room', english: 'room', arabic: 'غرفة', partOfSpeech: 'اسم', exampleEnglish: 'The room is clean.', exampleArabic: 'الغرفة نظيفة.', category: 'المنزل', difficulty: 1, order: 14 },
  { id: 'w-door', english: 'door', arabic: 'باب', partOfSpeech: 'اسم', exampleEnglish: 'Please close the door.', exampleArabic: 'من فضلك أغلق الباب.', category: 'المنزل', difficulty: 1, order: 15 },
  { id: 'w-water', english: 'water', arabic: 'ماء', partOfSpeech: 'اسم', exampleEnglish: 'I drink water every day.', exampleArabic: 'أشرب الماء كل يوم.', category: 'المنزل', difficulty: 1, order: 16 },

  // ——— الطعام والشراب ———
  { id: 'w-food', english: 'food', arabic: 'طعام', partOfSpeech: 'اسم', exampleEnglish: 'The food is delicious.', exampleArabic: 'الطعام لذيذ.', category: 'الطعام والشراب', difficulty: 1, order: 17 },
  { id: 'w-eat', english: 'eat', arabic: 'يأكل', partOfSpeech: 'فعل', exampleEnglish: 'We eat lunch at noon.', exampleArabic: 'نأكل الغداء عند الظهر.', category: 'الطعام والشراب', difficulty: 1, order: 18 },
  { id: 'w-drink', english: 'drink', arabic: 'يشرب', partOfSpeech: 'فعل', exampleEnglish: 'I want to drink coffee.', exampleArabic: 'أريد أن أشرب قهوة.', category: 'الطعام والشراب', difficulty: 1, order: 19 },
  { id: 'w-bread', english: 'bread', arabic: 'خبز', partOfSpeech: 'اسم', exampleEnglish: 'I buy fresh bread.', exampleArabic: 'أشتري خبزًا طازجًا.', category: 'الطعام والشراب', difficulty: 2, order: 20 },

  // ——— الوقت والأيام ———
  { id: 'w-day', english: 'day', arabic: 'يوم', partOfSpeech: 'اسم', exampleEnglish: 'Have a nice day.', exampleArabic: 'أتمنى لك يومًا سعيدًا.', category: 'الوقت والأيام', difficulty: 1, order: 21 },
  { id: 'w-today', english: 'today', arabic: 'اليوم', partOfSpeech: 'ظرف', exampleEnglish: 'Today is Monday.', exampleArabic: 'اليوم هو الاثنين.', category: 'الوقت والأيام', difficulty: 1, order: 22 },
  { id: 'w-time', english: 'time', arabic: 'وقت', partOfSpeech: 'اسم', exampleEnglish: 'What time is it?', exampleArabic: 'كم الساعة؟', category: 'الوقت والأيام', difficulty: 1, order: 23 },
  { id: 'w-now', english: 'now', arabic: 'الآن', partOfSpeech: 'ظرف', exampleEnglish: 'I am busy now.', exampleArabic: 'أنا مشغول الآن.', category: 'الوقت والأيام', difficulty: 1, order: 24 },

  // ——— الأماكن ———
  { id: 'w-here', english: 'here', arabic: 'هنا', partOfSpeech: 'ظرف', exampleEnglish: 'Come here, please.', exampleArabic: 'تعال هنا، من فضلك.', category: 'الأماكن', difficulty: 1, order: 25 },
  { id: 'w-city', english: 'city', arabic: 'مدينة', partOfSpeech: 'اسم', exampleEnglish: 'I live in a big city.', exampleArabic: 'أعيش في مدينة كبيرة.', category: 'الأماكن', difficulty: 2, order: 26 },
  { id: 'w-street', english: 'street', arabic: 'شارع', partOfSpeech: 'اسم', exampleEnglish: 'The street is busy.', exampleArabic: 'الشارع مزدحم.', category: 'الأماكن', difficulty: 2, order: 27 },

  // ——— العمل والدراسة ———
  { id: 'w-work', english: 'work', arabic: 'عمل / يعمل', partOfSpeech: 'اسم/فعل', exampleEnglish: 'I go to work early.', exampleArabic: 'أذهب إلى العمل مبكرًا.', category: 'العمل', difficulty: 1, order: 28 },
  { id: 'w-money', english: 'money', arabic: 'مال', partOfSpeech: 'اسم', exampleEnglish: 'I need some money.', exampleArabic: 'أحتاج بعض المال.', category: 'العمل', difficulty: 2, order: 29 },
  { id: 'w-learn', english: 'learn', arabic: 'يتعلّم', partOfSpeech: 'فعل', exampleEnglish: 'I want to learn English.', exampleArabic: 'أريد أن أتعلم الإنجليزية.', category: 'الدراسة', difficulty: 1, order: 30 },
  { id: 'w-book', english: 'book', arabic: 'كتاب', partOfSpeech: 'اسم', exampleEnglish: 'I read a good book.', exampleArabic: 'أقرأ كتابًا جيدًا.', category: 'الدراسة', difficulty: 1, order: 31 },

  // ——— السفر والتسوق ———
  { id: 'w-go', english: 'go', arabic: 'يذهب', partOfSpeech: 'فعل', exampleEnglish: 'I go to the airport.', exampleArabic: 'أذهب إلى المطار.', category: 'السفر', difficulty: 1, order: 32 },
  { id: 'w-car', english: 'car', arabic: 'سيارة', partOfSpeech: 'اسم', exampleEnglish: 'My car is new.', exampleArabic: 'سيارتي جديدة.', category: 'السفر', difficulty: 1, order: 33 },
  { id: 'w-buy', english: 'buy', arabic: 'يشتري', partOfSpeech: 'فعل', exampleEnglish: 'I want to buy this.', exampleArabic: 'أريد أن أشتري هذا.', category: 'التسوق', difficulty: 1, order: 34 },
  { id: 'w-price', english: 'price', arabic: 'سعر', partOfSpeech: 'اسم', exampleEnglish: 'What is the price?', exampleArabic: 'ما هو السعر؟', category: 'التسوق', difficulty: 2, order: 35 },

  // ——— الصحة والمشاعر ———
  { id: 'w-help', english: 'help', arabic: 'مساعدة / يساعد', partOfSpeech: 'اسم/فعل', exampleEnglish: 'Can you help me?', exampleArabic: 'هل يمكنك مساعدتي؟', category: 'الصحة العامة', difficulty: 1, order: 36 },
  { id: 'w-doctor', english: 'doctor', arabic: 'طبيب', partOfSpeech: 'اسم', exampleEnglish: 'I need a doctor.', exampleArabic: 'أحتاج إلى طبيب.', category: 'الصحة العامة', difficulty: 2, order: 37 },
  { id: 'w-happy', english: 'happy', arabic: 'سعيد', partOfSpeech: 'صفة', exampleEnglish: 'I am very happy.', exampleArabic: 'أنا سعيد جدًا.', category: 'المشاعر', difficulty: 1, order: 38 },
  { id: 'w-tired', english: 'tired', arabic: 'متعب', partOfSpeech: 'صفة', exampleEnglish: 'I feel tired today.', exampleArabic: 'أشعر بالتعب اليوم.', category: 'المشاعر', difficulty: 2, order: 39 },

  // ——— الأفعال والصفات الأساسية ———
  { id: 'w-want', english: 'want', arabic: 'يريد', partOfSpeech: 'فعل', exampleEnglish: 'I want to sleep.', exampleArabic: 'أريد أن أنام.', category: 'الأفعال الأساسية', difficulty: 1, order: 40 },
  { id: 'w-have', english: 'have', arabic: 'يملك / لديه', partOfSpeech: 'فعل', exampleEnglish: 'I have a question.', exampleArabic: 'لديّ سؤال.', category: 'الأفعال الأساسية', difficulty: 1, order: 41 },
  { id: 'w-make', english: 'make', arabic: 'يصنع / يجعل', partOfSpeech: 'فعل', exampleEnglish: 'I make tea in the morning.', exampleArabic: 'أصنع الشاي في الصباح.', category: 'الأفعال الأساسية', difficulty: 2, order: 42 },
  { id: 'w-big', english: 'big', arabic: 'كبير', partOfSpeech: 'صفة', exampleEnglish: 'This is a big house.', exampleArabic: 'هذا منزل كبير.', category: 'الصفات الأساسية', difficulty: 1, order: 43 },
  { id: 'w-small', english: 'small', arabic: 'صغير', partOfSpeech: 'صفة', exampleEnglish: 'I have a small bag.', exampleArabic: 'لديّ حقيبة صغيرة.', category: 'الصفات الأساسية', difficulty: 1, order: 44 },
  { id: 'w-good', english: 'good', arabic: 'جيد', partOfSpeech: 'صفة', exampleEnglish: 'This is a good idea.', exampleArabic: 'هذه فكرة جيدة.', category: 'الصفات الأساسية', difficulty: 1, order: 45 },
  { id: 'w-new', english: 'new', arabic: 'جديد', partOfSpeech: 'صفة', exampleEnglish: 'I bought a new phone.', exampleArabic: 'اشتريت هاتفًا جديدًا.', category: 'الصفات الأساسية', difficulty: 1, order: 46 },
];
