import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageShell } from "@/components/salonx/PageShell";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Login or Sign Up — SalonX" },
      { name: "description", content: "Sign in to manage your SalonX bookings and appointments." },
      { property: "og:title", content: "Login or Sign Up — SalonX" },
      { property: "og:description", content: "Sign in to SalonX to manage your bookings." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function landingFor(roles: string[]): "/master-dashboard" | "/owner" | "/account" {
  if (roles.includes("super_admin")) return "/master-dashboard";
  if (roles.includes("salon_owner")) return "/owner";
  return "/account";
}

async function landingForUser(userId: string | undefined) {
  if (!userId) return "/account" as const;
  const { data } = await api.from("user_roles").select("role").eq("user_id", userId);
  return landingFor(((data ?? []) as { role: string }[]).map((r) => r.role));
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, roles, loading: authLoading, refresh } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!authLoading && user) void navigate({ to: landingFor(roles), replace: true });
  }, [authLoading, user, roles, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signin") {
        const { data: signIn, error } = await api.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        const to = await landingForUser(signIn.user?.id);
        await refresh();
        void navigate({ to, replace: true });
        return;
      }

      const { data, error } = await api.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim(), phone: phone.trim() },
        },
      });
      if (error) throw error;

      if (!data.session) {
        setSent(true);
        toast.success("Check your email to confirm your account.");
        return;
      }

      toast.success("Account created!");
      await refresh();
      void navigate({ to: "/account", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <PageShell title="Confirm your email" subtitle="One last step before you can sign in.">
        <div className="salonx-card mx-auto max-w-md p-7 text-center">
          <p className="text-sm text-foreground">
            We sent a confirmation link to <span className="font-medium">{email}</span>.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Open it to activate your account, then come back and sign in.
          </p>
          <button
            onClick={() => {
              setSent(false);
              setMode("signin");
            }}
            className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to sign in
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Login / Sign Up"
      subtitle="Customers and salon owners use the same secure entry point."
    >
      <div className="salonx-card mx-auto max-w-md p-7">
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(
            [
              ["signin", "Sign In"],
              ["signup", "Create Account"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md py-2 text-xs font-medium transition-colors duration-200 ${
                mode === m ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode !== "signin" && (
            <>
              <Field
                label="Full Name"
                value={fullName}
                onChange={setFullName}
                placeholder="Your full name"
                required
                maxLength={160}
                autoComplete="name"
              />
              <Field
                label="Mobile Number"
                value={phone}
                onChange={setPhone}
                placeholder="+91 90000 00000"
                maxLength={30}
                autoComplete="tel"
              />
            </>
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            required
            maxLength={150}
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            required
            {...(mode === "signup" && { minLength: 8 })}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {mode === "signin" && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            <Link to="/forgot-password" className="font-medium text-primary hover:underline">
              Forgot your password?
            </Link>
          </p>
        )}

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Own a salon?{" "}
          <Link to="/book-demo" className="font-medium text-primary hover:underline">
            Book a demo
          </Link>{" "}
          to get listed on SalonX.
        </p>
      </div>
    </PageShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  minLength,
  maxLength = 255,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        minLength={minLength}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
