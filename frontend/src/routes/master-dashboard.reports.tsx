import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CalendarCheck, IndianRupee, Store, Users } from "lucide-react";
import { BarsChart, DonutChart, Legend, TrendChart } from "@/components/salonx/charts";
import { useAdminRange } from "@/components/admin/AdminShell";
import { DataState, Empty, Panel, TableWrap, Td, Th, inr, num } from "@/lib/admin/core";
import { useAdminCustomers, useAdminSalons, useBookingsInRange, usePayments, useSubscriptions } from "@/lib/admin/data";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/master-dashboard/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { range } = useAdminRange();
  const bookings = useBookingsInRange(range);
  const payments = usePayments();
  const salons = useAdminSalons();
  const customers = useAdminCustomers();
  const subs = useSubscriptions();

  useRealtime(["bookings", "payments", "salons", "profiles"], [["admin_bookings_range"], ["admin_payments"], ["admin_salons"], ["admin_customers"]]);

  const rows = bookings.data ?? [];

  const bookingTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of rows) {
      const key = new Date(b.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [rows]);

  const revenueTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments.data ?? []) {
      if (p.status !== "paid") continue;
      const d = new Date(p.paid_at ?? p.created_at);
      if (d < range.from || d >= range.to) continue;
      const key = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      map.set(key, (map.get(key) ?? 0) + Number(p.amount ?? 0));
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [payments.data, range.from, range.to]);

  const cityBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of rows) map.set(b.salons?.city ?? "Unknown", (map.get(b.salons?.city ?? "Unknown") ?? 0) + 1);
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [rows]);

  const topSalons = useMemo(() => {
    const map = new Map<string, { name: string; bookings: number; revenue: number }>();
    for (const b of rows) {
      const e = map.get(b.salon_id) ?? { name: b.salons?.name ?? "Unknown", bookings: 0, revenue: 0 };
      e.bookings += 1;
      e.revenue += Number(b.amount ?? 0);
      map.set(b.salon_id, e);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [rows]);

  const cancellation = useMemo(() => {
    const cancelled = rows.filter((r) => r.status === "cancelled").length;
    const noShow = rows.filter((r) => r.status === "no_show").length;
    const completed = rows.filter((r) => r.status === "completed").length;
    return [
      { name: "Completed", value: completed, color: "var(--color-success)" },
      { name: "Cancelled", value: cancelled, color: "var(--color-destructive)" },
      { name: "No Show", value: noShow, color: "var(--color-warning)" },
    ];
  }, [rows]);

  const growth = useMemo(() => {
    const inRange = (created: string) => {
      const d = new Date(created);
      return d >= range.from && d < range.to;
    };
    return {
      salons: (salons.data ?? []).filter((s) => inRange(s.created_at)).length,
      customers: (customers.data ?? []).filter((c) => inRange(c.created_at)).length,
      subs: (subs.data ?? []).filter((s) => inRange(s.started_at)).length,
    };
  }, [salons.data, customers.data, subs.data, range.from, range.to]);

  const paidInRange = (payments.data ?? []).filter((p) => {
    if (p.status !== "paid") return false;
    const d = new Date(p.paid_at ?? p.created_at);
    return d >= range.from && d < range.to;
  });
  const revenue = paidInRange.reduce((a, p) => a + Number(p.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CalendarCheck} label="Bookings" value={num(rows.length)} note={range.label} />
        <Metric icon={IndianRupee} label="Revenue" value={inr(revenue)} note="Successful payments" />
        <Metric icon={Store} label="New salons" value={num(growth.salons)} note={range.label} />
        <Metric icon={Users} label="New customers" value={num(growth.customers)} note={range.label} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Bookings Trend" icon={BarChart3}>
          <DataState query={bookings} empty={<Empty title="No bookings found." icon={CalendarCheck} />}>
            {() => <TrendChart data={bookingTrend} />}
          </DataState>
        </Panel>
        <Panel title="Revenue Trend" icon={IndianRupee}>
          <DataState query={payments} empty={<Empty title="No paid bookings yet." icon={IndianRupee} />}>
            {() => (revenueTrend.length ? <TrendChart data={revenueTrend} /> : <Empty title="No revenue in this period." icon={IndianRupee} />)}
          </DataState>
        </Panel>
        <Panel title="City-wise Bookings" icon={BarChart3}>
          {cityBars.length === 0 ? <Empty title="No bookings found." icon={BarChart3} /> : <BarsChart data={cityBars} />}
        </Panel>
        <Panel title="Cancellation Report" icon={BarChart3}>
          {rows.length === 0 ? (
            <Empty title="No bookings found." icon={BarChart3} />
          ) : (
            <div className="grid items-center gap-3 sm:grid-cols-2">
              <DonutChart data={cancellation} total={num(rows.length)} />
              <Legend items={cancellation.map((c) => ({ name: c.name, value: num(c.value), color: c.color }))} />
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Top Salons" icon={Store}>
        {topSalons.length === 0 ? (
          <Empty title="No salon performance yet." icon={Store} />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Salon</Th>
                <Th>Bookings</Th>
                <Th right>Revenue</Th>
              </tr>
            </thead>
            <tbody>
              {topSalons.map((s, i) => (
                <tr key={s.name} className="border-t border-border">
                  <Td>{i + 1}</Td>
                  <Td>{s.name}</Td>
                  <Td>{num(s.bookings)}</Td>
                  <Td right>{inr(s.revenue)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="salonx-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{note}</p>
    </div>
  );
}
