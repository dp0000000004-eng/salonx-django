import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Btn,
  DataState,
  Empty,
  Modal,
  Panel,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  dateLabel,
  inr,
  num,
  useModal,
} from "@/lib/admin/core";
import {
  daysLeft,
  subState,
  useActivePlan,
  useAllSubscriptions,
  useSubscriptionHistory,
  type SubscriptionAction,
  type SubscriptionRow,
} from "@/lib/subscription";
import { useRealtime } from "@/lib/realtime";
import { PlanEditor } from "@/components/admin/PlanEditor";

export const Route = createFileRoute("/master-dashboard/subscriptions")({
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const plan = useActivePlan();
  const subs = useAllSubscriptions();
  const detail = useModal<SubscriptionRow>();
  const busy = false;

  useRealtime(["salon_subscriptions", "subscription_status_history"], [["admin_subscriptions"], ["subscription_history"]]);

  const rows = subs.data ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const s = subState(r);
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const price = plan.data?.price ?? 0;
  const mrr = rows.filter((r) => subState(r) === "active").length * price;

  // Display-only until the SalonX subscription backend is connected — no changes are saved here.
  function act(_row: SubscriptionRow, action: SubscriptionAction) {
    toast.info(`"${action.replace("_", " ")}" will be available once the subscription backend is connected.`);
  }


  return (
    <div className="space-y-4">
      <Panel title="SalonX Plan" icon={Sparkles}>
        <DataState query={plan}>
          {(p) =>
            p ? (
              <PlanEditor plan={p} />
            ) : (
              <Empty title="The plan has not been set up yet." icon={CreditCard} />
            )
          }
        </DataState>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(["trialing", "active", "expired", "cancelled", "suspended"] as const).map((k) => (
            <Stat key={k} label={k} value={num(counts[k] ?? 0)} />
          ))}
          <Stat label="Monthly revenue" value={inr(mrr)} />
        </div>
      </Panel>

      <Panel title="Salon Subscriptions" icon={CreditCard}>
        <DataState
          query={subs}
          empty={<Empty title="No subscriptions yet." description="A subscription starts when you approve a salon." icon={CreditCard} />}
        >
          {(list) => (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Salon</Th>
                  <Th>Status</Th>
                  <Th>Trial start</Th>
                  <Th>Trial end</Th>
                  <Th>Subscription start</Th>
                  <Th>Subscription end</Th>
                  <Th>Plan</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const state = subState(s);
                  return (
                    <tr key={s.id} className="border-t border-border">
                      <Td>
                        <span className="font-medium text-foreground">{s.salons?.name ?? "—"}</span>
                        <span className="block text-muted-foreground">{s.salons?.city ?? ""}</span>
                      </Td>
                      <Td>
                        <StatusBadge status={state} />
                      </Td>
                      <Td>{dateLabel(s.trial_start_date)}</Td>
                      <Td>
                        {s.trial_end_date ? (
                          <>
                            {dateLabel(s.trial_end_date)}
                            {state === "trialing" && <span className="ml-2 text-warning">{daysLeft(s.trial_end_date)}d left</span>}
                          </>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>{dateLabel(s.started_at)}</Td>
                      <Td>{dateLabel(s.expires_at)}</Td>
                      <Td>
                        {s.subscription_plans?.name ?? "All-in-One Unlimited"}
                      </Td>
                      <Td right>
                        <div className="flex justify-end gap-1">
                          <Btn variant="soft" onClick={() => detail.open(s)}>
                            Manage
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

      {detail.state && <ManageModal row={detail.state} busy={busy} onAct={act} onClose={detail.close} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] capitalize text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ManageModal({
  row,
  busy,
  onAct,
  onClose,
}: {
  row: SubscriptionRow;
  busy: boolean;
  onAct: (row: SubscriptionRow, action: SubscriptionAction, days?: number) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState(30);
  const history = useSubscriptionHistory(row.salon_id);
  const state = subState(row);

  const actions: { label: string; action: SubscriptionAction; days?: number; variant?: "primary" | "ghost" | "danger" }[] = [
    { label: "Activate", action: "activate" },
    { label: "Renew", action: "renew" },
    { label: `Extend ${days} days`, action: "extend" },
    { label: "Extend trial 14 days", action: "extend_trial", days: 14 },
    { label: "End trial", action: "end_trial", variant: "ghost" },
    { label: "Cancel", action: "cancel", variant: "danger" },
    { label: "Suspend", action: "suspend", variant: "danger" },
    { label: "Reactivate", action: "reactivate", variant: "ghost" },
  ];

  return (
    <Modal title={row.salons?.name ?? "Subscription"} onClose={onClose}>
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <Info label="Current status" value={state} />
        <Info label="Plan" value={row.subscription_plans?.name ?? "All-in-One Unlimited"} />
        <Info label="Trial ends" value={dateLabel(row.trial_end_date)} />
        <Info label="Expires" value={dateLabel(row.expires_at)} />
      </div>

      <label className="mt-4 block text-xs font-medium text-foreground">
        Days to add
        <input
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(Number(e.target.value) || 1)}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      <p className="mt-3 rounded-lg bg-muted p-2 text-[11px] text-muted-foreground">
        Preview only: these actions will work once the subscription backend is connected.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Btn key={a.action} variant={a.variant ?? "primary"} disabled={busy} onClick={() => onAct(row, a.action, a.days ?? days)}>
            {a.label}
          </Btn>
        ))}
      </div>

      <RenewForm row={row} onDone={onClose} />

      <div className="mt-5 border-t border-border pt-4">
        <h4 className="mb-2 text-xs font-semibold text-foreground">Status history</h4>
        <DataState query={history} empty={<p className="text-xs text-muted-foreground">No changes recorded yet.</p>}>
          {(list) => (
            <ul className="space-y-1.5 text-xs">
              {list.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3">
                  <span className="text-foreground">
                    <StatusBadge status={h.status} /> {h.note}
                  </span>
                  <span className="text-muted-foreground">{dateLabel(h.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm capitalize text-foreground">{value}</p>
    </div>
  );
}

const DURATIONS = [
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "12 months", days: 365 },
];
const iso = (d: Date) => d.toISOString().slice(0, 10);

function RenewForm({ row, onDone }: { row: SubscriptionRow; onDone: () => void }) {
  const baseStart = new Date(Math.max(Date.now(), new Date(row.expires_at).getTime() || 0));
  const [start, setStart] = useState(iso(baseStart));
  const [end, setEnd] = useState(iso(new Date(baseStart.getTime() + 30 * 864e5)));
  const [note, setNote] = useState("");
  const busy = false;

  function pick(days: number) {
    setEnd(iso(new Date(new Date(start).getTime() + days * 864e5)));
  }

  function submit() {
    if (new Date(end) <= new Date(start)) { toast.error("End date must be after the start date."); return; }
    toast.info("Renewal will be available once the subscription backend is connected.");
    onDone();
  }


  const cls = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
  return (
    <div className="mt-5 border-t border-border pt-4">
      <h4 className="mb-2 text-xs font-semibold text-foreground">Renew with custom dates</h4>
      <div className="flex flex-wrap gap-2">
        {DURATIONS.map((d) => (
          <Btn key={d.days} variant="soft" onClick={() => pick(d.days)}>{d.label}</Btn>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-foreground">Start date
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={cls} />
        </label>
        <label className="text-xs font-medium text-foreground">End date
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={cls} />
        </label>
      </div>
      <label className="mt-3 block text-xs font-medium text-foreground">Reason / note
        <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid by UPI, ref 1234" className={cls} />
      </label>
      <Btn className="mt-3" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Renew subscription"}</Btn>
    </div>
  );
}
