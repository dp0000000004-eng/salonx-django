import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { Panel } from "@/components/salonx/DashboardShell";
import { AppointmentDialog, Empty, ErrorNote, Loading, Modal, StatusBadge, inputClass } from "@/components/owner/shared";
import { bookingItemName, useOwnerBookings, type OwnerBooking } from "@/lib/owner-queries";
import { formatMoney, formatTime } from "@/lib/queries";

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  visits: number;
  completed: number;
  cancelled: number;
  spend: number;
  last: string;
  bookings: OwnerBooking[];
};

export function OwnerCustomers({ salonId }: { salonId: string }) {
  const bookings = useOwnerBookings(salonId);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<CustomerRow | null>(null);
  const [selected, setSelected] = useState<OwnerBooking | null>(null);

  const customers = useMemo(() => {
    const map = new Map<string, CustomerRow>();
    for (const b of bookings.data ?? []) {
      const row =
        map.get(b.customer_id) ??
        ({
          id: b.customer_id,
          name: b.profiles?.full_name ?? "Customer",
          phone: b.profiles?.phone ?? null,
          email: b.profiles?.email ?? null,
          visits: 0,
          completed: 0,
          cancelled: 0,
          spend: 0,
          last: b.booking_date,
          bookings: [],
        } satisfies CustomerRow);
      row.visits += 1;
      if (b.status === "completed") {
        row.completed += 1;
        row.spend += b.amount;
      }
      if (b.status === "cancelled" || b.status === "no_show") row.cancelled += 1;
      if (b.booking_date > row.last) row.last = b.booking_date;
      row.bookings.push(b);
      map.set(b.customer_id, row);
    }
    const term = q.trim().toLowerCase();
    return [...map.values()]
      .filter((c) => !term || `${c.name} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(term))
      .sort((a, b) => b.last.localeCompare(a.last));
  }, [bookings.data, q]);

  if (bookings.isLoading) return <Loading label="Loading customers…" />;
  if (bookings.error) return <ErrorNote error={bookings.error} onRetry={() => void bookings.refetch()} />;

  return (
    <Panel title={`Customers (${customers.length})`} icon={Users}>
      <input className={`${inputClass} mb-4 sm:max-w-sm`} placeholder="Search by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
      {customers.length === 0 ? (
        <Empty title="No customers yet" description="Customers appear here once they book an appointment at your salon." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2">Customer</th>
                <th>Contact</th>
                <th>Visits</th>
                <th>Completed</th>
                <th>Cancelled</th>
                <th>Total spend</th>
                <th>Last visit</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="cursor-pointer border-t border-border hover:bg-muted" onClick={() => setOpen(c)}>
                  <td className="py-2.5 font-medium text-foreground">{c.name}</td>
                  <td className="text-muted-foreground">{c.phone ?? c.email ?? "Not shared"}</td>
                  <td>{c.visits}</td>
                  <td>{c.completed}</td>
                  <td>{c.cancelled}</td>
                  <td className="font-medium text-foreground">{formatMoney(c.spend)}</td>
                  <td className="text-muted-foreground">
                    {new Date(`${c.last}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.name} · booking history` : ""} wide>
        {open && (
          <ul className="space-y-2">
            {open.bookings
              .slice()
              .sort((a, b) => b.booking_date.localeCompare(a.booking_date))
              .map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => {
                      setSelected(b);
                      setOpen(null);
                    }}
                    className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-left"
                  >
                    <span className="flex-1 text-xs font-medium text-foreground">{bookingItemName(b)}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(`${b.booking_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
                      {formatTime(b.slot_time.slice(0, 5))}
                    </span>
                    <span className="text-[11px] font-medium">{formatMoney(b.amount)}</span>
                    <StatusBadge status={b.status} />
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Modal>

      <AppointmentDialog booking={selected} salonId={salonId} onClose={() => setSelected(null)} />
    </Panel>
  );
}
