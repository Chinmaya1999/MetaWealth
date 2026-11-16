import { describe, it, expect } from "vitest";
import { calculateInflationAdjustedGoal, calculateRiskProfile, calculateEmi, equityCeilingForHorizon } from "./index";

describe("golden: reference plan (BRD section 13)", () => {
  // The reference plan inflates from the first full year after the plan date (2013), not from 2012.
  it("house purchase 2021 @8%: Rs 1,85,09,302", () => {
    const r = calculateInflationAdjustedGoal(10_000_000, 8, 2021 - 2013);
    expect(Number(r.result)).toBeCloseTo(18_509_302, -3);
  });
  it("daughter marriage 2035 @5%: Rs 43,87,891", () => {
    const r = calculateInflationAdjustedGoal(1_500_000, 5, 2035 - 2013);
    expect(Math.abs(Number(r.result) - 4_387_891)).toBeLessThan(1000);
  });
  it("business capital 2016 @8%: Rs 6,29,856", () => {
    const r = calculateInflationAdjustedGoal(500_000, 8, 3);
    expect(Math.abs(Number(r.result) - 629_856)).toBeLessThan(1000);
  });
  it("house loan Rs 97 lakh, 156 months @10%: EMI ~ 1,11,341", () => {
    const r = calculateEmi(9_700_000, 10, 156);
    expect(Math.abs(Number(r.result) - 111_341)).toBeLessThan(5);
  });
  it("reference client scores 28 -> Balanced", () => {
    const r = calculateRiskProfile([3, 3, 3, 2, 3, 4, 1, 3, 3, 3]);
    expect(r.result.score).toBe(28);
    expect(r.result.band.band).toBe("Balanced");
  });
  it("horizon equity rules", () => {
    expect(equityCeilingForHorizon(50, 2)).toBe(0);
    expect(equityCeilingForHorizon(50, 5)).toBe(25);
    expect(equityCeilingForHorizon(50, 12)).toBe(50);
  });
});
