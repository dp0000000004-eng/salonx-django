import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift } from "lucide-react";
import { saveOwnerLoyaltyRule, useOwnerLoyaltyRule, type LoyaltyRule } from "@/lib/loyalty";
import { ErrorNote, Field, Loading, PrimaryButton, inputClass } from "@/components/owner/shared";

const DEFAULTS: LoyaltyRule = {
  points_per_hundred: 10,
  point_value_rupees: 1,
  min_redeem_points: 50,
  max_redeem_percent: 50,
  is_active: true,
};

export function OwnerLoyaltySettings({ salonId }: { salonId: string }) {
  const queryClient = useQueryClient();
  const rule = useOwnerLoyaltyRule(salonId);

  const [form, setForm] = useState<LoyaltyRule>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!rule.data) return;
    setForm({
      points_per_hundred: rule.data.points_per_hundred,
      point_value_rupees: Number(rule.data.point_value_rupees),
      min_redeem_points: rule.data.min_redeem_points,
      max_redeem_percent: rule.data.max_redeem_percent,
      is_active: rule.data.is_active,
    });
  }, [rule.data]);

  async function save() {
    setSaving(true);
    try {
      await saveOwnerLoyaltyRule(salonId, form);
      toast.success("Loyalty settings saved.");
      void queryClient.invalidateQueries({ queryKey: ["owner_loyalty_rule", salonId] });
      void queryClient.invalidateQueries({ queryKey: ["loyalty_rule", salonId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save loyalty settings.");
    }
    setSaving(false);
  }

  if (rule.isLoading) return <Loading label="Loading loyalty settings…" />;
  if (rule.error) return <ErrorNote error={rule.error} onRetry={() => void rule.refetch()} />;

  const exampleBill = 1000;
  const earned = Math.floor((exampleBill / 100) * form.points_per_hundred);
  const maxOff = Math.floor((exampleBill * form.max_redeem_percent) / 100);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="salonx-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Gift className="size-4 text-primary" /> Loyalty &amp; rewards
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Decide how many points your customers earn and how they can spend them at your salon.
        </p>

        <label className="mt-4 flex items-center gap-2 rounded-lg border border-border p-3 text-xs text-foreground">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          Loyalty programme is running
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Points earned per ₹100 spent">
            <input
              type="number"
              min={0}
              max={100}
              value={form.points_per_hundred}
              onChange={(e) => setForm((f) => ({ ...f, points_per_hundred: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>
          <Field label="Value of 1 point (₹)">
            <input
              type="number"
              min={0.01}
              max={100}
              step={0.5}
              value={form.point_value_rupees}
              onChange={(e) => setForm((f) => ({ ...f, point_value_rupees: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>
          <Field label="Minimum points needed to redeem">
            <input
              type="number"
              min={1}
              max={100000}
              value={form.min_redeem_points}
              onChange={(e) => setForm((f) => ({ ...f, min_redeem_points: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>
          <Field label="Maximum bill payable with points (%)">
            <input
              type="number"
              min={1}
              max={100}
              value={form.max_redeem_percent}
              onChange={(e) => setForm((f) => ({ ...f, max_redeem_percent: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>
        </div>

        <PrimaryButton busy={saving} disabled={saving} onClick={() => void save()} className="mt-4">
          {saving ? "Saving…" : "Save loyalty settings"}
        </PrimaryButton>
      </section>

      <section className="salonx-card p-5">
        <h2 className="text-sm font-semibold text-foreground">How it works for your customers</h2>
        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
          <li>
            On a ₹{exampleBill} bill a customer earns <span className="font-medium text-foreground">{earned} points</span>.
          </li>
          <li>
            Points are worth <span className="font-medium text-foreground">₹{form.point_value_rupees}</span> each and can only
            be used at your salon.
          </li>
          <li>
            They can start using points from{" "}
            <span className="font-medium text-foreground">{form.min_redeem_points} points</span>.
          </li>
          <li>
            On a ₹{exampleBill} bill, points can cover at most{" "}
            <span className="font-medium text-foreground">₹{maxOff}</span> ({form.max_redeem_percent}%).
          </li>
          {!form.is_active && (
            <li className="text-foreground">Programme is switched off, so customers cannot redeem points right now.</li>
          )}
        </ul>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Points are added automatically when you mark an appointment as paid.
        </p>
      </section>
    </div>
  );
}
