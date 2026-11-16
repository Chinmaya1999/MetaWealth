import Decimal from "decimal.js";
import { D } from "@mwc/financial-formulas";

/** NRI remittance planner. Pure and deterministic.
 *  - FX path: rate_t = rate_0 * (1 + d)^(t/12), d = assumed annual INR depreciation.
 *  - Monthly remittance R (foreign currency) is converted at rate_t and invested in INR at annual return r (monthly compounding).
 *  - Corpus = sum over t=1..n of R*rate_t*(1+rm)^(n-t), rm = (1+r)^(1/12)-1 (end-of-month remittance). */
export interface NriInput { currency: string; fxRate: number; inrDepreciationPct: number; monthlyRemittance?: number; targetInr?: number; years: number; returnPct: number; existingInr?: number }
export interface NriResult { currency: string; months: number; fxAtEnd: number; corpusInr: number; corpusInForeign: number; totalRemitted: number; totalRemittedInr: number; gain: number; requiredMonthlyRemittance: number | null; shortfallInr: number | null; yearly: { year: number; fx: number; remittedInr: number; corpusInr: number }[] }
const r2 = (x: Decimal) => x.toDecimalPlaces(2).toNumber();

export function nriPlan(i: NriInput): NriResult {
  const n = Math.round(i.years * 12); if (n < 1 || n > 600) throw new Error("years must be between 1 and 50");
  if (!(i.fxRate > 0)) throw new Error("fxRate must be positive");
  const d = D(i.inrDepreciationPct).div(100), rm = D(1).plus(D(i.returnPct).div(100)).pow(D(1).div(12)).minus(1);
  const fx = (t: number) => D(i.fxRate).mul(D(1).plus(d).pow(D(t).div(12)));
  const R = D(i.monthlyRemittance ?? 0), grow = (t: number) => D(1).plus(rm).pow(n - t);
  let corpus = D(i.existingInr ?? 0).mul(D(1).plus(rm).pow(n)), unit = D(0), totalInr = D(0);
  const yearly: NriResult["yearly"] = []; let run = D(i.existingInr ?? 0), yr = D(0);
  for (let t = 1; t <= n; t++) {
    const rate = fx(t); const inr = R.mul(rate); corpus = corpus.plus(inr.mul(grow(t))); unit = unit.plus(rate.mul(grow(t))); totalInr = totalInr.plus(inr);
    run = run.mul(D(1).plus(rm)).plus(inr); yr = yr.plus(inr);
    if (t % 12 === 0 || t === n) { yearly.push({ year: Math.ceil(t / 12), fx: r2(rate), remittedInr: r2(yr), corpusInr: r2(run) }); yr = D(0); }
  }
  const total = R.mul(n); const end = fx(n);
  const need = i.targetInr != null ? D(i.targetInr).minus(D(i.existingInr ?? 0).mul(D(1).plus(rm).pow(n))) : null;
  const req = need ? (need.lte(0) ? D(0) : need.div(unit)) : null;
  return { currency: i.currency, months: n, fxAtEnd: r2(end), corpusInr: r2(corpus), corpusInForeign: r2(corpus.div(end)), totalRemitted: r2(total), totalRemittedInr: r2(totalInr), gain: r2(corpus.minus(totalInr).minus(i.existingInr ?? 0)),
    requiredMonthlyRemittance: req ? r2(req) : null, shortfallInr: i.targetInr != null ? r2(D(i.targetInr).minus(corpus)) : null, yearly };
}

/** Informational guidance only; tax and FEMA rules change, so every item must be confirmed with a qualified adviser. */
export const NRI_GUIDE = {
  accounts: [
    { type: "NRE", use: "Remit foreign earnings to India", tax: "Interest is tax-free in India", repatriation: "Fully repatriable (principal and interest)" },
    { type: "NRO", use: "Hold Indian income such as rent, dividends, pension", tax: "Interest taxable in India (TDS applies)", repatriation: "Up to USD 1 million per financial year after paying tax, with Form 15CA/15CB" },
    { type: "FCNR (B)", use: "Foreign-currency fixed deposit", tax: "Interest is tax-free in India", repatriation: "Fully repatriable; no exchange-rate risk for the depositor" },
  ],
  countries: {
    USD: ["US tax residents report worldwide income and foreign accounts (FBAR/FATCA).", "Indian mutual funds are usually PFICs for the IRS; prefer US-domiciled or GIFT City funds.", "India-US DTAA helps avoid double tax; claim foreign tax credit."],
    AED: ["The UAE has no personal income tax, so Indian-source income is the main tax to plan for.", "Keep NRE/NRO structure clean; document source of remittances."],
    GBP: ["UK residents are taxed on worldwide income; check the India-UK DTAA and remittance basis rules.", "Indian mutual funds are reporting vs non-reporting funds in the UK; check status."],
    SGD: ["Singapore taxes only Singapore-sourced income, but Indian income stays taxable in India.", "India-Singapore DTAA applies on dividends, interest and capital gains."],
  } as Record<string, string[]>,
  general: ["NRIs cannot invest in PPF or buy agricultural land; NPS is allowed.", "Mutual fund KYC and FATCA forms are needed. Some AMCs restrict US/Canada residents.", "TDS on NRI capital gains is higher than for residents; file an Indian return to claim refunds.", "Keep your residential status under review: it is decided by days spent in India each year."],
};
