// منطق تخزين أسئلة مراجعة الجلسة — نقيّ وقابل للاختبار.
//
// المبدأ: عند الخطأ نخزّن *نسخة مستقلّة ثابتة من نفس السؤال* (لا مرجعًا قابلًا للتغيير،
// ولا عنصرًا يُعاد توليد سؤال جديد له)، فتُعاد في المراجعة كما هي بالضبط:
// نفس item.id ونفس type ونفس النص ونفس الخيارات والإجابة الصحيحة.
// ومنع تكرار السؤال نفسه بالاعتماد على هويّة مركّبة (item.id|type).

// نسخة مستقلّة عميقة من كائن التمرين (بلا دوال، فآمنة للنسخ).
export function cloneExercise(ex) {
  return typeof structuredClone === 'function' ? structuredClone(ex) : JSON.parse(JSON.stringify(ex));
}

// الهويّة المركّبة لسؤال (عنصر + نوع تمرين).
export function questionKey(ex) {
  return `${ex.item.id}|${ex.type}`;
}

// يضيف السؤال المُخطأ فيه إلى قائمة الأخطاء مرّة واحدة فقط لكل هويّة (item.id|type)،
// كنسخة مستقلّة ثابتة. يُعيد true إذا أُضيف فعلًا (لم يكن مكرّرًا).
export function addUniqueError(errors, keys, ex) {
  const key = questionKey(ex);
  if (keys.has(key)) return false;
  keys.add(key);
  errors.push(cloneExercise(ex));
  return true;
}
