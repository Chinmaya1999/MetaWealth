import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import { useAuth } from "../../stores/auth";
import { PageHeader, StatCard } from "../../components/ui";

export function AdminHome() {
  const health = useQuery({ queryKey: ["health"], queryFn: async () => (await api.get("/health")).data });
  const ov = useQuery({ queryKey: ["overview"], queryFn: async () => (await api.get("/admin/overview")).data });
  const users = useQuery({ queryKey: ["users"], queryFn: async () => (await api.get("/admin/users")).data.items as any[] });
  const me = useAuth((s) => s.user!); const qc = useQueryClient();
  const [f, setF] = useState({ name: "", email: "", role: "advisor" }); const [res, setRes] = useState<any>(null); const [err, setErr] = useState("");
  const inp = "border border-white bg-white/80 rounded-2xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/50";
  const refresh = () => { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["overview"] }); };
  const patch = useMutation({ mutationFn: async ({ id, body }: { id: string; body: any }) => api.patch(`/admin/users/${id}`, body), onSuccess: () => { setErr(""); refresh(); }, onError: (e: any) => setErr(e.response?.data?.error?.message ?? "Failed") });
  const reset = useMutation({ mutationFn: async (id: string) => (await api.post(`/admin/users/${id}/reset-password`)).data, onSuccess: (d) => setRes({ title: `New temporary password for ${d.email}`, pw: d.temporaryPassword }), onError: (e: any) => setErr(e.response?.data?.error?.message ?? "Failed") });
  const create = async (e: React.FormEvent) => { e.preventDefault(); try { const d = (await api.post("/admin/advisors", f)).data; setRes({ title: `Created ${d.user.email}`, pw: d.temporaryPassword }); setErr(""); setF({ name: "", email: "", role: "advisor" }); refresh(); } catch (x: any) { setErr(x.response?.data?.error?.message ?? "Failed"); } };
  const o = ov.data; const tile = (l: string, v: any, sub?: string) => <div className="clay p-4"><div className="text-[11px] text-muted">{l}</div><div className="text-2xl font-semibold text-navy tabular-nums mt-1">{v ?? "…"}</div>{sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}</div>;
  const canRole = me.role === "super_admin";
  return (<><PageHeader title="Administration" subtitle="Everything in one place: people, clients, plans, assumptions and compliance." />
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-4">
      {tile("Clients", o?.clients.total, o ? `${o.clients.nri} NRI` : undefined)}{tile("Advisors", o?.users.advisors, o ? `${o.users.reviewers} reviewer · ${o.users.admins} admin` : undefined)}
      {tile("Plans", o ? Object.values(o.plans).reduce((a: any, b: any) => a + b, 0) : undefined, o ? Object.entries(o.plans).map(([k, v]) => `${v} ${String(k).replace("_", " ")}`).join(" · ") : undefined)}{tile("System", health.data ? (health.data.db ? "Healthy" : "DB down") : "…", o ? `${o.auditLast24h} audited actions in 24h` : undefined)}
    </div>
    <div className="flex flex-wrap gap-2 mb-5 text-xs"><Link className="pill-btn" to="/admin/clients">All clients</Link><Link className="pill-btn" to="/admin/clients?new=1">New client</Link><Link className="pill-btn" to="/admin/assumptions">Assumptions</Link><Link className="pill-btn" to="/admin/audit">Audit log</Link></div>
    <h3 className="font-semibold text-navy mb-2">Team and users</h3>
    <form className="clay p-4 mb-4 flex flex-wrap gap-3 items-end" onSubmit={create}>
      <input required minLength={2} placeholder="Name" className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><input required type="email" placeholder="Email" className={inp} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <select className={inp} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="advisor">Advisor</option><option value="reviewer">Reviewer</option>{canRole && <option value="admin">Admin</option>}</select><button className="pill-btn">Create staff user</button></form>
    {err && <p role="alert" className="text-danger text-sm mb-3">{err}</p>}
    {res && <div className="clay p-3 mb-4 text-sm border-l-4 border-gold">{res.title}. Temporary password: <code className="bg-white px-1.5 rounded">{res.pw}</code> (shown once)</div>}
    <div className="clay overflow-x-auto"><table className="w-full text-sm min-w-[760px]"><thead><tr className="text-left text-[11px] text-muted"><th className="p-3 pl-5">Name</th><th>Email</th><th>Role</th><th>Clients</th><th>Status</th><th className="text-right pr-5">Actions</th></tr></thead>
      <tbody>{users.data?.map((u) => { const self = u._id === me.id || u._id === (me as any)._id; const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date(); const staff = u.role !== "client"; const protect = u.role === "super_admin" && me.role !== "super_admin";
        return (<tr key={u._id} className="border-t border-black/5"><td className="p-3 pl-5 font-medium text-navy">{u.name}{self && <span className="ml-1.5 text-[10px] text-muted">(you)</span>}</td><td className="text-muted">{u.email}</td>
          <td>{staff && !self && !protect && (canRole || !["admin", "super_admin"].includes(u.role)) ? <select aria-label="Role" className="border border-white bg-white/80 rounded-xl px-2 py-1 text-xs" value={u.role} onChange={(e) => patch.mutate({ id: u._id, body: { role: e.target.value } })}><option value="advisor">Advisor</option><option value="reviewer">Reviewer</option>{(canRole || u.role === "admin") && <option value="admin">Admin</option>}{u.role === "super_admin" && <option value="super_admin">Super admin</option>}</select> : <span className="capitalize text-xs">{u.role.replace("_", " ")}</span>}</td>
          <td className="tabular-nums">{u.clientCount ?? "—"}</td>
          <td><span className={`px-2 py-0.5 rounded-full text-[11px] ${!u.isActive ? "bg-red-100 text-danger" : locked ? "bg-amber-100 text-warning" : "bg-green-100 text-success"}`}>{!u.isActive ? "Disabled" : locked ? "Locked" : "Active"}</span></td>
          <td className="text-right pr-5 whitespace-nowrap">{!protect && <button className="text-xs text-navy underline mr-3" onClick={() => reset.mutate(u._id)}>Reset password</button>}{!self && !protect && <button className="text-xs text-navy underline" onClick={() => patch.mutate({ id: u._id, body: { isActive: !u.isActive } })}>{u.isActive ? "Disable" : "Enable"}</button>}</td></tr>); })}</tbody></table></div></>);
}

export function Assumptions() {
  const qc = useQueryClient(); const a = useQuery({ queryKey: ["assump"], queryFn: async () => (await api.get("/admin/assumptions")).data });
  const [draft, setDraft] = useState<any>(null); const [reason, setReason] = useState(""); const [msg, setMsg] = useState("");
  const save = useMutation({ mutationFn: async () => (await api.put("/admin/assumptions", { values: draft ?? a.data?.values, reason })).data, onSuccess: (d) => { setMsg(`Saved as version ${d.version}`); setDraft(null); setReason(""); qc.invalidateQueries({ queryKey: ["assump"] }); }, onError: (e: any) => setMsg(e.response?.data?.error?.message ?? "Failed") });
  const v = draft ?? a.data?.values; if (!v) return <div className="text-muted">Loading…</div>;
  const grp = (g: string, title: string) => (<section className="clay p-4 mb-4"><h3 className="font-serif mb-2">{title}</h3><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Object.entries(v[g]).map(([k, x]) => <label key={k} className="text-xs text-muted capitalize">{k}<input type="number" step="0.1" className="w-full border border-line rounded px-2 py-1.5 text-sm text-ink" value={x as number} onChange={(e) => setDraft({ ...v, [g]: { ...v[g], [k]: +e.target.value } })} /></label>)}</div></section>);
  return (<><PageHeader title="Financial assumptions" subtitle={`Active version ${a.data.version}. Planning assumptions, not forecasts. Every plan stores the version it used.`} />
    {grp("inflation", "Inflation (% a year)")}{grp("returns", "Asset-class returns (% a year)")}{grp("thresholds", "Advisory thresholds")}
    <label className="text-xs text-muted">Reason for change (required)<input className="w-full border border-line rounded px-3 py-2 text-sm text-ink bg-white mb-3" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
    <button disabled={!draft || reason.length < 5} onClick={() => save.mutate()} className="px-4 py-2 bg-navy text-white rounded-md disabled:opacity-40">Publish new version</button> <span className="text-sm ml-3">{msg}</span></>);
}

export function AuditLog() {
  const a = useQuery({ queryKey: ["audit"], queryFn: async () => (await api.get("/admin/audit")).data.items });
  return (<><PageHeader title="Audit log" subtitle="Append-only record of actions." /><table className="w-full text-xs clay"><thead><tr className="text-left text-muted"><th className="p-2">Time</th><th>Action</th><th>Entity</th><th>Request</th></tr></thead><tbody>{a.data?.map((r: any) => <tr key={r._id} className="border-t border-line"><td className="p-2">{new Date(r.createdAt).toLocaleString()}</td><td>{r.action}</td><td>{r.entity} {String(r.entityId ?? "").slice(-6)}</td><td className="text-muted">{String(r.requestId ?? "").slice(0, 8)}</td></tr>)}</tbody></table></>);
}
