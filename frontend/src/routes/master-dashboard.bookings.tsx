import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import {
  Btn,
  DataState,
  Empty,
  Modal,
  Panel,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  dateLabel,
  dateTimeLabel,
  inputClass,
  inr,
  useModal,
} from "@/lib/admin/core";
import { useAdminSalons, useAllBookings } from "@/lib/admin/data";
import { useRealtime } from "@/lib/realtime";

const STATUSES = ["pending", "upcoming", "confirmed", "checked_in", "service_started", "completed", "cancelled", "no_show"];

export const Route = createFileRoute("/master-dashboard/bookings")({
  validateSearch: (search: Record<string, unknown>) => ({ q: (search["q"] as string) ?? "" }),
  component: BookingsPage,
});

function BookingsPage() {
  const { q } = Route.useSearch();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ q, status: "", city: "", salonId: "", date: "" });
  const bookings = useAllBookings(filters);
  const salons = useAdminSalons();
  const detail = useModal<{ id: string }>();

  useRealtime(["bookings"], [["admin_bookings"], ["admin_kpis"], ["admin_recent_bookings"]]);

  async function setStatus(id: string, status: string) {
    const { error } = await api.from("bookings").update({ status: status as "completed" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Booking updated.");
    void queryClient.invalidateQueries({ queryKey: ["admin_bookings"] });
  }

  return (
    <Panel title="Bookings" icon={CalendarCheck}>
      <div className="mb-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <input className={inputClass} placeholder="Search customer, salon or ID…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <select className={inputClass} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select className={inputClass} value={filters.salonId} onChange={(e) => setFilters({ ...filters, salonId: e.target.value })}>
          <option value="">All salons</option>
          {(salons.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input className={inputClass} placeholder="City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
        <input className={inputClass} type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
      </div>

      <DataState query={bookings} empty={<Empty title="No bookings found." icon={CalendarCheck} />}>
        {(rows) => (
          <TableWrap>
            <thead>
              <tr>
                <Th>Booking</Th>
                <Th>Customer</Th>
                <Th>Salon</Th>
                <Th>Service</Th>
                <Th>Date &amp; time</Th>
                <Th>Status</Th>
                <Th right>Amount</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <Td>#{b.id.slice(0, 8)}</Td>
                  <Td>{b.profiles?.full_name ?? "—"}</Td>
                  <Td>
                    {b.salons?.name ?? "—"} <span className="text-muted-foreground">{b.salons?.city ?? ""}</span>
                  </Td>
                  <Td>{b.services?.name ?? "—"}</Td>
                  <Td>
                    {dateLabel(b.booking_date)} · {b.slot_time}
                  </Td>
                  <Td>
                    <StatusBadge status={b.status} />
                  </Td>
                  <Td right>{inr(b.amount)}</Td>
                  <Td right>
                    <div className="flex justify-end gap-1">
                      <Btn variant="soft" onClick={() => detail.open({ id: b.id })}>
                        View
                      </Btn>
                      <select
                        className="rounded-lg border border-border bg-card px-2 py-1 text-[11px]"
                        value={b.status}
                        onChange={(e) => setStatus(b.id, e.target.value)}
                        aria-label="Change status"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </DataState>

      {detail.state && <BookingDetail id={detail.state.id} onClose={detail.close} />}
    </Panel>
  );
}

function BookingDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const booking = useQuery({
    queryKey: ["admin_booking_detail", id],
    queryFn: async () => {
      const { data, error } = await api
        .from("bookings")
        .select(
          "id, booking_date, slot_time, status, amount, notes, created_at, booking_type, service_address, travel_fee, discount_amount, salons(name, city, phone), profiles:customer_id(full_name, phone, email), services(name), payments(id, status, method, amount)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        id: string;
        booking_date: string;
        slot_time: string;
        status: string;
        amount: number;
        notes: string | null;
        created_at: string;
        booking_type: string;
        salons: { name: string; city: string; phone: string | null } | null;
        profiles: { full_name: string | null; phone: string | null; email: string | null } | null;
        services: { name: string } | null;
        payments: { id: string; status: string; method: string; amount: number }[];
      } | null;
    },
  });

  return (
    <Modal title="Booking details" onClose={onClose}>
      <DataState query={booking}>
        {(b) =>
          !b ? (
            <Empty title="Booking not found." />
          ) : (
            <dl className="space-y-2 text-xs">
              <Row k="Booking ID" v={`#${b.id.slice(0, 8)}`} />
              <Row k="Customer" v={`${b.profiles?.full_name ?? "—"} · ${b.profiles?.phone ?? b.profiles?.email ?? ""}`} />
              <Row k="Salon" v={`${b.salons?.name ?? "—"}, ${b.salons?.city ?? ""}`} />
              <Row k="Service" v={b.services?.name ?? "—"} />
              <Row k="When" v={`${dateLabel(b.booking_date)} at ${b.slot_time}`} />
              <Row k="Type" v={b.booking_type} />
              <Row k="Amount" v={inr(b.amount)} />
              <Row k="Payment" v={b.payments?.[0] ? `${b.payments[0].status} · ${b.payments[0].method}` : "No payment record"} />
              <Row k="Booked on" v={dateTimeLabel(b.created_at)} />
              <div className="flex items-center gap-2 pt-1">
                <dt className="w-28 text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={b.status} />
                </dd>
              </div>
              {b.notes && <Row k="Notes" v={b.notes} />}
            </dl>
          )
        }
      </DataState>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{k}</dt>
      <dd className="min-w-0 flex-1 break-words text-foreground">{v}</dd>
    </div>
  );
}
