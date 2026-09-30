import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Panel } from "@/components/salonx/DashboardShell";
import { api } from "@/lib/api-client";
import { useOwnerReviews } from "@/lib/owner-queries";
import {
  Empty,
  ErrorNote,
  Field,
  GhostButton,
  Loading,
  MediaImage,
  Modal,
  PrimaryButton,
  inputClass,
} from "@/components/owner/shared";

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  photo_url: string | null;
  created_at: string;
  owner_reply: string | null;
  owner_replied_at: string | null;
  is_hidden: boolean;
  profiles: { full_name: string | null } | null;
};

export function OwnerReviews({ salonId }: { salonId: string }) {
  const reviews = useOwnerReviews(salonId);
  const queryClient = useQueryClient();
  const [replyTo, setReplyTo] = useState<ReviewRow | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "unanswered" | "1" | "2" | "3" | "4" | "5">("all");

  const rows = (reviews.data ?? []) as unknown as ReviewRow[];

  const summary = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const r of rows) counts[Math.min(Math.max(r.rating, 1), 5) - 1]!++;
    const total = rows.length;
    const average = total ? rows.reduce((s, r) => s + r.rating, 0) / total : 0;
    return { counts, total, average };
  }, [rows]);

  const filtered = rows.filter((r) =>
    filter === "all" ? true : filter === "unanswered" ? !r.owner_reply : r.rating === Number(filter),
  );

  async function sendReply() {
    if (!replyTo) return;
    if (!text.trim()) {
      toast.error("Please write a reply first.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await api
        .from("reviews")
        .update({ owner_reply: text.trim(), owner_replied_at: new Date().toISOString() })
        .eq("id", replyTo.id);
      if (error) throw error;
      toast.success("Reply published");
      setReplyTo(null);
      setText("");
      await queryClient.invalidateQueries({ queryKey: ["owner_reviews", salonId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function report(row: ReviewRow) {
    const { error } = await api.from("reviews").update({ is_reported: true }).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Review reported for moderation");
    await queryClient.invalidateQueries({ queryKey: ["owner_reviews", salonId] });
  }

  if (reviews.isLoading) return <Loading label="Loading reviews…" />;
  if (reviews.error) return <ErrorNote error={reviews.error} onRetry={() => void reviews.refetch()} />;

  return (
    <div className="space-y-4">
      <Panel title="Rating summary" icon={Star}>
        {summary.total === 0 ? (
          <Empty title="No reviews yet" description="Reviews appear here after customers complete a visit." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{summary.average.toFixed(1)}</p>
              <p className="text-[11px] text-muted-foreground">{summary.total} reviews</p>
            </div>
            <ul className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.counts[star - 1] ?? 0;
                return (
                  <li key={star} className="flex items-center gap-3 text-[11px]">
                    <span className="w-8 text-muted-foreground">{star}★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${summary.total ? (count / summary.total) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="w-6 text-right text-foreground">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Panel>

      <Panel
        title={`Customer reviews (${filtered.length})`}
        icon={Star}
        action={
          <select className={`${inputClass} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">All reviews</option>
            <option value="unanswered">Awaiting reply</option>
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </select>
        }
      >
        {filtered.length === 0 ? (
          <Empty title="Nothing to show" description="No reviews match this filter yet." />
        ) : (
          <ul className="space-y-4">
            {filtered.map((r) => (
              <li key={r.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">{r.profiles?.full_name ?? "Customer"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(Math.max(0, 5 - r.rating))} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {r.comment && <p className="mt-2 text-xs text-muted-foreground">{r.comment}</p>}
                {r.photo_url && <MediaImage path={r.photo_url} alt="Review photo" className="mt-3 h-32 rounded-lg object-cover" />}
                {r.owner_reply && (
                  <div className="mt-3 rounded-lg bg-muted p-3">
                    <p className="text-[10px] font-medium text-foreground">Your reply</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{r.owner_reply}</p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <GhostButton
                    onClick={() => {
                      setReplyTo(r);
                      setText(r.owner_reply ?? "");
                    }}
                  >
                    {r.owner_reply ? "Edit reply" : "Reply"}
                  </GhostButton>
                  <GhostButton onClick={() => void report(r)}>Report</GhostButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal open={!!replyTo} onClose={() => setReplyTo(null)} title="Reply to review">
        <Field label="Your reply">
          <textarea className={inputClass} rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setReplyTo(null)}>Cancel</GhostButton>
          <PrimaryButton busy={busy} onClick={() => void sendReply()}>
            Publish reply
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
