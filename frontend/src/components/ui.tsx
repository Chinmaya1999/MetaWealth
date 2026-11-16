import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export const PageHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-6"><h1 className="font-serif text-3xl text-navy tracking-tight">{title}</h1>{subtitle && <p className="text-muted mt-1">{subtitle}</p>}</div>
);
export const StatCard = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <div className="clay p-5">
    <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
    <div className="font-serif text-2xl text-navy mt-2">{value}</div>
    {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
  </div>
);
export const EmptyState = ({ title, body }: { title: string; body: string }) => (
  <div className="clay-flat border-dashed p-10 text-center">
    <Inbox className="mx-auto text-gold" aria-hidden /><div className="font-medium mt-3">{title}</div><p className="text-sm text-muted mt-1">{body}</p>
  </div>
);
