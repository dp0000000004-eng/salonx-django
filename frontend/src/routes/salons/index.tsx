import { useT } from "@/lib/i18n";
import { StoredImage } from "@/components/salonx/StoredImage";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Clock, Heart, MapPin, Navigation, Search, Star, Store } from "lucide-react";
import { PageShell } from "@/components/salonx/PageShell";
import { EmptyState, LoadingGrid } from "@/components/salonx/EmptyState";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import {
  formatMoney,
  logHairstyleSearch,
  toggleSalonFavorite,
  useCities,
  useMyFavorites,
  useSalons,
  useServiceCategories,
  type SalonFilters,
} from "@/lib/queries";

export const Route = createFileRoute("/salons/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search["q"] as string) || "",
    service: (search["service"] as string) || "",
    city: (search["city"] as string) || "",
    category: (search["category"] as string) || "",
    near: search["near"] === "1" || search["near"] === 1 ? "1" : undefined,
    state: (search["state"] as string) || undefined,
    district: (search["district"] as string) || undefined,
  }) as { q: string; service: string; city: string; category: string; near?: string; state?: string; district?: string },
  head: () => ({
    meta: [
      { title: "Browse Salons Near You — SalonX" },
      { name: "description", content: "Browse verified salons by city, area or PIN code with live ratings, prices and availability." },
      { property: "og:title", content: "Browse Salons Near You — SalonX" },
      { property: "og:description", content: "Verified salons with live ratings, prices and availability." },
    ],
  }),
  component: SalonsPage,
});

const SORTS = [
  { key: "recommended", label: "Recommended" },
  { key: "rating", label: "Highest Rated" },
  { key: "price", label: "Lowest Price" },
  { key: "newest", label: "Newest" },
] as const;

function SalonsPage() {
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q);
  const [input, setInput] = useState(search.q);
  const [service, setService] = useState(search.service);
  const [city, setCity] = useState(search.city);
  const [sort, setSort] = useState<NonNullable<SalonFilters["sort"]>>("recommended");
  const [homeService, setHomeService] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);

  const pageSize = 12;
  const [locDenied, setLocDenied] = useState(false);
  const t = useT();
  const [locating, setLocating] = useState(false);
  const [stateF, setStateF] = useState(search.state ?? "");
  const [districtF, setDistrictF] = useState(search.district ?? "");
  const filters: SalonFilters = { q, city, service, category: search.category, sort, homeService, verifiedOnly, page, pageSize, near, state: stateF, district: districtF };
  const { data, isLoading, isError, error, refetch } = useSalons(filters);
  const cities = useCities();
  const categories = useServiceCategories();
  const activeCategory = (categories.data ?? []).find((c) => c.id === search.category) ?? null;

  useRealtime(["salons", "services", "hairstyles"], [["salons"], ["cities"]]);

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const sorted = rows;

  useEffect(() => {
    if (search.near === "1") useMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useMyLocation() {
    if (near) { setNear(null); setPage(1); return; }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocDenied(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLocDenied(false);
        setCity("");
        setPage(1);
        setNear({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { setLocating(false); setLocDenied(true); },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }

  return (
    <PageShell
      title={t("search.title")}
      subtitle={isLoading ? t("search.finding") : t("search.available", { n: total })}
    >
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="salonx-card h-fit space-y-5 p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Search</h2>
            <form
              className="mt-2 flex overflow-hidden rounded-lg border border-border"
              onSubmit={(e) => {
                e.preventDefault();
                setQ(input);
                setPage(1);
                void logHairstyleSearch(input, city);
              }}
            >
              <span className="flex items-center pl-3 text-muted-foreground">
                <Search className="size-4" />
              </span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("search.placeholder")}
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs outline-none"
              />
            </form>
          </div>

          <button
            onClick={useMyLocation}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
          >
            <Navigation className="size-4" /> {locating ? t("search.locating") : near ? t("search.nearOn") : t("search.nearMe")}
          </button>
          {locDenied && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-foreground">
              {t("search.locDenied")}
            </p>
          )}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">{t("search.stateDistrict")}</h2>
            <input value={stateF} onChange={(e) => { setStateF(e.target.value); setPage(1); }} placeholder={t("search.state")} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-xs outline-none" />
            <input value={districtF} onChange={(e) => { setDistrictF(e.target.value); setPage(1); }} placeholder={t("search.district")} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-xs outline-none" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground">City</h2>
            {(cities.data ?? []).length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No cities listed yet.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <FilterChip active={city === ""} onClick={() => { setCity(""); setPage(1); }}>All</FilterChip>
                {(cities.data ?? []).map((c) => (
                  <FilterChip
                    key={c.city}
                    active={city === c.city}
                    onClick={() => { setCity(city === c.city ? "" : c.city); setPage(1); }}
                  >
                    {c.city} ({c.count})
                  </FilterChip>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground">Filters</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterChip active={verifiedOnly} onClick={() => { setVerifiedOnly((v) => !v); setPage(1); }}>
                Verified only
              </FilterChip>
              <FilterChip active={homeService} onClick={() => { setHomeService((v) => !v); setPage(1); }}>
                Home service
              </FilterChip>
            </div>
          </div>
        </aside>

        <div>
          {service && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
              <span className="text-muted-foreground">Showing salons that offer</span>
              <span className="font-medium text-foreground">{service}</span>
              <button
                onClick={() => { setService(""); setPage(1); }}
                className="ml-auto rounded-md px-2 py-1 text-muted-foreground transition-colors duration-200 hover:text-primary"
              >
                Clear
              </button>
            </div>
          )}

          <div className="mb-4 flex flex-wrap gap-2">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => { setSort(s.key); setPage(1); }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  sort === s.key ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {activeCategory && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-primary-soft/50 px-3 py-2">
              <span className="text-xs text-muted-foreground">Showing salons that offer</span>
              <span className="text-xs font-semibold text-foreground">{activeCategory.name}</span>
              <Link
                to="/salons"
                search={{ q, city, service, category: "" }}
                className="ml-auto text-xs font-medium text-primary hover:underline"
              >
                Clear
              </Link>
            </div>
          )}

          {isLoading ? (
            <LoadingGrid count={4} className="grid gap-4 md:grid-cols-2" />
          ) : isError ? (
            <EmptyState
              icon={Store}
              title="We couldn't load salons"
              description={error instanceof Error ? error.message : "Please check your connection and try again."}
              action={
                <button
                  onClick={() => void refetch()}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                >
                  Try again
                </button>
              }
            />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={Store}
              title="No salons found for this search"
              description={
                activeCategory
                  ? `No salon is offering ${activeCategory.name} services yet. Try another category or area.`
                  : city
                    ? `SalonX is coming to ${city} soon. Try another area, search by city, or look for a different service.`
                    : "Try another area, search by city, or search for a different service or hairstyle."
              }
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {sorted.map((s) => (
                  <SalonCard key={s.id} salon={s} near={near} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
        active ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

export function SalonCard({
  salon,
  near,
}: {
  salon: {
    id: string; slug: string | null; name: string; city: string; area: string | null; pin_code: string | null;
    image_url: string | null; rating: number; review_count: number; starting_price: number;
    is_verified: boolean; home_service_enabled: boolean; latitude: number | null; longitude: number | null;
    distance_km?: number | null;
  };
  near?: { lat: number; lng: number } | null;
}) {
  const { user } = useAuth();
  const t = useT();
  const queryClient = useQueryClient();
  const favorites = useMyFavorites(user?.id);
  const isFav = (favorites.data ?? []).some((f) => f.salon_id === salon.id);
  const km = near && typeof salon.distance_km === "number" ? salon.distance_km : null;

  async function toggleFavorite() {
    if (!user) {
      toast.error("Sign in to save salons");
      return;
    }
    await toggleSalonFavorite(user.id, salon.id, isFav);
    void queryClient.invalidateQueries({ queryKey: ["favorites", user.id] });
  }

  return (
    <article className="salonx-card flex overflow-hidden">
      <div className="relative w-36 shrink-0 bg-muted sm:w-40">
        <StoredImage
          path={salon.image_url}
          alt={salon.name}
          className="size-full"
          fallback={<Store className="size-6" />}
        />
        <button
          onClick={toggleFavorite}
          aria-label="Save salon"
          className={`absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-card/90 ${
            isFav ? "text-destructive" : "text-muted-foreground hover:text-destructive"
          }`}
        >
          <Heart className={`size-4 ${isFav ? "fill-current" : ""}`} />
        </button>
      </div>
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
              {salon.name}
              {salon.is_verified && <BadgeCheck className="size-4 shrink-0 text-primary" />}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {[salon.area, salon.city, salon.pin_code].filter(Boolean).join(", ")}
            </p>
          </div>
          {salon.review_count > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary">
              <Star className="size-3 fill-current" />
              {salon.rating}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {km !== null && <span className="flex items-center gap-1"><MapPin className="size-3" />{t("search.kmAway", { km: km.toFixed(1) })}</span>}
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {salon.review_count > 0 ? `${salon.review_count} reviews` : "New on SalonX"}
          </span>
          {salon.home_service_enabled && <span className="text-success">Home service</span>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground">
            {salon.starting_price > 0 ? `Starting ${formatMoney(salon.starting_price)}` : "Prices coming soon"}
          </span>
          {salon.slug && (
            <Link
              to="/salons/$slug"
              params={{ slug: salon.slug }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Book Now
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
