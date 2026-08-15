// عناصر واجهة قابلة لإعادة الاستخدام: زر النطق، شريط/حلقة التقدم، بطاقات الإحصاء، إلخ.

import { h, icon } from './dom.js';
import { speak, isSpeechSupported } from '../lib/speech.js';

// زر النطق 🔊 — يقرأ النص الإنجليزي بصوت واضح للمبتدئ.
export function speakButton(text, { size = 'md', label } = {}) {
  const supported = isSpeechSupported();
  const btn = h(
    'button',
    {
      type: 'button',
      class: `speak-btn ${size === 'sm' ? 'speak-btn--sm' : ''} ${size === 'lg' ? 'speak-btn--lg' : ''}`,
      disabled: !supported,
      'aria-label': label || `استمع إلى النطق: ${text}`,
      title: supported ? 'استمع إلى النطق' : 'النطق غير مدعوم في هذا المتصفح',
      onclick: () => {
        if (!supported) return;
        btn.classList.add('is-speaking');
        speak(text);
        const ms = Math.min(4000, 700 + text.length * 55);
        window.setTimeout(() => btn.classList.remove('is-speaking'), ms);
      },
    },
    icon('speaker'),
  );
  return btn;
}

// شريط تقدم أفقي.
export function progressBar(percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  return h(
    'div',
    {
      class: 'progress-bar',
      role: 'progressbar',
      'aria-valuenow': String(Math.round(clamped)),
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    },
    h('div', { class: 'progress-bar__fill', style: { width: `${clamped}%` } }),
  );
}

// حلقة تقدم دائرية (SVG).
export function progressRing(percent, { size = 128, stroke = 12, value, unit } = {}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.style.transform = 'rotate(-90deg)';
  svg.setAttribute('aria-hidden', 'true');

  const bg = document.createElementNS(svgNS, 'circle');
  bg.setAttribute('cx', String(size / 2));
  bg.setAttribute('cy', String(size / 2));
  bg.setAttribute('r', String(radius));
  bg.setAttribute('fill', 'none');
  bg.setAttribute('stroke', 'var(--c-surface-2)');
  bg.setAttribute('stroke-width', String(stroke));

  const fg = document.createElementNS(svgNS, 'circle');
  fg.setAttribute('cx', String(size / 2));
  fg.setAttribute('cy', String(size / 2));
  fg.setAttribute('r', String(radius));
  fg.setAttribute('fill', 'none');
  fg.setAttribute('stroke', 'var(--c-primary)');
  fg.setAttribute('stroke-width', String(stroke));
  fg.setAttribute('stroke-linecap', 'round');
  fg.setAttribute('stroke-dasharray', String(circumference));
  fg.setAttribute('stroke-dashoffset', String(circumference));
  fg.style.transition = 'stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)';
  // تحريك بعد الإدراج
  requestAnimationFrame(() => fg.setAttribute('stroke-dashoffset', String(offset)));

  svg.appendChild(bg);
  svg.appendChild(fg);

  return h(
    'div',
    { class: 'ring', style: { width: `${size}px`, height: `${size}px` } },
    svg,
    h(
      'div',
      { class: 'ring__label' },
      h('div', { class: 'ring__value' }, value ?? `${clamped}%`),
      unit ? h('div', { class: 'ring__unit' }, unit) : null,
    ),
  );
}

// بطاقة إحصاء (رقم + وصف). value قد يكون نصًا أو عنصر DOM.
export function statCard(value, label) {
  return h(
    'div',
    { class: 'stat' },
    h('div', { class: 'stat__value' }, value),
    h('div', { class: 'stat__label' }, label),
  );
}

export function chip(text, variant) {
  return h('span', { class: `chip ${variant === 'primary' ? 'chip--primary' : ''}` }, text);
}

// تغذية راجعة فورية ولطيفة.
export function feedback(correct, { hint, correctAnswer } = {}) {
  const children = [
    h(
      'div',
      { class: 'feedback__title' },
      correct ? [icon('check', 'fb-icon'), ' أحسنت! إجابة صحيحة'] : 'حاول تذكّرها في المرة القادمة 💪',
    ),
  ];
  if (!correct && correctAnswer) {
    children.push(
      h(
        'div',
        { class: 'feedback__hint' },
        'الإجابة الصحيحة: ',
        h('span', { class: 'en' }, correctAnswer),
      ),
    );
  }
  if (hint) {
    children.push(h('div', { class: 'feedback__hint' }, h('span', { class: 'en' }, hint)));
  }
  return h('div', { class: `feedback ${correct ? 'feedback--correct' : 'feedback--wrong'}` }, children);
}
