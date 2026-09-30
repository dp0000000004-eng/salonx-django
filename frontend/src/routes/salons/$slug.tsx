import { useT } from "@/lib/i18n";
import { isUnlocked, subState, useSalonSubscription } from "@/lib/subscription";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarDays,
  Clock,
  Crown,
  Heart,
  MapPin,
  Phone,
  Scissors,
  Star,
  Store,
  UsersRound,
} from "lucide-react";
import { SiteHeader } from "@/components/salonx/SiteHeader";
import { SiteFooter } from "@/components/salonx/SiteFooter";
import { EmptyState } from "@/components/salonx/EmptyState";
import { StoredImage } from "@/components/salonx/StoredImage";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { endTime, useSalonClosures, useSalonOpenNow } from "@/lib/booking";
import { redeemPoints, useLoyaltyRule, useMyLoyaltyAtSalon } from "@/lib/loyalty";
import {
  formatMoney,
  formatTime,
  toggleSalonFavorite,
  useAvailableSlots,
  useMyFavorites,
  useReviewableBookings,
  useSalonBySlug,
  useSalonHairstyles,
  useSalonHours,
  useSalonReviews,
  useSalonServices,
  useSalonStaff,
  useWeddingPackages,
} from "@/lib/queries";

export const Route = createFileRoute("/salons/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Book at ${prettify(params.slug)} — SalonX` },
      { name: "description", content: `See services, prices, photos and real customer reviews for ${prettify(params.slug)}, and book an appointment online.` },
      { property: "og:title", content: `Book at ${prettify(params.slug)} — SalonX` },
      { property: "og:description", content: `Services, prices, photos and reviews for ${prettify(params.slug)}.` },
    ],
  }),
  component: SalonProfile,
});

function prettify(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Pick = {
  kind: "service" | "hairstyle" | "package";
  id: string;
  name: string;
  price: number;
  duration: number;
};

function SalonProfile() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: salon, isLoading, error, refetch } = useSalonBySlug(slug);
  const salonId = salon?.id;

  const services = useSalonServices(salonId);
  const hairstyles = useSalonHairstyles(salonId);
  const staff = useSalonStaff(salonId);
  const hours = useSalonHours(salonId);
  const reviews = useSalonReviews(salonId);
  const packages = useWeddingPackages(salonId);
  const closures = useSalonClosures(salonId);
  const openNow = useSalonOpenNow(salonId);
  const favorites = useMyFavorites(user?.id);

  const [category, setCategory] = useState<string>("");
  const [selection, setSelection] = useState<Pick | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [usePoints, setUsePoints] = useState(false);
  const [booking, setBooking] = useState(false);

  const slots = useAvailableSlots(salonId, date, selection?.duration ?? 30);
  const salonSub = useSalonSubscription(salonId);
  const t = useT();
  const bookingDisabled = Boolean(salonId) && !salonSub.isPending && !isUnlocked(subState(salonSub.data));

  useRealtime(
    ["services", "hairstyles", "staff", "salon_hours", "wedding_packages", "reviews", "salons", "salon_resources", "salon_closures"],
    [
      ["services", salonId], ["salon_hairstyles", salonId], ["staff", salonId],
      ["salon_hours", salonId], ["wedding_packages", salonId], ["reviews", salonId], ["salon", slug],
      ["salon_resources", salonId], ["salon_closures", salonId], ["salon_open_now", salonId],
    ],
  );
  useRealtime(
    ["bookings", "salon_blocks", "salon_hours", "salon_resources", "salon_closures"],
    [["slots", salonId, date, selection?.duration ?? 30]],
  );

  const isFav = (favorites.data ?? []).some((f) => f.salon_id === salonId);

  const categories = useMemo(() => {
    const list = new Set<string>();
    for (const s of services.data ?? []) list.add(s.category);
    const out = [...list].sort();
    if ((hairstyles.data ?? []).length) out.push("Hairstyles");
    if ((packages.data ?? []).length) out.push("Wedding Packages");
    return out;
  }, [services.data, hairstyles.data, packages.data]);

  useEffect(() => {
    if (!category && categories.length) setCategory(categories[0]!);
  }, [categories, category]);

  const closedDates = useMemo(() => new Set((closures.data ?? []).map((c) => c.closed_date)), [closures.data]);
  const closedWeekdays = useMemo(
    () => new Set((hours.data ?? []).filter((h) => h.is_closed).map((h) => h.weekday)),
    [hours.data],
  );

  const dateOptions = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      }),
    [],
  );

  const items = useMemo(() => {
    if (category === "Hairstyles") {
      return (hairstyles.data ?? [])
        .filter((h) => h.is_bookable !== false)
        .map<Pick & { image: string | null; meta: string }>((h) => ({
          kind: "hairstyle", id: h.id, name: h.name, price: h.price, duration: h.duration_min,
          image: h.image_url, meta: `${h.duration_min} min · ${h.gender}`,
        }));
    }
    if (category === "Wedding Packages") {
      return (packages.data ?? [])
        .filter((p) => (p as { is_bookable?: boolean }).is_bookable !== false)
        .map<Pick & { image: string | null; meta: string }>((p) => ({
          kind: "package", id: p.id, name: p.name, price: p.price, duration: p.duration_min,
          image: p.image_url ?? null, meta: p.description ?? `${p.duration_min} min`,
        }));
    }
    return (services.data ?? [])
      .filter((s) => s.category === category && s.is_bookable !== false)
      .map<Pick & { image: string | null; meta: string }>((s) => ({
        kind: "service", id: s.id, name: s.name, price: s.price, duration: s.duration_min,
        image: s.image_url ?? null, meta: `${s.duration_min} min`,
      }));
  }, [category, services.data, hairstyles.data, packages.data]);

  const loyaltyAccount = useMyLoyaltyAtSalon(user?.id, salonId);
  const loyaltyRule = useLoyaltyRule(salonId);
  const loyaltyBalance = loyaltyAccount.data?.balance ?? 0;
  const minRedeem = loyaltyRule.data?.min_redeem_points ?? 0;
  const pointValue = Number(loyaltyRule.data?.point_value_rupees ?? 0);
  const maxRedeemPercent = Number(loyaltyRule.data?.max_redeem_percent ?? 100);
  const maxDiscount = selection ? Math.floor((selection.price * Math.min(Math.max(maxRedeemPercent, 0), 100)) / 100) : 0;
  const redeemablePoints =
    selection && loyaltyBalance >= minRedeem && minRedeem > 0 && pointValue > 0
      ? Math.min(loyaltyBalance, Math.floor(maxDiscount / pointValue))
      : 0;
  const pointsValue = Math.round(redeemablePoints * pointValue);


  async function toggleFavorite() {
    if (!user || !salonId) {
      toast.error("Sign in to save salons");
      return;
    }
    await toggleSalonFavorite(user.id, salonId, isFav);
    void queryClient.invalidateQueries({ queryKey: ["favorites", user.id] });
  }

  async function confirmBooking() {
    if (!user) {
      toast.error("Please login to book an appointment.");
      void navigate({ to: "/auth" });
      return;
    }
    if (!salonId || !selection || !slot) {
      toast.error("Choose a service and a time");
      return;
    }
    setBooking(true);
    const { data: newBookingId, error: bookingError } = await api.rpc("create_booking", {
      _salon_id: salonId,
      _booking_date: date,
      _slot_time: slot,
      ...(selection.kind === "service" ? { _service_id: selection.id } : {}),
      ...(selection.kind === "hairstyle" ? { _hairstyle_id: selection.id } : {}),
      ...(selection.kind === "package" ? { _package_id: selection.id } : {}),
      ...(notes ? { _notes: notes } : {}),
    });
    setBooking(false);
    void queryClient.invalidateQueries({ queryKey: ["slots", salonId, date] });
    if (bookingError) {
      toast.error(bookingError.message);
      setSlot("");
      return;
    }
    toast.success("Appointment booked successfully.");
    if (usePoints && redeemablePoints > 0 && typeof newBookingId === "string") {
      try {
        await redeemPoints(salonId, redeemablePoints, newBookingId);
        toast.success(`${redeemablePoints} points applied to this appointment.`);
        void queryClient.invalidateQueries({ queryKey: ["loyalty_account", user.id, salonId] });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Points could not be applied to this booking.");
      }
    }
    setSlot("");
    setNotes("");
    setUsePoints(false);
    void navigate({ to: "/account" });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto w-full max-w-6xl px-4 py-20 text-center">
          <p className="text-sm text-foreground">Unable to load this salon. Please try again.</p>
          <button onClick={() => void refetch()} className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
            Retry
          </button>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <EmptyState
            icon={Store}
            title="Salon not found"
            description="This salon may not be listed yet or is awaiting verification."
            action={<Link to="/salons" search={{ q: "", city: "", service: "", category: "" }} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">Browse all salons</Link>}
          />
        </div>
        <SiteFooter />
      </div>
    );
  }

  const todayHours = (hours.data ?? []).find((h) => h.weekday === new Date().getDay());

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Cover + identity */}
      <section className="relative bg-[oklch(0.13_0.02_270)]">
        <div className="absolute inset-0 overflow-hidden">
          <StoredImage path={salon.cover_image_url ?? salon.image_url} alt={`${salon.name} cover`} className="size-full opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.13_0.02_270)] via-[oklch(0.13_0.02_270)/0.55] to-[oklch(0.13_0.02_270)/0.2]" />
        </div>
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:py-12 md:flex-row md:items-end">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <StoredImage
              path={salon.logo_url ?? salon.image_url}
              alt={`${salon.name} logo`}
              fit="contain"
              className="size-14 shrink-0 rounded-xl bg-white/10 p-1 sm:size-20"
              fallback={<Store className="size-6 text-white/70" />}
            />
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight text-white sm:text-3xl">
                <span className="break-words">{salon.name}</span>
                {salon.is_verified && <BadgeCheck className="size-5 text-primary" />}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70 sm:text-sm">
                <span className="flex items-center gap-1">
                  <MapPin className="size-4 shrink-0" />
                  <span className="break-words">{[salon.area, salon.city, salon.pin_code].filter(Boolean).join(", ")}</span>
                </span>
                {salon.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-4" />
                    {salon.phone}
                  </span>
                )}
                {salon.review_count > 0 ? (
                  <span className="flex items-center gap-1">
                    <Star className="size-4 fill-warning text-warning" />
                    {salon.rating} ({salon.review_count})
                  </span>
                ) : (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">New Salon</span>
                )}
                {!openNow.isPending && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${openNow.data ? "bg-success/20 text-success" : "bg-white/10 text-white/70"}`}>
                    {openNow.data ? "Open now" : "Closed"}
                  </span>
                )}
              </p>
              {todayHours && !todayHours.is_closed && (
                <p className="mt-1 text-[11px] text-white/55">
                  Today {formatTime(todayHours.open_time)} – {formatTime(todayHours.close_time)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => void toggleFavorite()}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm md:w-auto ${
              isFav ? "text-destructive" : "text-white/85 hover:bg-white/5"
            }`}
          >
            <Heart className={`size-4 ${isFav ? "fill-current" : ""}`} /> {isFav ? "Saved" : "Save"}
          </button>
        </div>
      </section>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* Booking step 1 + 2 */}
          <Section title="Choose a service" icon={Scissors}>
            {services.isLoading || hairstyles.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading services…</p>
            ) : services.error ? (
              <Retry label="Unable to load services. Please try again." onRetry={() => void services.refetch()} />
            ) : categories.length === 0 ? (
              <EmptyState compact icon={Scissors} title="No services available" description="This salon hasn't published a service menu yet." />
            ) : (
              <>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCategory(c); setSelection(null); setSlot(""); }}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                        category === c ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {c === "Wedding Packages" ? <span className="flex items-center gap-1"><Crown className="size-3.5" /> {c}</span> : c}
                    </button>
                  ))}
                </div>

                {items.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState compact icon={Scissors} title="Nothing bookable here yet" description="Pick another category to see what's available." />
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {items.map((item) => (
                      <PickRow
                        key={item.id}
                        title={item.name}
                        meta={item.meta}
                        price={item.price}
                        image={item.image}
                        active={selection?.kind === item.kind && selection.id === item.id}
                        onSelect={() => {
                          setSelection({ kind: item.kind, id: item.id, name: item.name, price: item.price, duration: item.duration });
                          setSlot("");
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </Section>


          <Section title="Reviews" icon={Star}>
            {reviews.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading reviews…</p>
            ) : reviews.error ? (
              <Retry label="Unable to load reviews. Please try again." onRetry={() => void reviews.refetch()} />
            ) : (reviews.data ?? []).length === 0 ? (
              <EmptyState compact icon={Star} title="No reviews yet" description="Be the first to review after your appointment." />
            ) : (
              <ul className="space-y-4">
                {(reviews.data ?? []).map((r) => (
                  <li key={r.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex">
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star key={i} className="size-3.5 fill-warning text-warning" />
                        ))}
                      </span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    {r.comment && <p className="mt-2 text-xs text-foreground">{r.comment}</p>}
                    {r.owner_reply && (
                      <p className="mt-2 rounded-lg bg-muted p-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">Salon reply:</span> {r.owner_reply}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {user ? (
              <ReviewForm salonId={salon.id} />
            ) : (
              <p className="mt-4 rounded-xl border border-border p-4 text-xs text-muted-foreground">
                <Link to="/auth" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>{" "}
                to review a salon after your appointment is completed.
              </p>
            )}
          </Section>
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:h-fit">
          <div className="salonx-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarDays className="size-4 text-primary" /> {t("booking.bookNow")}
            </h2>

            <p className="mt-4 text-xs font-medium text-foreground">Selected</p>
            <p className="mt-1 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {selection
                ? `${selection.name} · ${formatMoney(selection.price)} · ${selection.duration} min`
                : "Pick a service, hairstyle or package"}
            </p>

            <p className="mt-4 text-xs font-medium text-foreground">Date</p>
            <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
              {dateOptions.map((d) => {
                const dt = new Date(`${d}T00:00:00`);
                const closed = closedDates.has(d) || closedWeekdays.has(dt.getDay());
                return (
                  <button
                    key={d}
                    disabled={closed}
                    onClick={() => { setDate(d); setSlot(""); }}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-center text-[11px] disabled:opacity-40 ${
                      date === d ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    <span className="block font-medium">{dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    <span className="block">{closed ? "Closed" : dt.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-xs font-medium text-foreground">Time</p>
            {!selection ? (
              <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Choose a service first — times depend on how long it takes.
              </p>
            ) : slots.isLoading ? (
              <p className="mt-2 text-xs text-muted-foreground">Checking availability…</p>
            ) : slots.error ? (
              <Retry label="Unable to load availability. Please try again." onRetry={() => void slots.refetch()} />
            ) : (slots.data ?? []).length === 0 ? (
              <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                No available times for this date.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
                {(slots.data ?? []).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={`rounded-lg border px-2 py-2 text-[11px] ${
                      slot === s ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {formatTime(s)}
                  </button>
                ))}
              </div>
            )}

            {selection && slot && (
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <p className="font-medium text-foreground">Booking summary</p>
                <p className="mt-1 text-muted-foreground">{selection.name}</p>
                <p className="text-muted-foreground">
                  {new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                  {formatTime(slot)} – {formatTime(endTime(slot, selection.duration))}
                </p>
                <p className="text-muted-foreground">{selection.duration} minutes · {formatMoney(selection.price)}</p>
                {redeemablePoints > 0 && (
                  <p className="mt-1 text-muted-foreground">
                    {usePoints ? `Using ${redeemablePoints} points · pay ${formatMoney(Math.max(selection.price - pointsValue, 0))} at the salon` : `Pay at the salon`}
                  </p>
                )}
              </div>
            )}

            {user && selection && loyaltyBalance > 0 && (
              <div className="mt-3 rounded-lg border border-border p-3 text-xs">
                <p className="font-medium text-foreground">Your points at this salon: {loyaltyBalance}</p>
                {redeemablePoints > 0 ? (
                  <label className="mt-2 flex items-center gap-2 text-muted-foreground">
                    <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
                    Use {redeemablePoints} points ({formatMoney(pointsValue)} off)
                  </label>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    You need at least {minRedeem} points at this salon to use them.
                  </p>
                )}
              </div>
            )}

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={300}
              placeholder="Anything the salon should know?"
              className="mt-4 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              rows={2}
            />

            {bookingDisabled ? (
              <p className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-center text-xs text-muted-foreground">
                <span className="block font-semibold text-foreground">{t("booking.unavailable")}</span>
                {t("booking.unavailableMsg")}
              </p>
            ) : (
              <button
                onClick={() => void confirmBooking()}
                disabled={booking || !selection || !slot}
                className="mt-4 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {booking ? "Booking…" : user ? "Confirm Booking" : "Login to book"}
              </button>
            )}
          </div>

          <div className="salonx-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="size-4 text-primary" /> Opening hours
            </h2>
            {hours.isLoading ? (
              <p className="mt-3 text-xs text-muted-foreground">Loading hours…</p>
            ) : (hours.data ?? []).length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">Hours not published yet.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-xs">
                {(hours.data ?? []).map((h) => (
                  <li key={h.weekday} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{DAYS[h.weekday]}</span>
                    <span className="text-right text-foreground">
                      {h.is_closed ? "Closed" : `${formatTime(h.open_time)} – ${formatTime(h.close_time)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {(closures.data ?? []).length > 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Closed on{" "}
                {(closures.data ?? [])
                  .slice(0, 4)
                  .map((c) => new Date(`${c.closed_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }))
                  .join(", ")}
              </p>
            )}
          </div>
        </aside>
      </main>

      <SiteFooter />
    </div>
  );
}

function Retry({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-xs">
      <p className="text-foreground">{label}</p>
      <button onClick={onRetry} className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground">
        Retry
      </button>
    </div>
  );
}

/**
 * Reviews are only possible for the customer's own completed bookings at this
 * salon, one review per booking. The backend enforces the same rules.
 */
function ReviewForm({ salonId }: { salonId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const eligible = useReviewableBookings(user?.id, salonId);
  const [bookingId, setBookingId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const options = eligible.data ?? [];
  const selectedBooking = options.find((b) => b.id === bookingId) ?? options[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedBooking) return;
    setBusy(true);
    const { error } = await api.from("reviews").insert({
      salon_id: salonId,
      customer_id: user.id,
      booking_id: selectedBooking.id,
      service_id: selectedBooking.service_id,
      rating,
      comment: comment || null,
    });
    setBusy(false);
    if (error) {
      toast.error(
        /duplicate|unique/i.test(error.message) ? "You've already reviewed this appointment." : error.message,
      );
      return;
    }
    toast.success("Thanks for your review!");
    setComment("");
    setBookingId("");
    void queryClient.invalidateQueries({ queryKey: ["reviews", salonId] });
    void queryClient.invalidateQueries({ queryKey: ["reviewable_bookings", user.id, salonId] });
    void queryClient.invalidateQueries({ queryKey: ["salon"] });
  }

  if (eligible.isLoading) {
    return <p className="mt-4 text-xs text-muted-foreground">Checking your appointments…</p>;
  }

  if (options.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-border p-4 text-xs text-muted-foreground">
        You can leave a review once one of your appointments here is completed. Every completed appointment can be
        reviewed once.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-border p-4">
      <p className="text-xs font-medium text-foreground">Leave a review</p>

      {options.length > 1 && (
        <select
          value={selectedBooking?.id ?? ""}
          onChange={(e) => setBookingId(e.target.value)}
          className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
        >
          {options.map((b) => (
            <option key={b.id} value={b.id}>
              {new Date(b.booking_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
              {b.services?.name ?? "Appointment"}
            </option>
          ))}
        </select>
      )}

      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
            <Star className={`size-5 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder={`How was your ${selectedBooking?.services?.name ?? "appointment"}?`}
        className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
      />
      <button disabled={busy} className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">
        Submit review
      </button>
    </form>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="salonx-card p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="size-4 text-primary" /> {title}
      </h2>
      {children}
    </section>
  );
}

function PickRow({
  title,
  meta,
  price,
  image,
  active,
  onSelect,
}: {
  title: string;
  meta: string;
  price: number;
  image?: string | null;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        active ? "border-primary bg-primary-soft" : "border-border hover:border-primary"
      }`}
    >
      {image && <StoredImage path={image} alt={title} className="size-12 shrink-0 rounded-lg" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-foreground">{formatMoney(price)}</span>
    </button>
  );
}
