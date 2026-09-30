import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type ApplicationRow = {
  id: string;
  name: string;
  slug: string | null;
  salon_type: string | null;
  about: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  image_url: string | null;
  salon_images: string[] | null;
  seats: number | null;
  years_in_business: number | null;
  phone: string | null;
  email: string | null;
  whatsapp_number: string | null;
  address: string | null;
  state: string | null;
  city: string;
  district: string | null;
  area: string | null;
  pin_code: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_time: string | null;
  closing_time: string | null;
  weekly_closed_day: number | null;
  services_offered: string | null;
  starting_price: number;
  instagram_url: string | null;
  facebook_url: string | null;
  website_url: string | null;
  status: string;
  is_active: boolean;
  rejection_reason: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  owner_id: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null; created_at: string; is_active: boolean } | null;
};

const FIELDS =
  "id, name, slug, salon_type, about, logo_url, cover_image_url, image_url, salon_images, seats, years_in_business, phone, email, whatsapp_number, address, state, district, city, area, pin_code, latitude, longitude, opening_time, closing_time, weekly_closed_day, services_offered, starting_price, instagram_url, facebook_url, website_url, status, is_active, rejection_reason, approved_at, rejected_at, owner_id, created_at, profiles:owner_id(full_name, email, created_at, is_active)";

export function useSalonApplications(status: string) {
  return useQuery({
    queryKey: ["salon_applications", status],
    queryFn: async () => {
      const { data, error } = await api
        .from("salons")
        .select(FIELDS)
        .eq("status", status as never)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as ApplicationRow[];
    },
  });
}

export async function setSalonStatus(salonId: string, status: "approved" | "rejected" | "suspended" | "pending", reason?: string) {
  const { error } = await api.rpc("admin_set_salon_status", {
    _salon_id: salonId,
    _status: status,
    ...(reason ? { _reason: reason } : {}),
  });
  if (error) throw new Error(error.message);
}
