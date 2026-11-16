"""Role/permission matrix against a running API. Credentials: SEED_DEMO_PASSWORD from backend/.env (demo users only)."""
import json, urllib.request, urllib.error, os, random
B = "http://localhost:4000/api/v1"
PW = [l.split("=", 1)[1].strip() for l in open(os.path.join(os.path.dirname(__file__), "..", ".env")) if l.startswith("SEED_DEMO_PASSWORD")][0]
def call(m, p, t=None, b=None):
    h = {"authorization": "Bearer " + t} if t else {}; d = None
    if b is not None: d = json.dumps(b).encode(); h["content-type"] = "application/json"
    try: r = urllib.request.urlopen(urllib.request.Request(B + p, method=m, data=d, headers=h)); return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
tok = {r: call("POST", "/auth/login", b={"email": e, "password": PW})[1]["accessToken"] for r, e in {"client": "client1@demo.metawealth.test", "advisor": "advisor1@demo.metawealth.test", "advisor2": "advisor2@demo.metawealth.test", "reviewer": "reviewer@demo.metawealth.test", "admin": "admin@demo.metawealth.test"}.items()}
mine = call("GET", "/clients", tok["advisor"])[1]["items"]; cid = [c for c in mine if c["email"].startswith("client1")][0]["_id"]
other = [c for c in call("GET", "/clients", tok["admin"])[1]["items"] if not c["email"].startswith("client1")][0]["_id"]
fails = 0
def expect(label, got, want):
    global fails; ok = got in want; fails += not ok; print(("PASS " if ok else "FAIL ") + label, got, "" if ok else f"(wanted {want})")
for who in (None,): expect("no token: /clients", call("GET", "/clients")[0], (401,)); expect("no token: /admin/users", call("GET", "/admin/users")[0], (401,))
expect("garbage token", call("GET", "/clients", "abc.def.ghi")[0], (401,))
for r in ("client", "advisor", "reviewer"): expect(f"{r}: /admin/users forbidden", call("GET", "/admin/users", tok[r])[0], (403,)); expect(f"{r}: PUT assumptions forbidden", call("PUT", "/admin/assumptions", tok[r], {"values": {}, "reason": "xxxxx"})[0], (403,))
expect("admin: /admin/users", call("GET", "/admin/users", tok["admin"])[0], (200,))
expect("client: cannot list clients", call("GET", "/clients", tok["client"])[0], (403,))
expect("client: own data", call("GET", "/clients/me", tok["client"])[0], (200,))
expect("client: other client's data hidden", call("GET", f"/clients/{other}", tok["client"])[0], (404,))
expect("client: cannot create client", call("POST", "/clients", tok["client"], {"name": "Xx", "email": "x@x.com"})[0], (403,))
expect("client: cannot generate plan", call("POST", f"/clients/{cid}/plans/generate", tok["client"])[0], (403,))
expect("advisor: own client", call("GET", f"/clients/{cid}", tok["advisor"])[0], (200,))
expect("advisor2: not their client", call("GET", f"/clients/{cid}", tok["advisor2"])[0], (404,))
expect("advisor2: cannot read documents of other's client", call("GET", f"/clients/{cid}/documents", tok["advisor2"])[0], (404,))
expect("advisor: cannot reassign client", call("PATCH", f"/admin/clients/{cid}/advisor", tok["advisor"], {"advisorId": "x"})[0], (403,))
expect("reviewer: can read client", call("GET", f"/clients/{cid}", tok["reviewer"])[0], (200,))
expect("reviewer: cannot edit questionnaire", call("PUT", f"/clients/{cid}/questionnaire/2", tok["reviewer"], {"data": {"profile": {}}})[0], (404, 403))
expect("advisor: cannot read audit log", call("GET", "/admin/audit", tok["advisor"])[0], (403,))
expect("advisor cannot run renewal job", call("POST", "/notifications/run-renewal-check", tok["advisor"])[0], (403,))
# a disabled account loses access immediately, even with an unexpired token
em = f"authz{random.randint(10000,99999)}@demo.metawealth.test"; code, u = call("POST", "/admin/advisors", tok["admin"], {"name": "Authz Temp", "email": em})
t = call("POST", "/auth/login", b={"email": em, "password": u["temporaryPassword"]})[1]["accessToken"]
expect("temp user works", call("GET", "/clients", t)[0], (200,)); call("PATCH", f"/admin/users/{u['user']['id']}", tok["admin"], {"isActive": False})
expect("disabled user's token rejected", call("GET", "/clients", t)[0], (401,))
print("\nALL PASSED" if not fails else f"\n{fails} FAILED")
