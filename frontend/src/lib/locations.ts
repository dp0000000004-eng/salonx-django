import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type LocationRow = {
  id: string;
  name: string;
  level: string;
  parent_id: string | null;
  code: string | null;
};

/** Supported states, from the standardised locations table. */
export function useStates() {
  return useQuery({
    queryKey: ["locations", "state"],
    queryFn: async () => {
      const { data, error } = await api
        .from("locations")
        .select("id, name, level, parent_id, code")
        .eq("level", "state")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as LocationRow[];
    },
    staleTime: 10 * 60_000,
  });
}

/** Districts belonging to one state name (e.g. "Odisha"). */
export function useDistricts(stateName?: string) {
  return useQuery({
    queryKey: ["locations", "district", stateName ?? ""],
    queryFn: async () => {
      const { data: state, error: stateError } = await api
        .from("locations")
        .select("id")
        .eq("level", "state")
        .eq("is_active", true)
        .ilike("name", stateName!)
        .maybeSingle();
      if (stateError) throw stateError;
      if (!state) return [] as LocationRow[];

      const { data, error } = await api
        .from("locations")
        .select("id, name, level, parent_id, code")
        .eq("level", "district")
        .eq("parent_id", state.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as LocationRow[];
    },
    enabled: !!stateName?.trim(),
    staleTime: 10 * 60_000,
  });
}
