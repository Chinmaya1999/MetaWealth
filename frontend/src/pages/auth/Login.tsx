import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuth, portalFor } from "../../stores/auth";
import LoginHero from "./LoginHero";

const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } } };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

export default function Login() {
  const { login, user } = useAuth(); const go = useNavigate();
  const [email, setEmail] = useState(store.get("mwc_email") ?? ""); const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(!!store.get("mwc_email")); const [show, setShow] = useState(false); const [caps, setCaps] = useState(false);
  const [code, setCode] = useState(""); const [needCode, setNeedCode] = useState(false); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false); const [shake, setShake] = useState(0);
  useEffect(() => { document.title = "Sign in · MetaWealth Capital"; }, []);
  if (user && !ok) return <Navigate to={portalFor(user.role)} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const u = await login(email.trim(), password, needCode ? code : undefined);
      if (u === "mfa") { setNeedCode(true); return; }
      store.set("mwc_email", remember ? email.trim() : null);
      setOk(true); setTimeout(() => go(portalFor(u.role)), 650);
    } catch (x: any) { setErr(x.response?.status === 429 ? "Too many attempts. Please wait a few minutes and try again." : x.response?.data?.error?.message ?? "Sign-in failed. Please try again."); setShake((n) => n + 1); }
    finally { setBusy(false); }
  }
  const field = "peer w-full rounded-2xl bg-white border border-[#E4E0D6] pl-12 pr-4 pt-6 pb-2.5 text-[15px] outline-none shadow-[inset_0_1px_2px_rgba(26,88,118,.05)] transition focus:border-gold focus:ring-4 focus:ring-gold/20";
  const label = "pointer-events-none absolute left-12 top-4 text-sm text-muted transition-all peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-gold peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px]";

  return (
    <div className="min-h-screen md:grid md:grid-cols-[1.35fr_1fr] bg-[#F6F3EC]">
      <div className="relative h-52 md:h-auto md:min-h-screen overflow-hidden"><LoginHero compact={typeof window !== "undefined" && window.innerWidth < 768} />
        <div className="md:hidden absolute inset-0 p-5 text-white"><img src="/logo-light.png" alt="MetaWealth Capital" className="h-10 w-auto" /></div></div>

      <div className="relative flex items-center justify-center px-6 py-10 md:px-12 overflow-hidden" style={{ background: "radial-gradient(900px 500px at 100% 0%, rgba(85,184,72,.22), transparent 60%), radial-gradient(700px 500px at 0% 100%, rgba(109,134,185,.16), transparent 60%), #F6F3EC" }}>
        <form key={shake} onSubmit={submit} className={`w-full max-w-[400px] ${shake ? "mw-shake" : ""}`} noValidate>
          <div className="mw-rise" style={{ animationDelay: ".1s" }}>
            <div className="chip mb-4">{greeting()}</div>
            <h2 className="font-serif text-4xl text-navy leading-tight">Welcome back</h2>
            <p className="text-muted mt-2 text-[15px]">Sign in to see your plan, goals and next steps.</p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="relative mw-rise" style={{ animationDelay: ".25s" }}>
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input id="email" type="email" required placeholder=" " value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" className={field} />
              <label htmlFor="email" className={label}>Email address</label>
            </div>
            <div className="relative mw-rise" style={{ animationDelay: ".35s" }}>
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input id="password" type={show ? "text" : "password"} required placeholder=" " value={password} onChange={(e) => setPassword(e.target.value)} onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))} autoComplete="current-password" className={field + " pr-12"} />
              <label htmlFor="password" className={label}>Password</label>
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-muted hover:text-navy hover:bg-black/5">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {needCode && <div className="relative mw-rise"><input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus required placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-full rounded-2xl bg-white border border-[#E4E0D6] px-4 py-3.5 text-center text-xl tracking-[0.5em] outline-none focus:border-gold focus:ring-4 focus:ring-gold/20" /><p className="text-xs text-muted mt-2 text-center">Open your authenticator app and enter the current code.</p></div>}
            {caps && <p className="text-xs text-warning flex items-center gap-1.5"><AlertCircle size={14} /> Caps Lock is on</p>}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm mw-rise" style={{ animationDelay: ".45s" }}>
            <label className="flex items-center gap-2.5 cursor-pointer select-none text-muted"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded accent-[#1A5876]" />Remember my email</label>
            <Link to="/forgot-password" className="text-navy font-medium hover:underline">Forgot password?</Link>
          </div>

          {err && <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-danger"><AlertCircle size={17} className="mt-0.5 shrink-0" />{err}</div>}

          <button disabled={busy || ok} className={`mw-shine relative overflow-hidden mt-6 w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white shadow-[0_18px_30px_-12px_rgba(26,88,118,.7)] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-90 mw-rise ${ok ? "bg-success" : "bg-navy hover:bg-navy-deep"}`} style={{ animationDelay: ".55s" }}>
            <span className="relative z-10 inline-flex items-center justify-center gap-2.5">
              {ok ? <><Check size={18} /> Signed in. Opening your dashboard…</> : busy ? <><span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Signing in…</> : <>Sign in <ArrowRight size={18} /></>}
            </span>
          </button>

          <div className="mt-8 rounded-2xl border border-[#E4E0D6] bg-white/60 px-4 py-3 text-xs text-muted leading-relaxed mw-rise" style={{ animationDelay: ".7s" }}>For your protection, sessions expire automatically and accounts lock after repeated failed attempts.</div>
          <p className="mt-6 text-center text-[11px] text-muted mw-rise" style={{ animationDelay: ".8s" }}>© MetaWealth Capital</p>
        </form>
      </div>
    </div>
  );
}
