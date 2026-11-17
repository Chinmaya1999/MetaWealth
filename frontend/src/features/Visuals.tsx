import { useEffect, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { inr } from "../lib/format";

const COL = ["#55B848", "#6D86B9", "#9CC27A", "#F0B38A", "#9AA7C4", "#E8CE92", "#B99BD6"];
const STATUS_COL: Record<string, string> = { Met: "#6FAE57", "Partially met": "#E2A83B", "Not met": "#D1604D" };
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Where each rupee of next year's income goes: a flow (Sankey-style) diagram. */
export function CashflowFlow({ cf, compact = false }: { cf: any; compact?: boolean }) {
  const items = ([["Living expenses", cf.livingExpenses, "#55B848"], ["Loan EMIs", cf.loanEmis, "#E8CE92"], ["Insurance premiums", cf.insurancePremiums, "#F0B38A"], ["Taxes", cf.taxes, "#9AA7C4"], ["Savings (PF etc.)", num(cf.committedSavingsPF) + num(cf.otherCommittedSavings), "#6D86B9"], ["Free surplus", Math.max(0, num(cf.discretionarySurplus)), "#9CC27A"]] as [string, number, string][]).filter((i) => num(i[1]) > 0);
  const total = items.reduce((s, i) => s + num(i[1]), 0) || 1, LH = compact ? 190 : 230, top = 34, MINR = 20, GAPR = compact ? 12 : 14, EX = compact ? 290 : 560, W = compact ? 470 : 760;
  let ly = top, ry = top;
  const rows = items.map(([name, v, col]) => { const hl = Math.max(2, (num(v) / total) * LH), hr = Math.max(MINR, hl); const row = { name, v: num(v), col, hl, hr, ly, ry }; ly += hl; ry += hr + GAPR; return row; });
  const Hs = Math.max(ly, ry) + 16;
  return (<svg viewBox={`0 0 ${W} ${Hs}`} className="w-full" role="img" aria-label="Where your income goes">
    <rect x="0" y={top} width="16" height={LH} rx="6" fill="#1A5876" />
    <text x="0" y="14" fontSize="12" fill="#1A5876" fontWeight="600">Income</text><text x="0" y="28" fontSize="11" fill="#6B7280">{inr(cf.income)}</text>
    {rows.map((r, i) => (<g key={r.name}>
      <path d={`M 16 ${r.ly + r.hl / 2} C ${EX * 0.5} ${r.ly + r.hl / 2}, ${EX * 0.6} ${r.ry + r.hr / 2}, ${EX} ${r.ry + r.hr / 2}`} fill="none" stroke={r.col} strokeOpacity=".55" strokeWidth={r.hl} pathLength="1" strokeDasharray="1" style={{ animation: `mw-draw 1.1s ${i * 0.12}s both ease-out` }} />
      <rect x={EX} y={r.ry} width="14" height={r.hr} rx="5" fill={r.col} />
      <text x={EX + 24} y={r.ry + r.hr / 2 - 1} fontSize="12" fill="#1A5876" fontWeight="500">{r.name}</text><text x={EX + 24} y={r.ry + r.hr / 2 + 12} fontSize="11" fill="#6B7280">{inr(r.v)} · {Math.round((r.v / total) * 100)}%</text>
    </g>))}
  </svg>);
}

/** Sources of money -> funding waterfall -> each goal, coloured by whether it is met. */
export function GoalFlow({ goals, compact = false }: { goals: any[]; compact?: boolean }) {
  const list = (goals ?? []).filter((g) => g.category !== "emergency" || true).slice(0, 9);
  const sum = (f: (g: any) => number) => list.reduce((s, g) => s + num(f(g)), 0);
  const src = ([["Existing assets", sum((g) => (g.fromAssets ?? []).reduce((s: number, a: any) => s + num(a.amount), 0)), "#F4A6B7"], ["This year's surplus", sum((g) => g.currentYearSurplus), "#8E6CFF"], ["Planned loans", sum((g) => g.loan?.amount), "#9AA7C4"], ["Monthly investing (a year)", sum((g) => num(g.monthlyInvestmentNext) * 12), "#55B848"]] as [string, number, string][]).filter((s) => s[1] > 0);
  if (!list.length || !src.length) return null;
  const H = Math.max(260, list.length * 36), total = src.reduce((s, x) => s + x[1], 0) || 1;
  const sy = (i: number) => 30 + i * ((H - 60) / Math.max(1, src.length - 1 || 1)), gy = (i: number) => 18 + i * ((H - 36) / Math.max(1, list.length - 1));
  const midY = H / 2; const bw = compact ? 150 : 168, hx = compact ? 215 : 300, hw = compact ? 110 : 120, gx = compact ? 372 : 548, gw = compact ? 188 : 212, W = gx + gw, he = hx + hw;
  return (<svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="How your goals are funded">
    {src.map(([n, v, c], i) => { const y = src.length === 1 ? midY : sy(i); const w = Math.max(3, (v / total) * 26); return (<g key={n}>
      <path d={`M ${bw} ${y} C ${bw + 62} ${y}, ${hx - 50} ${midY}, ${hx} ${midY}`} fill="none" stroke={c} strokeOpacity=".6" strokeWidth={w} pathLength="1" strokeDasharray="1" style={{ animation: `mw-draw 1s ${i * 0.12}s both ease-out` }} />
      <rect x="0" y={y - 20} width={bw} height="40" rx="12" fill="#fff" stroke={c} strokeWidth="1.5" /><text x="12" y={y - 3} fontSize="11.5" fill="#1A5876" fontWeight="600">{n}</text><text x="12" y={y + 12} fontSize="11" fill="#6B7280">{inr(v)}</text></g>); })}
    <rect x={hx} y={midY - 46} width={hw} height="92" rx="18" fill="#1A5876" /><text x={hx + hw / 2} y={midY - 8} textAnchor="middle" fontSize="12" fill="#8FD584" fontWeight="600">Goal funding</text><text x={hx + hw / 2} y={midY + 10} textAnchor="middle" fontSize="11" fill="#fff">waterfall</text><text x={hx + hw / 2} y={midY + 28} textAnchor="middle" fontSize="10" fill="#9AA7C4">by priority</text>
    {list.map((g, i) => { const y = list.length === 1 ? midY : gy(i); const c = STATUS_COL[g.status] ?? "#9AA7C4"; return (<g key={g.name + i}>
      <path d={`M ${he} ${midY} C ${he + 60} ${midY}, ${gx - 48} ${y}, ${gx} ${y}`} fill="none" stroke={c} strokeOpacity=".55" strokeWidth="5" pathLength="1" strokeDasharray="1" style={{ animation: `mw-draw 1s ${0.4 + i * 0.07}s both ease-out` }} />
      <rect x={gx} y={y - 15} width={gw} height="30" rx="10" fill="#fff" stroke={c} strokeWidth="1.5" /><text x={gx + 10} y={y + 4} fontSize="11.5" fill="#1A5876">{String(g.name).slice(0, compact ? 21 : 22)}</text><text x={gx + gw - 10} y={y + 4} textAnchor="end" fontSize="11" fontWeight="600" fill={c}>{g.fundedPct}%</text></g>); })}
  </svg>);
}

/** The path a plan takes, with the headline number from each stage. */
export function PlanFlowchart({ r }: { r: any }) {
  const goalsMet = `${num(r.summary?.goalsMet)}/${num(r.summary?.goalsTotal)} goals met`;
  const steps: [string, string, string][] = [
    ["Cashflow", `${inr(r.cashflow?.nextYear?.discretionarySurplus)} surplus`, "#9CC27A"], ["Net worth", inr(r.netWorth?.total), "#6D86B9"], ["Goals", goalsMet, "#55B848"],
    ["Retirement", `${num(r.retirement?.readinessPct)}% ready`, "#F0B38A"], ["Insurance", r.insurance?.coverGap > 0 ? `${inr(r.insurance.coverGap)} gap` : "Covered", "#9AA7C4"],
    ["Advice", `${(r.insights ?? []).length} insights`, "#B99BD6"],
  ];
  return (<ol className="flex flex-wrap items-stretch gap-y-3">{steps.map(([t, v, c], i) => (<li key={t} className="flex items-center">
    <div className="rounded-2xl bg-white/80 border border-white shadow-clay px-3 py-3 min-w-[110px]" style={{ borderTop: `4px solid ${c}`, animation: `mw-rise .5s ${i * 0.09}s both` }}><div className="text-[10px] tracking-widest text-muted">STEP {i + 1}</div><div className="font-semibold text-navy text-sm">{t}</div><div className="text-xs text-muted mt-0.5">{v}</div></div>
    {i < steps.length - 1 && <svg width="28" height="14" viewBox="0 0 28 14" className="mx-1 text-gold shrink-0" aria-hidden><path d="M0 7h22M17 2l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</li>))}</ol>);
}

export function Gauge({ label, pct, sub, color = "#55B848" }: { label: string; pct: number; sub?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, num(pct))), c = 2 * Math.PI * 34;
  return (<div className="text-center"><div className="relative mx-auto w-24 h-24"><svg viewBox="0 0 80 80" className="-rotate-90"><circle cx="40" cy="40" r="34" fill="none" stroke="#E7E4DB" strokeWidth="9" /><circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} style={{ transition: "stroke-dasharray 1s" }} /></svg><div className="absolute inset-0 grid place-items-center text-lg font-semibold text-navy tabular-nums">{Math.round(v)}%</div></div><div className="text-xs font-medium text-navy mt-1">{label}</div>{sub && <div className="text-[10px] text-muted">{sub}</div>}</div>);
}

const humanize = (k: string) => { const t = k.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
export function NetWorthDonut({ groups, total }: { groups: Record<string, number>; total: number }) {
  const data = Object.entries(groups ?? {}).map(([name, value]) => ({ name, value: num(value) })).filter((x) => x.value > 0);
  return (<div className="grid sm:grid-cols-[190px_minmax(0,1fr)] gap-4 items-center"><div className="relative h-[190px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={86} paddingAngle={2} isAnimationActive={false}>{data.map((_, i) => <Cell key={i} fill={COL[i % COL.length]} />)}</Pie><Tooltip formatter={(v: any) => inr(v)} /></PieChart></ResponsiveContainer>
    <div className="absolute inset-0 grid place-items-center pointer-events-none text-center"><div><div className="text-[10px] text-muted">Net worth</div><div className="font-semibold text-navy">{inr(total)}</div></div></div></div>
    <ul className="text-sm space-y-1.5">{data.map((d, i) => <li key={d.name} className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COL[i % COL.length] }} /><span className="flex-1 min-w-0">{humanize(d.name)}</span><b className="tabular-nums">{inr(d.value)}</b></li>)}</ul></div>);
}

/** Time line of goals by year, coloured by status. */
export function GoalTimeline({ goals }: { goals: any[] }) {
  const list = [...(goals ?? [])].filter((g) => num(g.startYear)).sort((a, b) => a.startYear - b.startYear);
  if (!list.length) return null;
  const min = list[0].startYear, max = Math.max(...list.map((g) => g.endYear ?? g.startYear)), span = Math.max(1, max - min), rowH = 26, H = list.length * rowH + 34;
  const x = (yr: number) => 150 + ((yr - min) / span) * 570;
  return (<svg viewBox={`0 0 760 ${H}`} className="w-full" role="img" aria-label="Goal timeline">
    {Array.from({ length: Math.min(8, span + 1) }, (_, i) => Math.round(min + (i * span) / Math.min(7, span || 1))).filter((v, i, a) => a.indexOf(v) === i).map((yr) => <g key={yr}><line x1={x(yr)} x2={x(yr)} y1="18" y2={H} stroke="#0001" /><text x={x(yr)} y="12" textAnchor="middle" fontSize="10" fill="#6B7280">{yr}</text></g>)}
    {list.map((g, i) => { const y = 28 + i * rowH, c = STATUS_COL[g.status] ?? "#9AA7C4", x1 = x(g.startYear), x2 = Math.max(x1 + 8, x(g.endYear ?? g.startYear)); return (<g key={g.name + i}><text x="0" y={y + 12} fontSize="11" fill="#1A5876">{String(g.name).slice(0, 24)}</text><rect x={x1} y={y} width={x2 - x1} height="16" rx="8" fill={c} fillOpacity=".85" style={{ transformOrigin: `${x1}px 0`, animation: `mw-rise .5s ${i * 0.05}s both` }} /></g>); })}
  </svg>);
}

/** Mounts its children (and so starts their drawing animations) only when scrolled into view. */
export function Reveal({ children, delay = 0, minH = 200, fill = false }: { children: React.ReactNode; delay?: number; minH?: number; fill?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.15 }); io.observe(el); const pr = () => setOn(true); window.addEventListener("beforeprint", pr); return () => { io.disconnect(); window.removeEventListener("beforeprint", pr); };
  }, []);
  return <div ref={ref} className={fill ? "h-full" : ""} style={{ minHeight: on ? undefined : minH }}>{on && <div className={fill ? "h-full" : ""} style={{ animation: `mw-rise .7s ${delay}s both cubic-bezier(.2,.7,.2,1)` }}>{children}</div>}</div>;
}

