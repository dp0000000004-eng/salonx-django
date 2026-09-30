import { useT } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Brush,
  Calendar,
  Crown,
  Droplets,
  Grid2x2,
  Headphones,
  Heart,
  MapPin,
  Palette,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
  Wand2,
  Waves,
} from "lucide-react";
import { StoredImage } from "@/components/salonx/StoredImage";
import { Reveal, stagger } from "@/components/salonx/Reveal";

import { SiteHeader } from "@/components/salonx/SiteHeader";
import { SiteFooter } from "@/components/salonx/SiteFooter";
import { EmptyState, LoadingGrid } from "@/components/salonx/EmptyState";
import { SalonCard } from "@/routes/salons/index";
import { images } from "@/lib/salonx-data";
import { useRealtime } from "@/lib/realtime";
import { homepageDefaults, useHomepageSettings } from "@/lib/homepage";
import {
  formatMoney,
  hasEnoughTrendData,
  useCategorySalonCounts,
  useCities,
  useHairstyleTrends,
  useHairstyleCatalog,
  useHairstyleStats,
  useSalons,
  useServiceCategories,
} from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SalonX — Find the Best Salons Near You & Book Online" },
      {
        name: "description",
        content:
          "Discover top-rated salons across India by city, area or PIN code, explore trending hairstyles and book your slot in seconds with SalonX.",
      },
      { property: "og:title", content: "SalonX — Find the Best Salons Near You & Book Online" },
      {
        property: "og:description",
        content: "Salon discovery, hairstyle inspiration and instant appointment booking across India.",
      },
    ],
  }),
  component: Home,
});

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Scissors, Brush, Droplets, Sparkles, Palette, Waves, Wand2, Heart, Grid2x2,
};

const features = [
  { icon: ShieldCheck, title: "Trusted Salons", desc: "Verified & Top Rated Salons Near You" },
  { icon: Calendar, title: "Easy Booking", desc: "Book your favourite salon in seconds" },
  { icon: Sparkles, title: "Style Inspiration", desc: "Browse hairstyles offered near you" },
  { icon: Crown, title: "Wedding Packages", desc: "Special packages for groom & bride" },
  { icon: Wallet, title: "Pay at the Salon", desc: "Pay by cash, UPI or card — the salon confirms it" },
  { icon: Headphones, title: "24/7 Support", desc: "We're here to help you anytime" },
];

const tabs = [
  { label: "home.search", icon: Search },
  { label: "home.nearMe", icon: MapPin },
  { label: "home.searchCity", icon: Grid2x2 },
];

function Home() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const t = useT();
  const [query, setQuery] = useState("");

  const categories = useServiceCategories();
  const categoryCounts = useCategorySalonCounts();
  const catalog = useHairstyleCatalog(true);
  const stats = useHairstyleStats();
  const trends = useHairstyleTrends();
  const trendingReady = hasEnoughTrendData(trends.data?.rows);
  const cities = useCities();
  const topSalons = useSalons({ sort: "rating", pageSize: 4 });
  const verifiedSalons = useSalons({ verifiedOnly: true, sort: "recommended", pageSize: 4 });

  useRealtime(
    ["salons", "platform_settings", "services", "hairstyles", "service_categories", "hairstyle_catalog", "reviews"],
    [
      ["salons"],
      ["cities"],
      ["service_categories"],
      ["category_salon_counts"],
      ["hairstyle_catalog", true],
      ["hairstyle_stats"],
      ["homepage_settings"],
    ],
  );

  const hp = useHomepageSettings().data ?? homepageDefaults;
  const popular = (cities.data ?? []).slice(0, 6).map((c) => c.city);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative bg-[oklch(0.13_0.02_270)] pb-32">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={images.heroBarber}
            alt="Barber styling a customer's hair in a premium salon"
            width={1400}
            height={900}
            decoding="async"
            className="sx-hero-image size-full object-cover object-right"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.13_0.02_270)] via-[oklch(0.13_0.02_270)/0.92] to-transparent" />
        </div>

        <div className="relative mx-auto grid max-w-[1500px] grid-cols-1 gap-10 px-4 pt-12 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div className="min-w-0">
            <h1 className="sx-enter max-w-xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
              {t("home.title1")}
              <br />
              {t("home.title2")} <span className="text-primary">{t("home.title3")}</span>
            </h1>
            <p
              className="sx-enter mt-4 max-w-md text-sm text-white/70"
              style={{ "--sx-delay": "90ms" } as React.CSSProperties}
            >
              Explore top salons in your city, choose your style and book your slot in seconds.
            </p>

            <div
              className="sx-enter mt-8 max-w-2xl rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
              style={{ "--sx-delay": "160ms" } as React.CSSProperties}
            >

              <div className="flex flex-wrap gap-6">
                {tabs.map((tb, i) => (
                  <button
                    key={tb.label}
                    onClick={() => { if (i === 1) { void navigate({ to: "/salons", search: { q: "", service: "", city: "", category: "", near: "1" } }); return; } setTab(i); }}
                    className={`relative flex items-center gap-2 pb-2 text-sm transition-colors ${
                      tab === i ? "font-medium text-white" : "text-white/60 hover:text-white/90"
                    }`}
                  >
                    <tb.icon className={`size-4 ${tab === i ? "text-primary" : ""}`} />
                    {t(tb.label)}
                    {tab === i && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
                  </button>
                ))}
              </div>

              <form
                className="mt-3 flex overflow-hidden rounded-lg border border-transparent bg-card transition-[border-color,box-shadow] duration-200 focus-within:border-primary/60 focus-within:shadow-[0_2px_10px_-4px_oklch(0.45_0.18_288/0.4)]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void navigate({ to: "/salons", search: { q: query.trim(), city: "", service: "", category: "" } });
                }}
              >
                <span className="flex items-center pl-4 text-muted-foreground">
                  <Search className="size-4" />
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("home.searchPlaceholder")}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button className="sx-tap bg-primary px-7 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Search
                </button>
              </form>

              {popular.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/60">Popular Cities:</span>
                  {popular.map((s) => (
                    <button
                      key={s}
                      onClick={() => setQuery(s)}
                      className="sx-tap rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>


          {/* WEDDING CARD */}
          <div
            className={`sx-enter flex items-start lg:justify-end ${hp.show_wedding ? "" : "hidden"}`}
            style={{ "--sx-delay": "220ms" } as React.CSSProperties}
          >
            <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-[oklch(0.16_0.02_270)]/90 p-5 backdrop-blur">
              <div className="max-w-[62%]">
                <div className="flex items-center gap-2">
                  <Crown className="size-5 text-warning" />
                  <h2 className="text-lg font-semibold text-white">Wedding Groom Packages</h2>
                </div>
                <p className="mt-2 text-xs text-white/65">Look your best on your big day</p>
                <Link
                  to="/wedding-packages"
                  className="sx-tap mt-4 inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  Explore Packages <ArrowRight className="size-4" />
                </Link>
              </div>
              <img
                src={images.groom}
                alt="Groom in traditional sherwani and turban"
                loading="lazy"
                decoding="async"
                width={700}
                height={900}
                className="pointer-events-none absolute -bottom-2 right-0 h-[130%] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>


      {/* SERVICE CATEGORIES — always from the database, never hard-coded */}
      <section className={`relative z-20 mx-auto -mt-24 max-w-[1500px] px-4 lg:px-8 ${hp.show_categories ? "" : "hidden"}`}>
        <div className="salonx-card p-6 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Service Categories</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a category to see salons that actually offer those services near you.
              </p>
            </div>
            <Link to="/services" className="sx-tap flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              All services <ArrowRight className="size-4" />
            </Link>

          </div>

          {categories.isLoading ? (
            <LoadingGrid count={8} className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8" />
          ) : categories.isError ? (
            <div className="mt-5">
              <EmptyState
                icon={Grid2x2}
                title="We couldn't load service categories"
                description="Please check your connection and try again."
                action={
                  <button
                    onClick={() => void categories.refetch()}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                  >
                    Try again
                  </button>
                }
              />
            </div>
          ) : (categories.data ?? []).length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={Grid2x2}
                title="No service categories yet"
                description="Categories appear here as soon as they are published on the platform."
              />
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {(categories.data ?? []).map((c, i) => {
                const Icon = ICONS[c.icon ?? ""] ?? Scissors;
                const count = categoryCounts.data?.[c.id] ?? 0;
                return (
                  <Reveal key={c.id} delay={stagger(i, 40, 200)} className="h-full">
                    <Link
                      to="/salons"
                      search={{ q: "", city: "", service: "", category: c.id }}
                      title={c.description ?? c.name}
                      className="sx-tap salonx-lift hover:salonx-lift-hover group flex h-full flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center"
                    >
                      {c.image_url ? (
                        <StoredImage
                          path={c.image_url}
                          alt={`${c.name} services`}
                          className="size-12 shrink-0 rounded-full"
                          fallback={<Icon className="size-5" />}
                        />
                      ) : (
                        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icon className="size-5" />
                        </span>
                      )}
                      <span className="text-xs font-medium text-foreground">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {count > 0 ? `${count} ${count === 1 ? "salon" : "salons"}` : "Coming soon"}
                      </span>
                    </Link>
                  </Reveal>
                );
              })}
            </div>

          )}
        </div>
      </section>

      {/* HAIRSTYLES: only labelled "Trending" when real activity backs it up */}
      <section className={`mx-auto max-w-[1500px] px-4 lg:px-8 ${!hp.show_hairstyles || ((catalog.data ?? []).length === 0 && !catalog.isLoading) ? "hidden" : "mt-12"}`}>
        <SectionHead title={trendingReady ? "Trending Hairstyles" : "Editor's Picks"} to="/hairstyles" />
        {catalog.isLoading ? (
          <LoadingGrid count={6} className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {(catalog.data ?? []).map((h, i) => {
              const stat = stats.data?.[h.id];
              return (
                <Reveal key={h.id} delay={stagger(i, 50, 250)}>
                  <Link
                    to="/hairstyles/$slug"
                    params={{ slug: h.slug }}
                    className="sx-tap-soft group relative block aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted"
                  >
                    <StoredImage
                      path={h.image_url}
                      alt={`${h.name} hairstyle`}
                      className="size-full transition-transform duration-500 group-hover:scale-105"
                      fallback={<Scissors className="size-6" />}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <h3 className="text-sm font-semibold text-white">{h.name}</h3>
                      <p className="text-xs text-white/75">
                        {stat?.from ? `Starting ${formatMoney(stat.from)}` : "Coming soon"}
                      </p>
                      <p className="text-[10px] text-white/55">
                        {stat?.salons ? `${stat.salons} ${stat.salons === 1 ? "salon" : "salons"}` : "No salons yet"}
                      </p>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>

        )}
      </section>

      {/* TOP RATED SALONS — ranked on real ratings and review counts */}
      <Reveal as="section" className={`mx-auto mt-12 max-w-[1500px] px-4 lg:px-8 ${hp.show_top_rated ? "" : "hidden"}`}>
        <SectionHead title={t("home.topRated")} to="/salons" />
        <div className="mt-4">
          {topSalons.isLoading ? (
            <LoadingGrid count={4} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" />
          ) : topSalons.isError ? (
            <EmptyState
              icon={Store}
              title="We couldn't load salons"
              description="Please check your connection and try again."
              action={
                <button
                  onClick={() => void topSalons.refetch()}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                >
                  Try again
                </button>
              }
            />
          ) : (topSalons.data?.rows ?? []).length === 0 ? (
            <EmptyState
              icon={Store}
              title="No salons available yet"
              description="Book a demo to get your salon listed on SalonX."
              action={
                <Link to="/book-demo" className="sx-tap rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
                  Book a demo
                </Link>

              }
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {(topSalons.data?.rows ?? [])
                  .filter((s) => s.review_count > 0)
                  .map((s, i) => (
                    <Reveal key={s.id} delay={stagger(i, 50, 200)} className="h-full">
                      <SalonCard salon={s} />
                    </Reveal>
                  ))}
              </div>
              {(topSalons.data?.rows ?? []).some((s) => s.review_count === 0) && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-foreground">New on SalonX</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    These salons don't have enough reviews yet to be ranked.
                  </p>
                  <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {(topSalons.data?.rows ?? [])
                      .filter((s) => s.review_count === 0)
                      .map((s, i) => (
                        <Reveal key={s.id} delay={stagger(i, 50, 200)} className="h-full">
                          <SalonCard salon={s} />
                        </Reveal>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Reveal>


      {/* TRUSTED / VERIFIED SALONS */}
      {hp.show_trusted && (verifiedSalons.data?.rows ?? []).length > 0 && (
        <Reveal as="section" className="mx-auto mt-12 max-w-[1500px] px-4 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
                <ShieldCheck className="size-5 text-primary" /> Trusted & Verified Salons
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Verified by the SalonX team before going live.</p>
            </div>
            <Link
              to="/salons"
              search={{ q: "", city: "", service: "", category: "" }}
              className="sx-tap flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View All <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(verifiedSalons.data?.rows ?? []).map((s, i) => (
              <Reveal key={s.id} delay={stagger(i, 50, 200)} className="h-full">
                <SalonCard salon={s} />
              </Reveal>
            ))}
          </div>
        </Reveal>
      )}

      {/* WHY CHOOSE SALONX */}
      <Reveal as="section" className="mx-auto mt-12 max-w-[1500px] px-4 lg:px-8">

        <div className="grid gap-6 rounded-xl bg-primary-soft/60 p-8 sm:grid-cols-2 lg:grid-cols-6">
          {features.map((f) => (
            <div key={f.title} className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-sm">
                <f.icon className="size-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* SECURE BOOKING INFORMATION */}
      <Reveal as="section" className="mx-auto mt-12 mb-14 max-w-[1500px] px-4 lg:px-8">
        <div className="salonx-card grid gap-6 p-7 md:grid-cols-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">Secure Booking Information</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Your booking details are stored securely and only shared with the salon you booked.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">How payment works</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Every booking starts as payment pending. You pay the salon directly by cash, UPI or card, and the salon
              marks it paid. SalonX never asks for your card details online.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Loyalty points</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Once the salon confirms your payment, loyalty points are added to your balance for that salon and can be
              redeemed on your next visit there.
            </p>
          </div>
        </div>
      </Reveal>

      <SiteFooter />
    </div>
  );
}

function SectionHead({ title, to }: { title: string; to: "/hairstyles" | "/salons" }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
      <Link
        to={to}
        search={to === "/salons" ? { q: "", city: "", service: "", category: "" } : {}}
        className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        View All <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
