import { StoredImage } from "@/components/salonx/StoredImage";
import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, MapPin, Scissors, Sparkles, Star } from "lucide-react";
import { PageShell } from "@/components/salonx/PageShell";
import { EmptyState, LoadingGrid } from "@/components/salonx/EmptyState";
import { useRealtime } from "@/lib/realtime";
import { formatMoney, logHairstyleSignal, useCatalogHairstyle, useSalonsOfferingHairstyle } from "@/lib/queries";

export const Route = createFileRoute("/hairstyles/$slug")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      meta: [
        { title: `${name} — Salons Offering This Style | SalonX` },
        { name: "description", content: `See salons that actually offer ${name}, with their own price, duration and availability.` },
        { property: "og:title", content: `${name} — Salons Offering This Style | SalonX` },
        { property: "og:description", content: `Salons offering ${name}, with real prices and durations.` },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: HairstyleDetailPage,
});

function HairstyleDetailPage() {
  const { slug } = Route.useParams();
  const style = useCatalogHairstyle(slug);
  const salons = useSalonsOfferingHairstyle(style.data?.id);
  const catalogId = style.data?.id;

  useRealtime(["hairstyles", "salons"], [["salons_offering_hairstyle", catalogId ?? ""]]);

  useEffect(() => {
    if (catalogId) void logHairstyleSignal(catalogId, "view");
  }, [catalogId]);

  if (style.isLoading) {
    return (
      <PageShell title="Hairstyle" subtitle="Loading…">
        <LoadingGrid count={4} className="grid gap-4 md:grid-cols-2" />
      </PageShell>
    );
  }

  if (!style.data) {
    return (
      <PageShell title="Hairstyle not found" subtitle="This look isn't in the SalonX catalogue.">
        <EmptyState
          icon={Scissors}
          title="Hairstyle not available"
          description="It may have been removed or hidden."
          action={
            <Link to="/hairstyles" className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
              Browse hairstyles
            </Link>
          }
        />
      </PageShell>
    );
  }

  const h = style.data;
  const rows = salons.data ?? [];

  return (
    <PageShell title={h.name} subtitle={h.category}>
      <article className="salonx-card overflow-hidden md:flex">
        <div className="aspect-[4/3] bg-muted md:w-80 md:shrink-0">
          {h.image_url ? (
            <StoredImage path={h.image_url} alt={`${h.name} hairstyle`} className="size-full" />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground">
              <Scissors className="size-8" />
            </span>
          )}
        </div>
        <div className="p-5">
          {h.is_featured && (
            <span className="mb-2 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
              <Sparkles className="size-3" /> Editor&apos;s Pick
            </span>
          )}
          <h2 className="text-base font-semibold text-foreground">{h.name}</h2>
          {h.description && <p className="mt-2 text-sm text-muted-foreground">{h.description}</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            Price and duration are set by each salon, so they differ between salons.
          </p>
        </div>
      </article>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-foreground">Salons offering {h.name}</h2>

      {salons.isLoading ? (
        <LoadingGrid count={4} className="grid gap-4 md:grid-cols-2" />
      ) : salons.error ? (
        <EmptyState icon={Scissors} title="We couldn't load salons" description="Please check your connection and try again." />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title={`No salon offers ${h.name} yet`}
          description="Try another style, or browse salons near you — new salons join SalonX regularly."
          action={
            <Link to="/salons" search={{ q: "", city: "", service: "", category: "" }} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
              Browse salons
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <article key={row.id} className="salonx-card flex gap-4 p-4 transition-shadow duration-200 hover:shadow-lg">
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                {(row.image_url ?? row.salons.image_url) ? (
                  <StoredImage path={row.image_url ?? row.salons.image_url} alt={row.salons.name} className="size-full" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-foreground">{row.salons.name}</h3>
                <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  {row.salons.review_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="size-3 fill-current text-primary" /> {row.salons.rating}
                    </span>
                  )}
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="size-3" /> {row.salons.area ? `${row.salons.area}, ` : ""}
                    {row.salons.city}
                  </span>
                </p>
                <p className="mt-2 flex items-center gap-3 text-xs font-medium text-foreground">
                  {formatMoney(row.price)}
                  <span className="flex items-center gap-1 font-normal text-muted-foreground">
                    <Clock className="size-3" /> {row.duration_min} min
                  </span>
                </p>
                {row.salons.slug && (
                  <Link
                    to="/salons/$slug"
                    params={{ slug: row.salons.slug }}
                    className="mt-3 inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
                  >
                    View Salon
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
