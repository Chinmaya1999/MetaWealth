# MetaWealth Capital: Architecture (Phase 0)

## Shape
npm-workspaces monorepo. One API, one calculation engine, three portals sharing one design system.

| Path | Role |
|---|---|
| `backend/packages/financial-formulas` | Pure, deterministic Decimal.js formulas + golden tests. No I/O. Used by the API engine (and later the web for what-ifs). |
| `backend` | Express + TS + Mongoose. Modules: auth, users, (Phase 2) clients, questionnaire, documents, (Phase 3) engine, plans. |
| `frontend` | Vite + React + TS + Tailwind. `/client`, `/advisor`, `/admin` portals, role-guarded. |

## Security decisions already implemented
- Access JWT (15m) held in memory only; refresh token in HttpOnly SameSite=Strict cookie, single-use rotation, reuse revokes all sessions.
- bcrypt(12), lockout after 5 failures, login rate limit, uniform error on bad credentials.
- helmet, CORS allowlist, global rate limit, `sanitizeFilter`, zod validation, pino with redaction.
- Append-only `auditLogs` (8-year retention per BRD NFR-04).
- RBAC via permission map (`security/roles.ts`); advisor-to-client assignment scoping lands with the clients module.

## Collections
Phase 1: `users`, `auditLogs`. Phase 2+: the full list in the master prompt section 14. Money is stored as Decimal128 / decimal strings, never JS numbers.

## Engine rule: base year (found while writing golden tests)
The reference plan (dated 1 Sep 2012) inflates goals from **2013**, the first full year after the plan date, not from 2012:
house 1e7 @8% to 2021 = 18,509,302 needs n=8; marriage 1.5M @5% to 2035 = 4,387,891 needs n=22. Methodology is therefore `years = goalYear - (planYear + 1)`. The BRD text does not state this; confirm with the advisory team. Rebased to 2026, the base year is 2027.

## Open items to confirm with MetaWealth
1. Base-year rule above.
2. Net worth in the reference plan shows liabilities of Rs 1,50,000, while the questionnaire lists a Rs 8,000 card balance and a Rs 15,000 EMI car loan with no outstanding amount. Confirm how the 1.5 lakh was derived before using it as acceptance truth. Also, questionnaire page 'Term plan' rows with zero sum assured (IN-12) are really ULIP/pension.
3. NRO repatriation limit and other regulatory values: compliance sign-off.
4. Hosting region, SEBI registration text, brand assets.

## Phase status
Done and verified end to end (admin -> advisor -> client -> 9 steps -> calc -> review -> release -> new version):
- Auth, RBAC, advisor-to-client scoping (404 on other advisors' clients), audit log.
- Clients, invitations (mock email), 9-step autosaving questionnaire, document upload to private local storage, mock OCR adapter with human confirmation.
- Calculation engine v0.1: risk profile + override, cashflow, net worth, goal inflation/funding waterfall, retirement, insurance need, realignment, surplus allocation, 20 advisory rules, scenarios. 12 golden/unit tests.
- Plans: immutable versions, draft -> in_review -> approved -> released, second-reviewer rule above Rs 5 crore, compare, branded HTML report (print to PDF).
- Web: three portals, wizard, dashboards with Recharts, advisor workbench, admin assumptions (versioned) and audit.

## Not built yet (honest list)
Server-side PDF/A (needs Chromium/Playwright), S3 + Textract (adapter interface ready), Redis/BullMQ jobs and email/SMS/WhatsApp (mock only), MFA/OTP, field-level encryption of PAN/Aadhaar, multi-currency and remittance planner (Module F), insurance-need calibration to the reference plan, Swagger, Docker/AWS/CI, shadcn/React Hook Form, renewal scheduler and material-change triggers, spouse login, branding/disclaimer admin screens, API route tests.
