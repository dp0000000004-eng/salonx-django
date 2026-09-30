import { useMemo, useState } from "react";
import { CalendarDays, CheckSquare, IndianRupee, Star, Users } from "lucide-react";
import { KpiCard, Panel } from "@/components/salonx/DashboardShell";
import { AppointmentDialog, Empty, ErrorNote, Loading, StatusBadge } from "@/components/owner/shared";
import {
  bookingItemName,
  todayISO,
  useOwnerBookings,
  useOwnerOffers,
  useOwnerPackages,
  useOwnerPayments,
  useOwnerReviews,
  useOwnerServices,
  type OwnerBooking,
} from "@/lib/owner-queries";
import { formatMoney, formatTime } from "@/lib/queries";

export function OwnerDashboardHome({ salonId, rating, reviewCount }: { salonId: string; rating: number; reviewCount: number }) {
  const bookings = useOwnerBookings(salonId);
  const services = useOwnerServices(salonId);
  const offers = useOwnerOffers(salonId);
  const packages = useOwnerPackages(salonId);
  const payments = useOwnerPayments(salonId);
  const reviews = useOwnerReviews(salonId);
  const [selected, setSelected] = useState<OwnerBooking | null>(null);

  const rows = bookings.data ?? [];
  const today = todayISO();

  const stats = useMemo(() => {
    const count = (fn: (b: OwnerBooking) => boolean) => rows.filter(fn).length;
    const paid = (payments.data ?? []).filter((p) => p.status === "paid");
    const paidBookingIds = new Set(paid.filter((p) => p.booking_id).map((p) => p.booking_id!));
    const awaiting = rows
      .filter((b) => !["cancelled", "no_show", "expired"].includes(b.status) && !paidBookingIds.has(b.id))
      .reduce((sum, b) => sum + b.amount, 0);
    return {
      today: count((b) => b.booking_date === today),
      pending: count((b) => b.status === "pending"),
      confirmed: count((b) => b.status === "confirmed"),
      completed: count((b) => b.status === "completed"),
      cancelled: count((b) => b.status === "cancelled" || b.status === "no_show"),
      customers: new Set(rows.map((b) => b.customer_id)).size,
      services: (services.data ?? []).filter((s) => s.is_active).length,
      offers: (offers.data ?? []).filter(
        (o) => o.is_active && (!o.expires_at || new Date(o.expires_at) > new Date()),
      ).length,
      packages: (packages.data ?? []).filter((p) => p.is_active).length,
      revenue: paid.reduce((sum, p) => sum + (p.salon_earning || p.amount), 0),
      revenueToday: paid
        .filter((p) => (p.paid_at ?? p.created_at).slice(0, 10) === today)
        .reduce((sum, p) => sum + (p.salon_earning || p.amount), 0),
      paymentCount: (payments.data ?? []).length,
      awaiting,
    };
  }, [rows, payments.data, services.data, offers.data, packages.data, today]);

  const recent = rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  const todays = rows
    .filter((b) => b.booking_date === today)
    .sort((a, b) => a.slot_time.localeCompare(b.slot_time));

  if (bookings.isLoading) return <Loading label="Loading your salon data…" />;
  if (bookings.error) return <ErrorNote error={bookings.error} onRetry={() => void bookings.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Today's appointments" value={String(stats.today)} delta={`${stats.pending} pending approval`} icon={CheckSquare} />
        <KpiCard
          label="Collected revenue"
          value={formatMoney(stats.revenue)}
          delta={
            stats.awaiting > 0
              ? `${formatMoney(stats.awaiting)} awaiting payment`
              : stats.paymentCount === 0
                ? "No payment records yet"
                : `${formatMoney(stats.revenueToday)} today`
          }
          tone="success"
          icon={IndianRupee}
        />
        <KpiCard label="Total customers" value={String(stats.customers)} delta={`${rows.length} appointments all time`} tone="info" icon={Users} />
        <KpiCard
          label="Reviews"
          value={String(reviewCount)}
          delta={reviewCount > 0 ? `★ ${rating} average rating` : "No reviews yet"}
          tone="warning"
          icon={Star}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MiniStat label="Pending" value={stats.pending} />
        <MiniStat label="Confirmed" value={stats.confirmed} />
        <MiniStat label="Completed" value={stats.completed} />
        <MiniStat label="Cancelled / no show" value={stats.cancelled} />
        <MiniStat label="Active services" value={stats.services} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MiniStat label="Active offers" value={stats.offers} />
        <MiniStat label="Active wedding packages" value={stats.packages} />
        <MiniStat label="Payment records" value={stats.paymentCount} />
        <MiniStat label="Reviews received" value={(reviews.data ?? []).length} />
        <MiniStat label="Appointments this month" value={rows.filter((b) => b.booking_date.slice(0, 7) === today.slice(0, 7)).length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Today's schedule" icon={CalendarDays}>
          {todays.length === 0 ? (
            <Empty title="Nothing booked today" description="New bookings appear here the moment a customer books." />
          ) : (
            <ul className="space-y-3">
              {todays.map((b) => (
                <li key={b.id}>
                  <button onClick={() => setSelected(b)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted">
                    <span className="w-16 shrink-0 text-[11px] font-medium text-foreground">{formatTime(b.slot_time.slice(0, 5))}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-foreground">{b.profiles?.full_name ?? "Customer"}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{bookingItemName(b)}</span>
                    </span>
                    <StatusBadge status={b.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent activity" icon={CheckSquare}>
          {recent.length === 0 ? (
            <Empty title="No activity yet" description="Bookings, cancellations and updates will show here." />
          ) : (
            <ul className="space-y-3">
              {recent.map((b) => (
                <li key={b.id}>
                  <button onClick={() => setSelected(b)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-foreground">
                        {b.profiles?.full_name ?? "Customer"} · {bookingItemName(b)}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {new Date(`${b.booking_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
                        {formatTime(b.slot_time.slice(0, 5))} · {formatMoney(b.amount)}
                      </span>
                    </span>
                    <StatusBadge status={b.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <AppointmentDialog booking={selected} salonId={salonId} onClose={() => setSelected(null)} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="salonx-card p-4">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
