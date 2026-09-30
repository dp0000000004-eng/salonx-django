import { SupportCenter } from "@/components/salonx/SupportCenter";
import { LifeBuoy } from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CalendarDays, Camera, Gift, Heart, Loader2, Star, Store, User } from "lucide-react";
import { PageShell } from "@/components/salonx/PageShell";
import { EmptyState } from "@/components/salonx/EmptyState";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { deleteAvatar, resolveAvatarUrl, uploadAvatar, validateImage } from "@/lib/media";
import {
  formatMoney,
  formatTime,
  useMyBookings,
  useMyFavorites,
  useNotifications,
} from "@/lib/queries";
import { useMyLoyaltyAccounts, useMyLoyaltyTransactions } from "@/lib/loyalty";

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Account — SalonX" },
      {
        name: "description",
        content: "View your salon appointments, saved salons and notifications in one place.",
      },
      { property: "og:title", content: "My Account — SalonX" },
      {
        property: "og:description",
        content: "Your SalonX bookings, favourites and notifications.",
      },
    ],
  }),
  component: AccountPage,
});

const TABS = [
  { key: "bookings", label: "My Bookings", icon: CalendarDays },
  { key: "favorites", label: "Favourites", icon: Heart },
  { key: "loyalty", label: "Loyalty Points", icon: Gift },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "support", label: "Support", icon: LifeBuoy },
  { key: "profile", label: "Profile", icon: User },
] as const;

function AccountPage() {
  const navigate = useNavigate();
  const { user, profile, loading, refresh } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("bookings");

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const queryClient = useQueryClient();
  const bookings = useMyBookings(user?.id);
  const favorites = useMyFavorites(user?.id);
  const notifications = useNotifications(user?.id);

  useRealtime(
    ["bookings"],
    [["my_bookings", user?.id]],
    user ? `customer_id=eq.${user.id}` : undefined,
  );
  useRealtime(
    ["notifications"],
    [["notifications", user?.id]],
    user ? `user_id=eq.${user.id}` : undefined,
  );
  useRealtime(["favorites"], [["favorites", user?.id]], user ? `user_id=eq.${user.id}` : undefined);

  async function cancelBooking(id: string) {
    const { error } = await api
      .from("bookings")
      .update({ status: "cancelled", cancellation_reason: "Cancelled by customer" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Booking cancelled");
      void queryClient.invalidateQueries({ queryKey: ["my_bookings", user?.id] });
    }
  }

  async function markAllRead() {
    if (!user) return;
    await api
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    void queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
  }

  if (loading || !user) {
    return <PageShell title="My Account" subtitle="Loading your account…" />;
  }

  return (
    <PageShell
      title={`Hi, ${profile?.full_name || "there"}`}
      subtitle="Manage your appointments, saved salons and alerts."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-primary"
            }`}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "bookings" && (
        <div className="space-y-3">
          {bookings.isLoading ? (
            <SkeletonRows />
          ) : (bookings.data ?? []).length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No bookings yet"
              description="Once you book an appointment it will appear here with live status updates."
              action={
                <Link
                  to="/salons"
                  search={{ q: "", city: "", service: "", category: "" }}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                >
                  Browse salons
                </Link>
              }
            />
          ) : (
            (bookings.data ?? []).map((b) => {
              const item =
                (b.services as { name: string } | null)?.name ??
                (b.hairstyles as { name: string } | null)?.name ??
                (b.wedding_packages as { name: string } | null)?.name ??
                "Appointment";
              const salon = b.salons as { name: string; city: string; slug: string | null } | null;
              return (
                <article key={b.id} className="salonx-card flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-[180px] flex-1">
                    <h3 className="text-sm font-semibold text-foreground">{item}</h3>
                    <p className="text-xs text-muted-foreground">
                      {salon?.name} · {salon?.city}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(`${b.booking_date}T00:00:00`).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {" · "}
                    {formatTime(b.slot_time)}
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {formatMoney(b.amount)}
                  </span>
                  <StatusPill status={b.status} />
                  {["pending", "confirmed"].includes(b.status) && (
                    <button
                      onClick={() => cancelBooking(b.id)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
                    >
                      Cancel
                    </button>
                  )}
                  {b.status === "completed" && salon?.slug && (
                    <Link
                      to="/salons/$slug"
                      params={{ slug: salon.slug }}
                      className="flex items-center gap-1 rounded-md bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary"
                    >
                      <Star className="size-3" /> Review
                    </Link>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {tab === "favorites" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(favorites.data ?? []).length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState
                icon={Heart}
                title="No saved salons"
                description="Tap the heart on any salon to keep it here for quick booking."
              />
            </div>
          ) : (
            (favorites.data ?? []).map((f) => {
              const s = f.salons as {
                id: string;
                name: string;
                slug: string | null;
                city: string;
                area: string | null;
                rating: number;
                review_count: number;
                starting_price: number;
                image_url: string | null;
                status: string;
              } | null;
              if (!s) return null;
              return (
                <article key={f.salon_id} className="salonx-card overflow-hidden">
                  {s.image_url && (
                    <img
                      src={s.image_url}
                      alt={s.name}
                      loading="lazy"
                      className="h-32 w-full object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {[s.area, s.city].filter(Boolean).join(", ")}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {s.review_count > 0
                          ? `★ ${s.rating} (${s.review_count})`
                          : "No reviews yet"}
                      </span>
                      {s.slug && (
                        <Link
                          to="/salons/$slug"
                          params={{ slug: s.slug }}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                        >
                          Book
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {tab === "loyalty" && <LoyaltyPanel userId={user.id} />}

      {tab === "notifications" && (
        <div className="space-y-3">
          {(notifications.data ?? []).length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications"
              description="Booking confirmations and salon updates will show up here."
            />
          ) : (
            <>
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all as read
              </button>
              {(notifications.data ?? []).map((n) => (
                <article
                  key={n.id}
                  className={`salonx-card p-4 ${n.is_read ? "" : "border-l-4 border-l-primary"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Bell className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{n.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </article>
              ))}
            </>
          )}
        </div>
      )}

      {tab === "support" && <SupportCenter userId={user.id} />}
      {tab === "profile" && <ProfilePanel onSaved={refresh} />}
    </PageShell>
  );
}

function LoyaltyPanel({ userId }: { userId: string }) {
  const accounts = useMyLoyaltyAccounts(userId);
  const [salonId, setSalonId] = useState<string | undefined>(undefined);
  const history = useMyLoyaltyTransactions(userId, salonId);

  useRealtime(["loyalty_accounts"], [["loyalty_accounts", userId]], `customer_id=eq.${userId}`);
  useRealtime(
    ["loyalty_transactions"],
    [["loyalty_transactions", userId, salonId ?? "all"]],
    `customer_id=eq.${userId}`,
  );

  if (accounts.isLoading) return <SkeletonRows />;
  if (accounts.error)
    return (
      <div className="salonx-card p-6 text-center">
        <p className="text-sm text-foreground">We couldn’t load your points just now.</p>
        <button
          onClick={() => void accounts.refetch()}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    );

  const rows = accounts.data ?? [];
  if (rows.length === 0)
    return (
      <EmptyState
        icon={Gift}
        title="No loyalty points yet"
        description="You earn points at a salon once that salon confirms your payment. Points stay with the salon that gave them."
      />
    );

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Points are held separately by each salon and can only be used at the salon that gave them.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((a) => {
          const logo = a.salons?.logo_url ?? a.salons?.image_url ?? null;
          const active = salonId === a.salon_id;
          return (
            <article key={a.id} className={`salonx-card p-4 ${active ? "border-primary" : ""}`}>
              <div className="flex items-center gap-3">
                {logo ? (
                  <img
                    src={logo}
                    alt={a.salons?.name ?? "Salon"}
                    loading="lazy"
                    className="size-10 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Store className="size-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {a.salons?.name ?? "Salon"}
                  </h3>
                  <p className="text-xs text-muted-foreground">{a.salons?.city}</p>
                </div>
              </div>
              <p className="mt-4 text-2xl font-semibold text-foreground">{a.balance}</p>
              <p className="text-[11px] text-muted-foreground">points available here</p>
              <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
                <span>Earned {a.total_earned}</span>
                <span>Redeemed {a.total_redeemed}</span>
              </div>
              <button
                onClick={() => setSalonId(active ? undefined : a.salon_id)}
                className="mt-3 text-[11px] font-medium text-primary hover:underline"
              >
                {active ? "Show all history" : "Show this salon’s history"}
              </button>
            </article>
          );
        })}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          {salonId ? "History at this salon" : "Points history"}
        </h3>
        {history.isLoading ? (
          <SkeletonRows />
        ) : (history.data ?? []).length === 0 ? (
          <EmptyState
            icon={Gift}
            title="Nothing here yet"
            description="Earned and used points will be listed here."
          />
        ) : (
          <div className="space-y-2">
            {(history.data ?? []).map((t) => {
              const salon = rows.find((r) => r.salon_id === t.salon_id)?.salons?.name ?? "Salon";
              const earned = t.points > 0;
              return (
                <article key={t.id} className="salonx-card flex flex-wrap items-center gap-3 p-3.5">
                  <div className="min-w-[160px] flex-1">
                    <p className="text-xs font-semibold text-foreground">
                      {earned ? "Points earned" : "Points used"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {salon}
                      {t.reason ? ` · ${t.reason}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-medium ${earned ? "text-success" : "text-foreground"}`}
                  >
                    {earned ? `+${t.points}` : t.points}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfilePanel({ onSaved }: { onSaved: () => Promise<void> }) {
  const { user, profile, isOwner } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_url ?? null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setAvatarPath(profile?.avatar_url ?? null);
  }, [profile]);

  useEffect(() => {
    let active = true;
    void resolveAvatarUrl(avatarPath).then((u) => {
      if (active) setAvatarUrl(u);
    });
    return () => {
      active = false;
    };
  }, [avatarPath]);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const invalid = validateImage(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setUploading(true);
    try {
      const previous = avatarPath;
      const path = await uploadAvatar(user.id, file);
      const { error } = await api.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      if (error) throw error;
      if (previous) await deleteAvatar(previous);
      setAvatarPath(path);
      toast.success("Profile photo updated");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload that photo.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    if (!user || !avatarPath) return;
    setUploading(true);
    try {
      const { error } = await api.from("profiles").update({ avatar_url: null }).eq("id", user.id);
      if (error) throw error;
      await deleteAvatar(avatarPath);
      setAvatarPath(null);
      setAvatarUrl(null);
      toast.success("Profile photo removed");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove that photo.");
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    setBusy(true);
    const { error } = await api
      .from("profiles")
      .update({ full_name: name.trim(), phone })
      .eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated");
      await onSaved();
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={save} className="salonx-card space-y-5 p-6">
        <h2 className="text-sm font-semibold text-foreground">Personal details</h2>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name || "Profile photo"}
                className="size-full object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-muted-foreground">
                <User className="size-7" />
              </span>
            )}
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="size-5 animate-spin text-primary" />
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:border-primary hover:text-primary disabled:opacity-60"
            >
              <Camera className="size-4" /> {avatarPath ? "Change photo" : "Upload photo"}
            </button>
            {avatarPath && (
              <button
                type="button"
                disabled={uploading}
                onClick={removePhoto}
                className="rounded-lg border border-border px-3.5 py-2 text-xs text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-60"
              >
                Remove
              </button>
            )}
            <p className="w-full text-[11px] text-muted-foreground">
              JPG, PNG, WebP or AVIF · up to 5 MB
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">Full name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground">Mobile number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground">Email</label>
          <input
            value={user?.email ?? ""}
            disabled
            className="mt-1 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
          />
          <div className="mt-2">
            <span className="text-[11px] text-muted-foreground">
              Email verification is not required for this account.
            </span>
          </div>
        </div>
        <button
          disabled={busy}
          className="rounded-lg bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>

      {!isOwner && (
        <div className="salonx-card p-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Store className="size-5" />
          </span>
          <h2 className="mt-3 text-sm font-semibold text-foreground">Own a salon?</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Book a demo and our team will help you get listed on SalonX with bookings, services and
            offers.
          </p>
          <Link
            to="/book-demo"
            className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground"
          >
            Book a demo
          </Link>
        </div>
      )}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    pending: "bg-warning/20 text-warning",
    confirmed: "bg-info/15 text-info",
    completed: "bg-success/15 text-success",
    cancelled: "bg-destructive/15 text-destructive",
    no_show: "bg-muted text-muted-foreground",
    in_progress: "bg-primary-soft text-primary",
  };
  return (
    <span
      className={`rounded-md px-2 py-1 text-[10px] font-medium capitalize ${tones[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="salonx-card h-20 animate-pulse bg-muted/40" />
      ))}
    </>
  );
}
