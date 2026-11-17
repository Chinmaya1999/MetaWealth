import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Plus, Users } from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../stores/auth";
import { EmptyState, PageHeader } from "../../components/ui";
import CalcPage from "../../features/CalcPage";
import Wizard from "../../features/Wizard";
import NriPlanner from "../../features/NriPlanner";
import PlansPanel from "../../features/PlansPanel";
import { inr } from "../../lib/format";

const PLAN_CLS: any = { draft: "bg-amber-100 text-warning", in_review: "bg-blue-100 text-blue-700", approved: "bg-teal-100 text-teal-700", released: "bg-green-100 text-success", rejected: "bg-red-100 text-danger" };
const STATUS_LABEL = (x: string) => x.replace(/_/g, " ");
const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const progressOf = (done: number[]) => Math.round((done.filter((s) => s !== 1).length / 8) * 100);
const base = () => (["admin", "super_admin"].includes(useAuth.getState().user?.role ?? "") ? "/admin" : "/advisor");
const isAdmin = () => base() === "/admin";
const useClients = (params: Record<string, string | undefined> = {}) => useQuery({ queryKey: ["clients", params], queryFn: async () => (await api.get("/clients", { params })).data as { items: any[]; scope: string } });

const Kpi = ({ label, value, sub, tone }: { label: string; value: any; sub?: string; tone?: string }) => (
  <div className="clay p-3 sm:p-4"><div className="text-[11px] text-muted">{label}</div><div className={`text-xl sm:text-2xl font-semibold tabular-nums mt-1 ${tone ?? "text-navy"}`}>{value}</div>{sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}</div>
);
const PlanChip = ({ plan }: { plan: any }) => plan ? (<div className="leading-tight"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${PLAN_CLS[plan.status]}`}>v{plan.version} {STATUS_LABEL(plan.status)}</span>{plan.releasedVersion && plan.status !== "released" && <div className="text-[10px] text-muted mt-1">released v{plan.releasedVersion}</div>}</div>) : <span className="text-xs text-muted">No plan yet</span>;

function Summary({ items }: { items: any[] }) {
  const nw = items.reduce((s, c) => s + (c.calc?.netWorth ?? 0), 0), urgent = items.reduce((s, c) => s + (c.calc?.urgent ?? 0), 0);
  const action = items.filter((c) => c.status === "ready_for_review" || ["draft", "in_review", "approved"].includes(c.plan?.status)).length;
  return (<div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-5">
    <Kpi label="Clients" value={items.length} sub={`${items.filter((c) => /NRI/.test(c.residency)).length} NRI · ${items.filter((c) => !/NRI/.test(c.residency)).length} resident`} />
    <Kpi label="Combined net worth" value={inr(nw)} sub="latest calculation per client" />
    <Kpi label="Plans needing action" value={action} sub="ready for review, draft, in review or approved" />
    <Kpi label="Urgent alerts" value={urgent} tone={urgent ? "text-danger" : undefined} sub="open urgent insights" />
  </div>);
}

export function AdvisorHome() {
  const { user } = useAuth(); const list = useClients(); const items = list.data?.items ?? [];
  const attention = [...items].sort((a, b) => (Number(b.status === "ready_for_review") - Number(a.status === "ready_for_review")) || ((b.calc?.urgent ?? 0) - (a.calc?.urgent ?? 0))).slice(0, 6);
  return (<><PageHeader title={`Welcome, ${user?.name.split(" ")[0] ?? ""}`} subtitle={list.data?.scope === "mine" ? "Your clients and their plans. Only clients assigned to you are shown." : "All clients across advisors."} />
    <Summary items={items} />
    <div className="clay p-5">
      <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-navy">Needs your attention</h3><Link to={`${base()}/clients`} className="text-xs text-muted hover:text-navy">All clients →</Link></div>
      {items.length === 0 ? <EmptyState title="No clients assigned to you yet" body="Create a client to begin. Each client you create is assigned to you." /> : (
        <ul className="divide-y divide-black/5">{attention.map((c) => (
          <li key={c._id}><Link to={`${base()}/clients/${c._id}`} className="flex items-center gap-4 py-3 hover:bg-white/50 rounded-2xl px-2 -mx-2">
            <span className="h-10 w-10 rounded-full grid place-items-center text-xs font-semibold text-white shrink-0" style={{ background: "linear-gradient(135deg,#1A5876,#55B848)" }}>{initials(c.name)}</span>
            <div className="min-w-0 flex-1"><div className="text-sm font-medium text-navy truncate">{c.name}</div><div className="text-[11px] text-muted">{c.residency} · {STATUS_LABEL(c.status)} · questionnaire {progressOf(c.stepsDone)}%</div></div>
            <div className="hidden md:block w-28"><PlanChip plan={c.plan} /></div>
            <div className="hidden md:block w-24 text-right text-sm tabular-nums">{c.calc ? inr(c.calc.netWorth) : "—"}</div>
            <div className="hidden lg:block w-20 text-right text-xs text-muted">{c.calc ? `${c.calc.goalsMet}/${c.calc.goalsTotal} goals` : ""}</div>
            <div className="w-16 text-right">{c.calc?.urgent > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger"><AlertTriangle size={12} />{c.calc.urgent}</span>}</div>
            <ChevronRight size={16} className="text-muted" /></Link></li>))}</ul>)}
    </div></>);
}

export function Clients() {
  const nav = useNavigate(); const qc = useQueryClient(); const { user } = useAuth(); const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [res, setRes] = useState("");
  const [showNew, setShowNew] = useState(sp.get("new") === "1"); useEffect(() => { setShowNew(sp.get("new") === "1"); }, [sp]);
  const list = useClients({ q: q || undefined, status: status || undefined, residency: res || undefined }); const items = list.data?.items ?? [];
  const staff = useStaff(); const [form, setForm] = useState<any>({ name: "", email: "", residency: "Resident Indian" }); const [inv, setInv] = useState<any>(null); const [err, setErr] = useState("");
  const create = useMutation({ mutationFn: async () => (await api.post("/clients", form)).data, onSuccess: (d) => { setInv(d.invitation); setErr(""); setForm({ name: "", email: "", residency: "Resident Indian" }); qc.invalidateQueries({ queryKey: ["clients"] }); qc.invalidateQueries({ queryKey: ["stats"] }); }, onError: (e: any) => setErr(e.response?.data?.error?.message ?? "Could not create client") });
  const inp = "border border-white bg-white/80 rounded-2xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/50";
  const mine = list.data?.scope === "mine";
  return (<><div className="flex flex-wrap items-start justify-between gap-3 mb-4"><PageHeader title={mine ? "My clients" : "All clients"} subtitle={mine ? "Only clients assigned to you, with their plan details." : `All clients across advisors (${user?.role.replace("_", " ")} view).`} />
      <button onClick={() => { const n = !showNew; setShowNew(n); setSp(n ? { new: "1" } : {}); }} className="pill-btn inline-flex items-center gap-2"><Plus size={15} /> New client</button></div>
    <Summary items={items} />
    {showNew && <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="clay p-4 mb-5 flex flex-wrap gap-3 items-end">
      <label className="text-xs text-muted">Name<br /><input required minLength={2} className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label className="text-xs text-muted">Email<br /><input required type="email" className={inp} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label className="text-xs text-muted">Residency<br /><select className={inp} value={form.residency} onChange={(e) => setForm({ ...form, residency: e.target.value })}>{["Resident Indian", "NRI - USA", "NRI - UAE", "NRI - UK", "Returning NRI"].map((o) => <option key={o}>{o}</option>)}</select></label>
      {isAdmin() && <label className="text-xs text-muted">Advisor<br /><select className={inp} value={form.advisorId ?? ""} onChange={(e) => setForm({ ...form, advisorId: e.target.value || undefined })}><option value="">Me</option>{(staff.data ?? []).filter((u) => u.role !== "client" && u.isActive).map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></label>}
      <button className="pill-btn">Create & invite</button>{err && <span className="text-danger text-sm">{err}</span>}
      <p className="w-full text-[11px] text-muted">The new client is assigned to the chosen advisor (you, by default); only that advisor (and reviewers/admins) can see them.</p></form>}
    {inv && <div className="clay p-3 mb-5 text-sm border-l-4 border-gold">Invitation for <b>{inv.email}</b> — temporary password <code className="bg-white px-1.5 py-0.5 rounded">{inv.temporaryPassword}</code>. {inv.note}</div>}
    <div className="flex flex-wrap gap-3 mb-4"><input placeholder="Search client name" className={inp} value={q} onChange={(e) => setQ(e.target.value)} />
      <select className={inp} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["invited", "data_gathering", "ready_for_review", "draft", "released", "renewal_due"].map((s) => <option key={s} value={s}>{STATUS_LABEL(s)}</option>)}</select>
      <select className={inp} value={res} onChange={(e) => setRes(e.target.value)}><option value="">Resident + NRI</option><option>Resident Indian</option><option>NRI - USA</option><option>NRI - UAE</option><option>NRI - UK</option></select></div>
    {items.length === 0 ? <EmptyState title="No clients match" body={mine ? "You have no clients matching these filters. Create one with New client." : "No clients match these filters."} /> : (<>
      <ul className="md:hidden space-y-3">{items.map((c) => { const k = c.calc; return (<li key={c._id}><Link to={`${base()}/clients/${c._id}`} className="clay block p-4">
        <div className="flex items-center gap-3"><span className="h-10 w-10 rounded-full grid place-items-center text-xs font-semibold text-white shrink-0" style={{ background: "linear-gradient(135deg,#1A5876,#55B848)" }}>{initials(c.name)}</span><div className="min-w-0 flex-1"><div className="font-medium text-navy truncate">{c.name}</div><div className="text-[11px] text-muted truncate">{c.residency} · {c.email}</div></div>{k?.urgent > 0 && <span className="inline-grid place-items-center h-6 min-w-6 px-1.5 rounded-full bg-red-100 text-danger text-xs font-semibold">{k.urgent}</span>}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-xs"><div><div className="text-muted">Plan</div><PlanChip plan={c.plan} /></div><div><div className="text-muted">Net worth</div><b className="text-navy">{k ? inr(k.netWorth) : "—"}</b></div><div><div className="text-muted">Goals met</div><b className="text-navy">{k ? `${k.goalsMet}/${k.goalsTotal}` : "—"}</b></div><div><div className="text-muted">Risk band</div>{k?.band ?? "—"}</div></div>
        <div className="progress h-1.5 mt-3"><i style={{ width: `${progressOf(c.stepsDone)}%` }} /></div><div className="text-[10px] text-muted mt-1">Questionnaire {progressOf(c.stepsDone)}%</div>
        {isAdmin() && <div className="mt-2 text-[11px] text-muted" onClick={(e) => e.preventDefault()}>Advisor <AdvisorSelect clientId={c._id} value={String(c.advisorId)} /></div>}</Link></li>); })}</ul>
      <div className="clay overflow-x-auto hidden md:block"><table className="w-full text-sm min-w-[1200px]"><thead><tr className="text-left text-[11px] text-muted"><th className="p-3 pl-5">Client</th>{isAdmin() && <th>Advisor</th>}<th>Questionnaire</th><th>Plan</th><th className="text-right">Net worth</th><th>Goals met</th><th>Risk band</th><th>Retirement</th><th className="text-center">Urgent</th><th>Updated</th><th /></tr></thead>
        <tbody>{items.map((c) => { const k = c.calc; const pg = progressOf(c.stepsDone); return (
          <tr key={c._id} onClick={() => nav(`${base()}/clients/${c._id}`)} className="border-t border-black/5 hover:bg-white/60 cursor-pointer">
            <td className="p-3 pl-5"><div className="flex items-center gap-3"><span className="h-9 w-9 rounded-full grid place-items-center text-[11px] font-semibold text-white shrink-0" style={{ background: "linear-gradient(135deg,#1A5876,#55B848)" }}>{initials(c.name)}</span><div><Link onClick={(e) => e.stopPropagation()} className="font-medium text-navy" to={`${base()}/clients/${c._id}`}>{c.name}</Link><div className="text-[11px] text-muted">{c.residency} · {c.email}</div></div></div></td>
            {isAdmin() && <td onClick={(e) => e.stopPropagation()}><AdvisorSelect clientId={c._id} value={String(c.advisorId)} /></td>}
            <td className="w-36"><div className="progress h-2"><i style={{ width: `${pg}%` }} /></div><div className="text-[10px] text-muted mt-1">{pg}% · {STATUS_LABEL(c.status)}</div></td>
            <td><PlanChip plan={c.plan} /></td>
            <td className="text-right tabular-nums">{k ? inr(k.netWorth) : "—"}</td>
            <td>{k ? <><b className="text-navy">{k.goalsMet}</b><span className="text-muted">/{k.goalsTotal}</span></> : "—"}</td>
            <td className="text-xs">{k?.band ?? "—"}</td>
            <td className="tabular-nums">{k ? `${k.readiness}%` : "—"}</td>
            <td className="text-center">{k?.urgent > 0 ? <span className="inline-grid place-items-center h-6 min-w-6 px-1.5 rounded-full bg-red-100 text-danger text-xs font-semibold">{k.urgent}</span> : <span className="text-muted">{k ? "0" : "—"}</span>}</td>
            <td className="text-xs text-muted">{new Date(c.updatedAt).toLocaleDateString("en-GB")}</td><td className="pr-4"><ChevronRight size={16} className="text-muted" /></td></tr>); })}</tbody></table></div></>)}
    <p className="text-[11px] text-muted mt-3 flex items-center gap-1.5"><Users size={12} /> {items.length} client{items.length === 1 ? "" : "s"} shown{mine ? " — your assigned clients only" : ""}.</p></>);
}

const TABS = [["overview", "Overview"], ["goals", "Goals"], ["cashflow", "Cashflow"], ["retirement", "Retirement"], ["insurance", "Insurance"], ["portfolio", "Portfolio"], ["insights", "Insights"], ["questionnaire", "Questionnaire"], ["risk", "Risk & scenarios"], ["nri", "NRI planner"], ["plans", "Plans"]];
export function ClientDetail() {
  const { id } = useParams(); const [tab, setTab] = useState("overview");
  const c = useQuery({ queryKey: ["client", id], queryFn: async () => (await api.get(`/clients/${id}`)).data.client });
  const calc = useQuery({ queryKey: ["calc", id], queryFn: async () => (await api.get(`/clients/${id}/calculations/latest`)).data });
  const plans = useQuery({ queryKey: ["plans", id], queryFn: async () => (await api.get(`/clients/${id}/plans`)).data.items as any[] });
  if (!c.data) return <div className="text-muted">Loading…</div>;
  const r = calc.data?.result, latest = plans.data?.[0], released = plans.data?.find((p) => p.status === "released");
  return (<><div className="mb-1"><Link to={`${base()}/clients`} className="text-xs text-muted hover:text-navy">← Clients</Link></div>
    {isAdmin() && <AdminClientBar client={c.data} />}
    <PageHeader title={c.data.name} subtitle={`${c.data.residency} · ${c.data.email} · ${STATUS_LABEL(c.data.status)} · questionnaire ${progressOf(c.data.stepsDone)}%`} />
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
      <Kpi label="Net worth" value={r ? inr(r.netWorth.total) : "—"} />
      <Kpi label="Goals met" value={r ? `${r.summary.goalsMet}/${r.summary.goalsTotal}` : "—"} />
      <Kpi label="Risk profile" value={<span className="text-base">{r?.risk?.band ?? "—"}</span>} sub={r?.risk ? `score ${r.risk.score}/40` : undefined} />
      <Kpi label="Retirement readiness" value={r ? `${r.retirement.readinessPct}%` : "—"} />
      <Kpi label="Urgent alerts" value={r ? r.insights.filter((i: any) => i.severity === "Urgent").length : "—"} tone={r && r.insights.some((i: any) => i.severity === "Urgent") ? "text-danger" : undefined} />
      <Kpi label="Plan" value={<span className="text-base">{latest ? `v${latest.version} ${STATUS_LABEL(latest.status)}` : "None"}</span>} sub={released ? `released v${released.version}` : undefined} />
    </div>
    <div className="flex flex-wrap gap-1.5 mb-5">{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-1.5 rounded-full text-xs border transition ${tab === k ? "bg-navy text-white border-navy shadow-md" : "bg-white/70 border-white text-muted hover:text-navy"}`}>{l}</button>)}</div>
    {tab === "questionnaire" ? <Wizard clientId={id!} /> : tab === "plans" ? <PlansPanel clientId={id!} /> : tab === "risk" ? <RiskScenarios clientId={id!} /> : tab === "nri" ? <NriPlanner clientId={id!} /> : <CalcPage key={tab} clientId={id!} section={tab} />}</>);
}

function RiskScenarios({ clientId }: { clientId: string }) {
  const [band, setBand] = useState("Moderately Conservative"); const [reason, setReason] = useState(""); const [msg, setMsg] = useState("");
  const [sc, setSc] = useState({ retirementAge: 60, savingsBoostPct: 0, returnShift: 0 }); const [out, setOut] = useState<any>(null);
  const inp = "border border-line rounded-md px-3 py-2 bg-white text-sm";
  const row = (l: string, a: any, b: any) => <tr className="border-t border-line"><td className="py-1.5">{l}</td><td className="text-right">{a}</td><td className="text-right font-medium">{b}</td></tr>;
  return (<div className="grid lg:grid-cols-2 gap-5">
    <section className="clay p-5"><h3 className="font-serif text-lg mb-3">Advisor risk-band override</h3><p className="text-xs text-muted mb-3">One band up or down only; a reason is mandatory and is printed in the plan.</p>
      <select className={inp + " mb-2 w-full"} value={band} onChange={(e) => setBand(e.target.value)}>{["Conservative", "Moderately Conservative", "Balanced", "Growth", "Aggressive"].map((b) => <option key={b}>{b}</option>)}</select>
      <textarea className={inp + " w-full"} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="mt-2 px-4 py-2 bg-navy text-white rounded-md" onClick={async () => { try { await api.post(`/clients/${clientId}/risk-profiler/override`, { band, reason }); setMsg("Override saved. Recalculate to apply."); } catch (e: any) { setMsg(e.response?.data?.error?.message ?? "Failed"); } }}>Save override</button><p className="text-sm mt-2">{msg}</p></section>
    <section className="clay p-5"><h3 className="font-serif text-lg mb-3">What-if scenario</h3>
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs text-muted"><label>Retirement age<input type="number" className={inp + " w-full"} value={sc.retirementAge} onChange={(e) => setSc({ ...sc, retirementAge: +e.target.value })} /></label><label>Cut expenses %<input type="number" className={inp + " w-full"} value={sc.savingsBoostPct} onChange={(e) => setSc({ ...sc, savingsBoostPct: +e.target.value })} /></label><label>Equity return ± pts<input type="number" step="0.5" className={inp + " w-full"} value={sc.returnShift} onChange={(e) => setSc({ ...sc, returnShift: +e.target.value })} /></label></div>
      <button className="px-4 py-2 bg-navy text-white rounded-md" onClick={async () => setOut((await api.post(`/clients/${clientId}/scenarios`, sc)).data)}>Compare</button>
      {out && <table className="w-full text-sm mt-3"><thead><tr className="text-xs text-muted text-left"><th /><th className="text-right">Baseline</th><th className="text-right">Scenario</th></tr></thead><tbody>{row("Goals met", `${out.baseline.goalsMet}/${out.baseline.goalsTotal}`, `${out.scenario.goalsMet}/${out.scenario.goalsTotal}`)}{row("Retirement readiness", out.baseline.retirementReadinessPct + "%", out.scenario.retirementReadinessPct + "%")}{row("Monthly surplus", inr(out.baseline.monthlySurplus), inr(out.scenario.monthlySurplus))}{row("Health score", out.baseline.healthScore, out.scenario.healthScore)}</tbody></table>}</section></div>);
}

function useStaff() { return useQuery({ queryKey: ["users"], queryFn: async () => ((await api.get("/admin/users")).data.items as any[]), enabled: isAdmin() }); }
function AdvisorSelect({ clientId, value }: { clientId: string; value: string }) {
  const qc = useQueryClient(); const staff = useStaff(); const [err, setErr] = useState("");
  const m = useMutation({ mutationFn: async (advisorId: string) => api.patch(`/admin/clients/${clientId}/advisor`, { advisorId }), onSuccess: () => { setErr(""); qc.invalidateQueries({ queryKey: ["clients"] }); qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["client", clientId] }); }, onError: (e: any) => setErr(e.response?.data?.error?.message ?? "Failed") });
  const opts = (staff.data ?? []).filter((u) => u.role !== "client" && (u.isActive || String(u._id) === value));
  return (<><select aria-label="Assigned advisor" value={value} onChange={(e) => m.mutate(e.target.value)} className="border border-white bg-white/80 rounded-xl px-2 py-1 text-xs max-w-[150px]">{opts.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}{!opts.some((u) => String(u._id) === value) && <option value={value}>Unknown</option>}</select>{err && <div className="text-[10px] text-danger">{err}</div>}</>);
}
function AdminClientBar({ client }: { client: any }) {
  const nav = useNavigate(); const qc = useQueryClient();
  const archive = useMutation({ mutationFn: async () => api.delete(`/admin/clients/${client._id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); nav("/admin/clients"); } });
  return (<div className="clay p-3 mb-4 flex flex-wrap items-center gap-3 text-xs"><span className="text-muted">Admin controls</span><label className="flex items-center gap-2 text-muted">Advisor <AdvisorSelect clientId={client._id} value={String(client.advisorId)} /></label>
    <button className="ml-auto text-danger border border-danger/30 rounded-full px-3 py-1.5 hover:bg-red-50" onClick={() => { if (confirm(`Archive ${client.name}? Their login is disabled and they disappear from lists. Data is kept.`)) archive.mutate(); }}>Archive client</button></div>);
}
