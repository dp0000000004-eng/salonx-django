import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type PlatformContact = {
  platform_name?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  address?: string;
  instagram?: string;
  facebook?: string;
  hours?: string;
};

/** Public contact details, edited by Super Admin in Settings. */
export function usePlatformContact() {
  return useQuery({
    queryKey: ["platform_contact"],
    queryFn: async () => {
      const { data, error } = await api.from("platform_settings").select("value").eq("key", "contact").maybeSingle();
      if (error) throw error;
      return ((data?.value ?? {}) as PlatformContact);
    },
    staleTime: 5 * 60_000,
  });
}

export const safeUrl = (v?: string) => {
  if (!v) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};

export const waLink = (v?: string) => {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length === 10 ? "91" + d : d}`;
};
