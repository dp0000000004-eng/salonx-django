import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Scissors, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import {
  Badge,
  Btn,
  DataState,
  Empty,
  Field,
  Modal,
  Panel,
  TableWrap,
  Td,
  Th,
  inputClass,
  useModal,
} from "@/lib/admin/core";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/master-dashboard/hairstyles")({
  component: HairstyleCataloguePage,
});

type CategoryRow = {
  id: string;
  group_name: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

type CatalogRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  category: string;
  category_id: string | null;
  gender: string;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
};

const GROUPS = ["Men", "Women", "Kids", "Unisex"];

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function useCategories() {
  return useQuery({
    queryKey: ["admin_hairstyle_categories"],
    queryFn: async () => {
      const { data, error } = await api
        .from("hairstyle_categories")
        .select("id, group_name, name, slug, description, sort_order, is_active")
        .order("group_name")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });
}

function useCatalogue(q: string) {
  return useQuery({
    queryKey: ["admin_hairstyle_catalog", q],
    queryFn: async () => {
      let query = api
        .from("hairstyle_catalog")
        .select("id, name, slug, description, image_url, category, category_id, gender, is_featured, is_active, sort_order")
        .order("sort_order")
        .order("name");
      if (q.trim()) query = query.ilike("name", `%${q.trim().replace(/[%,()]/g, " ")}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CatalogRow[];
    },
  });
}

function HairstyleCataloguePage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const categories = useCategories();
  const catalogue = useCatalogue(q);
  const catModal = useModal<Partial<CategoryRow>>();
  const styleModal = useModal<Partial<CatalogRow>>();

  useRealtime(
    ["hairstyle_catalog", "hairstyle_categories"],
    [["admin_hairstyle_catalog"], ["admin_hairstyle_categories"], ["hairstyle_catalog"], ["hairstyle_categories"]],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin_hairstyle_catalog"] });
    void queryClient.invalidateQueries({ queryKey: ["admin_hairstyle_categories"] });
    void queryClient.invalidateQueries({ queryKey: ["hairstyle_catalog"] });
    void queryClient.invalidateQueries({ queryKey: ["hairstyle_categories"] });
  };

  async function patchStyle(id: string, patch: Partial<CatalogRow>) {
    const { error } = await api.from("hairstyle_catalog").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function deleteStyle(row: CatalogRow) {
    if (!confirm(`Delete "${row.name}" from the master catalogue? Salons that offer it keep their own listing.`)) return;
    const { error } = await api.from("hairstyle_catalog").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Hairstyle removed from the catalogue.");
    refresh();
  }

  async function patchCategory(id: string, patch: Partial<CategoryRow>) {
    const { error } = await api.from("hairstyle_categories").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function deleteCategory(row: CategoryRow) {
    if (!confirm(`Delete category "${row.name}"?`)) return;
    const { error } = await api.from("hairstyle_categories").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Category deleted.");
    refresh();
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Hairstyle Categories"
        icon={Scissors}
        action={
          <Btn onClick={() => catModal.open({})}>
            <Plus className="size-3.5" /> Add Category
          </Btn>
        }
      >
        <DataState
          query={categories}
          empty={<Empty title="No categories yet." description="Create groups such as Men → Fade, Women → Bridal, Kids → Boys." icon={Scissors} />}
        >
          {(rows) => (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Group</Th>
                  <Th>Category</Th>
                  <Th>Slug</Th>
                  <Th>Order</Th>
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <Td>{c.group_name}</Td>
                    <Td>{c.name}</Td>
                    <Td>{c.slug}</Td>
                    <Td>{c.sort_order}</Td>
                    <Td>
                      <Badge tone={c.is_active ? "success" : "muted"}>{c.is_active ? "active" : "disabled"}</Badge>
                    </Td>
                    <Td right>
                      <div className="flex justify-end gap-1">
                        <Btn variant="soft" onClick={() => catModal.open(c)}>Edit</Btn>
                        <Btn variant="ghost" onClick={() => void patchCategory(c.id, { is_active: !c.is_active })}>
                          {c.is_active ? "Disable" : "Enable"}
                        </Btn>
                        <Btn variant="danger" onClick={() => void deleteCategory(c)}>
                          <Trash2 className="size-3.5" />
                        </Btn>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </DataState>
      </Panel>

      <Panel
        title="Master Hairstyle Catalogue"
        icon={Sparkles}
        action={
          <div className="flex gap-2">
            <input className={`${inputClass} w-44`} placeholder="Search hairstyle…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Btn onClick={() => styleModal.open({})}>
              <Plus className="size-3.5" /> Add New Hairstyle
            </Btn>
          </div>
        }
      >
        <p className="mb-3 text-xs text-muted-foreground">
          These hairstyles exist on SalonX. Each salon chooses which of them it actually offers, and sets its own price and duration.
        </p>
        <DataState
          query={catalogue}
          empty={<Empty title="No hairstyles in the catalogue." description="Add the first master hairstyle so salons can offer it." icon={Sparkles} />}
        >
          {(rows) => (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Hairstyle</Th>
                  <Th>Category</Th>
                  <Th>For</Th>
                  <Th>Editor&apos;s Pick</Th>
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="border-t border-border">
                    <Td>
                      <div className="flex items-center gap-3">
                        {h.image_url ? (
                          <img src={h.image_url} alt={h.name} loading="lazy" className="size-10 rounded-lg object-cover" />
                        ) : (
                          <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Scissors className="size-4" />
                          </span>
                        )}
                        <span>
                          <span className="block font-medium text-foreground">{h.name}</span>
                          {h.description && <span className="block max-w-xs truncate text-muted-foreground">{h.description}</span>}
                        </span>
                      </div>
                    </Td>
                    <Td>{h.category}</Td>
                    <Td className="capitalize">{h.gender}</Td>
                    <Td>
                      <Badge tone={h.is_featured ? "info" : "muted"}>{h.is_featured ? "featured" : "—"}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={h.is_active ? "success" : "muted"}>{h.is_active ? "active" : "inactive"}</Badge>
                    </Td>
                    <Td right>
                      <div className="flex justify-end gap-1">
                        <Btn variant="soft" onClick={() => styleModal.open(h)}>Edit</Btn>
                        <Btn variant="ghost" onClick={() => void patchStyle(h.id, { is_featured: !h.is_featured })}>
                          {h.is_featured ? "Unfeature" : "Feature"}
                        </Btn>
                        <Btn variant="ghost" onClick={() => void patchStyle(h.id, { is_active: !h.is_active })}>
                          {h.is_active ? "Deactivate" : "Activate"}
                        </Btn>
                        <Btn variant="danger" onClick={() => void deleteStyle(h)}>
                          <Trash2 className="size-3.5" />
                        </Btn>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </DataState>
      </Panel>

      {catModal.state && <CategoryModal item={catModal.state} onClose={catModal.close} onDone={refresh} />}
      {styleModal.state && (
        <HairstyleModal item={styleModal.state} categories={categories.data ?? []} onClose={styleModal.close} onDone={refresh} />
      )}
    </div>
  );
}

function CategoryModal({
  item,
  onClose,
  onDone,
}: {
  item: Partial<CategoryRow>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    group_name: item.group_name ?? "Men",
    name: item.name ?? "",
    slug: item.slug ?? "",
    description: item.description ?? "",
    sort_order: String(item.sort_order ?? 0),
  });
  const [busy, setBusy] = useState(false);

  return (
    <Modal title={item.id ? "Edit Category" : "Add Category"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const payload = {
            group_name: form.group_name,
            name: form.name.trim(),
            slug: slugify(form.slug || `${form.group_name}-${form.name}`),
            description: form.description.trim() || null,
            sort_order: Number(form.sort_order) || 0,
          };
          const { error } = item.id
            ? await api.from("hairstyle_categories").update(payload).eq("id", item.id)
            : await api.from("hairstyle_categories").insert(payload);
          setBusy(false);
          if (error) { toast.error(error.message); return; }
          toast.success(item.id ? "Category updated." : "Category created.");
          onDone();
          onClose();
        }}
      >
        <Field label="Group">
          <select className={inputClass} value={form.group_name} onChange={(e) => setForm({ ...form, group_name: e.target.value })}>
            {GROUPS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label="Category name">
          <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fade, Undercut, Bridal…" />
        </Field>
        <Field label="Description (optional)">
          <textarea className={inputClass} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Slug (optional)">
            <input className={inputClass} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
          <Field label="Sort order">
            <input className={inputClass} type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          </Field>
        </div>
        <Btn type="submit" disabled={busy} className="w-full py-2.5">Save category</Btn>
      </form>
    </Modal>
  );
}

function HairstyleModal({
  item,
  categories,
  onClose,
  onDone,
}: {
  item: Partial<CatalogRow>;
  categories: CategoryRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: item.name ?? "",
    category_id: item.category_id ?? "",
    category: item.category ?? "",
    gender: item.gender ?? "unisex",
    description: item.description ?? "",
    image_url: item.image_url ?? "",
    sort_order: String(item.sort_order ?? 0),
    is_featured: item.is_featured ?? false,
    is_active: item.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const active = categories.filter((c) => c.is_active);

  return (
    <Modal title={item.id ? "Edit Hairstyle" : "Add New Hairstyle"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const chosen = active.find((c) => c.id === form.category_id);
          if (!chosen && !form.category.trim()) {
            toast.error("Choose a category first.");
            return;
          }
          setBusy(true);
          const payload = {
            name: form.name.trim(),
            slug: slugify(form.name),
            category_id: form.category_id || null,
            category: chosen ? chosen.name : form.category.trim(),
            gender: form.gender,
            description: form.description.trim() || null,
            image_url: form.image_url.trim() || null,
            sort_order: Number(form.sort_order) || 0,
            is_featured: form.is_featured,
            is_active: form.is_active,
          };
          const { error } = item.id
            ? await api.from("hairstyle_catalog").update(payload).eq("id", item.id)
            : await api.from("hairstyle_catalog").insert(payload);
          setBusy(false);
          if (error) { toast.error(error.message); return; }
          toast.success(item.id ? "Hairstyle updated." : "Hairstyle added to the catalogue.");
          onDone();
          onClose();
        }}
      >
        <Field label="Hairstyle name">
          <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Low Fade" />
        </Field>
        <Field label="Category">
          <select
            className={inputClass}
            value={form.category_id}
            onChange={(e) => {
              const chosen = active.find((c) => c.id === e.target.value);
              setForm({ ...form, category_id: e.target.value, category: chosen?.name ?? form.category });
            }}
          >
            <option value="">{active.length ? "Select a category…" : "No categories yet — add one above"}</option>
            {active.map((c) => (
              <option key={c.id} value={c.id}>
                {c.group_name} — {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="For">
          <select className={inputClass} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="male">Men</option>
            <option value="female">Women</option>
            <option value="unisex">Unisex</option>
            <option value="kids">Kids</option>
          </select>
        </Field>
        <Field label="Description">
          <textarea
            className={inputClass}
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Clean fade with short sides…"
          />
        </Field>
        <Field label="Image URL">
          <input className={inputClass} value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
        </Field>
        {form.image_url.trim() && (
          <img src={form.image_url} alt="Hairstyle preview" className="h-28 w-full rounded-lg object-cover" />
        )}
        <Field label="Sort order">
          <input className={inputClass} type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
        </Field>
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
            Featured / Editor&apos;s Pick
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active (visible to customers)
          </label>
        </div>
        <Btn type="submit" disabled={busy} className="w-full py-2.5">Save hairstyle</Btn>
      </form>
    </Modal>
  );
}
