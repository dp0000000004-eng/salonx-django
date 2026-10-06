import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { resolveMediaUrl, uploadSalonImage, validateImage } from "@/lib/media";
import {
  STATUS_LABEL,
  statusTone,
  bookingEndTime,
  bookingItemName,
  rescheduleBooking,
  setBookingStatus,
  useSlots,
  type BookingStatus,
  type OwnerBooking,
} from "@/lib/owner-queries";
import { formatMoney, formatTime } from "@/lib/queries";

/* ---------------- realtime ---------------- */

const OWNER_TABLES = [
  "salon_subscriptions",
  "bookings",
  "salon_blocks",
  "salon_resources",
  "salon_closures",
  "salon_hours",
  "services",
  "hairstyles",
  "wedding_packages",
  "coupons",
  "reviews",
  "payments",
  "payouts",
  "salons",
  "notifications",
] as const;

/** One channel for the whole owner dashboard; refreshes every open panel live. */
export function useOwnerRealtime(salonId?: string, userId?: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!salonId) return;
    const channel = api.channel(`owner:${salonId}`);
    for (const table of OWNER_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).length > 0 });
      });
    }
    channel.subscribe();
    return () => {
      void api.removeChannel(channel);
    };
  }, [salonId, userId, queryClient]);
}

/* ---------------- small building blocks ---------------- */

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${statusTone(status)}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-xs text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
      <p>{(error as Error)?.message ?? "Something went wrong."}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-md border border-destructive/40 px-3 py-1.5"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring";

export function PrimaryButton({
  children,
  busy,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 ${rest.className ?? ""}`}
    >
      {busy && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function GhostButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60 ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

/** Confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-xs text-muted-foreground">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------- media ---------------- */

export function MediaImage({
  path,
  alt,
  className,
}: {
  path: string | null;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void resolveMediaUrl(path).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [path]);
  if (!url) return <div className={`bg-muted ${className ?? ""}`} aria-hidden />;
  return <img src={url} alt={alt} loading="lazy" className={className} />;
}

export function ImageUploader({
  salonId,
  folder,
  value,
  onChange,
}: {
  salonId: string;
  folder: string;
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(() => (/^https?:\/\//i.test(value ?? "") ? value! : ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setImageUrl(/^https?:\/\//i.test(value ?? "") ? value! : "");
  }, [value]);

  async function pick(file: File | undefined) {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setImageUrl("");
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    setProgress(20);
    const timer = setInterval(() => setProgress((p) => Math.min(p + 12, 88)), 220);
    try {
      const path = await uploadSalonImage(salonId, file, folder);
      onChange(path);
      setProgress(100);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
      setPreview(null);
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  function applyImageUrl() {
    const candidate = imageUrl.trim();
    if (!candidate) {
      toast.error("Enter an image URL first.");
      return;
    }
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        toast.error("Image URL must start with http:// or https://.");
        return;
      }
      setPreview(null);
      setImageUrl(parsed.href);
      onChange(parsed.href);
      toast.success("Image URL added");
    } catch {
      toast.error("Enter a valid image URL.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {preview ? (
          <img src={preview} alt="Preview" className="size-16 rounded-lg object-cover" />
        ) : value ? (
          <MediaImage
            path={value}
            alt="Current image"
            className="size-16 rounded-lg object-cover"
          />
        ) : (
          <span className="flex size-16 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Upload className="size-4" />
          </span>
        )}
        <div className="flex gap-2">
          <GhostButton type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
            {value || preview ? "Replace image" : "Upload image"}
          </GhostButton>
          {(value || preview) && (
            <GhostButton
              type="button"
              onClick={() => {
                setPreview(null);
                setImageUrl("");
                onChange(null);
              }}
            >
              Remove
            </GhostButton>
          )}
        </div>
      </div>
      {busy && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <div className="flex gap-2">
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Or paste an image URL (https://...)"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
          aria-label="Image URL"
        />
        <GhostButton type="button" onClick={applyImageUrl} disabled={busy}>
          Use URL
        </GhostButton>
      </div>
      <p className="text-[10px] text-muted-foreground">JPG, PNG, WebP or AVIF · up to 5 MB</p>
    </div>
  );
}

/* ---------------- appointment detail ---------------- */

export function AppointmentDialog({
  booking,
  salonId,
  paymentStatus,
  onClose,
}: {
  booking: OwnerBooking | null;
  salonId: string;
  paymentStatus?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel" | "pay">("view");
  const [newDate, setNewDate] = useState(booking?.booking_date ?? "");
  const [newTime, setNewTime] = useState("");
  const [reason, setReason] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");

  useEffect(() => {
    setMode("view");
    setNewDate(booking?.booking_date ?? "");
    setNewTime("");
    setReason("");
    setPayMethod("cash");
    setPayNote("");
  }, [booking?.id, booking?.booking_date]);

  const slots = useSlots(
    salonId,
    mode === "reschedule" ? newDate : undefined,
    booking?.duration_min ?? 30,
  );

  if (!booking) return null;

  async function run(fn: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await queryClient.invalidateQueries();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const actions: { label: string; status: BookingStatus; show: boolean }[] = [
    { label: "Accept", status: "confirmed", show: booking.status === "pending" },
    {
      label: "Mark in progress",
      status: "service_started",
      show: ["confirmed", "checked_in"].includes(booking.status),
    },
    { label: "Check in", status: "checked_in", show: booking.status === "confirmed" },
    {
      label: "Mark completed",
      status: "completed",
      show: ["confirmed", "checked_in", "service_started"].includes(booking.status),
    },
    {
      label: "Mark no show",
      status: "no_show",
      show: ["confirmed", "checked_in", "pending"].includes(booking.status),
    },
  ];

  return (
    <Modal open onClose={onClose} title="Appointment details" wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Detail label="Customer" value={booking.profiles?.full_name ?? "Customer"} />
        <Detail
          label="Contact"
          value={booking.profiles?.phone ?? booking.profiles?.email ?? "Not shared"}
        />
        <Detail label="Service" value={bookingItemName(booking)} />
        <Detail label="Price" value={formatMoney(booking.amount)} />
        <Detail
          label="Date"
          value={new Date(`${booking.booking_date}T00:00:00`).toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        />
        <Detail
          label="Time"
          value={`${formatTime(booking.slot_time.slice(0, 5))} – ${formatTime(bookingEndTime(booking))} (${booking.duration_min} min)`}
        />
        <Detail label="Status" value={STATUS_LABEL[booking.status] ?? booking.status} />
        <Detail label="Payment" value={paymentStatus ? paymentStatus : "No payment record"} />
        <Detail label="Booked on" value={new Date(booking.created_at).toLocaleString("en-IN")} />
      </div>
      {booking.notes && (
        <p className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          {booking.notes}
        </p>
      )}
      {booking.cancellation_reason && (
        <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          {booking.cancellation_reason}
        </p>
      )}

      {mode === "view" && (
        <div className="mt-5 flex flex-wrap gap-2">
          {actions
            .filter((a) => a.show)
            .map((a) => (
              <PrimaryButton
                key={a.label}
                busy={busy}
                onClick={() =>
                  run(
                    () => setBookingStatus(booking.id, a.status),
                    `Appointment ${a.label.toLowerCase()}`,
                  )
                }
              >
                {a.label}
              </PrimaryButton>
            ))}
          {booking.status !== "cancelled" && booking.status !== "completed" && (
            <>
              <GhostButton onClick={() => setMode("reschedule")}>Reschedule</GhostButton>
              <GhostButton onClick={() => setMode("cancel")} className="text-destructive">
                {booking.status === "pending" ? "Reject" : "Cancel"}
              </GhostButton>
            </>
          )}
          {paymentStatus !== "paid" && booking.status !== "cancelled" && (
            <PrimaryButton onClick={() => setMode("pay")}>Mark as paid</PrimaryButton>
          )}
        </div>
      )}

      {mode === "reschedule" && (
        <div className="mt-5 space-y-3">
          <Field label="New date">
            <input
              type="date"
              className={inputClass}
              value={newDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setNewDate(e.target.value);
                setNewTime("");
              }}
            />
          </Field>
          <div>
            <p className="mb-1 text-[11px] font-medium text-foreground">
              Available times ({booking.duration_min} min)
            </p>
            {slots.isLoading ? (
              <p className="text-xs text-muted-foreground">Checking availability…</p>
            ) : (slots.data ?? []).length === 0 ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                No availability on this date — the salon may be closed or fully booked.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {(slots.data ?? []).map((s) => (
                  <button
                    key={s}
                    onClick={() => setNewTime(s)}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] ${
                      newTime === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {formatTime(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setMode("view")}>Back</GhostButton>
            <PrimaryButton
              busy={busy}
              disabled={!newTime}
              onClick={() =>
                run(
                  () => rescheduleBooking(booking.id, newDate, newTime),
                  "Appointment rescheduled",
                )
              }
            >
              Confirm new time
            </PrimaryButton>
          </div>
        </div>
      )}

      {mode === "cancel" && (
        <div className="mt-5 space-y-3">
          <Field label="Reason (shared with the customer)">
            <textarea
              className={inputClass}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setMode("view")}>Back</GhostButton>
            <PrimaryButton
              busy={busy}
              onClick={() =>
                run(
                  () =>
                    setBookingStatus(booking.id, "cancelled", reason || "Cancelled by the salon"),
                  "Appointment cancelled",
                )
              }
            >
              Confirm
            </PrimaryButton>
          </div>
        </div>
      )}

      {mode === "pay" && (
        <div className="mt-5 space-y-3">
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Confirm you have received {formatMoney(booking.amount)} from the customer. Loyalty
            points are awarded automatically once the payment is confirmed.
          </p>
          <Field label="How was it paid?">
            <select
              className={inputClass}
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Note (optional)">
            <input
              className={inputClass}
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="Reference, remark…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setMode("view")}>Back</GhostButton>
            <PrimaryButton
              busy={busy}
              onClick={() =>
                run(async () => {
                  const { error } = await api.rpc("owner_mark_booking_paid", {
                    _booking_id: booking.id,
                    _method: payMethod as "cash" | "upi" | "card" | "other",
                    ...(payNote.trim() ? { _note: payNote.trim() } : {}),
                  });
                  if (error) throw error;
                }, "Payment confirmed")
              }
            >
              Confirm payment received
            </PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}
