import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type LoyaltyAccount = {
  id: string;
  salon_id: string;
  balance: number;
  total_earned: number;
  total_redeemed: number;
  salons: { id: string; name: string; slug: string | null; city: string; logo_url: string | null; image_url: string | null } | null;
};

export type LoyaltyTransaction = {
  id: string;
  salon_id: string;
  booking_id: string | null;
  points: number;
  kind: string;
  reason: string | null;
  created_at: string;
};

/** Every salon-scoped loyalty balance of the signed-in customer. Never a single global wallet. */
export function useMyLoyaltyAccounts(userId?: string) {
  return useQuery({
    queryKey: ["loyalty_accounts", userId],
    queryFn: async () => {
      const { data, error } = await api
        .from("loyalty_accounts")
        .select(
          "id, salon_id, balance, total_earned, total_redeemed, salons(id, name, slug, city, logo_url, image_url)",
        )
        .eq("customer_id", userId!)
        .order("balance", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LoyaltyAccount[];
    },
    enabled: !!userId,
  });
}

/** Earn / redeem history, optionally narrowed to one salon. */
export function useMyLoyaltyTransactions(userId?: string, salonId?: string) {
  return useQuery({
    queryKey: ["loyalty_transactions", userId, salonId ?? "all"],
    queryFn: async () => {
      let query = api
        .from("loyalty_transactions")
        .select("id, salon_id, booking_id, points, kind, reason, created_at")
        .eq("customer_id", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (salonId) query = query.eq("salon_id", salonId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LoyaltyTransaction[];
    },
    enabled: !!userId,
  });
}

/** Balance available to the signed-in customer at one specific salon. */
export function useMyLoyaltyAtSalon(userId?: string, salonId?: string) {
  return useQuery({
    queryKey: ["loyalty_account", userId, salonId],
    queryFn: async () => {
      const { data, error } = await api
        .from("loyalty_accounts")
        .select("id, salon_id, balance, total_earned, total_redeemed")
        .eq("customer_id", userId!)
        .eq("salon_id", salonId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!salonId,
  });
}

export type LoyaltyRule = {
  points_per_hundred: number;
  min_redeem_points: number;
  point_value_rupees: number;
  max_redeem_percent: number;
  is_active: boolean;
};

export function useLoyaltyRule(salonId?: string) {
  return useQuery({
    queryKey: ["loyalty_rule", salonId ?? "platform"],
    queryFn: async () => {
      const { data, error } = await api.rpc("loyalty_rule_for", { _salon_id: salonId! });
      if (error) throw error;
      return data as LoyaltyRule | null;
    },
    enabled: !!salonId,
  });
}

/** The salon's own loyalty rule (owner view), independent of whether it is currently active. */
export function useOwnerLoyaltyRule(salonId?: string) {
  return useQuery({
    queryKey: ["owner_loyalty_rule", salonId],
    queryFn: async () => {
      const { data, error } = await api.rpc("owner_loyalty_rule", { _salon_id: salonId! });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as Partial<LoyaltyRule> | null;
      // A composite-returning RPC with no matching row can come back as an all-null object.
      if (!row || row.points_per_hundred === null || row.points_per_hundred === undefined) return null;
      return {
        points_per_hundred: Number(row.points_per_hundred),
        point_value_rupees: Number(row.point_value_rupees),
        min_redeem_points: Number(row.min_redeem_points),
        max_redeem_percent: Number(row.max_redeem_percent),
        is_active: !!row.is_active,
      } satisfies LoyaltyRule;
    },
    enabled: !!salonId,
  });
}

export async function saveOwnerLoyaltyRule(salonId: string, rule: LoyaltyRule) {
  const { error } = await api.rpc("owner_save_loyalty_rule", {
    _salon_id: salonId,
    _points_per_hundred: rule.points_per_hundred,
    _point_value_rupees: rule.point_value_rupees,
    _min_redeem_points: rule.min_redeem_points,
    _max_redeem_percent: rule.max_redeem_percent,
    _is_active: rule.is_active,
  });
  if (error) throw new Error(error.message);
}



/** Redeem points at the salon that issued them. The backend re-checks the salon and balance. */
export async function redeemPoints(salonId: string, points: number, bookingId?: string) {
  const { data, error } = await api.rpc("redeem_loyalty_points", {
    _salon_id: salonId,
    _points: points,
    ...(bookingId ? { _booking_id: bookingId } : {}),
  });
  if (error) throw error;
  return data as number;
}
