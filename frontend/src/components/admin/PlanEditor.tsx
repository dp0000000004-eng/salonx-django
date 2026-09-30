import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Btn, DataState, Field, inputClass } from "@/lib/admin/core";
import { savePlan, useFeatures, usePlanFeatureIds } from "@/lib/admin/gateways";
import type { PlanRow } from "@/lib/subscription";

/**
 * Super Admin configuration for the single SalonX plan.
 * The feature checklist is loaded from the live feature registry — nothing is hard-coded here.
 */
export function PlanEditor({ plan }: { plan: PlanRow }) {
  const queryClient = useQueryClient();
  const features = useFeatures();
  const planFeatures = usePlanFeatureIds(plan.id);

  const [form, setForm] = useState({
    name: plan.name,
    price: plan.price,
    billing_cycle: plan.billing_cycle,
    billing_days: plan.billing_days ?? 30,
    trial_enabled: plan.trial_enabled,
    trial_days: plan.trial_days,
    description: plan.description ?? "",
    is_active: plan.is_active,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (planFeatures.data) setSelected(planFeatures.data);
  }, [planFeatures.data]);

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const f of features.data ?? []) {
      if (!f.is_active) continue;
      const list = map.get(f.group_name) ?? [];
      list.push({ id: f.id, name: f.name });
      map.set(f.group_name, list);
    }
    return [...map.entries()];
  }, [features.data]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    setBusy(true);
    try {
      await savePlan(
        plan.id,
        {
          name: form.name.trim(),
          price: Math.max(0, Math.round(form.price)),
          billing_cycle: form.billing_cycle,
          billing_days: form.billing_cycle === "custom" ? Math.max(1, Math.round(form.billing_days)) : null,
          trial_enabled: form.trial_enabled,
          trial_days: form.trial_enabled ? Math.max(0, Math.round(form.trial_days)) : 0,
          description: form.description.trim() || null,
          is_active: form.is_active,
        },
        selected,
      );
      toast.success("Subscription configuration saved.");
      void queryClient.invalidateQueries({ queryKey: ["active_plan"] });
      void queryClient.invalidateQueries({ queryKey: ["plan_features", plan.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the subscription configuration.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-primary-soft/30 p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Subscription name">
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Price (₹)">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Billing period">
          <select className={inputClass} value={form.billing_cycle} onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom days</option>
          </select>
        </Field>
        {form.billing_cycle === "custom" && (
          <Field label="Billing days">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.billing_days}
              onChange={(e) => setForm({ ...form, billing_days: Number(e.target.value) || 1 })}
            />
          </Field>
        )}
        <Field label="Trial days">
          <input
            type="number"
            min={0}
            disabled={!form.trial_enabled}
            className={inputClass}
            value={form.trial_days}
            onChange={(e) => setForm({ ...form, trial_days: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Description">
          <input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-5 text-xs">
        <label className="flex items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={form.trial_enabled}
            onChange={(e) => setForm({ ...form, trial_enabled: e.target.checked })}
            className="size-4 accent-primary"
          />
          Free trial on
        </label>
        <label className="flex items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="size-4 accent-primary"
          />
          Plan active
        </label>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h4 className="text-xs font-semibold text-foreground">Included features</h4>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Loaded from the live SalonX feature list — new features appear here automatically.</p>
        <DataState query={features}>
          {() => (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map(([group, items]) => (
                <div key={group}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{group}</p>
                  <ul className="mt-1 space-y-1">
                    {items.map((f) => (
                      <li key={f.id}>
                        <label className="flex items-center gap-2 text-xs text-foreground">
                          <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggle(f.id)} className="size-4 accent-primary" />
                          {f.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </DataState>
      </div>

      <div className="mt-5 flex gap-2">
        <Btn onClick={() => void submit()} disabled={busy}>
          {busy ? "Saving…" : "Save subscription"}
        </Btn>
      </div>
    </div>
  );
}
