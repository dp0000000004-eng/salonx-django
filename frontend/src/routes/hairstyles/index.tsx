import { StoredImage } from "@/components/salonx/StoredImage";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Flame, Scissors, Sparkles } from "lucide-react";
import { PageShell } from "@/components/salonx/PageShell";
import { EmptyState, LoadingGrid } from "@/components/salonx/EmptyState";
import { useRealtime } from "@/lib/realtime";
import {
  formatMoney,
  hasEnoughTrendData,
  useHairstyleCatalog,
  useHairstyleCategories,
  useHairstyleStats,
  useHairstyleTrends,
} from "@/lib/queries";

export const Route = createFileRoute("/hairstyles/")({
  head: () => ({
    meta: [
      { title: "Hairstyles & Editor's Picks — SalonX" },
      { name: "description", content: "Browse the SalonX hairstyle catalogue with editor's picks, real prices and the salons that actually offer each look." },
      { property: "og:title", content: "Hairstyles & Editor's Picks — SalonX" },
      { property: "og:description", content: "Hairstyle inspiration with live prices from real salons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HairstylesPage,
});

function HairstylesPage() {
  const [gender, setGender] = useState<"all" | "male" | "female" | "unisex" | "kids">("all");
  const [categoryId, setCategoryId] = useState("");
  const catalog = useHairstyleCatalog();
  const categories = useHairstyleCategories();
  const stats = useHairstyleStats();
  const trends = useHairstyleTrends();

  useRealtime(
    ["hairstyle_catalog", "hairstyles", "hairstyle_categories"],
    [["hairstyle_catalog", false], ["hairstyle_stats"], ["hairstyle_categories"]],
  );

  const trendRows = trends.data?.rows;
  const trendingReady = hasEnoughTrendData(trendRows);
  const topTrending = new Set((trendRows ?? []).slice(0, 6).map((r) => r.catalog_id));

  const rows = (catalog.data ?? []).filter(
    (h) =>
      (gender === "all" || h.gender === gender) &&
      (!categoryId || (h as { category_id?: string | null }).category_id === categoryId),
  );

  const sorted = trendingReady
    ? [...rows].sort((a, b) => (trends.data?.map[b.id]?.score ?? 0) - (trends.data?.map[a.id]?.score ?? 0))
    : [...rows].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));

  return (
    <PageShell
      title="Hairstyles"
      subtitle={
        trendingReady
          ? "Trending right now, based on what customers are actually booking."
          : "Editor's picks, hand-selected by the SalonX team."
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "male", "female", "unisex", "kids"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGender(g)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors duration-200 ${
              gender === g ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"
            }`}
          >
            {g === "male" ? "Men" : g === "female" ? "Women" : g}
          </button>
        ))}
      </div>

      {(categories.data ?? []).length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryId("")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
              categoryId === "" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"
            }`}
          >
            All categories
          </button>
          {(categories.data ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(categoryId === c.id ? "" : c.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                categoryId === c.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"
              }`}
            >
              {c.group_name} · {c.name}
            </button>
          ))}
        </div>
      )}

      {catalog.isLoading ? (
        <LoadingGrid count={8} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" />
      ) : catalog.error ? (
        <EmptyState icon={Scissors} title="We couldn't load hairstyles" description="Please check your connection and try again." />
      ) : sorted.length === 0 ? (
        <EmptyState icon={Scissors} title="No hairstyles listed" description="Hairstyles appear here once the SalonX team publishes them." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((h) => {
            const stat = stats.data?.[h.id];
            const isTrending = trendingReady && topTrending.has(h.id);
            return (
              <article key={h.id} className="salonx-card overflow-hidden transition-shadow duration-200 hover:shadow-lg">
                <div className="relative aspect-[4/3] bg-muted">
                  {h.image_url ? (
                    <StoredImage path={h.image_url} alt={`${h.name} hairstyle`} className="size-full" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-muted-foreground">
                      <Scissors className="size-6" />
                    </span>
                  )}
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    {h.is_featured && (
                      <span className="flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                        <Sparkles className="size-3" /> Editor&apos;s Pick
                      </span>
                    )}
                    {isTrending && (
                      <span className="flex items-center gap-1 rounded-md bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
                        <Flame className="size-3" /> Trending
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <h2 className="text-sm font-semibold text-foreground">{h.name}</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{h.category}</p>
                  {h.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{h.description}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {stat?.salons
                      ? `${stat.salons} ${stat.salons === 1 ? "salon offers" : "salons offer"} this${stat.from ? ` · from ${formatMoney(stat.from)}` : ""}`
                      : "No salons offer this yet"}
                  </p>
                  <Link
                    to="/hairstyles/$slug"
                    params={{ slug: h.slug }}
                    className="mt-3 inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
                  >
                    View salons
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
