#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
يصدّر عناصر المراجعة إلى ملف منظَّم (CSV و Excel) بنفس أعمدة لوحة الإدارة.
حالة الاعتماد فيه «بانتظار المراجعة» لجميع العناصر — لا يُعتمد شيء تلقائيًّا.

المخرجات:
  docs/review/review-items.csv   (فاصلة منقوطة + BOM، يفتحه Excel العربي مباشرة)
  docs/review/review-items.xls   (جدول منسّق يفتحه Excel و LibreOffice)

التشغيل:  python3 scripts/export_review.py
"""
import json, os, html, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'review')
os.makedirs(OUT, exist_ok=True)

review = json.load(open(os.path.join(ROOT, 'content', 'needs-review.json'), encoding='utf-8'))

KIND_AR = {
    'card:quran': 'نصّ قرآني', 'card:note': 'ملحوظة تعليمية', 'hook': 'مدخل الدرس',
    'objective': 'هدف الدرس', 'summary': 'خلاصة الدرس', 'family': 'سؤال النقاش الأسري',
    'interaction:scenario': 'موقف تطبيقي (داخل الدرس)', 'quiz:scenario': 'موقف تطبيقي (في الاختبار)',
}
SRC_AR = {'quran': 'نصّ قرآني', 'authored': 'صياغة تعليمية مساعدة', 'book': 'منقول من الكتاب'}

COLS = [
    ('م', lambda it: it['seq']),
    ('الوحدة', lambda it: it['unit']),
    ('الدرس', lambda it: it['lesson']),
    ('نوع العنصر', lambda it: KIND_AR.get(it['kind'], it['kind'])),
    ('النص', lambda it: it['text']),
    ('المصدر', lambda it: SRC_AR.get(it['src'], it['src'])),
    ('صفحة الكتاب', lambda it: it.get('page') or ''),
    ('سبب الحاجة إلى المراجعة', lambda it: it['reason']),
    ('الأولوية', lambda it: it['priorityAr']),
    ('حالة الاعتماد', lambda it: 'بانتظار المراجعة'),
    ('الملاحظات', lambda it: ''),
    ('النص بعد التحرير', lambda it: ''),
    ('نص الكتاب المرجعي', lambda it: (it.get('bookContext') or {}).get('text', '')),
    ('المرجع', lambda it: it.get('ref') or ''),
    ('المعرّف', lambda it: it['path']),
    ('موضعه في البرنامج', lambda it: it['route']),
]

items = sorted(review['items'], key=lambda i: (
    {'high': 0, 'medium': 1, 'low': 2}[i['priority']], i['unitId'], i['seq']))


def csv_escape(v):
    s = str(v if v is not None else '').replace('\r\n', ' ⏎ ').replace('\n', ' ⏎ ')
    return '"' + s.replace('"', '""') + '"' if any(c in s for c in '";,') else s


lines = [';'.join(csv_escape(c[0]) for c in COLS)]
for it in items:
    lines.append(';'.join(csv_escape(fn(it)) for _, fn in COLS))
open(os.path.join(OUT, 'review-items.csv'), 'w', encoding='utf-8-sig', newline='') \
    .write('\r\n'.join(lines))

# ملف Excel: جدول HTML بامتداد .xls — يفتحه Excel و LibreOffice بلا مكتبات خارجية.
def cell(v):
    return html.escape(str(v if v is not None else '')).replace('\n', '<br>')


thead = ''.join(f'<th>{html.escape(c[0])}</th>' for c in COLS)
rows = []
for it in items:
    cls = {'high': 'p-high', 'medium': 'p-med', 'low': 'p-low'}[it['priority']]
    tds = ''.join(f'<td>{cell(fn(it))}</td>' for _, fn in COLS)
    rows.append(f'<tr class="{cls}">{tds}</tr>')

by_prio = collections.Counter(i['priorityAr'] for i in items)
by_unit = collections.Counter(i['unit'] for i in items)
summary = ''.join(f'<tr><td>{html.escape(k)}</td><td>{v}</td></tr>'
                  for k, v in list(by_prio.items()) + list(by_unit.items()))

doc = f"""<html xmlns:x="urn:schemas-microsoft-com:office:excel" dir="rtl">
<head><meta charset="utf-8">
<style>
 body{{font-family:Arial,'Segoe UI',sans-serif;direction:rtl}}
 table{{border-collapse:collapse;font-size:11pt}}
 th{{background:#0c2f4a;color:#fff;border:1px solid #7f8c96;padding:6px;text-align:right;
     position:sticky;top:0}}
 td{{border:1px solid #cfd6db;padding:6px;vertical-align:top;text-align:right;
     mso-number-format:"\\@"}}
 tr.p-high td:nth-child(9){{background:#fbe9e7;color:#a33a33;font-weight:bold}}
 tr.p-med  td:nth-child(9){{background:#fbf0d9;color:#8a5b12}}
 tr.p-low  td:nth-child(9){{background:#dff0ef;color:#0f6f6c}}
 tr:nth-child(even) td{{background:#f7f9fa}}
 h2{{color:#0c2f4a}}
</style></head><body>
<h2>بَرْدُ اليقين — عناصر المراجعة الشرعية والتعليمية ({len(items)} عنصرًا)</h2>
<p>مرتّبة بالأولوية ثم الوحدة. حالة الاعتماد «بانتظار المراجعة» للجميع — لم يُعتمد أي عنصر تلقائيًّا.</p>
<table><thead><tr><th>البند</th><th>العدد</th></tr></thead><tbody>{summary}</tbody></table>
<br>
<table><thead><tr>{thead}</tr></thead><tbody>{''.join(rows)}</tbody></table>
</body></html>"""
open(os.path.join(OUT, 'review-items.xls'), 'w', encoding='utf-8').write('﻿' + doc)

print('docs/review/review-items.csv + .xls  —  %d عنصرًا، %s'
      % (len(items), dict(by_prio)))
