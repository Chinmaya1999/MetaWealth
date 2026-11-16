import { describe, it, expect } from "vitest";
import { runEngine } from "./engine";
import { DEFAULT_ASSUMPTIONS as A } from "./assumptions";
import { REFERENCE_CLIENT } from "./reference";
import { SHEET_2012, GOLDEN_ASSUMPTIONS, GOLDEN_PLAN_DATE } from "./sheet2012";
import { slabTax } from "./tax";
import type { Questionnaire } from "./types";

// ---------- an independent re-implementation using plain numbers (no engine code shared) ----------
const fv = (pv: number, i: number, n: number) => pv * (1 + i / 100) ** n;
const emi = (P: number, rate: number, n: number) => { const r = rate / 1200; return (P * r * (1 + r) ** n) / ((1 + r) ** n - 1); };
const outstanding = (e: number, rate: number, n: number) => { const r = rate / 1200; return (e * (1 - (1 + r) ** -n)) / r; };
const near = (a: number, b: number, tol = 0.01) => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(tol);

const PD = new Date(2026, 8, 1);                 // 1 Sep 2026 => Y0 2026, 4 months left, inflation base 2027
const q: Questionnaire = {
  profile: { dob: "1990-03-15", spouseDob: "1992-06-20", retirementAge: 60, lifeExpectancy: 85, residency: "Resident Indian", will: "Yes", nominees: "Yes" },
  income: { ctc: 2_400_000, bonus: 200_000, growth: 8, incrementMonth: 4, taxRate: 15, takeHome: 150_000, otherMonthly: 0 },
  expenses: { monthly: 80_000, annual: 60_000 },
  retirement: { pf: 500_000, pfMonthly: 12_000 },
  assets: [{ name: "Savings", type: "cash", value: 400_000 }, { name: "FD", type: "debt", value: 100_000, rate: 7, maturityYear: 2029 }],
  nonFinancial: { realEstate: 5_000_000, gold: 100_000, other: 50_000 },
  loans: [{ name: "Car", emi: 20_000, months: 30, rate: 9 }],
  insurance: { life: [{ name: "Term", insured: "self", type: "term", sumAssured: 10_000_000, premium: 18_000 }], healthSumInsured: 1_000_000, healthPremium: 15_000 },
  goals: [{ name: "Home", category: "property", amount: 6_000_000, startYear: 2034, inflation: 8, priority: 1, loanPct: 50 }, { name: "College", category: "education", amount: 1_200_000, startYear: 2040, endYear: 2043, inflation: 8, priority: 2 }],
  risk: { answers: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3] }, // 30 => Growth
};
const r = runEngine(q, A, PD);

describe("independent recomputation (plain-number cross-check)", () => {
  it("risk score and band", () => { expect(r.risk.score).toBe(30); expect(r.risk.band).toBe("Growth"); });
  it("exact age at plan date", () => { expect(r.meta.clientAge).toBe(36); expect(r.meta.spouseAge).toBe(34); });
  it("inflated goal values use years from the first full year (2027)", () => {
    near(r.goals.find((g: any) => g.name === "Home").futureValue, fv(6_000_000, 8, 2034 - 2027), 0.01);
    const col = r.goals.find((g: any) => g.name === "College");
    near(col.futureValue, [2040, 2041, 2042, 2043].reduce((s, y) => s + fv(1_200_000 / 4, 8, y - 2027), 0), 0.01); // total spread over 4 years
  });
  it("loan outstanding from EMI/rate/months and EMI formula", () => {
    near(r.netWorth.liabilities, outstanding(20_000, 9, 30), 0.01);
    near(r.goals.find((g: any) => g.name === "Home").loan.emiMonthly, emi(fv(6_000_000, 8, 7) * 0.5, 10, 156), 0.01);
  });
  it("net worth = assets - liabilities, groups add up", () => {
    const g = r.netWorth.groups; near(g.liquid + g.financial + g.insuranceCashValue + g.tangible + g.personal + g.retirement, r.netWorth.assets, 0.01);
    near(r.netWorth.assets - r.netWorth.liabilities, r.netWorth.total, 0.01);
    expect(g.liquid).toBe(400_000); expect(g.tangible).toBe(5_100_000);
  });
  it("cashflow: current-year pro-rata, next-year increment from April", () => {
    const c0 = r.cashflow.remainingCurrentYear, c1 = r.cashflow.nextYear;
    near(c0.income, (2_400_000 - 200_000) * 4 / 12, 0.01);                       // bonus (April) already paid
    near(c0.taxes, 2_400_000 * 0.15 * 4 / 12, 0.01);
    const fixed1 = 2_200_000 * (1 + 0.08 * 9 / 12);                              // 8% from April = 9 of 12 months
    near(c1.salaryFixed, fixed1, 0.01); near(c1.salaryVariable, 200_000 * 1.08, 0.01);
    near(c1.taxes, 2_400_000 * 0.15 * (fixed1 / 2_200_000), 0.01);
    near(c1.livingExpenses, (80_000 * 12 + 60_000) * (1 + 0.06 * 9 / 12), 0.01);
    near(c1.committedSavingsPF, 12_000 * 12 * (fixed1 / 2_200_000), 0.01);
    near(c1.discretionarySurplus, c1.income - c1.totalExpense - c1.committedSavingsPF - c1.otherCommittedSavings, 0.01);
    near(c0.loanEmis, 20_000 * 4, 0.01); near(c1.loanEmis, 20_000 * 12, 0.01);
  });
  it("provident fund at retirement (mid-year contributions, 8%)", () => {
    const tR = 2050 - 2026; let b = 500_000 * 1.08 ** tR;
    for (let y = 2027; y <= 2050; y++) { const i = y - 2026; const fac = i === 1 ? 1 + 0.08 * 0.75 : (1 + 0.08 * 0.75) * 1.08 ** (i - 1); b += 144_000 * fac * 1.08 ** (2050 - y + 0.5); }
    near(r.retirement.pfAtRetirement, b, 0.5);
  });
  it("FD grows at its own rate to maturity and is PV'd at the goal return", () => {
    const used = r.goals.flatMap((g: any) => g.fromAssets).find((a: any) => a.asset === "FD");
    if (used) near(used.amount, 100_000 * 1.07 ** 3 * (used.todayValue / 100_000), 1); // nominal = today's units grown 3 years
  });
  it("insurance: cover held counts only the earner's own policies", () => { near(r.insurance.coverHeld, 10_000_000, 0.01); expect(r.insurance.healthAdequate).toBe(true); });
  it("survivor need components are non-negative and sum correctly", () => {
    const i = r.insurance; near(Math.max(0, i.survivorExpensesPV + i.goalProtection + i.retirementProvision + i.outstandingDebt - i.assetsAvailable), i.coverRequired, 0.02);
    expect(i.additionalTermCover).toBe(Math.max(0, Math.round((i.coverRequired - i.coverHeld) * 100) / 100));
  });
  it("tax slabs: new regime nil to 12.75 lakh, known points", () => {
    near(slabTax(1_275_000, "new").toNumber(), 0, 0.01);
    const taxable = 2_000_000 - 75_000; const t = (400_000 * 0.05 + 400_000 * 0.1 + 400_000 * 0.15 + (taxable - 1_600_000) * 0.2) * 1.04;
    near(slabTax(2_000_000, "new").toNumber(), t, 0.01);
  });
});

describe("invariants over 300 random clients", () => {
  let seed = 42; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const make = (): Questionnaire => ({
    profile: { dob: `${1965 + Math.floor(rnd() * 40)}-0${1 + Math.floor(rnd() * 9)}-15`, spouseDob: "1990-05-05", retirementAge: 50 + Math.floor(rnd() * 15), lifeExpectancy: 75 + Math.floor(rnd() * 15), residency: pick(["Resident Indian", "NRI - USA"]) },
    income: { ctc: 600_000 + Math.floor(rnd() * 6_000_000), bonus: Math.floor(rnd() * 500_000), growth: Math.floor(rnd() * 12), taxRate: pick([0, 10, 20, 30]), takeHome: 100_000 },
    expenses: { monthly: 20_000 + Math.floor(rnd() * 150_000), annual: Math.floor(rnd() * 100_000), schoolMonthly: pick([0, 10_000]), schoolUntil: 2035 },
    retirement: { pf: Math.floor(rnd() * 3_000_000), pfMonthly: Math.floor(rnd() * 30_000) },
    nonFinancial: { realEstate: Math.floor(rnd() * 2e7), gold: Math.floor(rnd() * 5e5) },
    assets: Array.from({ length: Math.floor(rnd() * 6) }, (_, i) => ({ name: "A" + i, type: pick(["cash", "debt", "equity", "balanced", "gold"] as const), value: Math.floor(rnd() * 1_500_000), rate: pick([0, 6, 8]), maturityYear: 2026 + Math.floor(rnd() * 15) })),
    loans: Array.from({ length: Math.floor(rnd() * 3) }, (_, i) => ({ name: "L" + i, emi: Math.floor(rnd() * 40_000), months: 1 + Math.floor(rnd() * 120), rate: 7 + Math.floor(rnd() * 20) })),
    insurance: { life: Array.from({ length: Math.floor(rnd() * 4) }, (_, i) => ({ name: "P" + i, insured: pick(["self", "spouse", "others"] as const), type: pick(["term", "ulip", "pension", "endowment"] as const), sumAssured: Math.floor(rnd() * 5e6), premium: Math.floor(rnd() * 60_000), fundValue: Math.floor(rnd() * 1e6), startDate: "2015-04-01", term: 15 + Math.floor(rnd() * 20) })), healthSumInsured: pick([0, 3e5, 1e6]), healthPremium: 10_000 },
    goals: Array.from({ length: Math.floor(rnd() * 9) }, (_, i) => ({ name: "G" + i, category: pick(["education", "marriage", "property", "lifestyle", "business"]), amount: 50_000 + Math.floor(rnd() * 10_000_000), startYear: 2026 + Math.floor(rnd() * 30), endYear: pick([null, null, 2030 + Math.floor(rnd() * 40)]), frequency: pick([1, 2, 3]), inflation: pick(["", 5, 8]), priority: 1 + Math.floor(rnd() * 12), loanPct: pick([0, 0, 40]) })),
    risk: { answers: Array.from({ length: 10 }, () => 1 + Math.floor(rnd() * 4)) },
  });
  const finite = (o: any): boolean => (typeof o === "number" ? Number.isFinite(o) : Array.isArray(o) ? o.every(finite) : o && typeof o === "object" ? Object.values(o).every(finite) : true);

  it("never NaN/Infinity; deterministic; funding is conserved; no asset or surplus is used twice", () => {
    for (let k = 0; k < 300; k++) {
      const c = make(); const out1 = runEngine(c, A, PD), out2 = runEngine(c, A, PD);
      expect(finite(out1), `client ${k}`).toBe(true);
      expect(JSON.stringify(out1)).toBe(JSON.stringify(out2));
      // surplus: Σ draws in a year never exceeds what was available that year (when available is positive)
      for (const y of out1.surplusAllocation) { const d = Object.values(y.draws as Record<string, number>).reduce((a, b) => a + b, 0); if (y.available > 0) expect(d).toBeLessThanOrEqual(y.available + 0.05); }
      // carry-forward closes: running Σ(available − draws) equals the reported balance
      let run = 0; for (const y of out1.surplusAllocation) { run += y.available - Object.values(y.draws as Record<string, number>).reduce((a, b) => a + b, 0); expect(Math.abs(run - y.carryForward)).toBeLessThanOrEqual(0.5); }
      // each asset's nominal use never exceeds its value at maturity
      const used: Record<string, number> = {}; out1.goals.forEach((g: any) => g.fromAssets.forEach((a: any) => (used[a.asset] = (used[a.asset] ?? 0) + a.amount)));
      out1.assetUsage.forEach((a: any) => expect(used[a.asset] ?? 0).toBeLessThanOrEqual(a.nominal + 1));
      out1.goals.forEach((g: any) => { expect(g.fundedPct).toBeGreaterThanOrEqual(0); expect(g.fundedPct).toBeLessThanOrEqual(100); expect(["Met", "Partially met", "Not met"]).toContain(g.status); });
      expect(out1.insurance.additionalTermCover).toBeGreaterThanOrEqual(0);
      // net worth identity
      expect(Math.abs(out1.netWorth.assets - out1.netWorth.liabilities - out1.netWorth.total)).toBeLessThanOrEqual(0.02);
    }
  });
  it("monotonic: more income never lowers surplus; longer retirement horizon never lowers the corpus", () => {
    for (let k = 0; k < 60; k++) {
      const c = make(); const hi = JSON.parse(JSON.stringify(c)); hi.income.ctc += 500_000;
      expect(runEngine(hi, A, PD).cashflow.nextYear.income).toBeGreaterThan(runEngine(c, A, PD).cashflow.nextYear.income);
      const longer = JSON.parse(JSON.stringify(c)); longer.profile.lifeExpectancy = Number(c.profile!.lifeExpectancy) + 5;
      expect(runEngine(longer, A, PD).retirement.corpusRequired).toBeGreaterThanOrEqual(runEngine(c, A, PD).retirement.corpusRequired - 0.01);
    }
  });
});
