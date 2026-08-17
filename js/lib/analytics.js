// طبقة الإحصائيات المجهولة — منفصلة تمامًا عن منطق التطبيق والتقدم.
//
// مبادئ:
//   • تراقب حالة المتجر (store.subscribe) وتشتقّ الأحداث — لا تُعدّل منطق المتجر ولا التقدم.
//   • معرّف مجهول عشوائي يُحفظ في مفتاح تخزين *جديد ومنفصل* (لا يمسّ مفتاح التقدم).
//   • كل إرسال fire-and-forget داخل try/catch — أي فشل/حجب شبكة لا يؤثر على التطبيق.
//   • إذا لم تُضبط قيم الإعداد، تتعطّل الطبقة كليًا (no-op).
//   • منع تكرار الاحتساب: محليًا (سجلّ العناصر المُرسَلة) + خادميًا (مفاتيح PK / on conflict).
//
// «الإكمال» = الإتقان الكامل (mastery): إكمال المستوى = levelStats(L).complete،
// وإكمال البرنامج = computeStats().programComplete (إتقان 450/450).

import { ANALYTICS_CONFIG } from '../config/analytics.config.js';
import { LEVEL_COUNT } from '../data/index.js';
import { subscribe, getState, levelStats, computeStats } from '../store.js';

const ANON_KEY = 'english450:anon:v1';

// —— هل النظام مُفعَّل (تمّ ضبط الإعداد)؟ ——
export function isEnabled() {
  return Boolean(ANALYTICS_CONFIG.SUPABASE_URL && ANALYTICS_CONFIG.SUPABASE_ANON_KEY);
}

// —— معرّف مجهول عشوائي ——
export function newAnonId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* تجاهل */
  }
  // احتياط: UUID v4 بسيط
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// —— تطبيع سجلّ الـanon (بنية آمنة) ——
export function normalizeRecord(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    id: typeof r.id === 'string' && r.id ? r.id : newAnonId(),
    reportedLevels: Array.isArray(r.reportedLevels) ? r.reportedLevels.filter((x) => Number.isInteger(x)) : [],
    reportedProgram: Boolean(r.reportedProgram),
  };
}

// —— الأحداث المستحقّة الإرسال (نقيّة وقابلة للاختبار) ——
// تُعيد المستويات المكتملة التي لم تُرسَل بعد + هل يجب إرسال إكمال البرنامج.
export function pendingEvents(record, state) {
  const newLevels = [];
  for (let L = 1; L <= LEVEL_COUNT; L++) {
    if (levelStats(L, state).complete && !record.reportedLevels.includes(L)) newLevels.push(L);
  }
  const program = computeStats(state).programComplete && !record.reportedProgram;
  return { newLevels, program };
}

// —— تحديث السجلّ بعد الإرسال (نقيّ) ——
export function markReported(record, { newLevels = [], program = false } = {}) {
  const levels = new Set(record.reportedLevels);
  for (const L of newLevels) levels.add(L);
  return {
    ...record,
    reportedLevels: [...levels].sort((a, b) => a - b),
    reportedProgram: record.reportedProgram || Boolean(program),
  };
}

// —— تخزين محلي (منفصل عن التقدم) ——
function loadRecord() {
  try {
    const raw = localStorage.getItem(ANON_KEY);
    return normalizeRecord(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeRecord(null);
  }
}
function saveRecord(rec) {
  try {
    localStorage.setItem(ANON_KEY, JSON.stringify(rec));
  } catch {
    /* تجاهل */
  }
}

// —— استدعاء دالة RPC في Supabase (fire-and-forget) ——
function rpc(fn, body) {
  if (!isEnabled()) return;
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = ANALYTICS_CONFIG;
    fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* تجاهل أي خطأ — لا يؤثر على التطبيق */
  }
}

const trackUser = (id) => rpc('track_user', { p_anon_id: id });
const trackLevel = (id, level) => rpc('track_level', { p_anon_id: id, p_level: level });
const trackProgram = (id) => rpc('track_program', { p_anon_id: id });

// —— مزامنة الأحداث من حالة المتجر ——
let record = null;
function syncFromState(state) {
  if (!record) return;
  const { newLevels, program } = pendingEvents(record, state);
  if (!newLevels.length && !program) return;
  for (const L of newLevels) trackLevel(record.id, L);
  if (program) trackProgram(record.id);
  record = markReported(record, { newLevels, program });
  saveRecord(record);
}

// —— التهيئة (تُستدعى مرّة واحدة عند إقلاع التطبيق) ——
export function initAnalytics() {
  if (!isEnabled()) return; // معطّل — لا شيء
  record = loadRecord();
  saveRecord(record); // يثبّت المعرّف عند أول استخدام
  trackUser(record.id); // تسجيل مستخدم + تحديث آخر ظهور (نشاط)
  syncFromState(getState()); // التقاط أي إكمال سابق حصل قبل تفعيل الإحصائيات
  subscribe((state) => syncFromState(state));
}
