/**
 * شاشة الدرس التفاعلي:
 * مدخل → هدف → بطاقات المحتوى → تفاعل أثناء الدرس → خلاصة → اختبار قصير → مهمة.
 */

import { h, ar, icon, ICONS, toast, focusMain, announce } from '../lib/dom.js';
import { renderCard, renderQuestion, progressBar, ornament, sectionTitle } from './widgets.js';
import { navigate } from '../lib/router.js';
import { getState, update, saveNow } from '../store.js';
import * as C from '../lib/content.js';
import * as Q from '../lib/quiz.js';
import * as P from '../lib/progress.js';
import * as SRS from '../lib/srs.js';
import { modeLabel, MODE_MINUTES } from '../lib/progress.js';

const MODES = ['brief', 'standard', 'deep'];

function markSeen(lessonId) {
  update((s) => {
    const rec = s.lessons[lessonId] || { seen: false, quizBest: 0, quizAttempts: 0, completedAt: null };
    s.lessons = { ...s.lessons, [lessonId]: { ...rec, seen: true, lastSeenAt: Date.now() } };
  }, { silent: true });
}

function savePosition(unitId, lessonId, lessonTitle) {
  update((s) => { s.lastPosition = { unitId, lessonId, lessonTitle }; }, { silent: true });
}

export function lessonScreen(unit, lesson, units) {
  const s = getState();
  let mode = s.prefs.detail || 'standard';

  markSeen(lesson.id);
  savePosition(unit.id, lesson.id, lesson.title);

  const wrap = h('div', { class: 'container container--narrow section' });
  const body = h('div', { class: 'stack' });

  const idx = unit.lessons.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? unit.lessons[idx - 1] : null;
  const next = idx < unit.lessons.length - 1 ? unit.lessons[idx + 1] : null;

  const modeSwitch = h('div', { class: 'mode-switch', role: 'group', 'aria-label': 'نمط عرض الدرس' },
    ...MODES.map((m) => {
      const b = h('button', {
        class: 'mode-switch__btn', type: 'button', 'aria-pressed': String(m === mode),
      }, `${modeLabel(m)} · ${ar(MODE_MINUTES[m])}د`);
      b.addEventListener('click', () => {
        mode = m;
        [...modeSwitch.children].forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
        paint();
        announce(`نمط العرض: ${modeLabel(m)}`);
      });
      return b;
    }));

  const bookmarked = () => getState().bookmarks.some((b) => b.type === 'lesson' && b.id === lesson.id);
  const bmBtn = h('button', {
    class: 'btn btn--quiet btn--icon', type: 'button',
    'aria-label': 'إضافة إلى المفضلة', title: 'المفضلة',
  }, icon(ICONS.star, 20));
  const paintBm = () => {
    const on = bookmarked();
    bmBtn.style.color = on ? 'var(--c-gold)' : '';
    bmBtn.setAttribute('aria-pressed', String(on));
  };
  bmBtn.addEventListener('click', () => {
    update((st) => {
      if (bookmarked()) st.bookmarks = st.bookmarks.filter((b) => !(b.type === 'lesson' && b.id === lesson.id));
      else st.bookmarks = [...st.bookmarks, { type: 'lesson', id: lesson.id, label: lesson.title, unitId: unit.id, at: Date.now() }];
    });
    paintBm();
    toast(bookmarked() ? 'أُضيف إلى المفضلة.' : 'أُزيل من المفضلة.');
  });
  paintBm();

  wrap.append(
    h('div', { class: 'row', style: { justifyContent: 'space-between' } },
      h('button', { class: 'btn btn--quiet btn--sm', type: 'button', onclick: () => navigate(`/unit/${unit.id}`) },
        icon(ICONS.back, 18), unit.shortTitle),
      bmBtn),
    h('div', { class: 'lesson-head' },
      h('h1', { class: 'lesson-head__title', style: { fontFamily: 'var(--font-text)' } }, lesson.title),
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('span', { class: 'small muted' }, `الكتاب، ص ${lesson.source.pages.map(ar).join('، ')}`),
        modeSwitch),
    ),
    body,
  );

  function paint() {
    body.replaceChildren();

    // ١) مدخل جذّاب
    body.append(h('div', { class: 'card' },
      h('div', { class: 'lesson-card__label' }, h('span', { class: 'chip chip--warn' }, 'مدخل — صياغة تعليمية مساعدة')),
      h('p', { style: { fontSize: 'var(--fs-lg)', margin: 0, lineHeight: '1.9' } }, lesson.hook.text),
    ));

    // ٢) الهدف
    body.append(h('div', { class: 'card card--flat', style: { background: 'var(--bg-sunken)' } },
      h('div', { class: 'row', style: { flexWrap: 'nowrap', alignItems: 'flex-start' } },
        icon(ICONS.flag, 20),
        h('div', {}, h('div', { style: { fontWeight: 700, fontSize: 'var(--fs-sm)' } }, 'هدف الدرس'),
          h('div', { class: 'small' }, lesson.objective.text)))));

    // ٣) بطاقات المحتوى
    const cards = C.cardsForMode(lesson, mode);
    body.append(sectionTitle('المحتوى'));
    for (const c of cards) body.append(renderCard(c));

    // زر التوسّع لمن يريد التفصيل
    const hidden = (lesson.cards || []).filter((c) => !cards.includes(c));
    if (hidden.length) {
      const det = h('details', { class: 'more' },
        h('summary', {}, `عرض ${ar(hidden.length)} بطاقة إضافية من الكتاب`));
      det.addEventListener('toggle', () => {
        if (det.open && det.children.length === 1) for (const c of hidden) det.append(renderCard(c));
      });
      body.append(det);
    }

    // ٤) تفاعل أثناء الدرس
    const inter = C.interactionsForMode(lesson, mode);
    if (inter.length) {
      body.append(ornament(), sectionTitle('تفاعل أثناء الدرس'));
      const seed = lesson.id;
      for (const raw of inter) {
        const q = Q.prepare(raw, seed);
        body.append(h('div', { class: 'card' }, renderQuestion(q, () => {}, {})));
      }
    }

    // ٥) الخلاصة
    body.append(ornament(), h('div', { class: 'card' },
      h('div', { class: 'lesson-card__label' }, h('span', { class: 'chip chip--warn' }, 'خلاصة — صياغة تعليمية مساعدة')),
      h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, 'خلاصة الدرس'),
      h('ul', { style: { margin: 0, paddingInlineStart: '1.2rem', lineHeight: '2' } },
        ...lesson.summary.points.map((t) => h('li', {}, t))),
    ));

    // وضع أسري
    if (getState().prefs.familyMode && lesson.family) {
      body.append(h('div', { class: 'card', style: { background: 'var(--soft-brand-bg)' } },
        h('div', { class: 'lesson-card__label' }, h('span', { class: 'chip chip--brand' }, 'وضع أسري')),
        h('div', {}, lesson.family.text)));
    }

    // ٦) الاختبار القصير
    const rec = P.lessonRecord(getState(), lesson.id);
    body.append(h('div', { class: 'card stack' },
      h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, 'اختبار قصير'),
      h('p', { class: 'small muted', style: { margin: 0 } },
        `${ar(C.quizForMode(lesson, mode).length)} أسئلة، وتغذية راجعة فورية تشرح سبب صحة الإجابة أو خطئها.`),
      rec && rec.quizBest
        ? h('div', { class: rec.quizBest >= Q.PASS_MARK ? 'chip chip--ok' : 'chip chip--warn' },
          `أفضل نتيجة: ${ar(rec.quizBest)}٪`) : null,
      h('button', {
        class: 'btn btn--accent btn--block', type: 'button',
        onclick: () => navigate(`/quiz/${unit.id}/${lesson.id}?mode=${mode}`),
      }, 'ابدأ الاختبار'),
    ));

    // التنقّل
    body.append(h('div', { class: 'lesson-nav', style: { marginTop: '1rem' } },
      prev ? h('button', {
        class: 'btn btn--ghost', type: 'button',
        onclick: () => navigate(`/lesson/${unit.id}/${prev.id}`),
      }, icon(ICONS.back, 18), 'السابق') : null,
      next ? h('button', {
        class: 'btn btn--primary', type: 'button',
        onclick: () => navigate(`/lesson/${unit.id}/${next.id}`),
      }, 'الدرس التالي', icon(ICONS.next, 18))
        : h('button', {
          class: 'btn btn--primary', type: 'button',
          onclick: () => navigate(`/tasks/${unit.id}`),
        }, 'المهام الأدائية'),
    ));
  }

  paint();
  return wrap;
}

/* ----------------------------- شاشة الاختبار ----------------------------- */

export function quizScreen(unit, lesson, mode, units) {
  const list = Q.gradable(C.quizForMode(lesson, mode || 'standard'));
  const prepared = list.map((q) => Q.prepare(q, lesson.id + ':quiz'));
  const results = [];
  let i = 0;

  const wrap = h('div', { class: 'container container--narrow section stack' });
  const head = h('div', {});
  const stage = h('div', {});
  wrap.append(head, stage);

  function paintHead() {
    head.replaceChildren(
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('button', {
          class: 'btn btn--quiet btn--sm', type: 'button',
          onclick: () => navigate(`/lesson/${unit.id}/${lesson.id}`),
        }, icon(ICONS.back, 18), 'الدرس'),
        h('span', { class: 'chip' }, `${ar(Math.min(i + 1, prepared.length))} / ${ar(prepared.length)}`)),
      h('h1', { style: { fontSize: 'var(--fs-xl)', marginTop: '.75rem' } }, `اختبار: ${lesson.title}`),
      progressBar(Math.round((i / prepared.length) * 100)),
    );
  }

  function paintQuestion() {
    paintHead();
    const q = prepared[i];
    const card = h('div', { class: 'card' });
    const nextBtn = h('button', {
      class: 'btn btn--primary btn--block', type: 'button', disabled: true,
      style: { marginTop: '1rem' },
    }, i === prepared.length - 1 ? 'عرض النتيجة' : 'السؤال التالي');
    card.append(renderQuestion(q, (res) => {
      results.push({ id: q.id, correct: res.correct });
      // تحديث المراجعة المتباعدة فورًا
      update((st) => {
        const key = SRS.itemKey(unit.id, lesson.id, q.id);
        st.review = { ...st.review, [key]: SRS.grade(st.review[key], res.correct) };
      }, { silent: true });
      nextBtn.disabled = false;
      nextBtn.focus();
    }));
    nextBtn.addEventListener('click', () => {
      i += 1;
      if (i >= prepared.length) paintResult(); else { paintQuestion(); focusMain(); }
    });
    stage.replaceChildren(card, nextBtn);
  }

  function paintResult() {
    const sc = Q.score(results);
    const pass = Q.passed(sc.percent);

    update((st) => {
      const rec = st.lessons[lesson.id] || { seen: true, quizBest: 0, quizAttempts: 0, completedAt: null };
      const quizBest = Math.max(rec.quizBest || 0, sc.percent);
      const completedAt = rec.completedAt || (quizBest >= Q.PASS_MARK ? Date.now() : null);
      st.lessons = { ...st.lessons, [lesson.id]: { ...rec, seen: true, quizBest, quizAttempts: (rec.quizAttempts || 0) + 1, completedAt } };
      st.stats = { ...st.stats, quizPassed: (st.stats.quizPassed || 0) + (pass ? 1 : 0) };
      P.touchStreak(st);
      P.logActivity(st, 'quiz', { unitId: unit.id, lessonId: lesson.id, percent: sc.percent });
      if (quizBest >= Q.PASS_MARK && !rec.completedAt) {
        st.stats.lessonsCompleted = (st.stats.lessonsCompleted || 0) + 1;
        P.logActivity(st, 'lesson-complete', { unitId: unit.id, lessonId: lesson.id });
      }
    });

    const earned = [];
    update((st) => { earned.push(...P.evaluateBadges(st, units)); });
    saveNow();

    const wrong = results.filter((r) => !r.correct)
      .map((r) => prepared.find((q) => q.id === r.id)).filter(Boolean);

    paintHead();
    const idx = unit.lessons.findIndex((l) => l.id === lesson.id);
    const next = idx < unit.lessons.length - 1 ? unit.lessons[idx + 1] : null;

    stage.replaceChildren(h('div', { class: 'stack' },
      h('div', { class: 'card center' },
        h('div', { style: { fontSize: '2.2rem', marginBottom: '.25rem' } }, pass ? '✅' : '📖'),
        h('h2', { style: { marginTop: 0 } }, `${ar(sc.right)} من ${ar(sc.total)} — ${ar(sc.percent)}٪`),
        h('p', { class: 'muted' }, Q.encouragement(sc.percent)),
        progressBar(sc.percent, true),
      ),
      earned.length ? h('div', { class: 'card' },
        h('h3', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, 'شارات جديدة'),
        ...earned.map((id) => {
          const b = P.badgeById(id);
          return h('div', { class: 'badge badge--earned' },
            h('span', { class: 'badge__icon' }, b.icon),
            h('span', {}, h('span', { class: 'badge__name' }, b.name),
              h('span', { class: 'badge__desc', style: { display: 'block' } }, b.desc)));
        })) : null,
      wrong.length ? h('div', { class: 'card' },
        h('h3', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, 'ما تحتاج إلى مراجعته'),
        h('p', { class: 'small muted' }, 'أُضيفت هذه الأسئلة إلى المراجعة المتباعدة وستعود إليك في وقتها.'),
        ...wrong.map((q) => h('div', { class: 'deflist__row' },
          h('div', { style: { fontWeight: 600 } }, q.prompt),
          h('div', { class: 'small muted' }, q.why)))) : null,
      h('div', { class: 'lesson-nav' },
        h('button', {
          class: 'btn btn--ghost', type: 'button',
          onclick: () => { i = 0; results.length = 0; paintQuestion(); focusMain(); },
        }, 'إعادة المحاولة'),
        next ? h('button', {
          class: 'btn btn--primary', type: 'button',
          onclick: () => navigate(`/lesson/${unit.id}/${next.id}`),
        }, 'الدرس التالي') : h('button', {
          class: 'btn btn--primary', type: 'button',
          onclick: () => navigate(`/unit/${unit.id}`),
        }, 'العودة للوحدة'),
      ),
    ));
    focusMain();
  }

  if (!prepared.length) {
    wrap.append(h('div', { class: 'empty' }, 'لا توجد أسئلة في هذا الدرس.'));
    return wrap;
  }
  paintQuestion();
  return wrap;
}
