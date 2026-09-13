/**
 * منطق الأسئلة والتغذية الراجعة.
 * خالٍ من الواجهة ليكون قابلًا للاختبار مباشرة.
 */

/** خلط مصفوفة خلطًا ثابتًا بحسب بذرة، ليبقى ترتيب الخيارات مستقرًّا داخل الجلسة. */
export function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * يجهّز سؤالًا للعرض: يخلط الخيارات ويحفظ موضع الإجابة الصحيحة.
 * لا يغيّر السؤال الأصلي.
 */
export function prepare(q, seed) {
  if (q.kind === 'mcq' || q.kind === 'truefalse' || q.kind === 'complete' || q.kind === 'scenario') {
    // «صحيح/خطأ» تبقى بترتيبها المعروف حتى لا تُربك المستخدم.
    if (q.kind === 'truefalse') {
      return { ...q, view: q.options.slice(), answerIndex: q.answer };
    }
    const pairs = q.options.map((text, i) => ({ text, i }));
    const shuffled = seededShuffle(pairs, `${seed}:${q.id}`);
    return {
      ...q,
      view: shuffled.map((p) => p.text),
      answerIndex: shuffled.findIndex((p) => p.i === q.answer),
    };
  }
  if (q.kind === 'order') {
    let view = seededShuffle(q.items, `${seed}:${q.id}`);
    if (q.items.length > 1 && view.every((v, i) => v === q.items[i])) {
      view = view.slice().reverse(); // تجنّب أن يبدأ مرتّبًا أصلًا
    }
    return { ...q, view };
  }
  if (q.kind === 'match') {
    return {
      ...q,
      terms: q.pairs.map((p) => p[0]),
      choices: seededShuffle(q.pairs.map((p) => p[1]), `${seed}:${q.id}`),
    };
  }
  if (q.kind === 'flashcards') {
    return { ...q, view: q.pairs };
  }
  return { ...q };
}

/** تقييم إجابة على سؤال مُجهَّز. يعيد { correct, detail }. */
export function check(prepared, answer) {
  switch (prepared.kind) {
    case 'mcq':
    case 'truefalse':
    case 'complete':
    case 'scenario':
      return { correct: answer === prepared.answerIndex };
    case 'order': {
      const ok = Array.isArray(answer)
        && answer.length === prepared.items.length
        && answer.every((v, i) => v === prepared.items[i]);
      const detail = Array.isArray(answer)
        ? answer.map((v, i) => v === prepared.items[i]) : [];
      return { correct: ok, detail };
    }
    case 'match': {
      const expected = Object.fromEntries(prepared.pairs);
      const detail = prepared.terms.map((t) => (answer || {})[t] === expected[t]);
      return { correct: detail.length > 0 && detail.every(Boolean), detail };
    }
    case 'flashcards':
      return { correct: true };
    default:
      return { correct: false };
  }
}

/** الأسئلة التي تُحتسب في الدرجة (بطاقات التذكّر ليست اختبارًا). */
export function gradable(list) {
  return (list || []).filter((q) => q.kind !== 'flashcards');
}

/** نتيجة مجموعة إجابات. */
export function score(results) {
  const total = results.length;
  const right = results.filter((r) => r.correct).length;
  return { right, total, percent: total ? Math.round((right / total) * 100) : 0 };
}

/** عتبة اجتياز الاختبار القصير. */
export const PASS_MARK = 80;

export function passed(percent) { return percent >= PASS_MARK; }

/** رسالة تشجيع رصينة بحسب النتيجة (بلا مبالغة ولا أسلوب طفولي). */
export function encouragement(percent) {
  if (percent === 100) return 'إتقان تام، بارك الله فيك.';
  if (percent >= PASS_MARK) return 'نتيجة طيّبة، وقد اجتزت الدرس.';
  if (percent >= 50) return 'قريب من الإتقان؛ راجع ما أخطأت فيه ثم أعد المحاولة.';
  return 'لا بأس؛ أعد قراءة بطاقات الدرس ثم جرّب مرة أخرى.';
}
