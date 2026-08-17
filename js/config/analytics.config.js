// إعداد الإحصائيات (اختياري وعام تمامًا).
//
// ⚠️ هذه القيم عامّة وآمنة للنشر في الواجهة الأمامية و GitHub:
//   • SUPABASE_URL: رابط مشروعك.
//   • SUPABASE_ANON_KEY: المفتاح العام المسموح للواجهة الأمامية — إمّا المفتاح الجديد
//     Publishable (يبدأ بـ sb_publishable_...) أو المفتاح القديم anon (public). كلاهما
//     مُصمَّم ليكون في المتصفّح ومحمي بصلاحيات RLS. لا تضع هنا SUPABASE_SECRET_KEY أو
//     service_role إطلاقًا.
//
// إذا تُركت القيم فارغة، يتعطّل نظام الإحصائيات تلقائيًا (no-op) ويعمل التطبيق
// بالكامل كالمعتاد دون أي أثر. املأها بعد إنشاء مشروع Supabase (انظر docs/ANALYTICS.md).

export const ANALYTICS_CONFIG = {
  SUPABASE_URL: 'https://iwmwhrqcdpfqubejlybl.supabase.co',
  SUPABASE_ANON_KEY: '',
};
