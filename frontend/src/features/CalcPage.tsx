import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api } from "../services/api";
import PlanView from "./PlanView";
import { EmptyState } from "../components/ui";

export default function CalcPage({ clientId, section, render }: { clientId: string; section?: string; render?: (r: any) => JSX.Element }) {
  const qc = useQueryClient();
  const latest = useQuery({ queryKey: ["calc", clientId], queryFn: async () => (await api.get(`/clients/${clientId}/calculations/latest`)).data });
  const run = useMutation({ mutationFn: async () => (await api.post(`/clients/${clientId}/calculations/run`)).data, onSuccess: () => qc.invalidateQueries({ queryKey: ["calc", clientId] }) });
  const btn = <button onClick={() => run.mutate()} disabled={run.isPending} className="pill-btn inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={15} className={run.isPending ? "animate-spin" : ""} />{run.isPending ? "Calculating…" : "Recalculate"}</button>;
  if (latest.isLoading) return <div className="text-muted">Loading…</div>;
  if (!latest.data?.result) return <><EmptyState title="No calculation yet" body="Fill in the questionnaire, then calculate to see your figures." /><div className="mt-4">{btn}</div>{run.error && <p className="text-danger text-sm mt-2">Calculation failed.</p>}</>;
  return <><div className="flex items-center justify-between mb-4 text-xs text-muted"><span>Calculated {new Date(latest.data.at).toLocaleString()} · assumptions v{latest.data.assumptionVersion}</span>{btn}</div>{render ? render(latest.data.result) : <PlanView r={latest.data.result} section={section} />}</>;
}
