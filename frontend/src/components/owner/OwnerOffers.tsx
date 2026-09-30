import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Percent, Plus } from "lucide-react";
import { Panel } from "@/components/salonx/DashboardShell";
import { api } from "@/lib/api-client";
import { useOwnerOffers } from "@/lib/owner-queries";
import { formatMoney } from "@/lib/queries";
import {
  ConfirmDialog,
  Empty,
  ErrorNote,
  Field,
  GhostButton,
  Loading,
  Modal,
  PrimaryButton,
  inputClass,
} from "@/components/owner/shared";

type OfferRow = {
  id: string;
  code: string;
  title: string | null;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_amount: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
};

const blank = {
  code: "",
  title: "",
  description: "",
  discount_type: "percent",
  discount_value: "10",
  min_amount: "0",
  max_discount: "",
  usage_limit: "",
  starts_at: new Date().toISOString().slice(0, 10),
  expires_at: "",
  is_active: true,
};

export function OwnerOffers({ salonId }: { salonId: string }) {
  const offers = useOwnerOffers(salonId);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<typeof blank | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function save() {
    if (!form) return;
    const code = form.code.trim().toUpperCase();
    if (!code) {
      toast.error("Offer code is required.");
      return;
    }
    const value = Number(form.discount_value);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid discount value.");
      return;
    }
    if (form.discount_type === "percent" && value > 100) {
      toast.error("A percentage discount cannot be above 100.");
      return;
    }
    if (form.expires_at && form.expires_at < form.starts_at) {
      toast.error("The end date must be after the start date.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        salon_id: salonId,
        code,
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: Math.round(value),
        min_amount: Math.round(Number(form.min_amount) || 0),
        max_discount: form.max_discount ? Math.round(Number(form.max_discount)) : null,
        usage_limit: form.usage_limit ? Math.round(Number(form.usage_limit)) : null,
        starts_at: new Date(`${form.starts_at}T00:00:00`).toISOString(),
        expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null,
        is_active: form.is_active,
      };
      const { error } = editId
        ? await api.from("coupons").update(payload).eq("id", editId)
        : await api.from("coupons").insert(payload);
      if (error) throw error;
      toast.success(editId ? "Offer updated" : "Offer created");
      setForm(null);
      setEditId(null);
      await queryClient.invalidateQueries({ queryKey: ["owner_offers", salonId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await api.from("coupons").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Offer deleted");
    await queryClient.invalidateQueries({ queryKey: ["owner_offers", salonId] });
  }

  async function toggle(row: OfferRow) {
    const { error } = await api.from("coupons").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["owner_offers", salonId] });
  }

  if (offers.isLoading) return <Loading label="Loading your offers…" />;
  if (offers.error) return <ErrorNote error={offers.error} onRetry={() => void offers.refetch()} />;

  const rows = (offers.data ?? []) as OfferRow[];

  return (
    <Panel
      title={`Offers & discounts (${rows.length})`}
      icon={Percent}
      action={
        <PrimaryButton
          onClick={() => {
            setEditId(null);
            setForm({ ...blank });
          }}
        >
          <Plus className="size-3.5" /> New offer
        </PrimaryButton>
      }
    >
      {rows.length === 0 ? (
        <Empty title="No offers yet" description="Create a discount code to attract more bookings." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((o) => {
            const expired = !!o.expires_at && new Date(o.expires_at) < new Date();
            return (
              <div key={o.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{o.title || o.code}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-primary">{o.code}</p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-[10px] font-medium ${
                      expired
                        ? "bg-muted text-muted-foreground"
                        : o.is_active
                          ? "bg-success/15 text-success"
                          : "bg-warning/20 text-warning"
                    }`}
                  >
                    {expired ? "Expired" : o.is_active ? "Active" : "Paused"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {o.discount_type === "percent" ? `${o.discount_value}% off` : `${formatMoney(o.discount_value)} off`}
                  {o.min_amount > 0 ? ` · min ${formatMoney(o.min_amount)}` : ""}
                  {o.max_discount ? ` · up to ${formatMoney(o.max_discount)}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Used {o.used_count}
                  {o.usage_limit ? ` of ${o.usage_limit}` : ""} ·{" "}
                  {o.expires_at
                    ? `until ${new Date(o.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : "no end date"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <GhostButton
                    onClick={() => {
                      setEditId(o.id);
                      setForm({
                        code: o.code,
                        title: o.title ?? "",
                        description: o.description ?? "",
                        discount_type: o.discount_type,
                        discount_value: String(o.discount_value),
                        min_amount: String(o.min_amount),
                        max_discount: o.max_discount ? String(o.max_discount) : "",
                        usage_limit: o.usage_limit ? String(o.usage_limit) : "",
                        starts_at: o.starts_at.slice(0, 10),
                        expires_at: o.expires_at ? o.expires_at.slice(0, 10) : "",
                        is_active: o.is_active,
                      });
                    }}
                  >
                    Edit
                  </GhostButton>
                  <GhostButton onClick={() => void toggle(o)}>{o.is_active ? "Pause" : "Activate"}</GhostButton>
                  <GhostButton onClick={() => setConfirmId(o.id)}>Delete</GhostButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={editId ? "Edit offer" : "New offer"} wide>
        {form && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Offer code">
                <input
                  className={inputClass}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="FIRST20"
                />
              </Field>
              <Field label="Title">
                <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className={inputClass}
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Discount type">
                <select
                  className={inputClass}
                  value={form.discount_type}
                  onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                >
                  <option value="percent">Percentage</option>
                  <option value="flat">Flat amount</option>
                </select>
              </Field>
              <Field label={form.discount_type === "percent" ? "Discount (%)" : "Discount (₹)"}>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                />
              </Field>
              <Field label="Minimum bill (₹)">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={form.min_amount}
                  onChange={(e) => setForm({ ...form, min_amount: e.target.value })}
                />
              </Field>
              <Field label="Maximum discount (₹, optional)">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={form.max_discount}
                  onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
                />
              </Field>
              <Field label="Usage limit (optional)">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={form.usage_limit}
                  onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                />
              </Field>
              <Field label="Starts on">
                <input
                  type="date"
                  className={inputClass}
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </Field>
              <Field label="Ends on (optional)">
                <input
                  type="date"
                  className={inputClass}
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Offer is active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <GhostButton onClick={() => setForm(null)}>Cancel</GhostButton>
              <PrimaryButton busy={busy} onClick={() => void save()}>
                {editId ? "Save changes" : "Create offer"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        title="Delete offer"
        message="Customers will no longer be able to use this code."
        confirmLabel="Delete"
        onConfirm={() => remove(confirmId!)}
        onClose={() => setConfirmId(null)}
      />
    </Panel>
  );
}
