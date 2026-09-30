import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type GatewayRow = {
  id: string;
  provider: string;
  display_name: string;
  is_enabled: boolean;
  is_active_gateway: boolean;
  environment: string;
  public_key: string | null;
  connection_status: string;
  connection_message: string | null;
  last_verified_at: string | null;
  updated_at: string;
};

export function useGateways() {
  return useQuery({
    queryKey: ["payment_gateways"],
    queryFn: async () => {
      const { data, error } = await api
        .from("payment_gateway_settings")
        .select("id, provider, display_name, is_enabled, is_active_gateway, environment, public_key, connection_status, connection_message, last_verified_at, updated_at")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as GatewayRow[];
    },
  });
}

export async function saveGateway(id: string, patch: Partial<GatewayRow>) {
  const { error } = await api.from("payment_gateway_settings").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------------- features */

export type FeatureRow = {
  id: string;
  code: string;
  name: string;
  group_name: string;
  is_active: boolean;
  sort_order: number;
};

/** The live SalonX feature registry — never a hard-coded list. */
export function useFeatures() {
  return useQuery({
    queryKey: ["app_features"],
    queryFn: async () => {
      const { data, error } = await api
        .from("app_features")
        .select("id, code, name, group_name, is_active, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as FeatureRow[];
    },
  });
}

export function usePlanFeatureIds(planId?: string) {
  return useQuery({
    queryKey: ["plan_features", planId],
    enabled: Boolean(planId),
    queryFn: async () => {
      const { data, error } = await api.from("subscription_plan_features").select("feature_id").eq("plan_id", planId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.feature_id);
    },
  });
}

export type PlanPatch = {
  name: string;
  price: number;
  billing_cycle: string;
  billing_days: number | null;
  trial_enabled: boolean;
  trial_days: number;
  description: string | null;
  is_active: boolean;
};

export async function savePlan(planId: string, patch: PlanPatch, featureIds: string[]) {
  const { error } = await api.from("subscription_plans").update(patch).eq("id", planId);
  if (error) throw new Error(error.message);

  const { error: delError } = await api.from("subscription_plan_features").delete().eq("plan_id", planId);
  if (delError) throw new Error(delError.message);

  if (featureIds.length > 0) {
    const { error: insError } = await api
      .from("subscription_plan_features")
      .insert(featureIds.map((feature_id) => ({ plan_id: planId, feature_id })));
    if (insError) throw new Error(insError.message);
  }
}

/* --------------------------------------------------------------- payments */

export type SubscriptionPaymentRow = {
  id: string;
  salon_id: string;
  provider: string;
  environment: string;
  order_ref: string | null;
  payment_ref: string | null;
  amount: number;
  currency: string;
  status: string;
  verified: boolean;
  invoice_no: string | null;
  paid_at: string | null;
  created_at: string;
  salons?: { name: string } | null;
};

export function useSubscriptionPayments(salonId?: string) {
  return useQuery({
    queryKey: ["subscription_payments", salonId ?? "all"],
    queryFn: async () => {
      let q = api
        .from("subscription_payments")
        .select("id, salon_id, provider, environment, order_ref, payment_ref, amount, currency, status, verified, invoice_no, paid_at, created_at, salons(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (salonId) q = q.eq("salon_id", salonId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as SubscriptionPaymentRow[];
    },
  });
}
