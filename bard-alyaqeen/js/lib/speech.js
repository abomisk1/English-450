/**
 * طبقة الاستماع.
 *
 * ضابط شرعي مُلزَم في الشفرة: لا تُقرأ النصوص القرآنية بقراءة آلية أبدًا.
 * القرآن لا يُسمع إلا من تسجيل صوتي معتمد يُضاف لاحقًا في `audio` بالمحتوى،
 * وحتى يتوفّر ذلك يبقى زر الاستماع معطّلًا للآيات مع بيان السبب.
 */

/** أنواع البطاقات الممنوع فيها القراءة الآلية. */
const FORBIDDEN_TTS = new Set(['quran']);

export function isTTSAllowed(card) {
  return !FORBIDDEN_TTS.has(card && card.type);
}

export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let current = null;

/**
 * ينطق نصًّا تعليميًّا (شرحًا أو صياغة مساعدة). يرفض القرآن صراحةً.
 * @returns {boolean} هل بدأ النطق؟
 */
export function speak(text, card, opts = {}) {
  if (card && !isTTSAllowed(card)) return false;
  if (!ttsSupported() || !text) return false;
  stop();
  const u = new SpeechSynthesisUtterance(String(text));
  u.lang = 'ar-SA';
  u.rate = opts.rate ?? 0.92;
  u.pitch = opts.pitch ?? 1;
  const voices = window.speechSynthesis.getVoices() || [];
  const ar = voices.find((v) => /^ar/i.test(v.lang));
  if (ar) u.voice = ar;
  u.onend = () => { current = null; opts.onend && opts.onend(); };
  u.onerror = () => { current = null; opts.onend && opts.onend(); };
  current = u;
  window.speechSynthesis.speak(u);
  return true;
}

export function stop() {
  if (ttsSupported()) { try { window.speechSynthesis.cancel(); } catch (_) {} }
  current = null;
}

export function isSpeaking() {
  return ttsSupported() && window.speechSynthesis.speaking;
}

/**
 * مصدر الاستماع المتاح لبطاقة:
 *  - 'recording' تسجيل صوتي معتمد مرفق بالمحتوى.
 *  - 'tts'       قراءة آلية مسموح بها (شرح/صياغة تعليمية).
 *  - null        لا استماع (نصّ قرآني بلا تسجيل معتمد).
 */
export function audioSourceFor(card) {
  if (card && card.audio) return 'recording';
  if (isTTSAllowed(card) && ttsSupported()) return 'tts';
  return null;
}

export function unavailableReason(card) {
  if (card && card.type === 'quran') {
    return 'الاستماع للآيات يحتاج تسجيلًا صوتيًّا معتمدًا، ولا تُستخدم القراءة الآلية للقرآن.';
  }
  return 'الاستماع غير متاح في هذا المتصفح.';
}
