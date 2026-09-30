import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "upcoming"
  | "checked_in"
  | "waiting"
  | "service_started"
  | "completed"
  | "cancelled"
  | "no_show";

export const ACTIVE_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "upcoming",
  "checked_in",
  "waiting",
  "service_started",
];

export type OwnerBooking = {
  id: string;
  booking_date: string;
  slot_time: string;
  duration_min: number;
  status: BookingStatus;
  amount: number;
  notes: string | null;
  created_at: string;
  cancellation_reason: string | null;
  customer_id: string;
  service_id: string | null;
  hairstyle_id: string | null;
  package_id: string | null;
  services: { name: string; duration_min: number } | null;
  hairstyles: { name: string; duration_min: number } | null;
  wedding_packages: { name: string; duration_min: number } | null;
  profiles: { full_name: string | null; phone: string | null; email: string | null } | null;
};

const BOOKING_FIELDS =
  "id, booking_date, slot_time, duration_min, status, amount, notes, created_at, cancellation_reason, customer_id, service_id, hairstyle_id, package_id, services(name, duration_min), hairstyles(name, duration_min), wedding_packages(name, duration_min)";

/** Name + phone only, for customers who have booked at the owner's salon. */
async function customerDirectory() {
  const { data, error } = await api.rpc("salon_customer_profiles");
  if (error) throw error;
  const map = new Map<string, { full_name: string | null; phone: string | null; email: string | null }>();
  for (const row of data ?? []) map.set(row.id, { full_name: row.full_name, phone: row.phone, email: null });
  return map;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function useOwnerBookings(salonId?: string) {
  return useQuery({
    queryKey: ["owner_bookings", salonId],
    queryFn: async (): Promise<OwnerBooking[]> => {
      const [{ data, error }, directory] = await Promise.all([
        api
          .from("bookings")
          .select(BOOKING_FIELDS)
          .eq("salon_id", salonId!)
          .order("booking_date", { ascending: false })
          .order("slot_time", { ascending: true })
          .limit(1000),
        customerDirectory(),
      ]);
      if (error) throw error;
      return ((data ?? []) as unknown as OwnerBooking[]).map((b) => ({
        ...b,
        profiles: directory.get(b.customer_id) ?? null,
      }));
    },
    enabled: !!salonId,
  });
}

export function useOwnerServices(salonId?: string) {
  return useQuery({
    queryKey: ["owner_services", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("services")
        .select("id, name, category, category_id, description, price, duration_min, image_url, is_active, created_at")
        .eq("salon_id", salonId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!salonId,
  });
}

export function useOwnerPackages(salonId?: string) {
  return useQuery({
    queryKey: ["owner_packages", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("wedding_packages")
        .select("id, name, description, price, duration_min, image_url, included_services, is_active, created_at")
        .eq("salon_id", salonId!)
        .order("price");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!salonId,
  });
}

export function useOwnerOffers(salonId?: string) {
  return useQuery({
    queryKey: ["owner_offers", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("coupons")
        .select(
          "id, code, title, description, discount_type, discount_value, min_amount, max_discount, usage_limit, used_count, service_ids, package_ids, starts_at, expires_at, is_active, created_at",
        )
        .eq("salon_id", salonId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!salonId,
  });
}

export function useOwnerReviews(salonId?: string) {
  return useQuery({
    queryKey: ["owner_reviews", salonId],
    queryFn: async () => {
      const [{ data, error }, directory] = await Promise.all([
        api
          .from("reviews")
          .select(
            "id, rating, comment, photo_url, created_at, owner_reply, owner_replied_at, is_hidden, booking_id, customer_id",
          )
          .eq("salon_id", salonId!)
          .order("created_at", { ascending: false })
          .limit(200),
        customerDirectory(),
      ]);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        profiles: directory.get(r.customer_id) ?? null,
      }));
    },
    enabled: !!salonId,
  });
}

export function useOwnerPayments(salonId?: string) {
  return useQuery({
    queryKey: ["owner_payments", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("payments")
        .select("id, booking_id, customer_id, method, status, amount, commission_amount, salon_earning, provider_ref, paid_at, created_at")
        .eq("salon_id", salonId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!salonId,
  });
}


export function useOwnerHours(salonId?: string) {
  return useQuery({
    queryKey: ["owner_hours", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("salon_hours")
        .select("id, weekday, is_closed, open_time, close_time, break_start, break_end")
        .eq("salon_id", salonId!)
        .order("weekday");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!salonId,
  });
}

export function useOwnerBlocks(salonId?: string) {
  return useQuery({
    queryKey: ["owner_blocks", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("salon_blocks")
        .select("id, block_date, full_day, start_time, end_time, slot_time, reason, created_at")
        .eq("salon_id", salonId!)
        .gte("block_date", new Date().toISOString().slice(0, 10))
        .order("block_date");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!salonId,
  });
}

/** Dynamically generated slots for a date and duration, straight from the database engine. */
export function useSlots(salonId?: string, date?: string, durationMin?: number) {
  return useQuery({
    queryKey: ["slots", salonId, date, durationMin ?? 30],
    queryFn: async () => {
      const { data, error } = await api.rpc("salon_available_slots", {
        _salon_id: salonId!,
        _date: date!,
        _duration_min: durationMin ?? 30,
      });
      if (error) throw error;
      return ((data ?? []) as { slot: string }[] | string[]).map((row) =>
        typeof row === "string" ? row : row.slot,
      );
    },
    enabled: !!salonId && !!date,
  });
}

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export function bookingItemName(b: OwnerBooking) {
  return b.services?.name ?? b.hairstyles?.name ?? b.wedding_packages?.name ?? "Appointment";
}

export function bookingEndTime(b: Pick<OwnerBooking, "slot_time" | "duration_min">) {
  const [h, m] = b.slot_time.slice(0, 5).split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + (b.duration_min || 30);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  upcoming: "Upcoming",
  checked_in: "Checked in",
  waiting: "Waiting",
  service_started: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

export function statusTone(status: string) {
  switch (status) {
    case "completed":
      return "bg-success/15 text-success";
    case "cancelled":
    case "no_show":
      return "bg-destructive/15 text-destructive";
    case "service_started":
    case "checked_in":
      return "bg-info/15 text-info";
    case "pending":
      return "bg-warning/20 text-warning";
    default:
      return "bg-primary-soft text-primary";
  }
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export async function setBookingStatus(bookingId: string, status: BookingStatus, note?: string) {
  const { error } = await api.rpc("owner_set_booking_status", {
    _booking_id: bookingId,
    _status: status,
    ...(note ? { _note: note } : {}),
  });
  if (error) throw error;
}

export async function rescheduleBooking(bookingId: string, date: string, time: string) {
  const { error } = await api.rpc("owner_reschedule_booking", {
    _booking_id: bookingId,
    _booking_date: date,
    _slot_time: time,
  });
  if (error) throw error;
}
