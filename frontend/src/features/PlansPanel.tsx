import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../stores/auth";
import PlanDocument, { PLAN_SECTIONS } from "./PlanDocument";
import { Component, type ReactNode } from "react";
import { EmptyState } from "../components/ui";

class PlanBoundary extends Component<{ children: ReactNode }, { bad: boolean }> {
  state = { bad: false }; static getDerivedStateFromError() { return { bad: true }; }
  render() { return this.state.bad ? <EmptyState title="This plan cannot be shown on the page" body="It was produced by an earlier version of the planning engine. Download the PDF to read it, or ask your advisor for a refreshed plan." /> : this.props.children; }
}

export default function PlansPanel({ clientId, fixed = false }: { clientId: string; fixed?: boolean }) {
  const qc = useQueryClient(); const role = useAuth((s) => s.user!.role); const staff = role !== "client";
  const plans = useQuery({ queryKey: ["plans", clientId], queryFn: async () => (await api.get(`/clients/${clientId}/plans`)).data.items as any[] });
  const [sel, setSel] = useState<string>(""); const [err, setErr] = useState("");
  useEffect(() => { if (plans.data?.length && !plans.data.some((p) => p._id === sel)) setSel(plans.data[0]._id); }, [plans.data, sel]);
  const plan = useQuery({ queryKey: ["plan", sel], enabled: !!sel, queryFn: async () => (await api.get(`/plans/${sel}`)).data.plan });
  const meta = plans.data?.find((p) => p._id === sel);

  const act = async (fn: () => Promise<any>) => { setErr(""); try { await fn(); qc.invalidateQueries({ queryKey: ["plans", clientId] }); qc.invalidateQueries({ queryKey: ["plan", sel] }); } catch (e: any) { setErr(e.response?.data?.error?.message ?? "Action failed"); } };
  const download = async (summary: boolean) => {
    try { const { data } = await api.get(`/plans/${sel}/pdf${summary ? "?summary=1" : ""}`, { responseType: "blob" }); const url = URL.createObjectURL(data); const a = document.createElement("a"); a.href = url; a.download = `MetaWealth-${summary ? "summary" : "plan"}-v${meta?.version}.pdf`; a.click(); URL.revokeObjectURL(url); }
    catch { setErr("PDF could not be generated"); }
  };
  const btn = "clay-btn px-3.5 py-2 text-xs inline-flex items-center gap-1.5";

  if (plans.isLoading) return <div className="text-muted">Loading…</div>;
  return (<div className={fixed ? "md:h-full md:flex md:flex-col md:min-h-0" : ""}>
    <div className="print:hidden shrink-0">
      {staff && <button className="mb-4 px-4 py-2 bg-navy text-white rounded-md" onClick={() => act(() => api.post(`/clients/${clientId}/plans/generate`))}>Generate new draft plan</button>}
      {err && <p role="alert" className="text-danger text-sm mb-2">{err}</p>}
      {!plans.data?.length ? <EmptyState title={staff ? "No plans yet" : "No released plan yet"} body={staff ? "Generate a draft once the questionnaire is complete." : "Your advisor will release your financial plan here once it has been reviewed. Your live figures are on the Overview page."} /> : (
        <div className="clay-flat px-3 py-2.5 mb-4 flex flex-wrap items-center gap-2">
          {plans.data.map((p) => <button key={p._id} onClick={() => setSel(p._id)} className={`px-3 py-1.5 rounded-full text-xs border ${sel === p._id ? "bg-navy text-white border-navy shadow-md" : "bg-white/70 border-white text-muted"}`}>v{p.version} · {p.status.replace("_", " ")}</button>)}
          <span className="ml-auto flex flex-wrap gap-2">
            <button className={btn} onClick={() => download(false)}><Download size={13} /> Download PDF</button>
            <button className={btn} onClick={() => download(true)}><Download size={13} /> 2-page summary</button>
            <button className={btn} onClick={() => window.print()}><Printer size={13} /> Print</button>
            {staff && meta && ["draft", "rejected"].includes(meta.status) && <button className={btn} onClick={() => act(() => api.post(`/plans/${sel}/submit-review`))}>Submit for review</button>}
            {staff && meta?.status === "in_review" && <><button className={btn} onClick={() => act(() => api.post(`/plans/${sel}/approve`, {}))}>Approve</button><button className={btn} onClick={() => { const note = prompt("Reason for rejection"); if (note) act(() => api.post(`/plans/${sel}/reject`, { note })); }}>Reject</button></>}
            {staff && meta?.status === "approved" && <button className={btn + " bg-gold"} onClick={() => act(() => api.post(`/plans/${sel}/release`))}>Release to client</button>}
          </span>
        </div>)}
    </div>
    {sel && (plan.isLoading ? <div className="text-muted">Loading plan…</div> : plan.data && (
      <div className={(fixed ? "md:flex-1 md:min-h-0 md:overflow-y-auto scroll-soft print:overflow-visible " : "") + "lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-6"}>
        <nav aria-label="Plan contents" className="hidden lg:block print:hidden"><ul className="sticky top-0 text-sm space-y-0.5 clay-flat p-2">{PLAN_SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="block px-2 py-1 rounded text-muted hover:bg-white hover:text-navy">{label}</a></li>)}</ul></nav>
        <PlanBoundary key={sel}><PlanDocument plan={plan.data} /></PlanBoundary>
      </div>))}
  </div>);
}
