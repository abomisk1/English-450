// صفحة الجلسة: تدير تدفق الخطوات (تعلّم → تمارين → مراجعة → نتيجة).

import { h, mount } from './dom.js';
import { progressBar, speakButton, feedback, statCard, chip } from './widgets.js';
import { buildSession } from '../lib/session.js';
import { buildExercise, typesFor } from '../lib/exercises.js';
import { sample } from '../lib/shuffle.js';
import { getState, answerItem, learnItem, completeSession, computeStats } from '../store.js';
import { speak, stopSpeaking } from '../lib/speech.js';
import { renderCompletionScreen } from './completion.js';

const POINTS_PER_CORRECT = 10;

// نقطة الدخول: تبني عنصر الجلسة كاملًا وتديره داخليًا.
export function renderSession({ onExit }) {
  const container = h('div', {});

  const st = {
    plan: buildSession(getState()),
    index: 0,
    answered: false,
    correctCount: 0,
    exerciseTotal: 0,
    // قائمة العناصر التي أخطأ فيها المستخدم ويجب تصحيحها قبل إنهاء الجلسة.
    retryQueue: [],
    currentStep: null,
  };
  st.currentStep = st.plan.steps[0] || null;

  function exit() {
    stopSpeaking();
    onExit();
  }

  // عدد الأخطاء التي ما زالت بحاجة إلى تصحيح (لمنع/تنبيه الخروج المبكر).
  function pendingCorrections() {
    const currentIsUnansweredRetry = st.currentStep && st.currentStep.isRetry && !st.answered ? 1 : 0;
    return st.retryQueue.length + currentIsUnansweredRetry;
  }

  // زر الإغلاق ✕: لا نُنهي الجلسة بصمت إن بقيت أخطاء — نطلب تأكيدًا واضحًا.
  function requestExit() {
    if (pendingCorrections() > 0) {
      const ok = window.confirm(
        'لا تزال لديك إجابات خاطئة تحتاج إلى تصحيح.\nإذا خرجت الآن فلن تكتمل الجلسة. هل تريد الخروج فعلًا؟',
      );
      if (!ok) return;
    }
    exit();
  }

  // إضافة عنصر أخطأ فيه المستخدم إلى قائمة الإعادة ليُعاد سؤاله عليه لاحقًا.
  function queueWrong(item) {
    st.retryQueue.push(item);
  }

  // تحديد الخطوة التالية: الخطوات الأساسية أولًا، ثم أسئلة تصحيح الأخطاء حتى تنتهي.
  function nextStep() {
    const steps = st.plan.steps;
    if (st.index + 1 < steps.length) {
      st.index += 1;
      return steps[st.index];
    }
    // انتهت الخطوات الأساسية — لا ننهي الجلسة قبل تصحيح كل الأخطاء.
    if (st.retryQueue.length) {
      st.index += 1;
      const item = st.retryQueue.shift();
      const type = sample(typesFor(item));
      return { kind: 'exercise', exercise: buildExercise(item, type), isReview: true, isRetry: true };
    }
    return null; // كل شيء أُجيب بشكل صحيح — يمكن إنهاء الجلسة.
  }

  function goNext() {
    stopSpeaking();
    st.answered = false;
    const next = nextStep();
    if (!next) {
      completeSession(st.correctCount * POINTS_PER_CORRECT);
      // إن اكتمل البرنامج (إتقان 450/450) بهذه الجلسة، نعرض شاشة التهنئة بدل النتيجة العادية.
      if (computeStats(getState()).programComplete) {
        mount(container, renderCompletionScreen({ onRestart: exit, onHome: exit }));
      } else {
        renderSummary();
      }
    } else {
      st.currentStep = next;
      renderStep();
    }
  }

  function restart() {
    st.plan = buildSession(getState());
    st.index = 0;
    st.answered = false;
    st.correctCount = 0;
    st.exerciseTotal = 0;
    st.retryQueue = [];
    st.currentStep = st.plan.steps[0] || null;
    renderStep();
  }

  // —— شاشة النتيجة ——
  function renderSummary() {
    const total = st.exerciseTotal;
    const correct = st.correctCount;
    const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
    const emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👏' : '🌱';
    const title = pct >= 80 ? 'عمل رائع!' : pct >= 50 ? 'أحسنت، تقدّم جيد' : 'بداية جيدة، استمر';

    const body = h(
      'div',
      { class: 'summary' },
      h('div', { class: 'summary__emoji' }, emoji),
      h('h2', { class: 'summary__title' }, title),
      h('p', { class: 'muted' }, 'أنهيت جلسة اليوم. كل تكرار يقرّبك أكثر من الإتقان.'),
      h(
        'div',
        { class: 'summary__stats' },
        statCard(`${correct}/${total}`, 'إجابات صحيحة'),
        statCard(`${pct}%`, 'دقة الجلسة'),
        statCard(`+${correct * POINTS_PER_CORRECT}`, 'نقاط مكتسبة'),
        statCard(String(st.plan.newItems.length), 'عناصر جديدة تعلّمتها'),
      ),
      h(
        'div',
        { class: 'stack' },
        h('button', { type: 'button', class: 'btn btn--primary btn--lg', onclick: exit }, 'العودة إلى الرئيسية'),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: restart }, 'جلسة أخرى'),
      ),
    );

    mount(
      container,
      h('div', { class: 'session' }, h('div', { class: 'session__body' }, body)),
    );
  }

  // —— حالة لا يوجد محتوى ——
  function renderEmpty() {
    mount(
      container,
      h(
        'div',
        { class: 'session' },
        h(
          'div',
          { class: 'session__body' },
          h(
            'div',
            { class: 'empty' },
            h('div', { class: 'empty__emoji' }, '✨'),
            h('h3', {}, 'لا توجد عناصر للمراجعة الآن'),
            h('p', { class: 'muted mt-3' }, 'لقد أنجزت كل شيء متاح. عُد لاحقًا لمراجعة جديدة.'),
            h(
              'div',
              { class: 'mt-4' },
              h('button', { type: 'button', class: 'btn btn--primary', onclick: exit }, 'العودة'),
            ),
          ),
        ),
      ),
    );
  }

  // —— إطار الخطوة (شريط علوي + جسم) ——
  function frame(bodyNode) {
    // التقدّم يحسب المتبقّي من الخطوات الأساسية + أسئلة تصحيح الأخطاء المعلّقة،
    // حتى لا يبلغ الشريط 100% قبل تصحيح جميع الأخطاء فعلًا.
    const steps = st.plan.steps;
    const baseRemaining = Math.max(0, steps.length - (st.index + 1));
    const pending = baseRemaining + st.retryQueue.length;
    const done = st.index;
    const pct = done + pending + 1 === 0 ? 100 : (done / (done + pending + 1)) * 100;
    return h(
      'div',
      { class: 'session page-fade' },
      h(
        'div',
        { class: 'session__top' },
        h('button', { type: 'button', class: 'session__close', 'aria-label': 'إنهاء الجلسة', onclick: requestExit }, '✕'),
        h('div', { class: 'session__progress' }, progressBar(pct)),
      ),
      h('div', { class: 'session__body' }, bodyNode),
    );
  }

  // —— بطاقة التعلّم ——
  function learnCard(item) {
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
        ? h(
            'div',
            { class: 'learn-card__example' },
            h('div', { class: 'learn-card__example-ar', style: { marginTop: '0' } }, `💡 ${item.context}`),
          )
        : null;

    const card = h(
      'div',
      { class: 'card learn-card' },
      h('div', { class: 'learn-card__badge' }, chip(`${isWord ? 'كلمة جديدة' : 'جملة جديدة'} · ${item.category}`, 'primary')),
      h('div', { class: `learn-card__english ${isWord ? '' : 'learn-card__phrase'}` }, item.english),
      isWord && item.partOfSpeech ? h('div', { class: 'learn-card__pos' }, item.partOfSpeech) : null,
      h('div', { class: 'learn-card__arabic' }, item.arabic),
      h('div', { class: 'learn-card__speak' }, speakButton(item.english, { size: 'lg' })),
      example,
    );

    return h(
      'div',
      { class: 'page-fade' },
      card,
      h(
        'div',
        { class: 'mt-4' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--primary btn--lg',
            onclick: () => {
              learnItem(item.id, item.kind);
              goNext();
            },
          },
          'فهمت، التالي',
        ),
      ),
    );
  }

  // —— تمرين متعدد الخيارات ——
  function choiceExercise(ex) {
    const wrap = h('div', { class: 'page-fade' });
    const isListen = ex.type === 'listen-choose';
    const showFocus = ex.type === 'choose-meaning' || ex.type === 'choose-english';

    wrap.appendChild(h('div', { class: 'exercise__prompt' }, ex.prompt));

    // تمرين إكمال الفراغ: عرض الجملة مع الفراغ
    if (ex.type === 'fill-blank' && ex.blankDisplay) {
      wrap.appendChild(
        h(
          'div',
          { class: 'exercise__focus' },
          h('div', { class: 'exercise__focus-en', style: { fontSize: '24px' } }, ex.blankDisplay),
        ),
      );
    }

    if (showFocus) {
      const focus = h('div', { class: 'exercise__focus' });
      if (ex.type === 'choose-meaning') {
        focus.appendChild(h('div', { class: 'exercise__focus-en' }, ex.item.english));
        focus.appendChild(
          h('div', { class: 'mt-3', style: { display: 'flex', justifyContent: 'center' } }, speakButton(ex.item.english)),
        );
      } else {
        focus.appendChild(h('div', { class: 'exercise__focus-ar' }, ex.item.arabic));
      }
      wrap.appendChild(focus);
    }

    if (isListen) {
      wrap.appendChild(
        h('div', { class: 'exercise__listen' }, speakButton(ex.answer || ex.item.english, { label: 'استمع مرة أخرى' })),
      );
      window.setTimeout(() => speak(ex.answer || ex.item.english), 350);
    }

    const optionsWrap = h('div', { class: 'options' });
    const footer = h('div', {});

    ex.options.forEach((opt) => {
      const btn = h(
        'button',
        {
          type: 'button',
          class: `option ${opt.lang === 'en' ? 'en' : ''}`,
          onclick: () => {
            if (st.answered) return;
            st.answered = true;
            answerItem(ex.item.id, ex.item.kind, opt.correct);
            st.exerciseTotal += 1;
            if (opt.correct) st.correctCount += 1;
            else queueWrong(ex.item); // خطأ → يعود للسؤال لاحقًا حتى يُجاب بشكل صحيح

            // تلوين الخيارات
            Array.from(optionsWrap.children).forEach((child, i) => {
              const o = ex.options[i];
              child.disabled = true;
              if (o.correct) child.classList.add('is-correct');
              else if (o === opt) child.classList.add('is-wrong');
              else child.classList.add('is-dim');
            });

            const correctLabel = ex.options.find((o) => o.correct)?.label;
            footer.appendChild(
              feedback(opt.correct, {
                hint: opt.correct ? undefined : ex.hint,
                correctAnswer: opt.correct ? undefined : correctLabel,
              }),
            );
            footer.appendChild(
              h('div', { class: 'mt-4' }, h('button', { type: 'button', class: 'btn btn--primary btn--lg', onclick: goNext }, 'متابعة')),
            );
          },
        },
        opt.label,
      );
      optionsWrap.appendChild(btn);
    });

    wrap.appendChild(optionsWrap);
    wrap.appendChild(footer);
    return wrap;
  }

  // —— تمرين ترتيب الكلمات ——
  function wordOrderExercise(ex) {
    const wrap = h('div', { class: 'page-fade' });
    const answer = ex.answer || '';
    let bank = ex.tokens.map((text, id) => ({ id, text }));
    let placed = [];
    let checked = null;

    const answerZone = h('div', { class: 'word-order__answer' });
    const bankZone = h('div', { class: 'word-order__bank' });
    const footer = h('div', {});
    const actionWrap = h('div', { class: 'mt-4' });

    function redraw() {
      answerZone.replaceChildren(
        ...placed.map((t) =>
          h(
            'button',
            {
              type: 'button',
              class: 'token token--placed',
              onclick: () => {
                if (checked !== null) return;
                placed = placed.filter((x) => x.id !== t.id);
                bank.push(t);
                redraw();
              },
            },
            t.text,
          ),
        ),
      );
      bankZone.replaceChildren(
        ...bank.map((t) =>
          h(
            'button',
            {
              type: 'button',
              class: 'token',
              onclick: () => {
                if (checked !== null) return;
                bank = bank.filter((x) => x.id !== t.id);
                placed.push(t);
                redraw();
              },
            },
            t.text,
          ),
        ),
      );
      if (checked === null) renderAction();
    }

    function check() {
      const attempt = placed.map((t) => t.text).join(' ');
      checked = attempt.toLowerCase() === answer.toLowerCase();
      answerZone.classList.add(checked ? 'is-correct' : 'is-wrong');
      answerItem(ex.item.id, ex.item.kind, checked);
      st.exerciseTotal += 1;
      if (checked) st.correctCount += 1;
      else queueWrong(ex.item); // خطأ → يعود للسؤال لاحقًا حتى يُجاب بشكل صحيح
      footer.replaceChildren(feedback(checked, { correctAnswer: checked ? undefined : answer }));
      renderAction();
    }

    function renderAction() {
      if (checked === null) {
        actionWrap.replaceChildren(
          h(
            'button',
            { type: 'button', class: 'btn btn--primary btn--lg', disabled: placed.length === 0, onclick: check },
            'تحقّق',
          ),
        );
      } else {
        actionWrap.replaceChildren(
          h('button', { type: 'button', class: 'btn btn--primary btn--lg', onclick: goNext }, 'متابعة'),
        );
      }
    }

    wrap.appendChild(ex.prompt ? h('div', { class: 'exercise__prompt' }, ex.prompt) : null);
    wrap.appendChild(
      h(
        'div',
        { class: 'exercise__focus', style: { marginBottom: '16px' } },
        h('div', { class: 'exercise__focus-ar', style: { fontSize: '20px' } }, ex.item.arabic),
        h('div', { class: 'mt-3', style: { display: 'flex', justifyContent: 'center' } }, speakButton(answer, { size: 'sm' })),
      ),
    );
    wrap.appendChild(answerZone);
    wrap.appendChild(bankZone);
    wrap.appendChild(footer);
    wrap.appendChild(actionWrap);

    redraw();
    return wrap;
  }

  // —— رسم الخطوة الحالية ——
  function renderStep() {
    const step = st.currentStep;
    if (!step) {
      renderEmpty();
      return;
    }
    let body;
    if (step.kind === 'learn') {
      body = learnCard(step.item);
    } else if (step.exercise.type === 'word-order') {
      body = wordOrderExercise(step.exercise);
    } else {
      body = choiceExercise(step.exercise);
    }
    // شارة توضّح أن هذا سؤال تصحيح لخطأ سابق.
    if (step.isRetry) {
      body = h(
        'div',
        {},
        h(
          'div',
          { class: 'text-center', style: { marginBottom: 'var(--space-4)' } },
          chip('🔁 صحّح خطأك السابق للمتابعة', 'primary'),
        ),
        body,
      );
    }
    mount(container, frame(body));
  }

  renderStep();
  return container;
}
