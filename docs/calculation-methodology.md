# Calculation methodology (engine v0.2, `backend/src/financial-engine`)

All money uses Decimal.js (40-digit precision); outputs are rounded to 2 dp only at the boundary. The engine is deterministic and
unit-tested three ways: reference-plan golden tests, an independent plain-number re-implementation, and invariants over 300 random clients.

| Topic | Rule |
|---|---|
| Plan year | Remaining current year = months left (incl. plan month) / 12. Inflation counts from the first full year after the plan date (reference plan: 2012 plan inflates from 2013). |
| Age | Exact, using the birthday on the plan date. Retirement year = birth year + retirement age. |
| Salary | Fixed pay = CTC − bonus. Growth g applies from the increment month m: next year = fixed × (1 + g × (13−m)/12), then × (1+g) a year. Bonus (month b, default April) is counted in the plan year only if not yet paid; then grows at g. |
| Tax | Entered effective % of CTC, scaled with fixed pay; if blank, new-regime slabs FY2025-26 + 4% cess (assumption, compliance to confirm). Plan year is pro-rated. |
| Expenses | Household grows at household inflation; school fees at education inflation until the stated year; growth also starts from the increment month. Big-ticket annual items are added to household. |
| Loans | Outstanding (if blank) = EMI × (1 − (1+r)^−n)/r, r = rate/12. EMIs counted from the first-EMI date. Planned goal loan EMI = P·r(1+r)^n/((1+r)^n−1). |
| Policies | Premiums stop after the premium term. Policies on "others" are excluded and flagged. Unit-linked/pension maturity (if blank) = fund×(1+r)^t + premium annuity (r = balanced return). |
| Goals | FV = PV × (1+i)^(year − base year). A date-range goal's amount is a total spread over the years unless "per occurrence". Goals before the plan year are ignored with a warning. |
| Portfolio | Horizon < 3 y: 60% cash / 40% debt. 3–7 y: equity = ½ band ceiling. > 7 y: full ceiling. Return = weighted class returns. |
| Funding order | Emergency (cash only) → priority order → retirement last. Assets applied in this order: grown at their own rate to maturity, valued at the goal portfolio return; policy maturities and gratuity are reserved for retirement. Then planned loans, then annual surplus scaled to cover the remaining present-value need. No asset or surplus rupee is used twice (tested). |
| Provident fund | Balance × (1+8%)^t + contributions credited mid-year from next year to retirement, growing with the salary schedule. |
| Retirement | Corpus = Σ (expense − other income) discounted at the retirement portfolio return; need = corpus − PF at retirement; readiness = (PF + funded gap) / corpus. |
| Insurance need | (A) PV of survivor living expenses (70%) to the earner's retirement + (B) PV of education and marriage goals + (C) PV of survivor retirement expenses to the spouse's life expectancy + (D) debt − liquid, financial and retirement assets; discounted at the debt return. Cover held = the earner's own policies. |
| Surplus table | Per year: available − Σ goal draws, carried forward. Closes exactly (tested). |

## Known differences from the reference plan
- Life cover need: Rs 3.60 crore vs 3.53 crore (+2%); components differ because the reference method is not documented. Survivor-living component matches within 0.15%.
- Reference liabilities (Rs 1,50,000) cannot be traced to any input.
- Reference savings (3,55,000) differ from the data gathering sheet (2,50,000); the plan is used as golden source.
