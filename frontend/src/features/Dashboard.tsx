import { useState } from "react";
import { GoalChart } from "./PlanDocument";
import { CashflowFlow, GoalFlow, PlanFlowchart, NetWorthDonut, GoalTimeline, Reveal } from "./Visuals";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, ClipboardList, Eye, FileText, Sparkles, Target, Wallet } from "lucide-react";
import { inr, inrFull } from "../lib/format";

const SEV: any = { Urgent: { icon: AlertTriangle, cls: "bg-red-100 text-danger" }, Review: { icon: Eye, cls: "bg-amber-100 text-warning" }, "On track": { icon: CheckCircle2, cls: "bg-green-100 text-success" } };
const SEG = [["living", "Living", "#55B848"], ["emi", "Loan EMIs", "#E8CE92"], ["premiums", "Premiums", "#F0B38A"], ["taxes", "Taxes", "#9AA7C4"], ["savings", "Savings (PF etc.)", "#6D86B9"], ["surplus", "Free surplus", "#9CC27A"]] as const;

const Card = ({ title, sub, right, children, className = "" }: any) => (
  <section className={`clay p-5 h-full min-w-0 ${className}`}>
    {(title || right) && <div className="flex items-start justify-between mb-3"><div><h3 className="text-[15px] font-semibold text-navy">{title}</h3>{sub && <div className="text-[11px] text-muted">{sub}</div>}</div>{right}</div>}
    {children}
  </section>
);
const Seg = ({ value, onChange, options }: any) => (<div className="clay-inset p-0.5 inline-flex text-[11px]">{options.map(([v, l]: any) => <button key={v} onClick={() => onChange(v)} className={`px-2.5 py-1 rounded-xl transition ${value === v ? "bg-white shadow-clay text-navy font-medium" : "text-muted"}`}>{l}</button>)}</div>);

function Gauge({ value }: { value: number }) {
  return (<div className="relative mx-auto w-[220px]">
    <svg viewBox="0 0 200 110" className="w-full"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#F0B38A" /><stop offset=".55" stopColor="#55B848" /><stop offset="1" stopColor="#9CC27A" /></linearGradient></defs>
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#E7E4DB" strokeWidth="16" strokeLinecap="round" pathLength="100" />
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#g)" strokeWidth="16" strokeLinecap="round" pathLength="100" strokeDasharray={`${Math.max(1, value)} 100`} /></svg>
    <div className="absolute inset-x-0 bottom-1 text-center"><div className="text-3xl font-semibold text-navy tabular-nums">{value}<span className="text-base text-muted">/100</span></div></div>
  </div>);
}
function Ring({ pct, color = "#55B848", size = 74, children }: any) {
  const c = 2 * Math.PI * 30, v = Math.max(0, Math.min(100, pct));
  return (<div className="relative" style={{ width: size, height: size }}><svg viewBox="0 0 70 70" className="-rotate-90" width={size} height={size}><circle cx="35" cy="35" r="30" fill="none" stroke="#E7E4DB" strokeWidth="9" /><circle cx="35" cy="35" r="30" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} /></svg><div className="absolute inset-0 grid place-items-center text-sm font-semibold text-navy">{children}</div></div>);
}

export default function Dashboard({ r }: { r: any }) {
  const [gPick, setGSel] = useState<number | null>(null); const [range, setRange] = useState("10"); const [kind, setKind] = useState("bars"); const [active, setActive] = useState(3);
  const cf = r.cashflow.nextYear, proj = r.cashflow.projection.slice(0, +range);
  const stack = proj.map((p: any) => ({ year: p.year, income: p.income, expense: p.expense, surplus: Math.max(0, p.surplus), savings: Math.max(0, p.income - p.expense - Math.max(0, p.surplus)) }));
  const MUTE = "#EDEBE5";
  const Tip = ({ active: a, payload }: any) => { if (!a || !payload?.length) return null; const d = payload[0].payload; return (<div className="bg-white rounded-xl shadow-[0_12px_30px_-10px_rgba(26,88,118,.3)] p-3 text-[11px] min-w-[150px]"><div className="text-muted mb-1.5">Year {d.year}</div>{[["Savings", d.savings, "#55B848"], ["Income", d.income, "#9CC27A"], ["Expenses", d.expense, "#F0B38A"]].map(([l, v, c]: any) => <div key={l} className="flex items-center justify-between gap-4 py-0.5"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: c }} />{l}</span><b className="text-navy tabular-nums">{inr(v)}</b></div>)}</div>); };
  const income = cf.income || 1, expense = cf.totalExpense;
  const seg: any = { living: cf.livingExpenses, emi: cf.loanEmis, premiums: cf.insurancePremiums, taxes: cf.taxes, savings: cf.committedSavingsPF + cf.otherCommittedSavings, surplus: Math.max(0, cf.discretionarySurplus) };
  const emergency = r.goals.find((g: any) => g.category === "emergency"); const liquid = r.netWorth.groups.liquid;
  const eTarget = emergency?.futureValue || 1, ePct = Math.min(100, Math.round((liquid / eTarget) * 100));
  const tip = r.insights.find((i: any) => i.severity === "Urgent") ?? r.insights[0];
  const goals = [...r.goals].filter((g: any) => g.category !== "emergency").sort((a: any, b: any) => a.priority - b.priority).slice(0, 5);
  const rk = r.risk, hh = r.meta.household; const people = hh ? [hh.name, hh.spouse, ...(hh.dependants ?? [])].filter(Boolean) : [];
  const actions = r.insights.slice(0, 6);
  const retPct = r.retirement.readinessPct, cover = r.insurance;
  const coverPct = cover.coverRequired > 0 ? Math.min(100, Math.round((cover.coverHeld / cover.coverRequired) * 100)) : 100;
  const upcoming = [...r.goals].filter((g: any) => g.category !== "emergency" && g.startYear >= r.meta.planYear).sort((a: any, b: any) => a.startYear - b.startYear).slice(0, 5);
  const cnt = (st: string) => r.goals.filter((g: any) => g.status === st).length;
  const statusCount = [["Met", cnt("Met"), "#6FAE57"], ["Partly met", cnt("Partially met"), "#E2A83B"], ["Not met", cnt("Not met"), "#D1604D"]];
  const goalTotal = r.goals.reduce((a: number, g: any) => a + (g.futureValue || 0), 0);
  const ys = r.goals.map((g: any) => g.startYear).filter(Boolean); const firstY = ys.length ? Math.min(...ys) : "—", lastY = ys.length ? Math.max(...r.goals.map((g: any) => g.endYear ?? g.startYear)) : "—";
  const longest = r.goals.reduce((bi: number, g: any, i: number) => ((g.series?.length ?? 0) > (r.goals[bi].series?.length ?? 0) ? i : bi), 0); // open on a multi-year goal, where the charts are most informative
  const gSel: number = Math.min(gPick ?? longest, r.goals.length - 1); const sel = r.goals[gSel];
  const holdings = [...(r.assetUsage ?? [])].sort((a: any, b: any) => b.nominal - a.nominal).slice(0, 5);
  const tint = ["#55B848", "#6D86B9", "#9CC27A", "#F0B38A", "#9AA7C4"];

  return (<div className="grid xl:grid-cols-[minmax(0,1fr)_330px] gap-5">
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 min-w-0 content-start">
      {/* cashflow overview */}
      <div className="clay p-5 grid lg:grid-cols-[minmax(0,1fr)_210px] gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><div className="text-3xl font-semibold text-navy tabular-nums">{inr(r.netWorth.total)}</div><div className="text-[11px] text-muted">Net worth · {inr(r.netWorth.assets)} assets − {inr(r.netWorth.liabilities)} liabilities</div></div>
            <div className="flex gap-2"><Seg value={range} onChange={setRange} options={[["5", "5y"], ["10", "10y"]]} /><Seg value={kind} onChange={setKind} options={[["bars", "Bars"], ["line", "Line"]]} /></div>
          </div>
          <div className="flex gap-4 text-[11px] text-muted my-2">{[["Savings", "#55B848"], ["Expenses", "#F0B38A"], ["Surplus", "#9CC27A"]].map(([l, c]) => <span key={l}><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: c }} />{l}</span>)}</div>
          <ResponsiveContainer width="100%" height={230}>
            {kind === "bars" ? <BarChart data={stack} barCategoryGap="22%" onMouseMove={(st: any) => { if (st?.activeTooltipIndex != null) setActive(+st.activeTooltipIndex); }}><CartesianGrid stroke="#E7E4DB" vertical={false} /><XAxis dataKey="year" fontSize={11} tickLine={false} axisLine={false} /><YAxis tickFormatter={(v) => inr(v)} fontSize={10} width={74} tickLine={false} axisLine={false} /><Tooltip content={<Tip />} cursor={false} />
              <Bar isAnimationActive={false} dataKey="savings" stackId="a">{stack.map((_: any, i: number) => <Cell key={i} fill={i === active ? "#55B848" : MUTE} />)}</Bar>
              <Bar isAnimationActive={false} dataKey="expense" stackId="a">{stack.map((_: any, i: number) => <Cell key={i} fill={i === active ? "#F0B38A" : "#E6E3DB"} />)}</Bar>
              <Bar isAnimationActive={false} dataKey="surplus" stackId="a" radius={[10, 10, 0, 0]}>{stack.map((_: any, i: number) => <Cell key={i} fill={i === active ? "#9CC27A" : "#DFDCD3"} />)}</Bar></BarChart>
              : <LineChart data={proj}><CartesianGrid stroke="#E7E4DB" vertical={false} /><XAxis dataKey="year" fontSize={11} tickLine={false} axisLine={false} /><YAxis tickFormatter={(v) => inr(v)} fontSize={10} width={74} tickLine={false} axisLine={false} /><Tooltip formatter={(v: any) => inrFull(v)} contentStyle={{ borderRadius: 14, border: "none", boxShadow: "0 12px 30px -10px rgba(26,88,118,.3)" }} />
              <Line isAnimationActive={false} dataKey="income" stroke="#55B848" strokeWidth={3} dot={false} /><Line isAnimationActive={false} dataKey="expense" stroke="#F0B38A" strokeWidth={3} dot={false} /><Line isAnimationActive={false} dataKey="surplus" stroke="#9CC27A" strokeWidth={3} dot={false} /></LineChart>}
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 content-start">
          {[["Total income", inr(cf.income), "next year", "#55B848"], ["Total expenses", inr(expense), `${Math.round((expense / income) * 100)}% of income`, "#F0B38A"], ["Monthly surplus", inr(r.summary.monthlySurplusNextYear), `${Math.max(0, Math.round((cf.discretionarySurplus / income) * 100))}% of income`, "#9CC27A"]].map(([k, v, s, c]) => (
            <div key={k} className="clay-flat p-3.5 border-l-4" style={{ borderLeftColor: c }}><div className="text-[11px] text-muted">{k}</div><div className="text-2xl font-semibold text-navy tabular-nums">{v}</div><div className="text-[11px] text-muted">{s}</div></div>))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Card title="Emergency fund" sub={`Liquid savings against ${(r.meta.assumptions?.emergencyMonths ?? 6)} months of outgoings`} right={<span className="chip">{ePct}%</span>}>
          <div className="progress mt-6"><i style={{ width: `${ePct}%` }} /></div>
          <div className="flex justify-between text-[11px] text-muted mt-2"><span>{inrFull(liquid)} saved</span><span>{inrFull(eTarget)} target</span></div>
        </Card>
        <Card title={tip ? tip.title : "All clear"} sub={tip ? `${tip.severity} · ${tip.category}` : "Nothing needs attention"} className="relative overflow-hidden">
          <p className="text-xs text-muted pr-16 line-clamp-3">{tip?.action ?? "Your plan has no open recommendations."}</p>
          <Link to="/client/insights" className="text-xs font-medium text-navy mt-3 inline-block">Read more →</Link>
          <div className="absolute right-4 bottom-4 grid grid-cols-3 gap-1 opacity-90">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} className="h-5 w-5 rounded-md" style={{ background: tint[i % 5], opacity: 0.35 + (i % 3) * 0.2 }} />)}</div>
        </Card>
      </div>

      <div className="grid sm:grid-cols-3 gap-5">
        <Card title="Retirement readiness" sub={`Retire ${r.retirement.retirementYear}`}><div className="flex items-center gap-4"><Ring pct={retPct} color="#55B848">{retPct}%</Ring><div className="text-xs text-muted">Corpus needed<div className="text-base font-semibold text-navy">{inr(r.retirement.corpusRequired)}</div></div></div></Card>
        <Card title="Protection" sub={`Life cover ${coverPct}% of need`}><div className="progress mt-3"><i style={{ width: `${coverPct}%`, backgroundImage: coverPct < 50 ? "linear-gradient(90deg,#F0B38A,#E58A5A)" : undefined }} /></div><div className="text-xs text-muted mt-2">Gap <b className="text-navy">{inr(cover.additionalTermCover)}</b> · health {cover.healthAdequate ? "adequate" : "below ₹10 L"}</div></Card>
        <Card title="Goals on track" sub={`${r.summary.goalsMet} of ${r.summary.goalsTotal} met`}><div className="flex flex-wrap gap-1.5 mt-2">{r.goals.map((g: any) => <i key={g.name} title={`${g.name}: ${g.status}`} className="h-4 w-4 rounded-md" style={{ background: g.status === "Met" ? "#9CC27A" : g.status === "Not met" ? "#E58A5A" : "#E8CE92" }} />)}</div></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Use of income" sub="Where next year's income goes">
          <div className="flex h-3.5 rounded-full overflow-hidden gap-0.5 my-3">{SEG.map(([k, , c]) => <i key={k} style={{ width: `${Math.max(0, (seg[k] / income) * 100)}%`, background: c }} />)}</div>
          <ul className="text-xs space-y-1.5">{SEG.map(([k, l, c]) => <li key={k} className="flex items-center justify-between"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{l}</span><b className="text-navy">{Math.round((seg[k] / income) * 100)}%</b></li>)}</ul>
        </Card>
        <Card title="Financial health" sub="From open insights and goals met"><Gauge value={r.healthScore} /><p className="text-[11px] text-muted text-center mt-2">{r.insights.filter((i: any) => i.severity === "Urgent").length} urgent · {r.insights.filter((i: any) => i.severity === "Review").length} to review</p></Card>
        <Card title="Goal tracker" right={<Link to="/client/questionnaire" className="chip hover:bg-white">+ Add goals</Link>}>
          <ul className="space-y-3">{goals.map((g: any) => <li key={g.name}><div className="flex items-baseline justify-between gap-2 text-xs"><span className="truncate min-w-0 flex-1">{g.name}</span><span className="text-muted tabular-nums whitespace-nowrap text-[11px]">{g.fundedPct}% · {inr(g.futureValue)}</span></div><div className="progress h-2.5 mt-1"><i style={{ width: `${g.fundedPct}%` }} /></div></li>)}</ul>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Card title="Loans" sub="What you owe today">
          <div className="text-2xl font-semibold text-navy tabular-nums">{inr(r.netWorth.liabilities)}</div>
          <div className="progress mt-3"><i style={{ width: `${Math.min(100, Math.round((r.netWorth.liabilities / Math.max(1, r.netWorth.assets)) * 100))}%` }} /></div>
          <div className="flex justify-between text-[11px] text-muted mt-2"><span>{Math.round((r.netWorth.liabilities / Math.max(1, r.netWorth.assets)) * 100)}% of assets</span><span>EMIs {inr(cf.loanEmis)} a year</span></div>
        </Card>
        <Card title="Life cover" sub="Held against what your family needs">
          <div className="text-2xl font-semibold text-navy tabular-nums">{inr(cover.coverHeld)}</div>
          <div className="progress mt-3"><i style={{ width: `${coverPct}%`, backgroundImage: coverPct < 60 ? "linear-gradient(90deg,#E58B6A,#F0B38A)" : undefined }} /></div>
          <div className="flex justify-between text-[11px] text-muted mt-2"><span>{coverPct}% of need</span><span>Need {inr(cover.coverRequired)}</span></div>
        </Card>
      </div>
    </div>

    <aside className="grid grid-cols-[minmax(0,1fr)] gap-5 content-start min-w-0">
      <div className="relative overflow-hidden rounded-xl3 p-5 text-white shadow-clay" style={{ background: "linear-gradient(135deg,#1A5876 0%,#2b4570 60%,#55B848 135%)" }}>
        <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10" /><div className="absolute right-10 -top-12 h-32 w-32 rounded-full bg-gold/30 blur-xl" />
        <div className="flex justify-between text-[11px] tracking-widest text-white/70"><span>RISK PROFILE</span><span>{rk ? `${rk.score}/40` : "—"}</span></div>
        <div className="text-2xl font-semibold mt-7">{rk ? rk.band : "Not completed"}</div>
        <div className="text-xs text-white/70 mt-1">{rk ? `Equity up to ${rk.goalEquityCeiling}% in goal portfolios` : "Finish step 9 of the questionnaire"}</div>
        <div className="flex justify-between text-[11px] text-white/75 mt-6"><span>{hh?.name ?? ""}</span><span>Plan {new Date(r.meta.planDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span></div>
      </div>
      <Card title="Quick actions"><div className="grid grid-cols-5 gap-1.5">{[[ClipboardList, "Form", "/client/questionnaire"], [Target, "Goals", "/client/goals"], [Wallet, "Cash", "/client/cashflow"], [FileText, "Plan", "/client/plan"], [Sparkles, "Insights", "/client/insights"]].map(([I, l, to]: any) => <Link key={l} to={to} className="clay-btn py-2.5 grid place-items-center gap-1 text-[10px] text-muted"><I size={17} className="text-navy" />{l}</Link>)}</div>
        </Card>
      {people.length > 0 && <Card title="Your family"><div className="flex gap-3 flex-wrap">{people.map((n: string, i: number) => <div key={n + i} className="text-center"><span className="h-11 w-11 rounded-full grid place-items-center text-xs font-semibold text-white shadow-clay" style={{ background: `linear-gradient(135deg,${tint[i % 5]},#1A5876)` }}>{n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span><div className="text-[10px] text-muted mt-1 max-w-[52px] truncate">{n.split(" ")[0]}</div></div>)}</div></Card>}
      <Card title="Next actions" right={<Link to="/client/insights" className="text-[11px] text-muted hover:text-navy">View all</Link>}>
        <ul className="space-y-3">{actions.map((a: any) => { const S = SEV[a.severity]; const I = S.icon; return (<li key={a.id} className="flex items-center gap-3"><span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${S.cls}`}><I size={16} /></span><div className="min-w-0 flex-1"><div className="text-xs font-medium text-navy truncate">{a.title}</div><div className="text-[11px] text-muted truncate">{a.action}</div></div><span className="text-[10px] text-muted">{a.severity}</span></li>); })}</ul>
      </Card>
      <Card title="Coming up" sub="Your next goals by year">
        <ul className="space-y-3">{upcoming.map((g: any) => { const inY = g.startYear - r.meta.planYear; const dot = ({ Met: "#6FAE57", "Partially met": "#E2A83B", "Not met": "#D1604D" } as any)[g.status] ?? "#9AA7C4"; return (<li key={g.name} className="flex items-center gap-3"><span className="h-10 w-10 rounded-2xl grid place-items-center text-[11px] font-semibold text-navy shrink-0 bg-[#F4EBD3]">{g.startYear}</span><div className="min-w-0 flex-1"><div className="text-xs font-medium text-navy truncate">{g.name}</div><div className="text-[11px] text-muted">{inY <= 0 ? "This year" : `in ${inY} year${inY === 1 ? "" : "s"}`} · {inr(g.futureValue)}</div></div><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: dot }} title={String(g.status)} /></li>); })}</ul>
        <Link to="/client/goals" className="block text-center text-[11px] text-muted hover:text-navy mt-3">All goals →</Link>
      </Card>
    </aside>

    {/* the plan in pictures: the same charts and flow diagrams as the Financial plan, full width so they stay legible */}
    <section className="xl:col-span-2 grid grid-cols-[minmax(0,1fr)] gap-5 min-w-0">
      <div><h2 className="font-serif text-2xl text-navy">Your plan in pictures</h2><p className="text-xs text-muted">The same diagrams as your Financial plan, drawn from your latest figures.</p></div>
      <Reveal minH={260}><Card title="How your plan fits together" sub="From today's position to your goals"><PlanFlowchart r={r} /></Card></Reveal>
      <div className="grid xl:grid-cols-2 gap-5">
        <Reveal fill delay={0.05} minH={300}><Card title="Where your income goes" sub="Next year, from income to outgoings and savings"><div className="flex flex-col justify-center"><CashflowFlow cf={r.cashflow.nextYear} compact /></div></Card></Reveal>
        <Reveal fill delay={0.12} minH={300}><Card title="How your goals are funded" sub="Which assets and savings pay for each goal"><div className="flex flex-col justify-center min-h-[300px]"><GoalFlow goals={r.goals} compact /></div></Card></Reveal>
      </div>
      <Reveal minH={420}><Card title="How each goal is funded" sub="The same funding charts as your Financial plan, goal by goal">
        <div className="flex flex-wrap gap-1.5 mb-4">{r.goals.map((g: any, i: number) => <button key={g.name + i} onClick={() => setGSel(i)} className={`px-3 py-1.5 rounded-full text-xs border transition ${gSel === i ? "bg-navy text-white border-navy shadow-md" : "bg-white/70 border-white text-muted hover:text-navy"}`}>{g.name}</button>)}</div>
        {sel && <div key={gSel} style={{ animation: "mw-rise .5s both" }}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><h3 className="font-serif text-xl text-navy">{sel.name}</h3><span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: sel.status === "Met" ? "#DDF0D3" : sel.status === "Partially met" ? "#FBEBC8" : "#F6D9D3", color: sel.status === "Met" ? "#3C7A28" : sel.status === "Partially met" ? "#8A6A12" : "#A33C2B" }}>{sel.status} · {sel.fundedPct}% funded</span></div>
          <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
            <ul className="text-sm divide-y divide-black/5 self-start">{[["Today's value", inr(sel.todayValue)], ["Goal year(s)", sel.startYear + (sel.endYear !== sel.startYear ? `–${sel.endYear}` : "")], ["Inflation", `${sel.inflation}%`], ["Total future value", inr(sel.futureValue)], ["Expected return", `${sel.portfolioReturnPct}%`], ["Monthly investment (next year)", sel.monthlyInvestmentNext > 0 ? inr(sel.monthlyInvestmentNext) : "None needed"]].map(([k, v]) => <li key={k} className="flex justify-between gap-3 py-2.5"><span className="text-muted">{k}</span><b className="text-navy tabular-nums text-right">{v}</b></li>)}</ul>
            <GoalChart series={sel.series} animate />
          </div></div>}
      </Card></Reveal>
      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5">
        <Reveal fill delay={0.05}><Card title="What you own" sub="Net worth by asset group"><NetWorthDonut groups={r.netWorth.groups} total={r.netWorth.total} />
          {holdings.length > 0 && <div className="mt-5 pt-4 border-t border-black/5"><div className="text-xs font-semibold text-navy mb-3">Biggest holdings</div>
            <ul className="space-y-3">{holdings.map((a: any, i: number) => <li key={a.asset}><div className="flex justify-between gap-2 text-xs"><span className="truncate text-ink">{a.asset}</span><b className="tabular-nums text-navy shrink-0">{inr(a.nominal)}</b></div>
              <div className="progress h-1.5 mt-1.5"><i style={{ width: `${Math.max(3, (a.nominal / holdings[0].nominal) * 100)}%`, background: tint[i % tint.length], animation: "mw-fade .8s both" }} /></div>
              <div className="text-[10px] text-muted mt-1">{a.usedForGoals > 0 ? `${Math.round((a.usedForGoals / a.nominal) * 100)}% earmarked for goals` : "Not earmarked for goals"}</div></li>)}</ul></div>}
        </Card></Reveal>
        <Reveal fill delay={0.12}><Card title="Goal timeline" sub="When each goal falls due and whether it is met"><GoalTimeline goals={r.goals} />
          <div className="mt-5 pt-4 border-t border-black/5"><div className="text-xs font-semibold text-navy mb-3">Goal status</div>
            <div className="grid grid-cols-3 gap-3">{statusCount.map(([label, n, c]: any) => <div key={label} className="rounded-2xl bg-white/70 border border-white p-3 text-center"><div className="text-2xl font-semibold tabular-nums" style={{ color: c }}>{n}</div><div className="text-[11px] text-muted mt-0.5">{label}</div></div>)}</div>
            <div className="mt-4 h-2.5 rounded-full overflow-hidden flex gap-0.5">{statusCount.map(([label, n, c]: any) => n > 0 && <i key={label} style={{ width: `${(n / (r.goals.length || 1)) * 100}%`, background: c, animation: "mw-fade .8s both" }} />)}</div>
            <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs"><li className="flex justify-between"><span className="text-muted">Total goal value</span><b className="text-navy tabular-nums">{inr(goalTotal)}</b></li><li className="flex justify-between"><span className="text-muted">Funded from plan</span><b className="text-navy tabular-nums">{r.summary.goalsMet}/{r.summary.goalsTotal} met</b></li><li className="flex justify-between"><span className="text-muted">First goal</span><b className="text-navy">{firstY}</b></li><li className="flex justify-between"><span className="text-muted">Last goal</span><b className="text-navy">{lastY}</b></li></ul>
          </div></Card></Reveal>
      </div>
    </section>
  </div>);
}
