import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/salonx/PageShell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About SalonX — India's Salon Booking Marketplace" },
      { name: "description", content: "SalonX connects customers with verified salons across India for discovery, hairstyle inspiration and instant booking." },
      { property: "og:title", content: "About SalonX — India's Salon Booking Marketplace" },
      { property: "og:description", content: "SalonX connects customers with verified salons across India." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PageShell title="About Us" subtitle="Book. Style. Shine.">
      <div className="salonx-card max-w-3xl space-y-4 p-8 text-sm leading-relaxed text-muted-foreground">
        <p>
          SalonX is an India-wide salon discovery and appointment booking marketplace. We help customers find verified
          salons by city, area or PIN code, explore trending hairstyles, and book a slot in seconds.
        </p>
        <p>
          For salon owners, SalonX is a complete business platform: appointments, calendar, staff, services, haircut
          wedding packages, payouts, offers and analytics — all in one dashboard.
        </p>
      </div>
    </PageShell>
  );
}
