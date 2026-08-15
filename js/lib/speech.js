// طبقة النطق — اليوم Web Speech API (SpeechSynthesis) مجانًا وبلا مفاتيح.
// مصمّمة كواجهة بسيطة يمكن لاحقًا توصيلها بملفات صوت بشرية أو خدمة TTS أفضل
// (يكفي تعديل هذا الملف فقط).

let cachedVoice = null;

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickEnglishVoice() {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // نُفضّل صوتًا إنجليزيًا (US ثم أي en) لوضوح المبتدئ.
  return (
    voices.find((v) => /en[-_]US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null
  );
}

// أصوات المتصفح قد تُحمّل بشكل غير متزامن.
if (isSpeechSupported()) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = pickEnglishVoice();
  };
}

// نطق نص إنجليزي بسرعة مناسبة للمبتدئ.
export function speak(text, rate = 0.9) {
  if (!isSpeechSupported() || !text) return;
  try {
    window.speechSynthesis.cancel(); // أوقف أي نطق سابق
    const utter = new SpeechSynthesisUtterance(text);
    if (!cachedVoice) cachedVoice = pickEnglishVoice();
    if (cachedVoice) utter.voice = cachedVoice;
    utter.lang = (cachedVoice && cachedVoice.lang) || 'en-US';
    utter.rate = rate;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  } catch {
    // في حال منع المتصفح النطق — نتجاهل بهدوء.
  }
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
