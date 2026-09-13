/** شاشات: المهام الأدائية، المراجعة الذكية، الإنجاز، المفضلة، البحث. */

import { h, ar, icon, ICONS, toast, focusMain } from '../lib/dom.js';
import { progressBar, sectionTitle, emptyState, renderQuestion, ornament } from './widgets.js';
import { navigate } from '../lib/router.js';
import { getState, update, saveNow } from '../store.js';
import * as P from '../lib/progress.js';
import * as SRS from '../lib/srs.js';
import * as Q from '../lib/quiz.js';
import * as C from '../lib/content.js';

/* ------------------------- المهام الأدائية ------------------------- */

export function tasksScreen(units, focusUnitId) {
  const wrap = h('div', { class: 'container container--narrow section stack' },
    h('h1', {}, 'المهام الأدائية'),
    h('p', { class: 'muted small' },
      'مهامٌ منقولة من الكتاب، نفّذها في واقعك ثم سجّل إنجازها. '
      + 'التقدّم الحقيقي يُقاس بالتطبيق لا بالقراءة وحدها.'));

  const ordered = focusUnitId
    ? [...units.filter((u) => u.id === focusUnitId), ...units.filter((u) => u.id !== focusUnitId)]
    : units;

  for (const u of ordered) {
    const s = getState();
    const done = P.tasksDone(s, u.id, u.tasks);
    const box = h('div', { class: 'card stack' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('h2', { style: { margin: 0, fontSize: 'var(--fs-lg)' } }, u.shortTitle),
        h('span', { class: done === u.tasks.length ? 'chip chip--ok' : 'chip' },
          `${ar(done)}/${ar(u.tasks.length)}`)));

    for (const t of u.tasks) {
      const key = P.taskKey(u.id, t.id);
      const row = h('div', { class: 'task' });
      const paint = () => {
        const isDone = !!getState().tasks[key];
        row.classList.toggle('task--done', isDone);
        row.replaceChildren(
          h('button', {
            class: 'task__check', type: 'button',
            'aria-pressed': String(isDone),
            'aria-label': isDone ? 'إلغاء تسجيل الإنجاز' : 'تسجيل الإنجاز',
            onclick: () => {
              update((st) => {
                const tasks = { ...st.tasks };
                if (tasks[key]) delete tasks[key];
                else {
                  tasks[key] = { doneAt: Date.now() };
                  st.stats = { ...st.stats, tasksDone: (st.stats.tasksDone || 0) + 1 };
                  P.touchStreak(st);
                  P.logActivity(st, 'task', { unitId: u.id, taskId: t.id });
                }
                st.tasks = tasks;
                P.evaluateBadges(st, units);
              });
              saveNow();
              paint();
              toast(getState().tasks[key] ? 'سُجّل إنجاز المهمة.' : 'أُلغي تسجيل الإنجاز.');
            },
          }, isDone ? '✓' : ''),
          h('div', { class: 'task__text' },
            t.text,
            h('div', { class: 'xsmall muted', style: { marginTop: '.25rem' } }, `الكتاب، ص ${ar(t.page)}`)),
        );
      };
      paint();
      box.append(row);
    }
    wrap.append(box);
  }
  return wrap;
}

/* ------------------------- المراجعة الذكية ------------------------- */

export function reviewScreen(units) {
  const s = getState();
  const due = SRS.dueItems(s.review, Date.now(), 20);
  const wrap = h('div', { class: 'container container--narrow section stack' },
    h('h1', {}, 'المراجعة الذكية'));

  if (!due.length) {
    const total = Object.keys(s.review || {}).length;
    wrap.append(emptyState('🌿', 'لا توجد مراجعة مستحقّة الآن',
      total ? `لديك ${ar(total)} عنصرًا في خطة المراجعة، وستعود إليك في أوقاتها.`
        : 'ابدأ بدرس واحد، وستُبنى لك خطة مراجعة تلقائيًّا مما لم تُتقنه.',
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => navigate('/units') },
        'انتقل إلى الوحدات')));
    return wrap;
  }

  // نجمع الأسئلة المستحقّة من بيانات الوحدات المحمّلة
  const items = [];
  for (const d of due) {
    const { unitId, lessonId, quizId } = SRS.parseKey(d.key);
    const unit = units.find((u) => u.id === unitId);
    const lesson = unit && C.findLesson(unit, lessonId);
    const q = lesson && (lesson.quiz || []).find((x) => x.id === quizId);
    if (q) items.push({ key: d.key, unit, lesson, q });
  }

  if (!items.length) {
    wrap.append(emptyState('🌿', 'لا توجد عناصر صالحة للمراجعة', ''));
    return wrap;
  }

  let i = 0;
  const results = [];
  const stage = h('div', {});
  const head = h('div', {});
  wrap.append(head, stage);

  function paint() {
    head.replaceChildren(
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('span', { class: 'small muted' }, 'أعِد ما لم تُتقنه'),
        h('span', { class: 'chip' }, `${ar(Math.min(i + 1, items.length))} / ${ar(items.length)}`)),
      progressBar(Math.round((i / items.length) * 100)));

    if (i >= items.length) {
      const sc = Q.score(results);
      update((st) => {
        const day = new Date(); day.setHours(0, 0, 0, 0);
        const days = new Set(st.stats.reviewDayList || []);
        days.add(day.getTime());
        st.stats = {
          ...st.stats,
          reviewsDone: (st.stats.reviewsDone || 0) + results.length,
          reviewDayList: [...days].slice(-30),
          reviewDays: days.size,
        };
        P.touchStreak(st);
        P.logActivity(st, 'review', { count: results.length, percent: sc.percent });
        P.evaluateBadges(st, units);
      });
      stage.replaceChildren(h('div', { class: 'card center stack' },
        h('div', { style: { fontSize: '2rem' } }, '🔁'),
        h('h2', { style: { marginTop: 0 } }, `أتممت المراجعة: ${ar(sc.right)} / ${ar(sc.total)}`),
        h('p', { class: 'muted' }, 'ما أخطأت فيه سيعود إليك قريبًا، وما أتقنته تباعد موعده.'),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: () => navigate('/home') }, 'العودة للرئيسة')));
      focusMain();
      return;
    }

    const it = items[i];
    const prep = Q.prepare(it.q, it.key);
    const card = h('div', { class: 'card' },
      h('div', { class: 'lesson-card__label' },
        h('span', { class: 'chip' }, `${it.unit.shortTitle} — ${it.lesson.title}`)),
    );
    const nextBtn = h('button', {
      class: 'btn btn--primary btn--block', type: 'button', disabled: true, style: { marginTop: '1rem' },
    }, 'التالي');
    card.append(renderQuestion(prep, (res) => {
      results.push({ correct: res.correct });
      update((st) => {
        st.review = { ...st.review, [it.key]: SRS.grade(st.review[it.key], res.correct) };
      }, { silent: true });
      nextBtn.disabled = false;
      nextBtn.focus();
    }));
    nextBtn.addEventListener('click', () => { i += 1; paint(); });
    stage.replaceChildren(card, nextBtn);
  }

  paint();
  return wrap;
}

/* --------------------------- الإنجاز والتقدّم --------------------------- */

const KIND_LABEL = {
  quiz: 'اختبار درس', 'lesson-complete': 'إتمام درس', task: 'مهمة أدائية', review: 'جلسة مراجعة',
};

export function achievementsScreen(units) {
  const s = getState();
  const overall = P.overallProgress(s, units);
  const totalTasks = units.reduce((n, u) => n + u.tasks.length, 0);
  const doneTasks = units.reduce((n, u) => n + P.tasksDone(s, u.id, u.tasks), 0);

  const wrap = h('div', { class: 'container container--narrow section stack' },
    h('h1', {}, 'الإنجاز والتقدّم'));

  wrap.append(h('div', { class: 'card stack' },
    h('h2', { style: { marginTop: 0, fontSize: 'var(--fs-lg)' } }, 'تقدّمك في الجزء الأول'),
    progressBar(overall.percent, true),
    h('div', { class: 'row', style: { marginTop: '.5rem' } },
      h('span', { class: 'chip' }, `دروس: ${ar(overall.done)}/${ar(overall.total)}`),
      h('span', { class: 'chip' }, `مهام: ${ar(doneTasks)}/${ar(totalTasks)}`),
      h('span', { class: 'chip' }, `مراجعات: ${ar(s.stats.reviewsDone || 0)}`),
      h('span', { class: 'chip' }, `مواظبة: ${ar(s.streak.count || 0)} يوم`),
    ),
  ));

  wrap.append(sectionTitle('تقدّم الوحدات'));
  const ug = h('div', { class: 'card stack' });
  for (const u of units) {
    const p = P.unitProgress(s, u);
    ug.append(h('div', {},
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('span', { style: { fontWeight: 600 } }, u.shortTitle),
        h('span', { class: 'small muted' }, `${ar(p.percent)}٪`)),
      h('div', { style: { marginTop: '.3rem' } }, progressBar(p.percent))));
  }
  wrap.append(ug);

  wrap.append(sectionTitle('الشارات'));
  wrap.append(h('div', { class: 'grid grid--2' },
    ...P.BADGES.map((b) => h('div', { class: `badge ${s.badges[b.id] ? 'badge--earned' : ''}` },
      h('span', { class: 'badge__icon' }, b.icon),
      h('span', {}, h('span', { class: 'badge__name' }, b.name),
        h('span', { class: 'badge__desc', style: { display: 'block' } }, b.desc))))));

  wrap.append(sectionTitle('سجلّ الإنجاز'));
  const acts = (s.activity || []).slice(0, 30);
  wrap.append(h('div', { class: 'card' },
    acts.length ? h('div', {}, ...acts.map((a) => h('div', { class: 'deflist__row' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('span', { style: { fontWeight: 600 } }, KIND_LABEL[a.kind] || a.kind),
        h('span', { class: 'xsmall muted' }, new Date(a.at).toLocaleDateString('ar'))),
      a.ref && a.ref.percent !== undefined
        ? h('div', { class: 'small muted' }, `النتيجة: ${ar(a.ref.percent)}٪`) : null)))
      : h('p', { class: 'muted small', style: { margin: 0 } }, 'لم يُسجَّل نشاط بعد.')));

  return wrap;
}

/* ----------------------------- المفضلة ----------------------------- */

export function bookmarksScreen(units) {
  const s = getState();
  const lessons = s.bookmarks.filter((b) => b.type === 'lesson');
  const answers = s.bookmarks.filter((b) => b.type === 'answer');

  const wrap = h('div', { class: 'container container--narrow section stack' },
    h('h1', {}, 'المفضلة والعلامات المرجعية'));

  if (!lessons.length && !answers.length) {
    wrap.append(emptyState('☆', 'لا توجد عناصر في المفضلة',
      'اضغط على النجمة في أعلى أي درس لإضافته هنا.'));
    return wrap;
  }

  if (lessons.length) {
    wrap.append(sectionTitle('دروس محفوظة'));
    const box = h('div', { class: 'stack' });
    for (const b of lessons) {
      box.append(h('div', { class: 'card' },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } },
          h('button', {
            class: 'btn btn--quiet', type: 'button',
            style: { fontFamily: 'var(--font-text)', fontSize: 'var(--fs-lg)' },
            onclick: () => navigate(`/lesson/${b.unitId}/${b.id}`),
          }, b.label),
          h('button', {
            class: 'btn btn--quiet btn--sm', type: 'button',
            onclick: (e) => {
              update((st) => { st.bookmarks = st.bookmarks.filter((x) => !(x.type === 'lesson' && x.id === b.id)); });
              e.target.closest('.card').remove();
            },
          }, 'إزالة'))));
    }
    wrap.append(box);
  }

  if (answers.length) {
    wrap.append(sectionTitle('إجاباتك على الأسئلة التحصيلية'));
    wrap.append(h('div', { class: 'card' },
      ...answers.map((a) => h('div', { class: 'deflist__row' },
        h('div', { class: 'xsmall muted' }, a.id),
        h('div', {}, a.label)))));
  }

  return wrap;
}

/* ------------------------------ البحث ------------------------------ */

const KIND_CHIP = {
  lesson: 'درس', quran: 'نصّ قرآني', hadith: 'حديث', dhikr: 'ذكر',
  list: 'قائمة', text: 'شرح', note: 'صياغة مساعدة', task: 'مهمة أدائية', assessment: 'سؤال تحصيلي',
};

export function searchScreen(units) {
  const index = C.buildSearchIndex(units);
  const wrap = h('div', { class: 'container container--narrow section stack' },
    h('h1', {}, 'البحث داخل المحتوى'));

  const results = h('div', { class: 'stack' });
  const input = h('input', {
    class: 'input', type: 'search', placeholder: 'ابحث عن كلمة أو موضوع…',
    'aria-label': 'البحث داخل المحتوى', autocomplete: 'off',
  });
  const hint = h('p', { class: 'small muted' }, 'اكتب حرفين على الأقل. البحث يتجاهل التشكيل واختلاف الألف والياء.');

  const run = () => {
    const rows = C.search(index, input.value);
    results.replaceChildren();
    if (input.value.trim().length < 2) { results.append(hint); return; }
    if (!rows.length) {
      results.append(emptyState('🔍', 'لا توجد نتائج', 'جرّب كلمة أخرى أو أقصر.'));
      return;
    }
    results.append(h('div', { class: 'small muted' }, `${ar(rows.length)} نتيجة`));
    for (const r of rows) {
      results.append(h('button', {
        class: 'card', type: 'button',
        style: { width: '100%', textAlign: 'start', cursor: 'pointer', font: 'inherit', color: 'inherit' },
        onclick: () => {
          if (r.lessonId) navigate(`/lesson/${r.unitId}/${r.lessonId}`);
          else if (r.kind === 'task') navigate(`/tasks/${r.unitId}`);
          else navigate(`/unit/${r.unitId}`);
        },
      },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } },
          h('span', { class: 'chip' }, KIND_CHIP[r.kind] || r.kind),
          h('span', { class: 'xsmall muted' }, r.page ? `ص ${ar(r.page)}` : r.unitTitle)),
        h('div', { style: { fontWeight: 700, marginTop: '.35rem' } }, r.label),
        r.snippet ? h('div', { class: 'small muted' }, r.snippet.slice(0, 160) + (r.snippet.length > 160 ? '…' : '')) : null,
        h('div', { class: 'xsmall muted', style: { marginTop: '.25rem' } },
          `${r.unitTitle}${r.lessonTitle ? ' · ' + r.lessonTitle : ''}`),
      ));
    }
  };
  input.addEventListener('input', run);

  wrap.append(input, results);
  run();
  setTimeout(() => input.focus(), 60);
  return wrap;
}
