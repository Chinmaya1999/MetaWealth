import Decimal from "decimal.js";
import { D, calculateRiskProfile, equityCeilingForHorizon, DEFAULT_RISK_BANDS, CALC_VERSION, type RiskBandConfig } from "@mwc/financial-formulas";
import type { Assumptions } from "./assumptions";
import type { Questionnaire, Goal } from "./types";
import { slabTax } from "./tax";

export const ENGINE_VERSION = `engine-${CALC_VERSION}.2`;
const N = (v: unknown) => D(v === "" || v == null || Number.isNaN(Number(v)) ? 0 : (v as Decimal.Value));
const out = (d: Decimal) => d.toDecimalPlaces(2).toNumber();
const pvf = (amt: Decimal, r: Decimal, t: number) => amt.div(D(1).plus(r).pow(Math.max(0, t)));
const pct = (x: number) => D(x).div(100);
const yearOf = (s?: string | null) => (s ? new Date(s).getFullYear() : NaN);
const yearsBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / (365.25 * 86400_000);

export interface EngineResult { [k: string]: any }

export function runEngine(q: Questionnaire, A: Assumptions, planDate = new Date()): EngineResult {
  const warnings: string[] = [];
  const Y0 = planDate.getFullYear();
  const baseYear = Y0 + 1; // reference plan inflates from the first full year after the plan date
  const monthsLeft = 12 - planDate.getMonth();
  const f = D(monthsLeft).div(12);
  const est: any = (q as any).estate ?? {};
  const pr = { ...(q.profile ?? {}), will: est.will ?? q.profile?.will, nominees: est.nominees ?? q.profile?.nominees } as NonNullable<Questionnaire["profile"]>;
  const inc = q.income ?? {}, ex = q.expenses ?? {}, rt = q.retirement ?? {}, nf = q.nonFinancial ?? {}, ins = q.insurance ?? {};
  const birthYear = pr.dob ? new Date(pr.dob).getFullYear() : Y0 - 35;
  const exactAge = (dob: string) => { const d = new Date(dob); let a = planDate.getFullYear() - d.getFullYear(); if (planDate < new Date(planDate.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
  const age = pr.dob ? exactAge(pr.dob) : Y0 - birthYear;
  const spouseAge = pr.spouseDob ? exactAge(pr.spouseDob) : null;
  const retAge = Number(pr.retirementAge) || 60;
  const life = Number(pr.lifeExpectancy) || A.lifeExpectancy;
  const retYear = birthYear + retAge, endYear = birthYear + life;
  if (retAge <= age) warnings.push("Retirement age is not after current age.");

  // ---- risk
  const answers = q.risk?.answers;
  let risk: any = null; let band: RiskBandConfig = DEFAULT_RISK_BANDS[2];
  if (answers?.length === 10 && answers.every((a) => Number.isInteger(+a) && +a >= 1 && +a <= 4)) {
    const rp = calculateRiskProfile(answers.map(Number));
    band = rp.result.band; risk = { score: rp.result.score, band: band.band, goalEquityCeiling: band.goalEquityCeiling, wealthEquityCeiling: band.wealthEquityCeiling, overridden: false, answers: answers.map(Number) };
    const ov = q.risk?.override;
    if (ov?.reason) {
      const idx = DEFAULT_RISK_BANDS.findIndex((b) => b.band === ov.band), cur = DEFAULT_RISK_BANDS.indexOf(band);
      if (idx >= 0 && Math.abs(idx - cur) === 1) { band = DEFAULT_RISK_BANDS[idx]; risk = { ...risk, band: band.band, goalEquityCeiling: band.goalEquityCeiling, wealthEquityCeiling: band.wealthEquityCeiling, overridden: true, overrideReason: ov.reason, computedBand: DEFAULT_RISK_BANDS[cur].band }; }
      else warnings.push("Risk override ignored: must be exactly one band above or below the computed band.");
    }
  } else warnings.push("Risk profile not completed; Balanced band assumed.");

  const R = A.returns;
  const mixFor = (h: number) => {
    const eq = D(equityCeilingForHorizon(band.goalEquityCeiling, h)).div(100);
    const cash = h < 3 ? D(0.6) : D(0.1);
    const debt = D(1).minus(eq).minus(cash);
    return { cash, debt, large: eq.mul(0.4), diversified: eq.mul(0.45), balanced: eq.mul(0.15) };
  };
  const retOfMix = (m: ReturnType<typeof mixFor>) => (Object.keys(m) as (keyof typeof m)[]).reduce((s, k) => s.plus(m[k].mul(pct(R[k as keyof typeof R]))), D(0));

  // ---- income
  const ctc = N(inc.ctc), bonus = N(inc.bonus), fixedBase = Decimal.max(0, ctc.minus(bonus)), otherY = N(inc.otherMonthly).mul(12);
  const g = pct(Number(inc.growth) || 0), hi = pct(A.inflation.household), edu = pct(A.inflation.education);
  const incM = Math.min(12, Math.max(1, Number(inc.incrementMonth) || 4));
  const incFrac = D(13 - incM).div(12);
  // growth takes effect from the increment month (April by default), as in the reference plan: year 1 gets g x (months left)/12
  const grow = (rate: Decimal, i: number) => i === 0 ? D(1) : D(1).plus(rate.mul(incFrac)).mul(D(1).plus(rate).pow(i - 1));
  const fixedFor = (i: number) => fixedBase.mul(grow(g, i));
  const bonusMonth = Math.min(12, Math.max(1, Number(inc.bonusMonth) || 4));
  const bonusDueThisYear = bonusMonth - 1 >= planDate.getMonth(); // bonus not yet received in the plan year
  const bonusFor = (i: number) => i === 0 ? (bonusDueThisYear ? bonus : D(0)) : bonus.mul(D(1).plus(g).pow(i));
  const taxPct = pct(Number(inc.taxRate) || 0);
  const autoTax = !(Number(inc.taxRate) > 0);
  const taxFor = (i: number) => {
    if (autoTax) return slabTax(fixedFor(i).plus(i === 0 ? bonus : bonusFor(i)), "new").mul(i === 0 ? f : 1); // annual tax on annual pay; the plan year is pro-rated
    return fixedBase.gt(0) ? ctc.mul(taxPct).mul(fixedFor(i).div(fixedBase)).mul(i === 0 ? f : 1) : D(0);
  };
  const pfY = N(rt.pfMonthly).mul(12), commY = N(inc.committedSavingsMonthly).mul(12);

  // ---- expenses
  const livingM = N(ex.monthly), schoolM = N(ex.schoolMonthly), schoolUntil = Number(ex.schoolUntil) || 0;
  const hasSchool = schoolM.gt(0) && schoolUntil > 0;
  const otherLivingY = livingM.minus(hasSchool ? schoolM : 0).mul(12).plus(N(ex.annual));
  const livingFor = (i: number) => {
    const fr = i === 0 ? f : D(1);
    let v = otherLivingY.mul(grow(hi, i)).mul(fr);
    if (hasSchool && Y0 + i <= schoolUntil) v = v.plus(schoolM.mul(12).mul(grow(edu, i)).mul(fr));
    return v;
  };

  // ---- loans
  const loans = (q.loans ?? []).map((l) => {
    const rate = N(l.rate).div(1200), emi = N(l.emi), months = Number(l.months) || 0;
    const start = l.startDate ? new Date(l.startDate) : null;
    const delay = start ? Math.max(0, (start.getFullYear() - Y0) * 12 + start.getMonth() - planDate.getMonth()) : 0; // months until first EMI
    let out_ = N(l.outstanding);
    if (out_.isZero() && emi.gt(0) && months > 0 && delay === 0) out_ = rate.isZero() ? emi.mul(months) : emi.mul(D(1).minus(D(1).plus(rate).pow(-months))).div(rate);
    return { name: l.name, emi, months, rate: Number(l.rate) || 0, outstanding: out_, delay };
  });
  const emiInYear = (i: number) => loans.reduce((s, l) => {
    const yStart = i === 0 ? 0 : monthsLeft + 12 * (i - 1), span = i === 0 ? monthsLeft : 12;
    const from = Math.max(yStart, l.delay), to = Math.min(yStart + span, l.delay + l.months);
    return s.plus(l.emi.mul(Math.max(0, to - from)));
  }, D(0));
  const liabilities = loans.reduce((s, l) => s.plus(l.outstanding), D(0));

  // ---- insurance policies
  const policies = (ins.life ?? []).map((p) => {
    const insured = p.insured ?? "self";
    const start = yearOf(p.startDate), term = Number(p.term) || 0, pTerm = Number(p.premiumTerm) || term;
    const maturityYear = !Number.isNaN(start) && term ? start + term : NaN;
    const premEnd = !Number.isNaN(start) && pTerm ? start + pTerm : Infinity;
    let mv = N(p.maturityValue), estimated = false;
    if (mv.isZero() && !Number.isNaN(maturityYear) && ["ulip", "pension"].includes(p.type)) {
      const t = Math.max(0, maturityYear - Y0), r = pct(R.balanced);
      const n = Math.max(0, Math.min(t, premEnd - Y0));
      const prem = N(p.premium);
      mv = N(p.fundValue).mul(D(1).plus(r).pow(t)).plus(r.isZero() ? prem.mul(n) : prem.mul(D(1).plus(r).pow(n).minus(1)).div(r).mul(D(1).plus(r).pow(t - n)));
      estimated = mv.gt(0);
    }
    return { ...p, insured, maturityYear, premEnd, maturityValueCalc: mv, estimated };
  });
  const mine = policies.filter((p) => p.insured !== "others");
  const premActive = (i: number) => mine.reduce((s, p) => s.plus(Y0 + i < p.premEnd ? N(p.premium) : 0), D(0)).plus(N(ins.healthPremium));
  const premY = (i: number) => premActive(i).mul(i === 0 ? f : 1);

  const cfFor = (i: number) => {
    const fr = i === 0 ? f : D(1);
    const fixedI = fixedFor(i).mul(fr), bonusI = bonusFor(i), other = otherY.mul(fr);
    const income = fixedI.plus(bonusI).plus(other);
    const living = livingFor(i), emi = emiInYear(i), prem = premY(i), tx = taxFor(i);
    const expense = living.plus(emi).plus(prem).plus(tx), before = income.minus(expense);
    const pf = pfY.mul(fixedBase.gt(0) ? fixedFor(i).div(fixedBase) : 1).mul(fr), com = commY.mul(fr);
    return { fixedI, bonusI, other, income, living, emi, prem, tx, expense, before, pf, com, surplus: before.minus(pf).minus(com) };
  };
  const row = (c: ReturnType<typeof cfFor>) => ({ salaryFixed: out(c.fixedI), salaryVariable: out(c.bonusI), otherIncome: out(c.other), income: out(c.income), livingExpenses: out(c.living), loanEmis: out(c.emi), insurancePremiums: out(c.prem), taxes: out(c.tx), totalExpense: out(c.expense), excessBeforeSavings: out(c.before), committedSavingsPF: out(c.pf), otherCommittedSavings: out(c.com), discretionarySurplus: out(c.surplus) });
  const cash0 = cfFor(0), cash1 = cfFor(1);
  const projection = Array.from({ length: 10 }, (_, i) => { const c = cfFor(i); return { year: Y0 + i, income: out(c.income), expense: out(c.expense), surplus: out(c.surplus) }; });

  // ---- net worth
  const assets = q.assets ?? [];
  const sumType = (t: string[]) => assets.filter((a) => t.includes(a.type)).reduce((s, a) => s.plus(N(a.value)), D(0));
  const liquid = sumType(["cash"]), finOther = sumType(["debt", "equity", "balanced", "international", "other"]), goldFin = sumType(["gold"]);
  const insCV = mine.reduce((s, p) => s.plus(N(p.fundValue)), D(0));
  const tangible = N(nf.realEstate).plus(N(nf.gold)).plus(goldFin), personal = N(nf.other);
  const retire = N(rt.pf).plus(N(rt.superannuation));
  const totalAssets = liquid.plus(finOther).plus(insCV).plus(tangible).plus(personal).plus(retire);
  const netWorth = totalAssets.minus(liabilities);

  // ---- retirement corpus
  const retExpY = (N(rt.retirementMonthlyExpense).gt(0) ? N(rt.retirementMonthlyExpense) : livingM.mul(A.retirementExpenseRatio)).mul(12);
  const rRet = retOfMix(mixFor(Math.max(10, retYear - Y0)));
  let retNeed = D(0); const retSeries: any[] = [];
  for (let y = retYear; y <= endYear; y++) {
    const e = retExpY.mul(D(1).plus(hi).pow(retYear - Y0)).mul(D(1).plus(pct(A.inflation.postRetirement)).pow(y - retYear));
    const income = otherY.mul(D(1).plus(pct(A.inflation.postRetirement)).pow(y - Y0));
    const gap = Decimal.max(0, e.minus(income));
    retNeed = retNeed.plus(pvf(gap, rRet, y - retYear));
    retSeries.push({ year: y, expense: out(e), income: out(income), gap: out(gap) });
  }
  // provident fund: balance compounds at the PF rate; contributions are credited mid-year from the first full year after the
  // plan date through the retirement year and grow with the same increment-month schedule as salary (matches the reference plan)
  const tR = Math.max(0, retYear - Y0), rPF = pct(R.pf);
  let pfBal = N(rt.pf).mul(D(1).plus(rPF).pow(tR));
  for (let y = Y0 + 1; y <= retYear; y++) pfBal = pfBal.plus(pfY.mul(fixedBase.gt(0) ? fixedFor(y - Y0).div(fixedBase) : D(1).plus(g).pow(y - Y0)).mul(D(1).plus(rPF).pow(retYear - y + 0.5)));
  const pfAtRet = pfBal.plus(N(rt.superannuation));
  const retCorpusGap = Decimal.max(0, retNeed.minus(pfAtRet));

  // ---- goals
  const infl = (c: string, given?: number | string) => (given !== undefined && given !== "" && given !== null ? Number(given) : ({ education: A.inflation.education, marriage: A.inflation.marriage, property: A.inflation.property, medical: A.inflation.medical }[c] ?? A.inflation.lifestyle));
  const gStart = (x: Goal) => Number(x.startYear) || Y0;
  const emergencyAmt = livingM.plus(emiInYear(1).div(12)).mul(A.emergencyMonths);
  const goals: Goal[] = [
    { name: "Emergency fund", category: "emergency", amount: out(emergencyAmt), startYear: Y0, priority: 0, inflation: 0 },
    ...[...(q.goals ?? [])].filter((x) => x.name).sort((a, b) => Number(a.priority) - Number(b.priority)),
    { name: "Retirement", category: "retirement", amount: out(retCorpusGap), startYear: retYear, priority: 999, inflation: 0 },
  ];

  const years: number[] = []; for (let y = Y0; y <= Math.max(endYear, Y0); y++) years.push(y);
  const avail: Record<number, Decimal> = {}, draws: Record<number, Record<string, Decimal>> = {};
  years.forEach((y, i) => { avail[y] = y < retYear ? cfFor(i).surplus : D(0); draws[y] = {}; });

  const planned = goals.map((gl) => {
    const s = gStart(gl), e = gl.endYear ? Number(gl.endYear) : s, fq = Number(gl.frequency) || 1;
    const recurring = e > s;
    const spread = recurring && gl.amountBasis !== "perOccurrence" && fq === 1 ? e - s + 1 : 1; // sheet amounts are totals across the date range
    const occ: { year: number; amount: Decimal }[] = [];
    for (let y = s; y <= e; y += fq) {
      if (y < Y0) continue;
      occ.push({ year: y, amount: N(gl.amount).div(spread).mul(D(1).plus(pct(infl(gl.category, gl.inflation))).pow(Math.max(0, y - baseYear))) });
    }
    if (s < Y0 && !recurring && gl.category !== "emergency") warnings.push(`Goal "${gl.name}" is dated ${s}, before the plan year; ignored.`);
    if (gl.category === "retirement") { occ.length = 0; occ.push({ year: retYear, amount: N(gl.amount) }); }
    if (gl.category === "emergency") { occ.length = 0; occ.push({ year: Y0, amount: N(gl.amount) }); }
    const totalFV = occ.reduce((t, o) => t.plus(o.amount), D(0));
    const loanAmt = gl.loanPct ? totalFV.mul(pct(Number(gl.loanPct))) : D(0);
    if (loanAmt.gt(0)) {
      const r = pct(A.loanRate).div(12), nM = A.loanMonths, emiM = loanAmt.mul(r).mul(D(1).plus(r).pow(nM)).div(D(1).plus(r).pow(nM).minus(1));
      for (let k = 0; k < Math.ceil(nM / 12); k++) if (avail[s + k] !== undefined) avail[s + k] = avail[s + k].minus(emiM.mul(Math.min(12, nM - 12 * k)));
    }
    return { gl, s, e, occ, totalFV, loanAmt };
  });

  // asset pool: each asset grows at its own rate to maturity; PV factor depends on the goal's return
  const classRet = (t: string) => pct(({ cash: R.cash, debt: R.debt, equity: R.diversified, balanced: R.balanced, gold: R.gold, international: R.intl, other: R.debt } as any)[t] ?? R.debt);
  const pool: { name: string; kind: string; left: Decimal; f: Decimal; t: number; maturity: number; nominal0: Decimal }[] = [];
  assets.forEach((a) => {
    const v = N(a.value); if (v.lte(0)) return;
    const mDate = a.maturityDate ? new Date(a.maturityDate) : null;
    const t = mDate ? Math.max(0, yearsBetween(planDate, mDate)) : a.maturityYear ? Math.max(0, Number(a.maturityYear) - Y0) : 0;
    const maturity = mDate ? mDate.getFullYear() : a.maturityYear ? Number(a.maturityYear) : Y0;
    const ra = Number(a.rate) > 0 ? pct(Number(a.rate)) : classRet(a.type);
    const fac = D(1).plus(ra).pow(t);
    pool.push({ name: a.name, kind: a.type, left: v, f: fac, t, maturity, nominal0: v.mul(fac) });
  });
  mine.filter((p) => p.maturityValueCalc.gt(0) && !Number.isNaN(p.maturityYear) && p.maturityYear >= Y0).forEach((p) => {
    const t = p.maturityYear - Y0, ra = pct(R.debt), fac = D(1).plus(ra).pow(t);
    pool.push({ name: p.name + (p.estimated ? " (est. maturity)" : ""), kind: "insurance", left: p.maturityValueCalc.div(fac), f: fac, t, maturity: p.maturityYear, nominal0: p.maturityValueCalc });
  });
  if (N(rt.gratuityAtRetirement).gt(0)) {
    const t = Math.max(0, retYear - Y0), fac = D(1);
    pool.push({ name: "Gratuity", kind: "retirement", left: N(rt.gratuityAtRetirement), f: fac, t, maturity: retYear, nominal0: N(rt.gratuityAtRetirement) });
  }
  const usedBy: Record<string, Decimal> = {};

  const results: any[] = [];
  for (const { gl, s, e, occ, totalFV, loanAmt } of planned) {
    const isRet = gl.category === "retirement", cashOnly = gl.category === "emergency";
    const horizon = Math.max(0, s - Y0), mix = mixFor(horizon);
    const r = cashOnly ? pct(R.cash) : retOfMix(mix);
    const needPV = occ.reduce((t, o) => t.plus(pvf(o.amount, r, o.year - Y0)), D(0));
    const loanPV = pvf(loanAmt, r, horizon);
    let toFund = Decimal.max(0, needPV.minus(loanPV)); let assetsPV = D(0); const used: { asset: string; amount: number; todayValue: number; year: number }[] = [];
    for (const a of pool) {
      if (toFund.lte(0)) break;
      if (a.left.lte(0) || a.maturity > s) continue;
      if (cashOnly && a.kind !== "cash") continue;
      if ((a.kind === "insurance" || a.kind === "retirement") && !isRet) continue; // policy maturities and gratuity are earmarked for retirement (CE-04)
      const pvOne = pvf(a.f, r, a.t); // PV at plan date of 1 unit of today's value
      const maxPV = a.left.mul(pvOne);
      const takePV = Decimal.min(maxPV, toFund), todayUnits = pvOne.gt(0) ? takePV.div(pvOne) : D(0);
      a.left = a.left.minus(todayUnits); toFund = toFund.minus(takePV); assetsPV = assetsPV.plus(takePV);
      const nominal = todayUnits.mul(a.f); usedBy[a.name] = (usedBy[a.name] ?? D(0)).plus(nominal);
      used.push({ asset: a.name, amount: out(nominal), todayValue: out(todayUnits), year: a.maturity });
    }
    const remaining = toFund;
    const lastY = Math.min(cashOnly ? Y0 : Math.max(e, s) - (e === s ? 1 : 0), retYear - 1);
    let pvAvail = D(0); const availY: Record<number, Decimal> = {};
    for (let y = Y0; y <= lastY; y++) { const used_ = Object.values(draws[y] ?? {}).reduce((a, b) => a.plus(b), D(0)); availY[y] = Decimal.max(0, avail[y].minus(used_)); pvAvail = pvAvail.plus(pvf(availY[y], r, y - Y0)); }
    const k = remaining.gt(0) && pvAvail.gt(0) ? Decimal.min(1, remaining.div(pvAvail)) : D(0);
    let funded = D(0), future = D(0), cnt = 0;
    for (let y = Y0; y <= lastY; y++) { const take = k.mul(availY[y]); draws[y][gl.name] = take; funded = funded.plus(pvf(take, r, y - Y0)); if (y > Y0) { future = future.plus(take); cnt++; } }
    const fundedPct = needPV.gt(0) ? Decimal.min(1, assetsPV.plus(loanPV).plus(funded).div(needPV)) : D(1);
    const status = fundedPct.gte(0.98) ? "Met" : fundedPct.gt(0) ? "Partially met" : "Not met";
    // portfolio projection for the goal chart
    let pv_ = D(0); const series: any[] = [];
    const lastOcc = occ.length ? occ[occ.length - 1].year : s;
    for (let y = Y0; y <= lastOcc; y++) {
      pv_ = pv_.mul(D(1).plus(r));
      const c = draws[y]?.[gl.name] ?? D(0); const lump = used.filter((u) => u.year === y).reduce((a, u) => a.plus(u.amount), D(0));
      const w = occ.filter((o) => o.year === y).reduce((a, o) => a.plus(o.amount), D(0));
      const w_ = Decimal.min(w, pv_.plus(c).plus(lump).plus(y === s && loanAmt.gt(0) ? loanAmt : 0));
      pv_ = Decimal.max(0, pv_.plus(c).plus(lump).plus(y === (occ[0]?.year ?? s) ? loanAmt : 0).minus(w_));
      series.push({ year: y, contribution: out(c), assets: out(lump), withdrawal: out(w), portfolio: out(pv_) });
    }
    const loanEmiDeficit = loanAmt.gt(0) && years.some((y) => y >= s && y < s + Math.ceil(A.loanMonths / 12) && avail[y] !== undefined && avail[y].lt(0));
    results.push({
      name: gl.name, category: gl.category, priority: Number(gl.priority), startYear: s, endYear: e, horizon, todayValue: out(N(gl.amount)), amountBasis: e > s && gl.amountBasis !== "perOccurrence" && (Number(gl.frequency) || 1) === 1 ? "total spread over years" : "per occurrence", inflation: infl(gl.category, gl.inflation),
      occurrences: occ.map((o) => ({ year: o.year, amount: out(o.amount) })), futureValue: out(totalFV), presentValueNeed: out(needPV),
      portfolioReturnPct: out(r.mul(100)), allocationPct: Object.fromEntries(Object.entries(cashOnly ? { cash: D(1) } : mix).map(([kk, v]) => [kk, out(v.mul(100))])),
      fromAssets: used, loan: loanAmt.gt(0) ? { amount: out(loanAmt), ratePct: A.loanRate, months: A.loanMonths, emiMonthly: out(loanAmt.mul(pct(A.loanRate).div(12)).mul(D(1).plus(pct(A.loanRate).div(12)).pow(A.loanMonths)).div(D(1).plus(pct(A.loanRate).div(12)).pow(A.loanMonths).minus(1))) } : null, loanEmiDeficit,
      currentYearSurplus: out(draws[Y0][gl.name] ?? D(0)), avgAnnualSurplus: out(cnt ? future.div(cnt) : D(0)), monthlyInvestmentNext: out((draws[Y0 + 1]?.[gl.name] ?? D(0)).div(12)),
      fundedPct: out(fundedPct.mul(100)), status, series,
    });
  }
  let carry = D(0);
  const surplusAllocation = years.filter((y) => y < retYear).map((y) => {
    const d = Object.values(draws[y]).reduce((a, b) => a.plus(b), D(0)); carry = carry.plus(avail[y]).minus(d);
    return { year: y, available: out(avail[y]), draws: Object.fromEntries(Object.entries(draws[y]).map(([k_, v]) => [k_, out(v)])), carryForward: out(carry) };
  });

  // asset usage summary (goal financing summary)
  const assetUsage = [
    ...pool.map((a) => ({ asset: a.name, year: a.maturity, nominal: out(a.nominal0), usedForGoals: out(usedBy[a.name] ?? D(0)), notUsed: out(Decimal.max(0, a.nominal0.minus(usedBy[a.name] ?? D(0)))) })),
    ...(N(nf.realEstate).gt(0) ? [{ asset: "Real estate", year: Y0, nominal: out(N(nf.realEstate)), usedForGoals: 0, notUsed: out(N(nf.realEstate)) }] : []),
    ...(N(nf.gold).gt(0) ? [{ asset: "Gold", year: Y0, nominal: out(N(nf.gold)), usedForGoals: 0, notUsed: out(N(nf.gold)) }] : []),
    ...(N(nf.other).gt(0) ? [{ asset: "Other personal assets", year: Y0, nominal: out(N(nf.other)), usedForGoals: 0, notUsed: out(N(nf.other)) }] : []),
  ];

  // ---- retirement summary
  const retGoal = results.find((x) => x.category === "retirement");
  const retirement = { retirementYear: retYear, endYear, annualExpenseToday: out(retExpY), corpusRequired: out(retNeed), pfAtRetirement: out(pfAtRet), shortfall: out(retCorpusGap), series: retSeries, readinessPct: out((retNeed.gt(0) ? Decimal.min(1, pfAtRet.plus(retCorpusGap.mul(D((retGoal?.fundedPct ?? 0) / 100))).div(retNeed)) : D(1)).mul(100)), returnPct: out(rRet.mul(100)) };

  // ---- insurance need (earning member = self). Survivor = spouse.
  // A: survivor living expenses until the earner's retirement year; C: survivor retirement expenses until the spouse's life expectancy.
  // Both discounted at the debt-instrument return (a conservative, risk-free-style rate).
  const rD = pct(R.debt);
  const spouseEnd = pr.spouseDob ? new Date(pr.spouseDob).getFullYear() + life : endYear, survEnd = Math.max(endYear, spouseEnd);
  let survPV = D(0); for (let y = Y0 + 1; y < retYear; y++) survPV = survPV.plus(pvf(livingFor(y - Y0).mul(A.survivorExpenseRatio), rD, y - Y0));
  const retExpAt = (y: number) => retExpY.mul(D(1).plus(hi).pow(retYear - Y0)).mul(D(1).plus(pct(A.inflation.postRetirement)).pow(y - retYear));
  let retProv = D(0); for (let y = retYear; y <= survEnd; y++) retProv = retProv.plus(pvf(Decimal.max(0, retExpAt(y).minus(otherY.mul(D(1).plus(pct(A.inflation.postRetirement)).pow(y - Y0)))), rD, y - Y0));
  const goalProt = results.filter((x) => ["education", "marriage"].includes(x.category)).reduce((s, x) => s.plus(x.occurrences.reduce((t: Decimal, o: any) => t.plus(pvf(D(o.amount), rD, o.year - Y0)), D(0))), D(0));
  const availFamily = liquid.plus(finOther).plus(retire);
  const coverReq = Decimal.max(0, survPV.plus(goalProt).plus(retProv).plus(liabilities).minus(availFamily));
  const coverHeld = policies.filter((p) => p.insured === "self").reduce((s, p) => s.plus(N(p.sumAssured)), D(0));
  const healthSI = N(ins.healthSumInsured);
  const insurance = { survivorExpensesPV: out(survPV), goalProtection: out(goalProt), retirementProvision: out(retProv), outstandingDebt: out(liabilities), assetsAvailable: out(availFamily), coverRequired: out(coverReq), coverHeld: out(coverHeld), additionalTermCover: out(Decimal.max(0, coverReq.minus(coverHeld))), healthSumInsured: out(healthSI), healthAdequate: healthSI.gte(A.thresholds.healthCoverIndia), healthFloor: A.thresholds.healthCoverIndia, methodology: "Needs method v0.3: PV of survivor living expenses to the earner's retirement + PV of survivor retirement expenses to the spouse's life expectancy + PV of education and marriage goals + outstanding debt − liquid, financial and retirement assets. Discounted at the debt return. To be confirmed by the advisory team.",
    policies: policies.map((p) => ({ name: p.name, insurer: p.insurer ?? "", insured: p.insured, type: p.type, term: Number(p.term) || null, premiumTerm: Number(p.premiumTerm) || null, startYear: yearOf(p.startDate) || null, maturityYear: Number.isNaN(p.maturityYear) ? null : p.maturityYear, sumAssured: out(N(p.sumAssured)), premium: out(N(p.premium)), maturityValue: out(p.maturityValueCalc), maturityEstimated: p.estimated })) };

  // ---- realignment
  const bucketOf = (t: string) => ({ cash: "cash", debt: "debt", equity: "diversified", balanced: "balanced", gold: "gold", international: "intl", other: "debt" }[t] ?? "debt");
  const current: Record<string, Decimal> = {}; assets.forEach((a) => { const b = bucketOf(a.type); current[b] = (current[b] ?? D(0)).plus(N(a.value)); });
  const finTotal = Object.values(current).reduce((a, b) => a.plus(b), D(0));
  const rec: Record<string, Decimal> = {}; let allocated = D(0);
  results.filter((x) => x.fromAssets.length && x.category !== "retirement").forEach((x) => { const amt = D(x.fromAssets.filter((u: any) => !/maturity|Gratuity/.test(u.asset)).reduce((s: number, u: any) => s + u.todayValue, 0)); Object.entries(x.allocationPct).forEach(([b, p]) => { rec[b] = (rec[b] ?? D(0)).plus(amt.mul(D(p as number).div(100))); }); allocated = allocated.plus(amt); });
  const rest = Decimal.max(0, finTotal.minus(allocated)), wm = mixFor(10);
  Object.entries(wm).forEach(([b, v]) => { rec[b] = (rec[b] ?? D(0)).plus(rest.mul(v)); });
  const realignment = [...new Set([...Object.keys(current), ...Object.keys(rec)])].map((b) => ({ bucket: b, current: out(current[b] ?? D(0)), recommended: out(rec[b] ?? D(0)), action: out((rec[b] ?? D(0)).minus(current[b] ?? D(0))) }));
  const eqShare = (m: Record<string, Decimal>) => finTotal.gt(0) ? (m.diversified ?? D(0)).plus(m.large ?? D(0)).plus(m.intl ?? D(0)).plus((m.balanced ?? D(0)).mul(0.6)).div(finTotal).mul(100).toNumber() : 0;
  // unit-linked repositioning: current equity/debt/cash split vs recommended 10-year mix
  const ulips = mine.filter((p) => ["ulip", "pension"].includes(p.type) && N(p.fundValue).gt(0));
  const ulipTotal = ulips.reduce((s, p) => s.plus(N(p.fundValue)), D(0));
  const ulipCur = ulips.reduce((o, p) => { const e = Number(p.splitEquity) || 0, d = Number(p.splitDebt) || (100 - e), fv = N(p.fundValue); o.equity = o.equity.plus(fv.mul(e).div(100)); o.debt = o.debt.plus(fv.mul(Math.max(0, d)).div(100)); o.cash = o.cash.plus(fv.mul(Math.max(0, 100 - e - d)).div(100)); return o; }, { equity: D(0), debt: D(0), cash: D(0) });
  const ulipRecEq = ulipTotal.mul(wm.large.plus(wm.diversified).plus(wm.balanced)), ulipRecCash = ulipTotal.mul(wm.cash), ulipRecDebt = ulipTotal.minus(ulipRecEq).minus(ulipRecCash);
  const ulipRepositioning = ulipTotal.gt(0) ? [{ bucket: "equity", current: out(ulipCur.equity), recommended: out(ulipRecEq) }, { bucket: "debt", current: out(ulipCur.debt), recommended: out(ulipRecDebt) }, { bucket: "cash", current: out(ulipCur.cash), recommended: out(ulipRecCash) }].map((x) => ({ ...x, action: x.recommended - x.current })) : [];

  // ---- insights
  const th = A.thresholds, insights: any[] = []; let ruleSeq = 0;
  const add = (ruleId: string, category: string, severity: "Urgent" | "Review" | "On track", title: string, description: string, action: string, values: Record<string, unknown> = {}, impact?: string) => insights.push({ id: `${ruleId}-${++ruleSeq}`, ruleId, category, severity, title, description, action, values, impact });
  const fmt = (v: Decimal | number) => `Rs ${Math.round(Number(v)).toLocaleString("en-IN")}`;
  const monthlyOut = livingM.plus(emiInYear(1).div(12)), emNeed = monthlyOut.mul(A.emergencyMonths);
  if (liquid.lt(emNeed)) add("EMERGENCY", "Emergency reserve", "Urgent", "Emergency reserve is short", `Liquid balances of ${fmt(liquid)} cover ${monthlyOut.gt(0) ? liquid.div(monthlyOut).toFixed(1) : "0"} months; target is ${A.emergencyMonths}.`, `Build the reserve to ${fmt(emNeed)} in a liquid fund or sweep deposit.`, { liquid: out(liquid), target: out(emNeed) }, `Gap ${fmt(emNeed.minus(liquid))}`);
  else if (liquid.gt(monthlyOut.mul(12))) add("EMERGENCY_IDLE", "Emergency reserve", "Review", "Idle cash above twelve months", `${fmt(liquid)} sits in cash accounts.`, `Keep ${fmt(emNeed)} liquid and deploy the rest to goal portfolios.`, { liquid: out(liquid) });
  const annualIncome = ctc.plus(otherY);
  if (insurance.additionalTermCover > 0 || coverHeld.lt(annualIncome.mul(10))) add("LIFE_COVER", "Protection", "Urgent", "Life cover below need", `Required ${fmt(coverReq)}, held ${fmt(coverHeld)} (${annualIncome.gt(0) ? coverHeld.div(annualIncome).toFixed(1) : 0}x income; ten times is the floor).`, `Buy a pure term plan for the additional ${fmt(Decimal.max(Decimal.max(0, coverReq.minus(coverHeld)), annualIncome.mul(10).minus(coverHeld)))}.`, { required: out(coverReq), held: out(coverHeld) });
  if (!insurance.healthAdequate) add("HEALTH_COVER", "Protection", "Urgent", "Health cover below Rs 10 lakh", `Sum insured is ${fmt(healthSI)}.`, "Raise family cover to at least Rs 10 lakh with a super top-up.", { sumInsured: out(healthSI) });
  loans.filter((l) => l.rate >= th.highCostLoanRate).forEach((l) => add("HIGH_COST_DEBT", "Debt", "Urgent", `High-cost loan: ${l.name}`, `Interest at ${l.rate}% is at or above ${th.highCostLoanRate}%.`, `Clear ${fmt(l.outstanding)} from savings.`, { rate: l.rate, outstanding: out(l.outstanding) }));
  const takeHome = N(inc.takeHome).mul(12);
  if (takeHome.gt(0) && emiInYear(1).div(takeHome).mul(100).gt(th.emiToTakeHome)) add("EMI_RATIO", "Debt", "Urgent", "EMIs exceed 40% of take-home", `EMIs are ${emiInYear(1).div(takeHome).mul(100).toFixed(0)}% of take-home.`, "Avoid new borrowing and prepay the costliest loan.");
  const saveRate = cash1.income.gt(0) ? cash1.surplus.plus(cash1.pf).plus(cash1.com).div(cash1.income).mul(100) : D(0);
  if (saveRate.lt(th.savingsRate)) add("SAVINGS_RATE", "Savings", "Review", "Savings rate below 20%", `You save about ${saveRate.toFixed(0)}% of income.`, `Commit the next increment (${fmt(ctc.mul(g).div(12))} a month) to SIPs.`, { savingsRate: saveRate.toNumber() });
  else add("SAVINGS_RATE", "Savings", "On track", "Healthy savings rate", `You save about ${saveRate.toFixed(0)}% of income.`, "Automate SIPs two days after salary credit.", { savingsRate: saveRate.toNumber() });
  if (totalAssets.gt(0)) {
    const re = N(nf.realEstate).div(totalAssets).mul(100), gd = N(nf.gold).plus(goldFin).div(totalAssets).mul(100);
    if (re.gt(th.realEstateShare)) add("CONCENTRATION_RE", "Concentration", "Review", "Real estate dominates net worth", `Real estate is ${re.toFixed(0)}% of assets.`, "Do not rely on it for goals; build financial assets.", { share: re.toNumber() });
    if (gd.gt(th.goldShare)) add("CONCENTRATION_GOLD", "Concentration", "Review", "Gold above 15% of assets", `Gold is ${gd.toFixed(0)}% of assets.`, "Direct no new savings to gold.", { share: gd.toNumber() });
  }
  const ulipPrem = mine.filter((p) => ["ulip", "pension", "endowment"].includes(p.type)).reduce((s, p) => s.plus(N(p.premium)), D(0));
  if (annualIncome.gt(0) && ulipPrem.div(annualIncome).mul(100).gt(th.ulipPremiumToIncome)) add("INSURANCE_INVEST", "Insurance", "Review", "Insurance-cum-investment premiums are high", `${fmt(ulipPrem)} a year goes to unit-linked, pension or endowment plans.`, "Request a surrender-value review; prefer term cover plus index SIPs.", { premium: out(ulipPrem) });
  policies.filter((p) => p.type === "term" && N(p.sumAssured).isZero()).forEach((p) => add("DATA_QUALITY", "Data", "Review", `Check policy type: ${p.name}`, "A term plan with zero sum assured is almost always a pension or unit-linked product.", "Verify the policy document."));
  policies.filter((p) => p.insured === "others").forEach((p) => add("DATA_QUALITY_OTHERS", "Data", "Review", `Policy on another person: ${p.name}`, `Premium ${fmt(N(p.premium))} a year is excluded from your cashflow and cover because the life insured is not you or your spouse.`, "Confirm who pays this premium and whether it should be counted."));
  results.filter((x) => x.status !== "Met").forEach((x) => add("GOAL", "Goals", "Urgent", `${x.name} is ${x.fundedPct}% funded`, `Short in ${x.startYear} at the current surplus.`, `Defer, reduce by ~${Math.round(100 - x.fundedPct)}%, or add about ${fmt(D(x.presentValueNeed).mul(1 - x.fundedPct / 100).div(Math.max(1, x.horizon)).div(12))} a month.`, { fundedPct: x.fundedPct }));
  results.filter((x) => x.loanEmiDeficit).forEach((x) => add("LOAN_EMI_DEFICIT", "Goals", "Urgent", `Loan EMI deficit: ${x.name}`, "Surplus in the loan years does not cover the planned loan EMI.", "Lower the loan share, extend tenure or increase income before committing."));
  if (retAge < th.earlyRetirementAge) add("RETIREMENT", "Retirement", "Review", `Retiring at ${retAge}`, `${retYear - Y0} earning years against ${endYear - retYear} retirement years.`, "Model retirement at 58 as a scenario.", { corpus: out(retNeed) });
  if (retNeed.gt(0) && pfAtRet.lt(retNeed.mul(0.5))) add("RETIREMENT_PF", "Retirement", "Review", "Provident fund covers under half of the corpus", `Projected ${fmt(pfAtRet)} against ${fmt(retNeed)}.`, "Open NPS Tier I and route part of the surplus.", { pf: out(pfAtRet), corpus: out(retNeed) });
  const effTax = ctc.gt(0) ? cash1.tx.div(ctc.mul(fixedFor(1).div(fixedBase.gt(0) ? fixedBase : 1))).mul(100) : D(0);
  if (ctc.gt(0) && effTax.gt(th.effectiveTax)) add("TAX", "Tax", "On track", "Effective tax above 20% of CTC", `Effective tax is ${effTax.toFixed(1)}%.`, "Review ELSS, NPS and debt-fund structuring with the advisor.");
  if (pr.will !== "Yes") add("ESTATE", "Estate", "Review", "No will in place", "With dependants, intestate succession is slow.", "Execute and register a will; update nominations.");
  else if (pr.nominees && pr.nominees !== "Yes") add("ESTATE", "Estate", "Review", "Nominations incomplete", `Nominations: ${pr.nominees}.`, "Register nominees on every asset and policy.");
  if (finTotal.gt(0)) { const gap = Math.abs(eqShare(current) - eqShare(rec)); if (gap > th.rebalanceGapPts) add("REBALANCE", "Rebalancing", "Review", "Portfolio needs realignment", `Equity share differs from recommended by ${gap.toFixed(0)} points.`, "Execute the buy/sell list.", { gapPts: gap }); }
  if (/NRI|OCI|PIO/i.test(pr.residency ?? "")) {
    add("NRI_ROUTING", "NRI", "Urgent", "Confirm NRE/NRO routing and FATCA/CRS", "Repatriable savings belong in NRE; Indian-source income in NRO.", "Verify account types and declarations on every folio (compliance to confirm current limits).");
    add("NRI_FX", "NRI", "Review", "Currency risk on rupee goals", `Goals are in INR while income is in foreign currency; planning assumption is ${A.inrDepreciation}% a year INR depreciation.`, "Use a fixed remittance schedule and rate alerts.");
    if (/US/i.test(pr.residency ?? "")) add("NRI_PFIC", "NRI", "Review", "PFIC exposure for US tax residents", "Indian mutual funds are treated as PFICs by the IRS.", "Prefer US-domiciled or GIFT City funds; take tax advice.");
  }
  add("SIP_STEPUP", "SIP", "On track", "Step up SIPs 10% a year", `Salary is assumed to grow ${Number(inc.growth) || 0}% a year.`, "Set a 10% annual step-up on every mandate.");
  const order = { Urgent: 0, Review: 1, "On track": 2 } as const; insights.sort((a, b) => order[a.severity as keyof typeof order] - order[b.severity as keyof typeof order]);
  const urgent = insights.filter((i) => i.severity === "Urgent").length, review = insights.filter((i) => i.severity === "Review").length;
  const metCount = results.filter((x) => x.status === "Met").length;
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - urgent * 10 - review * 4 - (1 - metCount / results.length) * 20)));

  return {
    meta: { engineVersion: ENGINE_VERSION, planDate: planDate.toISOString(), planYear: Y0, inflationBaseYear: baseYear, currency: pr.baseCurrency ?? "INR", clientAge: age, spouseAge, birthYear, lifeExpectancy: life, retirementAge: retAge, household: { name: pr.name ?? null, spouse: pr.spouseName ?? null, dependants: (pr.dependants ?? []).map((d) => d.name) }, warnings, assumptions: { returns: A.returns, inflation: A.inflation, growth: { salary: Number(inc.growth) || 0, household: A.inflation.household }, emergencyMonths: A.emergencyMonths } },
    risk,
    cashflow: { remainingCurrentYear: row(cash0), nextYear: row(cash1), projection, monthsRemaining: monthsLeft },
    netWorth: { total: out(netWorth), assets: out(totalAssets), liabilities: out(liabilities), groups: { liquid: out(liquid), financial: out(finOther), insuranceCashValue: out(insCV), tangible: out(tangible), personal: out(personal), retirement: out(retire) }, loans: loans.map((l) => ({ name: l.name, outstanding: out(l.outstanding), emi: out(l.emi), startsInMonths: l.delay })) },
    goals: results, surplusAllocation, assetUsage, retirement, insurance, realignment, ulipRepositioning, insights, healthScore,
    summary: { goalsMet: metCount, goalsTotal: results.length, monthlySurplusNextYear: out(cash1.surplus.div(12)) },
  };
}
