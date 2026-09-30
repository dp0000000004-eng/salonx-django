import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Banknote, CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge, Btn, DataState, Field, Panel, dateTimeLabel, inputClass } from "@/lib/admin/core";
import { saveGateway, useGateways, type GatewayRow } from "@/lib/admin/gateways";
import { testGateway } from "@/lib/payments.functions";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/master-dashboard/payment-gateway")({
  component: PaymentGatewayPage,
});

function PaymentGatewayPage() {
  const gateways = useGateways();
  useRealtime(["payment_gateway_settings"], [["payment_gateways"]]);

  return (
    <div className="space-y-4">
      <Panel title="Payment Gateway" icon={Banknote}>
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" />
          Secret keys are never saved on this screen and never reach the browser. They are stored securely on the server and used
          only when a payment is created or verified.
        </p>
        <DataState query={gateways}>
          {(list) => (
            <div className="grid gap-4 lg:grid-cols-2">
              {list.map((g) => (
                <GatewayCard key={g.id} row={g} />
              ))}
            </div>
          )}
        </DataState>
      </Panel>
    </div>
  );
}

function GatewayCard({ row }: { row: GatewayRow }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(row.is_enabled);
  const [env, setEnv] = useState(row.environment);
  const [publicKey, setPublicKey] = useState(row.public_key ?? "");
  const [active, setActive] = useState(row.is_active_gateway);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["payment_gateways"] });

  async function save() {
    setBusy(true);
    try {
      await saveGateway(row.id, {
        is_enabled: enabled,
        environment: env,
        public_key: publicKey.trim() || null,
        is_active_gateway: active && enabled,
      });
      toast.success(`${row.display_name} settings saved.`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the gateway settings.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const body = await testGateway(row.provider as "razorpay" | "phonepe");
      if (body.ok) toast.success(`${row.display_name}: ${body.message}`);
      else toast.error(`${row.display_name}: ${body.message}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment gateway connection failed. Check your credentials.");
    } finally {
      setTesting(false);
    }
  }

  const tone = row.connection_status === "connected" ? "success" : row.connection_status === "failed" ? "danger" : "muted";
  const StatusIcon = row.connection_status === "connected" ? CheckCircle2 : XCircle;

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <StatusIcon className={`size-4 ${row.connection_status === "connected" ? "text-success" : "text-muted-foreground"}`} />
          {row.display_name}
        </h3>
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{row.connection_status === "connected" ? "Connected" : row.connection_status === "failed" ? "Failed" : "Not connected"}</Badge>
          <Badge tone={row.is_enabled ? "success" : "muted"}>{row.is_enabled ? "Enabled" : "Disabled"}</Badge>
          {row.is_active_gateway && <Badge tone="info">Active</Badge>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={row.provider === "razorpay" ? "Key ID (public)" : "Merchant ID"}>
          <input className={inputClass} value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder={row.provider === "razorpay" ? "rzp_test_…" : "MERCHANTUAT"} />
        </Field>
        <Field label="Environment">
          <select className={inputClass} value={env} onChange={(e) => setEnv(e.target.value)}>
            <option value="test">Test</option>
            <option value="live">Live</option>
          </select>
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-2 text-foreground">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-primary" />
          Enabled
        </label>
        <label className="flex items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={active}
            disabled={!enabled}
            onChange={(e) => setActive(e.target.checked)}
            className="size-4 accent-primary"
          />
          Use for subscription payments
        </label>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Last verified: {row.last_verified_at ? dateTimeLabel(row.last_verified_at) : "never"}
        {row.connection_message ? ` — ${row.connection_message}` : ""}
      </p>

      <div className="mt-3 flex gap-2">
        <Btn onClick={() => void save()} disabled={busy}>
          Save Settings
        </Btn>
        <Btn variant="ghost" onClick={() => void test()} disabled={testing}>
          {testing ? "Testing…" : "Test Connection"}
        </Btn>
      </div>
    </div>
  );
}
