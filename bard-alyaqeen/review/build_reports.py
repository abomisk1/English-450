import json,html,csv,collections
e=html.escape
AD='٠١٢٣٤٥٦٧٨٩'
ar=lambda n:str(n).translate(str.maketrans('0123456789',AD))
B=json.load(open('../data/question-bank.json',encoding='utf8'))
OLD=json.load(open('question-bank.before-review.json',encoding='utf8'))
LOG=json.load(open('change-log.json',encoding='utf8'))
T=json.load(open('timing-estimate.json',encoding='utf8'))
QV=json.load(open('quran_verified.json',encoding='utf8'))
qs=[q for s in B['sessions'] for q in s['questions']]
byid={q['id']:q for q in qs}
sess_of={q['id']:s['n'] for s in B['sessions'] for q in s['questions']}
oldq={q['id']:q for s in OLD['sessions'] for q in s['questions']}
bp=B['reviewBlueprint']
def pg(q): return '–'.join(map(ar,sorted(set(q['src'].get('pages',[q['src']['sp']]))))) if len(set(q['src'].get('pages',[q['src']['sp']])))>1 else ar(q['src']['sp'])
dec=collections.Counter(q['review']['decision'] for q in qs)
info=collections.Counter(q['review']['info'] for q in qs)
nopt=collections.Counter(len(q['options']) for q in qs)
bl=collections.Counter(q['bloom'] for q in qs)
changed=collections.defaultdict(list)
for l in LOG: changed[l['id']].append(l)
# ---------- CSV (50 + 20)
rows=[]
HDR=['رقم السؤال','الجلسة','المرجع (صفحة الملخص وموضع المعلومة)','صحة المعلومة','جودة الصياغة','جودة الخيارات','سلامة الشرح','القرار','الملاحظة','الهدف العلمي','مستوى السؤال','ما تغيّر']
def chg_txt(qid):
    c=changed.get(qid,[]); return '؛ '.join(sorted({ {'text':'صياغة السؤال','options':'الخيارات','nass':'النص المعروض'}[x['field']] for x in c}))
for q in qs:
    r=q['review']
    rows.append([q['id'],sess_of[q['id']],f"ملخص زاد العباد ص{pg(q)} — {q['src']['locus']}",r['info'],r['wording'],r['options'],r['explain'],r['decision'],(r['info_note']+' | ' if r['info']!='سليمة' else '')+r['note'],bp['objectives'][q['objective']-1]['title'],q['bloom'],chg_txt(q['id'])])
for i,o in enumerate(bp['objectives'],1):
    p=byid[o['primary']]; r=p['review']
    alts='، '.join(x for x in o['questions'] if x!=o['primary']) or '—'
    rows.append([f"R-{i:02d}",'مراجعة المجموعة ١',f"السؤال الأساسي {o['primary']} (ملخص ص{pg(p)}) · بدائل: {alts}",r['info'],'مناسبة','مناسبة','سليم','صالح مبدئيًا' if r['decision']=='صالح مبدئيًا' else r['decision'],f"هدف المراجعة: {o['title']}. يُختار ما أُخطئ فيه أولًا ثم يُدار بين أسئلة الهدف.",o['title'],p['bloom'],'—'])
with open('question-review.csv','w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f); w.writerow(HDR); w.writerows(rows)
# ---------- HTML pieces
def pill(t):
    cls={'صالح مبدئيًا':'ok','معدّل':'warn','معلق':'redo','مستبعد':'redo','سليمة':'ok','تحتاج تحققًا':'warn','غير سليمة':'redo','مناسبة':'ok','معدّلة':'warn','سليم':'ok'}.get(t,'')
    return f'<span class="pill {cls}">{e(t)}</span>'
tb=''
for q in qs:
    r=q['review']; ch=chg_txt(q['id'])
    tb+=f"<tr><td class='mono'>{q['id']}</td><td class='num'>{ar(sess_of[q['id']])}</td><td>ص{pg(q)}<div class='tiny'>{e(q['src']['locus'])}</div></td><td>{pill(r['info'])}</td><td>{pill(r['wording'])}</td><td>{pill(r['options'])}</td><td>{pill(r['explain'])}</td><td>{pill(r['decision'])}</td><td>{e(r['note'])}{('<div class=tiny>الصحة: '+e(r['info_note'])+'</div>') if r['info']!='سليمة' else ''}{('<div class=tiny>تغيّر: '+e(ch)+'</div>') if ch else ''}</td></tr>"
rv=''
for i,o in enumerate(bp['objectives'],1):
    p=byid[o['primary']]; alts=[x for x in o['questions'] if x!=o['primary']]
    rv+=f"<tr><td class='mono'>R-{i:02d}</td><td>{e(o['title'])}</td><td class='mono'>{o['primary']}</td><td class='mono'>{'، '.join(alts) or '—'}</td><td class='num'>{ar(len(o['questions']))}</td><td>{pill(p['review']['decision'])}</td><td>{p['bloom']}</td></tr>"
# Quran table
qrows=''
refs={'s1q2':'البقرة ٢٨٥','s3q2':'البقرة ١٤٣','s4q4a':'التوبة ١٢٤ (الملخص: ١٢٤–١٢٥)','s4q4b':'الأنفال ٢','s5q3':'آل عمران ١٠٣','s5q4':'الحشر ٩','s6q3':'آل عمران ١١٠','s8q1':'الأنعام ١٠١','s9q1':'الأنعام ١٠٢','s10q1':'يونس ٥٦'}
usedtext={}
for qq in qs:
    for n in qq.get('nass',[]):
        if n['k']=='آية': usedtext.setdefault(n['dataset_ref'],(n['t'],[]))[1].append(qq['id'])
for k,v in QV.items():
    t,used=usedtext[f"{v['chapter']}:{v['verse']}"]
    qrows+=f"<tr><td>{refs[k]}</td><td class='aya'>{e(t)}</td><td class='mono'>{', '.join(used)}</td><td>{'مقطع من الآية' if v['partial'] else 'آية كاملة'}</td><td><span class='pill ok'>الهيكل الحرفي مطابق في مجموعتين</span></td></tr>"
HAD=[('لفظ البخاري (جبريل)','s1q3','صحيح البخاري ٥٠','أبو هريرة','لفظ مختلف عن الملخص: ليس فيه «وكتبه»','warn'),
 ('رواية مسلم (جبريل)','s1q3','صحيح مسلم ٩٩','أبو هريرة','مطابق للفظ المعروض، وفيه «وكتابه» و«وتؤمن بالقدر كله»','ok'),
 ('شعب الإيمان','s3q3, s3q4, s4q3','صحيح مسلم ١٥٣','أبو هريرة','مطابق حرفيًا. «واللفظ له» = مسلم (لفظ البخاري أقصر)','ok'),
 ('التحاب وإفشاء السلام','s5q1, s5q2','صحيح مسلم ١٩٤','أبو هريرة','مطابق حرفيًا','ok'),
 ('تغيير المنكر','s6q1, s6q2, s6q4','صحيح مسلم ١٧٧','أبو سعيد الخدري','مطابق حرفيًا','ok'),
 ('حلاوة الإيمان','s7q1, s7q2','صحيح البخاري ١٦ و٦٩٤١','أنس','مطابق حرفيًا. عزو «ومسلم» لم أجده في المجموعة','warn'),
 ('طعم الإيمان','s7q3','صحيح مسلم ١٥١','العباس بن عبد المطلب','مطابق حرفيًا','ok'),
 ('الحديث القدسي','s8q2, s8q3','صحيح البخاري ٤٤٨٢','ابن عباس','الملخص يقتطعه بنقاط؛ عُرض اللفظ الكامل المتحقق منه','ok'),
 ('حديث العزل','s9q4, s9q5','صحيح البخاري ٧٤٠٩ (والرواية الثانية: مسلم ٣٥٥٣)','أبو سعيد','مطابق (أن لا / ألا: رسم واحد)','ok'),
 ('حديث الرجل','s10q3, s10q4','صحيح البخاري ٧٥٠٦ (والشاهد «من خشيتك وأنت أعلم»)','أبو هريرة','سرد الكتاب بصيغته لا لفظ الحديث؛ الشاهد مطابق','warn')]
hrows=''.join(f"<tr><td>{a}</td><td class='mono'>{b}</td><td>{c}</td><td>{d}</td><td>{pill('سليمة' if k=='ok' else 'تحتاج تحققًا')} {e(f)}</td></tr>" for a,b,c,d,f,k in HAD for k in [k])
# timing tables
def cell(v): return f"<td class='num {'bad' if v>180 else ''}'>{ar(v)}</td>"
trow=''.join(f"<tr><td class='num'>{ar(r['session'])}</td><td class='num'>{ar(r['words'])}</td>{''.join(cell(v) for v in r['fast'])}{''.join(cell(v) for v in r['base'])}{''.join(cell(v) for v in r['slow'])}</tr>" for r in T['sessions'])
mrow=''.join(f"<tr><td>جلسة مصغّرة {ar(i+1)}</td>{''.join(cell(v) for v in m['fast'])}{''.join(cell(v) for v in m['base'])}{''.join(cell(v) for v in m['slow'])}</tr>" for i,m in enumerate(T['review_minis']))
over_base25=[r['session'] for r in T['sessions'] if r['base'][1]>180]; over_slow25=[r['session'] for r in T['sessions'] if r['slow'][1]>180]
# changes table
chrows=''
for q in qs:
    for l in changed.get(q['id'],[]):
        if l['field']=='nass': continue
        b=l['before']; a=l['after']
        chrows+=f"<tr><td class='mono'>{q['id']}</td><td>{'الصياغة' if l['field']=='text' else 'الخيارات'}</td><td class='tiny'>{e(b if isinstance(b,str) else ' | '.join(b))}</td><td class='tiny'>{e(a if isinstance(a,str) else ' | '.join(a))}</td><td class='tiny'>{e(l['reason'])}</td></tr>"
nass_changes=[l for l in LOG if l['field']=='nass']
open('_pieces.json','w',encoding='utf8').write(json.dumps({'tb':tb,'rv':rv,'qrows':qrows,'hrows':hrows,'trow':trow,'mrow':mrow,'chrows':chrows,'dec':dec,'info':info,'nopt':nopt,'bl':bl,'over_base25':over_base25,'over_slow25':over_slow25,'nass_changes':len(nass_changes),'nlog':len(LOG),'ntouched':len({l['id'] for l in LOG})},ensure_ascii=False,default=dict))
print(dec,info,nopt,bl,over_base25,over_slow25,len(LOG))
