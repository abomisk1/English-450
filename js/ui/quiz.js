// شاشة الاختبار — تُستخدم لاختبار المستوى (20 سؤالًا) والاختبار النهائي (50 سؤالًا).
// آلة حالة بسيطة: الأسئلة (quiz) → النتيجة (result) → مراجعة الأخطاء (review).
//
// مبادئ مهمّة:
//   • الاختبار مستقلّ تمامًا عن التعلّم: لا يستدعي answerItem/learnItem، فلا يمسّ
//     SRS ولا نسبة الإنجاز ولا النقاط — إعادة الاختبار لا تُغيّر الإنجاز إطلاقًا.
//   • يُعيد استخدام أنماط التمارين المجرّبة (اختيار متعدّد) ومكوّنات الواجهة الحالية.
//   • النجاح 80%: 16/20 لاختبار المستوى، 40/50 للاختبار النهائي.

import { h, mount, icon } from './dom.js';
import { progressBar, statCard, chip, speakButton } from './widgets.js';
import { LEVELS } from '../data/index.js';
import {
  buildLevelQuiz,
  buildFinalQuiz,
  LEVEL_QUIZ_SIZE,
  FINAL_QUIZ_SIZE,
  LEVEL_PASS_SCORE,
  FINAL_PASS_SCORE,
  isLevelPass,
  isFinalPass,
} from '../lib/quiz.js';
import {
  recordLevelQuizResult,
  recordFinalQuizResult,
  levelQuizState,
  finalQuizState,
} from '../store.js';
import { speak, stopSpeaking } from '../lib/speech.js';

const ORDINALS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];

export function renderQuiz({ mode, level, onExit }) {
  const container = h('div', {});
  const isFinal = mode === 'final';
  const size = isFinal ? FINAL_QUIZ_SIZE : LEVEL_QUIZ_SIZE;
  const passScore = isFinal ? FINAL_PASS_SCORE : LEVEL_PASS_SCORE;
  const passFn = isFinal ? isFinalPass : isLevelPass;
  const title = isFinal ? 'الاختبار النهائي' : `اختبار المستوى ${ORDINALS[level] || level}`;

  const st = {
    questions: buildQuestions(),
    pos: 0,
    chosenOpt: null,
    answers: [], // { correct, your, correct: label, english, arabic }
    phase: 'quiz', // quiz | result | review
    spokenPos: -1,
    recorded: false,
  };

  function buildQuestions() {
    return isFinal ? buildFinalQuiz() : buildLevelQuiz(level);
  }

  function exit() {
    stopSpeaking();
    onExit();
  }

  function requestExit() {
    if (st.phase === 'quiz') {
      const ok = window.confirm('إذا خرجت الآن فلن تُحتسب نتيجة هذا الاختبار. هل تريد الخروج؟');
      if (!ok) return;
    }
    exit();
  }

  // —— شريط علوي (إغلاق + تقدّم) ——
  function chrome(body, pct) {
    const top = h(
      'div',
      { class: 'session__top' },
      h('button', { type: 'button', class: 'session__close', 'aria-label': 'إنهاء الاختبار', onclick: requestExit }, '✕'),
      h('div', { class: 'session__progress' }, progressBar(pct)),
      h('div', { class: 'session__back-spacer' }),
    );
    return h('div', { class: 'session page-fade' }, top, h('div', { class: 'session__body' }, body));
  }

  // —— سؤال واحد (اختيار متعدّد، بلا كشف الإجابة أثناء الاختبار) ——
  function renderQuestion() {
    const ex = st.questions[st.pos];
    const wrap = h('div', { class: 'page-fade' });

    wrap.appendChild(
      h('div', { class: 'quiz__counter' }, chip(`${title} · سؤال ${st.pos + 1} من ${st.questions.length}`, 'primary')),
    );
    wrap.appendChild(h('div', { class: 'exercise__prompt' }, ex.prompt));

    // منطقة التركيز حسب نوع التمرين.
    if (ex.type === 'choose-meaning') {
      wrap.appendChild(
        h(
          'div',
          { class: 'exercise__focus' },
          h('div', { class: 'exercise__focus-en' }, ex.item.english),
          h('div', { class: 'mt-3', style: { display: 'flex', justifyContent: 'center' } }, speakButton(ex.item.english)),
        ),
      );
    } else if (ex.type === 'choose-english') {
      wrap.appendChild(h('div', { class: 'exercise__focus' }, h('div', { class: 'exercise__focus-ar' }, ex.item.arabic)));
    } else if (ex.type === 'listen-choose') {
      wrap.appendChild(h('div', { class: 'exercise__listen' }, speakButton(ex.answer || ex.item.english, { label: 'استمع مرة أخرى' })));
      if (st.spokenPos !== st.pos) {
        st.spokenPos = st.pos;
        window.setTimeout(() => speak(ex.answer || ex.item.english), 350);
      }
    }

    const optionsWrap = h('div', { class: 'options' });
    ex.options.forEach((opt) => {
      const selected = st.chosenOpt && st.chosenOpt.label === opt.label && st.chosenOpt === opt;
      const btn = h(
        'button',
        {
          type: 'button',
          class: `option${opt.lang === 'en' ? ' en' : ''}${selected ? ' is-selected' : ''}`,
          dataset: { correct: opt.correct ? '1' : '0' },
          'aria-pressed': selected ? 'true' : 'false',
          onclick: () => {
            st.chosenOpt = opt;
            render();
          },
        },
        opt.label,
      );
      optionsWrap.appendChild(btn);
    });
    wrap.appendChild(optionsWrap);

    const isLast = st.pos === st.questions.length - 1;
    wrap.appendChild(
      h(
        'div',
        { class: 'mt-4' },
        h(
          'button',
          { type: 'button', class: 'btn btn--primary btn--lg', disabled: !st.chosenOpt, onclick: advance },
          isLast ? 'إنهاء الاختبار' : 'التالي',
        ),
      ),
    );

    return wrap;
  }

  function advance() {
    if (!st.chosenOpt) return;
    stopSpeaking();
    const ex = st.questions[st.pos];
    const correctLabel = (ex.options.find((o) => o.correct) || {}).label;
    st.answers.push({
      correct: Boolean(st.chosenOpt.correct),
      your: st.chosenOpt.label,
      correctLabel,
      english: ex.item.english,
      arabic: ex.item.arabic,
    });
    st.chosenOpt = null;
    if (st.pos < st.questions.length - 1) {
      st.pos += 1;
      render();
    } else {
      finish();
    }
  }

  // —— إنهاء الاختبار: احتساب النتيجة وحفظها (مرّة واحدة) ——
  function finish() {
    const score = st.answers.filter((a) => a.correct).length;
    const total = st.answers.length;
    const errors = st.answers
      .filter((a) => !a.correct)
      .map((a) => ({ english: a.english, arabic: a.arabic, your: a.your, correct: a.correctLabel }));

    // أفضل نتيجة *سابقة* قبل تسجيل هذه المحاولة (للعرض).
    st.prevBest = (isFinal ? finalQuizState() : levelQuizState(level)).best;

    if (!st.recorded) {
      st.recorded = true;
      if (isFinal) recordFinalQuizResult({ score, total, errors });
      else recordLevelQuizResult(level, { score, total, errors });
    }
    st.score = score;
    st.total = total;
    st.errors = errors;
    st.phase = 'result';
    render();
  }

  // —— شاشة النتيجة ——
  function renderResult() {
    const { score, total, errors } = st;
    const wrong = total - score;
    const pct = total === 0 ? 0 : Math.round((score / total) * 100);
    const passed = passFn(score);

    const buttons = h('div', { class: 'stack' });
    if (errors.length > 0) {
      buttons.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { st.phase = 'review'; render(); } }, `مراجعة الأخطاء (${errors.length})`));
    }
    buttons.appendChild(h('button', { type: 'button', class: 'btn btn--primary btn--lg', onclick: retake }, 'إعادة الاختبار'));
    buttons.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', onclick: exit }, 'العودة'));

    const body = h(
      'div',
      { class: 'summary' },
      h('div', { class: 'summary__emoji' }, passed ? '🏆' : '💪'),
      h('h2', { class: 'summary__title' }, title),
      h(
        'div',
        { class: `quiz-verdict ${passed ? 'is-pass' : 'is-fail'}` },
        passed ? `✅ اجتزت الاختبار (${passScore} فأكثر من ${total})` : `لم تجتز بعد — تحتاج ${passScore} من ${total} على الأقل`,
      ),
      h(
        'div',
        { class: 'summary__stats' },
        statCard(`${score}/${total}`, 'الدرجة'),
        statCard(`${pct}%`, 'النسبة المئوية'),
        statCard(String(score), 'إجابات صحيحة'),
        statCard(String(wrong), 'إجابات خاطئة'),
      ),
      st.prevBest
        ? h('p', { class: 'muted mt-2' }, `أفضل نتيجة سابقة: ${st.prevBest.score}/${st.prevBest.total} (${st.prevBest.pct}%)`)
        : null,
      buttons,
    );
    return h('div', { class: 'session page-fade' }, h('div', { class: 'session__body' }, body));
  }

  // —— مراجعة الأخطاء: تعرض السؤال وإجابتك والإجابة الصحيحة (بلا احتساب أي شيء) ——
  function renderReview() {
    const list = h('div', { class: 'stack' });
    st.errors.forEach((e, i) => {
      list.appendChild(
        h(
          'div',
          { class: 'card quiz-review__item' },
          h('div', { class: 'quiz-review__q' }, h('span', { class: 'en' }, e.english), h('span', { class: 'quiz-review__ar' }, e.arabic)),
          h('div', { class: 'quiz-review__row quiz-review__yours' }, h('span', { class: 'quiz-review__lbl' }, 'إجابتك:'), h('span', {}, e.your)),
          h('div', { class: 'quiz-review__row quiz-review__correct' }, h('span', { class: 'quiz-review__lbl' }, 'الصحيحة:'), h('span', {}, e.correct)),
        ),
      );
    });

    const body = h(
      'div',
      { class: 'page-fade' },
      h('h2', { class: 'summary__title', style: { marginBottom: 'var(--space-2)' } }, 'مراجعة الأخطاء'),
      h('p', { class: 'muted', style: { marginBottom: 'var(--space-4)' } }, `${st.errors.length} سؤالًا تحتاج إلى مراجعة. المراجعة لا تُغيّر نتيجتك ولا نسبة إنجازك.`),
      list,
      h(
        'div',
        { class: 'stack', style: { marginTop: 'var(--space-5)' } },
        h('button', { type: 'button', class: 'btn btn--primary btn--lg', onclick: retake }, 'إعادة الاختبار'),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { st.phase = 'result'; render(); } }, 'العودة إلى النتيجة'),
      ),
    );
    return h('div', { class: 'session page-fade' }, h('div', { class: 'session__body' }, body));
  }

  function retake() {
    stopSpeaking();
    st.questions = buildQuestions();
    st.pos = 0;
    st.chosenOpt = null;
    st.answers = [];
    st.phase = 'quiz';
    st.spokenPos = -1;
    st.recorded = false;
    render();
  }

  function render() {
    if (st.phase === 'result') return mount(container, renderResult());
    if (st.phase === 'review') return mount(container, renderReview());
    const pct = (st.pos / (st.questions.length || 1)) * 100;
    mount(container, chrome(renderQuestion(), pct));
  }

  function start() {
    if (st.questions.length === 0) {
      mount(container, h('div', { class: 'session' }, h('div', { class: 'session__body' },
        h('div', { class: 'empty' },
          h('div', { class: 'empty__emoji' }, '✨'),
          h('h3', {}, 'لا يمكن بدء الاختبار الآن'),
          h('div', { class: 'mt-4' }, h('button', { type: 'button', class: 'btn btn--primary', onclick: exit }, 'العودة')),
        ),
      )));
      return;
    }
    render();
  }

  start();
  return container;
}
