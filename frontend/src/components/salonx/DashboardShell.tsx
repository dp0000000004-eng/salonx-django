import { useState, type ComponentType, type ReactNode } from "react";
import { Bell, Globe, LogOut, Menu, Scissors, Search } from "lucide-react";

export type NavItem = { label: string; icon: ComponentType<{ className?: string }> };

export function DashboardShell({
  brandSubtitle,
  nav,
  activeIndex = 0,
  onNavigate,
  title,
  subtitle,
  headerRight,
  promo,
  account,
  showSearch = false,
  notificationCount = 0,
  onSignOut,
  children,
}: {
  brandSubtitle: string;
  nav: NavItem[];
  activeIndex?: number;
  onNavigate?: (index: number) => void;
  title: ReactNode;
  subtitle: string;
  headerRight?: ReactNode;
  promo: { title: string; desc: string; cta: string };
  account: { name: string; role: string };
  showSearch?: boolean;
  notificationCount?: number;
  onSignOut?: () => void;
  children: ReactNode;
}) {
  const [internalActive, setInternalActive] = useState(activeIndex);
  const active = onNavigate ? activeIndex : internalActive;
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-surface">
      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Scissors className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-bold text-white">SalonX</span>
            <span className="block text-[10px] text-sidebar-foreground/60">{brandSubtitle}</span>
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {nav.map((item, i) => (
            <button
              key={item.label}
              onClick={() => {
                if (onNavigate) onNavigate(i);
                else setInternalActive(i);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active === i
                  ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="m-3 rounded-xl bg-sidebar-accent p-4">
          <h3 className="text-sm font-semibold text-white">{promo.title}</h3>
          <p className="mt-1 text-[11px] text-sidebar-foreground/70">{promo.desc}</p>
          <button className="mt-3 w-full rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            {promo.cta}
          </button>
        </div>

        <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
            {account.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-xs font-medium text-white">{account.name}</span>
            <span className="block text-[10px] text-sidebar-foreground/60">{account.role}</span>
          </span>
          {onSignOut && (
            <button
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-lg p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-white"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-border bg-card px-4 py-4 lg:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-foreground">{title}</h1>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {showSearch && (
              <div className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground xl:flex">
                <Search className="size-4" />
                <input placeholder="Search anything..." className="w-44 bg-transparent outline-none" />
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Ctrl + K</kbd>
              </div>
            )}
            {headerRight}
            <button className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs sm:flex">
              <Globe className="size-4" /> English
            </button>
            <button className="relative rounded-lg border border-border p-2" aria-label="Notifications">
              <Bell className="size-4" />
              {notificationCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-semibold text-destructive-foreground">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </button>
            <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
              {account.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  tone = "primary",
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: string;
  tone?: "primary" | "success" | "info" | "warning";
  icon: ComponentType<{ className?: string }>;
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success/15 text-success",
    info: "bg-info/15 text-info",
    warning: "bg-warning/20 text-warning",
  };
  return (
    <div className="salonx-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <span className={`flex size-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-3 text-[11px] text-success">{delta}</p>
    </div>
  );
}

export function Panel({
  title,
  action,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`salonx-card p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Icon && <Icon className="size-4 text-primary" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
