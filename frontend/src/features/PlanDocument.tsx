import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PlanView from "./PlanView";
import { CashflowFlow, GoalFlow, PlanFlowchart, Gauge, NetWorthDonut, GoalTimeline, Reveal } from "./Visuals";
import { RISK_Q } from "./stepConfig";
import { inr, inrFull } from "../lib/format";

const fmtDate = (d?: string) => { const x = d ? new Date(d) : null; return x && !Number.isNaN(+x) ? x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"; };
const pill: any = { Met: "bg-green-100 text-success", "Partially met": "bg-amber-100 text-warning", "Not met": "bg-red-100 text-danger" };

export const Section = ({ id, n, title, children }: any) => (
  <section id={id} className="scroll-mt-4 mb-8">
    <h2 className="font-serif text-2xl text-navy border-b-2 border-gold pb-1 mb-4"><span className="text-gold mr-2">{n}</span>{title}</h2>{children}
  </section>
);
const Card = ({ title, children }: any) => <div className="clay p-5 mb-4 overflow-x-auto">{title && <h3 className="font-serif text-lg text-navy mb-3">{title}</h3>}{children}</div>;
const Table = ({ head, rows, right = true }: { head: string[]; rows: (string | number)[][]; right?: boolean }) => (
  <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted">{head.map((h, i) => <th key={h} className={`pb-1 ${right && i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className={`py-1.5 ${right && j ? "text-right" : ""}`}>{c}</td>)}</tr>)}</tbody></table>
);

function analysisText(g: any) {
  const parts: string[] = []; const assets = g.fromAssets.reduce((s: number, a: any) => s + a.amount, 0);
  if (assets > 0) parts.push(`${inrFull(assets)} from ${g.fromAssets.map((a: any) => a.asset).join(", ")}`);
  if (g.loan) parts.push(`a planned loan of ${inrFull(g.loan.amount)} (EMI ${inrFull(g.loan.emiMonthly)} for ${g.loan.months} months at ${g.loan.ratePct}%)`);
  if (g.currentYearSurplus > 0) parts.push(`${inrFull(g.currentYearSurplus)} of this year's surplus`);
  const head = g.status === "Met" ? "This goal is fully funded" : `This goal is ${g.fundedPct}% funded`;
  const mi = g.monthlyInvestmentNext > 0 ? ` Invest about ${inrFull(g.monthlyInvestmentNext)} a month in the recommended portfolio next year.` : " No further monthly investment is needed.";
  return `${head}${parts.length ? " by " + parts.join(" and ") : ""}.${mi}${g.loanEmiDeficit ? " Warning: surplus in the loan years does not cover the planned EMI." : ""}`;
}

/** Three-panel goal funding chart: existing assets, surplus contributions, withdrawals + portfolio value. */
export function GoalChart({ series, animate = false }: { series: any[]; animate?: boolean }) {
  if (!series?.length) return null;
  const common = { margin: { top: 4, right: 8, left: 0, bottom: 0 } };
  const axis = <YAxis tickFormatter={(v) => inr(v)} fontSize={10} width={62} />;
  return (<div>
    <div className="text-xs text-muted mt-2">Existing assets applied</div>
    <ResponsiveContainer width="100%" height={90}><BarChart data={series} {...common}><CartesianGrid stroke="#E5E8EE" vertical={false} /><XAxis dataKey="year" hide />{axis}<Tooltip formatter={(v: any) => inrFull(v)} /><Bar isAnimationActive={animate} animationDuration={900} dataKey="assets" fill="#F4A6B7" /></BarChart></ResponsiveContainer>
    <div className="text-xs text-muted">Surplus contributions</div>
    <ResponsiveContainer width="100%" height={90}><BarChart data={series} {...common}><CartesianGrid stroke="#E5E8EE" vertical={false} /><XAxis dataKey="year" hide />{axis}<Tooltip formatter={(v: any) => inrFull(v)} /><Bar isAnimationActive={animate} animationDuration={900} dataKey="contribution" fill="#8E6CFF" /></BarChart></ResponsiveContainer>
    <div className="text-xs text-muted">Goal withdrawals and portfolio value</div>
    <ResponsiveContainer width="100%" height={140}><ComposedChart data={series} {...common}><CartesianGrid stroke="#E5E8EE" vertical={false} /><XAxis dataKey="year" fontSize={10} />{axis}<Tooltip formatter={(v: any) => inrFull(v)} /><Bar isAnimationActive={animate} animationDuration={900} dataKey="withdrawal" fill="#7DC87A" /><Line isAnimationActive={animate} animationDuration={900} dataKey="portfolio" stroke="#2B2B9B" dot={false} strokeWidth={2} /></ComposedChart></ResponsiveContainer>
    <div className="flex gap-4 text-[11px] text-muted mt-1"><span><i className="inline-block w-2.5 h-2.5 mr-1 rounded-sm bg-[#F4A6B7]" />Assets</span><span><i className="inline-block w-2.5 h-2.5 mr-1 rounded-sm bg-[#8E6CFF]" />Surplus</span><span><i className="inline-block w-2.5 h-2.5 mr-1 rounded-sm bg-[#7DC87A]" />Withdrawals</span><span><i className="inline-block w-2.5 h-2.5 mr-1 rounded-sm bg-[#2B2B9B]" />Portfolio</span></div>
  </div>);
}

export const PLAN_SECTIONS = [
  ["summary", "Plan summary"], ["visual", "Plan at a glance"], ["recs", "Recommendations"], ["cashflow", "Cashflow"], ["networth", "Net worth"], ["goals", "Financial goals"], ["risk", "Risk profile"],
  ["financing", "How goals are financed"], ["assets", "Current assets"], ["assumptions", "Assumptions"], ["goalpages", "Goal by goal"], ["retirement", "Retirement"],
  ["realign", "Portfolio realignment"], ["insurance", "Insurance"], ["sat", "Surplus allocation"], ["disclaimer", "Disclaimer"],
] as const;

export default function PlanDocument({ plan }: { plan: any }) {
  const r = plan.result, inp = plan.input ?? {}, prof = inp.profile ?? {}, A = r.meta.assumptions ?? {};
  const name = prof.name || "Client"; const nri = /NRI|OCI|PIO/i.test(prof.residency ?? "");
  const renewal = new Date(r.meta.planDate); renewal.setMonth(renewal.getMonth() + 11);
  const oneTime = r.goals.filter((g: any) => (g.occurrences?.length ?? 0) <= 1 && g.category !== "retirement"), recurring = r.goals.filter((g: any) => (g.occurrences?.length ?? 0) > 1);
  const goalRows = (list: any[]) => list.map((g) => [g.name, g.startYear + (g.endYear !== g.startYear ? `–${g.endYear}` : ""), g.priority || "—", `${g.inflation}%`, inrFull(g.todayValue), inrFull(g.futureValue), `${g.status} (${g.fundedPct}%)`]);
  const sat = r.surplusAllocation; const names: string[] = r.goals.map((g: any) => g.name);
  let n = 0; const num = () => String(++n).padStart(2, "0");

  return (<div className="min-w-0 max-w-5xl">
    {/* cover */}
    <div className="relative overflow-hidden rounded-xl3 p-8 mb-6 text-white shadow-clay" style={{ background: "linear-gradient(135deg,#101D35 0%,#24385c 62%,#6b5a2f 140%)" }}><div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/25 blur-2xl" />
      <div className="text-[11px] tracking-[0.3em] text-gold">METAWEALTH CAPITAL</div>
      <h1 className="font-serif text-4xl mt-2">Financial Plan</h1>
      <p className="text-lg mt-1">Prepared for {name}</p>
      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-white/75 mt-4">
        <span>Plan date {fmtDate(r.meta.planDate)}</span><span>Version {plan.version}</span><span className="capitalize">Status {String(plan.status).replace("_", " ")}</span><span>Suggested renewal {fmtDate(renewal.toISOString())}</span>
      </div>
      <div className="text-[11px] tracking-[0.25em] text-gold mt-4">CONFIDENTIAL</div>
    </div>

    <Section id="summary" n={num()} title="Plan summary">
      <Card><Table right={false} head={["", "Self", "Spouse"]} rows={[["Name", name, prof.spouseName ?? "—"], ["Date of birth", fmtDate(prof.dob), fmtDate(prof.spouseDob)], ["Age", r.meta.clientAge, r.meta.spouseAge ?? "—"], ["Occupation", prof.occupation ?? "—", prof.spouseOccupation ?? "—"], ["Residency", prof.residency ?? "—", ""]]} /></Card>
      {prof.dependants?.length > 0 && <Card title="Family members and dependants"><Table right={false} head={["Name", "Relationship", "Date of birth", "Dependant"]} rows={prof.dependants.map((d: any) => [d.name, d.relation, fmtDate(d.dob), d.dependant ?? "Yes"])} /></Card>}
      <Card title="Can you meet your goals?"><div className="grid sm:grid-cols-2 gap-x-8">{r.goals.map((g: any) => <div key={g.name} className="flex justify-between border-b border-line py-1.5 text-sm"><span>{g.name} <span className="text-muted">({g.startYear})</span></span><span className={`px-2 rounded-full text-xs ${pill[g.status]}`}>{g.status === "Met" ? "Yes" : g.status}</span></div>)}</div></Card>
      <PlanView r={r} section="overview" />
    </Section>

    <Section id="visual" n={num()} title="Your plan at a glance">
      <Reveal><Card title="How your plan fits together"><PlanFlowchart r={r} /></Card></Reveal>
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="clay p-5"><Gauge label="Goals met" pct={r.summary?.goalsTotal ? (100 * r.summary.goalsMet) / r.summary.goalsTotal : 0} sub={`${r.summary?.goalsMet ?? 0} of ${r.summary?.goalsTotal ?? 0}`} color="#6FAE57" /></div>
        <div className="clay p-5"><Gauge label="Retirement readiness" pct={r.retirement?.readinessPct} sub={`corpus ${inr(r.retirement?.corpusRequired)}`} /></div>
        <div className="clay p-5"><Gauge label="Life cover held" pct={r.insurance?.coverRequired > 0 ? (100 * r.insurance.coverHeld) / r.insurance.coverRequired : 100} sub={`need ${inr(r.insurance?.coverRequired)}`} color="#6D86B9" /></div>
      </div>
      <Reveal><Card title="Where your income goes (next year)"><CashflowFlow cf={r.cashflow.nextYear} /></Card></Reveal>
      <Reveal><Card title="How your goals are funded"><GoalFlow goals={r.goals} /></Card></Reveal>
      <div className="grid lg:grid-cols-2 gap-4"><Card title="What you own"><NetWorthDonut groups={r.netWorth.groups} total={r.netWorth.total} /></Card><Card title="Goal timeline"><GoalTimeline goals={r.goals} /></Card></div>
    </Section>

    <Section id="recs" n={num()} title="Recommendations at a glance">
      <Card title="Investment actions"><Table head={["Goal", "Lump sum from assets", "Monthly investment (next year)"]} rows={r.goals.filter((g: any) => g.fromAssets.length || g.monthlyInvestmentNext).map((g: any) => [g.name, inrFull(g.fromAssets.reduce((s: number, a: any) => s + a.amount, 0)), inrFull(g.monthlyInvestmentNext)])} /></Card>
      <PlanView r={r} section="insights" />
    </Section>

    <Section id="cashflow" n={num()} title="Cashflow"><PlanView r={r} section="cashflow" /></Section>
    <Section id="networth" n={num()} title="Net worth">
      <Card><p className="text-sm mb-2">Total net worth <b>{inrFull(r.netWorth.total)}</b> · assets {inrFull(r.netWorth.assets)} · liabilities {inrFull(r.netWorth.liabilities)}</p>
        <Table head={["Asset group", "Amount"]} rows={Object.entries(r.netWorth.groups).map(([k, v]) => [k, inrFull(v as number)])} />
        {r.netWorth.loans.length > 0 && <div className="mt-4"><Table head={["Loan", "Outstanding", "EMI"]} rows={r.netWorth.loans.map((l: any) => [l.name + (l.startsInMonths ? ` (starts in ${l.startsInMonths} months)` : ""), inrFull(l.outstanding), inrFull(l.emi)])} /></div>}</Card>
    </Section>

    <Section id="goals" n={num()} title="Financial goals">
      <Card title="Retirement goal"><Table head={["Retirement year", "End year", "Annual expense (today)", "Corpus needed", "Status"]} rows={[[r.retirement.retirementYear, r.retirement.endYear, inrFull(r.retirement.annualExpenseToday), inrFull(r.retirement.corpusRequired), r.goals.find((g: any) => g.category === "retirement")?.status ?? "—"]]} /></Card>
      <Card title="One-time goals"><Table head={["Goal", "Year", "Priority", "Inflation", "Today's value", "In goal year", "Status"]} rows={goalRows(oneTime)} /></Card>
      <Card title="Recurring goals"><Table head={["Goal", "Years", "Priority", "Inflation", "Today's value", "Total in goal years", "Status"]} rows={goalRows(recurring)} /></Card>
    </Section>

    <Section id="risk" n={num()} title="Risk profile">
      {r.risk ? <Card><p className="text-sm mb-3">Score <b>{r.risk.score}/40</b> · <b>{r.risk.band}</b> · equity ceiling {r.risk.goalEquityCeiling}% (goals) / {r.risk.wealthEquityCeiling}% (wealth growth)</p>
        {r.risk.overridden && <p className="text-sm bg-amber-50 border border-warning rounded p-2 mb-3">Advisor override from {r.risk.computedBand} to {r.risk.band}. Reason: {r.risk.overrideReason}</p>}
        {r.risk.answers && <Table right={false} head={["Statement", "Your answer", "Score"]} rows={r.risk.answers.map((a: number, i: number) => [RISK_Q[i][0], RISK_Q[i][a] ?? "—", a])} />}</Card>
        : <Card><p className="text-sm">Risk profile not completed.</p></Card>}
    </Section>

    <Section id="financing" n={num()} title="How goals are financed">
      <Card><p className="text-sm mb-2"><b>Core investment strategy.</b> Each goal is financed in priority order from eligible existing assets, planned loans and your annual surplus, using a portfolio set by your risk band and the goal's time horizon. Goals under three years use cash and debt only; goals three to seven years away use at most half the band's equity ceiling.</p>
        <p className="text-sm mb-2"><b>Wealth-growth strategy.</b> Capital left after your goals are funded can be invested at the higher ceiling for your band. It is kept separate from your goals.</p>
        <p className="text-sm text-muted">Personal assets such as your home and jewellery are never used to fund goals. Results are projections based on stated assumptions, not guarantees. Review at least once a year.</p></Card>
    </Section>

    <Section id="assets" n={num()} title="Current assets">
      <Card title="Assets used for goal financing"><Table head={["Asset", "Available in", "Value at maturity", "Used for goals", "Not used"]} rows={(r.assetUsage ?? []).filter((a: any) => a.usedForGoals > 0 || a.notUsed < a.nominal).map((a: any) => [a.asset, a.year, inrFull(a.nominal), inrFull(a.usedForGoals), inrFull(a.notUsed)])} /></Card>
      <Card title="Assets not used for goal financing"><Table head={["Asset", "Value"]} rows={(r.assetUsage ?? []).filter((a: any) => a.usedForGoals === 0 && a.notUsed === a.nominal).map((a: any) => [a.asset, inrFull(a.nominal)])} /></Card>
    </Section>

    <Section id="assumptions" n={num()} title="Assumptions">
      <Card><ol className="list-decimal ml-5 text-sm space-y-1"><li>Life expectancy {r.meta.lifeExpectancy} years; retirement age {r.meta.retirementAge}.</li><li>Inflation is applied from {r.meta.inflationBaseYear}, the first full year after the plan date.</li><li>Surplus for the remaining {r.cashflow.monthsRemaining} months of {r.meta.planYear}: {inrFull(r.cashflow.remainingCurrentYear.discretionarySurplus)}.</li><li>Tax, savings and deductions come from the documents and figures you provided.</li></ol></Card>
      <div className="grid md:grid-cols-2 gap-4"><Card title="Asset-class returns (% a year)"><Table head={["Asset class", "Return"]} rows={Object.entries(A.returns).map(([k, v]) => [k, `${v}%`])} /></Card>
        <Card title="Inflation and growth (% a year)"><Table head={["Item", "Rate"]} rows={[...Object.entries(A.inflation).map(([k, v]) => [`Inflation: ${k}`, `${v}%`]), ["Salary growth", `${A.growth.salary}%`]]} /></Card></div>
    </Section>

    <Section id="goalpages" n={num()} title="Goal by goal">
      <Card><p className="text-sm text-muted">Each goal shows its description, recommended portfolio, funding sources and a funding chart: existing assets and loans (top), your annual surplus contribution (middle), and withdrawals against portfolio value (bottom).</p></Card>
      {r.goals.map((g: any) => (
        <Card key={g.name}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><h3 className="font-serif text-xl text-navy">{g.name}</h3><span className={`px-3 py-1 rounded-full text-xs font-semibold ${pill[g.status]}`}>{g.status} · {g.fundedPct}% funded</span></div>
          <div className="grid lg:grid-cols-2 gap-6"><div>
            <Table right={false} head={["Item", "Value"]} rows={[["Today's value", `${inrFull(g.todayValue)} (${g.amountBasis})`], ["Inflation", `${g.inflation}%`], ["Goal year(s)", g.startYear + (g.endYear !== g.startYear ? `–${g.endYear}` : "")], ["Total future value", inrFull(g.futureValue)], ["Recommended portfolio", Object.entries(g.allocationPct).filter(([, v]) => (v as number) > 0).map(([k, v]) => `${k} ${v}%`).join(", ")], ["Expected return", `${g.portfolioReturnPct}%`], ["From current-year surplus", inrFull(g.currentYearSurplus)], ["Avg annual surplus (future)", inrFull(g.avgAnnualSurplus)], ["Monthly investment (next year)", inrFull(g.monthlyInvestmentNext)]]} />
            {g.fromAssets.length > 0 && <div className="mt-3"><div className="text-xs text-muted mb-1">Existing assets applied</div><Table head={["Asset", "At maturity", "Year"]} rows={g.fromAssets.map((a: any) => [a.asset, inrFull(a.amount), a.year])} /></div>}
            {g.loan && <div className="mt-3"><div className="text-xs text-muted mb-1">Planned loan</div><Table head={["Amount", "Tenure", "EMI", "Interest"]} rows={[[inrFull(g.loan.amount), `${g.loan.months} months`, inrFull(g.loan.emiMonthly), `${g.loan.ratePct}%`]]} /></div>}
          </div><GoalChart series={g.series} /></div>
          <p className="text-sm bg-ivory rounded p-3 mt-4"><b>Analysis.</b> {analysisText(g)}</p>
        </Card>))}
    </Section>

    <Section id="retirement" n={num()} title="Retirement planning"><PlanView r={r} section="retirement" />
      <Card><p className="text-sm">PF at retirement {inrFull(r.retirement.pfAtRetirement)} · shortfall {inrFull(r.retirement.shortfall)} · portfolio return {r.retirement.returnPct}% · readiness {r.retirement.readinessPct}%</p></Card></Section>
    <Section id="realign" n={num()} title="Portfolio realignment"><PlanView r={r} section="portfolio" /></Section>
    <Section id="insurance" n={num()} title="Insurance"><PlanView r={r} section="insurance" /></Section>

    <Section id="sat" n={num()} title="Surplus allocation table">
      <Card><p className="text-xs text-muted mb-2">Year-by-goal matrix of how your annual surplus is assigned, with the carry-forward balance.</p>
        <div className="overflow-auto max-h-[480px] border border-line rounded"><table className="text-[11px] min-w-full"><thead className="sticky top-0 bg-navy text-white"><tr><th className="p-1.5 text-left">Year</th><th className="p-1.5 text-right">Available</th>{names.map((c) => <th key={c} className="p-1.5 text-right whitespace-nowrap">{c}</th>)}<th className="p-1.5 text-right">Carry-forward</th></tr></thead>
          <tbody>{sat.map((y: any) => <tr key={y.year} className="border-t border-line"><td className="p-1.5">{y.year}</td><td className="p-1.5 text-right">{inr(y.available)}</td>{names.map((c) => <td key={c} className="p-1.5 text-right">{y.draws[c] ? "−" + inr(y.draws[c]) : "0"}</td>)}<td className={`p-1.5 text-right ${y.carryForward < 0 ? "text-danger" : ""}`}>{inr(y.carryForward)}</td></tr>)}</tbody></table></div></Card>
    </Section>

    {nri && <Section id="nri" n={num()} title="NRI annexure"><Card><p className="text-sm">Residency: {prof.residency}. Route repatriable savings through NRE accounts; keep Indian-source income in NRO; use FCNR for foreign-currency deposits. The NRO repatriation limit and FATCA/CRS declarations must be confirmed by compliance. This platform does not prepare foreign tax returns.</p></Card></Section>}

    <Section id="disclaimer" n={num()} title="Disclaimer"><Card><p className="text-sm text-muted">This plan is based on information provided by you and on planning assumptions that are not forecasts. No outcome is guaranteed. Investors must make their own investment decisions. MetaWealth Capital's approved legal text, SEBI registration number and jurisdiction appear here once configured by the administrator.</p></Card></Section>
  </div>);
}
