import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Gift, Megaphone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { AnnouncementFormModal, OfferFormModal, type AnnouncementDraft, type OfferDraft } from "@/components/admin/forms";
import {
  Badge,
  Btn,
  DataState,
  Empty,
  Panel,
  TableWrap,
  Td,
  Th,
  dateLabel,
  inr,
  useModal,
} from "@/lib/admin/core";
import { useAnnouncements, useCoupons } from "@/lib/admin/data";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/master-dashboard/offers")({
  component: OffersPage,
});

function OffersPage() {
  const queryClient = useQueryClient();
  const coupons = useCoupons();
  const announcements = useAnnouncements();
  const offerModal = useModal<OfferDraft>();
  const annModal = useModal<AnnouncementDraft>();

  useRealtime(["coupons", "announcements"], [["admin_coupons"], ["admin_announcements"]]);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin_coupons"] });
    void queryClient.invalidateQueries({ queryKey: ["admin_announcements"] });
  };

  async function toggleOffer(id: string, active: boolean) {
    const { error } = await api.from("coupons").update({ is_active: active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function deleteOffer(id: string, code: string) {
    if (!confirm(`Delete offer "${code}"?`)) return;
    const { error } = await api.from("coupons").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Offer deleted.");
    refresh();
  }

  async function toggleAnnouncement(id: string, published: boolean) {
    const { error } = await api.from("announcements").update({ is_published: published }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function deleteAnnouncement(id: string, title: string) {
    if (!confirm(`Delete announcement "${title}"?`)) return;
    const { error } = await api.from("announcements").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Announcement deleted.");
    refresh();
  }

  const expired = (expiresAt: string | null) => !!expiresAt && new Date(expiresAt).getTime() < Date.now();

  return (
    <div className="space-y-4">
      <Panel
        title="Offers & Banners"
        icon={Gift}
        action={
          <Btn onClick={() => offerModal.open({})}>
            <Plus className="size-3.5" /> Create Offer
          </Btn>
        }
      >
        <DataState query={coupons} empty={<Empty title="No offers created yet." description="Create a discount offer or upload a banner." icon={Gift} />}>
          {(rows) => (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Offer</Th>
                  <Th>Discount</Th>
                  <Th>Schedule</Th>
                  <Th>Used</Th>
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const isExpired = expired(c.expires_at);
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <Td>
                        <span className="font-medium text-foreground">{c.code}</span>
                        <span className="block text-muted-foreground">{c.title ?? c.description ?? ""}</span>
                        {c.banner_url && (
                          <img src={c.banner_url} alt={`${c.code} banner`} loading="lazy" className="mt-1 h-10 w-24 rounded-md object-cover" />
                        )}
                      </Td>
                      <Td>{c.discount_type === "percent" ? `${c.discount_value}%` : inr(c.discount_value)}</Td>
                      <Td>
                        {dateLabel(c.starts_at)} → {c.expires_at ? dateLabel(c.expires_at) : "No end"}
                      </Td>
                      <Td>
                        {c.used_count}
                        {c.usage_limit ? ` / ${c.usage_limit}` : ""}
                      </Td>
                      <Td>
                        <Badge tone={isExpired ? "danger" : c.is_active ? "success" : "muted"}>
                          {isExpired ? "expired" : c.is_active ? "active" : "inactive"}
                        </Badge>
                        {c.is_featured && <Badge tone="primary">banner</Badge>}
                      </Td>
                      <Td right>
                        <div className="flex justify-end gap-1">
                          <Btn variant="soft" onClick={() => offerModal.open(c)}>
                            Edit
                          </Btn>
                          <Btn variant="ghost" onClick={() => toggleOffer(c.id, !c.is_active)}>
                            {c.is_active ? "Deactivate" : "Activate"}
                          </Btn>
                          <Btn variant="danger" onClick={() => deleteOffer(c.id, c.code)}>
                            <Trash2 className="size-3.5" />
                          </Btn>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </DataState>
      </Panel>

      <Panel
        title="Platform Announcements"
        icon={Megaphone}
        action={
          <Btn onClick={() => annModal.open({})}>
            <Plus className="size-3.5" /> New Announcement
          </Btn>
        }
      >
        <DataState query={announcements} empty={<Empty title="No announcements yet." description="Publish platform news for salons and customers." icon={Megaphone} />}>
          {(rows) => (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Audience</Th>
                  <Th>Schedule</Th>
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <Td>
                      <span className="font-medium text-foreground">{a.title}</span>
                      {a.body && <span className="block max-w-sm truncate text-muted-foreground">{a.body}</span>}
                    </Td>
                    <Td className="capitalize">{(a.audience ?? "all").replace("_", " ")}</Td>
                    <Td>
                      {dateLabel(a.starts_at)} → {a.ends_at ? dateLabel(a.ends_at) : "Ongoing"}
                    </Td>
                    <Td>
                      <Badge tone={a.is_published ? "success" : "muted"}>{a.is_published ? "published" : "draft"}</Badge>
                    </Td>
                    <Td right>
                      <div className="flex justify-end gap-1">
                        <Btn variant="soft" onClick={() => annModal.open(a)}>
                          Edit
                        </Btn>
                        <Btn variant="ghost" onClick={() => toggleAnnouncement(a.id, !a.is_published)}>
                          {a.is_published ? "Unpublish" : "Publish"}
                        </Btn>
                        <Btn variant="danger" onClick={() => deleteAnnouncement(a.id, a.title)}>
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

      {offerModal.state && <OfferFormModal {...(offerModal.state.id ? { offer: offerModal.state } : {})} onClose={offerModal.close} />}
      {annModal.state && <AnnouncementFormModal {...(annModal.state.id ? { item: annModal.state } : {})} onClose={annModal.close} />}
    </div>
  );
}
