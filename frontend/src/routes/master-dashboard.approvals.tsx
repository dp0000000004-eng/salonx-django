import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Btn, DataState, Empty, Modal, Panel, StatusBadge, TableWrap, Td, Th, dateLabel, inputClass, inr, useModal } from "@/lib/admin/core";
import { setSalonStatus, useSalonApplications, type ApplicationRow } from "@/lib/admin/approvals";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/master-dashboard/approvals")({
  component: ApprovalsPage,
});

const TABS = ["pending", "approved", "rejected", "suspended"] as const;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ApprovalsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const apps = useSalonApplications(tab);
  const queryClient = useQueryClient();
  const detail = useModal<ApplicationRow>();
  const [rejecting, setRejecting] = useState<ApplicationRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useRealtime(["salons", "demo_requests"], [["salon_applications"], ["admin_salons"], ["admin_kpis"]]);

  async function act(row: ApplicationRow, status: "approved" | "rejected" | "suspended" | "pending", why?: string) {
    setBusy(true);
    try {
      await setSalonStatus(row.id, status, why);
      toast.success(`${row.name} ${status}.`);
      detail.close();
      setRejecting(null);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["salon_applications"] });
      void queryClient.invalidateQueries({ queryKey: ["admin_salons"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the salon.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Demo Requests / Salon Approvals" icon={ShieldCheck}>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors duration-200 ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <DataState
        query={apps}
        empty={<Empty title={`No ${tab} salon applications.`} description="New demo requests appear here automatically." icon={ShieldCheck} />}
      >
        {(rows) => (
          <TableWrap>
            <thead>
              <tr>
                <Th>Salon</Th>
                <Th>Owner</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>City</Th>
                <Th>Area</Th>
                <Th>Submitted</Th>
                <Th>Approval</Th>
                <Th>Account</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <Td>{r.name}</Td>
                  <Td>{r.profiles?.full_name ?? "—"}</Td>
                  <Td>{r.email ?? r.profiles?.email ?? "—"}</Td>
                  <Td>{r.phone ?? "—"}</Td>
                  <Td>{r.city}</Td>
                  <Td>{r.area ?? "—"}</Td>
                  <Td>{dateLabel(r.created_at)}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td>{r.is_active ? "active" : r.status === "suspended" ? "suspended" : "pending"}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Btn variant="ghost" onClick={() => detail.open(r)}>View Details</Btn>
                      {r.status !== "approved" && (
                        <Btn
                          onClick={() => {
                            if (confirm(`Approve "${r.name}"? It becomes publicly visible immediately.`)) void act(r, "approved");
                          }}
                        >
                          Approve
                        </Btn>
                      )}
                      {r.status !== "rejected" && (
                        <Btn variant="ghost" onClick={() => { setRejecting(r); setReason(""); }}>
                          Reject
                        </Btn>
                      )}
                      {r.status === "approved" && (
                        <Btn
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Suspend "${r.name}"? It will be hidden and cannot take bookings.`)) void act(r, "suspended");
                          }}
                        >
                          Suspend
                        </Btn>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </DataState>

      {detail.state && (
        <Modal title={detail.state.name} onClose={detail.close}>
          <Details row={detail.state} />
        </Modal>
      )}

      {rejecting && (
        <Modal title={`Reject ${rejecting.name}`} onClose={() => setRejecting(null)}>
          <label className="text-xs font-medium text-foreground">Rejection reason</label>
          <textarea
            className={inputClass}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell the owner what needs to change before resubmitting."
          />
          <div className="mt-4 flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setRejecting(null)}>Cancel</Btn>
            <Btn
              disabled={busy || !reason.trim()}
              onClick={() => void act(rejecting, "rejected", reason.trim())}
            >
              Reject salon
            </Btn>
          </div>
        </Modal>
      )}
    </Panel>
  );
}

function Details({ row }: { row: ApplicationRow }) {
  const images = row.salon_images ?? [];
  return (
    <div className="space-y-5 text-sm">
      <Section title="Salon">
        <Item label="Salon Name" value={row.name} />
        <Item label="Salon Type" value={row.salon_type} />
        <Item label="Description" value={row.about} />
        <Item label="Chairs / Seats" value={row.seats} />
        <Item label="Years in Business" value={row.years_in_business} />
        <div className="col-span-full flex flex-wrap gap-2">
          {row.logo_url && <img src={row.logo_url} alt="Salon logo" className="size-20 rounded-lg object-cover" />}
          {row.cover_image_url && <img src={row.cover_image_url} alt="Salon cover" className="h-20 w-36 rounded-lg object-cover" />}
          {images.map((u) => (
            <img key={u} src={u} alt="Salon" className="size-20 rounded-lg object-cover" />
          ))}
        </div>
      </Section>

      <Section title="Owner">
        <Item label="Owner Name" value={row.profiles?.full_name} />
        <Item label="Email" value={row.email ?? row.profiles?.email} />
        <Item label="Phone" value={row.phone} />
        <Item label="WhatsApp" value={row.whatsapp_number} />
      </Section>

      <Section title="Location">
        <Item label="Full Address" value={row.address} />
        <Item label="State" value={row.state} />
        <Item label="District" value={row.district} />
        <Item label="City" value={row.city} />
        <Item label="Area" value={row.area} />
        <Item label="Pincode" value={row.pin_code} />
        <Item label="Latitude" value={row.latitude} />
        <Item label="Longitude" value={row.longitude} />
      </Section>

      <Section title="Business">
        <Item label="Opening Time" value={row.opening_time} />
        <Item label="Closing Time" value={row.closing_time} />
        <Item label="Weekly Closed Day" value={row.weekly_closed_day === null ? "Open all week" : DAYS[row.weekly_closed_day]} />
        <Item label="Services Offered" value={row.services_offered} />
        <Item label="Starting Price" value={row.starting_price ? inr(row.starting_price) : "—"} />
        <Item label="Instagram" value={row.instagram_url} />
        <Item label="Facebook" value={row.facebook_url} />
        <Item label="Website" value={row.website_url} />
      </Section>

      <Section title="Account">
        <Item label="Email" value={row.email ?? row.profiles?.email} />
        <Item label="Account Created" value={row.profiles?.created_at ? dateLabel(row.profiles.created_at) : dateLabel(row.created_at)} />
        <Item label="Account Status" value={row.is_active ? "active" : row.status === "suspended" ? "suspended" : "pending"} />
        <Item label="Approval Status" value={row.status} />
        {row.rejection_reason && <Item label="Rejection Reason" value={row.rejection_reason} />}
      </Section>
      <p className="text-[11px] text-muted-foreground">Passwords are stored securely by the authentication system and are never visible here.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="break-words text-sm text-foreground">{value === null || value === undefined || value === "" ? "—" : String(value)}</p>
    </div>
  );
}
