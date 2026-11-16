import os, json, urllib.request, urllib.error, sys, uuid
CLIENT_EMAIL=os.environ["E2E_CLIENT_EMAIL"]; CLIENT_PW=os.environ["E2E_CLIENT_PASSWORD"]
B="http://localhost:4000/api/v1"
def call(m,p,t=None,b=None,raw=False,files=None):
    h={"authorization":"Bearer "+t} if t else {}
    data=None
    if files:
        bd=uuid.uuid4().hex; parts=[]
        for k,v in files["fields"].items(): parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="file"; filename="{files["name"]}"\r\nContent-Type: {files["type"]}\r\n\r\n'.encode()+files["bytes"]+b"\r\n"); parts.append(f"--{bd}--\r\n".encode())
        data=b"".join(parts); h["content-type"]=f"multipart/form-data; boundary={bd}"
    elif b is not None: data=json.dumps(b).encode(); h["content-type"]="application/json"
    r=urllib.request.Request(B+p,method=m,data=data,headers=h)
    try:
        resp=urllib.request.urlopen(r); body=resp.read()
        return body if raw else json.loads(body)
    except urllib.error.HTTPError as e:
        return {"HTTP":e.code,**json.loads(e.read() or b"{}")}
def login(e,pw): return call("POST","/auth/login",b={"email":e,"password":pw})["accessToken"]
ct=login(CLIENT_EMAIL,CLIENT_PW)

# ---- Step 1: documents (OCR adapter + confirmation)
docs=[("pan","pan.txt","Name: Test Applicant\nPAN ABCDE1234F\nDOB 05/10/1993\n"),
      ("payslip","payslip.txt","Employer: Royal Enfield\nGross Earnings 291,667\nProvident Fund 8,731\nNet Pay 160,000\n"),
      ("loan","loan.txt","Skoda Rapid Loan\nOutstanding 690,000\nEMI 15,000\nRate 11%\n60 months\n"),
      ("bank","bank.txt","State Bank\nClosing Balance 25,000\n")]
print("STEP 1 documents")
for cat,fn,txt in docs:
    d=call("POST","/clients/me/documents",ct,files={"fields":{"category":cat},"name":fn,"type":"text/plain","bytes":txt.encode()})["document"]
    vals={e["field"]:e["value"] for e in d["extracted"]}
    print(f"  {cat:8} status={d['status']:10} extracted={vals}")
    call("POST",f"/clients/me/documents/{d['_id']}/confirm",ct,{"values":vals})
pdf=call("POST","/clients/me/documents",ct,files={"fields":{"category":"insurance"},"name":"policy.pdf","type":"application/pdf","bytes":b"%PDF-1.4 fake"})["document"]
print("  scanned/pdf ->",pdf["status"],"(manual entry expected)")
print("  documents listed:",len(call("GET","/clients/me/documents",ct)["items"]))

# ---- Steps 2-9: the data gathering sheet, rebased +14 years (BRD R3 approach)
def put(step,data,complete=True): return call("PUT",f"/clients/me/questionnaire/{step}",ct,{"data":data,"complete":complete})
exp={"rent":30000,"repairs":6500,"electricity":3500,"gas":600,"telephone":1400,"mobile":5500,"cableTv":350,"groceries":8000,"restaurants":10000,"clothing":2500,"petrol":10000,"vehicleMaintenance":1000,"servantSalary":5000,"transportOthers":2000,"schoolFees":10000,"personalCare":1500,"giftFamily":1000,"subscriptions":350,"alcohol":2000,"childMedical":3400,"annualOthers":400}
skip={"annualOthers"}; monthly=sum(v for k,v in exp.items() if k not in skip); exp.update({"monthly":monthly,"annual":400,"schoolMonthly":10000,"schoolUntil":2040})
print("\nmonthly expenses computed from sheet line items:",monthly,"(BRD says 104,600)")
S={2:{"profile":{"name":"Abhijit Singh Brar","dob":"1993-10-05","gender":"Male","maritalStatus":"Married","residency":"Resident Indian","occupation":"GM, Royal Enfield","retirementAge":55,"lifeExpectancy":80,"spouseName":"Shagun Sinha","spouseDob":"1993-09-02","spouseOccupation":"Housewife","spouseRetirementAge":55,"dependants":[{"name":"Syona Brar","relation":"Daughter","dob":"2023-12-14","dependant":"Yes"}]}},
3:{"goals":[
 {"name":"Syona boarding education","category":"education","amount":1800000,"amountBasis":"total","startYear":2036,"endYear":2041,"inflation":8,"priority":2},
 {"name":"Syona higher education","category":"education","amount":1200000,"amountBasis":"total","startYear":2042,"endYear":2045,"inflation":8,"priority":3},
 {"name":"Syona marriage","category":"marriage","amount":1500000,"startYear":2049,"inflation":5,"priority":4},
 {"name":"Planning 2nd child","category":"lifestyle","amount":25000,"startYear":2028,"inflation":5,"priority":5},
 {"name":"2nd child boarding education","category":"education","amount":1800000,"amountBasis":"total","startYear":2040,"endYear":2045,"inflation":10,"priority":10},
 {"name":"2nd child higher education","category":"education","amount":1200000,"amountBasis":"total","startYear":2046,"endYear":2049,"inflation":8,"priority":11},
 {"name":"2nd child marriage","category":"marriage","amount":1500000,"startYear":2054,"inflation":5,"priority":12},
 {"name":"Capital for business","category":"business","amount":500000,"startYear":2027,"inflation":8,"priority":8},
 {"name":"International vacation (every 2 yrs)","category":"lifestyle","amount":250000,"amountBasis":"perOccurrence","startYear":2026,"endYear":2059,"frequency":2,"inflation":5,"priority":6},
 {"name":"White goods","category":"lifestyle","amount":50000,"amountBasis":"perOccurrence","startYear":2027,"endYear":2037,"inflation":5,"priority":5},
 {"name":"International vacation with parents","category":"lifestyle","amount":400000,"startYear":2028,"inflation":5,"priority":7},
 {"name":"House purchase","category":"property","amount":10000000,"startYear":2035,"inflation":8,"priority":9,"loanPct":97}]},
4:{"assets":[{"name":"SBI savings","owner":"Self","type":"cash","value":25000},{"name":"Citi savings","owner":"Self","type":"cash","value":7000},{"name":"ICICI savings","owner":"Self","type":"cash","value":110000},{"name":"HDFC savings","owner":"Spouse","type":"cash","value":90000},{"name":"SC savings","owner":"Self","type":"cash","value":18000},
 {"name":"Indian Overseas Bank FD","owner":"Spouse","type":"debt","value":50000,"rate":8.6,"maturityDate":"2026-07-07"},{"name":"Kisan Vikas Patra","owner":"Spouse","type":"debt","value":50000,"rate":8.6,"maturityDate":"2033-03-27"}]},
5:{"nonFinancial":{"realEstate":100000000,"gold":250000,"other":100000},"retirement":{"pf":937000,"pfMonthly":17462}},
6:{"loans":[{"name":"Credit card","outstanding":8000,"emi":2600,"months":3,"rate":36},{"name":"Skoda Rapid","emi":15000,"months":60,"rate":11,"startDate":"2026-10-01"}],
 "insurance":{"life":[
  {"name":"Life Time Super Pension","insurer":"ICICI Pru","insured":"spouse","type":"term","sumAssured":0,"premium":25000,"startDate":"2021-09-28","term":17,"premiumTerm":17},
  {"name":"LIC money back","insurer":"LIC","insured":"spouse","type":"moneyback","sumAssured":250000,"premium":17712,"startDate":"2012-02-28","term":20},
  {"name":"Pru Elite Pension","insurer":"ICICI Pru","insured":"others","type":"pension","sumAssured":0,"premium":300000,"startDate":"2023-12-29","term":6,"premiumTerm":6},
  {"name":"Life Time Super Pension (self)","insurer":"ICICI Pru","insured":"self","type":"term","sumAssured":0,"premium":30000,"startDate":"2021-10-04","term":24,"premiumTerm":24},
  {"name":"Life Time Super Pension (self, cover)","insurer":"ICICI Pru","insured":"self","type":"ulip","sumAssured":1200000,"premium":25000,"startDate":"2020-12-28","term":26,"premiumTerm":26,"fundValue":865680,"splitEquity":65,"splitDebt":35}],
  "healthSumInsured":0,"healthPremium":2880}},
7:{"income":{"ctc":3500000,"bonus":350000,"takeHome":160000,"growth":10}},
8:{"expenses":exp},
9:{"estate":{"will":"No","nominees":"No","consent":True,"signedName":"Abhijit Singh Brar"},"risk":{"answers":[3,3,3,2,3,4,1,3,3,3]}}}
for s in range(2,10):
    r=put(s,S[s]); print(f"STEP {s} saved -> progress {r.get('progress')}% steps done {r.get('stepsDone')}")
q=call("GET","/clients/me/questionnaire",ct); print("saved data groups:",list(q["data"].keys()),"| status",q["status"])
print("\nsubmit:",call("POST","/clients/me/questionnaire/submit",ct))
