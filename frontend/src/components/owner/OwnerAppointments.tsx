import { useMemo, useState } from "react";
import { Panel } from "@/components/salonx/DashboardShell";
import { AppointmentDialog, Empty, ErrorNote, Loading, StatusBadge, inputClass } from "@/components/owner/shared";
import {
  bookingEndTime,
  bookingItemName,
  STATUS_LABEL,
  useOwnerBookings,
  useOwnerPayments,
  useOwnerServices,
  type OwnerBooking,
} from "@/lib/owner-queries";
import { formatMoney, formatTime } from "@/lib/queries";
import { ListChecks } from "lucide-react";

export function OwnerAppointments({ salonId }: { salonId: string }) {
  const bookings = useOwnerBookings(salonId);
  const services = useOwnerServices(salonId);
  const payments = useOwnerPayments(salonId);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [selected, setSelected] = useState<OwnerBooking | null>(null);

  const payByBooking = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of payments.data ?? []) map.set(p.booking_id, p.status);
    return map;
  }, [payments.data]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (bookings.data ?? []).filter((b) => {
      if (status && b.status !== status) return false;
      if (serviceId && b.service_id !== serviceId) return false;
      if (payStatus) {
        const p = payByBooking.get(b.id) ?? "none";
        if (p !== payStatus) return false;
      }
      if (term) {
        const hay = `${b.profiles?.full_name ?? ""} ${b.profiles?.phone ?? ""} ${bookingItemName(b)}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [bookings.data, q, status, serviceId, payStatus, payByBooking]);

  if (bookings.isLoading) return <Loading label="Loading appointments…" />;
  if (bookings.error) return <ErrorNote error={bookings.error} onRetry={() => void bookings.refetch()} />;

  return (
    <Panel title={`Appointments (${rows.length})`} icon={ListChecks}>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <input className={inputClass} placeholder="Search customer or service" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className={inputClass} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">All services</option>
          {(services.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select className={inputClass} value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
          <option value="">Any payment status</option>
          <option value="none">No payment record</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty title="No appointments match" description="Try clearing the filters, or wait for your next booking." />
      ) : (
        <ul className="space-y-2">
          {rows.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => setSelected(b)}
                className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-primary"
              >
                <span className="min-w-[150px] flex-1">
                  <span className="block text-xs font-medium text-foreground">{b.profiles?.full_name ?? "Customer"}</span>
                  <span className="block text-[11px] text-muted-foreground">{bookingItemName(b)}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(`${b.booking_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatTime(b.slot_time.slice(0, 5))}–{formatTime(bookingEndTime(b))} · {b.duration_min} min
                </span>
                <span className="text-[11px] font-medium text-foreground">{formatMoney(b.amount)}</span>
                <span className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                  {payByBooking.get(b.id) ? `Payment: ${payByBooking.get(b.id)}` : "No payment record"}
                </span>
                <StatusBadge status={b.status} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AppointmentDialog
        booking={selected}
        salonId={salonId}
        {...(selected && payByBooking.get(selected.id) ? { paymentStatus: payByBooking.get(selected.id)! } : {})}
        onClose={() => setSelected(null)}
      />
    </Panel>
  );
}
