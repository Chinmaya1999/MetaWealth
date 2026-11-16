import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../services/api";
import { inr } from "../lib/format";

const CUR: Record<string, number> = { USD: 83.5, AED: 22.7, GBP: 105, SGD: 62, CAD: 61, AUD: 55, EUR: 90 };
const inp = "border border-white bg-white/80 rounded-2xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/50 w-full";

export default function NriPlanner({ clientId }: { clientId: string }) {
  const [f, setF] = useState({ currency: "USD", fxRate: CUR.USD, inrDepreciationPct: 3, monthlyRemittance: 2000, targetInr: 30000000, years: 12, returnPct: 10, existingInr: 0 });
  const [out, setOut] = useState<any>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));
  const num = (k: keyof typeof f, label: string, step = 1) => <label className="text-xs text-muted">{label}<input type="number" step={step} className={inp} value={f[k]} onChange={(e) => set(k, +e.target.value)} /></label>;
  async function run() { setBusy(true); setErr(""); try { setOut((await api.post(`/clients/${clientId}/nri-plan`, f)).data); } catch (x: any) { setErr(x.response?.data?.error?.message ?? "Could not calculate"); } finally { setBusy(false); } }
  const r = out?.result, g = out?.guide;
  const tile = (l: string, v: string, sub?: string) => <div className="clay p-4"><div className="text-[11px] text-muted">{l}</div><div className="text-xl font-semibold text-navy tabular-nums mt-1">{v}</div>{sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}</div>;
  return (<div className="space-y-5">
    <section className="clay p-5"><h3 className="font-semibold text-navy mb-1">Remittance planner</h3><p className="text-xs text-muted mb-4">How much to send home each month, in your currency, to reach an INR goal. The exchange rate and INR trend are assumptions, not forecasts.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-xs text-muted">Currency<select className={inp} value={f.currency} onChange={(e) => setF((s) => ({ ...s, currency: e.target.value, fxRate: CUR[e.target.value] }))}>{Object.keys(CUR).map((c) => <option key={c}>{c}</option>)}</select></label>
        {num("fxRate", `Rate today (INR per ${f.currency})`, 0.01)}{num("inrDepreciationPct", "INR weakening a year (%)", 0.1)}{num("monthlyRemittance", `Monthly remittance (${f.currency})`)}
        {num("targetInr", "Goal in India (INR)", 100000)}{num("existingInr", "Already invested in India (INR)", 100000)}{num("years", "Years to goal")}{num("returnPct", "Expected return (% a year)", 0.5)}
      </div><button disabled={busy} onClick={run} className="pill-btn mt-4">{busy ? "Calculating…" : "Calculate"}</button>{err && <span role="alert" className="text-danger text-sm ml-3">{err}</span>}</section>
    {r && <>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {tile("Projected corpus", inr(r.corpusInr), `≈ ${r.currency} ${Math.round(r.corpusInForeign).toLocaleString("en-IN")} at the end rate`)}
        {tile(`Needed each month`, `${r.currency} ${Math.round(r.requiredMonthlyRemittance ?? 0).toLocaleString("en-IN")}`, "to reach your goal exactly")}
        {tile("Goal gap", r.shortfallInr > 0 ? inr(r.shortfallInr) + " short" : inr(-r.shortfallInr) + " ahead", r.shortfallInr > 0 ? "at your current remittance" : "at your current remittance")}
        {tile("Total sent", `${r.currency} ${Math.round(r.totalRemitted).toLocaleString("en-IN")}`, `${inr(r.totalRemittedInr)} at future rates`)}
      </div>
      <section className="clay p-5"><h3 className="font-semibold text-navy mb-3">Corpus over time</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={r.yearly}><CartesianGrid strokeDasharray="3 3" stroke="#0001" /><XAxis dataKey="year" tick={{ fontSize: 11 }} label={{ value: "Year", position: "insideBottom", offset: -2, fontSize: 11 }} /><YAxis tickFormatter={(v) => inr(v)} width={78} tick={{ fontSize: 11 }} /><Tooltip formatter={(v: any) => inr(v)} labelFormatter={(l) => `Year ${l}`} /><Area type="monotone" dataKey="corpusInr" name="Corpus" stroke="#C7A45B" fill="#C7A45B33" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div></section>
      <section className="clay overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[11px] text-muted"><th className="p-3 pl-5">Year</th><th>Rate (INR per {r.currency})</th><th className="text-right">Sent that year (INR)</th><th className="text-right pr-5">Corpus (INR)</th></tr></thead><tbody>{r.yearly.map((y: any) => <tr key={y.year} className="border-t border-black/5"><td className="p-3 pl-5">{y.year}</td><td>{y.fx.toFixed(2)}</td><td className="text-right tabular-nums">{inr(y.remittedInr)}</td><td className="text-right tabular-nums pr-5">{inr(y.corpusInr)}</td></tr>)}</tbody></table></section>
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="clay p-5"><h3 className="font-semibold text-navy mb-3">Which Indian account?</h3><ul className="space-y-3 text-sm">{g.accounts.map((a: any) => <li key={a.type}><b className="text-navy">{a.type}</b> — {a.use}<div className="text-xs text-muted">Tax: {a.tax}. Repatriation: {a.repatriation}.</div></li>)}</ul></section>
        <section className="clay p-5"><h3 className="font-semibold text-navy mb-3">{f.currency} and India: things to check</h3><ul className="list-disc pl-5 text-sm space-y-1.5">{[...(g.countries[f.currency] ?? []), ...g.general].map((t: string) => <li key={t}>{t}</li>)}</ul><p className="text-[11px] text-muted mt-3">General information only. Tax and FEMA rules change; confirm with a qualified adviser before acting.</p></section>
      </div></>}
  </div>);
}
