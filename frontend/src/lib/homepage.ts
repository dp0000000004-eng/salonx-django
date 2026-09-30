import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type HomepageSettings = {
  show_wedding: boolean;
  show_categories: boolean;
  show_hairstyles: boolean;
  show_top_rated: boolean;
  show_trusted: boolean;
};

const DEFAULTS: HomepageSettings = {
  show_wedding: true,
  show_categories: true,
  show_hairstyles: true,
  show_top_rated: true,
  show_trusted: true,
};

export function useHomepageSettings() {
  return useQuery({
    queryKey: ["homepage_settings"],
    queryFn: async () => {
      const { data, error } = await api.from("platform_settings").select("value").eq("key", "homepage").maybeSingle();
      if (error) throw error;
      const v = (data?.value ?? {}) as Partial<HomepageSettings>;
      return { ...DEFAULTS, ...v } as HomepageSettings;
    },
  });
}

export const homepageDefaults = DEFAULTS;
