import { useT } from "@/lib/i18n";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Send, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useRealtime } from "@/lib/realtime";

export const TICKET_CATEGORIES = [
  ["subscription", "Subscription"],
  ["renewal", "Renewal"],
  ["payment", "Payment"],
  ["booking", "Booking"],
  ["account", "Account"],
  ["technical", "Technical Issue"],
  ["salon_profile", "Salon Profile"],
  ["other", "Other"],
] as const;
export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const TICKET_STATUSES = ["open", "in_progress", "waiting_user", "resolved", "closed"] as const;
export const statusLabel = (s: string) =>
  ({ open: "Open", in_progress: "In Progress", waiting_user: "Waiting for User", resolved: "Resolved", closed: "Closed" })[s] ?? s;

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary";

type Ticket = {
  id: string; subject: string; message: string; status: string; priority: string;
  category: string; created_at: string; updated_at: string;
};

export async function createTicket(t: {
  userId: string; subject: string; message: string; category: string; priority?: string; salonId?: string | null | undefined;
}) {
  const { data, error } = await api
    .from("support_tickets")
    .insert({
      user_id: t.userId, subject: t.subject, message: t.message,
      category: t.category, priority: t.priority ?? "medium", salon_id: t.salonId ?? null,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export function SupportCenter({ userId, salonId }: { userId: string; salonId?: string | null | undefined }) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const t = useT();

  const tickets = useQuery({
    queryKey: ["my_tickets", userId],
    queryFn: async () => {
      const { data, error } = await api
        .from("support_tickets")
        .select("id, subject, message, status, priority, category, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
  });
  useRealtime(["support_tickets", "ticket_messages"], [["my_tickets", userId], ["my_ticket_msgs"]]);

  if (openId) {
    const t = tickets.data?.find((x) => x.id === openId);
    return <Thread ticket={t} ticketId={openId} userId={userId} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LifeBuoy className="size-4 text-primary" /> {t("support.title")}
        </h2>
        <button onClick={() => setCreating((v) => !v)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
          <Plus className="size-3.5" /> {t("support.newTicket")}
        </button>
      </div>
      {creating && (
        <NewTicket
          userId={userId}
          salonId={salonId}
          onDone={(id) => { setCreating(false); void qc.invalidateQueries({ queryKey: ["my_tickets", userId] }); setOpenId(id); }}
        />
      )}
      {tickets.isPending ? (
        <p className="text-xs text-muted-foreground">{t("support.loading")}</p>
      ) : tickets.isError ? (
        <div className="salonx-card p-4 text-xs">
          <p className="text-destructive">{t("support.loadError")}</p>
          <button className="mt-2 underline" onClick={() => void tickets.refetch()}>{t("support.retry")}</button>
        </div>
      ) : tickets.data.length === 0 ? (
        <div className="salonx-card p-6 text-center text-xs text-muted-foreground">{t("support.none")}</div>
      ) : (
        <ul className="space-y-2">
          {tickets.data.map((tk) => (
            <li key={tk.id}>
              <button onClick={() => setOpenId(tk.id)} className="salonx-card flex w-full items-center justify-between gap-3 p-4 text-left hover:border-primary">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{tk.subject}</p>
                  <p className="text-[11px] capitalize text-muted-foreground">
                    #{tk.id.slice(0, 8)} · {t(`support.cat.${tk.category}`)} · {t(`support.pri.${tk.priority}`)} · {new Date(tk.updated_at).toLocaleString("en-IN")}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-medium">{t(`support.status.${tk.status}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewTicket({ userId, salonId, onDone }: { userId: string; salonId?: string | null | undefined; onDone: (id: string) => void }) {
  const [f, setF] = useState({ subject: "", message: "", category: "other", priority: "medium" });
  const [busy, setBusy] = useState(false);
  const t = useT();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.subject.trim().length < 3 || f.message.trim().length < 5) { toast.error(t("support.needDetails")); return; }
    setBusy(true);
    try {
      const r = await createTicket({ userId, salonId, ...f, subject: f.subject.trim(), message: f.message.trim() });
      toast.success(t("support.created"));
      onDone(r.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="salonx-card grid gap-3 p-4 sm:grid-cols-2">
      <input className={`${input} sm:col-span-2`} placeholder={t("support.subject")} maxLength={150} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
      <select className={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
        {TICKET_CATEGORIES.map(([k]) => <option key={k} value={k}>{t(`support.cat.${k}`)}</option>)}
      </select>
      <select className={input} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
        {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{t(`support.pri.${p}`)}</option>)}
      </select>
      <textarea className={`${input} min-h-24 sm:col-span-2`} placeholder={t("support.describe")} maxLength={4000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60 sm:col-span-2 sm:w-fit">
        {busy ? t("support.submitting") : t("support.submit")}
      </button>
    </form>
  );
}

function Thread({ ticket, ticketId, userId, onBack }: { ticket?: Ticket | undefined; ticketId: string; userId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const t = useT();
  const msgs = useQuery({
    queryKey: ["my_ticket_msgs", ticketId],
    queryFn: async () => {
      const { data, error } = await api.from("ticket_messages").select("id, body, author_id, created_at").eq("ticket_id", ticketId).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const { error } = await api.from("ticket_messages").insert({ ticket_id: ticketId, author_id: userId, body: body.trim() });
    if (error) { toast.error(error.message); return; }
    setBody("");
    void qc.invalidateQueries({ queryKey: ["my_ticket_msgs", ticketId] });
  }
  const closed = ticket?.status === "closed";
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="size-3.5" /> {t("support.allTickets")}</button>
      <div className="salonx-card p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{ticket?.subject}</h3>
          {ticket && <span className="rounded-full bg-muted px-2 py-1 text-[10px]">{t(`support.status.${ticket.status}`)}</span>}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{ticket?.message}</p>
      </div>
      <div className="space-y-2">
        {msgs.isError ? (
          <p className="text-xs text-destructive">Could not load messages. <button className="underline" onClick={() => void msgs.refetch()}>Retry</button></p>
        ) : (msgs.data ?? []).map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-xl p-3 text-xs ${m.author_id === userId ? "ml-auto bg-primary/10" : "bg-muted"}`}>
            <p className="text-[10px] text-muted-foreground">{m.author_id === userId ? t("support.you") : t("support.team")} · {new Date(m.created_at).toLocaleString("en-IN")}</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{m.body}</p>
          </div>
        ))}
      </div>
      {!closed && (
        <form onSubmit={send} className="flex gap-2">
          <input className={input} placeholder={t("support.reply")} value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="flex items-center gap-1 rounded-lg bg-primary px-3 text-xs text-primary-foreground"><Send className="size-3.5" /> {t("support.send")}</button>
        </form>
      )}
    </div>
  );
}
