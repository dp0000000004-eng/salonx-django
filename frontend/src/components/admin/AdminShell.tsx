import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  BarChart3,
  Bell,
  CalendarCheck,
  CreditCard,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  Scissors,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { globalSearch } from "@/lib/admin/data";
import { RANGE_OPTIONS, resolveRange, inputClass, type RangeKey, type ResolvedRange } from "@/lib/admin/core";

export const ADMIN_NAV = [
  { label: "Dashboard", to: "/master-dashboard", icon: LayoutDashboard, exact: true },
  { label: "Salon Approvals", to: "/master-dashboard/approvals", icon: ShieldCheck },
  { label: "Admins", to: "/master-dashboard/admins", icon: UsersRound },
  { label: "Customers", to: "/master-dashboard/customers", icon: Users },
  { label: "Bookings", to: "/master-dashboard/bookings", icon: CalendarCheck },
  { label: "Services & Categories", to: "/master-dashboard/services", icon: Scissors },
  { label: "Hairstyles", to: "/master-dashboard/hairstyles", icon: Sparkles },
  { label: "Cities & Locations", to: "/master-dashboard/locations", icon: MapPin },
  { label: "Subscription", to: "/master-dashboard/subscriptions", icon: CreditCard },
  { label: "Payment Gateway", to: "/master-dashboard/payment-gateway", icon: Banknote },
  { label: "Offers & Banners", to: "/master-dashboard/offers", icon: Gift },
  { label: "Reports & Analytics", to: "/master-dashboard/reports", icon: BarChart3 },
  { label: "Support & Tickets", to: "/master-dashboard/support", icon: LifeBuoy },
  { label: "Contact Messages", to: "/master-dashboard/messages", icon: Bell },
  { label: "Notifications", to: "/master-dashboard/notifications", icon: Megaphone },
  { label: "Settings", to: "/master-dashboard/settings", icon: Settings },
] as const;

/* --------------------------------------------------------- date range ctx */

type RangeCtx = {
  range: ResolvedRange;
  rangeKey: RangeKey;
  setRangeKey: (k: RangeKey) => void;
  custom: { from: string; to: string };
  setCustom: (c: { from: string; to: string }) => void;
};

const RangeContext = createContext<RangeCtx | null>(null);

export function useAdminRange() {
  const ctx = useContext(RangeContext);
  if (!ctx) throw new Error("useAdminRange must be used inside the admin shell");
  return ctx;
}

/* ------------------------------------------------------------------ shell */

export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const [rangeKey, setRangeKey] = useState<RangeKey>("week");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = useMemo(() => resolveRange(rangeKey, custom.from, custom.to), [rangeKey, custom]);

  const notifications = useQuery({
    queryKey: ["admin_notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await api
        .from("notifications")
        .select("id, title, body, category, is_read, link, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  useRealtime(
    ["notifications"],
    [["admin_notifications", user?.id]],
    user?.id ? `user_id=eq.${user.id}` : undefined,
  );

  const unread = (notifications.data ?? []).filter((n) => !n.is_read).length;

  async function markAllRead() {
    if (!user) return;
    await api.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    void queryClient.invalidateQueries({ queryKey: ["admin_notifications", user.id] });
  }

  async function handleSignOut() {
    await signOut();
    void navigate({ to: "/master-dashboard", replace: true });
  }

  const name = profile?.full_name || "Super Admin";

  return (
    <RangeContext.Provider value={{ range, rangeKey, setRangeKey, custom, setCustom }}>
      <div className="flex min-h-screen w-full bg-surface">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-2.5 px-5 py-5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Scissors className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-bold text-white">SalonX</span>
              <span className="block text-[10px] text-sidebar-foreground/60">Super Admin</span>
            </span>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
            {ADMIN_NAV.map((item) => {
              const exact = (item as { exact?: boolean }).exact === true;
              const active = exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200 ${
                    active
                      ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-4">
            <span className="relative flex size-9 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
              {name.slice(0, 2).toUpperCase()}
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-sidebar bg-success" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-xs font-medium text-white">{name}</span>
              <span className="block truncate text-[10px] text-sidebar-foreground/60">{user?.email}</span>
            </span>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-lg p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-white"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 lg:px-6">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight text-foreground">Welcome back, {name}! 👋</h1>
              <p className="truncate text-[11px] text-muted-foreground">Here's what's happening on your platform today.</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted md:flex"
              >
                <Search className="size-4" /> Search platform…
              </button>
              <button onClick={() => setSearchOpen(true)} aria-label="Search" className="rounded-lg border border-border p-2 md:hidden">
                <Search className="size-4" />
              </button>

              <select
                value={rangeKey}
                onChange={(e) => setRangeKey(e.target.value as RangeKey)}
                className="rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground"
                aria-label="Date range"
              >
                {RANGE_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>

              <div className="relative">
                <button onClick={() => setBellOpen((v) => !v)} className="relative rounded-lg border border-border p-2" aria-label="Notifications">
                  <Bell className="size-4" />
                  {unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-semibold text-destructive-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <div className="absolute right-0 top-11 z-30 w-80 rounded-xl border border-border bg-card p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">Notifications</p>
                      <button onClick={markAllRead} className="text-[11px] font-medium text-primary hover:underline">
                        Mark all read
                      </button>
                    </div>
                    <ul className="max-h-80 space-y-2 overflow-y-auto">
                      {(notifications.data ?? []).length === 0 && (
                        <li className="py-6 text-center text-[11px] text-muted-foreground">No notifications yet.</li>
                      )}
                      {(notifications.data ?? []).map((n) => (
                        <li key={n.id} className={`rounded-lg p-2 text-[11px] ${n.is_read ? "" : "bg-primary-soft/60"}`}>
                          <p className="font-medium text-foreground">{n.title}</p>
                          {n.body && <p className="text-muted-foreground">{n.body}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                {name.slice(0, 2).toUpperCase()}
              </span>
            </div>

            {rangeKey === "custom" && (
              <div className="flex w-full flex-wrap items-center gap-2 pt-1">
                <input
                  type="date"
                  value={custom.from}
                  onChange={(e) => setCustom({ ...custom, from: e.target.value })}
                  className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={custom.to}
                  onChange={(e) => setCustom({ ...custom, to: e.target.value })}
                  className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs"
                />
              </div>
            )}
          </header>

          <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
        </div>

        {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
      </div>
    </RangeContext.Provider>
  );
}

/* ---------------------------------------------------------- global search */

function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(id);
  }, [term]);

  const results = useQuery({
    queryKey: ["admin_global_search", debounced],
    queryFn: () => globalSearch(debounced),
    enabled: debounced.trim().length >= 2,
  });

  const groups = results.data;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search salons, customers, bookings, transactions, tickets…"
            className={inputClass + " border-0 px-0 focus:ring-0"}
          />
          <button onClick={onClose} aria-label="Close search">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-3 text-xs">
          {debounced.trim().length < 2 && <p className="py-6 text-center text-muted-foreground">Type at least 2 characters.</p>}
          {results.isFetching && (
            <p className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </p>
          )}
          {groups && (
            <div className="space-y-4">
              <Group title="Salons" empty={groups.salons.length === 0}>
                {groups.salons.map((s) => (
                  <Link key={s.id} to="/master-dashboard/approvals" onClick={onClose} className="block rounded-lg px-2 py-1.5 hover:bg-muted">
                    {s.name} <span className="text-muted-foreground">· {s.city}</span>
                  </Link>
                ))}
              </Group>
              <Group title="Customers" empty={groups.customers.length === 0}>
                {groups.customers.map((c) => (
                  <Link key={c.id} to="/master-dashboard/customers" search={{ q: c.full_name ?? c.email ?? "" }} onClick={onClose} className="block rounded-lg px-2 py-1.5 hover:bg-muted">
                    {c.full_name ?? "Unnamed"} <span className="text-muted-foreground">· {c.email}</span>
                  </Link>
                ))}
              </Group>
              <Group title="Bookings" empty={groups.bookings.length === 0}>
                {groups.bookings.map((b) => (
                  <Link key={b.id} to="/master-dashboard/bookings" search={{ q: b.id }} onClick={onClose} className="block rounded-lg px-2 py-1.5 hover:bg-muted">
                    #{b.id.slice(0, 8)} <span className="text-muted-foreground">· {b.status}</span>
                  </Link>
                ))}
              </Group>
              <Group title="Support tickets" empty={groups.tickets.length === 0}>
                {groups.tickets.map((t) => (
                  <Link key={t.id} to="/master-dashboard/support" search={{ q: t.subject }} onClick={onClose} className="block rounded-lg px-2 py-1.5 hover:bg-muted">
                    {t.subject} <span className="text-muted-foreground">· {t.status}</span>
                  </Link>
                ))}
              </Group>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  if (empty) return null;
  return (
    <div>
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
