import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

const shell = (title: string, sub: string, children: React.ReactNode) => (
  <div className="min-h-screen grid place-items-center px-6 bg-[#F6F3EC]" style={{ background: "radial-gradient(900px 500px at 100% 0%, rgba(85,184,72,.22), transparent 60%), #F6F3EC" }}>
    <div className="w-full max-w-[400px] clay p-8"><img src="/logo.png" alt="MetaWealth Capital" className="h-10 w-auto mb-6" />
      <h1 className="font-serif text-3xl text-navy">{title}</h1><p className="text-muted text-sm mt-2 mb-6">{sub}</p>{children}
      <Link to="/login" className="block text-center text-sm text-navy mt-6 hover:underline">← Back to sign in</Link></div></div>);
const inp = "w-full rounded-2xl bg-white border border-[#E4E0D6] px-4 py-3 text-[15px] outline-none focus:border-gold focus:ring-4 focus:ring-gold/20";

export function ForgotPassword() {
  const [email, setEmail] = useState(""); const [done, setDone] = useState(false); const [err, setErr] = useState("");
  async function submit(e: FormEvent) { e.preventDefault(); setErr(""); try { await axios.post("/api/v1/auth/forgot-password", { email }); setDone(true); } catch (x: any) { setErr(x.response?.status === 429 ? "Too many attempts. Please wait a few minutes." : "Something went wrong. Please try again."); } }
  return shell("Reset password", "Enter your email and we will send a reset link that works for 30 minutes.", done
    ? <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-success">If that email is registered, a reset link is on its way. Check your inbox.</div>
    : <form onSubmit={submit} className="space-y-4"><input required type="email" placeholder="Email address" className={inp} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />{err && <p role="alert" className="text-danger text-sm">{err}</p>}<button className="pill-btn w-full">Send reset link</button></form>);
}

export function ResetPassword() {
  const [sp] = useSearchParams(); const go = useNavigate(); const token = sp.get("token") ?? "";
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [err, setErr] = useState(""); const [done, setDone] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(""); if (pw !== pw2) { setErr("The two passwords do not match."); return; }
    try { await axios.post("/api/v1/auth/reset-password", { token, password: pw }); setDone(true); setTimeout(() => go("/login"), 1800); }
    catch (x: any) { const d = x.response?.data?.error; setErr(d?.details?.[0]?.message ?? d?.message ?? "Could not reset the password."); }
  }
  if (!token) return shell("Link not valid", "This reset link is missing its token. Request a new one.", <Link to="/forgot-password" className="pill-btn block text-center">Request a new link</Link>);
  return shell("Choose a new password", "At least 10 characters, with a letter and a digit.", done ? <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-success">Password updated. Taking you to sign in…</div>
    : <form onSubmit={submit} className="space-y-4"><input required type="password" placeholder="New password" className={inp} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /><input required type="password" placeholder="Repeat new password" className={inp} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />{err && <p role="alert" className="text-danger text-sm">{err}</p>}<button className="pill-btn w-full">Update password</button></form>);
}
