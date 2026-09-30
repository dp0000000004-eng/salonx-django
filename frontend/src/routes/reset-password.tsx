import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageShell } from "@/components/salonx/PageShell";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a New Password — SalonX" },
      { name: "description", content: "Choose a new password for your SalonX account." },
      { property: "og:title", content: "Set a New Password — SalonX" },
      { property: "og:description", content: "Choose a new password for your SalonX account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = api.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setValid(true);
        setReady(true);
      }
    });

    // The recovery link may already have been exchanged for a session by the time we mount.
    void api.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const hash = window.location.hash;
      const isRecovery = hash.includes("type=recovery") || new URLSearchParams(window.location.search).get("type") === "recovery";
      setValid(Boolean(data.session) || isRecovery);
      setReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await api.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. Please sign in.");
    await api.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  if (!ready) {
    return <PageShell title="Set a New Password" subtitle="Checking your reset link…" />;
  }

  if (!valid) {
    return (
      <PageShell title="Link expired" subtitle="This password reset link is no longer usable.">
        <div className="salonx-card mx-auto max-w-md p-7 text-center">
          <p className="text-sm text-foreground">Reset links can be used once and expire quickly.</p>
          <Link
            to="/forgot-password"
            className="mt-5 inline-block w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Request a new link
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Set a New Password" subtitle="Choose a password you haven't used before.">
      <div className="salonx-card mx-auto max-w-md p-7">
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="text-xs font-medium text-foreground" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground" htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Update password
          </button>
        </form>
      </div>
    </PageShell>
  );
}
