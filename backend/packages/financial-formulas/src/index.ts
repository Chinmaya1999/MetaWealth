import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const D = (v: Decimal.Value) => new Decimal(v);

export interface CalcResult<T> {
  result: T;
  methodology: string;
  inputs: Record<string, unknown>;
  warnings: string[];
  calculationVersion: string;
}
export const CALC_VERSION = "0.1.0";

/** Future value of a one-time goal: PV x (1+i)^n */
export function calculateInflationAdjustedGoal(
  presentValue: Decimal.Value,
  inflationRatePct: Decimal.Value,
  years: number
): CalcResult<string> {
  const warnings: string[] = [];
  if (years < 0) warnings.push("Goal year is before the base year; no inflation applied.");
  const n = Math.max(0, years);
  const fv = D(presentValue).mul(D(1).plus(D(inflationRatePct).div(100)).pow(n));
  return {
    result: fv.toFixed(2),
    methodology: "FV = PV x (1 + inflation)^years",
    inputs: { presentValue: String(presentValue), inflationRatePct: String(inflationRatePct), years },
    warnings,
    calculationVersion: CALC_VERSION,
  };
}

/** Standard reducing-balance EMI. Rate is annual percent. */
export function calculateEmi(principal: Decimal.Value, annualRatePct: Decimal.Value, months: number): CalcResult<string> {
  const P = D(principal);
  const r = D(annualRatePct).div(1200);
  const warnings: string[] = [];
  let emi: Decimal;
  if (months <= 0) { emi = D(0); warnings.push("Tenure must be positive."); }
  else if (r.isZero()) emi = P.div(months);
  else {
    const f = D(1).plus(r).pow(months);
    emi = P.mul(r).mul(f).div(f.minus(1));
  }
  return {
    result: emi.toFixed(2),
    methodology: "EMI = P r (1+r)^n / ((1+r)^n - 1), r = annual rate / 12",
    inputs: { principal: String(principal), annualRatePct: String(annualRatePct), months },
    warnings,
    calculationVersion: CALC_VERSION,
  };
}

export type RiskBand = "Conservative" | "Moderately Conservative" | "Balanced" | "Growth" | "Aggressive";

export interface RiskBandConfig { min: number; max: number; band: RiskBand; goalEquityCeiling: number; wealthEquityCeiling: number }

/** BRD section 5 defaults. Administrator-configurable in production. */
export const DEFAULT_RISK_BANDS: RiskBandConfig[] = [
  { min: 10, max: 16, band: "Conservative", goalEquityCeiling: 20, wealthEquityCeiling: 40 },
  { min: 17, max: 22, band: "Moderately Conservative", goalEquityCeiling: 35, wealthEquityCeiling: 55 },
  { min: 23, max: 28, band: "Balanced", goalEquityCeiling: 50, wealthEquityCeiling: 70 },
  { min: 29, max: 34, band: "Growth", goalEquityCeiling: 65, wealthEquityCeiling: 85 },
  { min: 35, max: 40, band: "Aggressive", goalEquityCeiling: 80, wealthEquityCeiling: 100 },
];

export function calculateRiskProfile(answers: number[], bands = DEFAULT_RISK_BANDS): CalcResult<{ score: number; band: RiskBandConfig }> {
  if (answers.length !== 10 || answers.some((a) => !Number.isInteger(a) || a < 1 || a > 4)) {
    throw new Error("Risk profiler needs exactly 10 answers, each scored 1 to 4.");
  }
  const score = answers.reduce((s, a) => s + a, 0);
  const band = bands.find((b) => score >= b.min && score <= b.max)!;
  return { result: { score, band }, methodology: "Sum of ten answers (1-4); mapped via configured bands", inputs: { answers }, warnings: [], calculationVersion: CALC_VERSION };
}

/** BRD RP-04: <3y cash/debt only; 3-7y half the ceiling; >7y full ceiling. Returns equity % allowed. */
export function equityCeilingForHorizon(goalEquityCeiling: number, horizonYears: number): number {
  if (horizonYears < 3) return 0;
  if (horizonYears <= 7) return goalEquityCeiling / 2;
  return goalEquityCeiling;
}
