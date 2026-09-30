import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Panel } from "@/components/salonx/DashboardShell";
import { Empty, ErrorNote, GhostButton, Loading } from "@/components/owner/shared";
import { api } from "@/lib/api-client";
import { useNotifications } from "@/lib/queries";

export function OwnerNotifications({ userId }: { userId: string }) {
  const notifications = useNotifications(userId);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const rows = notifications.data ?? [];
  const unread = rows.filter((n) => !n.is_read);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    const { error } = await api.from("notifications").update({ is_read: true }).in("id", ids);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(ids.length > 1 ? "All notifications marked as read" : "Marked as read");
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  if (notifications.isLoading) return <Loading label="Loading notifications…" />;
  if (notifications.error) return <ErrorNote error={notifications.error} onRetry={() => void notifications.refetch()} />;

  return (
    <Panel
      title={`Notifications${unread.length ? ` (${unread.length} unread)` : ""}`}
      icon={Bell}
      action={
        unread.length > 0 ? (
          <GhostButton disabled={busy} onClick={() => void markRead(unread.map((n) => n.id))}>
            Mark all as read
          </GhostButton>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <Empty title="No notifications" description="Booking requests, cancellations, reviews and payments will notify you here." />
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border p-3 ${n.is_read ? "border-border" : "border-primary/40 bg-primary-soft/40"}`}
            >
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-[11px] text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {n.category} · {new Date(n.created_at).toLocaleString("en-IN")}
                  </p>
                </div>
                {!n.is_read && (
                  <GhostButton disabled={busy} onClick={() => void markRead([n.id])}>
                    Mark read
                  </GhostButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
