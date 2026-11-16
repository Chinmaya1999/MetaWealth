import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LayoutDashboard, Users, Settings, FileText, ClipboardList, Target, Wallet, PiggyBank, Shield, Sparkles, Briefcase, ScrollText, SlidersHorizontal, Plus, Globe2 } from "lucide-react";
import { useAuth, portalFor, type Role } from "../stores/auth";
import PortalLayout from "../layouts/PortalLayout";
import Login from "../pages/auth/Login";
import { ForgotPassword, ResetPassword } from "../pages/auth/Recover";
import Account from "../pages/Account";
import * as C from "../pages/client/ClientPages";
import { AdvisorHome, Clients, ClientDetail } from "../pages/advisor/AdvisorPages";
import { AdminHome, Assumptions, AuditLog } from "../pages/admin/AdminPages";

const qc = new QueryClient();

function Guard({ roles, children }: { roles: Role[]; children: JSX.Element }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="p-10 text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={portalFor(user.role)} replace />;
  return children;
}

export default function App() {
  const refresh = useAuth((s) => s.refresh);
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/client" element={<Guard roles={["client"]}><PortalLayout title="Client" action={{ label: "Add goal", to: "/client/questionnaire?step=3", icon: Plus }} nav={[
            { to: "/client", label: "Overview", icon: LayoutDashboard, end: true },
            { to: "/client/insights", label: "Insights", icon: Sparkles, badge: "insights" },
            { to: "/client/goals", label: "Planning", icon: Target, children: [{ to: "/client/goals", label: "Goals" }, { to: "/client/cashflow", label: "Cashflow" }, { to: "/client/retirement", label: "Retirement" }, { to: "/client/insurance", label: "Insurance" }, { to: "/client/portfolio", label: "Investments" }] },
            { to: "/client/nri", label: "NRI planner", icon: Globe2 },
            { to: "/client/questionnaire", label: "Questionnaire", icon: ClipboardList, secondary: true }, { to: "/client/plan", label: "Financial plan", icon: FileText, secondary: true }]} /></Guard>}>
            <Route index element={<C.ClientHome />} /><Route path="account" element={<Account />} /><Route path="questionnaire" element={<C.ClientQuestionnaire />} /><Route path="goals" element={<C.ClientGoals />} /><Route path="cashflow" element={<C.ClientCashflow />} />
            <Route path="retirement" element={<C.ClientRetirement />} /><Route path="insurance" element={<C.ClientInsurance />} /><Route path="portfolio" element={<C.ClientPortfolio />} /><Route path="insights" element={<C.ClientInsights />} /><Route path="nri" element={<C.ClientNri />} /><Route path="plan" element={<C.ClientPlans />} />
          </Route>
          <Route path="/advisor" element={<Guard roles={["advisor", "reviewer"]}><PortalLayout title="Advisor" action={{ label: "New client", to: "/advisor/clients?new=1", icon: Plus }} nav={[{ to: "/advisor", label: "Dashboard", icon: LayoutDashboard, end: true }, { to: "/advisor/clients", label: "Clients", icon: Users }]} /></Guard>}>
            <Route index element={<AdvisorHome />} /><Route path="account" element={<Account />} /><Route path="clients" element={<Clients />} /><Route path="clients/:id" element={<ClientDetail />} />
          </Route>
          <Route path="/admin" element={<Guard roles={["admin", "super_admin"]}><PortalLayout title="Admin" action={{ label: "New client", to: "/admin/clients?new=1", icon: Plus }} nav={[{ to: "/admin", label: "Overview & users", icon: LayoutDashboard, end: true }, { to: "/admin/assumptions", label: "Assumptions", icon: SlidersHorizontal }, { to: "/admin/audit", label: "Audit log", icon: ScrollText }, { to: "/admin/clients", label: "Clients", icon: Users }]} /></Guard>}>
            <Route index element={<AdminHome />} /><Route path="account" element={<Account />} /><Route path="assumptions" element={<Assumptions />} /><Route path="audit" element={<AuditLog />} /><Route path="clients" element={<Clients />} /><Route path="clients/:id" element={<ClientDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
