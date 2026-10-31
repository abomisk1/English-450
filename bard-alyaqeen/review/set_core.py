import json
P='../data/question-bank.json'
B=json.load(open(P,encoding='utf8'))
CORE={2:'s1q2',4:'s2q3',7:'s2q5',8:'s3q1',9:'s3q4',12:'s5q1',13:'s5m1',14:'s6m1',15:'s6q3',16:'s7m1',17:'s8q1',18:'s8m1',19:'s9m1',20:'s10m1'}
LOG=[]
for o in B['reviewBlueprint']['objectives']:
    c=CORE.get(o['id'],o['questions'][0] if len(o['questions'])==1 else o['primary'])
    assert c in o['questions']
    if o.get('primary')!=c: LOG.append({'objective':o['id'],'title':o['title'],'before':o.get('primary'),'after':c})
    o['primary']=c
B['reviewBlueprint']['rule']='سؤال واحد لكل هدف علمي (٢٠ هدفًا). يُقدَّم ما أخطأ فيه الطالب عند أول محاولة، وإلا يُختار السؤال الأساسي (المفهوم المحوري للهدف)، ثم يُدار بين بقية أسئلة الهدف عند تكرار المراجعة بحسب الأقل زمنًا. وتُوزَّع الأسئلة على الجلسات المصغّرة بتوازن زمن القراءة.'
json.dump(B,open(P,'w',encoding='utf8'),ensure_ascii=False,indent=2)
json.dump(LOG,open('change-log-core.json','w',encoding='utf8'),ensure_ascii=False,indent=1)
print(len(LOG),'primaries changed')
for l in LOG: print(l['objective'],l['before'],'->',l['after'])
