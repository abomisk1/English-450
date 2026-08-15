// أدوات عشوائية بسيطة.

// خلط عشوائي (Fisher–Yates) — لا يعدّل المصفوفة الأصلية.
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// اختر عنصرًا عشوائيًا.
export function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// اختر n عناصر عشوائية دون تكرار.
export function sampleN(arr, n) {
  return shuffle(arr).slice(0, n);
}
