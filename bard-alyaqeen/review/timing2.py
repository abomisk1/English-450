import json
OLD=json.load(open('question-bank.before-restructure.json',encoding='utf8'))
NEW=json.load(open('../data/question-bank.json',encoding='utf8'))
wc=lambda s:len(s.split())
def secs(q,wpm,seen,share):
    nw=sum(wc(n['t']) for n in q.get('nass',[]) if not (share and n['t'] in seen))
    for n in q.get('nass',[]): seen.add(n['t'])
    words=wc(q['text'])+nw+sum(wc(o) for o in q['options'])
    first=words/wpm*60+1.25*len(q['options'])+3
    retry=words*0.55/wpm*60+1.25*len(q['options'])+3
    return first, retry, wc(q['quote'])/wpm*60+4
def sess(qs,wpm,p,share):
    seen=set(); tot=0
    for q in qs:
        f,r,w=secs(q,wpm,seen,share)
        tot+=(1-p)*(f+2)+p*(f+w+r)
    return tot
def table(B,share):
    out=[]
    for s in B['sessions']:
        qs=s['questions']
        out.append({'session':s['n'],'n':len(qs),'objectives':sorted({q['objective'] for q in qs}),
          **{k:[round(sess(qs,w,p,share)) for p in (0,.25,.4)] for k,w in (('fast',170),('base',130),('slow',100))}})
    return out
before=table(OLD,False); after=table(NEW,True)
# review minis with cost-aware primaries
Q={q['id']:q for s in NEW['sessions'] for q in s['questions']}
def cost(i): 
    seen=set(); f,r,w=secs(Q[i],130,seen,False); return f+2
prim=[]
for o in NEW['reviewBlueprint']['objectives']:
    prim.append(sorted(o['questions'],key=cost)[0])
minis=[[],[],[],[]];tot=[0]*4
for i in sorted(prim,key=cost,reverse=True):
    j=min((k for k in range(4) if len(minis[k])<5),key=lambda k:tot[k]); minis[j].append(i); tot[j]+=cost(i)
rv=[{'qs':m,**{k:[round(sess([Q[i] for i in m],w,p,False)) for p in (0,.25,.4)] for k,w in (('fast',170),('base',130),('slow',100))}} for m in minis]
json.dump({'before':before,'after':after,'review_minis':rv,'primaries':prim},open('timing-comparison.json','w',encoding='utf8'),ensure_ascii=False,indent=1)
print('S | nBefore->nAfter | base25 before->after | slow25 before->after | slow40 after')
for b,a in zip(before,after): print(b['session'],b['n'],'->',a['n'],'|',b['base'][1],'->',a['base'][1],'|',b['slow'][1],'->',a['slow'][1],'|',a['slow'][2],'| fast25',a['fast'][1],'| objs',len(b['objectives']),'->',len(a['objectives']))
for r in rv: print('mini',r['qs'],'base',r['base'],'slow',r['slow'])
print('total q',sum(x['n'] for x in before),'->',sum(x['n'] for x in after))
