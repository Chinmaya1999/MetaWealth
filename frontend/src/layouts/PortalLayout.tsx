import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2, ChevronDown, ChevronsLeft, ChevronsRight, Eye, LogOut, Mail, ShieldCheck, Search, Settings, type LucideIcon } from "lucide-react";
import { useAuth, portalFor } from "../stores/auth";
import { api } from "../services/api";

export interface NavChild { to: string; label: string }
export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; children?: NavChild[]; badge?: "insights"; secondary?: boolean }
export interface NavAction { label: string; to: string; icon: LucideIcon }

const SEV: any = { Urgent: [AlertTriangle, "bg-red-100 text-danger"], Review: [Eye, "bg-amber-100 text-warning"], "On track": [CheckCircle2, "bg-green-100 text-success"] };
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } } };

function Popover({ open, onClose, children, className = "" }: { open: boolean; onClose: () => void; children: ReactNode; className?: string }) {
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [open, onClose]);
  if (!open) return null;
  return (<><div className="fixed inset-0 z-30" onClick={onClose} /><div className={`absolute right-0 top-full mt-3 z-40 w-80 clay p-4 ${className}`}>{children}</div></>);
}

export default function PortalLayout({ title, nav, action }: { title: string; nav: NavItem[]; action?: NavAction }) {
  const { user, logout } = useAuth(); const go = useNavigate(); const loc = useLocation();
  const [q, setQ] = useState(""); const [bell, setBell] = useState(false); const [gear, setGear] = useState(false);
  const [collapsed, setCollapsed] = useState(store.get("mwc_sb") === "1"); const [open, setOpen] = useState<Record<string, boolean>>({});
  const isClient = user?.role === "client", isAdvisor = user?.role === "advisor" || user?.role === "reviewer";
  const toggleCollapse = () => { setCollapsed((c) => { store.set("mwc_sb", c ? "0" : "1"); return !c; }); };

  const calc = useQuery({ queryKey: ["calc", "me"], enabled: isClient, queryFn: async () => (await api.get("/clients/me/calculations/latest")).data });
  const advisor = useQuery({ queryKey: ["advisor", "me"], enabled: isClient, queryFn: async () => (await api.get("/clients/me/advisor")).data.advisor });
  const stats = useQuery({ queryKey: ["stats"], enabled: isAdvisor, queryFn: async () => (await api.get("/admin/stats")).data });
  const notifs = useQuery({ queryKey: ["notifs"], refetchInterval: 60_000, queryFn: async () => (await api.get("/notifications")).data as { items: any[]; unread: number } });
  const qc = useQueryClient(); const unread = notifs.data?.unread ?? 0;
  const insights: any[] = calc.data?.result?.insights ?? []; const urgent = insights.filter((i) => i.severity === "Urgent").length;

  const flat = nav.flatMap((n) => (n.children ? n.children : [{ to: n.to, label: n.label }])); // search + mobile nav list real pages only
  const match = q ? flat.find((n) => n.label.toLowerCase().includes(q.toLowerCase())) : undefined;
  const initials = (user?.name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const Avatar = ({ size = "h-9 w-9" }: { size?: string }) => <span className={`${size} rounded-full grid place-items-center text-xs font-semibold text-white shrink-0`} style={{ background: "linear-gradient(135deg,#1A5876,#55B848)" }}>{initials}</span>;
  const Badge = ({ n }: { n: number }) => n > 0 ? <span className="ml-auto grid place-items-center h-5 min-w-5 px-1 rounded-full bg-navy text-white text-[10px] font-semibold">{n}</span> : null;

  const linkCls = (active: boolean) => `relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm whitespace-nowrap transition-all ${active ? "bg-white shadow-clay text-navy font-medium" : "text-muted hover:bg-white/60 hover:text-navy"} ${collapsed ? "justify-center px-0" : ""}`;
  const bar = <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-gold" />;

  return (
    <div className="min-h-screen md:h-screen print:h-auto">
      <div className="w-full min-h-screen md:h-full print:h-auto md:flex bg-white/45 backdrop-blur-2xl print:bg-transparent">
        {/* ---------- sidebar (desktop) ---------- */}
        <aside className={`print:hidden hidden md:flex flex-col shrink-0 p-4 transition-[width] duration-300 md:h-full overflow-y-auto scroll-soft border-r border-white/60 bg-white/30 ${collapsed ? "w-[84px]" : "w-64"}`}>
          <div className={`pt-2 pb-6 ${collapsed ? "text-center" : "px-3"}`}>
            {collapsed ? <img src="/logo-mark.png" alt="MetaWealth Capital" className="h-9 mx-auto" /> : <><img src="/logo.png" alt="MetaWealth Capital" className="h-10 w-auto" /><div className="text-[10px] tracking-[0.3em] text-gold mt-1.5">{title.toUpperCase()}</div></>}
          </div>
          <nav aria-label="Primary" className="flex flex-col gap-1">
            {[...nav.filter((x) => !x.secondary), { divider: true } as any, ...nav.filter((x) => x.secondary)].map((n: any) => {
              if (n.divider) return nav.some((x) => x.secondary) ? <div key="div" className="my-3 border-t border-black/10" /> : null;
              const Icon = n.icon; const badge = n.badge === "insights" ? urgent : 0;
              if (!n.children) return (
                <NavLink key={n.to} to={n.to} end={n.end} title={collapsed ? n.label : undefined} className={({ isActive }) => linkCls(isActive)}>
                  {({ isActive }) => (<>{isActive && bar}<Icon size={18} aria-hidden className={isActive ? "text-gold" : ""} />{!collapsed && <>{n.label}<Badge n={badge} /></>}</>)}
                </NavLink>);
              const active = n.children.some((c: NavChild) => loc.pathname.startsWith(c.to)); const isOpen = open[n.label] ?? true;
              if (collapsed) return (<NavLink key={n.label} to={n.children[0].to} title={n.label} className={() => linkCls(active)}>{active && bar}<Icon size={18} className={active ? "text-gold" : ""} /></NavLink>);
              return (<div key={n.label}>
                <button onClick={() => setOpen((o) => ({ ...o, [n.label]: !isOpen }))} aria-expanded={isOpen} className={`w-full ${linkCls(active && !isOpen)}`}>{active && !isOpen && bar}<Icon size={18} className={active ? "text-gold" : ""} />{n.label}<ChevronDown size={15} className={`ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`} /></button>
                {isOpen && <ul className="ml-[26px] mt-1 mb-1 border-l border-black/10 pl-4 space-y-0.5">{n.children.map((c: NavChild) => (
                  <li key={c.to} className="relative before:absolute before:-left-4 before:top-1/2 before:h-px before:w-3 before:bg-black/10">
                    <NavLink to={c.to} className={({ isActive }) => `block rounded-xl px-3 py-1.5 text-[13px] ${isActive ? "bg-white shadow-clay text-navy font-medium" : "text-muted hover:text-navy hover:bg-white/50"}`}>{c.label}</NavLink></li>))}</ul>}
              </div>);
            })}
          </nav>

          <div className="mt-auto pt-6 grid gap-3">
            {!collapsed && isClient && (
              <div className="clay-flat p-4 text-xs">
                <div className="h-8 w-8 rounded-xl grid place-items-center bg-navy text-gold mb-2"><Mail size={15} /></div>
                <div className="font-semibold text-navy text-sm">{advisor.data?.name ?? "Your advisor"}</div>
                <p className="text-muted mt-0.5 mb-3">Reviews every plan before release. Ask a question any time.</p>
                {advisor.data?.email && <a href={`mailto:${advisor.data.email}`} className="block text-center rounded-xl bg-navy text-white py-2 font-medium hover:bg-navy-deep">Email advisor</a>}
              </div>)}
            {!collapsed && isAdvisor && (
              <div className="clay-flat p-4 text-xs">
                <div className="text-muted">Awaiting your review</div><div className="text-3xl font-semibold text-navy tabular-nums my-1">{(stats.data?.plansAwaitingReview ?? 0) + (stats.data?.readyForReview ?? 0)}</div>
                <Link to="/advisor/clients" className="text-navy font-medium">Open clients →</Link>
              </div>)}
            <button onClick={toggleCollapse} className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm text-muted hover:bg-white/60 hover:text-navy ${collapsed ? "justify-center px-0" : ""}`} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <ChevronsRight size={18} /> : <><ChevronsLeft size={18} />Collapse sidebar</>}
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 md:h-full flex flex-col px-3 py-3 md:px-7 md:py-5">
          {/* ---------- mobile nav ---------- */}
          <div className="md:hidden print:hidden mb-3">
            <div className="flex items-center gap-2 mb-2"><img src="/logo.png" alt="MetaWealth Capital" className="h-7 w-auto" /><span className="text-[10px] tracking-[0.25em] text-gold">{title.toUpperCase()}</span></div>
            <nav aria-label="Primary" className="flex gap-1.5 overflow-x-auto pb-1">{flat.map((n) => <NavLink key={n.to} to={n.to} end className={({ isActive }) => `rounded-full px-3.5 py-2 text-xs whitespace-nowrap ${isActive ? "bg-white shadow-clay text-navy font-medium" : "text-muted bg-white/40"}`}>{n.label}</NavLink>)}</nav>
          </div>

          {/* ---------- navbar ---------- */}
          <header className="print:hidden flex items-center gap-2 md:gap-3 mb-4 shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); if (match) { go(match.to); setQ(""); } }} className="flex-1 max-w-md relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input aria-label="Quick search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Quick search" className="w-full rounded-2xl bg-white/80 border border-white shadow-[inset_0_2px_4px_rgba(26,88,118,.06)] pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/50" />
              {q && <div className="absolute z-40 mt-2 w-full clay p-1.5 text-sm">{match ? <button type="button" onClick={() => { go(match.to); setQ(""); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-white">{match.label}</button> : <div className="px-3 py-2 text-muted">No match</div>}</div>}
            </form>
            <div className="ml-auto flex items-center gap-2 md:gap-3">
              {(<div className="relative">
                <button onClick={() => { setBell((b) => !b); setGear(false); }} aria-label="Notifications" className="clay-btn h-10 w-10 grid place-items-center relative"><Bell size={17} />{urgent + unread > 0 && <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[9px] font-semibold grid place-items-center">{urgent + unread}</span>}</button>
                <Popover open={bell} onClose={() => setBell(false)} className="w-[340px]">
                  <div className="flex items-center justify-between mb-3"><div className="font-semibold text-navy text-sm">Notifications</div>{unread > 0 ? <button className="text-[11px] text-navy underline" onClick={async () => { await api.post("/notifications/read-all"); qc.invalidateQueries({ queryKey: ["notifs"] }); }}>Mark all read</button> : <span className="chip">{unread} new</span>}</div>
                  {(notifs.data?.items.length ?? 0) === 0 ? <p className="text-xs text-muted">You are all caught up.</p> : <ul className="space-y-1 max-h-64 overflow-auto">{notifs.data!.items.slice(0, 8).map((n) => (<li key={n._id}><Link to={n.link ?? "#"} onClick={async () => { setBell(false); if (!n.readAt) { await api.post(`/notifications/${n._id}/read`); qc.invalidateQueries({ queryKey: ["notifs"] }); } }} className="block rounded-xl px-2.5 py-2 hover:bg-white"><div className="flex items-start gap-2">{!n.readAt && <span className="mt-1.5 h-2 w-2 rounded-full bg-gold shrink-0" />}<div className="min-w-0"><div className="text-xs font-medium text-navy">{n.title}</div>{n.body && <div className="text-[11px] text-muted line-clamp-2">{n.body}</div>}<div className="text-[10px] text-muted mt-0.5">{new Date(n.createdAt).toLocaleDateString("en-GB")}</div></div></div></Link></li>))}</ul>}
                  {isClient && insights.length > 0 && <div className="border-t border-black/5 mt-3 pt-3"><div className="flex items-center justify-between mb-2"><div className="font-semibold text-navy text-sm">Insights</div><span className="chip">{urgent} urgent</span></div>
                    <ul className="space-y-3 max-h-48 overflow-auto">{insights.slice(0, 4).map((i) => { const [I, cls] = SEV[i.severity]; return (<li key={i.id} className="flex gap-3"><span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${cls}`}><I size={16} /></span><div className="min-w-0"><div className="text-xs font-medium text-navy">{i.title}</div><div className="text-[11px] text-muted line-clamp-2">{i.action}</div></div></li>); })}</ul>
                    <Link to="/client/insights" onClick={() => setBell(false)} className="block text-center text-xs font-medium text-navy mt-3">View all insights →</Link></div>}
                </Popover></div>)}
              <div className="relative">
                <button onClick={() => { setGear((g) => !g); setBell(false); }} aria-label="Settings" className="clay-btn h-10 w-10 grid place-items-center"><Settings size={17} /></button>
                <Popover open={gear} onClose={() => setGear(false)} className="w-72">
                  <div className="flex items-center gap-3 mb-3"><Avatar size="h-11 w-11" /><div className="min-w-0"><div className="text-sm font-semibold text-navy truncate">{user?.name}</div><div className="text-[11px] text-muted truncate">{user?.email}</div></div></div>
                  <div className="text-[11px] text-muted mb-3 capitalize">Role: {user?.role.replace("_", " ")}</div>
                  <Link to={`${portalFor(user!.role)}/account`} onClick={() => setGear(false)} className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white"><ShieldCheck size={15} /> Account & security</Link>
                  <button onClick={toggleCollapse} className="hidden md:flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white">{collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}{collapsed ? "Expand sidebar" : "Collapse sidebar"}</button>
                  <button onClick={async () => { await logout(); go("/login"); }} className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger hover:bg-white"><LogOut size={15} /> Sign out</button>
                </Popover></div>
              <div className="clay-btn hidden sm:flex items-center gap-3 pl-1.5 pr-4 py-1.5"><Avatar /><span className="leading-tight"><span className="block text-sm font-medium">{user?.name}</span><span className="block text-[11px] text-muted max-w-[150px] truncate">{user?.email}</span></span></div>
              {action && <Link to={action.to} className="clay-btn hidden md:inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-navy"><action.icon size={15} />{action.label}</Link>}
            </div>
          </header>
          <main className="flex-1 min-h-0 md:overflow-y-auto scroll-soft print:overflow-visible md:-mr-2 md:pr-2 pb-2"><Outlet /></main>
        </div>
      </div>
    </div>
  );
}
