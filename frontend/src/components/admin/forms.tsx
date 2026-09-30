import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Btn, Field, Modal, inputClass } from "@/lib/admin/core";
import { useAdminSalons, useLocations } from "@/lib/admin/data";
import { createAdminAccount } from "@/lib/admin/admins.functions";

function useSubmit(invalidate: string[][]) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: async (fn: () => Promise<void>, success: string, done?: () => void) => {
      setBusy(true);
      try {
        await fn();
        for (const key of invalidate) void queryClient.invalidateQueries({ queryKey: key });
        void queryClient.invalidateQueries({ queryKey: ["admin_kpis"] });
        toast.success(success);
        done?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
  };
}

function Submit({ busy, label }: { busy: boolean; label: string }) {
  return (
    <Btn type="submit" disabled={busy} className="w-full py-2.5">
      {busy && <Loader2 className="size-4 animate-spin" />} {label}
    </Btn>
  );
}

/* ------------------------------------------------------------------ salon */

export type SalonDraft = {
  id?: string;
  name?: string;
  city?: string;
  area?: string | null;
  address?: string | null;
  phone?: string | null;
  starting_price?: number;
  commission_rate?: number | null;
  status?: string;
};

export function SalonFormModal({ salon, onClose }: { salon?: SalonDraft; onClose: () => void }) {
  const { busy, run } = useSubmit([["admin_salons"], ["admin_recent_salons"]]);
  const [form, setForm] = useState({
    name: salon?.name ?? "",
    city: salon?.city ?? "",
    area: salon?.area ?? "",
    address: salon?.address ?? "",
    phone: salon?.phone ?? "",
    starting_price: String(salon?.starting_price ?? 0),
    commission_rate: salon?.commission_rate == null ? "" : String(salon.commission_rate),
    status: salon?.status ?? "pending",
  });

  return (
    <Modal title={salon?.id ? "Edit Salon" : "Add New Salon"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            async () => {
              const payload = {
                name: form.name.trim(),
                city: form.city.trim(),
                area: form.area.trim() || null,
                address: form.address.trim() || null,
                phone: form.phone.trim() || null,
                starting_price: Number(form.starting_price) || 0,
                commission_rate: form.commission_rate === "" ? null : Number(form.commission_rate),
                status: form.status as "pending",
              };
              if (salon?.id) {
                const { error } = await api.from("salons").update(payload).eq("id", salon.id);
                if (error) throw error;
              } else {
                const { error } = await api.from("salons").insert(payload);
                if (error) throw error;
              }
            },
            salon?.id ? "Salon updated." : "Salon created.",
            onClose,
          );
        }}
      >
        <Field label="Salon Name">
          <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <input className={inputClass} required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Area">
            <input className={inputClass} value={form.area ?? ""} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          </Field>
        </div>
        <Field label="Address">
          <input className={inputClass} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input className={inputClass} value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Starting Price (₹)">
            <input className={inputClass} type="number" min={0} value={form.starting_price} onChange={(e) => setForm({ ...form, starting_price: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Commission override (%)">
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              step="0.1"
              placeholder="Platform default"
              value={form.commission_rate}
              onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {["pending", "approved", "rejected", "suspended"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Submit busy={busy} label={salon?.id ? "Save Changes" : "Create Salon"} />
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ admin */

export function AdminFormModal({ onClose }: { onClose: () => void }) {
  const { busy, run } = useSubmit([["admin_roles"], ["admin_customers"], ["admin_system_overview"]]);
  const salons = useAdminSalons();
  const create = useServerFn(createAdminAccount);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", phone: "", salonId: "" });

  return (
    <Modal title="Add New Admin" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            async () => {
              await create({
                data: {
                  fullName: form.fullName.trim(),
                  email: form.email.trim(),
                  password: form.password,
                  ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
                  ...(form.salonId ? { salonId: form.salonId } : {}),
                },
              });
            },
            "Admin account created.",
            onClose,
          );
        }}
      >
        <Field label="Full Name">
          <input className={inputClass} required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputClass} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Temporary Password">
            <input className={inputClass} type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <Field label="Assign Salon (optional)">
          <select className={inputClass} value={form.salonId} onChange={(e) => setForm({ ...form, salonId: e.target.value })}>
            <option value="">No salon</option>
            {(salons.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.city}
              </option>
            ))}
          </select>
        </Field>
        <Submit busy={busy} label="Create Admin" />
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------------- location */

export function LocationFormModal({ onClose, preset }: { onClose: () => void; preset?: { level?: string; parentId?: string } }) {
  const { busy, run } = useSubmit([["admin_locations"]]);
  const locations = useLocations();
  const [form, setForm] = useState({ level: preset?.level ?? "city", name: "", parent_id: preset?.parentId ?? "" });
  const parents = (locations.data ?? []).filter((l) => (form.level === "city" ? l.level === "state" : l.level === "city"));

  return (
    <Modal title="Add City / Area" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            async () => {
              const { error } = await api.from("locations").insert({
                level: form.level,
                name: form.name.trim(),
                parent_id: form.parent_id || null,
              });
              if (error) throw new Error(error.code === "23505" ? "That location already exists." : error.message);
            },
            "Location added.",
            onClose,
          );
        }}
      >
        <Field label="Level">
          <select className={inputClass} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value, parent_id: "" })}>
            <option value="state">State</option>
            <option value="city">City</option>
            <option value="area">Area / Locality</option>
          </select>
        </Field>
        {form.level !== "state" && (
          <Field label={form.level === "city" ? "State" : "City"}>
            <select className={inputClass} value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} required>
              <option value="">Select…</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Name">
          <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Submit busy={busy} label="Add Location" />
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ offer */

export type OfferDraft = {
  id?: string;
  code?: string;
  title?: string | null;
  description?: string | null;
  discount_type?: string;
  discount_value?: number;
  min_amount?: number;
  max_discount?: number | null;
  starts_at?: string;
  expires_at?: string | null;
  banner_url?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
};

const dateInput = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");

export function OfferFormModal({ offer, bannerOnly = false, onClose }: { offer?: OfferDraft; bannerOnly?: boolean; onClose: () => void }) {
  const { busy, run } = useSubmit([["admin_coupons"], ["offers"]]);
  const [form, setForm] = useState({
    code: offer?.code ?? "",
    title: offer?.title ?? "",
    description: offer?.description ?? "",
    discount_type: offer?.discount_type ?? "percent",
    discount_value: String(offer?.discount_value ?? 10),
    min_amount: String(offer?.min_amount ?? 0),
    max_discount: offer?.max_discount == null ? "" : String(offer.max_discount),
    starts_at: dateInput(offer?.starts_at) || new Date().toISOString().slice(0, 10),
    expires_at: dateInput(offer?.expires_at),
    banner_url: offer?.banner_url ?? "",
    is_active: offer?.is_active ?? true,
    is_featured: offer?.is_featured ?? bannerOnly,
  });

  return (
    <Modal title={offer?.id ? "Edit Offer" : bannerOnly ? "Upload Banner" : "Create Offer"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            async () => {
              const payload = {
                code: form.code.trim().toUpperCase(),
                title: form.title.trim() || null,
                description: form.description.trim() || null,
                discount_type: form.discount_type,
                discount_value: Number(form.discount_value) || 0,
                min_amount: Number(form.min_amount) || 0,
                max_discount: form.max_discount === "" ? null : Number(form.max_discount),
                starts_at: new Date(form.starts_at + "T00:00:00").toISOString(),
                expires_at: form.expires_at ? new Date(form.expires_at + "T23:59:59").toISOString() : null,
                banner_url: form.banner_url.trim() || null,
                is_active: form.is_active,
                is_featured: form.is_featured,
              };
              if (offer?.id) {
                const { error } = await api.from("coupons").update(payload).eq("id", offer.id);
                if (error) throw error;
              } else {
                const { error } = await api.from("coupons").insert(payload);
                if (error) throw error;
              }
            },
            offer?.id ? "Offer updated." : "Offer created.",
            onClose,
          );
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code">
            <input className={inputClass} required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Title">
            <input className={inputClass} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
        </div>
        <Field label="Description">
          <input className={inputClass} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Type">
            <select className={inputClass} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
              <option value="percent">Percent</option>
              <option value="flat">Flat ₹</option>
            </select>
          </Field>
          <Field label="Value">
            <input className={inputClass} type="number" min={0} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
          </Field>
          <Field label="Min ₹">
            <input className={inputClass} type="number" min={0} value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <input className={inputClass} type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          </Field>
          <Field label="Expires">
            <input className={inputClass} type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          </Field>
        </div>
        <Field label="Banner image URL">
          <input className={inputClass} value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} placeholder="https://…" />
        </Field>
        <div className="flex gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Featured banner
          </label>
        </div>
        <Submit busy={busy} label={offer?.id ? "Save Offer" : "Create Offer"} />
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------- announcement */

export type AnnouncementDraft = {
  id?: string;
  title?: string;
  body?: string | null;
  image_url?: string | null;
  audience?: string;
  is_published?: boolean;
  starts_at?: string;
  ends_at?: string | null;
};

export function AnnouncementFormModal({ item, onClose }: { item?: AnnouncementDraft; onClose: () => void }) {
  const { busy, run } = useSubmit([["admin_announcements"]]);
  const [form, setForm] = useState({
    title: item?.title ?? "",
    body: item?.body ?? "",
    image_url: item?.image_url ?? "",
    audience: item?.audience ?? "all",
    is_published: item?.is_published ?? true,
    starts_at: item?.starts_at ? new Date(item.starts_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    ends_at: item?.ends_at ? new Date(item.ends_at).toISOString().slice(0, 16) : "",
  });

  return (
    <Modal title={item?.id ? "Edit Announcement" : "New Announcement"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            async () => {
              const payload = {
                title: form.title.trim(),
                body: form.body.trim() || null,
                image_url: form.image_url.trim() || null,
                audience: form.audience,
                is_published: form.is_published,
                starts_at: new Date(form.starts_at).toISOString(),
                ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
              };
              if (item?.id) {
                const { error } = await api.from("announcements").update(payload).eq("id", item.id);
                if (error) throw error;
              } else {
                const { error } = await api.from("announcements").insert(payload);
                if (error) throw error;
              }
            },
            item?.id ? "Announcement updated." : "Announcement published.",
            onClose,
          );
        }}
      >
        <Field label="Title">
          <input className={inputClass} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea className={inputClass} rows={3} value={form.body ?? ""} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </Field>
        <Field label="Image / banner URL">
          <input className={inputClass} value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Audience">
            <select className={inputClass} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              <option value="all">Everyone</option>
              <option value="customers">Customers</option>
              <option value="salon_owners">Salon owners</option>
              <option value="admins">Admins</option>
            </select>
          </Field>
          <Field label="Published">
            <select className={inputClass} value={form.is_published ? "yes" : "no"} onChange={(e) => setForm({ ...form, is_published: e.target.value === "yes" })}>
              <option value="yes">Published</option>
              <option value="no">Draft</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Schedule from">
            <input className={inputClass} type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          </Field>
          <Field label="Until (optional)">
            <input className={inputClass} type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          </Field>
        </div>
        <Submit busy={busy} label={item?.id ? "Save" : "Publish"} />
      </form>
    </Modal>
  );
}
