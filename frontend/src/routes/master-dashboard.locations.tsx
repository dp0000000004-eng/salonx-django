import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { LocationFormModal } from "@/components/admin/forms";
import { Badge, Btn, DataState, Empty, Field, Modal, Panel, TableWrap, Td, Th, inputClass, useModal } from "@/lib/admin/core";
import { useLocations } from "@/lib/admin/data";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/master-dashboard/locations")({
  component: LocationsPage,
});

function LocationsPage() {
  const queryClient = useQueryClient();
  const locations = useLocations();
  const addModal = useModal();
  const editModal = useModal<{ id: string; name: string }>();
  const [level, setLevel] = useState("");

  useRealtime(["locations"], [["admin_locations"]]);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin_locations"] });

  async function toggle(id: string, active: boolean) {
    const { error } = await api.from("locations").update({ is_active: active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Child locations will be removed too.`)) return;
    const { error } = await api.from("locations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Location deleted.");
    refresh();
  }

  return (
    <Panel
      title="Cities & Locations"
      icon={MapPin}
      action={
        <div className="flex gap-2">
          <select className={`${inputClass} w-36`} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All levels</option>
            <option value="state">States</option>
            <option value="city">Cities</option>
            <option value="area">Areas</option>
          </select>
          <Btn onClick={() => addModal.open(true)}>
            <Plus className="size-3.5" /> Add Location
          </Btn>
        </div>
      }
    >
      <DataState query={locations} empty={<Empty title="No locations added yet." description="Add states, cities and areas to organise salons." icon={MapPin} />}>
        {(rows) => {
          const byId = new Map(rows.map((r) => [r.id, r]));
          const filtered = level ? rows.filter((r) => r.level === level) : rows;
          if (filtered.length === 0) return <Empty title="No locations match this filter." icon={MapPin} />;
          return (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Level</Th>
                  <Th>Belongs to</Th>
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <Td>
                      <span className="font-medium text-foreground">{l.name}</span>
                    </Td>
                    <Td>
                      <Badge tone="info">{l.level}</Badge>
                    </Td>
                    <Td>{l.parent_id ? (byId.get(l.parent_id)?.name ?? "—") : "—"}</Td>
                    <Td>
                      <Badge tone={l.is_active ? "success" : "muted"}>{l.is_active ? "active" : "disabled"}</Badge>
                    </Td>
                    <Td right>
                      <div className="flex justify-end gap-1">
                        <Btn variant="soft" onClick={() => editModal.open({ id: l.id, name: l.name })}>
                          Rename
                        </Btn>
                        <Btn variant="ghost" onClick={() => toggle(l.id, !l.is_active)}>
                          {l.is_active ? "Disable" : "Enable"}
                        </Btn>
                        <Btn variant="danger" onClick={() => remove(l.id, l.name)}>
                          <Trash2 className="size-3.5" />
                        </Btn>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          );
        }}
      </DataState>

      {addModal.state && <LocationFormModal onClose={addModal.close} />}
      {editModal.state && <RenameModal item={editModal.state} onClose={editModal.close} onDone={refresh} />}
    </Panel>
  );
}

function RenameModal({ item, onClose, onDone }: { item: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(item.name);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Rename location" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await api.from("locations").update({ name: name.trim() }).eq("id", item.id);
          setBusy(false);
          if (error) { toast.error(error.code === "23505" ? "That location already exists." : error.message); return; }
          toast.success("Location updated.");
          onDone();
          onClose();
        }}
      >
        <Field label="Name">
          <input className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Btn type="submit" disabled={busy} className="w-full py-2.5">
          Save
        </Btn>
      </form>
    </Modal>
  );
}
