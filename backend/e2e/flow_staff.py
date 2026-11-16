import os, json, urllib.request, urllib.error, time
CLIENT_EMAIL=os.environ["E2E_CLIENT_EMAIL"]; CLIENT_PW=os.environ["E2E_CLIENT_PASSWORD"]
B="http://localhost:4000/api/v1"; PW=[l.split("=",1)[1].strip() for l in open("/Volumes/chinmaya ssd/MetaWealth Capital/backend/.env") if l.startswith("SEED_DEMO_PASSWORD")][0]
SP=os.environ.get("E2E_OUT","/tmp/")
def call(m,p,t=None,b=None,raw=False):
    h={"authorization":"Bearer "+t} if t else {}; d=None
    if b is not None: d=json.dumps(b).encode(); h["content-type"]="application/json"
    try:
        body=urllib.request.urlopen(urllib.request.Request(B+p,method=m,data=d,headers=h)).read()
        return body if raw else json.loads(body)
    except urllib.error.HTTPError as e: return {"HTTP":e.code,**json.loads(e.read() or b"{}")}
login=lambda e,p=PW: call("POST","/auth/login",b={"email":e,"password":p})["accessToken"]
ct=login(CLIENT_EMAIL,CLIENT_PW); adv=login("advisor1@demo.metawealth.test"); adv2=login("advisor2@demo.metawealth.test"); rev=login("reviewer@demo.metawealth.test"); adm=login("admin@demo.metawealth.test")
cid=call("GET","/clients/me",ct)["client"]["_id"]
print("client",cid,"| advisor sees:",call("GET","/clients?q=chinm",adv)["items"][0]["name"],"| advisor2 sees:",len(call("GET","/clients?q=chinm",adv2)["items"]),"items")

t=time.time(); res=call("POST",f"/clients/{cid}/calculations/run",adv,{})["result"]; print(f"\nCALC {int((time.time()-t)*1000)} ms")
m=res["meta"]; print("plan year",m["planYear"],"| age",m["clientAge"],"spouse",m["spouseAge"],"| retire",res["retirement"]["retirementYear"],"| warnings:",m["warnings"])
print("risk:",res["risk"]["score"],res["risk"]["band"])
cf=res["cashflow"]; print("cashflow remaining :",{k:cf["remainingCurrentYear"][k] for k in ("income","taxes","livingExpenses","loanEmis","insurancePremiums","discretionarySurplus")})
print("cashflow next year :",{k:cf["nextYear"][k] for k in ("income","taxes","livingExpenses","loanEmis","insurancePremiums","discretionarySurplus")})
nw=res["netWorth"]; print("net worth",nw["total"],"assets",nw["assets"],"liab",nw["liabilities"],nw["groups"])
print("\nGOALS"); 
for g in res["goals"]: print(f"  {g['name'][:38]:38} {g['startYear']}-{g['endYear']} FV {g['futureValue']:>14,.0f}  ret {g['portfolioReturnPct']:>5}%  funded {g['fundedPct']:>6}%  {g['status']}")
r=res["retirement"]; print("retirement: need",r["corpusRequired"],"PF",r["pfAtRetirement"],"readiness",r["readinessPct"],"%")
i=res["insurance"]; print("insurance: required",i["coverRequired"],"held (self)",i["coverHeld"],"additional",i["additionalTermCover"],"health ok",i["healthAdequate"])
print("policies:",[(p["name"][:22],p["insured"],p["maturityYear"],p["maturityValue"],p["maturityEstimated"]) for p in i["policies"]])
print("assets used:",[(a["asset"],a["usedForGoals"]) for a in res["assetUsage"] if a["usedForGoals"]])
print("ULIP reposition:",res["ulipRepositioning"])
print("\nINSIGHTS (score %s)"%res["healthScore"]); 
for x in res["insights"]: print(f"  {x['severity']:8} {x['ruleId']:20} {x['title']}")

print("\nOVERRIDE:",call("POST",f"/clients/{cid}/risk-profiler/override",adv,{"band":"Moderately Conservative","reason":"Client prefers lower volatility"}),
      "| reason too short ->",call("POST",f"/clients/{cid}/risk-profiler/override",adv,{"band":"Growth","reason":"x"}).get("error",{}).get("code"))
r2=call("POST",f"/clients/{cid}/calculations/run",adv,{})["result"]; print("after override band:",r2["risk"]["band"],"overridden",r2["risk"]["overridden"],"| goals met",r2["summary"]["goalsMet"],"/",r2["summary"]["goalsTotal"])
print("SCENARIO retire 60:",call("POST",f"/clients/{cid}/scenarios",adv,{"retirementAge":60}))

p=call("POST",f"/clients/{cid}/plans/generate",adv,{})["plan"]; pid=p["_id"]; print("\nPLAN v%s %s"%(p["version"],p["status"]))
print("client sees draft?",call("GET",f"/plans/{pid}",ct).get("HTTP"),"| advisor2 sees?",call("GET",f"/plans/{pid}",adv2).get("HTTP"))
print("submit:",call("POST",f"/plans/{pid}/submit-review",adv)); print("reject w/o note:",call("POST",f"/plans/{pid}/reject",rev,{}).get("error",{}).get("code"))
print("approve (reviewer):",call("POST",f"/plans/{pid}/approve",rev,{"note":"Reviewed"})); print("release:",call("POST",f"/plans/{pid}/release",adv))
print("client sees plans:",[(x["version"],x["status"]) for x in call("GET","/clients/me/plans",ct)["items"]])
html=call("GET",f"/plans/{pid}/report",ct,raw=True).decode(); open(SP+"plan.html","w").write(html)
print("report html: %d bytes | sections:"%len(html),html.count("<h2>"),"| goal pages",html.count("Goal: "),"| has third-party brand:",any(w in html.lower() for w in ("karvy","itrust")))
for q,name in (("","plan.pdf"),("?summary=1","summary.pdf")):
    pdf=call("GET",f"/plans/{pid}/pdf{q}",ct,raw=True); open(SP+name,"wb").write(pdf); print(name,len(pdf),"bytes",pdf[:5])
print("released plan edit attempt (re-release):",call("POST",f"/plans/{pid}/release",adv).get("error",{}).get("message"))
p2=call("POST",f"/clients/{cid}/plans/generate",adv,{})["plan"]; print("new draft v%s | client still sees:"%p2["version"],[(x["version"],x["status"]) for x in call("GET","/clients/me/plans",ct)["items"]])
print("compare:",call("GET",f"/plans/{p2['_id']}/compare/{pid}",adv))
a=call("GET","/admin/audit",adm)["items"]; print("\naudit rows",len(a),"| actions:",sorted({x["action"] for x in a}))
