import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { PageShell } from "@/components/salonx/PageShell";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset Your Password — SalonX" },
      {
        name: "description",
        content: "Request a secure password reset link for your SalonX account.",
      },
      { property: "og:title", content: "Reset Your Password — SalonX" },
      {
        property: "og:description",
        content: "Request a secure password reset link for your SalonX account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: resetError } = await api.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <PageShell
        title="Check your email"
        subtitle="If the account exists, a reset link will be sent."
      >
        <div className="salonx-card mx-auto max-w-md p-7 text-center">
          <MailCheck className="mx-auto size-10 text-primary" />
          <p className="mt-4 text-sm text-foreground">
            If password reset email delivery is enabled, a link will be sent to{" "}
            <span className="font-medium">{email}</span>.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            The link can only be used once and expires shortly, so open it soon.
          </p>
          <Link
            to="/auth"
            className="mt-5 inline-block w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to sign in
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Forgot Password" subtitle="Request a password reset link for your account.">
      <div className="salonx-card mx-auto max-w-md p-7">
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="text-xs font-medium text-foreground" htmlFor="reset-email">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              required
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-foreground">
              {error}
            </p>
          )}

          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Send reset link
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Remembered it?{" "}
          <Link to="/auth" className="font-medium text-primary hover:underline">
            Sign in instead
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
