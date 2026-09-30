import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { DataState, Empty, Modal, StatusBadge, TableWrap, Td, Th, dateLabel, inr } from "@/lib/admin/core";

export function CustomerDetailModal({ customer, onClose }: { customer: { id: string; name: string }; onClose: () => void }) {
  const bookings = useQuery({
    queryKey: ["admin_customer_bookings", customer.id],
    queryFn: async () => {
      const { data, error } = await api
        .from("bookings")
        .select("id, booking_date, slot_time, status, amount, salons(name, city), services(name)")
        .eq("customer_id", customer.id)
        .order("booking_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        booking_date: string;
        slot_time: string;
        status: string;
        amount: number;
        salons: { name: string; city: string } | null;
        services: { name: string } | null;
      }[];
    },
  });

  return (
    <Modal wide title={`Booking history — ${customer.name}`} onClose={onClose}>
      <DataState query={bookings} empty={<Empty title="No bookings found." />}>
        {(rows) => (
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Salon</Th>
                <Th>Service</Th>
                <Th>Status</Th>
                <Th right>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <Td>
                    {dateLabel(b.booking_date)} · {b.slot_time}
                  </Td>
                  <Td>
                    {b.salons?.name ?? "—"} <span className="text-muted-foreground">{b.salons?.city ?? ""}</span>
                  </Td>
                  <Td>{b.services?.name ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={b.status} />
                  </Td>
                  <Td right>{inr(b.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </DataState>
    </Modal>
  );
}
