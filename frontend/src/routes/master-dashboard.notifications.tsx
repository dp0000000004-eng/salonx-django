import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { Badge, Btn, DataState, Empty, Panel, dateTimeLabel } from "@/lib/admin/core";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/master-dashboard/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: ["admin_notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await api
        .from("notifications")
        .select("id, title, body, category, link, is_read, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  useRealtime(["notifications"], [["admin_notifications", user?.id]], user ? `user_id=eq.${user.id}` : undefined);

  async function markRead(id: string) {
    const { error } = await api.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    void queryClient.invalidateQueries({ queryKey: ["admin_notifications"] });
  }

  async function markAll() {
    if (!user) return;
    const { error } = await api.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    if (error) { toast.error(error.message); return; }
    toast.success("All notifications marked as read.");
    void queryClient.invalidateQueries({ queryKey: ["admin_notifications"] });
  }

  const unread = (notifications.data ?? []).filter((n) => !n.is_read).length;

  return (
    <Panel
      title="Notifications"
      icon={Bell}
      action={
        <div className="flex items-center gap-2">
          <Badge tone={unread ? "primary" : "muted"}>{unread} unread</Badge>
          <Btn variant="ghost" onClick={markAll}>
            <CheckCheck className="size-3.5" /> Mark all read
          </Btn>
        </div>
      }
    >
      <DataState query={notifications} empty={<Empty title="No notifications yet." description="Platform activity alerts will appear here." icon={Bell} />}>
        {(rows) => (
          <ul className="space-y-2">
            {rows.map((n) => (
              <li
                key={n.id}
                className={`flex gap-3 rounded-xl border p-3 transition-colors duration-200 ${n.is_read ? "border-border" : "border-primary/30 bg-primary-soft/40"}`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Bell className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium text-foreground">{n.title}</p>
                    <Badge tone="muted">{n.category}</Badge>
                    <span className="ml-auto text-[10px] text-muted-foreground">{dateTimeLabel(n.created_at)}</span>
                  </div>
                  {n.body && <p className="mt-1 text-[11px] text-muted-foreground">{n.body}</p>}
                </div>
                {!n.is_read && (
                  <Btn variant="soft" onClick={() => markRead(n.id)}>
                    Mark read
                  </Btn>
                )}
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </Panel>
  );
}
