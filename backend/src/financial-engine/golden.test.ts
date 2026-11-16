import { describe, it, expect } from "vitest";
import { runEngine } from "./engine";
import { SHEET_2012, GOLDEN_ASSUMPTIONS, GOLDEN_PLAN_DATE } from "./sheet2012";
import { calculateEmi } from "@mwc/financial-formulas";

const r = runEngine(SHEET_2012, GOLDEN_ASSUMPTIONS, GOLDEN_PLAN_DATE);
const near = (a: number, b: number, tol = 1000) => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(tol);
const goal = (n: string) => r.goals.find((g: any) => g.name === n);

describe("golden: reference plan dated 1 Sep 2012 (financial data only)", () => {
  it("risk 28 Balanced", () => { expect(r.risk.score).toBe(28); expect(r.risk.band).toBe("Balanced"); });
  it("remaining-year income, taxes, living", () => {
    near(r.cashflow.remainingCurrentYear.income, 1_049_760); // sample 1,049,760
    near(r.cashflow.remainingCurrentYear.taxes, 233_333);
    near(r.cashflow.remainingCurrentYear.livingExpenses, 389_000);
  });
  it("next-year income, taxes, living, PF", () => {
    near(r.cashflow.nextYear.income, 3_770_476, 1500); // 3,385,476 fixed + 385,000 variable
    near(r.cashflow.nextYear.taxes, 752_500, 1000);
    near(r.cashflow.nextYear.livingExpenses, 1_238_820, 1000);
    near(r.cashflow.nextYear.committedSavingsPF, 225_260, 600);
  });
  it("net worth assets match exactly", () => near(r.netWorth.assets, 102_587_680, 1));
  it("goal values in goal year", () => {
    near(goal("House Purchase").futureValue, 18_509_302);
    near(goal("Syona Marriage").futureValue, 4_387_891);
    near(goal("Vacation with Parents").futureValue, 420_000);
    near(goal("Capital For Business").futureValue, 629_856);
    near(goal("Second Child Marriage").futureValue, 5_600_184);
  });
  it("house loan EMI", () => near(calculateEmi(9_700_000, 10, 156) .result as unknown as number, 111_341, 5));
  it("FD grows to its maturity date (sample 58,139)", () => {
    const u = r.goals.flatMap((g: any) => g.fromAssets).find((a: any) => a.asset.includes("Overseas"));
    near(u.amount, 58_139, 700);
  });
  it("provident fund at retirement within 0.1% of sample 3,67,46,221", () => near(r.retirement.pfAtRetirement, 36_746_221, 36_746_221 * 0.001));
  it("ages on 1 Sep 2012 use the birthday (self 32)", () => { expect(r.meta.clientAge).toBe(32); });
  it("cover held by self = 12,00,000", () => near(r.insurance.coverHeld, 1_200_000, 1));
  it("life cover need within 3% of the sample's Rs 3,53,20,127 (method v0.3, components differ)", () => near(r.insurance.coverRequired, 35_320_127, 35_320_127 * 0.03));
  it("survivor living expenses + school match the sample's 1,45,24,701 + 19,29,207 within 1%", () => near(r.insurance.survivorExpensesPV, 14_524_701 + 1_929_207, 16_453_908 * 0.01));
  it("retirement year 2034, end 2059", () => { expect(r.retirement.retirementYear).toBe(2034); expect(r.retirement.endYear).toBe(2059); });
});
