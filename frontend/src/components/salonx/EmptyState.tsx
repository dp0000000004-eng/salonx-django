import type { ComponentType, ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card text-center ${
        compact ? "px-4 py-8" : "px-6 py-14"
      }`}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingGrid({ count = 6, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={className || "grid gap-4 md:grid-cols-2 xl:grid-cols-4"}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="salonx-card h-40 animate-pulse bg-muted/50" />
      ))}
    </div>
  );
}
