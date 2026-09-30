import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { useSuperAdminCount } from "@/lib/admin/data";
import { Btn, Field, inputClass } from "@/lib/admin/core";

/**
 * Decides, from the live database state, whether /master-dashboard shows the
 * first-time setup screen, the Super Admin login, an access-denied notice, or
 * the dashboard itself. Every query behind the gate is additionally enforced
 * by row-level security on the server, so the UI is never the only check.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const count = useSuperAdminCount();

  const roleCheck = useQuery({
    queryKey: ["is_super_admin", user?.id],
    queryFn: async () => {
      const { data, error } = await api
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user?.id,
  });

  if (authLoading || count.isPending || (user && roleCheck.isPending)) {
    return <Center><Loader2 className="size-5 animate-spin text-primary" /></Center>;
  }

  if (count.isError) {
    return (
      <Center>
        <Card title="Cannot reach the platform" icon={ShieldX}>
          <p className="text-xs text-muted-foreground">{(count.error as Error).message}</p>
          <Btn className="mt-4 w-full" onClick={() => count.refetch()}>Retry</Btn>
        </Card>
      </Center>
    );
  }

  if ((count.data ?? 0) === 0) return <SetupScreen onDone={() => { void count.refetch(); void roleCheck.refetch(); }} />;

  if (!user) return <LoginScreen />;

  if (!roleCheck.data) return <DeniedScreen />;

  return <>{children}</>;
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-surface p-4">{children}</div>;
}

function Card({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon: React.ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-sm">
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-5" />
      </span>
      <h1 className="mt-4 text-lg font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function SetupScreen({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { user, refresh } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function claim() {
    const { data, error } = await api.rpc("claim_super_admin");
    if (error) throw error;
    if (!data) throw new Error("Super Admin already exists.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (user) {
        await claim();
      } else {
        const { data, error } = await api.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/master-dashboard", data: { full_name: fullName } },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm the account, then return here to finish setup.");
          return;
        }
        await api.from("profiles").update({ full_name: fullName }).eq("id", data.user!.id);
        await claim();
      }
      await refresh();
      queryClient.clear();
      toast.success("Super Admin created.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the Super Admin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Center>
      <Card
        title="Create Super Admin"
        subtitle="No Super Admin exists yet. The first account created here takes full control of the platform."
        icon={ShieldCheck}
      >
        <form className="space-y-4" onSubmit={submit}>
          {!user && (
            <>
              <Field label="Full Name">
                <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />
              </Field>
              <Field label="Email">
                <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              <Field label="Password">
                <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </Field>
              <Field label="Confirm Password">
                <input className={inputClass} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
              </Field>
            </>
          )}
          {user && (
            <p className="text-xs text-muted-foreground">
              You are signed in as <span className="font-medium text-foreground">{user.email}</span>. Claim Super Admin access for this account.
            </p>
          )}
          <Btn type="submit" disabled={busy} className="w-full py-2.5">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {user ? "Claim Super Admin" : "Create Super Admin"}
          </Btn>
        </form>
      </Card>
    </Center>
  );
}

function LoginScreen() {
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await api.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Center>
      <Card title="Super Admin Login" subtitle="Restricted area. Only the registered Super Admin can continue." icon={Lock}>
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Email">
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Btn type="submit" disabled={busy} className="w-full py-2.5">
            {busy && <Loader2 className="size-4 animate-spin" />} Sign In
          </Btn>
        </form>
      </Card>
    </Center>
  );
}

function DeniedScreen() {
  const { signOut } = useAuth();
  return (
    <Center>
      <Card title="Access denied" subtitle="Super Admin access is restricted." icon={ShieldX}>
        <p className="text-xs text-muted-foreground">
          This account does not have Super Admin permissions. Sign in with the registered Super Admin account to continue.
        </p>
        <Btn variant="ghost" className="mt-5 w-full py-2.5" onClick={() => void signOut()}>
          Sign out
        </Btn>
      </Card>
    </Center>
  );
}
