import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type SalonRow = {
  id: string;
  /** Set only for Near Me results (server-computed). */
  distance_km?: number | null;
  slug: string | null;
  name: string;
  city: string;
  area: string | null;
  pin_code: string | null;
  address: string | null;
  about: string | null;
  phone: string | null;
  image_url: string | null;
  logo_url: string | null;
  rating: number;
  review_count: number;
  starting_price: number;
  is_verified: boolean;
  is_featured: boolean;
  home_service_enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  status: string;
  is_active: boolean;
  rejection_reason: string | null;
  cover_image_url: string | null;
  salon_images: string[] | null;
  salon_type: string | null;
  whatsapp_number: string | null;
  state: string | null;
  seats: number | null;
  years_in_business: number | null;
  opening_time: string | null;
  closing_time: string | null;
  weekly_closed_day: number | null;
  instagram_url: string | null;
  facebook_url: string | null;
  website_url: string | null;
  email: string | null;
  services_offered: string | null;
};

/** Contact columns are readable only by signed-in users (anti-scraping). */
const SALON_CONTACT_FIELDS = "phone, whatsapp_number, email";

const SALON_PUBLIC_FIELDS =
  "id, slug, name, city, area, pin_code, address, about, image_url, logo_url, rating, review_count, starting_price, is_verified, is_featured, home_service_enabled, latitude, longitude, status, is_active, rejection_reason, cover_image_url, salon_images, salon_type, state, seats, years_in_business, opening_time, closing_time, weekly_closed_day, instagram_url, facebook_url, website_url, services_offered";

/** Full field list when a session exists, contact-free list otherwise. */
async function salonFields() {
  const { data } = await api.auth.getSession();
  return data.session ? `${SALON_PUBLIC_FIELDS}, ${SALON_CONTACT_FIELDS}` : SALON_PUBLIC_FIELDS;
}

export type SalonFilters = {
  q?: string;
  city?: string;
  category?: string;
  /** Only salons that actually offer a service with this name. */
  service?: string;
  /** Only salons that have enabled this master hairstyle (catalogue id). */
  hairstyleCatalogId?: string;
  sort?: "recommended" | "rating" | "price" | "newest";
  homeService?: boolean;
  verifiedOnly?: boolean;
  maxPrice?: number;
  /** Near Me: customer's real device coordinates. */
  near?: { lat: number; lng: number } | null;
  state?: string;
  district?: string;
  page?: number;
  pageSize?: number;
};

/** Salon ids that have an active service matching the given name. */
async function salonIdsWithService(name: string) {
  const safe = name.trim().replace(/[%,()]/g, " ");
  const { data, error } = await api
    .from("services")
    .select("salon_id")
    .eq("is_active", true)
    .ilike("name", `%${safe}%`);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.salon_id))];
}

/** Salon ids that have enabled a hairstyle (by catalogue id or free text). */
async function salonIdsWithHairstyle({ catalogId, name }: { catalogId?: string; name?: string }) {
  let query = api.from("hairstyles").select("salon_id").eq("is_active", true);
  if (catalogId) query = query.eq("catalog_id", catalogId);
  if (name) query = query.ilike("name", `%${name.trim().replace(/[%,()]/g, " ")}%`);
  const { data, error } = await query;
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.salon_id))];
}

/**
 * Salon ids that genuinely offer at least one active service under a platform
 * category. Selecting a category on the owner side never implies services, so
 * discovery always follows the real service rows.
 */
export async function salonIdsWithCategory(categoryId: string) {
  const { data, error } = await api
    .from("services")
    .select("salon_id")
    .eq("is_active", true)
    .eq("category_id", categoryId);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.salon_id))];
}

export function salonsQuery(filters: SalonFilters = {}) {
  const {
    q = "",
    city = "",
    category = "",
    service = "",
    hairstyleCatalogId = "",
    sort = "recommended",
    homeService = false,
    verifiedOnly = false,
    maxPrice,
    near,
    state = "",
    district = "",
    page = 1,
    pageSize = 12,
  } = filters;

  return queryOptions({
    queryKey: ["salons", filters],
    queryFn: async () => {
      const fields = await salonFields();
      let query = api.from("salons").select(fields, { count: "exact" }).eq("status", "approved");

      // Near Me: real coordinates, nearest first (server-side distance).
      let nearOrder: Map<string, number> | null = null;
      if (near) {
        const { data: nearby, error: nearErr } = await api.nearbySalons(near.lat, near.lng);
        if (nearErr) throw nearErr;
        const list = nearby ?? [];
        if (list.length === 0) return { rows: [] as SalonRow[], count: 0 };
        nearOrder = new Map(list.map((r) => [r.salon_id, r.distance_km]));
        query = query.in("id", [...nearOrder.keys()]);
      }

      // Hard filters: the salon must actually offer the service / hairstyle.
      if (service.trim()) {
        const ids = await salonIdsWithService(service);
        if (ids.length === 0) return { rows: [] as SalonRow[], count: 0 };
        query = query.in("id", ids);
      }
      if (hairstyleCatalogId) {
        const ids = await salonIdsWithHairstyle({ catalogId: hairstyleCatalogId });
        if (ids.length === 0) return { rows: [] as SalonRow[], count: 0 };
        query = query.in("id", ids);
      }
      if (category.trim()) {
        const ids = await salonIdsWithCategory(category.trim());
        if (ids.length === 0) return { rows: [] as SalonRow[], count: 0 };
        query = query.in("id", ids);
      }

      const term = q.trim();
      if (term) {
        const safe = term.replace(/[%,()]/g, " ");
        // Free text also matches salons that offer a matching service or hairstyle.
        const [serviceIds, styleIds] = await Promise.all([
          salonIdsWithService(safe),
          salonIdsWithHairstyle({ name: safe }),
        ]);
        const offerIds = [...new Set([...serviceIds, ...styleIds])];
        const clauses = [
          `name.ilike.%${safe}%`,
          `city.ilike.%${safe}%`,
          `area.ilike.%${safe}%`,
          `pin_code.ilike.%${safe}%`,
          `district.ilike.%${safe}%`,
          `state.ilike.%${safe}%`,
          `address.ilike.%${safe}%`,
        ];
        if (offerIds.length > 0) clauses.push(`id.in.(${offerIds.join(",")})`);
        query = query.or(clauses.join(","));
      }
      if (city.trim()) query = query.ilike("city", city.trim());
      if (state.trim()) query = query.ilike("state", state.trim());
      if (district.trim()) query = query.ilike("district", district.trim());
      if (homeService) query = query.eq("home_service_enabled", true);
      if (verifiedOnly) query = query.eq("is_verified", true);
      if (typeof maxPrice === "number") query = query.lte("starting_price", maxPrice);

      if (sort === "rating") query = query.order("rating", { ascending: false });
      else if (sort === "price") query = query.order("starting_price", { ascending: true });
      else if (sort === "newest") query = query.order("created_at", { ascending: false });
      else
        query = query
          .order("is_featured", { ascending: false })
          .order("rating", { ascending: false })
          .order("review_count", { ascending: false });

      if (nearOrder) {
        const { data, error } = await query.limit(200);
        if (error) throw error;
        const rows = ((data ?? []) as unknown as SalonRow[])
          .map((r) => ({ ...r, distance_km: nearOrder!.get(r.id) ?? null }))
          .sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9));
        const from = (page - 1) * pageSize;
        return { rows: rows.slice(from, from + pageSize), count: rows.length };
      }

      const from = (page - 1) * pageSize;
      const { data, error, count } = await query.range(from, from + pageSize - 1);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as SalonRow[], count: count ?? 0 };
    },
  });
}

export function useSalons(filters: SalonFilters = {}) {
  return useQuery(salonsQuery(filters));
}

export function useSalonBySlug(slug: string) {
  return useQuery({
    queryKey: ["salon", slug],
    queryFn: async () => {
      const { data, error } = await api
        .from("salons")
        .select(await salonFields())
        .eq("slug", slug)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SalonRow) ?? null;
    },
    enabled: !!slug,
  });
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ["service_categories"],
    queryFn: async () => {
      const { data, error } = await api
        .from("service_categories")
        .select("id, name, slug, icon, description, image_url, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** How many distinct salons actually offer an active service under each category. */
export function useCategorySalonCounts() {
  return useQuery({
    queryKey: ["category_salon_counts"],
    queryFn: async () => {
      const { data, error } = await api
        .from("services")
        .select("category_id, salon_id")
        .eq("is_active", true)
        .not("category_id", "is", null);
      if (error) throw error;
      const map = new Map<string, Set<string>>();
      for (const row of data ?? []) {
        if (!row.category_id) continue;
        const set = map.get(row.category_id) ?? new Set<string>();
        set.add(row.salon_id);
        map.set(row.category_id, set);
      }
      return Object.fromEntries([...map.entries()].map(([k, v]) => [k, v.size])) as Record<
        string,
        number
      >;
    },
  });
}

/** Platform categories a salon has opted into (owner selection, not its services). */
export function useSalonPlatformCategories(salonId?: string) {
  return useQuery({
    queryKey: ["salon_categories", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("salon_categories")
        .select("category_id")
        .eq("salon_id", salonId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.category_id);
    },
    enabled: !!salonId,
  });
}

/**
 * Completed bookings of the signed-in customer at one salon that have no review
 * yet — the only bookings the backend will accept a review for.
 */
export function useReviewableBookings(userId?: string, salonId?: string) {
  return useQuery({
    queryKey: ["reviewable_bookings", userId, salonId],
    queryFn: async () => {
      const { data: bookings, error } = await api
        .from("bookings")
        .select("id, booking_date, slot_time, service_id, services(name)")
        .eq("customer_id", userId!)
        .eq("salon_id", salonId!)
        .eq("status", "completed")
        .order("booking_date", { ascending: false });
      if (error) throw error;
      const ids = (bookings ?? []).map((b) => b.id);
      if (ids.length === 0) return [];
      const { data: reviewed, error: reviewError } = await api
        .from("reviews")
        .select("booking_id")
        .in("booking_id", ids);
      if (reviewError) throw reviewError;
      const used = new Set((reviewed ?? []).map((r) => r.booking_id));
      return (bookings ?? []).filter((b) => !used.has(b.id));
    },
    enabled: !!userId && !!salonId,
  });
}

export function useHairstyleCatalog(featuredOnly = false) {
  return useQuery({
    queryKey: ["hairstyle_catalog", featuredOnly],
    queryFn: async () => {
      let query = api
        .from("hairstyle_catalog")
        .select(
          "id, name, slug, description, image_url, category, gender, is_featured, sort_order, category_id",
        )
        .eq("is_active", true);
      if (featuredOnly) query = query.eq("is_featured", true);
      const { data, error } = await query.order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Live per-style offer stats derived only from real salon listings. */
export function useHairstyleStats() {
  return useQuery({
    queryKey: ["hairstyle_stats"],
    queryFn: async () => {
      const { data, error } = await api
        .from("hairstyles")
        .select("catalog_id, price, salon_id, salons!inner(status)")
        .eq("is_active", true)
        .eq("salons.status", "approved");
      if (error) throw error;
      const map = new Map<string, { salons: Set<string>; min: number }>();
      for (const row of (data ?? []) as {
        catalog_id: string | null;
        price: number;
        salon_id: string;
      }[]) {
        if (!row.catalog_id) continue;
        const entry = map.get(row.catalog_id) ?? {
          salons: new Set<string>(),
          min: Number.POSITIVE_INFINITY,
        };
        entry.salons.add(row.salon_id);
        entry.min = Math.min(entry.min, Number(row.price));
        map.set(row.catalog_id, entry);
      }
      const out: Record<string, { salons: number; from: number | null }> = {};
      for (const [key, value] of map) {
        out[key] = {
          salons: value.salons.size,
          from: Number.isFinite(value.min) ? value.min : null,
        };
      }
      return out;
    },
  });
}

export function useSalonServices(salonId?: string) {
  return useQuery({
    queryKey: ["services", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("services")
        .select(
          "id, name, description, image_url, category, price, duration_min, is_active, is_bookable",
        )
        .eq("salon_id", salonId!)
        .eq("is_active", true)
        .order("price");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!salonId,
  });
}

export function useSalonHairstyles(salonId?: string) {
  return useQuery({
    queryKey: ["salon_hairstyles", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("hairstyles")
        .select(
          "id, name, description, price, duration_min, image_url, category, gender, catalog_id, is_bookable",
        )
        .eq("salon_id", salonId!)
        .eq("is_active", true)
        .order("price");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!salonId,
  });
}

export function useSalonStaff(salonId?: string) {
  return useQuery({
    queryKey: ["staff", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("staff")
        .select("id, name, role, image_url, start_time, end_time, working_days, is_active")
        .eq("salon_id", salonId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!salonId,
  });
}

export function useSalonHours(salonId?: string) {
  return useQuery({
    queryKey: ["salon_hours", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("salon_hours")
        .select("weekday, open_time, close_time, is_closed")
        .eq("salon_id", salonId!)
        .order("weekday");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!salonId,
  });
}

export function useSalonReviews(salonId?: string) {
  return useQuery({
    queryKey: ["reviews", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("reviews")
        .select("id, rating, comment, created_at, owner_reply, owner_replied_at, customer_id")
        .eq("salon_id", salonId!)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!salonId,
  });
}

export function useWeddingPackages(salonId?: string) {
  return useQuery({
    queryKey: ["wedding_packages", salonId ?? "all"],
    queryFn: async () => {
      let query = api
        .from("wedding_packages")
        .select(
          "id, name, description, price, duration_min, included_services, image_url, salon_id, salons!inner(name, city, slug, status)",
        )
        .eq("is_active", true)
        .eq("salons.status", "approved");
      if (salonId) query = query.eq("salon_id", salonId);
      const { data, error } = await query.order("price");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOffers() {
  return useQuery({
    queryKey: ["offers"],
    queryFn: async () => {
      const { data, error } = await api
        .from("coupons")
        .select(
          "id, code, title, description, discount_type, discount_value, min_amount, max_discount, starts_at, expires_at, banner_url, salon, is_featured",
        )
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("discount_value", { ascending: false });
      if (error) throw error;
      const now = Date.now();
      const activeOffers = (data ?? []).filter(
        (offer) =>
          (!offer.starts_at || new Date(offer.starts_at).getTime() <= now) &&
          (!offer.expires_at || new Date(offer.expires_at).getTime() >= now),
      );
      const salonIds = [...new Set(activeOffers.map((offer) => offer.salon_id).filter(Boolean))];
      if (salonIds.length === 0) return [];

      const { data: salons, error: salonError } = await api
        .from("salons")
        .select("id, slug, name")
        .in("id", salonIds)
        .eq("status", "approved")
        .eq("is_active", true);
      if (salonError) throw salonError;

      const salonsById = new Map((salons ?? []).map((salon) => [salon.id, salon]));
      return activeOffers.flatMap((offer) => {
        if (!offer.salon_id) return [];
        const salon = salonsById.get(offer.salon_id);
        return salon ? [{ ...offer, salon }] : [];
      });
    },
  });
}

/** Aggregated, database-derived service catalogue across all approved salons. */
export function usePlatformServices() {
  return useQuery({
    queryKey: ["platform_services"],
    queryFn: async () => {
      const { data, error } = await api
        .from("services")
        .select("name, category, price, duration_min, salon_id, salons!inner(status)")
        .eq("is_active", true)
        .eq("salons.status", "approved");
      if (error) throw error;
      const map = new Map<
        string,
        { name: string; category: string; from: number; salons: Set<string>; duration: number }
      >();
      for (const row of (data ?? []) as {
        name: string;
        category: string;
        price: number;
        duration_min: number;
        salon_id: string;
      }[]) {
        const key = row.name.trim().toLowerCase();
        const entry = map.get(key) ?? {
          name: row.name,
          category: row.category,
          from: Number(row.price),
          salons: new Set<string>(),
          duration: row.duration_min,
        };
        entry.from = Math.min(entry.from, Number(row.price));
        entry.salons.add(row.salon_id);
        map.set(key, entry);
      }
      return [...map.values()]
        .map((v) => ({
          name: v.name,
          category: v.category,
          from: v.from,
          duration: v.duration,
          salons: v.salons.size,
        }))
        .sort((a, b) => b.salons - a.salons);
    },
  });
}

export function useCities() {
  return useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await api.from("salons").select("city").eq("status", "approved");
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as { city: string }[]) {
        counts.set(row.city, (counts.get(row.city) ?? 0) + 1);
      }
      return [...counts.entries()]
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count);
    },
  });
}

export function useMyBookings(userId?: string) {
  return useQuery({
    queryKey: ["my_bookings", userId],
    queryFn: async () => {
      const { data, error } = await api
        .from("bookings")
        .select(
          "id, booking_date, slot_time, status, amount, notes, created_at, salon_id, service_id, hairstyle_id, package_id, salons(name, city, slug), services(name), hairstyles(name), wedding_packages(name)",
        )
        .eq("customer_id", userId!)
        .order("booking_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
}

export type FavoriteRow = {
  salon_id: string;
  salons: {
    id: string;
    name: string;
    slug: string | null;
    city: string;
    area: string | null;
    rating: number;
    review_count: number;
    starting_price: number;
    image_url: string | null;
    status: string;
  } | null;
};

export function useMyFavorites(userId?: string) {
  return useQuery({
    queryKey: ["favorites", userId],
    queryFn: async (): Promise<FavoriteRow[]> => {
      const { data, error } = await api
        .from("favorites")
        .select("entity_id")
        .eq("user_id", userId!)
        .eq("entity_type", "salon");
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.entity_id);
      if (ids.length === 0) return [];
      const { data: salons, error: salonError } = await api
        .from("salons")
        .select(
          "id, name, slug, city, area, rating, review_count, starting_price, image_url, status",
        )
        .in("id", ids);
      if (salonError) throw salonError;
      return ids.map((id) => ({
        salon_id: id,
        salons: (salons ?? []).find((s) => s.id === id) ?? null,
      })) as FavoriteRow[];
    },
    enabled: !!userId,
  });
}

/** Add or remove a salon from the signed-in user's saved list. */
export async function toggleSalonFavorite(userId: string, salonId: string, isFav: boolean) {
  if (isFav) {
    const { error } = await api
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("entity_type", "salon")
      .eq("entity_id", salonId);
    if (error) throw error;
  } else {
    const { error } = await api
      .from("favorites")
      .insert({ user_id: userId, entity_type: "salon", entity_id: salonId });
    if (error) throw error;
  }
}

export function useNotifications(userId?: string) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await api
        .from("notifications")
        .select("id, title, body, category, is_read, link, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
}

/** The salon owned by the signed-in user, whatever its approval status. */
export function useMySalon(userId?: string) {
  return useQuery({
    queryKey: ["my_salon", userId],
    queryFn: async () => {
      const { data, error } = await api
        .from("salons")
        .select(await salonFields())
        .eq("owner_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SalonRow) ?? null;
    },
    enabled: !!userId,
  });
}

export function useSalonBookings(salonId?: string) {
  return useQuery({
    queryKey: ["salon_bookings", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("bookings")
        .select(
          "id, booking_date, slot_time, status, amount, notes, created_at, customer_id, service_id, hairstyle_id, package_id, staff_id, services(name), hairstyles(name), wedding_packages(name), profiles:customer_id(full_name, phone)",
        )
        .eq("salon_id", salonId!)
        .order("booking_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!salonId,
  });
}

export function useAvailableSlots(salonId?: string, date?: string, durationMin = 30) {
  return useQuery({
    queryKey: ["slots", salonId, date, durationMin],
    queryFn: async () => {
      const { data, error } = await api.rpc("salon_available_slots", {
        _salon_id: salonId!,
        _date: date!,
        _duration_min: durationMin,
      });
      if (error) throw error;
      return ((data ?? []) as { slot: string }[] | string[]).map((row) =>
        typeof row === "string" ? row.slice(0, 5) : String(row.slot).slice(0, 5),
      );
    },
    enabled: !!salonId && !!date,
  });
}

export function formatTime(value: string) {
  const [h, m] = value.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${suffix}`;
}

export function formatMoney(value: number) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

/* ----------------------------------------------------- hairstyle discovery */

export type CatalogHairstyle = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  category: string;
  gender: string;
  is_featured: boolean;
  sort_order: number;
  category_id: string | null;
};

/** Super-admin managed hairstyle categories (Men / Women / Kids groups). */
export function useHairstyleCategories() {
  return useQuery({
    queryKey: ["hairstyle_categories"],
    queryFn: async () => {
      const { data, error } = await api
        .from("hairstyle_categories")
        .select("id, group_name, name, slug, description, sort_order")
        .eq("is_active", true)
        .order("group_name")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCatalogHairstyle(slug: string) {
  return useQuery({
    queryKey: ["catalog_hairstyle", slug],
    queryFn: async () => {
      const { data, error } = await api
        .from("hairstyle_catalog")
        .select(
          "id, name, slug, description, image_url, category, gender, is_featured, sort_order, category_id",
        )
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return (data as CatalogHairstyle) ?? null;
    },
    enabled: !!slug,
  });
}

/** Salons that have enabled this master hairstyle, with their own price/duration. */
export function useSalonsOfferingHairstyle(catalogId?: string) {
  return useQuery({
    queryKey: ["salons_offering_hairstyle", catalogId],
    queryFn: async () => {
      const { data, error } = await api
        .from("hairstyles")
        .select(
          "id, name, price, duration_min, image_url, salon_id, salons!inner(id, name, slug, city, area, rating, review_count, image_url, status)",
        )
        .eq("catalog_id", catalogId!)
        .eq("is_active", true)
        .eq("salons.status", "approved")
        .order("price");
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        name: string;
        price: number;
        duration_min: number;
        image_url: string | null;
        salon_id: string;
        salons: {
          id: string;
          name: string;
          slug: string | null;
          city: string;
          area: string | null;
          rating: number;
          review_count: number;
          image_url: string | null;
        };
      }[];
    },
    enabled: !!catalogId,
  });
}

export type TrendRow = {
  catalog_id: string;
  views: number;
  searches: number;
  saves: number;
  bookings: number;
  score: number;
};

/** Real activity-based trend scores. Empty until customers actually interact. */
export function useHairstyleTrends(city?: string) {
  return useQuery({
    queryKey: ["hairstyle_trends", city ?? "all"],
    queryFn: async () => {
      const { data, error } = await api.rpc("hairstyle_trending", {
        _city: city?.trim() ? city.trim() : undefined,
        _days: 30,
      } as never);
      if (error) throw error;
      const rows = (data ?? []) as unknown as TrendRow[];
      const map: Record<string, TrendRow> = {};
      for (const row of rows) map[row.catalog_id] = row;
      return { rows, map };
    },
  });
}

/** Minimum real activity before we are allowed to call anything "Trending". */
export const TRENDING_MIN_SIGNALS = 25;

export function hasEnoughTrendData(rows: TrendRow[] | undefined) {
  if (!rows || rows.length < 3) return false;
  const total = rows.reduce(
    (sum, r) =>
      sum + Number(r.views) + Number(r.searches) + Number(r.saves) + Number(r.bookings) * 5,
    0,
  );
  return total >= TRENDING_MIN_SIGNALS;
}

/** Records a real customer signal. Fire-and-forget; never blocks the UI. */
export async function logHairstyleSignal(
  catalogId: string,
  kind: "view" | "search" | "save",
  city?: string | null,
) {
  try {
    const { data } = await api.auth.getSession();
    await api.from("hairstyle_signals").insert({
      catalog_id: catalogId,
      kind,
      city: city ?? null,
      user_id: data.session?.user.id ?? null,
    });
  } catch {
    /* signals are best-effort analytics */
  }
}

/** Records a search signal when the searched text matches a catalogue hairstyle. */
export async function logHairstyleSearch(term: string, city?: string) {
  const safe = term.trim();
  if (safe.length < 3) return;
  try {
    const { data } = await api
      .from("hairstyle_catalog")
      .select("id")
      .eq("is_active", true)
      .ilike("name", `%${safe.replace(/[%,()]/g, " ")}%`)
      .limit(3);
    for (const row of data ?? []) await logHairstyleSignal(row.id, "search", city);
  } catch {
    /* best effort */
  }
}

/** Live open/closed state derived from the salon's own hours and weekly closed day. */
export function salonOpenState(
  salon: {
    is_active?: boolean;
    status?: string;
    opening_time?: string | null;
    closing_time?: string | null;
    weekly_closed_day?: number | null;
  },
  now = new Date(),
): "open" | "closed" | "unknown" {
  if (salon.status && salon.status !== "approved") return "closed";
  if (salon.is_active === false) return "closed";
  if (!salon.opening_time || !salon.closing_time) return "unknown";
  if (
    salon.weekly_closed_day !== null &&
    salon.weekly_closed_day !== undefined &&
    now.getDay() === salon.weekly_closed_day
  )
    return "closed";
  const toMin = (t: string) => {
    const [h, m] = t.split(":");
    return Number(h) * 60 + Number(m ?? 0);
  };
  const open = toMin(salon.opening_time);
  const close = toMin(salon.closing_time);
  const cur = now.getHours() * 60 + now.getMinutes();
  // Overnight hours (e.g. 18:00 → 02:00)
  if (close <= open) return cur >= open || cur < close ? "open" : "closed";
  return cur >= open && cur < close ? "open" : "closed";
}
