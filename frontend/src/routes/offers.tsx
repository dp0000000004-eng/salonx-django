import { createFileRoute, Link } from "@tanstack/react-router";
import { Percent, Tag } from "lucide-react";
import { PageShell } from "@/components/salonx/PageShell";
import { EmptyState, LoadingGrid } from "@/components/salonx/EmptyState";
import { useRealtime } from "@/lib/realtime";
import { formatMoney, useOffers } from "@/lib/queries";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "Salon Offers & Discount Coupons — SalonX" },
      {
        name: "description",
        content:
          "Live discount coupons and salon offers you can apply to your next SalonX booking.",
      },
      { property: "og:title", content: "Salon Offers & Discount Coupons — SalonX" },
      { property: "og:description", content: "Live salon offers and coupon codes on SalonX." },
    ],
  }),
  component: OffersPage,
});

function OffersPage() {
  const offers = useOffers();
  useRealtime(["coupons"], [["offers"]]);
  const rows = offers.data ?? [];

  return (
    <PageShell title="Offers" subtitle="Live coupons published by SalonX and partner salons.">
      {offers.isLoading ? (
        <LoadingGrid count={6} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="No active offers"
          description="New coupons and seasonal discounts will appear here as soon as they go live."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((o) => (
            <article key={o.id} className="salonx-card overflow-hidden">
              {o.banner_url && (
                <img
                  src={o.banner_url}
                  alt={o.code}
                  loading="lazy"
                  className="h-32 w-full object-cover"
                />
              )}
              <div className="p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Tag className="size-5" />
                </span>
                <p className="mt-3 text-xs font-medium text-muted-foreground">
                  Offer from {o.salon.name}
                </p>
                <h2 className="mt-3 text-lg font-bold text-foreground">
                  {o.discount_type === "percent"
                    ? `${o.discount_value}% off`
                    : `${formatMoney(o.discount_value)} off`}
                </h2>
                {o.title && <p className="mt-1 text-sm font-semibold text-foreground">{o.title}</p>}
                {o.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{o.description}</p>
                )}
                <p className="mt-3 inline-block rounded-md border border-dashed border-primary px-3 py-1.5 text-xs font-semibold tracking-wide text-primary">
                  {o.code}
                </p>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {o.min_amount > 0 && `Min spend ${formatMoney(o.min_amount)}. `}
                  {o.max_discount && `Max ${formatMoney(o.max_discount)}. `}
                  {o.expires_at &&
                    `Valid until ${new Date(o.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`}
                </p>
                <Link
                  to="/salons/$slug"
                  params={{ slug: o.salon.slug }}
                  className="mt-4 inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  Book at {o.salon.name}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
