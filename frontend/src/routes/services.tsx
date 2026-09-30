import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Scissors } from "lucide-react";
import { PageShell } from "@/components/salonx/PageShell";
import { EmptyState, LoadingGrid } from "@/components/salonx/EmptyState";
import { useRealtime } from "@/lib/realtime";
import { formatMoney, usePlatformServices, useServiceCategories } from "@/lib/queries";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Salon Services & Live Prices — SalonX" },
      { name: "description", content: "Compare haircuts, beard styling, spa, facials, colouring and more with live starting prices from salons near you." },
      { property: "og:title", content: "Salon Services & Live Prices — SalonX" },
      { property: "og:description", content: "Compare salon services and prices from real listings." },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const [category, setCategory] = useState("");
  const categories = useServiceCategories();
  const services = usePlatformServices();

  useRealtime(["services", "service_categories", "salons"], [["platform_services"], ["service_categories"]]);

  const rows = (services.data ?? []).filter(
    (s) => !category || s.category.toLowerCase() === category.toLowerCase(),
  );

  return (
    <PageShell title="Services" subtitle="Every price here comes straight from a live salon listing.">
      {(categories.data ?? []).length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setCategory("")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              category === "" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"
            }`}
          >
            All
          </button>
          {(categories.data ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.slug)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                category === c.slug ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {services.isLoading ? (
        <LoadingGrid count={6} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="No services listed yet"
          description="Once salons publish their menus, every service and price will show up here automatically."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => (
            <article key={s.name} className="salonx-card p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Scissors className="size-5" />
              </span>
              <h2 className="mt-3 text-sm font-semibold text-foreground">{s.name}</h2>
              <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="size-3" /> {s.duration} min · {s.salons} {s.salons === 1 ? "salon" : "salons"}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">from {formatMoney(s.from)}</span>
                <Link
                  to="/salons"
                  search={{ q: "", city: "", service: s.name, category: "" }}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
                >
                  View salons
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
