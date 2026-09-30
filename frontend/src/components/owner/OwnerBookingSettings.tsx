import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Armchair, CalendarX2, Timer, Trash2 } from "lucide-react";
import {
  addClosure,
  addResource,
  removeClosure,
  removeResource,
  renameResource,
  saveBookingConfig,
  useBookingConfig,
  useSalonClosures,
  useSalonResources,
} from "@/lib/booking";
import { Empty, ErrorNote, Field, GhostButton, Loading, PrimaryButton, inputClass } from "@/components/owner/shared";

export function OwnerBookingSettings({ salonId }: { salonId: string }) {
  const queryClient = useQueryClient();
  const resources = useSalonResources(salonId);
  const closures = useSalonClosures(salonId);
  const config = useBookingConfig(salonId);

  const [interval, setIntervalMin] = useState(10);
  const [bufferOn, setBufferOn] = useState(false);
  const [buffer, setBuffer] = useState(10);
  const [saving, setSaving] = useState(false);

  const [chairName, setChairName] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [closeReason, setCloseReason] = useState("");

  useEffect(() => {
    if (!config.data) return;
    setIntervalMin(config.data.booking_interval_min);
    setBufferOn(config.data.buffer_min > 0);
    setBuffer(config.data.buffer_min > 0 ? config.data.buffer_min : 10);
  }, [config.data]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["salon_resources", salonId] });
    void queryClient.invalidateQueries({ queryKey: ["salon_closures", salonId] });
    void queryClient.invalidateQueries({ queryKey: ["booking_config", salonId] });
    void queryClient.invalidateQueries({ queryKey: ["slots"] });
  }

  async function run(action: () => Promise<void>, success: string) {
    try {
      await action();
      toast.success(success);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function saveConfig() {
    setSaving(true);
    await run(
      () =>
        saveBookingConfig(salonId, {
          booking_interval_min: Math.max(5, Math.min(60, interval)),
          buffer_min: bufferOn ? Math.max(0, Math.min(120, buffer)) : 0,
        }),
      "Booking settings saved.",
    );
    setSaving(false);
  }

  if (resources.isLoading || config.isLoading) return <Loading label="Loading booking settings…" />;
  if (resources.error) return <ErrorNote error={resources.error} onRetry={() => void resources.refetch()} />;

  const chairs = resources.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="salonx-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Armchair className="size-4 text-primary" /> Chairs &amp; resources
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Each chair takes one appointment at a time. More chairs means more customers can book the same hour.
        </p>

        {chairs.length === 0 ? (
          <div className="mt-4">
            <Empty title="No chairs yet" description="Add at least one chair so customers can book." />
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {chairs.map((chair) => (
              <li key={chair.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                <input
                  defaultValue={chair.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== chair.name) void run(() => renameResource(chair.id, name), "Chair renamed.");
                  }}
                  className={`${inputClass} min-w-0 flex-1`}
                />
                <button
                  onClick={() => void run(() => removeResource(chair.id), "Chair removed.")}
                  className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${chair.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={chairName}
            onChange={(e) => setChairName(e.target.value)}
            placeholder={`Chair ${chairs.length + 1}`}
            className={`${inputClass} min-w-0 flex-1`}
          />
          <PrimaryButton
            onClick={() => {
              const name = chairName.trim() || `Chair ${chairs.length + 1}`;
              void run(() => addResource(salonId, name, chairs.length + 1), "Chair added.").then(() => setChairName(""));
            }}
          >
            Add chair
          </PrimaryButton>
        </div>
      </section>

      <section className="salonx-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Timer className="size-4 text-primary" /> Appointment timing
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Start times are offered every few minutes. Each appointment still lasts as long as the service you set.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Start times every (minutes)">
            <input
              type="number"
              min={5}
              max={60}
              step={5}
              value={interval}
              onChange={(e) => setIntervalMin(Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Gap after each appointment">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={bufferOn} onChange={(e) => setBufferOn(e.target.checked)} />
                On
              </label>
              <input
                type="number"
                min={0}
                max={120}
                step={5}
                disabled={!bufferOn}
                value={buffer}
                onChange={(e) => setBuffer(Number(e.target.value))}
                className={`${inputClass} disabled:opacity-50`}
              />
            </div>
          </Field>
        </div>

        <div className="mt-4">
          <PrimaryButton disabled={saving} onClick={() => void saveConfig()}>
            {saving ? "Saving…" : "Save settings"}
          </PrimaryButton>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Opening hours, weekly closed day and blocked times are under Salon Profile.
        </p>
      </section>

      <section className="salonx-card p-5 lg:col-span-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarX2 className="size-4 text-primary" /> Holidays &amp; closed dates
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Customers cannot book on these dates.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className={`${inputClass} w-auto`} />
          <input
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="Reason (optional)"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <PrimaryButton
            onClick={() => {
              if (!closeDate) {
                toast.error("Pick a date to close.");
                return;
              }
              void run(() => addClosure(salonId, closeDate, closeReason.trim() || null), "Closed date added.").then(() => {
                setCloseDate("");
                setCloseReason("");
              });
            }}
          >
            Add closed date
          </PrimaryButton>
        </div>

        {closures.isLoading ? (
          <Loading label="Loading closed dates…" />
        ) : closures.error ? (
          <ErrorNote error={closures.error} onRetry={() => void closures.refetch()} />
        ) : (closures.data ?? []).length === 0 ? (
          <div className="mt-4">
            <Empty title="No closed dates" description="Add public holidays or days your salon stays shut." />
          </div>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {(closures.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs">
                <span className="font-medium text-foreground">
                  {new Date(`${c.closed_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span className="truncate text-muted-foreground">{c.reason ?? ""}</span>
                <GhostButton className="ml-auto" onClick={() => void run(() => removeClosure(c.id), "Closed date removed.")}>
                  Remove
                </GhostButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
