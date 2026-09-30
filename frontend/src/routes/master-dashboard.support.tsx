import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Send, Lock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { Badge, Btn, DataState, Empty, Modal, Panel, StatusBadge, TableWrap, Td, Th, dateTimeLabel, inputClass, useModal } from "@/lib/admin/core";
import { useRealtime } from "@/lib/realtime";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, statusLabel } from "@/components/salonx/SupportCenter";
import { daysLeft, subState, useSalonSubscription } from "@/lib/subscription";

export const Route = createFileRoute("/master-dashboard/support")({
  validateSearch: (search: Record<string, unknown>) => ({ q: (search["q"] as string) ?? "" }),
  head: () => ({ meta: [{ title: "Support Tickets — SalonX Admin" }, { name: "description", content: "Manage SalonX support tickets." }] }),
  component: SupportPage,
});

type Row = {
  id: string; subject: string; message: string; status: string; priority: string; category: string;
  user_id: string; salon_id: string | null; assigned_to: string | null; raised_as: string; created_at: string; updated_at: string;
  profiles: { full_name: string | null; email: string | null; phone: string | null } | null;
  salons: { name: string } | null;
};

function useAllTickets() {
  return useQuery({
    queryKey: ["admin_tickets"],
    queryFn: async () => {
      const { data, error } = await api
        .from("support_tickets")
        .select("id, subject, message, status, priority, category, user_id, salon_id, assigned_to, raised_as, created_at, updated_at, profiles:user_id(full_name, email, phone), salons:salon_id(name)")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });
}

function SupportPage() {
  const { q } = Route.useSearch();
  const qc = useQueryClient();
  const [f, setF] = useState({ q, status: "", priority: "", category: "" });
  const tickets = useAllTickets();
  const detail = useModal<{ id: string }>();
  useRealtime(["support_tickets", "ticket_messages"], [["admin_tickets"], ["admin_ticket_messages"]]);

  async function update(id: string, patch: Record<string, unknown>) {
    const { error } = await api.from("support_tickets").update(patch as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["admin_tickets"] });
  }

  const all = tickets.data ?? [];
  const counts = [
    ["All Tickets", all.length, ""],
    ["Open", all.filter((t) => t.status === "open").length, "open"],
    ["In Progress", all.filter((t) => t.status === "in_progress").length, "in_progress"],
    ["Waiting for User", all.filter((t) => t.status === "waiting_user").length, "waiting_user"],
    ["Resolved", all.filter((t) => t.status === "resolved").length, "resolved"],
    ["Closed", all.filter((t) => t.status === "closed").length, "closed"],
    ["Urgent", all.filter((t) => t.priority === "urgent" && t.status !== "closed").length, "urgent"],
  ] as const;

  const s = f.q.trim().toLowerCase();
  const filtered = all.filter((t) =>
    (!f.status || t.status === f.status) && (!f.priority || t.priority === f.priority) && (!f.category || t.category === f.category) &&
    (!s || t.subject.toLowerCase().includes(s) || t.id.startsWith(s) || (t.salons?.name ?? "").toLowerCase().includes(s) || (t.profiles?.email ?? "").toLowerCase().includes(s)));

  return (
    <Panel title="Support Tickets" icon={LifeBuoy}>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {counts.map(([label, n, key]) => (
          <button key={label} onClick={() => setF({ ...f, status: key === "urgent" ? "" : key, priority: key === "urgent" ? "urgent" : "" })}
            className="rounded-xl border border-border bg-card p-3 text-left hover:border-primary">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold text-foreground">{tickets.isPending ? "…" : n}</p>
          </button>
        ))}
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <input className={inputClass} placeholder="Search subject, ID, salon, email…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select className={inputClass} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="">All statuses</option>
          {TICKET_STATUSES.map((x) => <option key={x} value={x}>{statusLabel(x)}</option>)}
        </select>
        <select className={inputClass} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
          <option value="">All priorities</option>
          {TICKET_PRIORITIES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select className={inputClass} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          <option value="">All categories</option>
          {TICKET_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      <DataState query={{ ...tickets, data: tickets.data ? filtered : undefined } as never} empty={<Empty title="No support tickets." description="Tickets raised by customers and salons appear here." icon={LifeBuoy} />}>
        {(rows: Row[]) => (
          <TableWrap>
            <thead><tr><Th>Ticket</Th><Th>Raised by</Th><Th>Category</Th><Th>Updated</Th><Th>Priority</Th><Th>Status</Th><Th right>Actions</Th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <Td>
                    <span className="font-medium text-foreground">{t.subject}</span>
                    <span className="block text-[10px] text-muted-foreground">#{t.id.slice(0, 8)}{t.salons ? ` · ${t.salons.name}` : ""}</span>
                  </Td>
                  <Td>{t.profiles?.full_name ?? t.profiles?.email ?? "—"}<span className="block text-[10px] capitalize text-muted-foreground">{t.raised_as}</span></Td>
                  <Td><span className="capitalize">{t.category.replace("_", " ")}</span></Td>
                  <Td>{dateTimeLabel(t.updated_at)}</Td>
                  <Td>
                    <select className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] capitalize" value={t.priority} onChange={(e) => update(t.id, { priority: e.target.value })} aria-label="Priority">
                      {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Td>
                  <Td><StatusBadge status={t.status} /></Td>
                  <Td right><Btn variant="soft" onClick={() => detail.open({ id: t.id })}>Open</Btn></Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </DataState>

      {detail.state && <TicketDetail id={detail.state.id} ticket={all.find((t) => t.id === detail.state!.id)} onUpdate={update} onClose={detail.close} />}
    </Panel>
  );
}

function TicketDetail({ id, ticket, onUpdate, onClose }: { id: string; ticket?: Row | undefined; onUpdate: (id: string, p: Record<string, unknown>) => Promise<void>; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const msgs = useQuery({
    queryKey: ["admin_ticket_messages", id],
    queryFn: async () => {
      const { data, error } = await api.from("ticket_messages").select("id, body, author_id, is_internal, created_at").eq("ticket_id", id).order("created_at");
      if (error) throw error;
      return (data ?? []) as { id: string; body: string; author_id: string; is_internal: boolean; created_at: string }[];
    },
  });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !user) return;
    const { error } = await api.from("ticket_messages").insert({ ticket_id: id, author_id: user.id, body: body.trim(), is_internal: internal } as never);
    if (error) { toast.error(error.message); return; }
    if (!internal && ticket?.status === "open") await onUpdate(id, { status: "in_progress", assigned_to: ticket.assigned_to ?? user.id });
    setBody("");
    void qc.invalidateQueries({ queryKey: ["admin_ticket_messages", id] });
  }

  if (!ticket) return null;
  return (
    <Modal wide title={ticket.subject} onClose={onClose}>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <div className="rounded-xl border border-border p-3 text-xs">
            <p className="text-[10px] text-muted-foreground">{ticket.profiles?.full_name ?? ticket.profiles?.email} · {dateTimeLabel(ticket.created_at)}</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{ticket.message}</p>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            <DataState query={msgs} empty={<Empty title="No replies yet." description="Start the conversation below." icon={LifeBuoy} />}>
              {(rows) => rows.map((m) => (
                <div key={m.id} className={`rounded-xl border p-3 ${m.is_internal ? "border-dashed border-primary/50 bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={m.author_id === ticket.user_id ? "muted" : "primary"}>{m.is_internal ? "Internal note" : m.author_id === ticket.user_id ? "User" : "Admin"}</Badge>
                    <span className="text-[10px] text-muted-foreground">{dateTimeLabel(m.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs text-foreground">{m.body}</p>
                </div>
              ))}
            </DataState>
          </div>
          <form className="space-y-2" onSubmit={send}>
            <textarea className={`${inputClass} min-h-16`} placeholder={internal ? "Internal note (admins only)…" : "Reply to user…"} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /><Lock className="size-3" /> Internal note</label>
              <Btn type="submit"><Send className="size-3.5" /> {internal ? "Add note" : "Send reply"}</Btn>
            </div>
          </form>
        </div>
        <aside className="space-y-3 text-xs">
          <div className="space-y-2 rounded-xl border border-border p-3">
            <label className="block">Status
              <select className={inputClass} value={ticket.status} onChange={(e) => onUpdate(id, { status: e.target.value })}>
                {TICKET_STATUSES.map((x) => <option key={x} value={x}>{statusLabel(x)}</option>)}
              </select>
            </label>
            <label className="block">Category
              <select className={inputClass} value={ticket.category} onChange={(e) => onUpdate(id, { category: e.target.value })}>
                {TICKET_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <Btn variant="soft" onClick={() => user && onUpdate(id, { assigned_to: user.id })}>{ticket.assigned_to === user?.id ? "Assigned to you" : "Assign to me"}</Btn>
          </div>
          {ticket.salon_id && <SubscriptionContext salonId={ticket.salon_id} salonName={ticket.salons?.name ?? ""} />}
        </aside>
      </div>
    </Modal>
  );
}

function SubscriptionContext({ salonId, salonName }: { salonId: string; salonName: string }) {
  const sub = useSalonSubscription(salonId);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const payments = useQuery({
    queryKey: ["admin_salon_last_payment", salonId],
    queryFn: async () => {
      const { data, error } = await api.from("payments").select("id, amount, status, paid_at, provider_ref").eq("salon_id", salonId).order("created_at", { ascending: false }).limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });
  const state = subState(sub.data);
  async function act(action: "renew" | "extend") {
    setBusy(true);
    try { void action; void days; toast.info("Subscription changes will be available once the subscription backend is connected."); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  const d = (v?: string | null) => (v ? new Date(v).toLocaleDateString("en-IN") : "—");
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="font-semibold text-foreground">{salonName}</p>
      {sub.isPending ? <p className="text-muted-foreground">Loading subscription…</p> : sub.isError ? <p className="text-destructive">Could not load subscription.</p> : (
        <dl className="grid grid-cols-2 gap-1">
          <dt className="text-muted-foreground">Status</dt><dd className="capitalize">{state}</dd>
          <dt className="text-muted-foreground">Start</dt><dd>{d(sub.data?.started_at)}</dd>
          <dt className="text-muted-foreground">Expiry</dt><dd>{d(sub.data?.expires_at ?? sub.data?.trial_end_date)}</dd>
          <dt className="text-muted-foreground">Days left</dt><dd>{daysLeft(sub.data?.expires_at ?? sub.data?.trial_end_date)}</dd>
        </dl>
      )}
      <p className="pt-1 font-medium">Recent payments</p>
      {(payments.data ?? []).length === 0 ? <p className="text-muted-foreground">No payments recorded.</p> :
        (payments.data ?? []).map((p) => <p key={p.id} className="text-muted-foreground">₹{p.amount} · {p.status} · {d(p.paid_at)}</p>)}
      <div className="flex items-center gap-2 pt-2">
        <input type="number" min={1} max={3650} className={inputClass} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} aria-label="Days" />
        <span>days</span>
      </div>
      <div className="flex gap-2">
        <Btn disabled={busy} onClick={() => act("renew")}>Renew</Btn>
        <Btn variant="soft" disabled={busy} onClick={() => act("extend")}>Extend</Btn>
      </div>
    </div>
  );
}
