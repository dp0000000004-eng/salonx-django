import { useState, type ComponentType, type ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, RotateCw, X } from "lucide-react";

/* ------------------------------------------------------------------ format */

export const inr = (paise: number) =>
  "₹" + Math.round(paise ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const num = (n: number) => (n ?? 0).toLocaleString("en-IN");

export function dateLabel(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTimeLabel(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function pctChange(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/* ------------------------------------------------------------- date ranges */

export type RangeKey =
  | "today"
  | "yesterday"
  | "week"
  | "lastweek"
  | "month"
  | "lastmonth"
  | "custom";

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "lastweek", label: "Last Week" },
  { key: "month", label: "This Month" },
  { key: "lastmonth", label: "Last Month" },
  { key: "custom", label: "Custom Range" },
];

export type ResolvedRange = {
  key: RangeKey;
  label: string;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function resolveRange(key: RangeKey, customFrom?: string, customTo?: string): ResolvedRange {
  const now = new Date();
  const today = startOfDay(now);
  let from = today;
  let to = addDays(today, 1);

  if (key === "yesterday") {
    from = addDays(today, -1);
    to = today;
  } else if (key === "week") {
    from = addDays(today, -((today.getDay() + 6) % 7));
    to = addDays(from, 7);
  } else if (key === "lastweek") {
    const thisWeek = addDays(today, -((today.getDay() + 6) % 7));
    from = addDays(thisWeek, -7);
    to = thisWeek;
  } else if (key === "month") {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  } else if (key === "lastmonth") {
    from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    to = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (key === "custom" && customFrom && customTo) {
    from = new Date(customFrom + "T00:00:00");
    to = addDays(new Date(customTo + "T00:00:00"), 1);
  }

  const span = to.getTime() - from.getTime();
  return {
    key,
    label: RANGE_OPTIONS.find((o) => o.key === key)?.label ?? "Today",
    from,
    to,
    prevFrom: new Date(from.getTime() - span),
    prevTo: from,
  };
}

/* ------------------------------------------------------------------- state */

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}…
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-6 py-10 text-center">
      <AlertTriangle className="size-5 text-destructive" />
      <p className="mt-3 text-sm font-medium text-foreground">Could not load this data</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {error instanceof Error ? error.message : "Something went wrong."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <RotateCw className="size-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function Empty({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Loading / error / empty / content switch for any react-query result. */
export function DataState<T>({
  query,
  empty,
  children,
}: {
  query: { data?: T; isPending: boolean; isError: boolean; error: unknown; refetch: () => void };
  empty?: ReactNode;
  children: (data: NonNullable<T>) => ReactNode;
}) {
  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const data = query.data as NonNullable<T>;
  const isEmpty = Array.isArray(data) && data.length === 0;
  if (isEmpty && empty) return <>{empty}</>;
  return <>{children(data)}</>;
}

/* ------------------------------------------------------------------ badges */

const TONES: Record<string, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
};

export function statusTone(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (["approved", "completed", "active", "paid", "resolved", "successful", "confirmed"].includes(s)) return "success";
  if (["pending", "upcoming", "processing", "trialing", "waiting", "in_progress", "expiring"].includes(s)) return "warning";
  if (["rejected", "cancelled", "failed", "suspended", "expired", "no_show"].includes(s)) return "danger";
  if (["checked_in", "service_started", "open", "refunded"].includes(s)) return "info";
  return "muted";
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium capitalize ${TONES[tone] ?? TONES["muted"]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  return <Badge tone={statusTone(status)}>{(status ?? "unknown").replace(/_/g, " ")}</Badge>;
}

/* ------------------------------------------------------------------ layout */

export function Panel({
  title,
  icon: Icon,
  action,
  children,
  className = "",
}: {
  title?: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`salonx-card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {Icon && <Icon className="size-4 text-primary" />}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full min-w-[640px] text-xs">{children}</table>
    </div>
  );
}

export function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return <th className={`whitespace-nowrap pb-2 font-medium text-muted-foreground ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

export function Td({ children, right = false, className = "" }: { children: ReactNode; right?: boolean; className?: string }) {
  return <td className={`py-2.5 pr-3 align-middle ${right ? "text-right" : ""} ${className}`}>{children}</td>;
}

/* ------------------------------------------------------------------ inputs */

export const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring";

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "soft";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    soft: "bg-primary-soft text-primary hover:bg-primary/15",
    ghost: "border border-border text-foreground hover:bg-muted",
    danger: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-200 disabled:opacity-60 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl border border-border bg-card p-5 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function useModal<T = true>() {
  const [state, setState] = useState<T | null>(null);
  return { state, open: (v: T) => setState(v), close: () => setState(null) };
}
