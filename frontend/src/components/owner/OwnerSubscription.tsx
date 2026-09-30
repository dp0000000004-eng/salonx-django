import { useAuth } from "@/lib/auth";
import { createTicket } from "@/components/salonx/SupportCenter";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { ErrorNote, Loading } from "@/components/owner/shared";
import { daysLeft, isUnlocked, subState, useActivePlan, useSalonSubscription, useSubscriptionHistory } from "@/lib/subscription";

const FEATURES = [
  "Salon Management", "Unlimited Services", "Hairstyles", "Customer Management", "Dynamic Booking",
  "Chair/Resource Availability", "Booking Management", "Salon Profile", "Booking Settings", "Search",
  "Near Me", "Featured/Trending Content", "Wedding Packages", "Notifications", "Support", "Analytics",
  "Subscription Management",
];

const inr = (v: number) => "₹" + Math.round(v ?? 0).toLocaleString("en-IN");
const dateLabel = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function OwnerSubscription({ salonId }: { salonId: string }) {
  const plan = useActivePlan();
  const sub = useSalonSubscription(salonId);
  const history = useSubscriptionHistory(salonId);
  const { user } = useAuth();

  if (sub.isPending || plan.isPending) return <Loading label="Loading your subscription…" />;
  if (sub.isError) return <ErrorNote error={sub.error} onRetry={() => void sub.refetch()} />;

  const state = subState(sub.data);
  const unlocked = isUnlocked(state);
  const p = plan.data;
  const trialDays = daysLeft(sub.data?.trial_end_date);
  const trialLabel =
    state === "none"
      ? `${p?.trial_days ?? 14} Days Free Trial available`
      : state === "trialing"
        ? trialDays <= 3
          ? `Trial ending soon — ${trialDays} days left`
          : `Free Trial — ${trialDays} days remaining`
        : state === "active"
          ? `Active — ${daysLeft(sub.data?.expires_at)} days remaining`
          : sub.data?.trial_end_date && state === "expired" && !sub.data?.started_at
            ? "Trial expired"
            : state === "expired"
              ? "Expired"
              : state;

  // Display-only until online subscription payments are connected.
  function subscribeSoon() {
    toast.info("Online subscription will be available soon. Use Contact Admin for help meanwhile.");
  }

  async function contactAdmin() {
    if (!user) return;
    try {
      await createTicket({
        userId: user.id,
        salonId,
        category: "renewal",
        priority: unlocked ? "medium" : "high",
        subject: "Subscription help request",
        message: `Please renew my SalonX subscription. Current status: ${state}. Expiry: ${dateLabel(sub.data?.expires_at)}.`,
      });
      toast.success("Message sent to SalonX. You can follow it under Support.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {!unlocked && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
          <h2 className="text-sm font-semibold text-foreground">Subscription Expired</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your SalonX subscription has expired. Renew your subscription to continue using subscription-protected business features.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={subscribeSoon} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              Renew Subscription
            </button>
            <button onClick={contactAdmin} className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted">
              Contact Admin
            </button>
          </div>
        </div>
      )}

      <div className="salonx-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CreditCard className="size-4 text-primary" /> {p?.name ?? "All-in-One Unlimited"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Everything SalonX offers, with no limits.</p>
            <span className="mt-2 inline-block rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
              {trialLabel}
            </span>
          </div>
          <p className="text-lg font-semibold text-foreground">
            {inr(p?.price ?? 0)} <span className="text-xs font-normal text-muted-foreground">/ {p?.billing_cycle ?? "monthly"}</span>
          </p>
        </div>

        <ul className="mt-4 grid gap-1 text-xs text-foreground sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f}>• {f}</li>
          ))}
        </ul>

        <div className="mt-5 grid gap-3 border-t border-border pt-4 text-xs sm:grid-cols-3">
          <Item label="Subscription status" value={state === "none" ? "not started" : state} />
          <Item label="Trial status" value={sub.data?.trial_end_date ? (state === "trialing" ? "active" : "finished") : "not started"} />
          <Item
            label="Trial days remaining"
            value={state === "trialing" ? `${daysLeft(sub.data?.trial_end_date)} days` : "—"}
          />
          <Item label="Start date" value={dateLabel(sub.data?.started_at)} />
          <Item label="Expiry date" value={dateLabel(sub.data?.expires_at)} />
          <Item label="Days remaining" value={state === "active" ? `${daysLeft(sub.data?.expires_at)} days` : state === "trialing" ? `${trialDays} days` : "—"} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {state === "none" && (
            <button onClick={subscribeSoon} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              Start Free Trial
            </button>
          )}
          {state !== "none" && (
            <button onClick={subscribeSoon} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              Renew Subscription
            </button>
          )}
          <button onClick={contactAdmin} className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted">
            Contact Admin
          </button>
        </div>
      </div>

      <div className="salonx-card p-6">
        <h3 className="text-sm font-semibold text-foreground">Subscription history</h3>
        {history.isPending ? (
          <Loading label="Loading history…" />
        ) : (history.data ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No subscription changes yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs">
            {(history.data ?? []).map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
                <span className="capitalize text-foreground">
                  {h.status} — {h.note}
                </span>
                <span className="text-muted-foreground">{dateLabel(h.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm capitalize text-foreground">{value}</p>
    </div>
  );
}
