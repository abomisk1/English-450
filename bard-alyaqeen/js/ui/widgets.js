/** مكوّنات مشتركة: بطاقات المحتوى، والتفاعلات، والتغذية الراجعة. */

import { h, icon, ICONS, ar, toast } from '../lib/dom.js';
import { cardKindLabel } from '../lib/content.js';
import * as speech from '../lib/speech.js';
import * as Q from '../lib/quiz.js';

/* --------------------------- بطاقات المحتوى --------------------------- */

function sourceRef(card) {
  const bits = [];
  if (card.ref) bits.push(card.ref);
  if (card.page) bits.push(`الكتاب، ص ${ar(card.page)}`);
  if (!bits.length) return null;
  return h('div', { class: 'src-ref' }, bits.join(' — '));
}

function listenButton(card) {
  const src = speech.audioSourceFor(card);
  if (!src) {
    return h('button', {
      class: 'btn btn--quiet btn--sm', type: 'button', disabled: true,
      title: speech.unavailableReason(card),
      'aria-label': speech.unavailableReason(card),
    }, icon(ICONS.sound, 18), 'الاستماع غير متاح');
  }
  if (src === 'recording') {
    return h('button', {
      class: 'btn btn--quiet btn--sm', type: 'button',
      onclick: () => { const a = new Audio(card.audio); a.play().catch(() => toast('تعذّر تشغيل التسجيل.')); },
    }, icon(ICONS.sound, 18), 'استماع (تسجيل معتمد)');
  }
  const btn = h('button', { class: 'btn btn--quiet btn--sm', type: 'button' }, icon(ICONS.sound, 18), 'استماع');
  btn.addEventListener('click', () => {
    if (speech.isSpeaking()) { speech.stop(); btn.lastChild.textContent = 'استماع'; return; }
    const text = card.items
      ? card.items.map((i) => `${i.term}: ${i.def}`).join('. ')
      : card.text;
    if (speech.speak(text, card, { onend: () => { btn.lastChild.textContent = 'استماع'; } })) {
      btn.lastChild.textContent = 'إيقاف';
    }
  });
  return btn;
}

export function renderCard(card) {
  const kind = cardKindLabel(card);
  const head = h('div', { class: 'lesson-card__label' },
    h('span', { class: `chip ${kind.cls}` }, kind.text),
  );

  let body;
  if (card.type === 'quran') {
    body = h('div', { class: 'quran', lang: 'ar' }, card.text);
  } else if (card.type === 'hadith' || card.type === 'dhikr') {
    body = h('blockquote', { class: `narration ${card.type === 'dhikr' ? 'narration--dhikr' : ''}`, lang: 'ar' },
      card.title ? h('div', { class: 'small muted', style: { fontFamily: 'var(--font-ui)', marginBottom: '.4rem' } }, card.title) : null,
      h('div', {}, card.text),
      card.note ? h('span', { class: 'narration__src' }, card.note) : null,
    );
  } else if (card.type === 'list') {
    body = h('div', { class: 'deflist' },
      ...(card.items || []).map((it) => h('div', { class: 'deflist__row' },
        h('div', { class: 'deflist__term' }, it.term),
        h('div', { class: 'deflist__def' }, it.def),
      )),
    );
  } else if (card.type === 'note' || card.src === 'authored') {
    body = h('div', { class: 'aid' },
      h('span', { class: 'aid__tag' }, 'صياغة تعليمية مساعدة (ليست من الكتاب)'),
      h('div', {}, card.text),
    );
  } else {
    body = h('div', { class: 'book-text' }, card.text);
  }

  return h('article', { class: 'lesson-card' },
    head,
    card.title && card.type !== 'hadith' && card.type !== 'dhikr'
      ? h('h3', { class: 'card__title' }, card.title) : null,
    body,
    h('div', { class: 'row', style: { marginTop: '.6rem', justifyContent: 'space-between' } },
      sourceRef(card),
      listenButton(card),
    ),
  );
}

/* ------------------------------ التفاعلات ------------------------------ */

function feedbackBox(ok, why) {
  return h('div', { class: `feedback ${ok ? 'feedback--ok' : 'feedback--err'}`, role: 'status' },
    h('strong', { class: 'feedback__title' }, ok ? 'إجابة صحيحة' : 'ليست الإجابة الصحيحة'),
    h('div', {}, why),
  );
}

const KEYS = ['أ', 'ب', 'ج', 'د', 'هـ'];

/**
 * يرسم سؤالًا تفاعليًّا.
 * @param {object} q سؤال مُجهَّز عبر Q.prepare
 * @param {(res:{correct:boolean})=>void} onAnswer
 * @param {object} opts { showWhy: boolean }
 */
export function renderQuestion(q, onAnswer, opts = {}) {
  const wrap = h('section', { class: 'q' });
  const prompt = h('div', { class: 'q__prompt' }, q.prompt);
  wrap.append(prompt);
  if (q.src === 'authored') {
    wrap.append(h('div', { class: 'chip chip--warn', style: { marginBottom: '.5rem' } },
      'موقف تطبيقي بصياغة تعليمية مساعدة'));
  }

  let answered = false;
  const done = (correct, detail) => {
    if (answered) return;
    answered = true;
    wrap.append(feedbackBox(correct, q.why || ''));
    onAnswer && onAnswer({ correct, detail });
  };

  if (['mcq', 'truefalse', 'scenario'].includes(q.kind) || q.kind === 'complete') {
    if (q.kind === 'complete') {
      wrap.append(h('div', { class: 'cloze' },
        q.before, ' ', h('span', { class: 'cloze__gap' }, '……'), ' ', q.after));
    }
    const opts_ = h('div', { class: 'opts', role: 'group', 'aria-label': 'الخيارات' });
    q.view.forEach((text, i) => {
      const b = h('button', { class: 'opt', type: 'button' },
        h('span', { class: 'opt__key' }, KEYS[i] || i + 1),
        h('span', {}, text));
      b.addEventListener('click', () => {
        if (answered) return;
        const correct = i === q.answerIndex;
        [...opts_.children].forEach((child, j) => {
          child.disabled = true;
          if (j === q.answerIndex) child.classList.add('opt--right');
          else if (j === i) child.classList.add('opt--wrong');
        });
        done(correct);
      });
      opts_.append(b);
    });
    wrap.append(opts_);
    return wrap;
  }

  if (q.kind === 'order') {
    const items = q.view.slice();
    const list = h('ol', { class: 'order-list' });
    const paint = () => {
      list.replaceChildren(...items.map((text, i) => h('li', { class: 'order-item' },
        h('span', { class: 'opt__key' }, ar(i + 1)),
        h('span', { class: 'order-item__text' }, text),
        h('span', { class: 'order-item__ctrls' },
          h('button', {
            class: 'btn btn--ghost btn--icon', type: 'button', 'aria-label': 'إلى الأعلى',
            disabled: i === 0 || answered,
            onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; paint(); },
          }, '▲'),
          h('button', {
            class: 'btn btn--ghost btn--icon', type: 'button', 'aria-label': 'إلى الأسفل',
            disabled: i === items.length - 1 || answered,
            onclick: () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; paint(); },
          }, '▼'),
        ),
      )));
    };
    paint();
    const submit = h('button', { class: 'btn btn--accent btn--block', type: 'button', style: { marginTop: '.75rem' } },
      'تحقّق من الترتيب');
    submit.addEventListener('click', () => {
      if (answered) return;
      const res = Q.check(q, items);
      submit.disabled = true;
      [...list.children].forEach((li, i) => {
        li.classList.add(res.detail[i] ? 'order-item--right' : 'order-item--wrong');
        li.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      });
      if (!res.correct) {
        wrap.insertBefore(h('div', { class: 'aid', style: { marginTop: '.6rem' } },
          h('span', { class: 'aid__tag' }, 'الترتيب الصحيح'),
          h('ol', { style: { margin: 0, paddingInlineStart: '1.2rem' } },
            ...q.items.map((t) => h('li', {}, t)))), submit.nextSibling);
      }
      done(res.correct, res.detail);
    });
    wrap.append(list, submit);
    return wrap;
  }

  if (q.kind === 'match') {
    const answer = {};
    const rows = h('div', { class: 'match' });
    q.terms.forEach((term) => {
      const sel = h('select', { class: 'match__select', 'aria-label': `معنى ${term}` },
        h('option', { value: '' }, '— اختر المعنى —'),
        ...q.choices.map((c) => h('option', { value: c }, c)));
      sel.addEventListener('change', () => { answer[term] = sel.value; });
      rows.append(h('div', { class: 'match__row' }, h('div', { class: 'match__term' }, term), sel));
    });
    const submit = h('button', { class: 'btn btn--accent btn--block', type: 'button', style: { marginTop: '.75rem' } },
      'تحقّق من المطابقة');
    submit.addEventListener('click', () => {
      if (answered) return;
      const res = Q.check(q, answer);
      submit.disabled = true;
      [...rows.children].forEach((row, i) => {
        row.classList.add(res.detail[i] ? 'match__row--right' : 'match__row--wrong');
        row.querySelector('select').disabled = true;
      });
      if (!res.correct) {
        wrap.append(h('div', { class: 'aid' },
          h('span', { class: 'aid__tag' }, 'المطابقة الصحيحة'),
          ...q.pairs.map(([a, b]) => h('div', {}, `${a} ← ${b}`))));
      }
      done(res.correct, res.detail);
    });
    wrap.append(rows, submit);
    return wrap;
  }

  if (q.kind === 'flashcards') {
    const grid = h('div', { class: 'flash' });
    q.view.forEach(([front, back]) => {
      const c = h('button', { class: 'flash__card', type: 'button', dataset: { flipped: 'false' } }, front);
      c.addEventListener('click', () => {
        const flipped = c.dataset.flipped === 'true';
        c.dataset.flipped = flipped ? 'false' : 'true';
        c.textContent = flipped ? front : back;
      });
      grid.append(c);
    });
    const next = h('button', { class: 'btn btn--ghost btn--block', type: 'button', style: { marginTop: '.75rem' } },
      'تم — راجعتها');
    next.addEventListener('click', () => { next.disabled = true; onAnswer && onAnswer({ correct: true }); });
    wrap.append(grid, next);
    return wrap;
  }

  return wrap;
}

/* -------------------------------- عامّة -------------------------------- */

export function progressBar(percent, big = false) {
  return h('div', {
    class: `progress ${big ? 'progress--lg' : ''}`, role: 'progressbar',
    'aria-valuenow': percent, 'aria-valuemin': 0, 'aria-valuemax': 100,
    'aria-label': `نسبة التقدّم ${percent}٪`,
  }, h('div', { class: 'progress__bar', style: { width: `${percent}%` } }));
}

export function ornament() {
  return h('div', { class: 'rule-orn', 'aria-hidden': 'true' }, h('span', { class: 'rule-orn__d' }, '❖'));
}

export function emptyState(iconText, title, desc, action) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty__icon' }, iconText),
    h('h3', {}, title),
    desc ? h('p', { class: 'muted' }, desc) : null,
    action || null,
  );
}

export function sectionTitle(text, extra) {
  return h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '.5rem' } },
    h('h2', { style: { margin: 0 } }, text), extra || null);
}
