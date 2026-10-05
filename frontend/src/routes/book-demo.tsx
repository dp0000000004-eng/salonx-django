import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MapPin, Upload, X } from "lucide-react";
import { PageShell } from "@/components/salonx/PageShell";
import { api } from "@/lib/api-client";
import { submitDemoRequest } from "@/lib/demo.functions";
import { useDistricts, useStates } from "@/lib/locations";

export const Route = createFileRoute("/book-demo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Book a Demo — List Your Salon on SalonX" },
      {
        name: "description",
        content:
          "Tell us about your salon and we'll help you get started with SalonX — online bookings, services, offers and payouts.",
      },
      { property: "og:title", content: "Book a Demo — List Your Salon on SalonX" },
      {
        property: "og:description",
        content: "Tell us about your salon and we'll help you get started with SalonX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookDemoPage,
});

const STEPS = ["Salon Information", "Location", "Business Details", "Salon Profile"];
const SALON_TYPES = [
  "Unisex Salon",
  "Men's Salon",
  "Women's Salon",
  "Spa & Salon",
  "Beauty Parlour",
  "Barbershop",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Form = {
  salonName: string;
  salonType: string;
  ownerName: string;
  phone: string;
  email: string;
  whatsapp: string;
  description: string;
  seats: string;
  yearsInBusiness: string;
  address: string;
  state: string;
  district: string;
  city: string;
  area: string;
  pinCode: string;
  mapsUrl: string;
  latitude: string;
  longitude: string;
  openingTime: string;
  closingTime: string;
  weeklyClosedDay: string;
  servicesOffered: string;
  startingPrice: string;
  instagramUrl: string;
  facebookUrl: string;
  websiteUrl: string;
  password: string;
  confirmPassword: string;
};

const EMPTY: Form = {
  salonName: "",
  salonType: "",
  ownerName: "",
  phone: "",
  email: "",
  whatsapp: "",
  description: "",
  seats: "",
  yearsInBusiness: "",
  address: "",
  state: "Odisha",
  district: "",
  city: "",
  area: "",
  pinCode: "",
  mapsUrl: "",
  latitude: "",
  longitude: "",
  openingTime: "09:00",
  closingTime: "21:00",
  weeklyClosedDay: "",
  servicesOffered: "",
  startingPrice: "",
  instagramUrl: "",
  facebookUrl: "",
  websiteUrl: "",
  password: "",
  confirmPassword: "",
};

function BookDemoPage() {
  const navigate = useNavigate();
  const submit = useServerFn(submitDemoRequest);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [logo, setLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [done, setDone] = useState(false);
  const states = useStates();
  const districts = useDistricts(form.state);

  function set<K extends keyof Form>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Location is not available in this browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = coords.latitude.toFixed(7);
        const longitude = coords.longitude.toFixed(7);
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        const { data, error } = await api.reverseGeocode(coords.latitude, coords.longitude);
        setForm((f) => ({
          ...f,
          latitude,
          longitude,
          mapsUrl,
          address: data ? data.address : f.address,
          area: data ? data.area : f.area,
          pinCode: data ? data.pinCode : f.pinCode,
          state: data ? data.state : f.state,
          district: data ? data.district : f.district,
        }));
        setLocating(false);
        if (error) {
          toast.warning(
            "Coordinates added, but address lookup is unavailable. Please check the address fields.",
          );
        } else if (data) {
          const missing = [
            !data.address && "full address",
            !data.area && "area",
            !data.pinCode && "pincode",
            !data.district && "district",
            !data.state && "state",
          ].filter(Boolean);
          toast.success(
            missing.length
              ? `Location found. Please fill or verify: ${missing.join(", ")}.`
              : "Location and address details filled. Please verify they match your salon.",
          );
        }
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error(
            "Location permission was denied. Allow access or enter coordinates manually.",
          );
        } else if (error.code === error.TIMEOUT) {
          toast.error("Could not get your location in time. Please try again.");
        } else {
          toast.error("Could not get your location. Check your device location settings.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  function validateStep(index: number): string | null {
    if (index === 0) {
      if (!form.salonName.trim()) return "Salon name is required.";
      if (!form.salonType) return "Please choose a salon type.";
      if (!form.ownerName.trim()) return "Owner name is required.";
      if (!/^[+\d][\d\s-]{7,}$/.test(form.phone.trim())) return "Enter a valid mobile number.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        return "Enter a valid email address.";
    }
    if (index === 1) {
      if (!form.address.trim()) return "Full address is required.";
      if (!form.state.trim()) return "Please select a state.";
      if (!form.district.trim()) return "Please select a district.";
      if (!/^\d{4,8}$/.test(form.pinCode.trim())) return "Enter a valid pincode.";
    }
    if (index === 2) {
      if (!form.openingTime) return "Opening time is required.";
      if (!form.closingTime) return "Closing time is required.";
    }
    if (index === 3) {
      if (form.password.length < 8) return "Password must be at least 8 characters.";
      if (form.password !== form.confirmPassword) return "Passwords do not match.";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function uploadMedia(salonId: string): Promise<boolean> {
    let failed = false;
    const put = async (file: File, folder: string) => {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${salonId}/${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await api.storage.from("salon-media").upload(path, file, { upsert: true });
      if (error) {
        failed = true;
        return null;
      }
      return api.storage.from("salon-media").getPublicUrl(path).data.publicUrl;
    };
    const patch: {
      logo_url?: string;
      cover_image_url?: string;
      salon_images?: string[];
      image_url?: string;
    } = {};
    if (logo) {
      const u = await put(logo, "logo");
      if (u) patch.logo_url = u;
    }
    if (cover) {
      const u = await put(cover, "cover");
      if (u) patch.cover_image_url = u;
    }
    if (images.length) {
      const urls = (await Promise.all(images.map((f) => put(f, "gallery")))).filter(
        (u): u is string => !!u,
      );
      if (urls.length) {
        patch.salon_images = urls;
        patch.image_url = urls[0]!;
      }
    }
    if (!patch.image_url && patch.cover_image_url) patch.image_url = patch.cover_image_url;
    if (Object.keys(patch).length) {
      const { error } = await api.from("salons").update(patch).eq("id", salonId);
      if (error) failed = true;
    }
    return failed;
  }

  async function finish() {
    const err = validateStep(3);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      const res = await submit({
        data: {
          salonName: form.salonName,
          salonType: form.salonType,
          ownerName: form.ownerName,
          phone: form.phone,
          email: form.email,
          whatsapp: form.whatsapp || undefined,
          description: form.description || undefined,
          seats: form.seats ? Number(form.seats) : undefined,
          yearsInBusiness: form.yearsInBusiness ? Number(form.yearsInBusiness) : undefined,
          address: form.address,
          state: form.state,
          district: form.district,
          city: form.city || form.district,
          area: form.area || undefined,
          pinCode: form.pinCode,
          mapsUrl: form.mapsUrl || undefined,
          latitude: form.latitude ? Number(form.latitude) : undefined,
          longitude: form.longitude ? Number(form.longitude) : undefined,
          openingTime: form.openingTime,
          closingTime: form.closingTime,
          weeklyClosedDay: form.weeklyClosedDay ? Number(form.weeklyClosedDay) : undefined,
          servicesOffered: form.servicesOffered || undefined,
          startingPrice: form.startingPrice ? Number(form.startingPrice) : undefined,
          instagramUrl: form.instagramUrl || undefined,
          facebookUrl: form.facebookUrl || undefined,
          websiteUrl: form.websiteUrl || undefined,
          password: form.password,
        },
      });
      const { error: sessionError } = await api.auth.setSession({
        access_token: res.access,
        refresh_token: res.refresh,
        user: res.user,
      });
      if (sessionError) throw sessionError;
      if (logo || cover || images.length) {
        const mediaFailed = await uploadMedia(res.salonId);
        if (mediaFailed) {
          toast.warning(
            "Your salon was registered, but some images could not be uploaded. You can add them later from your dashboard.",
          );
        }
      }
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit your demo request.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <PageShell
        title="Book a Demo"
        subtitle="Tell us about your salon and we'll help you get started with SalonX."
      >
        <div className="salonx-card mx-auto max-w-lg p-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-primary" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Demo request submitted successfully.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your salon is waiting for approval from SalonX.
          </p>
          <button
            onClick={() => void navigate({ to: "/owner" })}
            className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
          >
            Go to your dashboard
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Book a Demo"
      subtitle="Tell us about your salon and we'll help you get started with SalonX."
    >
      <div className="mx-auto max-w-2xl">
        <ol className="mb-6 flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-[11px] font-medium transition-colors duration-200 ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-primary-soft text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <div className="salonx-card space-y-4 p-6 sm:p-7">
          {step === 0 && (
            <>
              <Field
                label="Salon Name *"
                value={form.salonName}
                onChange={set("salonName")}
                placeholder="Modern Men's Salon"
              />
              <div>
                <label className="text-xs font-medium text-foreground">Salon Type *</label>
                <select value={form.salonType} onChange={set("salonType")} className={inputCls}>
                  <option value="">Select type</option>
                  {SALON_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Owner Name *"
                value={form.ownerName}
                onChange={set("ownerName")}
                placeholder="Full name"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Mobile Number *"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="+91 90000 00000"
                />
                <Field
                  label="WhatsApp Number"
                  value={form.whatsapp}
                  onChange={set("whatsapp")}
                  placeholder="Optional"
                />
              </div>
              <Field
                label="Email *"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="owner@salon.com"
              />
              <TextArea
                label="Salon Description"
                value={form.description}
                onChange={set("description")}
                placeholder="What makes your salon special?"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Number of Chairs / Seats"
                  type="number"
                  value={form.seats}
                  onChange={set("seats")}
                  placeholder="6"
                />
                <Field
                  label="Years in Business"
                  type="number"
                  value={form.yearsInBusiness}
                  onChange={set("yearsInBusiness")}
                  placeholder="5"
                />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <TextArea
                label="Full Address *"
                value={form.address}
                onChange={set("address")}
                placeholder="Shop number, street, landmark"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-foreground">State *</label>
                  <select
                    value={form.state}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, state: e.target.value, district: "" }))
                    }
                    className={inputCls}
                    disabled={states.isLoading}
                  >
                    <option value="">
                      {states.isLoading ? "Loading states…" : "Select state"}
                    </option>
                    {(states.data ?? []).map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {states.isError && (
                    <p className="mt-1 text-[11px] text-destructive">
                      Could not load states.{" "}
                      <button
                        type="button"
                        onClick={() => void states.refetch()}
                        className="underline"
                      >
                        Retry
                      </button>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">District *</label>
                  <select
                    value={form.district}
                    onChange={set("district")}
                    className={inputCls}
                    disabled={!form.state || districts.isLoading}
                  >
                    <option value="">
                      {!form.state
                        ? "Select a state first"
                        : districts.isLoading
                          ? "Loading districts…"
                          : "Select district"}
                    </option>
                    {(districts.data ?? []).map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {districts.isError && (
                    <p className="mt-1 text-[11px] text-destructive">
                      Could not load districts.{" "}
                      <button
                        type="button"
                        onClick={() => void districts.refetch()}
                        className="underline"
                      >
                        Retry
                      </button>
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Area" value={form.area} onChange={set("area")} placeholder="Patia" />
                <Field
                  label="Pincode *"
                  value={form.pinCode}
                  onChange={set("pinCode")}
                  placeholder="751024"
                />
              </div>
              <Field
                label="Google Maps Location"
                value={form.mapsUrl}
                onChange={set("mapsUrl")}
                placeholder="Optional map link"
              />
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locating}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {locating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MapPin className="size-4" />
                )}
                {locating ? "Finding your address…" : "Use my current location"}
              </button>
              <p className="text-xs text-muted-foreground">
                Uses your device coordinates to look up the address through SalonX&apos;s configured
                self-hosted geocoder. Please use this while at your salon, then verify all returned
                address details.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Latitude"
                  value={form.latitude}
                  onChange={set("latitude")}
                  placeholder="Optional"
                />
                <Field
                  label="Longitude"
                  value={form.longitude}
                  onChange={set("longitude")}
                  placeholder="Optional"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Opening Time *"
                  type="time"
                  value={form.openingTime}
                  onChange={set("openingTime")}
                  placeholder=""
                />
                <Field
                  label="Closing Time *"
                  type="time"
                  value={form.closingTime}
                  onChange={set("closingTime")}
                  placeholder=""
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Weekly Closed Day</label>
                <select
                  value={form.weeklyClosedDay}
                  onChange={set("weeklyClosedDay")}
                  className={inputCls}
                >
                  <option value="">Open all week</option>
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <TextArea
                label="Services Offered"
                value={form.servicesOffered}
                onChange={set("servicesOffered")}
                placeholder="Haircut, Beard Trim, Hair Spa, Hair Color…"
              />
              <Field
                label="Starting Price (₹)"
                type="number"
                value={form.startingPrice}
                onChange={set("startingPrice")}
                placeholder="199"
              />
              <Field
                label="Instagram URL"
                value={form.instagramUrl}
                onChange={set("instagramUrl")}
                placeholder="Optional"
              />
              <Field
                label="Facebook URL"
                value={form.facebookUrl}
                onChange={set("facebookUrl")}
                placeholder="Optional"
              />
              <Field
                label="Website URL"
                value={form.websiteUrl}
                onChange={set("websiteUrl")}
                placeholder="Optional"
              />
            </>
          )}

          {step === 3 && (
            <>
              <ImagePick label="Salon Logo" file={logo} onPick={setLogo} />
              <ImagePick label="Salon Cover Image" file={cover} onPick={setCover} />
              <div>
                <label className="text-xs font-medium text-foreground">Salon Images</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) =>
                    setImages((prev) => [...prev, ...Array.from(e.target.files ?? [])].slice(0, 8))
                  }
                  className="mt-1 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-xs file:font-medium file:text-primary"
                />
                {images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {images.map((f, i) => (
                      <div
                        key={`${f.name}-${i}`}
                        className="relative overflow-hidden rounded-lg border border-border"
                      >
                        <img
                          src={URL.createObjectURL(f)}
                          alt={f.name}
                          className="h-20 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                          aria-label="Remove image"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-2 rounded-lg bg-muted/60 p-4">
                <h3 className="text-sm font-semibold text-foreground">Owner account</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  You'll sign in with this email. Your password is stored securely and is never
                  visible to anyone at SalonX.
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Password *"
                    type="password"
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Minimum 8 characters"
                  />
                  <Field
                    label="Confirm Password *"
                    type="password"
                    value={form.confirmPassword}
                    onChange={set("confirmPassword")}
                    placeholder="Repeat password"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={step === 0 || busy}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void finish()}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60"
              >
                {busy && <Loader2 className="size-4 animate-spin" />} Book Demo
              </button>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow duration-200 focus:ring-2 focus:ring-ring";

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={200}
        className={inputCls}
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        rows={3}
        maxLength={800}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );
}

function ImagePick({
  label,
  file,
  onPick,
}: {
  label: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      {file ? (
        <div className="mt-1 flex items-center gap-3 rounded-lg border border-border p-2">
          <img
            src={URL.createObjectURL(file)}
            alt={label}
            className="size-14 rounded-md object-cover"
          />
          <span className="flex-1 truncate text-xs text-muted-foreground">{file.name}</span>
          <label className="cursor-pointer rounded-lg border border-border px-2 py-1 text-[11px]">
            Replace
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="rounded-lg border border-border px-2 py-1 text-[11px]"
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          <Upload className="size-4" /> Upload {label.toLowerCase()}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}
