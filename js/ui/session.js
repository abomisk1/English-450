// صفحة الجلسة — آلة حالة بإطارات (frames):
//   المرور الأول (main) → شاشة النتيجة (result) → مراجعة الأخطاء (review) → إنهاء (complete)
// مزايا:
//   • زر "السابق" لمراجعة الأسئلة السابقة (قراءة فقط، بلا احتساب مكرّر للنقاط/النتيجة).
//   • شاشة نتيجة تعرض درجة المحاولة الأولى قبل بدء تصحيح الأخطاء.
//   • جلسة تصحيح مخصّصة تُعيد الأخطاء فقط حتى صفر أخطاء (لا تغيّر درجة المحاولة الأولى).
//   • تكامل مع شاشة إكمال البرنامج عند إتقان 450/450.

import { h, mount, icon } from './dom.js';
import { progressBar, speakButton, feedback, statCard, chip } from './widgets.js';
import { buildSession } from '../lib/session.js';
import { buildExercise, typesFor } from '../lib/exercises.js';
import { sample } from '../lib/shuffle.js';
import { getState, answerItem, learnItem, completeSession, computeStats } from '../store.js';
import { speak, stopSpeaking } from '../lib/speech.js';
import { renderCompletionScreen } from './completion.js';

const POINTS_PER_CORRECT = 10;

export function renderSession({ level, onExit }) {
  const container = h('div', {});

  const st = {
    level,
    plan: buildSession(getState(), level),
    mainSteps: [],
    mainPos: 0,
    frames: [],
    view: 0,
    frontier: -1,
    phase: 'main', // main | result | review | done
    firstTotal: 0,
    firstCorrect: 0,
    firstErrors: [], // عناصر أخطأ فيها المستخدم في المحاولة الأولى
    reviewQueue: [],
    pointsEarned: 0,
    finalized: false,
  };
  st.mainSteps = st.plan.steps;

  // ————— أدوات التنقّل —————
  function exit() {
    stopSpeaking();
    onExit();
  }

  function pendingCorrections() {
    return (st.phase === 'review' || (st.phase === 'result' && st.firstErrors.length > 0)) &&
      st.phase !== 'done';
  }

  function requestExit() {
    if (pendingCorrections()) {
      const ok = window.confirm(
        'لا تزال لديك أخطاء تحتاج إلى تصحيح.\nإذا خرجت الآن فلن تكتمل الجلسة. هل تريد الخروج فعلًا؟',
      );
      if (!ok) return;
    }
    exit();
  }

  function appendFrame(frame) {
    st.frames.push(frame);
    st.frontier = st.frames.length - 1;
    st.view = st.frontier;
    render();
  }

  function forwardNav() {
    st.view = Math.min(st.frontier, st.view + 1);
    render();
  }
  function backNav() {
    stopSpeaking();
    st.view = Math.max(0, st.view - 1);
    render();
  }

  function frameForStep(step) {
    if (step.kind === 'learn') return { type: 'learn', item: step.item, done: false };
    return { type: 'ex', ex: step.exercise, phase: 'main', answered: false, correct: null, chosen: null, placed: null };
  }

  function makeReviewFrame() {
    const item = st.reviewQueue.shift();
    const ex = buildExercise(item, sample(typesFor(item)));
    return { type: 'ex', ex, phase: 'review', item, answered: false, correct: null, chosen: null, placed: null };
  }

  // ينتقل إلى الإطار التالي (يولّده ويُلحقه).
  function produceNext() {
    stopSpeaking();
    if (st.phase === 'main') {
      if (st.mainPos < st.mainSteps.length) {
        appendFrame(frameForStep(st.mainSteps[st.mainPos++]));
      } else {
        st.phase = 'result';
        appendFrame({ type: 'result' });
      }
    } else if (st.phase === 'review') {
      if (st.reviewQueue.length) appendFrame(makeReviewFrame());
      else {
        st.phase = 'done';
        appendFrame({ type: 'complete', fromReview: true });
      }
    }
  }

  function startReview() {
    if (st.phase !== 'result') return; // حماية: لا نُعيد بدء المراجعة إذا كانت جارية
    st.phase = 'review';
    st.reviewQueue = st.firstErrors.slice();
    produceNext(); // يولّد أول سؤال مراجعة
  }

  function restart() {
    st.plan = buildSession(getState(), st.level);
    st.mainSteps = st.plan.steps;
    st.mainPos = 0;
    st.frames = [];
    st.view = 0;
    st.frontier = -1;
    st.phase = 'main';
    st.firstTotal = 0;
    st.firstCorrect = 0;
    st.firstErrors = [];
    st.reviewQueue = [];
    st.pointsEarned = 0;
    st.finalized = false;
    start();
  }

  // ————— آثار الإجابة —————
  function recordAnswer(frame) {
    // تُستدعى مرّة واحدة فقط لكل إطار (بحارس frame.answered).
    answerItem(frame.ex.item.id, frame.ex.item.kind, frame.correct);
    if (frame.correct) st.pointsEarned += POINTS_PER_CORRECT;
    if (frame.phase === 'main') {
      st.firstTotal += 1;
      if (frame.correct) st.firstCorrect += 1;
      else st.firstErrors.push(frame.ex.item);
    } else if (!frame.correct) {
      // مراجعة: الخطأ يعود إلى الطابور حتى يُصحَّح
      st.reviewQueue.push(frame.ex.item);
    }
  }

  function finalize() {
    if (st.finalized) return;
    st.finalized = true;
    // النقاط تُحتسب فورًا داخل answerItem لكل إجابة صحيحة؛ لا نضيف مبلغًا مكرّرًا هنا.
    completeSession(0);
  }

  // ————— الإطار العلوي —————
  function progressPct() {
    const totalMain = st.mainSteps.length || 1;
    if (st.phase === 'main') return Math.min(80, (st.mainPos / totalMain) * 80);
    if (st.phase === 'result') return 82;
    if (st.phase === 'review') {
      const remaining = st.reviewQueue.length + 1;
      return Math.min(99, 84 + 14 / (remaining + 1));
    }
    return 100;
  }

  function chrome(body) {
    const top = h(
      'div',
      { class: 'session__top' },
      h('button', { type: 'button', class: 'session__close', 'aria-label': 'إنهاء الجلسة', onclick: requestExit }, '✕'),
      h('div', { class: 'session__progress' }, progressBar(progressPct())),
      st.view > 0
        ? h('button', { type: 'button', class: 'session__back', 'aria-label': 'السابق', onclick: backNav }, icon('back'))
        : h('div', { class: 'session__back-spacer' }),
    );
    return h('div', { class: 'session page-fade' }, top, h('div', { class: 'session__body' }, body));
  }

  // زر تنقّل أمامي عام (للأطر المكتملة أثناء المراجعة).
  function forwardBtn(atFrontier, onFrontier, label) {
    if (atFrontier) return h('button', { type: 'button', class: 'btn btn--primary btn--lg', onclick: onFrontier }, label || 'متابعة');
    return h('button', { type: 'button', class: 'btn btn--primary btn--lg', onclick: forwardNav }, 'التالي');
  }

  // ————— بطاقة التعلّم —————
  function learnCardNode(item) {
    const isWord = item.kind === 'word';
    const example = isWord && item.exampleEnglish
      ? h(
          'div',
          { class: 'learn-card__example' },
          speakButton(item.exampleEnglish, { size: 'sm' }),
          h(
            'div',
            { style: { flex: '1' } },
            h('div', { class: 'learn-card__example-en' }, item.exampleEnglish),
            h('div', { class: 'learn-card__example-ar' }, item.exampleArabic),
          ),
        )
      : !isWord && item.context
        ? h('div', { class: 'learn-card__example' }, h('div', { class: 'learn-card__example-ar', style: { marginTop: '0' } }, `💡 ${item.context}`))
        : null;
    return h(
      'div',
      { class: 'card learn-card' },
      h('div', { class: 'learn-card__badge' }, chip(`${isWord ? 'كلمة جديدة' : 'جملة جديدة'} · ${item.category}`, 'primary')),
      h('div', { class: `learn-card__english ${isWord ? '' : 'learn-card__phrase'}` }, item.english),
      isWord && item.partOfSpeech ? h('div', { class: 'learn-card__pos' }, item.partOfSpeech) : null,
      h('div', { class: 'learn-card__arabic' }, item.arabic),
      h('div', { class: 'learn-card__speak' }, speakButton(item.english, { size: 'lg' })),
      example,
    );
  }

  function renderLearn(frame, atFrontier) {
    const onNext = () => {
      if (atFrontier && !frame.done) {
        learnItem(frame.item.id, frame.item.kind);
        frame.done = true;
        produceNext();
      } else {
        forwardNav();
      }
    };
    return h(
      'div',
      { class: 'page-fade' },
      learnCardNode(frame.item),
      h('div', { class: 'mt-4' }, h('button', { type: 'button', class: 'btn btn--primary btn--lg', onclick: onNext }, atFrontier && !frame.done ? 'فهمت، التالي' : 'التالي')),
    );
  }

  // ————— تمرين متعدد الخيارات —————
  function renderChoice(frame, atFrontier) {
    const ex = frame.ex;
    const wrap = h('div', { class: 'page-fade' });
    if (frame.phase === 'review') {
      wrap.appendChild(h('div', { class: 'text-center', style: { marginBottom: 'var(--space-4)' } }, chip('🔁 مراجعة الأخطاء', 'primary')));
    }
    const isListen = ex.type === 'listen-choose';
    const showFocus = ex.type === 'choose-meaning' || ex.type === 'choose-english';

    wrap.appendChild(h('div', { class: 'exercise__prompt' }, ex.prompt));

    if (ex.type === 'fill-blank' && ex.blankDisplay) {
      wrap.appendChild(h('div', { class: 'exercise__focus' }, h('div', { class: 'exercise__focus-en', style: { fontSize: '24px' } }, ex.blankDisplay)));
    }
    if (showFocus) {
      const focus = h('div', { class: 'exercise__focus' });
      if (ex.type === 'choose-meaning') {
        focus.appendChild(h('div', { class: 'exercise__focus-en' }, ex.item.english));
        focus.appendChild(h('div', { class: 'mt-3', style: { display: 'flex', justifyContent: 'center' } }, speakButton(ex.item.english)));
      } else {
        focus.appendChild(h('div', { class: 'exercise__focus-ar' }, ex.item.arabic));
      }
      wrap.appendChild(focus);
    }
    if (isListen) {
      wrap.appendChild(h('div', { class: 'exercise__listen' }, speakButton(ex.answer || ex.item.english, { label: 'استمع مرة أخرى' })));
      if (!frame.answered) window.setTimeout(() => speak(ex.answer || ex.item.english), 350);
    }

    const optionsWrap = h('div', { class: 'options' });
    const footer = h('div', {});

    const correctLabel = (ex.options.find((o) => o.correct) || {}).label;

    ex.options.forEach((opt) => {
      let cls = 'option' + (opt.lang === 'en' ? ' en' : '');
      if (frame.answered) {
        if (opt.correct) cls += ' is-correct';
        else if (opt.label === frame.chosen) cls += ' is-wrong';
        else cls += ' is-dim';
      }
      const btn = h(
        'button',
        {
          type: 'button',
          class: cls,
          disabled: frame.answered,
          onclick: () => {
            if (frame.answered) return;
            frame.answered = true;
            frame.correct = opt.correct;
            frame.chosen = opt.label;
            recordAnswer(frame);
            render();
          },
        },
        opt.label,
      );
      optionsWrap.appendChild(btn);
    });
    wrap.appendChild(optionsWrap);

    if (frame.answered) {
      footer.appendChild(feedback(frame.correct, {
        hint: frame.correct ? undefined : ex.hint,
        correctAnswer: frame.correct ? undefined : correctLabel,
      }));
      footer.appendChild(h('div', { class: 'mt-4' }, forwardBtn(atFrontier, produceNext)));
    }
    wrap.appendChild(footer);
    return wrap;
  }

  // ————— تمرين ترتيب الكلمات —————
  function renderWordOrder(frame, atFrontier) {
    const ex = frame.ex;
    const answer = ex.answer || '';
    const wrap = h('div', { class: 'page-fade' });
    if (frame.phase === 'review') {
      wrap.appendChild(h('div', { class: 'text-center', style: { marginBottom: 'var(--space-4)' } }, chip('🔁 مراجعة الأخطاء', 'primary')));
    }
    wrap.appendChild(ex.prompt ? h('div', { class: 'exercise__prompt' }, ex.prompt) : null);
    wrap.appendChild(h(
      'div',
      { class: 'exercise__focus', style: { marginBottom: '16px' } },
      h('div', { class: 'exercise__focus-ar', style: { fontSize: '20px' } }, ex.item.arabic),
      h('div', { class: 'mt-3', style: { display: 'flex', justifyContent: 'center' } }, speakButton(answer, { size: 'sm' })),
    ));

    const answerZone = h('div', { class: 'word-order__answer' });
    const bankZone = h('div', { class: 'word-order__bank' });
    const footer = h('div', {});
    const actionWrap = h('div', { class: 'mt-4' });

    if (frame.answered) {
      // وضع مكتمل: نعرض الترتيب الذي اختاره المستخدم مع تلوين النتيجة.
      answerZone.classList.add(frame.correct ? 'is-correct' : 'is-wrong');
      for (const tok of (frame.placed || '').split(' ').filter(Boolean)) {
        answerZone.appendChild(h('span', { class: 'token token--placed' }, tok));
      }
      footer.appendChild(feedback(frame.correct, { correctAnswer: frame.correct ? undefined : answer }));
      actionWrap.appendChild(forwardBtn(atFrontier, produceNext));
      wrap.appendChild(answerZone);
      wrap.appendChild(footer);
      wrap.appendChild(actionWrap);
      return wrap;
    }

    // وضع تفاعلي
    let bank = ex.tokens.map((text, id) => ({ id, text }));
    let placed = [];
    function redraw() {
      answerZone.replaceChildren(
        ...placed.map((t) => h('button', { type: 'button', class: 'token token--placed', onclick: () => { placed = placed.filter((x) => x.id !== t.id); bank.push(t); redraw(); } }, t.text)),
      );
      bankZone.replaceChildren(
        ...bank.map((t) => h('button', { type: 'button', class: 'token', onclick: () => { bank = bank.filter((x) => x.id !== t.id); placed.push(t); redraw(); } }, t.text)),
      );
      actionWrap.replaceChildren(
        h('button', { type: 'button', class: 'btn btn--primary btn--lg', disabled: placed.length === 0, onclick: check }, 'تحقّق'),
      );
    }
    function check() {
      const attempt = placed.map((t) => t.text).join(' ');
      frame.answered = true;
      frame.correct = attempt.toLowerCase() === answer.toLowerCase();
      frame.placed = attempt;
      recordAnswer(frame);
      render();
    }
    wrap.appendChild(answerZone);
    wrap.appendChild(bankZone);
    wrap.appendChild(footer);
    wrap.appendChild(actionWrap);
    redraw();
    return wrap;
  }

  function renderEx(frame, atFrontier) {
    return frame.ex.type === 'word-order' ? renderWordOrder(frame, atFrontier) : renderChoice(frame, atFrontier);
  }

  // ————— شاشة النتيجة (المحاولة الأولى) عندما توجد أخطاء —————
  function firstPct() {
    return st.firstTotal === 0 ? 100 : Math.round((st.firstCorrect / st.firstTotal) * 100);
  }

  function renderResultReview(live) {
    const pct = firstPct();
    const n = st.firstErrors.length;
    const action = live
      ? h('button', { type: 'button', class: 'btn btn--primary btn--lg', onclick: startReview }, 'مراجعة أخطائي')
      : h('button', { type: 'button', class: 'btn btn--primary btn--lg', onclick: forwardNav }, 'التالي');
    return h(
      'div',
      { class: 'summary' },
      h('div', { class: 'summary__emoji' }, pct >= 80 ? '🎯' : pct >= 50 ? '👍' : '🌱'),
      h('h2', { class: 'summary__title' }, `نتيجة الجلسة: ${pct}%`),
      h('p', { class: 'muted' }, `${st.firstCorrect} إجابات صحيحة من ${st.firstTotal} — من المحاولة الأولى.`),
      h('p', { class: 'mt-3', style: { fontWeight: '700' } }, n === 1 ? 'لديك سؤال واحد يحتاج إلى مراجعة.' : `لديك ${n} أسئلة تحتاج إلى مراجعة.`),
      h('div', { class: 'stack mt-4' }, action),
    );
  }

  // ————— شاشة النهاية —————
  function renderTerminal(fromReview) {
    finalize();
    if (computeStats(getState()).programComplete) {
      mount(container, renderCompletionScreen({ onRestart: exit, onHome: exit }));
      return;
    }
    const pct = firstPct();
    const emoji = fromReview ? '🎉' : pct >= 80 ? '🎉' : pct >= 50 ? '👏' : '🌱';
    const title = fromReview ? 'ممتاز! أتقنت جميع أخطاء هذه الجلسة' : pct >= 80 ? 'نتيجة ممتازة!' : pct >= 50 ? 'أحسنت، تقدّم جيد' : 'بداية جيدة، استمر';
    const body = h(
      'div',
      { class: 'summary' },
      h('div', { class: 'summary__emoji' }, emoji),
      h('h2', { class: 'summary__title' }, title),
      h('p', { class: 'muted' }, 'درجة الجلسة تعكس أداءك في المحاولة الأولى.'),
      h(
        'div',
        { class: 'summary__stats' },
        statCard(`${st.firstCorrect}/${st.firstTotal}`, 'صحيحة (أول محاولة)'),
        statCard(`${pct}%`, 'درجة الجلسة'),
        statCard(`+${st.pointsEarned}`, 'نقاط مكتسبة'),
        statCard(String(st.plan.newItems.length), 'عناصر جديدة'),
      ),
      h(
        'div',
        { class: 'stack' },
        h('button', { type: 'button', class: 'btn btn--primary btn--lg', onclick: exit }, 'العودة إلى الرئيسية'),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: restart }, 'جلسة أخرى'),
      ),
    );
    mount(container, h('div', { class: 'session' }, h('div', { class: 'session__body' }, body)));
  }

  function renderEmpty() {
    mount(container, h('div', { class: 'session' }, h('div', { class: 'session__body' },
      h('div', { class: 'empty' },
        h('div', { class: 'empty__emoji' }, '✨'),
        h('h3', {}, 'لا توجد عناصر جديدة في هذا المستوى الآن'),
        h('p', { class: 'muted mt-3' }, 'تعلّمت كل عناصر هذا المستوى المتاحة. جرّب مستوى آخر أو عُد للمراجعة لاحقًا.'),
        h('div', { class: 'mt-4' }, h('button', { type: 'button', class: 'btn btn--primary', onclick: exit }, 'العودة')),
      ),
    )));
  }

  // ————— الرسم —————
  function render() {
    const frame = st.frames[st.view];
    if (!frame) return;
    if (frame.type === 'complete') return renderTerminal(true);
    if (frame.type === 'result') {
      if (st.firstErrors.length === 0) return renderTerminal(false);
      return mount(container, chrome(renderResultReview(st.phase === 'result')));
    }
    const atFrontier = st.view === st.frontier;
    const body = frame.type === 'learn' ? renderLearn(frame, atFrontier) : renderEx(frame, atFrontier);
    mount(container, chrome(body));
  }

  function start() {
    if (st.mainSteps.length === 0) {
      renderEmpty();
      return;
    }
    appendFrame(frameForStep(st.mainSteps[st.mainPos++]));
  }

  start();
  return container;
}
