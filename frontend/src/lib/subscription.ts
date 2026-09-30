import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export const PLAN_CODE = "all_in_one";
export const TRIAL_DAYS = 14;

export type SubscriptionRow = {
  id: string;
  salon_id: string;
  owner_id: string | null;
  plan_id: string;
  status: string;
  started_at: string;
  expires_at: string;
  trial_start_date: string | null;
  trial_end_date: string | null;
  auto_renew: boolean;
  cancelled_at: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
  salons?: { name: string; city: string; owner_id: string | null } | null;
  subscription_plans?: { name: string; price: number; code: string; billing_cycle: string } | null;
};

export type PlanRow = {
  id: string;
  code: string;
  name: string;
  price: number;
  billing_cycle: string;
  billing_days: number | null;
  trial_days: number;
  trial_enabled: boolean;
  description: string | null;
  currency: string | null;
  features: string[];
  is_active: boolean;
};

export type SubState = "none" | "trialing" | "active" | "expired" | "cancelled" | "suspended";

const FIELDS =
  "id, salon_id, owner_id, plan_id, status, started_at, expires_at, trial_start_date, trial_end_date, auto_renew, cancelled_at, suspended_at, created_at, updated_at";

/** Mirrors the database function public.subscription_state — the backend remains authoritative. */
export function subState(sub?: SubscriptionRow | null, now: Date = new Date()): SubState {
  if (!sub) return "none";
  const ts = (v?: string | null) => (v ? new Date(v).getTime() : 0);
  if (sub.status === "suspended") return "suspended";
  if (sub.status === "cancelled") return ts(sub.expires_at) > now.getTime() ? "cancelled" : "expired";
  if (sub.status === "trialing" && Math.max(ts(sub.trial_end_date), ts(sub.expires_at)) > now.getTime()) return "trialing";
  if (sub.status === "active" && ts(sub.expires_at) > now.getTime()) return "active";
  return "expired";
}

export const isUnlocked = (s: SubState) => s === "trialing" || s === "active";

export function daysLeft(value?: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 864e5));
}

export function useActivePlan() {
  return useQuery({
    queryKey: ["active_plan"],
    queryFn: async () => {
      const { data, error } = await api
        .from("subscription_plans")
        .select("id, code, name, price, billing_cycle, billing_days, trial_days, trial_enabled, description, currency, features, is_active")
        .eq("code", PLAN_CODE)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PlanRow | null;
    },
  });
}

/** The subscription record for one salon (owner + customer view). */
export function useSalonSubscription(salonId?: string) {
  return useQuery({
    queryKey: ["salon_subscription", salonId],
    enabled: Boolean(salonId),
    queryFn: async () => {
      const { data, error } = await api
        .from("salon_subscriptions")
        .select(`${FIELDS}, subscription_plans(name, price, code, billing_cycle)`)
        .eq("salon_id", salonId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as SubscriptionRow | null;
    },
  });
}

/** Subscription state for a list of salons, used to disable booking on the public site. */
export function useSalonSubscriptionStates(salonIds: string[]) {
  const key = [...salonIds].sort().join(",");
  return useQuery({
    queryKey: ["salon_subscription_states", key],
    enabled: salonIds.length > 0,
    queryFn: async () => {
      const { data, error } = await api.rpc("salon_subscription_states_for", {
        _salon_ids: salonIds,
      });
      if (error) throw error;
      const map: Record<string, SubState> = {};
      for (const row of (data ?? []) as unknown as SubscriptionRow[]) map[row.salon_id] = subState(row);
      return map;
    },

  });
}

export function useAllSubscriptions() {
  return useQuery({
    queryKey: ["admin_subscriptions"],
    queryFn: async () => {
      const { data, error } = await api
        .from("salon_subscriptions")
        .select(`${FIELDS}, salons(name, city, owner_id), subscription_plans(name, price, code, billing_cycle)`)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as SubscriptionRow[];
    },
  });
}

export function useSubscriptionHistory(salonId?: string) {
  return useQuery({
    queryKey: ["subscription_history", salonId],
    enabled: Boolean(salonId),
    queryFn: async () => {
      const { data, error } = await api
        .from("subscription_status_history")
        .select("id, status, note, created_at")
        .eq("salon_id", salonId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as { id: string; status: string; note: string | null; created_at: string }[];
    },
  });
}

export type SubscriptionAction =
  | "activate"
  | "renew"
  | "extend"
  | "extend_trial"
  | "end_trial"
  | "cancel"
  | "suspend"
  | "reactivate";

/** Super Admin only — enforced inside the database function. */
export async function manageSubscription(salonId: string, action: SubscriptionAction, days = 30, note?: string) {
  const { error } = await api.rpc("admin_manage_subscription", {
    _salon_id: salonId,
    _action: action,
    _days: days,
    ...(note ? { _note: note } : {}),
  } as never);
  if (error) throw new Error(error.message);
}
