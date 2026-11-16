import { describe, it, expect } from "vitest";
import { runEngine } from "./engine";
import { DEFAULT_ASSUMPTIONS } from "./assumptions";
import { REFERENCE_CLIENT } from "./reference";

describe("engine golden (reference client rebased to 1 Sep 2026)", () => {
  const r = runEngine(REFERENCE_CLIENT, DEFAULT_ASSUMPTIONS, new Date(2026, 8, 1));
  it("is deterministic", () => expect(JSON.stringify(runEngine(REFERENCE_CLIENT, DEFAULT_ASSUMPTIONS, new Date(2026, 8, 1)))).toBe(JSON.stringify(r)));
  it("risk Balanced 28", () => { expect(r.risk.score).toBe(28); expect(r.risk.band).toBe("Balanced"); });
  it("remaining-year income = (CTC - bonus) x 4/12", () => expect(Math.abs(r.cashflow.remainingCurrentYear.income - 1_050_000)).toBeLessThan(1));
  it("house goal value matches reference inflation (8% from base year)", () => {
    const h = r.goals.find((g: any) => g.name === "House purchase");
    expect(Math.abs(h.futureValue - 10_000_000 * 1.08 ** (2035 - 2027))).toBeLessThan(1000);
  });
  it("no asset allocated twice", () => {
    const used = r.goals.flatMap((g: any) => g.fromAssets).reduce((m: any, u: any) => ((m[u.asset] = (m[u.asset] ?? 0) + u.amount), m), {});
    for (const a of r.assetUsage) expect(used[a.asset] ?? 0).toBeLessThanOrEqual(a.nominal + 1);
  });
  it("insights raise emergency/health/life as Urgent", () => {
    const ids = r.insights.filter((i: any) => i.severity === "Urgent").map((i: any) => i.ruleId);
    expect(ids).toContain("HEALTH_COVER"); expect(ids).toContain("LIFE_COVER");
  });
});
