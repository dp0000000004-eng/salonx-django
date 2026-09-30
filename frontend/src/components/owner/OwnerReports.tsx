import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, IndianRupee, ListChecks } from "lucide-react";
import { Panel } from "@/components/salonx/DashboardShell";
import { BarsChart, DonutChart, Legend, TrendChart } from "@/components/salonx/charts";
import { Empty, ErrorNote, Loading } from "@/components/owner/shared";
import { bookingItemName, useOwnerBookings, useOwnerPayments, type OwnerBooking } from "@/lib/owner-queries";
import { formatMoney } from "@/lib/queries";

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function OwnerReports({ salonId }: { salonId: string }) {
  const bookings = useOwnerBookings(salonId);
  const payments = useOwnerPayments(salonId);
  const [days, setDays] = useState(30);

  const from = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    return dayKey(d);
  }, [days]);

  const rows = (bookings.data ?? []).filter((b) => b.booking_date >= from);
  const paid = (payments.data ?? []).filter((p) => p.status === "paid" && (p.paid_at ?? p.created_at).slice(0, 10) >= from);

  const series = useMemo(() => {
    const buckets = new Map<string, { bookings: number; revenue: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets.set(dayKey(d), { bookings: 0, revenue: 0 });
    }
    for (const b of rows) {
      const slot = buckets.get(b.booking_date);
      if (slot) slot.bookings += 1;
    }
    for (const p of paid) {
      const slot = buckets.get((p.paid_at ?? p.created_at).slice(0, 10));
      if (slot) slot.revenue += p.salon_earning || p.amount;
    }
    return [...buckets.entries()].map(([date, v]) => ({
      name: new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      bookings: v.bookings,
      revenue: v.revenue,
    }));
  }, [rows, paid, days]);

  const statusMix = useMemo(() => {
    const count = (fn: (b: OwnerBooking) => boolean) => rows.filter(fn).length;
    return [
      { name: "Completed", value: count((b) => b.status === "completed"), color: "var(--color-success)" },
      { name: "Active", value: count((b) => ["pending", "confirmed", "upcoming", "checked_in", "waiting", "service_started"].includes(b.status)), color: "var(--color-primary)" },
      { name: "Cancelled", value: count((b) => b.status === "cancelled"), color: "var(--color-destructive)" },
      { name: "No show", value: count((b) => b.status === "no_show"), color: "var(--color-warning)" },
    ].filter((s) => s.value > 0);
  }, [rows]);

  const topItems = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of rows) map.set(bookingItemName(b), (map.get(bookingItemName(b)) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [rows]);

  const revenueTotal = paid.reduce((s, p) => s + (p.salon_earning || p.amount), 0);
  const completed = rows.filter((b) => b.status === "completed").length;

  if (bookings.isLoading || payments.isLoading) return <Loading label="Building your reports…" />;
  if (bookings.error) return <ErrorNote error={bookings.error} onRetry={() => void bookings.refetch()} />;

  const rangePicker = (
    <div className="flex flex-wrap gap-1">
      {RANGES.map((r) => (
        <button
          key={r.days}
          onClick={() => setDays(r.days)}
          className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
            days === r.days ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">All figures are calculated from your salon's real records.</p>
        {rangePicker}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Appointments" value={String(rows.length)} />
        <Stat label="Completed" value={String(completed)} />
        <Stat label="Completion rate" value={rows.length ? `${Math.round((completed / rows.length) * 100)}%` : "—"} />
        <Stat label="Earnings" value={paid.length ? formatMoney(revenueTotal) : "—"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Appointments over time" icon={CalendarDays}>
          {rows.length === 0 ? (
            <Empty title="No appointments in this period" description="Pick a longer range or wait for new bookings." />
          ) : (
            <TrendChart data={series.map((s) => ({ name: s.name, value: s.bookings }))} />
          )}
        </Panel>

        <Panel title="Status mix" icon={BarChart3}>
          {statusMix.length === 0 ? (
            <Empty title="Nothing to chart yet" description="Status breakdown appears once you have bookings." />
          ) : (
            <div className="space-y-3">
              <DonutChart data={statusMix} total={String(rows.length)} />
              <Legend items={statusMix.map((s) => ({ name: s.name, value: String(s.value), color: s.color }))} />
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Earnings over time" icon={IndianRupee}>
          {paid.length === 0 ? (
            <Empty title="No recorded payments" description="Earnings charts appear once payments are recorded." />
          ) : (
            <BarsChart data={series.map((s) => ({ name: s.name, value: s.revenue }))} />
          )}
        </Panel>

        <Panel title="Most booked" icon={ListChecks}>
          {topItems.length === 0 ? (
            <Empty title="No bookings yet" description="Your most popular services will be ranked here." />
          ) : (
            <ul className="space-y-3">
              {topItems.map(([name, count]) => (
                <li key={name} className="flex items-center gap-3 text-xs">
                  <span className="w-28 shrink-0 truncate text-foreground">{name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(count / (topItems[0]?.[1] ?? 1)) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right font-medium text-foreground">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="salonx-card p-4">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
