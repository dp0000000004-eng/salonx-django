import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type SalonResource = {
  id: string;
  salon_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type SalonClosure = {
  id: string;
  salon_id: string;
  closed_date: string;
  reason: string | null;
};

export type BookingConfig = {
  booking_interval_min: number;
  buffer_min: number;
  timezone: string;
};

/** Chairs / resources of one salon. */
export function useSalonResources(salonId?: string) {
  return useQuery({
    queryKey: ["salon_resources", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("salon_resources")
        .select("id, salon_id, name, sort_order, is_active")
        .eq("salon_id", salonId!)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as SalonResource[];
    },
    enabled: !!salonId,
  });
}

/** Holiday / closed dates of one salon. */
export function useSalonClosures(salonId?: string) {
  return useQuery({
    queryKey: ["salon_closures", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("salon_closures")
        .select("id, salon_id, closed_date, reason")
        .eq("salon_id", salonId!)
        .gte("closed_date", new Date().toISOString().slice(0, 10))
        .order("closed_date");
      if (error) throw error;
      return (data ?? []) as SalonClosure[];
    },
    enabled: !!salonId,
  });
}

/** Booking interval / buffer / timezone configured by the owner. */
export function useBookingConfig(salonId?: string) {
  return useQuery({
    queryKey: ["booking_config", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("salons")
        .select("booking_interval_min, buffer_min, timezone")
        .eq("id", salonId!)
        .maybeSingle();
      if (error) throw error;
      return {
        booking_interval_min: data?.booking_interval_min ?? 10,
        buffer_min: data?.buffer_min ?? 0,
        timezone: data?.timezone ?? "Asia/Kolkata",
      } as BookingConfig;
    },
    enabled: !!salonId,
  });
}

/** Live open / closed state, calculated by the backend from hours, working days and closures. */
export function useSalonOpenNow(salonId?: string) {
  return useQuery({
    queryKey: ["salon_open_now", salonId],
    queryFn: async () => {
      const { data, error } = await api.rpc("salon_open_now", { _salon_id: salonId! });
      if (error) throw error;
      return Boolean(data);
    },
    enabled: !!salonId,
    refetchInterval: 60_000,
  });
}

export async function saveBookingConfig(salonId: string, config: Partial<BookingConfig>) {
  const { error } = await api.from("salons").update(config).eq("id", salonId);
  if (error) throw error;
}

export async function addResource(salonId: string, name: string, sortOrder: number) {
  const { error } = await api
    .from("salon_resources")
    .insert({ salon_id: salonId, name, sort_order: sortOrder });
  if (error) throw error;
}

export async function renameResource(id: string, name: string) {
  const { error } = await api.from("salon_resources").update({ name }).eq("id", id);
  if (error) throw error;
}

/** Future bookings still assigned to a chair — used before removing capacity. */
export async function futureBookingsForResource(resourceId: string) {
  const { count, error } = await api
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("resource_id", resourceId)
    .gte("booking_date", new Date().toISOString().slice(0, 10))
    .in("status", ["pending", "confirmed", "upcoming", "checked_in", "waiting", "service_started"]);
  if (error) throw error;
  return count ?? 0;
}

export async function removeResource(resourceId: string) {
  const future = await futureBookingsForResource(resourceId);
  if (future > 0) {
    throw new Error(
      "These resources have future bookings. Reassign or resolve affected bookings before reducing capacity.",
    );
  }
  const { error } = await api.from("salon_resources").delete().eq("id", resourceId);
  if (error) throw error;
}

export async function addClosure(salonId: string, date: string, reason: string | null) {
  const { error } = await api
    .from("salon_closures")
    .insert({ salon_id: salonId, closed_date: date, reason });
  if (error) throw error;
}

export async function removeClosure(id: string) {
  const { error } = await api.from("salon_closures").delete().eq("id", id);
  if (error) throw error;
}

/** End time for a start time + duration, as HH:MM. */
export function endTime(start: string, durationMin: number) {
  const [h, m] = start.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + durationMin;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
