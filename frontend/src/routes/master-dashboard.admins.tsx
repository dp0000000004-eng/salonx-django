import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Plus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { AdminFormModal } from "@/components/admin/forms";
import { useAuth } from "@/lib/auth";
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
  dateLabel,
  inputClass,
  useModal,
} from "@/lib/admin/core";
import { useAdminRoles, useAdminSalons } from "@/lib/admin/data";
import { resetAdminPassword } from "@/lib/admin/admins.functions";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/master-dashboard/admins")({
  component: AdminsPage,
});

function AdminsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const admins = useAdminRoles();
  const salons = useAdminSalons();
  const createModal = useModal();
  const pwdModal = useModal<{ id: string; name: string }>();
  const assignModal = useModal<{ id: string; name: string }>();

  useRealtime(["user_roles", "profiles"], [["admin_roles"], ["admin_system_overview"]]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin_roles"] });
    void queryClient.invalidateQueries({ queryKey: ["admin_salons"] });
  };

  async function toggleRole(userId: string, role: "salon_owner", enabled: boolean) {
    const { error } = await api.rpc("admin_set_user_role", { _user_id: userId, _role: role, _enabled: enabled });
    if (error) { toast.error(error.message); return; }
    toast.success(enabled ? "Role granted." : "Role removed.");
    refresh();
  }

  async function toggleActive(userId: string, active: boolean) {
    const { error } = await api.from("profiles").update({ is_active: active }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success(active ? "Account activated." : "Account deactivated.");
    refresh();
  }

  async function stepDown(userId: string) {
    if (userId !== user?.id) {
      toast.error("Only the Super Admin can remove their own Super Admin access.");
      return;
    }
    if (!confirm("Remove Super Admin access from this account? The setup screen will reappear and the next account created there becomes the new Super Admin.")) return;
    const { error } = await api.rpc("admin_remove_super_admin", { _user_id: userId });
    if (error) { toast.error(error.message); return; }
    toast.success("Super Admin access removed.");
    await api.auth.signOut();
    window.location.assign("/master-dashboard");
  }

  return (
    <Panel
      title="Admins"
      icon={UsersRound}
      action={
        <Btn onClick={() => createModal.open(true)}>
          <Plus className="size-3.5" /> Add Admin
        </Btn>
      }
    >
      <DataState query={admins} empty={<Empty title="No admins yet." description="Create the first salon admin account." icon={UsersRound} />}>
        {(rows) => (
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Roles</Th>
                <Th>Joined</Th>
                <Th>Status</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const isSuper = a.roles.includes("super_admin");
                return (
                  <tr key={a.user_id} className="border-t border-border">
                    <Td>
                      <span className="font-medium text-foreground">{a.full_name ?? "Unnamed"}</span>
                    </Td>
                    <Td>{a.email ?? "—"}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {a.roles.map((r) => (
                          <Badge key={r} tone={r === "super_admin" ? "primary" : r === "salon_owner" ? "info" : "muted"}>
                            {r.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td>{dateLabel(a.created_at)}</Td>
                    <Td>
                      <Badge tone={a.is_active ? "success" : "danger"}>{a.is_active ? "active" : "inactive"}</Badge>
                    </Td>
                    <Td right>
                      <div className="flex flex-wrap justify-end gap-1">
                        {!isSuper && (
                          <>
                            <Btn variant="ghost" onClick={() => toggleRole(a.user_id, "salon_owner", !a.roles.includes("salon_owner"))}>
                              {a.roles.includes("salon_owner") ? "Revoke admin" : "Make admin"}
                            </Btn>
                            <Btn variant="ghost" onClick={() => assignModal.open({ id: a.user_id, name: a.full_name ?? "admin" })}>
                              Assign salon
                            </Btn>
                          </>
                        )}
                        <Btn variant="ghost" onClick={() => toggleActive(a.user_id, !a.is_active)}>
                          {a.is_active ? "Deactivate" : "Activate"}
                        </Btn>
                        <Btn variant="soft" onClick={() => pwdModal.open({ id: a.user_id, name: a.full_name ?? "admin" })}>
                          <KeyRound className="size-3.5" /> Password
                        </Btn>
                        {isSuper && a.user_id === user?.id && (
                          <Btn variant="danger" onClick={() => stepDown(a.user_id)}>
                            Remove Super Admin
                          </Btn>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </DataState>

      {createModal.state && <AdminFormModal onClose={createModal.close} />}
      {pwdModal.state && <PasswordModal target={pwdModal.state} onClose={pwdModal.close} />}
      {assignModal.state && (
        <AssignSalonModal
          target={assignModal.state}
          salons={(salons.data ?? []).map((s) => ({ id: s.id, name: s.name, city: s.city }))}
          onClose={assignModal.close}
          onDone={refresh}
        />
      )}
    </Panel>
  );
}

function PasswordModal({ target, onClose }: { target: { id: string; name: string }; onClose: () => void }) {
  const reset = useServerFn(resetAdminPassword);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Reset password — ${target.name}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await reset({ data: { userId: target.id, password } });
            toast.success("Password updated.");
            onClose();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not update the password.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="New password">
          <input className={inputClass} type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Btn type="submit" disabled={busy} className="w-full py-2.5">
          Update password
        </Btn>
      </form>
    </Modal>
  );
}

function AssignSalonModal({
  target,
  salons,
  onClose,
  onDone,
}: {
  target: { id: string; name: string };
  salons: { id: string; name: string; city: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [salonId, setSalonId] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Assign salon — ${target.name}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await api.from("salons").update({ owner_id: target.id }).eq("id", salonId);
          setBusy(false);
          if (error) { toast.error(error.message); return; }
          toast.success("Salon assigned.");
          onDone();
          onClose();
        }}
      >
        <Field label="Salon">
          <select className={inputClass} required value={salonId} onChange={(e) => setSalonId(e.target.value)}>
            <option value="">Select a salon…</option>
            {salons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.city}
              </option>
            ))}
          </select>
        </Field>
        <Btn type="submit" disabled={busy} className="w-full py-2.5">
          Assign
        </Btn>
      </form>
    </Modal>
  );
}
