import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/master-dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Super Admin Console — SalonX" },
      { name: "description", content: "Restricted SalonX platform console for salons, bookings, payments, subscriptions and support." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Super Admin Console — SalonX" },
      { property: "og:description", content: "Restricted SalonX platform console." },
    ],
  }),
  component: () => (
    <AdminGate>
      <AdminShell>
        <Outlet />
      </AdminShell>
    </AdminGate>
  ),
});
