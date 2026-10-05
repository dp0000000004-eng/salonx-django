import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ResolvedRange } from "./core";

/** Number of super admins currently in the database (no hard-coded flag). */
export function useSuperAdminCount() {
  return useQuery({
    queryKey: ["super_admin_count"],
    queryFn: async () => {
      const { data, error } = await api.adminStatus();
      if (error) throw error;
      return data?.super_admin_count ?? 0;
    },
    staleTime: 0,
  });
}

const iso = (d: Date) => d.toISOString();

async function countIn(table: string, from: Date, to: Date) {
  const { count, error } = await api
    .from(table as never)
    .select("id", { count: "exact", head: true })
    .gte("created_at", iso(from))
    .lt("created_at", iso(to));
  if (error) throw error;
  return count ?? 0;
}

async function totalCount(table: string) {
  const { count, error } = await api.from(table as never).select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export type Kpis = {
  salons: { total: number; current: number; previous: number };
  customers: { total: number; current: number; previous: number };
  bookings: { total: number; current: number; previous: number };
  revenue: { total: number; current: number; previous: number };
  payouts: { total: number; current: number; previous: number };
};

export function useAdminKpis(range: ResolvedRange) {
  return useQuery({
    queryKey: ["admin_kpis", range.key, iso(range.from), iso(range.to)],
    queryFn: async (): Promise<Kpis> => {
      const paidSum = async (from: Date, to: Date) => {
        const { data, error } = await api
          .from("payments")
          .select("amount, commission_amount, created_at, status")
          .eq("status", "paid")
          .gte("created_at", iso(from))
          .lt("created_at", iso(to));
        if (error) throw error;
        return (data ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);
      };
      const payoutSum = async (from?: Date, to?: Date) => {
        let q = api.from("payouts").select("amount, created_at").eq("status", "pending");
        if (from && to) q = q.gte("created_at", iso(from)).lt("created_at", iso(to));
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);
      };
      const allPaid = async () => {
        const { data, error } = await api.from("payments").select("amount").eq("status", "paid");
        if (error) throw error;
        return (data ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);
      };

      const [
        salonsTotal,
        salonsCur,
        salonsPrev,
        custTotal,
        custCur,
        custPrev,
        bookTotal,
        bookCur,
        bookPrev,
        revTotal,
        revCur,
        revPrev,
        payTotal,
        payCur,
        payPrev,
      ] = await Promise.all([
        totalCount("salons"),
        countIn("salons", range.from, range.to),
        countIn("salons", range.prevFrom, range.prevTo),
        totalCount("profiles"),
        countIn("profiles", range.from, range.to),
        countIn("profiles", range.prevFrom, range.prevTo),
        totalCount("bookings"),
        countIn("bookings", range.from, range.to),
        countIn("bookings", range.prevFrom, range.prevTo),
        allPaid(),
        paidSum(range.from, range.to),
        paidSum(range.prevFrom, range.prevTo),
        payoutSum(),
        payoutSum(range.from, range.to),
        payoutSum(range.prevFrom, range.prevTo),
      ]);

      return {
        salons: { total: salonsTotal, current: salonsCur, previous: salonsPrev },
        customers: { total: custTotal, current: custCur, previous: custPrev },
        bookings: { total: bookTotal, current: bookCur, previous: bookPrev },
        revenue: { total: revTotal, current: revCur, previous: revPrev },
        payouts: { total: payTotal, current: payCur, previous: payPrev },
      };
    },
  });
}

export type BookingRow = {
  id: string;
  booking_date: string;
  slot_time: string;
  status: string;
  amount: number;
  created_at: string;
  customer_id: string;
  salon_id: string;
  salons: { name: string; city: string } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
  services: { name: string } | null;
};

const BOOKING_SELECT =
  "id, booking_date, slot_time, status, amount, created_at, customer_id, salon_id, salons(name, city), profiles:customer_id(full_name, phone), services(name)";

/** Bookings inside the selected range, used for the trend chart and split. */
export function useBookingsInRange(range: ResolvedRange) {
  return useQuery({
    queryKey: ["admin_bookings_range", iso(range.from), iso(range.to)],
    queryFn: async () => {
      const { data, error } = await api
        .from("bookings")
        .select("id, status, amount, created_at, booking_date, salon_id, salons(name, city)")
        .gte("created_at", iso(range.from))
        .lt("created_at", iso(range.to))
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        status: string;
        amount: number;
        created_at: string;
        booking_date: string;
        salon_id: string;
        salons: { name: string; city: string } | null;
      }[];
    },
  });
}

export function useRecentBookings(limit = 6) {
  return useQuery({
    queryKey: ["admin_recent_bookings", limit],
    queryFn: async () => {
      const { data, error } = await api
        .from("bookings")
        .select(BOOKING_SELECT)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as BookingRow[];
    },
  });
}

export type AdminBookingFilters = {
  q?: string;
  status?: string;
  city?: string;
  salonId?: string;
  date?: string;
};

export function useAllBookings(filters: AdminBookingFilters) {
  return useQuery({
    queryKey: ["admin_bookings", filters],
    queryFn: async () => {
      let q = api.from("bookings").select(BOOKING_SELECT).order("created_at", { ascending: false }).limit(300);
      if (filters.status) q = q.eq("status", filters.status as never);
      if (filters.salonId) q = q.eq("salon_id", filters.salonId);
      if (filters.date) q = q.eq("booking_date", filters.date);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as BookingRow[];
      const term = (filters.q ?? "").trim().toLowerCase();
      if (term) {
        rows = rows.filter(
          (r) =>
            (r.profiles?.full_name ?? "").toLowerCase().includes(term) ||
            (r.salons?.name ?? "").toLowerCase().includes(term) ||
            r.id.toLowerCase().includes(term),
        );
      }
      if (filters.city) rows = rows.filter((r) => (r.salons?.city ?? "").toLowerCase() === filters.city!.toLowerCase());
      return rows;
    },
  });
}

export type AdminSalonRow = {
  id: string;
  name: string;
  slug: string | null;
  city: string;
  area: string | null;
  address: string | null;
  phone: string | null;
  status: string;
  owner_id: string | null;
  is_verified: boolean;
  is_featured: boolean;
  starting_price: number;
  commission_rate: number | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

export function useAdminSalons(filters: { q?: string; city?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ["admin_salons", filters],
    queryFn: async () => {
      let q = api
        .from("salons")
        .select(
          "id, name, slug, city, area, address, phone, status, owner_id, is_verified, is_featured, starting_price, commission_rate, created_at, profiles:owner_id(full_name, email)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (filters.status) q = q.eq("status", filters.status as never);
      if (filters.city) q = q.ilike("city", filters.city);
      if (filters.q?.trim()) q = q.ilike("name", `%${filters.q.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AdminSalonRow[];
    },
  });
}

export function useAdminCustomers(search = "") {
  return useQuery({
    queryKey: ["admin_customers", search],
    queryFn: async () => {
      let q = api
        .from("profiles")
        .select("id, full_name, email, phone, city, is_active, last_login, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (search.trim()) q = q.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as {
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        city: string | null;
        is_active: boolean;
        last_login: string | null;
        created_at: string;
      }[];
      const { data: bookings, error: bErr } = await api
        .from("bookings")
        .select("customer_id, amount, booking_date, status")
        .limit(5000);
      if (bErr) throw bErr;
      const stats = new Map<string, { count: number; spend: number; last: string | null }>();
      for (const b of bookings ?? []) {
        const s = stats.get(b.customer_id) ?? { count: 0, spend: 0, last: null };
        s.count += 1;
        if (b.status === "completed") s.spend += Number(b.amount ?? 0);
        if (!s.last || b.booking_date > s.last) s.last = b.booking_date;
        stats.set(b.customer_id, s);
      }
      return rows.map((r) => ({ ...r, ...(stats.get(r.id) ?? { count: 0, spend: 0, last: null }) }));
    },
  });
}

export function useAdminRoles() {
  return useQuery({
    queryKey: ["admin_roles"],
    queryFn: async () => {
      const { data, error } = await api.from("user_roles").select("user_id, role, created_at");
      if (error) throw error;
      const rows = (data ?? []) as { user_id: string; role: string; created_at: string }[];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      if (ids.length === 0) return [] as {
        user_id: string;
        roles: string[];
        full_name: string | null;
        email: string | null;
        is_active: boolean;
        created_at: string;
      }[];
      const { data: profiles, error: pErr } = await api
        .from("profiles")
        .select("id, full_name, email, is_active, created_at")
        .in("id", ids);
      if (pErr) throw pErr;
      return ids.map((id) => {
        const p = (profiles ?? []).find((x) => x.id === id);
        return {
          user_id: id,
          roles: rows.filter((r) => r.user_id === id).map((r) => r.role),
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          is_active: p?.is_active ?? true,
          created_at: p?.created_at ?? rows.find((r) => r.user_id === id)!.created_at,
        };
      });
    },
  });
}

export function usePayments(filters: { status?: string; q?: string } = {}) {
  return useQuery({
    queryKey: ["admin_payments", filters],
    queryFn: async () => {
      let q = api
        .from("payments")
        .select(
          "id, amount, method, status, commission_rate, commission_amount, salon_earning, provider_ref, paid_at, created_at, salon_id, customer_id, booking_id, salons(name, city), profiles:customer_id(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (filters.status) q = q.eq("status", filters.status as never);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as {
        id: string;
        amount: number;
        method: string;
        status: string;
        commission_rate: number;
        commission_amount: number;
        salon_earning: number;
        provider_ref: string | null;
        paid_at: string | null;
        created_at: string;
        salon_id: string;
        booking_id: string;
        salons: { name: string; city: string } | null;
        profiles: { full_name: string | null } | null;
      }[];
      const term = (filters.q ?? "").trim().toLowerCase();
      if (term) {
        rows = rows.filter(
          (r) =>
            r.id.toLowerCase().includes(term) ||
            (r.salons?.name ?? "").toLowerCase().includes(term) ||
            (r.profiles?.full_name ?? "").toLowerCase().includes(term),
        );
      }
      return rows;
    },
  });
}

export function usePayouts() {
  return useQuery({
    queryKey: ["admin_payouts"],
    queryFn: async () => {
      const { data, error } = await api
        .from("payouts")
        .select("id, amount, commission_amount, status, note, processed_at, created_at, salon_id, salons(name, city)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        amount: number;
        commission_amount: number;
        status: string;
        note: string | null;
        processed_at: string | null;
        created_at: string;
        salon_id: string;
        salons: { name: string; city: string } | null;
      }[];
    },
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["admin_subscriptions"],
    queryFn: async () => {
      const { data, error } = await api
        .from("salon_subscriptions")
        .select("id, status, started_at, expires_at, created_at, salon_id, plan_id, salons(name, city), subscription_plans(name, price, code)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        status: string;
        started_at: string;
        expires_at: string;
        salon_id: string;
        plan_id: string;
        salons: { name: string; city: string } | null;
        subscription_plans: { name: string; price: number; code: string } | null;
      }[];
    },
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ["admin_plans"],
    queryFn: async () => {
      const { data, error } = await api
        .from("subscription_plans")
        .select("id, code, name, price, billing_cycle, trial_days, booking_limit, features, is_active, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTickets(filters: { status?: string; priority?: string; q?: string } = {}) {
  return useQuery({
    queryKey: ["admin_tickets", filters],
    queryFn: async () => {
      let q = api
        .from("support_tickets")
        .select("id, subject, message, status, priority, assigned_to, user_id, created_at, updated_at, profiles:user_id(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (filters.status) q = q.eq("status", filters.status as never);
      if (filters.priority) q = q.eq("priority", filters.priority);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as {
        id: string;
        subject: string;
        message: string;
        status: string;
        priority: string;
        assigned_to: string | null;
        user_id: string;
        created_at: string;
        profiles: { full_name: string | null; email: string | null } | null;
      }[];
      const term = (filters.q ?? "").trim().toLowerCase();
      if (term) rows = rows.filter((r) => r.subject.toLowerCase().includes(term) || r.id.toLowerCase().includes(term));
      return rows;
    },
  });
}

export function useTicketMessages(ticketId?: string) {
  return useQuery({
    queryKey: ["admin_ticket_messages", ticketId],
    queryFn: async () => {
      const { data, error } = await api
        .from("ticket_messages")
        .select("id, body, author_id, created_at")
        .eq("ticket_id", ticketId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!ticketId,
  });
}

export function useAnnouncements(publishedOnly = false) {
  return useQuery({
    queryKey: ["admin_announcements", publishedOnly],
    queryFn: async () => {
      let q = api
        .from("announcements")
        .select("id, title, body, image_url, audience, is_published, starts_at, ends_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (publishedOnly) q = q.eq("is_published", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["admin_locations"],
    queryFn: async () => {
      const { data, error } = await api
        .from("locations")
        .select("id, parent_id, level, name, is_active, created_at")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useServiceCategoriesAdmin() {
  return useQuery({
    queryKey: ["admin_service_categories"],
    queryFn: async () => {
      const { data, error } = await api
        .from("service_categories")
        .select("id, name, slug, icon, description, image_url, sort_order, is_active")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** How many salons opted into each category, and how many services reference it. */
export function useCategoryUsage() {
  return useQuery({
    queryKey: ["admin_category_usage"],
    queryFn: async () => {
      const [links, services] = await Promise.all([
        api.from("salon_categories").select("category_id, salon_id"),
        api.from("services").select("category_id").not("category_id", "is", null),
      ]);
      if (links.error) throw links.error;
      if (services.error) throw services.error;
      const salons = new Map<string, Set<string>>();
      for (const row of links.data ?? []) {
        const set = salons.get(row.category_id) ?? new Set<string>();
        set.add(row.salon_id);
        salons.set(row.category_id, set);
      }
      const svc = new Map<string, number>();
      for (const row of services.data ?? []) {
        if (!row.category_id) continue;
        svc.set(row.category_id, (svc.get(row.category_id) ?? 0) + 1);
      }
      const out: Record<string, { salons: number; services: number }> = {};
      for (const id of new Set([...salons.keys(), ...svc.keys()])) {
        out[id] = { salons: salons.get(id)?.size ?? 0, services: svc.get(id) ?? 0 };
      }
      return out;
    },
  });
}

export function useAdminServices(filters: { q?: string; salonId?: string } = {}) {
  return useQuery({
    queryKey: ["admin_services", filters],
    queryFn: async () => {
      let q = api
        .from("services")
        .select("id, name, category, description, price, duration_min, is_active, image_url, salon_id, salons(name, city)")
        .order("name")
        .limit(500);
      if (filters.salonId) q = q.eq("salon_id", filters.salonId);
      if (filters.q?.trim()) q = q.ilike("name", `%${filters.q.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        name: string;
        category: string;
        description: string | null;
        price: number;
        duration_min: number;
        is_active: boolean;
        image_url: string | null;
        salon_id: string;
        salons: { name: string; city: string } | null;
      }[];
    },
  });
}

export function useCoupons() {
  return useQuery({
    queryKey: ["admin_coupons"],
    queryFn: async () => {
      const { data, error } = await api
        .from("coupons")
        .select(
          "id, code, title, description, discount_type, discount_value, min_amount, max_discount, usage_limit, used_count, starts_at, expires_at, is_active, is_featured, banner_url, salon_id, salons(name)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        code: string;
        title: string | null;
        description: string | null;
        discount_type: string;
        discount_value: number;
        min_amount: number;
        max_discount: number | null;
        usage_limit: number | null;
        used_count: number;
        starts_at: string;
        expires_at: string | null;
        is_active: boolean;
        is_featured: boolean;
        banner_url: string | null;
        salon_id: string | null;
        salons: { name: string } | null;
      }[];
    },
  });
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: ["admin_settings"],
    queryFn: async () => {
      const { data, error } = await api.from("platform_settings").select("key, value, updated_at");
      if (error) throw error;
      const map: Record<string, Record<string, unknown>> = {};
      for (const row of data ?? []) map[row.key] = (row.value ?? {}) as Record<string, unknown>;
      return map;
    },
  });
}

export async function saveSetting(key: string, value: Record<string, unknown>) {
  const { error } = await api
    .from("platform_settings")
    .upsert({ key, value: value as never }, { onConflict: "key" });
  if (error) throw error;
}

/** System overview counters used on the dashboard. */
export function useSystemOverview() {
  return useQuery({
    queryKey: ["admin_system_overview"],
    queryFn: async () => {
      const [{ data: roles, error: rErr }, activeUsers, openTickets] = await Promise.all([
        api.from("user_roles").select("user_id, role"),
        api.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
        api.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
      ]);
      if (rErr) throw rErr;
      if (activeUsers.error) throw activeUsers.error;
      if (openTickets.error) throw openTickets.error;
      const admins = new Set((roles ?? []).filter((r) => r.role !== "customer").map((r) => r.user_id));
      return {
        admins: admins.size,
        activeUsers: activeUsers.count ?? 0,
        tickets: openTickets.count ?? 0,
      };
    },
  });
}

/** Cross-module search over real records only. */
export async function globalSearch(term: string) {
  const t = term.trim();
  if (t.length < 2) return { salons: [], customers: [], bookings: [], payments: [], tickets: [] };
  const like = `%${t}%`;
  const [salons, customers, bookings, payments, tickets] = await Promise.all([
    api.from("salons").select("id, name, city, status").ilike("name", like).limit(5),
    api.from("profiles").select("id, full_name, email").or(`full_name.ilike.${like},email.ilike.${like}`).limit(5),
    api
      .from("bookings")
      .select("id, booking_date, status, amount, salons(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    api.from("payments").select("id, amount, status, created_at").order("created_at", { ascending: false }).limit(5),
    api.from("support_tickets").select("id, subject, status").ilike("subject", like).limit(5),
  ]);
  return {
    salons: salons.data ?? [],
    customers: customers.data ?? [],
    bookings: (bookings.data ?? []).filter((b) => b.id.includes(t) || (b.salons as { name: string } | null)?.name?.toLowerCase().includes(t.toLowerCase())),
    payments: (payments.data ?? []).filter((p) => p.id.includes(t)),
    tickets: tickets.data ?? [],
  };
}
