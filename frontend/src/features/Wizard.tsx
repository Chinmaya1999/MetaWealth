import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Check, Plus, Trash2, Upload } from "lucide-react";
import { api } from "../services/api";
import { STEPS, RISK_Q, type Field, type Block } from "./stepConfig";
import { inr } from "../lib/format";

const get = (o: any, path: string) => path.split(".").reduce((a, k) => a?.[k], o);
const set = (o: any, path: string, v: any) => { const c = structuredClone(o ?? {}); let t = c; const ks = path.split("."); ks.slice(0, -1).forEach((k) => (t = t[k] ??= {})); t[ks.at(-1)!] = v; return c; };

function Input({ f, value, onChange }: { f: Field; value: any; onChange: (v: any) => void }) {
  const cls = "w-full border border-line rounded-md px-2.5 py-2 bg-white text-sm";
  if (f.type === "select") return <select className={cls} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>;
  if (f.type === "checkbox") return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[#101D35]" />;
  return <input className={cls} type={f.type ?? "text"} value={value ?? ""} onChange={(e) => onChange(f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />;
}

export default function Wizard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["q", clientId], queryFn: async () => (await api.get(`/clients/${clientId}/questionnaire`)).data });
  const [sp] = useSearchParams(); const [step, setStep] = useState(Math.min(9, Math.max(1, Number(sp.get("step")) || 2))); const [data, setData] = useState<any>(null);
  const [saved, setSaved] = useState(""); const [err, setErr] = useState(""); const timer = useRef<any>(null);
  useEffect(() => { if (q.data && !data) setData(q.data.data ?? {}); }, [q.data, data]);
  if (!q.data || !data) return <div className="text-muted">Loading questionnaire…</div>;
  const S = STEPS[step - 1], done: number[] = q.data.stepsDone;

  const payload = (d: any) => Object.fromEntries(S.groups.filter((g) => g !== "documents").map((g) => [g, d[g] ?? (g === "goals" || g === "assets" || g === "loans" ? [] : {})]));
  async function save(d: any, complete: boolean) {
    setErr("");
    try { await api.put(`/clients/${clientId}/questionnaire/${step}`, { data: payload(d), complete }); setSaved("Saved " + new Date().toLocaleTimeString()); qc.invalidateQueries({ queryKey: ["q", clientId] }); return true; }
    catch (e: any) { setErr(e.response?.data?.error?.message ?? "Save failed"); return false; }
  }
  const change = (path: string, v: any) => {
    let next = set(data, path, v);
    if (step === 8) {
      const e = next.expenses ?? {}; const skip = new Set(["monthly", "annual", "schoolMonthly", "schoolUntil"]);
      const sum = (keys: string[]) => keys.reduce((a, k) => a + (Number(e[k]) || 0), 0);
      const keys = Object.keys(e);
      next = set(next, "expenses.monthly", sum(keys.filter((k) => !skip.has(k) && !k.startsWith("annual"))));
      next = set(next, "expenses.annual", sum(keys.filter((k) => k.startsWith("annual"))));
      next = set(next, "expenses.schoolMonthly", sum(["schoolFees", "tutoring", "activities", "schoolTransport"]));
    }
    setData(next); setSaved("Saving…"); clearTimeout(timer.current); timer.current = setTimeout(() => step !== 1 && save(next, false), 900); // autosave
  };
  const next = async () => { if (step === 1 || (await save(data, true))) setStep(Math.min(9, step + 1)); };
  const submit = async () => {
    if (!(await save(data, true))) return;
    try { await api.post(`/clients/${clientId}/questionnaire/submit`); qc.invalidateQueries({ queryKey: ["q", clientId] }); setSaved("Submitted for review"); } catch (e: any) { setErr(e.response?.data?.error?.message ?? "Submit failed"); }
  };

  const e = data.expenses ?? {}, monthlyExp = Number(e.monthly) || 0;
  const emi = (data.loans ?? []).reduce((s: number, l: any) => s + (Number(l.emi) || 0), 0), th = Number(data.income?.takeHome) || 0;
  const deficit = step === 8 && th > 0 && monthlyExp + emi > th;

  return (
    <div>
      <ol className="flex flex-wrap gap-1.5 mb-5" aria-label="Steps">
        {STEPS.map((s) => (
          <li key={s.n}><button onClick={() => setStep(s.n)} className={`px-3 py-1.5 rounded-full text-xs border flex items-center gap-1.5 ${step === s.n ? "bg-navy text-white border-navy" : "bg-white border-line text-muted hover:border-gold"}`}>
            {done.includes(s.n) && <Check size={12} className="text-success" />}{s.n}. {s.title}</button></li>
        ))}
        <li className="ml-auto text-xs text-muted self-center">{q.data.progress}% complete · {saved}</li>
      </ol>
      <div className="clay p-6">
        <h2 className="font-serif text-2xl text-navy">{S.title}</h2><p className="text-sm text-muted mb-5">{S.why}</p>
        {step === 1 && <Documents clientId={clientId} onApply={(g: any) => { let d = data; for (const [k, v] of Object.entries(g)) d = set(d, k, { ...(get(d, k) ?? {}), ...(v as object) }); setData(d); }} />}
        {S.blocks.map((b: Block, i) => b.kind === "fields" ? (
          <div key={i} className="mb-6">{b.title && <h3 className="font-medium mb-2">{b.title}</h3>}
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">{b.fields.map((f) => (
              <label key={f.key} className={`text-sm ${f.type === "checkbox" ? "sm:col-span-2 flex items-center gap-3" : ""}`}>
                {f.type === "checkbox" ? <Input f={f} value={get(data, b.path)?.[f.key]} onChange={(v) => change(`${b.path}.${f.key}`, v)} /> : null}
                <span className="text-muted">{f.label}</span>{f.hint && <span className="text-xs text-muted"> · {f.hint}</span>}
                {f.type !== "checkbox" && <Input f={f} value={get(data, b.path)?.[f.key]} onChange={(v) => change(`${b.path}.${f.key}`, v)} />}
              </label>))}</div></div>
        ) : b.kind === "rows" ? (
          <div key={i} className="mb-6"><h3 className="font-medium mb-1">{b.title}</h3>{b.help && <p className="text-xs text-muted mb-2">{b.help}</p>}
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{b.columns.map((c) => <th key={c.key} className="text-left text-xs text-muted font-normal pb-1 pr-2">{c.label}</th>)}<th /></tr></thead>
              <tbody>{(get(data, b.path) ?? []).map((row: any, ri: number) => (
                <tr key={ri}>{b.columns.map((c) => <td key={c.key} className="pr-2 pb-2 min-w-[90px]"><Input f={c} value={row[c.key]} onChange={(v) => change(b.path, (get(data, b.path) as any[]).map((r, x) => (x === ri ? { ...r, [c.key]: v } : r)))} /></td>)}
                  <td><button aria-label="Remove row" onClick={() => change(b.path, (get(data, b.path) as any[]).filter((_, x) => x !== ri))} className="p-1.5 text-danger"><Trash2 size={16} /></button></td></tr>))}</tbody></table></div>
            <button onClick={() => change(b.path, [...(get(data, b.path) ?? []), { ...b.blank }])} className="mt-2 inline-flex items-center gap-1.5 text-sm text-navy border border-dashed border-gold rounded-md px-3 py-1.5"><Plus size={14} /> Add another</button></div>
        ) : (
          <div key={i} className="mb-6"><h3 className="font-medium mb-2">Risk profile</h3>
            {RISK_Q.map((qq, qi) => (<label key={qi} className="block text-sm mb-3"><span className="text-muted">{qi + 1}. {qq[0]}</span>
              <select className="w-full border border-line rounded-md px-2.5 py-2 bg-white mt-1" value={data.risk?.answers?.[qi] ?? ""} onChange={(ev) => { const a = [...(data.risk?.answers ?? Array(10).fill(""))]; a[qi] = ev.target.value === "" ? "" : Number(ev.target.value); change("risk.answers", a); }}>
                <option value="">Select…</option>{qq.slice(1).map((o, oi) => <option key={o} value={oi + 1}>{o}</option>)}</select></label>))}</div>
        ))}
        {step === 8 && <div className={`rounded-md p-3 text-sm ${deficit ? "bg-red-50 text-danger" : "bg-ivory"}`}>Monthly total <b>{inr(monthlyExp)}</b> · EMIs {inr(emi)} · take-home {inr(th)}{deficit && " — expenses and EMIs exceed take-home. Please review."}</div>}
        {err && <p role="alert" className="text-danger text-sm mt-3">{err}</p>}
        <div className="flex justify-between mt-6">
          <button disabled={step === 1} onClick={() => setStep(step - 1)} className="px-4 py-2 border border-line rounded-md disabled:opacity-40">Back</button>
          {step < 9 ? <button onClick={next} className="px-5 py-2 bg-navy text-white rounded-md">Save & continue</button> : <button onClick={submit} className="px-5 py-2 bg-gold text-navy font-medium rounded-md">Submit for review</button>}
        </div>
      </div>
    </div>
  );
}

const CATS = [["pan", "PAN card"], ["payslip", "Salary slip"], ["bank", "Bank statement"], ["loan", "Loan statement"], ["insurance", "Insurance policy"], ["form16", "Form 16"], ["property", "Property papers"]];
const APPLY: Record<string, (v: Record<string, string>) => any> = {
  pan: (v) => ({ profile: { ...(v.name && { name: v.name }) } }), payslip: (v) => ({ income: { ...(v.takeHome && { takeHome: Number(v.takeHome) }) }, retirement: { ...(v.pfMonthly && { pfMonthly: Number(v.pfMonthly) * 2 }) } }),
};
function Documents({ clientId, onApply }: { clientId: string; onApply: (g: any) => void }) {
  const qc = useQueryClient();
  const docs = useQuery({ queryKey: ["docs", clientId], queryFn: async () => (await api.get(`/clients/${clientId}/documents`)).data.items });
  const [busy, setBusy] = useState(""); const [edit, setEdit] = useState<Record<string, Record<string, string>>>({}); const [msg, setMsg] = useState("");
  async function up(cat: string, file: File) {
    setBusy(cat); setMsg(""); const fd = new FormData(); fd.append("category", cat); fd.append("file", file);
    try { const { data } = await api.post(`/clients/${clientId}/documents`, fd); setEdit((s) => ({ ...s, [data.document._id]: Object.fromEntries(data.document.extracted.map((x: any) => [x.field, x.value])) })); qc.invalidateQueries({ queryKey: ["docs", clientId] }); }
    catch (e: any) { setMsg(e.response?.data?.error?.message ?? "Upload failed"); } finally { setBusy(""); }
  }
  async function confirm(d: any) {
    const values = edit[d._id] ?? Object.fromEntries(d.extracted.map((x: any) => [x.field, x.value])); const apply = APPLY[d.category]?.(values);
    await api.post(`/clients/${clientId}/documents/${d._id}/confirm`, { values, apply }); if (apply) onApply(apply); qc.invalidateQueries({ queryKey: ["docs", clientId] }); qc.invalidateQueries({ queryKey: ["q", clientId] });
  }
  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-2 mb-4">{CATS.map(([k, l]) => (
        <label key={k} className="border border-line rounded-md p-3 text-sm cursor-pointer hover:border-gold flex items-center gap-2"><Upload size={16} className="text-gold" />{busy === k ? "Reading…" : l}
          <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv" onChange={(e) => e.target.files?.[0] && up(k, e.target.files[0])} /></label>))}</div>
      {msg && <p className="text-danger text-sm">{msg}</p>}
      <p className="text-xs text-muted mb-3">Text files are read automatically in this development build; images and PDFs are stored securely and need manual entry until the OCR provider is configured.</p>
      {(docs.data ?? []).map((d: any) => (
        <div key={d._id} className="border border-line rounded-md p-3 mb-2 text-sm">
          <div className="flex justify-between"><b>{d.filename}</b><span className="text-xs capitalize text-muted">{d.category} · {d.status.replace("_", " ")}</span></div>
          {d.status !== "confirmed" && d.extracted.length > 0 && <div className="mt-2 grid sm:grid-cols-3 gap-2">{d.extracted.map((x: any) => (
            <label key={x.field} className="text-xs text-muted">{x.field} <span>({Math.round(x.confidence * 100)}%)</span>
              <input className="w-full border border-gold bg-[#fff9e8] rounded px-2 py-1 text-sm text-ink" value={edit[d._id]?.[x.field] ?? x.value} onChange={(ev) => setEdit((s) => ({ ...s, [d._id]: { ...(s[d._id] ?? Object.fromEntries(d.extracted.map((y: any) => [y.field, y.value]))), [x.field]: ev.target.value } }))} /></label>))}
            <button onClick={() => confirm(d)} className="self-end bg-navy text-white rounded px-3 py-1.5 text-xs">Confirm values</button></div>}
          {d.status === "confirmed" && <div className="text-success text-xs mt-1">Confirmed</div>}
        </div>))}
    </div>
  );
}
