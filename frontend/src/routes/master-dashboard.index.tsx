import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarCheck,
  CreditCard,
  Image as ImageIcon,
  MapPin,
  Megaphone,
  Percent,
  Store,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { DonutChart, Legend, TrendChart } from "@/components/salonx/charts";
import { useAdminRange } from "@/components/admin/AdminShell";
import { AdminFormModal, AnnouncementFormModal, LocationFormModal, OfferFormModal, SalonFormModal } from "@/components/admin/forms";
import {
  Badge,
  DataState,
  Empty,
  Panel,
  StatusBadge,
  Spinner,
  TableWrap,
  Td,
  Th,
  dateLabel,
  dateTimeLabel,
  ErrorState,
  inr,
  num,
  pctChange,
  useModal,
} from "@/lib/admin/core";
import {
  useAdminKpis,
  useAdminSalons,
  useAnnouncements,
  useBookingsInRange,
  useRecentBookings,
  useSubscriptions,
  useSystemOverview,
} from "@/lib/admin/data";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/master-dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { range } = useAdminRange();
  const kpis = useAdminKpis(range);
  const bookings = useBookingsInRange(range);
  const recent = useRecentBookings(6);
  const salons = useAdminSalons();
  const subs = useSubscriptions();
  const system = useSystemOverview();
  const announcements = useAnnouncements();

  const salonModal = useModal();
  const adminModal = useModal();
  const locationModal = useModal();
  const offerModal = useModal<{ bannerOnly: boolean }>();
  const annModal = useModal();

  useRealtime(
    ["bookings", "salons", "payments", "payouts", "salon_subscriptions", "announcements", "support_tickets", "profiles"],
    [
      ["admin_kpis"],
      ["admin_bookings_range"],
      ["admin_recent_bookings"],
      ["admin_salons"],
      ["admin_subscriptions"],
      ["admin_system_overview"],
      ["admin_announcements"],
    ],
  );

  const trend = useMemo(() => {
    const rows = bookings.data ?? [];
    const map = new Map<string, number>();
    for (const b of rows) {
      const key = new Date(b.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [bookings.data]);

  const statusSplit = useMemo(() => {
    const rows = bookings.data ?? [];
    const count = (s: string) => rows.filter((r) => r.status === s).length;
    return [
      { name: "Completed", value: count("completed"), color: "var(--color-success)" },
      { name: "Confirmed", value: count("confirmed"), color: "var(--color-primary)" },
      { name: "Cancelled", value: count("cancelled"), color: "var(--color-destructive)" },
      { name: "No Show", value: count("no_show"), color: "var(--color-warning)" },
    ];
  }, [bookings.data]);

  const topCities = useMemo(() => {
    const rows = bookings.data ?? [];
    const map = new Map<string, number>();
    for (const b of rows) {
      const city = b.salons?.city ?? "Unknown";
      map.set(city, (map.get(city) ?? 0) + 1);
    }
    return [...map.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [bookings.data]);

  const topSalons = useMemo(() => {
    const rows = bookings.data ?? [];
    const map = new Map<string, { name: string; bookings: number; revenue: number }>();
    for (const b of rows) {
      const entry = map.get(b.salon_id) ?? { name: b.salons?.name ?? "Unknown salon", bookings: 0, revenue: 0 };
      entry.bookings += 1;
      entry.revenue += Number(b.amount ?? 0);
      map.set(b.salon_id, entry);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [bookings.data]);

  const subSplit = useMemo(() => {
    const rows = subs.data ?? [];
    const soon = Date.now() + 30 * 864e5;
    const active = rows.filter((r) => r.status === "active" && new Date(r.expires_at).getTime() > soon).length;
    const expiring = rows.filter((r) => r.status === "active" && new Date(r.expires_at).getTime() <= soon).length;
    return [
      { name: "Active", value: active, color: "var(--color-success)" },
      { name: "Expiring Soon", value: expiring, color: "var(--color-warning)" },
      { name: "Expired", value: rows.filter((r) => r.status === "expired").length, color: "var(--color-destructive)" },
      { name: "Cancelled", value: rows.filter((r) => r.status === "cancelled").length, color: "var(--color-primary)" },
    ];
  }, [subs.data]);

  const totalBookingsInRange = (bookings.data ?? []).length;
  const totalSubs = subSplit.reduce((a, s) => a + s.value, 0);

  const quickActions = [
    { label: "Add New Salon", icon: Building2, run: () => salonModal.open(true) },
    { label: "Add New Admin", icon: UserPlus, run: () => adminModal.open(true) },
    { label: "Add City / Area", icon: MapPin, run: () => locationModal.open(true) },
    { label: "Create Offer", icon: Percent, run: () => offerModal.open({ bannerOnly: false }) },
    { label: "Upload Banner", icon: ImageIcon, run: () => offerModal.open({ bannerOnly: true }) },
    { label: "View Reports", icon: BarChart3, run: () => void navigate({ to: "/master-dashboard/reports" }) },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      {kpis.isPending ? (
        <Spinner label="Loading platform statistics" />
      ) : kpis.isError ? (
        <ErrorState error={kpis.error} onRetry={() => kpis.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi to="/master-dashboard/approvals" label="Total Salons" value={num(kpis.data.salons.total)} current={kpis.data.salons.current} previous={kpis.data.salons.previous} icon={Store} rangeLabel={range.label} />
          <Kpi to="/master-dashboard/customers" label="Total Customers" value={num(kpis.data.customers.total)} current={kpis.data.customers.current} previous={kpis.data.customers.previous} icon={Users} tone="info" rangeLabel={range.label} />
          <Kpi to="/master-dashboard/bookings" label="Total Bookings" value={num(kpis.data.bookings.total)} current={kpis.data.bookings.current} previous={kpis.data.bookings.previous} icon={CalendarCheck} tone="warning" rangeLabel={range.label} />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Panel title="Bookings Overview" icon={CalendarCheck} action={<Badge tone="primary">{range.label}</Badge>}>
            <DataState query={bookings} empty={<Empty title="No bookings found." description="Bookings made in this period will appear here." icon={CalendarCheck} />}>
              {() => (
                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <TrendChart data={trend} />
                  <div className="flex flex-col justify-center gap-3">
                    <DonutChart data={statusSplit} total={num(totalBookingsInRange)} />
                    <Legend items={statusSplit.map((d) => ({ name: d.name, value: num(d.value), color: d.color }))} />
                  </div>
                </div>
              )}
            </DataState>
          </Panel>

          <Panel title="Quick Actions" icon={Activity}>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
              {quickActions.map((a) => (
                <button key={a.label} onClick={a.run} className="group flex flex-col items-center gap-2 text-center">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                    <a.icon className="size-5" />
                  </span>
                  <span className="text-[11px] font-medium text-foreground">{a.label}</span>
                </button>
              ))}
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <Panel title="Top Cities by Bookings" icon={MapPin} action={<Link to="/master-dashboard/locations" className="text-xs font-medium text-primary hover:underline">View All</Link>}>
              {topCities.length === 0 ? (
                <Empty title="No bookings found." icon={MapPin} />
              ) : (
                <ul className="space-y-3 text-xs">
                  {topCities.map((c, i) => (
                    <li key={c.city} className="flex items-center gap-3">
                      <span className="text-muted-foreground">{i + 1}</span>
                      <span className="flex-1 truncate text-foreground">{c.city}</span>
                      <span className="font-medium text-foreground">{num(c.count)}</span>
                      <span className="text-muted-foreground">
                        {Math.round((c.count / Math.max(totalBookingsInRange, 1)) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Top Performing Salons" icon={Store} action={<Link to="/master-dashboard/approvals" className="text-xs font-medium text-primary hover:underline">View All</Link>}>
              {topSalons.length === 0 ? (
                <Empty title="No salon performance yet." icon={Store} />
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Salon Name</Th>
                      <Th>Bookings</Th>
                      <Th right>Revenue</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSalons.map((s) => (
                      <tr key={s.name} className="border-t border-border">
                        <Td>{s.name}</Td>
                        <Td>{num(s.bookings)}</Td>
                        <Td right>
                          <span className="font-medium text-foreground">{inr(s.revenue)}</span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </Panel>
          </div>

          <Panel title="Recent Registered Salons" icon={Building2} action={<Link to="/master-dashboard/approvals" className="text-xs font-medium text-primary hover:underline">View All</Link>}>
            <DataState query={salons} empty={<Empty title="No salons registered yet." icon={Store} />}>
              {(rows) => (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Salon Name</Th>
                      <Th>Owner Name</Th>
                      <Th>City</Th>
                      <Th>Registered On</Th>
                      <Th>Status</Th>
                      <Th right>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <Td>{s.name}</Td>
                        <Td>{s.profiles?.full_name ?? "—"}</Td>
                        <Td>{s.city}</Td>
                        <Td>{dateLabel(s.created_at)}</Td>
                        <Td>
                          <StatusBadge status={s.status} />
                        </Td>
                        <Td right>
                          <Link to="/master-dashboard/approvals" className="rounded-md bg-primary-soft px-3 py-1 text-[11px] font-medium text-primary">
                            {s.status === "approved" ? "View" : "Review"}
                          </Link>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </DataState>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Recent Bookings" icon={CalendarCheck} action={<Link to="/master-dashboard/bookings" search={{ q: "" }} className="text-xs font-medium text-primary hover:underline">View All</Link>}>
            <DataState query={recent} empty={<Empty title="No bookings found." icon={CalendarCheck} />}>
              {(rows) => (
                <ul className="space-y-3">
                  {rows.map((b) => (
                    <li key={b.id}>
                      <Link to="/master-dashboard/bookings" search={{ q: b.id }} className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-muted">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
                          {(b.profiles?.full_name ?? "NA").slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-foreground">{b.profiles?.full_name ?? "Customer"}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {b.salons?.name ?? "Salon"} · {b.salons?.city ?? ""}
                          </span>
                        </span>
                        <span className="hidden text-[11px] text-muted-foreground sm:block">
                          {dateLabel(b.booking_date)} {b.slot_time}
                        </span>
                        <StatusBadge status={b.status} />
                        <span className="w-14 text-right text-xs font-medium text-foreground">{inr(b.amount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DataState>
          </Panel>

          <Panel title="Subscription Overview" icon={CreditCard} action={<Link to="/master-dashboard/subscriptions" className="text-xs font-medium text-primary hover:underline">View All</Link>}>
            <DataState query={subs} empty={<Empty title="No subscriptions yet." icon={CreditCard} />}>
              {() => (
                <div className="grid items-center gap-3 sm:grid-cols-2">
                  <DonutChart data={subSplit} total={num(totalSubs)} />
                  <Legend items={subSplit.map((d) => ({ name: d.name, value: num(d.value), color: d.color }))} />
                </div>
              )}
            </DataState>
          </Panel>

          <Panel title="System Overview" icon={Activity}>
            <DataState query={system}>
              {(s) => (
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Total Admins" value={num(s.admins)} note="Active platform roles" />
                  <Stat label="Active Users" value={num(s.activeUsers)} note="Enabled accounts" />
                  <Stat label="Support Tickets" value={num(s.tickets)} note="Open & in progress" />
                  <Stat label="System Status" value="Operational" note="Database connected" />
                </div>
              )}
            </DataState>
          </Panel>

          <Panel
            title="Platform Announcements"
            icon={Megaphone}
            action={
              <button onClick={() => annModal.open(true)} className="text-xs font-medium text-primary hover:underline">
                New
              </button>
            }
          >
            <DataState query={announcements} empty={<Empty title="No announcements yet." description="Publish an update for salons and customers." icon={Megaphone} />}>
              {(rows) => (
                <ul className="space-y-4">
                  {rows.slice(0, 4).map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                        <Megaphone className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p className="text-xs font-medium text-foreground">{a.title}</p>
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{dateTimeLabel(a.created_at)}</span>
                        </div>
                        {a.body && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{a.body}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </DataState>
          </Panel>
        </div>
      </div>

      {salonModal.state && <SalonFormModal onClose={salonModal.close} />}
      {adminModal.state && <AdminFormModal onClose={adminModal.close} />}
      {locationModal.state && <LocationFormModal onClose={locationModal.close} />}
      {offerModal.state && <OfferFormModal bannerOnly={offerModal.state.bannerOnly} onClose={offerModal.close} />}
      {annModal.state && <AnnouncementFormModal onClose={annModal.close} />}
    </div>
  );
}

function Kpi({
  label,
  value,
  current,
  previous,
  icon: Icon,
  tone = "primary",
  to,
  rangeLabel,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "info" | "warning";
  to: "/master-dashboard/approvals" | "/master-dashboard/customers" | "/master-dashboard/bookings";
  rangeLabel: string;
}) {
  const change = pctChange(current, previous);
  const up = change >= 0;
  const tones: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success/15 text-success",
    info: "bg-info/15 text-info",
    warning: "bg-warning/20 text-warning",
  };
  return (
    <Link to={to} className="salonx-card block p-5 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className={`mt-3 flex items-center gap-1 text-[11px] ${up ? "text-success" : "text-destructive"}`}>
        {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {Math.abs(change).toFixed(1)}% vs previous period
      </p>
      <p className="text-[10px] text-muted-foreground">{rangeLabel}</p>
    </Link>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{note}</p>
    </div>
  );
}
