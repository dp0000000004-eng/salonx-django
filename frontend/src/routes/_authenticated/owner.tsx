import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Crown,
  LayoutDashboard,
  ListChecks,
  Percent,
  Scissors,
  Settings,
  Sparkles,
  CreditCard,
  Armchair,
  Gift,

  Star,
  Store,
  Users,
  
  Wallet,
  ExternalLink,
} from "lucide-react";
import { DashboardShell } from "@/components/salonx/DashboardShell";
import { ErrorNote, Loading, useOwnerRealtime } from "@/components/owner/shared";
import { OwnerDashboardHome } from "@/components/owner/OwnerDashboardHome";
import { OwnerAppointments } from "@/components/owner/OwnerAppointments";
import { OwnerCalendar } from "@/components/owner/OwnerCalendar";
import { OwnerCustomers } from "@/components/owner/OwnerCustomers";
import { OwnerServices } from "@/components/owner/OwnerServices";
import { OwnerHairstyles } from "@/components/owner/OwnerHairstyles";
import { OwnerPackages } from "@/components/owner/OwnerPackages";
import { OwnerReviews } from "@/components/owner/OwnerReviews";
import { OwnerPayments } from "@/components/owner/OwnerPayments";
import { OwnerOffers } from "@/components/owner/OwnerOffers";
import { OwnerNotifications } from "@/components/owner/OwnerNotifications";
import { OwnerReports } from "@/components/owner/OwnerReports";
import { OwnerProfile } from "@/components/owner/OwnerProfile";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { useMySalon, useNotifications, type SalonRow } from "@/lib/queries";
import { OwnerSubscription } from "@/components/owner/OwnerSubscription";
import { SupportCenter } from "@/components/salonx/SupportCenter";
import { LifeBuoy } from "lucide-react";
import { OwnerBookingSettings } from "@/components/owner/OwnerBookingSettings";
import { OwnerLoyaltySettings } from "@/components/owner/OwnerLoyaltySettings";
import { isUnlocked, subState, useSalonSubscription } from "@/lib/subscription";


export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "Salon Owner Dashboard — SalonX" },
      { name: "description", content: "Manage appointments, services, payouts and analytics for your salon on SalonX." },
      { property: "og:title", content: "Salon Owner Dashboard — SalonX" },
      { property: "og:description", content: "Appointments, services, payouts and analytics in one dashboard." },
    ],
  }),
  component: OwnerDashboard,
});

const nav = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Appointments", icon: ListChecks },
  { label: "Calendar", icon: CalendarDays },
  { label: "Customers", icon: Users },
  { label: "Services", icon: Scissors },
  { label: "Hairstyles", icon: Sparkles },
  { label: "Wedding Packages", icon: Crown },
  { label: "Reviews & Ratings", icon: Star },
  { label: "Payment History", icon: Wallet },
  { label: "Offers & Discounts", icon: Percent },
  { label: "Notifications", icon: Bell },
  { label: "Reports & Analytics", icon: BarChart3 },
  { label: "Settings", icon: Settings },
  { label: "Subscription", icon: CreditCard },
  { label: "Support", icon: LifeBuoy },
];

const SUBTITLES = [
  "Here's what's happening with your salon today.",
  "Approve, reschedule or complete bookings.",
  "Your day-by-day schedule at a glance.",
  "Everyone who has booked with you.",
  "Your service menu, prices and durations.",
  "Choose which SalonX hairstyles you offer, and set your price.",
  "Bridal and groom packages you offer.",
  "What customers are saying about you.",
  "Earnings, commission and settlements.",
  "Discount codes for your customers.",
  "Everything that needs your attention.",
  "Performance over any date range.",
  "Salon profile, opening hours and booking settings.",
  "Your SalonX plan, trial and renewal.",
  "Raise and track support tickets with SalonX.",
];

function OwnerDashboard() {
  const { user, profile, isOwner, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const salonQuery = useMySalon(user?.id);
  const notifications = useNotifications(user?.id);
  const [active, setActive] = useState(0);

  const salon = salonQuery.data ?? null;
  useOwnerRealtime(salon?.id, user?.id);

  const unread = (notifications.data ?? []).filter((n) => !n.is_read).length;

  return (
    <DashboardShell
      brandSubtitle="Owner Dashboard"
      nav={nav}
      activeIndex={active}
      onNavigate={setActive}
      title={salon ? `Welcome back, ${salon.name}` : "Owner Dashboard"}
      subtitle={SUBTITLES[active] ?? ""}
      account={{ name: salon?.name ?? profile?.full_name ?? "Salon Owner", role: "Owner" }}
      notificationCount={unread}
      onSignOut={() => {
        void (async () => {
          await signOut();
          void navigate({ to: "/auth", replace: true });
        })();
      }}
      promo={{ title: "Grow faster", desc: "Keep your profile, services and offers fresh to win more bookings.", cta: "Open profile" }}
      headerRight={
        salon?.slug ? (
          <Link
            to="/salons/$slug"
            params={{ slug: salon.slug }}
            className="hidden items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 md:flex"
          >
            View Public Profile <ExternalLink className="size-3.5" />
          </Link>
        ) : null
      }
    >
      <Body
        active={active}
        salon={salon}
        loading={salonQuery.isLoading}
        error={salonQuery.error}
        retry={() => void salonQuery.refetch()}
        allowed={isOwner || isAdmin}
        userId={user?.id}
        onOpenSubscription={() => setActive(13)}
      />
    </DashboardShell>
  );
}

function Body({
  active,
  salon,
  loading,
  error,
  retry,
  allowed,
  userId,
  onOpenSubscription,
}: {
  active: number;
  salon: SalonRow | null;
  loading: boolean;
  error: unknown;
  retry: () => void;
  allowed: boolean;
  userId: string | undefined;
  onOpenSubscription: () => void;
}) {
  if (active === 10) return userId ? <OwnerNotifications userId={userId} /> : <Loading />;
  if (active === 14) return userId ? <SupportCenter userId={userId} salonId={salon?.id ?? null} /> : <Loading />;
  if (loading) return <Loading label="Loading your salon…" />;
  if (error) return <ErrorNote error={error} onRetry={retry} />;

  if (!allowed)
    return (
      <div className="salonx-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Owner access required</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          This dashboard is only available to salon owners. Book a demo to get started.
        </p>
        <Link to="/book-demo" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
          Book a demo
        </Link>
      </div>
    );

  if (!salon)
    return (
      <div className="salonx-card p-6">
        <h2 className="text-sm font-semibold text-foreground">No salon yet</h2>
        <p className="mt-1 text-xs text-muted-foreground">Once your demo request is submitted, your salon data appears here.</p>
        <Link to="/book-demo" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
          Book a demo
        </Link>
      </div>
    );

  if (salon.status !== "approved" || !salon.is_active) {
    return <SalonStatusNotice salon={salon} />;
  }

  return (
    <div className="space-y-4">
      <ExpiryBanner salonId={salon.id} active={active} onOpenSubscription={onOpenSubscription} />
      <Section active={active} salon={salon} />
    </div>
  );
}

function ExpiryBanner({ salonId, active, onOpenSubscription }: { salonId: string; active: number; onOpenSubscription: () => void }) {
  const sub = useSalonSubscription(salonId);
  if (active === 13 || sub.isPending || sub.isError) return null;
  const state = subState(sub.data);
  if (isUnlocked(state)) return null;
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-foreground">Your SalonX subscription has expired.</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Your existing salon data is safe. Renew your subscription to continue using SalonX's business features.
      </p>
      <button onClick={onOpenSubscription} className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
        Renew Subscription
      </button>
    </div>
  );
}

function Section({ active, salon }: { active: number; salon: SalonRow }) {
  switch (active) {
    case 0:
      return <OwnerDashboardHome salonId={salon.id} rating={salon.rating} reviewCount={salon.review_count} />;
    case 1:
      return <OwnerAppointments salonId={salon.id} />;
    case 2:
      return <OwnerCalendar salonId={salon.id} />;
    case 3:
      return <OwnerCustomers salonId={salon.id} />;
    case 4:
      return <OwnerServices salonId={salon.id} />;
    case 5:
      return <OwnerHairstyles salonId={salon.id} />;
    case 6:
      return <OwnerPackages salonId={salon.id} />;
    case 7:
      return <OwnerReviews salonId={salon.id} />;
    case 8:
      return <OwnerPayments salonId={salon.id} />;
    case 9:
      return <OwnerOffers salonId={salon.id} />;
    case 11:
      return <OwnerReports salonId={salon.id} />;
    case 12:
      return <OwnerSettings salon={salon} />;
    case 13:
      return <OwnerSubscription salonId={salon.id} />;
    default:
      return <OwnerDashboardHome salonId={salon.id} rating={salon.rating} reviewCount={salon.review_count} />;
  }
}

function SalonStatusNotice({ salon }: { salon: SalonRow }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const status = salon.status;

  const copy =
    status === "pending"
      ? { title: "Your salon is waiting for approval.", desc: "Our team is reviewing your application. You'll be notified as soon as it's approved." }
      : status === "rejected"
        ? { title: "Your salon application was rejected.", desc: salon.rejection_reason || "Please review your details and resubmit." }
        : { title: "Your salon account has been suspended.", desc: "Contact SalonX support to restore your account." };

  async function resubmit() {
    setBusy(true);
    const { error } = await api.rpc("owner_resubmit_salon", { _salon_id: salon.id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Application resubmitted for approval.");
    window.location.reload();
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <button onClick={() => setEditing(false)} className="text-xs font-medium text-primary hover:underline">
          ← Back to status
        </button>
        <OwnerProfile salon={salon} />
        {status === "rejected" && (
          <button
            disabled={busy}
            onClick={() => void resubmit()}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Submitting…" : "Resubmit for approval"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="salonx-card mx-auto max-w-lg p-7 text-center">
      <h2 className="text-base font-semibold text-foreground">{copy.title}</h2>
      <p className="mt-2 text-xs text-muted-foreground">{copy.desc}</p>
      {status === "rejected" && (
        <button
          onClick={() => setEditing(true)}
          className="mt-5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
        >
          Update Details & Resubmit
        </button>
      )}
    </div>
  );
}


const SETTINGS_TABS = [
  { key: "profile", label: "Salon Profile", icon: Store },
  { key: "booking", label: "Booking Settings", icon: Armchair },
  { key: "loyalty", label: "Loyalty & Rewards", icon: Gift },
] as const;

function OwnerSettings({ salon }: { salon: SalonRow }) {
  const [tab, setTab] = useState<(typeof SETTINGS_TABS)[number]["key"]>("profile");
  return (
    <div className="min-w-0 space-y-4">
      <div role="tablist" aria-label="Settings sections" className="flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 sm:w-fit">
        {SETTINGS_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`sx-tap flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium transition-colors sm:flex-none ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === "profile" ? (
        <OwnerProfile salon={salon} />
      ) : tab === "booking" ? (
        <OwnerBookingSettings salonId={salon.id} />
      ) : (
        <OwnerLoyaltySettings salonId={salon.id} />
      )}
    </div>
  );
}

