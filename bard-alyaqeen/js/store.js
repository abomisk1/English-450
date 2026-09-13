/** مخزن الحالة — حفظ تلقائي وإشعار المشتركين. */

import { createStorage } from './lib/storage.js';

const storage = createStorage();

let state = storage.load();
const subs = new Set();
let saveTimer = null;

// نضمن وجود سجلّ محفوظ منذ أول تشغيل، حتى لا يُفقد شيء عند إغلاق مفاجئ.
storage.save(state);

export function getState() { return state; }

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

function emit() { for (const fn of subs) fn(state); }

/** تعديل الحالة عبر دالة، ثم حفظ تلقائي مؤجَّل (لا يفقد التقدّم). */
export function update(mutator, { silent = false } = {}) {
  const next = { ...state };
  mutator(next);
  state = next;
  if (!silent) emit();
  scheduleSave();
  return state;
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

/** حفظ فوري — يُستعمل بعد الأحداث المهمّة (نتيجة اختبار، إنهاء تهيئة، مهمة). */
export function saveNow() { flush(); }

export function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  storage.save(state);
}

export function replaceState(next) {
  state = next;
  emit();
  flush();
}

export function resetState() {
  storage.clear();
  state = storage.load();
  emit();
}

// حفظ فوري عند إخفاء الصفحة أو إغلاقها، حتى لا يضيع تقدّم الجلسة.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
}
