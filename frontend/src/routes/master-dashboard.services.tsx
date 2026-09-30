import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Scissors, Trash2 } from "lucide-react";
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
  inr,
  useModal,
} from "@/lib/admin/core";
import { useAdminSalons, useAdminServices, useCategoryUsage, useServiceCategoriesAdmin } from "@/lib/admin/data";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/master-dashboard/services")({
  component: ServicesPage,
});

type ServiceRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  duration_min: number;
  is_active: boolean;
  image_url: string | null;
  salon_id: string;
};

function ServicesPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const categories = useServiceCategoriesAdmin();
  const usage = useCategoryUsage();
  const services = useAdminServices({ q });
  const catModal = useModal<{ id?: string; name?: string; slug?: string; icon?: string | null; sort_order?: number }>();
  const svcModal = useModal<Partial<ServiceRow>>();

  useRealtime(["services", "service_categories"], [["admin_services"], ["admin_service_categories"]]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin_services"] });
    void queryClient.invalidateQueries({ queryKey: ["admin_service_categories"] });
    void queryClient.invalidateQueries({ queryKey: ["admin_category_usage"] });
  };

  async function toggleCategory(id: string, active: boolean) {
    const { error } = await api.from("service_categories").update({ is_active: active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function deleteCategory(id: string, name: string) {
    const used = usage.data?.[id];
    if (used && (used.salons > 0 || used.services > 0)) {
      toast.error(
        `"${name}" is in use by ${used.salons} salon(s) and ${used.services} service(s). Disable it instead of deleting.`,
      );
      return;
    }
    if (!confirm(`Delete category "${name}"?`)) return;
    const { error } = await api.from("service_categories").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Category deleted.");
    refresh();
  }

  async function toggleService(id: string, active: boolean) {
    const { error } = await api.from("services").update({ is_active: active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function deleteService(id: string, name: string) {
    if (!confirm(`Delete service "${name}"?`)) return;
    const { error } = await api.from("services").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Service deleted.");
    refresh();
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Service Categories"
        icon={Scissors}
        action={
          <Btn onClick={() => catModal.open({})}>
            <Plus className="size-3.5" /> Add Category
          </Btn>
        }
      >
        <DataState query={categories} empty={<Empty title="No categories yet." description="Create your first service category." icon={Scissors} />}>
          {(rows) => (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Slug</Th>
                  <Th>Order</Th>
                  <Th>Used by</Th>
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <Td>{c.name}</Td>
                    <Td>{c.slug}</Td>
                    <Td>{c.sort_order}</Td>
                    <Td>
                      {usage.data
                        ? `${usage.data[c.id]?.salons ?? 0} salon(s) · ${usage.data[c.id]?.services ?? 0} service(s)`
                        : "…"}
                    </Td>
                    <Td>
                      <Badge tone={c.is_active ? "success" : "muted"}>{c.is_active ? "active" : "disabled"}</Badge>
                    </Td>
                    <Td right>
                      <div className="flex justify-end gap-1">
                        <Btn variant="soft" onClick={() => catModal.open(c)}>
                          Edit
                        </Btn>
                        <Btn variant="ghost" onClick={() => toggleCategory(c.id, !c.is_active)}>
                          {c.is_active ? "Disable" : "Enable"}
                        </Btn>
                        <Btn variant="danger" onClick={() => deleteCategory(c.id, c.name)}>
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
        title="Services"
        icon={Scissors}
        action={
          <div className="flex gap-2">
            <input className={`${inputClass} w-44`} placeholder="Search service…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Btn onClick={() => svcModal.open({})}>
              <Plus className="size-3.5" /> Add Service
            </Btn>
          </div>
        }
      >
        <DataState query={services} empty={<Empty title="No services found." description="Add services offered by the salons." icon={Scissors} />}>
          {(rows) => (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Service</Th>
                  <Th>Salon</Th>
                  <Th>Category</Th>
                  <Th>Duration</Th>
                  <Th>Price</Th>
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <Td>
                      <span className="font-medium text-foreground">{s.name}</span>
                      {s.description && <span className="block max-w-xs truncate text-muted-foreground">{s.description}</span>}
                    </Td>
                    <Td>{s.salons?.name ?? "—"}</Td>
                    <Td>{s.category}</Td>
                    <Td>{s.duration_min} min</Td>
                    <Td>{inr(s.price)}</Td>
                    <Td>
                      <Badge tone={s.is_active ? "success" : "muted"}>{s.is_active ? "active" : "disabled"}</Badge>
                    </Td>
                    <Td right>
                      <div className="flex justify-end gap-1">
                        <Btn variant="soft" onClick={() => svcModal.open(s)}>
                          Edit
                        </Btn>
                        <Btn variant="ghost" onClick={() => toggleService(s.id, !s.is_active)}>
                          {s.is_active ? "Disable" : "Enable"}
                        </Btn>
                        <Btn variant="danger" onClick={() => deleteService(s.id, s.name)}>
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
      {svcModal.state && <ServiceModal item={svcModal.state} onClose={svcModal.close} onDone={refresh} />}
    </div>
  );
}

type CategoryDraft = {
  id?: string;
  name?: string;
  slug?: string;
  icon?: string | null;
  description?: string | null;
  image_url?: string | null;
  sort_order?: number;
};

function CategoryModal({
  item,
  onClose,
  onDone,
}: {
  item: CategoryDraft;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: item.name ?? "",
    slug: item.slug ?? "",
    icon: item.icon ?? "",
    description: item.description ?? "",
    image_url: item.image_url ?? "",
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
            name: form.name.trim(),
            slug: (form.slug.trim() || form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-|-$/g, ""),
            icon: form.icon.trim() || null,
            description: form.description.trim() || null,
            image_url: form.image_url.trim() || null,
            sort_order: Number(form.sort_order) || 0,
          };
          const { error } = item.id
            ? await api.from("service_categories").update(payload).eq("id", item.id)
            : await api.from("service_categories").insert(payload);
          setBusy(false);
          if (error) { toast.error(error.message); return; }
          toast.success(item.id ? "Category updated." : "Category created.");
          onDone();
          onClose();
        }}
      >
        <Field label="Name">
          <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description (shown on the home page)">
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Icon name (optional)">
            <input className={inputClass} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="scissors" />
          </Field>
          <Field label="Image URL (optional)">
            <input className={inputClass} value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
          </Field>
        </div>
        <Btn type="submit" disabled={busy} className="w-full py-2.5">
          Save category
        </Btn>
      </form>
    </Modal>
  );
}

function ServiceModal({ item, onClose, onDone }: { item: Partial<ServiceRow>; onClose: () => void; onDone: () => void }) {
  const salons = useAdminSalons();
  const categories = useServiceCategoriesAdmin();
  const [form, setForm] = useState({
    name: item.name ?? "",
    salon_id: item.salon_id ?? "",
    category: item.category ?? "",
    description: item.description ?? "",
    price: String(item.price ?? 0),
    duration_min: String(item.duration_min ?? 30),
    image_url: item.image_url ?? "",
    is_active: item.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  return (
    <Modal title={item.id ? "Edit Service" : "Add Service"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const payload = {
            name: form.name.trim(),
            salon_id: form.salon_id,
            category: form.category.trim(),
            description: form.description.trim() || null,
            price: Number(form.price) || 0,
            duration_min: Number(form.duration_min) || 30,
            image_url: form.image_url.trim() || null,
            is_active: form.is_active,
          };
          const { error } = item.id
            ? await api.from("services").update(payload).eq("id", item.id)
            : await api.from("services").insert(payload);
          setBusy(false);
          if (error) { toast.error(error.message); return; }
          toast.success(item.id ? "Service updated." : "Service created.");
          onDone();
          onClose();
        }}
      >
        <Field label="Service name">
          <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Salon">
          <select className={inputClass} required value={form.salon_id} onChange={(e) => setForm({ ...form, salon_id: e.target.value })}>
            <option value="">Select a salon…</option>
            {(salons.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.city}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <input
            className={inputClass}
            list="service-categories"
            required
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </Field>
        <datalist id="service-categories">
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <Field label="Description">
          <textarea className={inputClass} rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₹)">
            <input className={inputClass} type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Duration (min)">
            <input className={inputClass} type="number" min={5} value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
          </Field>
        </div>
        <Field label="Image URL">
          <input className={inputClass} value={form.image_url ?? ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
        </Field>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
        </label>
        <Btn type="submit" disabled={busy} className="w-full py-2.5">
          Save service
        </Btn>
      </form>
    </Modal>
  );
}
