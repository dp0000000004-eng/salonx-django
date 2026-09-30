import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Scissors, Search } from "lucide-react";
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
import { formatMoney } from "@/lib/queries";

type CatalogRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string;
  gender: string;
  is_featured: boolean;
};

type SalonStyle = {
  id: string;
  catalog_id: string | null;
  name: string;
  description: string | null;
  category: string;
  gender: string;
  price: number;
  duration_min: number;
  image_url: string | null;
  is_active: boolean;
};

type Draft = {
  price: string;
  duration_min: string;
  description: string;
  image_url: string | null;
  is_active: boolean;
};

function useMasterCatalogue() {
  return useQuery({
    queryKey: ["owner_master_catalog"],
    queryFn: async () => {
      const { data, error } = await api
        .from("hairstyle_catalog")
        .select("id, name, description, image_url, category, gender, is_featured")
        .eq("is_active", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return (data ?? []) as CatalogRow[];
    },
  });
}

function useSalonStyles(salonId: string) {
  return useQuery({
    queryKey: ["owner_hairstyles", salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("hairstyles")
        .select("id, catalog_id, name, description, category, gender, price, duration_min, image_url, is_active")
        .eq("salon_id", salonId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as SalonStyle[];
    },
  });
}

export function OwnerHairstyles({ salonId }: { salonId: string }) {
  const queryClient = useQueryClient();
  const catalogue = useMasterCatalogue();
  const mine = useSalonStyles(salonId);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ style: CatalogRow; existing: SalonStyle | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRow, setConfirmRow] = useState<SalonStyle | null>(null);

  const byCatalog = useMemo(() => {
    const map = new Map<string, SalonStyle>();
    for (const row of mine.data ?? []) if (row.catalog_id) map.set(row.catalog_id, row);
    return map;
  }, [mine.data]);

  const rows = (catalogue.data ?? []).filter((c) =>
    !q.trim() ? true : `${c.name} ${c.category}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  function openEditor(style: CatalogRow, existing: SalonStyle | null) {
    setEditing({
      style,
      existing,
      draft: {
        price: String(existing?.price ?? ""),
        duration_min: String(existing?.duration_min ?? 30),
        description: existing?.description ?? style.description ?? "",
        image_url: existing?.image_url ?? null,
        is_active: existing?.is_active ?? true,
      },
    });
  }

  async function save() {
    if (!editing) return;
    const price = Number(editing.draft.price);
    const duration = Number(editing.draft.duration_min);
    if (!Number.isFinite(price) || price < 0) { toast.error("Enter a valid price."); return; }
    if (!Number.isFinite(duration) || duration < 5) { toast.error("Duration must be at least 5 minutes."); return; }
    setBusy(true);
    try {
      const payload = {
        salon_id: salonId,
        catalog_id: editing.style.id,
        name: editing.style.name,
        category: editing.style.category,
        gender: editing.style.gender,
        description: editing.draft.description.trim() || null,
        price: Math.round(price),
        duration_min: Math.round(duration),
        image_url: editing.draft.image_url,
        is_active: editing.draft.is_active,
      };
      const { error } = editing.existing
        ? await api.from("hairstyles").update(payload).eq("id", editing.existing.id)
        : await api.from("hairstyles").insert(payload);
      if (error) throw error;
      toast.success(editing.existing ? "Hairstyle updated" : `${editing.style.name} added to your salon`);
      setEditing(null);
      await queryClient.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailability(row: SalonStyle) {
    const { error } = await api.from("hairstyles").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) toast.error(error.message);
    else await queryClient.invalidateQueries();
  }

  async function remove(row: SalonStyle) {
    const { error } = await api.from("hairstyles").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed from your salon");
      await queryClient.invalidateQueries();
    }
  }

  if (catalogue.isLoading || mine.isLoading) return <Loading label="Loading hairstyles…" />;
  if (catalogue.error) return <ErrorNote error={catalogue.error} onRetry={() => void catalogue.refetch()} />;
  if (mine.error) return <ErrorNote error={mine.error} onRetry={() => void mine.refetch()} />;

  const offered = [...byCatalog.values()];

  return (
    <div className="space-y-4">
      <Panel title={`Hairstyles you offer (${offered.length})`} icon={Scissors}>
        {offered.length === 0 ? (
          <Empty title="No hairstyles selected yet" description="Pick the hairstyles your salon actually provides from the list below." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {offered.map((row) => (
              <article key={row.id} className="rounded-xl border border-border p-3">
                <MediaImage path={row.image_url} alt={row.name} className="mb-3 h-28 w-full rounded-lg object-cover" />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-xs font-semibold text-foreground">{row.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{row.category}</p>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] ${row.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {row.is_active ? "Available" : "Off"}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">
                  {formatMoney(row.price)} · {row.duration_min} min
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <GhostButton
                    onClick={() => {
                      const style = (catalogue.data ?? []).find((c) => c.id === row.catalog_id);
                      if (style) openEditor(style, row);
                    }}
                  >
                    Edit
                  </GhostButton>
                  <GhostButton onClick={() => void toggleAvailability(row)}>{row.is_active ? "Turn off" : "Turn on"}</GhostButton>
                  <GhostButton className="text-destructive" onClick={() => setConfirmRow(row)}>
                    Remove
                  </GhostButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Manage available hairstyles"
        icon={Scissors}
        action={
          <label className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              className="w-36 bg-transparent text-xs outline-none"
              placeholder="Search catalogue"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        }
      >
        <p className="mb-3 text-xs text-muted-foreground">
          Tick only the hairstyles your salon provides, then set your own price, duration and availability.
        </p>
        {rows.length === 0 ? (
          <Empty title="No hairstyles in the catalogue" description="SalonX hasn't published hairstyles matching this search yet." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((style) => {
              const existing = byCatalog.get(style.id) ?? null;
              return (
                <li key={style.id} className="flex items-center gap-3 py-3">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={!!existing}
                    onChange={() => (existing ? setConfirmRow(existing) : openEditor(style, null))}
                    aria-label={`Offer ${style.name}`}
                  />
                  {style.image_url ? (
                    <img src={style.image_url} alt={style.name} loading="lazy" className="size-10 rounded-lg object-cover" />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Scissors className="size-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{style.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {style.category}
                      {existing ? ` · your price ${formatMoney(existing.price)} · ${existing.duration_min} min` : ""}
                    </p>
                  </div>
                  <GhostButton onClick={() => openEditor(style, existing)}>{existing ? "Edit" : "Add"}</GhostButton>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? editing.style.name : ""}>
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (₹)">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={editing.draft.price}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, price: e.target.value } })}
                />
              </Field>
              <Field label="Duration (minutes)">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={editing.draft.duration_min}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, duration_min: e.target.value } })}
                />
              </Field>
            </div>
            <Field label="Description (optional)">
              <textarea
                className={inputClass}
                rows={3}
                value={editing.draft.description}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, description: e.target.value } })}
              />
            </Field>
            <Field label="Your photo (optional)">
              <ImageUploader
                salonId={salonId}
                folder="hairstyles"
                value={editing.draft.image_url}
                onChange={(p) => setEditing({ ...editing, draft: { ...editing.draft, image_url: p } })}
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={editing.draft.is_active}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, is_active: e.target.checked } })}
              />
              Available for booking
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <GhostButton onClick={() => setEditing(null)}>Cancel</GhostButton>
              <PrimaryButton busy={busy} onClick={() => void save()}>
                {editing.existing ? "Save changes" : "Add to my salon"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmRow}
        title="Remove hairstyle"
        message="Customers will no longer see this hairstyle at your salon. Past bookings keep their details."
        confirmLabel="Remove"
        onConfirm={() => { if (confirmRow) void remove(confirmRow); }}
        onClose={() => setConfirmRow(null)}
      />
    </div>
  );
}
