import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
type User = { id: string; email?: string; username?: string; full_name?: string; role?: string };
type Session = { access_token: string; refresh_token?: string | null; user: User | null };
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type AppRole = "customer" | "salon_owner" | "super_admin";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
};

type AuthValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isOwner: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  loading: true,
  session: null,
  user: null,
  profile: null,
  roles: [],
  isOwner: false,
  isAdmin: false,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadDetails(userId: string | undefined, sessionRole?: string) {
    if (!userId) {
      setProfile(null);
      setRoles([]);
      return;
    }
    const [{ data: p }, { data: r }] = await Promise.all([
      api
        .from("profiles")
        .select("id, full_name, phone, avatar_url")
        .eq("id", userId)
        .maybeSingle(),
      api.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile((p as Profile) ?? null);
    const loadedRoles = ((r ?? []) as { role: AppRole }[]).map((x) => x.role);
    if (
      (sessionRole === "customer" ||
        sessionRole === "salon_owner" ||
        sessionRole === "super_admin") &&
      !loadedRoles.includes(sessionRole)
    ) {
      loadedRoles.push(sessionRole);
    }
    setRoles(loadedRoles);
  }

  useEffect(() => {
    let mounted = true;

    const { data: sub } = api.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      setSession(next);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setTimeout(() => {
          void loadDetails(next?.user?.id, next?.user?.role);
          if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
        }, 0);
      }
    });

    void api.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadDetails(data.session?.user?.id, data.session?.user?.role);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      roles,
      isOwner: roles.includes("salon_owner"),
      isAdmin: roles.includes("super_admin"),
      refresh: async () => {
        const { data } = await api.auth.getSession();
        setSession(data.session);
        await loadDetails(data.session?.user?.id, data.session?.user?.role);
      },
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await api.auth.signOut();
        setProfile(null);
        setRoles([]);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, session, profile, roles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
