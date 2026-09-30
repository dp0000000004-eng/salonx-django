import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import {
  Badge,
  Btn,
  DataState,
  Empty,
  Panel,
  TableWrap,
  Td,
  Th,
  dateLabel,
  inputClass,
  inr,
  num,
  useModal,
} from "@/lib/admin/core";
import { useAdminCustomers } from "@/lib/admin/data";
import { useRealtime } from "@/lib/realtime";
import { CustomerDetailModal } from "@/components/admin/CustomerDetailModal";

export const Route = createFileRoute("/master-dashboard/customers")({
  validateSearch: (search: Record<string, unknown>) => ({ q: (search["q"] as string) ?? "" }),
  component: CustomersPage,
});

function CustomersPage() {
  const { q } = Route.useSearch();
  const [search, setSearch] = useState(q);
  const [onlyActive, setOnlyActive] = useState("");
  const queryClient = useQueryClient();
  const customers = useAdminCustomers(search);
  const detail = useModal<{ id: string; name: string }>();

  useRealtime(["profiles", "bookings"], [["admin_customers"], ["admin_kpis"]]);

  async function toggleActive(id: string, active: boolean) {
    const { error } = await api.from("profiles").update({ is_active: active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(active ? "Account activated." : "Account deactivated.");
    void queryClient.invalidateQueries({ queryKey: ["admin_customers"] });
  }

  return (
    <Panel title="Customers" icon={Users}>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <input className={inputClass} placeholder="Search name, email or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={inputClass} value={onlyActive} onChange={(e) => setOnlyActive(e.target.value)}>
          <option value="">All accounts</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      <DataState query={customers} empty={<Empty title="No customers yet." description="Customer accounts will appear here as people sign up." icon={Users} />}>
        {(rows) => {
          const filtered = rows.filter((r) => (onlyActive === "active" ? r.is_active : onlyActive === "inactive" ? !r.is_active : true));
          if (filtered.length === 0) return <Empty title="No customers match this filter." icon={Users} />;
          return (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Contact</Th>
                  <Th>City</Th>
                  <Th>Bookings</Th>
                  <Th>Spent</Th>
                  <Th>Last booking</Th>
                  <Th>Joined</Th>
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <Td>
                      <span className="font-medium text-foreground">{c.full_name ?? "Unnamed"}</span>
                    </Td>
                    <Td>
                      <span className="block">{c.email ?? "—"}</span>
                      <span className="text-muted-foreground">{c.phone ?? ""}</span>
                    </Td>
                    <Td>{c.city ?? "—"}</Td>
                    <Td>{num(c.count)}</Td>
                    <Td>{inr(c.spend)}</Td>
                    <Td>{dateLabel(c.last)}</Td>
                    <Td>{dateLabel(c.created_at)}</Td>
                    <Td>
                      <Badge tone={c.is_active ? "success" : "danger"}>{c.is_active ? "active" : "inactive"}</Badge>
                    </Td>
                    <Td right>
                      <div className="flex justify-end gap-1">
                        <Btn variant="soft" onClick={() => detail.open({ id: c.id, name: c.full_name ?? "Customer" })}>
                          Details
                        </Btn>
                        <Btn variant="ghost" onClick={() => toggleActive(c.id, !c.is_active)}>
                          {c.is_active ? "Deactivate" : "Activate"}
                        </Btn>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          );
        }}
      </DataState>

      {detail.state && <CustomerDetailModal customer={detail.state} onClose={detail.close} />}
    </Panel>
  );
}
