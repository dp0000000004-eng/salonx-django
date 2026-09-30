import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarOff, Clock, Store } from "lucide-react";
import { Panel } from "@/components/salonx/DashboardShell";
import { ImageCropUpload } from "@/components/salonx/ImageCropUpload";
import {
  ConfirmDialog,
  Empty,
  ErrorNote,
  Field,
  GhostButton,
  Loading,
  PrimaryButton,
  inputClass,
} from "@/components/owner/shared";
import { api } from "@/lib/api-client";
import { deleteSalonImage, resolveMediaUrl, uploadSalonImage } from "@/lib/media";
import type { AspectName } from "@/lib/image";
import { useOwnerBlocks, useOwnerHours, todayISO } from "@/lib/owner-queries";
import { formatTime, type SalonRow } from "@/lib/queries";

/** Crop-and-upload control bound to one salon media field (cover or logo). */
function SalonImageCrop({
  salonId,
  folder,
  label,
  aspect,
  fit,
  hint,
  previewClassName,
  value,
  onChange,
}: {
  salonId: string;
  folder: string;
  label: string;
  aspect: AspectName;
  fit: "cover" | "contain";
  hint: string;
  previewClassName: string;
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void resolveMediaUrl(value).then((u) => {
      if (active) setPreview(u);
    });
    return () => {
      active = false;
    };
  }, [value]);

  return (
    <ImageCropUpload
      label={label}
      aspect={aspect}
      fit={fit}
      hint={hint}
      previewClassName={previewClassName}
      value={value}
      previewUrl={preview}
      onUpload={async (file) => {
        const previousPath = value;
        const path = await uploadSalonImage(salonId, file, folder);
        onChange(path);
        if (previousPath && previousPath !== path) await deleteSalonImage(previousPath);
      }}
      onRemove={async () => {
        const previousPath = value;
        onChange(null);
        setPreview(null);
        if (previousPath) await deleteSalonImage(previousPath);
      }}
    />
  );
}


const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type HourRow = {
  id: string;
  weekday: number;
  is_closed: boolean;
  open_time: string;
  close_time: string;
  break_start: string | null;
  break_end: string | null;
};

export function OwnerProfile({ salon }: { salon: SalonRow }) {
  return (
    <div className="space-y-4">
      <SalonDetails salon={salon} />
      <OpeningHours salonId={salon.id} />
      <BlockedTimes salonId={salon.id} />
    </div>
  );
}

/* ---------------- salon details ---------------- */

function SalonDetails({ salon }: { salon: SalonRow }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: salon.name,
    phone: salon.phone ?? "",
    city: salon.city,
    area: salon.area ?? "",
    pin_code: salon.pin_code ?? "",
    address: salon.address ?? "",
    about: salon.about ?? "",
    image_url: salon.cover_image_url ?? salon.image_url,
    logo_url: salon.logo_url,
  });

  useEffect(() => {
    setForm({
      name: salon.name,
      phone: salon.phone ?? "",
      city: salon.city,
      area: salon.area ?? "",
      pin_code: salon.pin_code ?? "",
      address: salon.address ?? "",
      about: salon.about ?? "",
      image_url: salon.cover_image_url ?? salon.image_url,
      logo_url: salon.logo_url,
    });
  }, [salon]);

  async function save() {
    if (!form.name.trim()) {
      toast.error("Salon name is required");
      return;
    }
    if (!form.city.trim()) {
      toast.error("City is required");
      return;
    }
    setBusy(true);
    const { error } = await api
      .from("salons")
      .update({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        city: form.city.trim(),
        area: form.area.trim() || null,
        pin_code: form.pin_code.trim() || null,
        address: form.address.trim() || null,
        about: form.about.trim() || null,
        image_url: form.image_url,
        cover_image_url: form.image_url,
        logo_url: form.logo_url,
      })
      .eq("id", salon.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Salon profile updated");
    await queryClient.invalidateQueries();
  }

  return (
    <Panel title="Salon profile" icon={Store}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Salon name">
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="City">
          <input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Field>
        <Field label="Area">
          <input className={inputClass} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
        </Field>
        <Field label="PIN code">
          <input className={inputClass} value={form.pin_code} onChange={(e) => setForm({ ...form, pin_code: e.target.value })} />
        </Field>
        <Field label="Address">
          <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="About your salon">
          <textarea className={inputClass} rows={4} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SalonImageCrop
          salonId={salon.id}
          folder="cover"
          label="Cover photo"
          aspect="cover"
          fit="cover"
          previewClassName="h-20 w-full max-w-[13rem]"
          hint="Wide banner shown at the top of your salon page. Zoom and move to pick the part you want."
          value={form.image_url}
          onChange={(p) => setForm({ ...form, image_url: p })}
        />
        <SalonImageCrop
          salonId={salon.id}
          folder="logo"
          label="Logo"
          aspect="square"
          fit="contain"
          previewClassName="size-20"
          hint="Square logo shown next to your salon name. The full logo stays visible."
          value={form.logo_url}
          onChange={(p) => setForm({ ...form, logo_url: p })}
        />
      </div>

      <div className="mt-5 flex justify-end">
        <PrimaryButton busy={busy} onClick={() => void save()}>
          Save changes
        </PrimaryButton>
      </div>
    </Panel>
  );
}

/* ---------------- opening hours ---------------- */

function OpeningHours({ salonId }: { salonId: string }) {
  const hours = useOwnerHours(salonId);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<HourRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const existing = (hours.data ?? []) as HourRow[];
    setDraft(
      DAYS.map((_, weekday) => {
        const row = existing.find((h) => h.weekday === weekday);
        return (
          row ?? {
            id: "",
            weekday,
            is_closed: true,
            open_time: "09:00",
            close_time: "20:00",
            break_start: null,
            break_end: null,
          }
        );
      }),
    );
  }, [hours.data]);

  async function save() {
    setBusy(true);
    try {
      for (const row of draft) {
        const payload = {
          salon_id: salonId,
          weekday: row.weekday,
          is_closed: row.is_closed,
          open_time: row.open_time,
          close_time: row.close_time,
          break_start: row.break_start || null,
          break_end: row.break_end || null,
        };
        if (!row.is_closed && row.open_time >= row.close_time) {
          throw new Error(`${DAYS[row.weekday]}: closing time must be after opening time`);
        }
        const { error } = row.id
          ? await api.from("salon_hours").update(payload).eq("id", row.id)
          : await api.from("salon_hours").insert(payload);
        if (error) throw error;
      }
      toast.success("Opening hours saved");
      await queryClient.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (hours.isLoading) return <Loading label="Loading opening hours…" />;
  if (hours.error) return <ErrorNote error={hours.error} onRetry={() => void hours.refetch()} />;

  return (
    <Panel title="Opening hours" icon={Clock}>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Customers can only book inside these hours. Breaks are excluded automatically.
      </p>
      <div className="space-y-2">
        {draft.map((row, i) => (
          <div key={row.weekday} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[120px_auto_1fr]">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={!row.is_closed}
                onChange={(e) => {
                  const next = [...draft];
                  next[i] = { ...row, is_closed: !e.target.checked };
                  setDraft(next);
                }}
              />
              {DAYS[row.weekday]}
            </label>
            {row.is_closed ? (
              <span className="text-xs text-muted-foreground">Closed</span>
            ) : (
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <TimeInput
                  value={row.open_time.slice(0, 5)}
                  onChange={(v) => {
                    const next = [...draft];
                    next[i] = { ...row, open_time: v };
                    setDraft(next);
                  }}
                />
                <span className="text-[11px] text-muted-foreground">to</span>
                <TimeInput
                  value={row.close_time.slice(0, 5)}
                  onChange={(v) => {
                    const next = [...draft];
                    next[i] = { ...row, close_time: v };
                    setDraft(next);
                  }}
                />
                <span className="ml-2 text-[11px] text-muted-foreground">break</span>
                <TimeInput
                  value={row.break_start?.slice(0, 5) ?? ""}
                  onChange={(v) => {
                    const next = [...draft];
                    next[i] = { ...row, break_start: v || null };
                    setDraft(next);
                  }}
                />
                <span className="text-[11px] text-muted-foreground">to</span>
                <TimeInput
                  value={row.break_end?.slice(0, 5) ?? ""}
                  onChange={(v) => {
                    const next = [...draft];
                    next[i] = { ...row, break_end: v || null };
                    setDraft(next);
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <PrimaryButton busy={busy} onClick={() => void save()}>
          Save hours
        </PrimaryButton>
      </div>
    </Panel>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="time" className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs" value={value} onChange={(e) => onChange(e.target.value)} />;
}

/* ---------------- blocked times ---------------- */

function BlockedTimes({ salonId }: { salonId: string }) {
  const blocks = useOwnerBlocks(salonId);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: todayISO(), fullDay: true, start: "", end: "", reason: "" });

  async function add() {
    if (!form.date) {
      toast.error("Pick a date");
      return;
    }
    if (!form.fullDay && (!form.start || !form.end || form.start >= form.end)) {
      toast.error("Enter a valid start and end time");
      return;
    }
    setBusy(true);
    const { error } = await api.from("salon_blocks").insert({
      salon_id: salonId,
      block_date: form.date,
      full_day: form.fullDay,
      start_time: form.fullDay ? null : form.start,
      end_time: form.fullDay ? null : form.end,
      reason: form.reason.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Time blocked");
    setForm({ date: todayISO(), fullDay: true, start: "", end: "", reason: "" });
    await queryClient.invalidateQueries();
  }

  async function remove(id: string) {
    const { error } = await api.from("salon_blocks").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Block removed");
    await queryClient.invalidateQueries();
  }

  if (blocks.isLoading) return <Loading label="Loading blocked times…" />;
  if (blocks.error) return <ErrorNote error={blocks.error} onRetry={() => void blocks.refetch()} />;

  const rows = blocks.data ?? [];

  return (
    <Panel title="Blocked dates & times" icon={CalendarOff}>
      <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Date">
          <input type="date" className={inputClass} min={todayISO()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <label className="flex items-end gap-2 pb-2 text-xs text-foreground">
          <input type="checkbox" checked={form.fullDay} onChange={(e) => setForm({ ...form, fullDay: e.target.checked })} />
          Block the whole day
        </label>
        {!form.fullDay && (
          <>
            <Field label="From">
              <input type="time" className={inputClass} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </Field>
            <Field label="To">
              <input type="time" className={inputClass} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </Field>
          </>
        )}
        <Field label="Reason (optional)">
          <input className={inputClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </Field>
        <div className="flex items-end">
          <PrimaryButton busy={busy} onClick={() => void add()}>
            Block time
          </PrimaryButton>
        </div>
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <Empty title="No blocked times" description="Block a date or a few hours to stop customers booking then." />
        ) : (
          <ul className="space-y-2">
            {rows.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-foreground">
                    {new Date(`${b.block_date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {b.full_day
                      ? "Whole day"
                      : `${formatTime((b.start_time ?? b.slot_time ?? "00:00").slice(0, 5))} – ${formatTime((b.end_time ?? "00:00").slice(0, 5))}`}
                    {b.reason ? ` · ${b.reason}` : ""}
                  </span>
                </span>
                <GhostButton className="text-destructive" onClick={() => setConfirmId(b.id)}>
                  Remove
                </GhostButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmId}
        title="Remove this block?"
        message="Customers will be able to book during this time again."
        confirmLabel="Remove"
        onClose={() => setConfirmId(null)}
        onConfirm={() => remove(confirmId!)}
      />
    </Panel>
  );
}
