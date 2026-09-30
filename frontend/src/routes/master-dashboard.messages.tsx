import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useRealtime } from "@/lib/realtime";
import { DataState, Panel, inputClass } from "@/lib/admin/core";

export const Route = createFileRoute("/master-dashboard/messages")({
  component: MessagesPage,
});

type Msg = {
  id: string; message_id: string; name: string; phone: string; email: string | null;
  subject: string; message: string; status: string; is_read: boolean; admin_notes: string | null; created_at: string;
};
const STATUSES = ["new", "in_progress", "resolved", "closed"];

function MessagesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  useRealtime(["contact_messages"], [["contact_messages"]]);
  const q = useQuery({
    queryKey: ["contact_messages"],
    queryFn: async () => {
      const { data, error } = await api.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  async function update(id: string, patch: Partial<Msg>) {
    const { error } = await api.from("contact_messages").update(patch as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["contact_messages"] });
  }

  return (
    <Panel title="Contact Messages" icon={Inbox}>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {["all", ...STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 capitalize ${filter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>
      <DataState query={q}>
        {(rows) => {
          const list = rows.filter((r) => filter === "all" || r.status === filter);
          if (list.length === 0) return <p className="py-6 text-center text-xs text-muted-foreground">No messages yet.</p>;
          return (
            <ul className="space-y-3">
              {list.map((m) => (
                <li key={m.id} className={`rounded-lg border p-4 text-xs ${m.is_read ? "border-border" : "border-primary/50 bg-primary/5"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{m.subject}</p>
                      <p className="text-muted-foreground">
                        {m.message_id} · {m.name} · <a className="hover:underline" href={`tel:${m.phone}`}>{m.phone}</a>
                        {m.email && <> · <a className="hover:underline" href={`mailto:${m.email}`}>{m.email}</a></>}
                        {" · "}{new Date(m.created_at).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select className={inputClass + " w-auto py-1"} value={m.status} onChange={(e) => update(m.id, { status: e.target.value, is_read: true })}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                      <button className="text-primary hover:underline" onClick={() => update(m.id, { is_read: !m.is_read })}>
                        {m.is_read ? "Mark unread" : "Mark read"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-foreground">{m.message}</p>
                  <textarea
                    defaultValue={m.admin_notes ?? ""}
                    placeholder="Internal note (admins only)"
                    maxLength={2000}
                    rows={2}
                    onBlur={(e) => e.target.value !== (m.admin_notes ?? "") && update(m.id, { admin_notes: e.target.value || null })}
                    className={inputClass + " mt-2"}
                  />
                </li>
              ))}
            </ul>
          );
        }}
      </DataState>
    </Panel>
  );
}
