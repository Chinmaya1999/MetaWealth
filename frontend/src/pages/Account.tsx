import { FormEvent, useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../services/api";
import { useAuth } from "../stores/auth";
import { PageHeader } from "../components/ui";

const inp = "border border-white bg-white/80 rounded-2xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/50 w-full";
const errOf = (x: any) => x.response?.data?.error?.details?.[0]?.message ?? x.response?.data?.error?.message ?? "Something went wrong";

export default function Account() {
  const user = useAuth((s) => s.user!); const refresh = useAuth((s) => s.refresh);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null); const [qr, setQr] = useState(""); const [code, setCode] = useState(""); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [pw, setPw] = useState({ current: "", password: "" }); const [dis, setDis] = useState({ password: "", code: "" });
  useEffect(() => { if (setup) QRCode.toDataURL(setup.otpauth, { margin: 1, width: 180 }).then(setQr); }, [setup]);
  const run = async (fn: () => Promise<any>, ok: string) => { setErr(""); setMsg(""); try { await fn(); setMsg(ok); await refresh(); } catch (x) { setErr(errOf(x)); } };
  return (<><PageHeader title="Account & security" subtitle="Your sign-in protection." />
    {(msg || err) && <p role={err ? "alert" : "status"} className={`mb-4 text-sm ${err ? "text-danger" : "text-success"}`}>{err || msg}</p>}
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="clay p-5"><h3 className="font-semibold text-navy mb-1">Two-factor sign-in</h3>
        <p className="text-xs text-muted mb-4">Status: <b className={user.mfa ? "text-success" : "text-warning"}>{user.mfa ? "On" : "Off"}</b>. Use an authenticator app such as Google Authenticator or Microsoft Authenticator.</p>
        {!user.mfa && !setup && <button className="pill-btn" onClick={() => run(async () => setSetup((await api.post("/auth/mfa/setup")).data), "")}>Set up two-factor</button>}
        {!user.mfa && setup && <div className="space-y-3"><div className="flex gap-4 items-center">{qr && <img src={qr} alt="QR code for your authenticator app" className="rounded-xl bg-white p-1" width={150} height={150} />}<div className="text-xs text-muted min-w-0">Scan the code, or enter this key manually:<code className="block mt-1 bg-white rounded px-2 py-1 break-all text-ink">{setup.secret}</code></div></div>
          <input inputMode="numeric" maxLength={6} placeholder="6-digit code" className={inp} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className="pill-btn" onClick={() => run(async () => { await api.post("/auth/mfa/enable", { code }); setSetup(null); setCode(""); }, "Two-factor is now on.")}>Turn on</button></div>}
        {user.mfa && <form className="space-y-3" onSubmit={(e: FormEvent) => { e.preventDefault(); run(async () => { await api.post("/auth/mfa/disable", dis); setDis({ password: "", code: "" }); }, "Two-factor is off."); }}><input type="password" placeholder="Password" className={inp} value={dis.password} onChange={(e) => setDis({ ...dis, password: e.target.value })} /><input inputMode="numeric" maxLength={6} placeholder="Current 6-digit code" className={inp} value={dis.code} onChange={(e) => setDis({ ...dis, code: e.target.value.replace(/\D/g, "") })} /><button className="pill-btn">Turn off</button></form>}
      </section>
      <section className="clay p-5"><h3 className="font-semibold text-navy mb-1">Change password</h3><p className="text-xs text-muted mb-4">At least 10 characters with a letter and a digit. Other devices are signed out.</p>
        <form className="space-y-3" onSubmit={(e: FormEvent) => { e.preventDefault(); run(async () => { await api.post("/auth/change-password", pw); setPw({ current: "", password: "" }); }, "Password changed. Sign in again on other devices."); }}><input type="password" required placeholder="Current password" className={inp} autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /><input type="password" required placeholder="New password" className={inp} autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /><button className="pill-btn">Update password</button></form></section>
    </div></>);
}
