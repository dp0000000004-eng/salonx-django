import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Plus } from "lucide-react";
import { Panel } from "@/components/salonx/DashboardShell";
import {
  ConfirmDialog,
  Empty,
  ErrorNote,
  Field,
  GhostButton,
  ImageUploader,
  Loading,
  MediaImage,
  Modal,
  PrimaryButton,
  inputClass,
} from "@/components/owner/shared";
import { api } from "@/lib/api-client";
import { useOwnerPackages } from "@/lib/owner-queries";
import { formatMoney } from "@/lib/queries";

type PackageRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_min: number;
  image_url: string | null;
  included_services: string[];
  is_active: boolean;
};

const blank = {
  name: "",
  description: "",
  price: "",
  duration_min: "120",
  image_url: null as string | null,
  included: "",
  is_active: true,
};

export function OwnerPackages({ salonId }: { salonId: string }) {
  const packages = useOwnerPackages(salonId);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<typeof blank | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { toast.error("Package name is required."); return; }
    const price = Number(form.price);
    const duration = Number(form.duration_min);
    if (!Number.isFinite(price) || price < 0) { toast.error("Enter a valid price."); return; }
    if (!Number.isFinite(duration) || duration < 15) { toast.error("Duration must be at least 15 minutes."); return; }
    setBusy(true);
    try {
      const payload = {
        salon_id: salonId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Math.round(price),
        duration_min: Math.round(duration),
        image_url: form.image_url,
        included_services: form.included
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        is_active: form.is_active,
      };
      const { error } = editId
        ? await api.from("wedding_packages").update(payload).eq("id", editId)
        : await api.from("wedding_packages").insert(payload);
      if (error) throw error;
      toast.success(editId ? "Package updated" : "Package added");
      setForm(null);
      setEditId(null);
      await queryClient.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await api.from("wedding_packages").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Package removed");
      await queryClient.invalidateQueries();
    }
  }

  if (packages.isLoading) return <Loading label="Loading packages…" />;
  if (packages.error) return <ErrorNote error={packages.error} onRetry={() => void packages.refetch()} />;

  const rows = (packages.data ?? []) as PackageRow[];

  return (
    <Panel
      title={`Wedding packages (${rows.length})`}
      icon={Gift}
      action={
        <PrimaryButton
          onClick={() => {
            setEditId(null);
            setForm({ ...blank });
          }}
        >
          <Plus className="size-3.5" /> Add package
        </PrimaryButton>
      }
    >
      {rows.length === 0 ? (
        <Empty title="No packages yet" description="Create bridal or wedding packages that customers can book directly." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <article key={p.id} className="rounded-xl border border-border p-3">
              <MediaImage path={p.image_url} alt={p.name} className="mb-3 h-28 w-full rounded-lg object-cover" />
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate text-xs font-semibold text-foreground">{p.name}</h3>
                <span className={`rounded-md px-2 py-0.5 text-[10px] ${p.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {p.is_active ? "Active" : "Hidden"}
                </span>
              </div>
              {p.description && <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{p.description}</p>}
              {p.included_services.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1">
                  {p.included_services.map((s) => (
                    <li key={s} className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs font-medium text-foreground">
                {formatMoney(p.price)} · {p.duration_min} min
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <GhostButton
                  onClick={() => {
                    setEditId(p.id);
                    setForm({
                      name: p.name,
                      description: p.description ?? "",
                      price: String(p.price),
                      duration_min: String(p.duration_min),
                      image_url: p.image_url,
                      included: p.included_services.join(", "),
                      is_active: p.is_active,
                    });
                  }}
                >
                  Edit
                </GhostButton>
                <GhostButton className="text-destructive" onClick={() => setConfirmId(p.id)}>
                  Delete
                </GhostButton>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={editId ? "Edit package" : "Add package"}>
        {form && (
          <div className="space-y-3">
            <Field label="Package name">
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (₹)">
                <input className={inputClass} inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </Field>
              <Field label="Duration (minutes)">
                <input className={inputClass} inputMode="numeric" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
              </Field>
            </div>
            <Field label="What's included (comma separated)">
              <input className={inputClass} value={form.included} onChange={(e) => setForm({ ...form, included: e.target.value })} />
            </Field>
            <Field label="Photo">
              <ImageUploader salonId={salonId} folder="packages" value={form.image_url} onChange={(p) => setForm({ ...form, image_url: p })} />
            </Field>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Visible to customers
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <GhostButton onClick={() => setForm(null)}>Cancel</GhostButton>
              <PrimaryButton busy={busy} onClick={() => void save()}>
                {editId ? "Save changes" : "Add package"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        title="Delete package"
        message="Customers will no longer be able to book this package."
        confirmLabel="Delete"
        onConfirm={() => remove(confirmId!)}
        onClose={() => setConfirmId(null)}
      />
    </Panel>
  );
}
