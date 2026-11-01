"""المرحلة ٨: استبدال «بحسب الكتاب» بـ«بحسب المرجع» (و«بحسب الملخص» حيث أوضح) في نصوص الأسئلة فقط. لا تغيير في المعنى ولا الخيارات ولا الشروح.
يُترك «الكتاب» حين يكون جزءًا من نص علمي («أهل الكتاب») أو من اسم كتاب.
الاستعمال: python3 apply_stage8_edits.py (من question-bank.before-stage8.json إلى ../data/question-bank.json)"""
import json
B=json.load(open('question-bank.before-stage8.json',encoding='utf8'))
E={
 's2q4':'بحسب المرجع، في أي شيء يكون «الإحسان» الذي هو أحد مراتب الدين الثلاث؟',
 's5q2':'ما معنى «ولا تؤمنوا حتى تحابوا» في الحديث الآتي بحسب المرجع؟',
 's5m1':'ما أعظم الروابط التي تؤلّف بين القلوب بحسب المرجع؟',
 's6q5':'ما الذي وصفه المرجع بأنه «سياج حفظ الفضائل ومنع فشو الرذائل»؟',
 's8q4':'ما التعليل الذي ذكره المرجع لتنزه الله عن الولد؟',
 's8q5':'بحسب الملخص، من قال: «الملائكة بنات الله»؟',
 's10m1':'ما منزلة الإحياء والإماتة في الآية الآتية بحسب المرجع؟',
 's10q3':'ما المراد بقوله «لم يعمل خيرًا قط» في الحديث الآتي بحسب المرجع؟',
 's10q4':'بحسب المرجع، ما الذي حمل الرجل في الحديث الآتي على وصيته؟',
 's10q5':'ما المراد بـ«الخشية» بحسب المرجع؟',
}
log=[]
for s in B['sessions']:
    for q in s['questions']:
        if q['id'] in E:
            log.append(dict(id=q['id'],before=q['text'],after=E[q['id']])); q['text']=E[q['id']]
            q.setdefault('review',{})['stage8']='استبدال الإحالة «بحسب الكتاب» بما يناسب الملخص مرجعًا أثناء التعلم؛ بلا تغيير في المعنى.'
assert len(log)==len(E)
B['bankVersion']=4
json.dump(B,open('../data/question-bank.json','w',encoding='utf8'),ensure_ascii=False,indent=1)
json.dump(log,open('change-log-stage8.json','w',encoding='utf8'),ensure_ascii=False,indent=1)
print(len(log))
