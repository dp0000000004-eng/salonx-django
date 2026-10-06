import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LayoutGrid, Plus, Scissors } from "lucide-react";
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
import { useOwnerServices } from "@/lib/owner-queries";
import { formatMoney, useSalonPlatformCategories, useServiceCategories } from "@/lib/queries";

type ServiceRow = {
  id: string;
  name: string;
  category: string;
  category_id: string | null;
  description: string | null;
  price: number;
  duration_min: number;
  image_url: string | null;
  is_active: boolean;
};

const blank = {
  name: "",
  category_id: "",
  description: "",
  price: "",
  duration_min: "30",
  image_url: null as string | null,
  is_active: true,
};

export function OwnerServices({ salonId }: { salonId: string }) {
  const services = useOwnerServices(salonId);
  const categories = useServiceCategories();
  const chosen = useSalonPlatformCategories(salonId);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<typeof blank | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const chosenIds = useMemo(() => new Set(chosen.data ?? []), [chosen.data]);
  const bookableCategories = useMemo(
    () => (categories.data ?? []).filter((c) => chosenIds.has(c.id)),
    [categories.data, chosenIds],
  );

  async function toggleCategory(categoryId: string, on: boolean) {
    if (categoryBusy) return;
    setCategoryBusy(true);
    try {
      const { error } = on
        ? await api.from("salon_categories").insert({ salon_id: salonId, category_id: categoryId })
        : await api
            .from("salon_categories")
            .delete()
            .eq("salon_id", salonId)
            .eq("category_id", categoryId);
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: ["salon_categories", salonId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update salon category.");
      await queryClient.invalidateQueries({ queryKey: ["salon_categories", salonId] });
    } finally {
      setCategoryBusy(false);
    }
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      toast.error("Service name is required.");
      return;
    }
    if (!form.category_id) {
      toast.error("Choose a category for this service.");
      return;
    }
    const price = Number(form.price);
    const duration = Number(form.duration_min);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid price.");
      return;
    }
    if (!Number.isFinite(duration) || duration < 5) {
      toast.error("Duration must be at least 5 minutes.");
      return;
    }
    const category = (categories.data ?? []).find((c) => c.id === form.category_id);
    setBusy(true);
    try {
      const payload = {
        salon_id: salonId,
        name: form.name.trim(),
        category_id: form.category_id,
        category: category?.name ?? "",
        description: form.description.trim() || null,
        price: Math.round(price),
        duration_min: Math.round(duration),
        image_url: form.image_url,
        is_active: form.is_active,
      };
      const { error } = editId
        ? await api.from("services").update(payload).eq("id", editId)
        : await api.from("services").insert(payload);
      if (error) throw error;
      toast.success(editId ? "Service updated" : "Service added");
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
    const { error } = await api.from("services").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Service removed");
      await queryClient.invalidateQueries();
    }
  }

  async function toggle(row: ServiceRow) {
    const { error } = await api
      .from("services")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else await queryClient.invalidateQueries();
  }

  if (services.isLoading) return <Loading label="Loading services…" />;
  if (services.error)
    return <ErrorNote error={services.error} onRetry={() => void services.refetch()} />;

  const rows = (services.data ?? []) as unknown as ServiceRow[];

  return (
    <div className="space-y-4">
      <Panel title="Categories you offer" icon={LayoutGrid}>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Tick the categories your salon works in. Customers browsing a category will find you only
          when you also add your own services under it — ticking a category never creates services
          for you.
        </p>
        {categories.isLoading ? (
          <Loading label="Loading categories…" />
        ) : categories.error ? (
          <ErrorNote error={categories.error} onRetry={() => void categories.refetch()} />
        ) : (categories.data ?? []).length === 0 ? (
          <Empty
            title="No categories yet"
            description="The SalonX team has not published any categories."
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {(categories.data ?? []).map((c) => (
              <label
                key={c.id}
                className="flex items-start gap-2 rounded-xl border border-border p-3 text-xs"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={chosenIds.has(c.id)}
                  disabled={categoryBusy}
                  onChange={(e) => void toggleCategory(c.id, e.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{c.name}</span>
                  {c.description && (
                    <span className="block text-[11px] text-muted-foreground">{c.description}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={`Services (${rows.length})`}
        icon={Scissors}
        action={
          <PrimaryButton
            onClick={() => {
              setEditId(null);
              setForm({ ...blank });
            }}
          >
            <Plus className="size-3.5" /> Add service
          </PrimaryButton>
        }
      >
        {rows.length === 0 ? (
          <Empty
            title="No services yet"
            description="Add your first service so customers can book it."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((s) => (
              <article key={s.id} className="rounded-xl border border-border p-3">
                <MediaImage
                  path={s.image_url}
                  alt={s.name}
                  className="mb-3 h-28 w-full rounded-lg object-cover"
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-xs font-semibold text-foreground">{s.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{s.category}</p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] ${s.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                  >
                    {s.is_active ? "Active" : "Hidden"}
                  </span>
                </div>
                {s.description && (
                  <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
                    {s.description}
                  </p>
                )}
                <p className="mt-2 text-xs font-medium text-foreground">
                  {formatMoney(s.price)} · {s.duration_min} min
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <GhostButton
                    onClick={() => {
                      setEditId(s.id);
                      setForm({
                        name: s.name,
                        category_id: s.category_id ?? "",
                        description: s.description ?? "",
                        price: String(s.price),
                        duration_min: String(s.duration_min),
                        image_url: s.image_url,
                        is_active: s.is_active,
                      });
                    }}
                  >
                    Edit
                  </GhostButton>
                  <GhostButton onClick={() => void toggle(s)}>
                    {s.is_active ? "Hide" : "Show"}
                  </GhostButton>
                  <GhostButton className="text-destructive" onClick={() => setConfirmId(s.id)}>
                    Delete
                  </GhostButton>
                </div>
              </article>
            ))}
          </div>
        )}

        <Modal
          open={!!form}
          onClose={() => setForm(null)}
          title={editId ? "Edit service" : "Add service"}
        >
          {form && (
            <div className="space-y-3">
              <Field label="Service name">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Category">
                <select
                  className={inputClass}
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                >
                  <option value="">Select a category…</option>
                  {(bookableCategories.length > 0
                    ? bookableCategories
                    : (categories.data ?? [])
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {bookableCategories.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Tip: tick the categories you offer above so your salon shows up in category
                  browsing.
                </p>
              )}
              <Field label="Description">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (₹)">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </Field>
                <Field label="Duration (minutes)">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.duration_min}
                    onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Photo">
                <ImageUploader
                  salonId={salonId}
                  folder="services"
                  value={form.image_url}
                  onChange={(p) => setForm({ ...form, image_url: p })}
                />
              </Field>
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Visible to customers
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <GhostButton onClick={() => setForm(null)}>Cancel</GhostButton>
                <PrimaryButton busy={busy} onClick={() => void save()}>
                  {editId ? "Save changes" : "Add service"}
                </PrimaryButton>
              </div>
            </div>
          )}
        </Modal>

        <ConfirmDialog
          open={!!confirmId}
          title="Delete service"
          message="This service will no longer be bookable. Existing appointments keep their details."
          confirmLabel="Delete"
          onConfirm={() => remove(confirmId!)}
          onClose={() => setConfirmId(null)}
        />
      </Panel>
    </div>
  );
}
