import { useMemo, useState } from "react";
import { IndianRupee } from "lucide-react";
import { Panel } from "@/components/salonx/DashboardShell";
import { AppointmentDialog, Empty, ErrorNote, Loading } from "@/components/owner/shared";
import { bookingItemName, useOwnerBookings, useOwnerPayments, type OwnerBooking } from "@/lib/owner-queries";
import { formatMoney } from "@/lib/queries";
import { useRealtime } from "@/lib/realtime";

type Filter = "all" | "paid" | "unpaid";

const dateLabel = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function OwnerPayments({ salonId }: { salonId: string }) {
  const payments = useOwnerPayments(salonId);
  const bookings = useOwnerBookings(salonId);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<OwnerBooking | null>(null);

  // Live: any payment/booking change for this salon refetches from the database.
  useRealtime(["payments", "bookings"], [["owner_payments", salonId], ["owner_bookings", salonId]], `salon_id=eq.${salonId}`);

  const paymentByBooking = useMemo(() => {
    const m = new Map<string, NonNullable<typeof payments.data>[number]>();
    for (const p of payments.data ?? []) if (p.booking_id) m.set(p.booking_id, p);
    return m;
  }, [payments.data]);

  // Revenue = sum of the salon's payment records whose status is "paid" (one record per booking in the database).
  const revenue = useMemo(() => {
    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(startDay);
    startWeek.setDate(startDay.getDate() - ((startDay.getDay() + 6) % 7));
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paid = (payments.data ?? []).filter((p) => p.status === "paid");
    const sum = (from?: Date) =>
      paid.filter((p) => !from || new Date(p.paid_at ?? p.created_at) >= from).reduce((s, p) => s + Number(p.amount || 0), 0);
    return { total: sum(), today: sum(startDay), week: sum(startWeek), month: sum(startMonth), count: paid.length };
  }, [payments.data]);

  const rows = useMemo(() => {
    const list = (bookings.data ?? [])
      .filter((b) => !["cancelled", "no_show", "expired"].includes(b.status))
      .map((b) => ({ booking: b, payment: paymentByBooking.get(b.id) ?? null }));
    const filtered = list.filter(({ payment }) => {
      const isPaid = payment?.status === "paid";
      return filter === "all" ? true : filter === "paid" ? isPaid : !isPaid;
    });
    return filtered.sort((a, b) => b.booking.booking_date.localeCompare(a.booking.booking_date));
  }, [bookings.data, paymentByBooking, filter]);

  if (payments.isLoading || bookings.isLoading) return <Loading label="Loading payment history…" />;
  if (payments.error) return <ErrorNote error={payments.error} onRetry={() => void payments.refetch()} />;
  if (bookings.error) return <ErrorNote error={bookings.error} onRetry={() => void bookings.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Stat label="Total revenue" value={formatMoney(revenue.total)} />
        <Stat label="Today" value={formatMoney(revenue.today)} />
        <Stat label="This week" value={formatMoney(revenue.week)} />
        <Stat label="This month" value={formatMoney(revenue.month)} />
        <Stat label="Paid bookings" value={String(revenue.count)} />
      </div>

      <Panel title="Payment History" icon={IndianRupee}>
        <div role="tablist" aria-label="Filter payments" className="mb-3 flex w-full gap-1 rounded-xl border border-border bg-card p-1 sm:w-fit">
          {(["all", "paid", "unpaid"] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-lg px-4 py-2 text-xs font-medium capitalize sm:flex-none ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <Empty title="No payment records" description="Bookings and their payments appear here as soon as they happen." />
        ) : (
          <ul className="space-y-2">
            {rows.map(({ booking: b, payment: p }) => {
              const isPaid = p?.status === "paid";
              return (
                <li key={b.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {b.profiles?.full_name ?? "Customer"} · {bookingItemName(b)}
                      </p>
                      <p className="mt-0.5 break-all text-[11px] text-muted-foreground">
                        Booking #{b.id.slice(0, 8)}
                        {p ? ` · Payment #${p.id.slice(0, 8)}` : ""} · {dateLabel(`${b.booking_date}T00:00:00`)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {isPaid ? `Paid ${dateLabel(p?.paid_at)} · ${p?.method.replace(/_/g, " ")}` : "Not paid yet"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-foreground">{formatMoney(p?.amount ?? b.amount)}</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                          isPaid ? "bg-success/15 text-success" : "bg-warning/20 text-warning"
                        }`}
                      >
                        {isPaid ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                  </div>
                  {!isPaid && p?.status !== "refunded" && p?.status !== "cancelled" && (
                    <button
                      onClick={() => setSelected(b)}
                      className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto"
                    >
                      Mark as Paid
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <AppointmentDialog booking={selected} salonId={salonId} onClose={() => setSelected(null)} />
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
