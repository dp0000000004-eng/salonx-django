import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { PageShell } from "@/components/salonx/PageShell";
import { EmptyState, LoadingGrid } from "@/components/salonx/EmptyState";
import { useRealtime } from "@/lib/realtime";
import { formatMoney, useWeddingPackages } from "@/lib/queries";

export const Route = createFileRoute("/wedding-packages")({
  head: () => ({
    meta: [
      { title: "Wedding Groom & Bridal Packages — SalonX" },
      { name: "description", content: "Browse real wedding grooming and bridal packages published by verified salons, with prices and what's included." },
      { property: "og:title", content: "Wedding Groom & Bridal Packages — SalonX" },
      { property: "og:description", content: "Real wedding packages from verified salons near you." },
    ],
  }),
  component: WeddingPackagesPage,
});

function WeddingPackagesPage() {
  const packages = useWeddingPackages();
  useRealtime(["wedding_packages", "salons"], [["wedding_packages", "all"]]);

  const rows = packages.data ?? [];

  return (
    <PageShell title="Wedding Packages" subtitle="Grooming and bridal packages published by verified salons.">
      {packages.isLoading ? (
        <LoadingGrid count={6} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Crown}
          title="No wedding packages yet"
          description="Salons haven't published wedding packages yet. Check back soon."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => {
            const salon = p.salons as { name: string; city: string; slug: string | null } | null;
            return (
              <article key={p.id} className="salonx-card overflow-hidden">
                {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" className="h-40 w-full object-cover" />}
                <div className="p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-warning/20 text-warning">
                    <Crown className="size-5" />
                  </span>
                  <h2 className="mt-3 text-sm font-semibold text-foreground">{p.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {salon?.name} · {salon?.city}
                  </p>
                  {p.description && <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>}
                  {p.included_services?.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {p.included_services.map((s: string) => (
                        <li key={s} className="text-[11px] text-muted-foreground">• {s}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{formatMoney(p.price)}</span>
                    {salon?.slug && (
                      <Link
                        to="/salons/$slug"
                        params={{ slug: salon.slug }}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                      >
                        Book package
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
