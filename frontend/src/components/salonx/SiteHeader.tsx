import { LANGS, useI18n, type Lang } from "@/lib/i18n";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Globe, LayoutDashboard, LogOut, Menu, Store, User, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/queries";
import { useRealtime } from "@/lib/realtime";

const nav = [
  { label: "nav.home", to: "/" },
  { label: "nav.salons", to: "/salons" },
  { label: "nav.services", to: "/services" },
  { label: "nav.wedding", to: "/wedding-packages" },
  { label: "nav.offers", to: "/offers" },
  { label: "nav.hairstyles", to: "/hairstyles" },
  { label: "nav.about", to: "/about" },
  { label: "nav.contact", to: "/contact" },
] as const;

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { user, profile, isOwner, isAdmin, signOut } = useAuth();
  const { data: notifications } = useNotifications(user?.id);
  const unread = (notifications ?? []).filter((n) => !n.is_read).length;

  useRealtime(["notifications"], [["notifications", user?.id]], user ? `user_id=eq.${user.id}` : undefined);

  const initials = (profile?.full_name || user?.email || "?").slice(0, 2).toUpperCase();

  async function handleSignOut() {
    setMenu(false);
    await signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <header className="relative z-30 bg-[oklch(0.13_0.02_270)]">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-6 px-4 lg:px-8">
        <Link to="/">
          <Logo />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-7 xl:flex">
          {nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative py-5 text-sm transition-colors ${
                  active ? "font-medium text-white" : "text-white/70 hover:text-white"
                }`}
              >
                {t(item.label)}
                {active && (
                  <span className="absolute inset-x-0 bottom-3 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1.5 text-sm text-white/85">
            <Globe className="size-4" />
            <select aria-label={t("nav.language")} value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="bg-transparent text-white outline-none [&>option]:text-foreground">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>

          {user ? (
            <>
              <Link
                to="/account"
                className="relative rounded-lg border border-white/15 p-2 text-white/85 transition-colors hover:bg-white/5"
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>

              <div className="relative">
                <button
                  onClick={() => setMenu((v) => !v)}
                  className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                  aria-label="Account menu"
                >
                  {initials}
                </button>
                {menu && (
                  <div className="absolute right-0 top-11 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                    <div className="border-b border-border px-4 py-3">
                      <p className="truncate text-xs font-medium text-foreground">
                        {profile?.full_name || t("nav.myAccount")}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                    </div>
                    <MenuLink to="/account" icon={User} label={t("nav.myBookings")} onClick={() => setMenu(false)} />
                    {isOwner && <MenuLink to="/owner" icon={Store} label={t("nav.salonDashboard")} onClick={() => setMenu(false)} />}
                    {isAdmin && <MenuLink to="/admin" icon={LayoutDashboard} label={t("nav.adminConsole")} onClick={() => setMenu(false)} />}
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-xs text-foreground hover:bg-muted"
                    >
                      <LogOut className="size-4 text-muted-foreground" /> {t("nav.signOut")}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("nav.login")}
            </Link>
          )}

          <button
            className="text-white xl:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="grid gap-1 border-t border-white/10 px-4 pb-4 pt-2 xl:hidden">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function MenuLink({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 text-xs text-foreground hover:bg-muted"
    >
      <Icon className="size-4 text-muted-foreground" /> {label}
    </Link>
  );
}
