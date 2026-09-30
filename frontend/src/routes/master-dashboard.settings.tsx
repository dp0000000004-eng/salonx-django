import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Building2, CreditCard, Palette, Settings as SettingsIcon, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { Btn, DataState, Field, Panel, inputClass } from "@/lib/admin/core";
import { saveSetting, usePlatformSettings } from "@/lib/admin/data";

export const Route = createFileRoute("/master-dashboard/settings")({
  component: SettingsPage,
});

type Group = Record<string, string | boolean>;

function SettingsPage() {
  const settings = usePlatformSettings();

  return (
    <div className="space-y-4">
      <DataState query={settings}>
        {(map) => (
          <div className="grid gap-4 xl:grid-cols-2">
            <SettingsGroup
              title="Platform Information"
              icon={Building2}
              settingKey="platform"
              defaults={{ name: "SalonX", tagline: "", support_email: "", support_phone: "", address: "" }}
              labels={{ name: "Platform name", tagline: "Tagline", support_email: "Support email", support_phone: "Support phone", address: "Registered address" }}
              value={(map["platform"] as Group) ?? {}}
            />
            <SettingsGroup
              title="Public Contact Details"
              icon={Building2}
              settingKey="contact"
              defaults={{ platform_name: "SalonX", phone: "", email: "", whatsapp: "", address: "", hours: "", instagram: "", facebook: "" }}
              labels={{ platform_name: "Platform name", phone: "Phone", email: "Email", whatsapp: "WhatsApp number", address: "Address", hours: "Support hours", instagram: "Instagram URL", facebook: "Facebook URL" }}
              note="Shown on the Contact page and footer. Empty fields are hidden."
              value={(map["contact"] as Group) ?? {}}
            />
            <SettingsGroup
              title="Homepage Sections"
              icon={Palette}
              settingKey="homepage"
              defaults={{ show_wedding: true, show_categories: true, show_hairstyles: true, show_top_rated: true, show_trusted: true }}
              labels={{ show_wedding: "Show Wedding Packages", show_categories: "Show Service Categories", show_hairstyles: "Show Trending / Editor's Picks", show_top_rated: "Show Top Rated Salons", show_trusted: "Show Trusted Salons" }}
              note="Turn homepage sections on or off. Content comes from your live categories, hairstyles and salons."
              value={(map["homepage"] as Group) ?? {}}
            />
            <SettingsGroup
              title="Branding"
              icon={Palette}
              settingKey="branding"
              defaults={{ logo_url: "", favicon_url: "", primary_color: "" }}
              labels={{ logo_url: "Logo URL", favicon_url: "Favicon URL", primary_color: "Primary colour" }}
              value={(map["branding"] as Group) ?? {}}
            />
            <SettingsGroup
              title="Booking Rules"
              icon={SettingsIcon}
              settingKey="booking"
              defaults={{ slot_minutes: "30", max_advance_days: "30", cancel_window_hours: "4", allow_home_service: true }}
              labels={{ slot_minutes: "Slot length (minutes)", max_advance_days: "Book up to (days ahead)", cancel_window_hours: "Free cancellation window (hours)", allow_home_service: "Allow home service bookings" }}
              value={(map["booking"] as Group) ?? {}}
            />
            <SettingsGroup
              title="Payments"
              icon={CreditCard}
              settingKey="payments"
              defaults={{ currency: "INR", pay_at_salon: true, online_payments: true, refund_days: "7" }}
              labels={{ currency: "Currency", pay_at_salon: "Allow pay at salon", online_payments: "Allow online payments", refund_days: "Refund window (days)" }}
              value={(map["payments"] as Group) ?? {}}
            />
            <SettingsGroup
              title="Payment Gateways"
              icon={CreditCard}
              settingKey="payment_gateways"
              defaults={{
                razorpay_enabled: false,
                razorpay_live: false,
                razorpay_key_id: "",
                phonepe_enabled: false,
                phonepe_live: false,
                phonepe_merchant_id: "",
              }}
              labels={{
                razorpay_enabled: "Razorpay enabled",
                razorpay_live: "Razorpay live mode (off = test)",
                razorpay_key_id: "Razorpay key ID",
                phonepe_enabled: "PhonePe enabled",
                phonepe_live: "PhonePe live mode (off = test)",
                phonepe_merchant_id: "PhonePe merchant ID",
              }}
              note="Secret keys are never stored here — they are kept securely on the server."
              value={(map["payment_gateways"] as Group) ?? {}}
            />
            <SettingsGroup
              title="Expired Salon Visibility"
              icon={ShieldCheck}
              settingKey="expired_salon_public_visibility"
              defaults={{ visible: true }}
              labels={{ visible: "Keep salons with an expired subscription visible to customers (online booking stays disabled)" }}
              value={(map["expired_salon_public_visibility"] as Group) ?? {}}
            />
            <SettingsGroup
              title="Notifications"
              icon={Bell}
              settingKey="notifications"
              defaults={{ email_alerts: true, new_salon: true, new_booking: true, payment_alerts: true }}
              labels={{ email_alerts: "Send email alerts", new_salon: "Notify on new salon registration", new_booking: "Notify on new booking", payment_alerts: "Notify on payment events" }}
              value={(map["notifications"] as Group) ?? {}}
            />
            <SettingsGroup
              title="Security"
              icon={ShieldCheck}
              settingKey="security"
              defaults={{ session_hours: "24", require_strong_password: true }}
              labels={{ session_hours: "Session length (hours)", require_strong_password: "Require strong passwords" }}
              value={(map["security"] as Group) ?? {}}
            />
            <ProfilePanel />
          </div>
        )}
      </DataState>
    </div>
  );
}

function SettingsGroup({
  title,
  icon,
  settingKey,
  defaults,
  labels,
  value,
  note,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  settingKey: string;
  defaults: Group;
  labels: Record<string, string>;
  value: Group;
  note?: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Group>({ ...defaults, ...value });
  const [busy, setBusy] = useState(false);

  return (
    <Panel title={title} icon={icon}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await saveSetting(settingKey, form as Record<string, unknown>);
            toast.success(`${title} saved.`);
            void queryClient.invalidateQueries({ queryKey: ["admin_settings"] });
            void queryClient.invalidateQueries({ queryKey: ["homepage_settings"] });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save settings.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
        {Object.keys(defaults).map((key) =>
          typeof defaults[key] === "boolean" ? (
            <label key={key} className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
              {labels[key]}
            </label>
          ) : (
            <Field key={key} label={labels[key] ?? key}>
              <input className={inputClass} value={String(form[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </Field>
          ),
        )}
        <Btn type="submit" disabled={busy} className="w-full py-2.5">
          Save {title.toLowerCase()}
        </Btn>
      </form>
    </Panel>
  );
}

function ProfilePanel() {
  const { user, profile, refresh } = useAuth();
  const [form, setForm] = useState({ full_name: "", phone: "", avatar_url: "" });
  const [pwd, setPwd] = useState({ current: "", next: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({ full_name: profile?.full_name ?? "", phone: profile?.phone ?? "", avatar_url: profile?.avatar_url ?? "" });
  }, [profile?.full_name, profile?.phone, profile?.avatar_url]);

  return (
    <Panel title="Super Admin Profile" icon={UserCog}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!user) return;
          setBusy(true);
          const { error } = await api
            .from("profiles")
            .update({ full_name: form.full_name.trim(), phone: form.phone.trim() || null, avatar_url: form.avatar_url.trim() || null })
            .eq("id", user.id);
          setBusy(false);
          if (error) { toast.error(error.message); return; }
          toast.success("Profile updated.");
          await refresh();
        }}
      >
        <Field label="Full name">
          <input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className={inputClass} value={user?.email ?? ""} disabled />
          </Field>
        </div>
        <Field label="Profile photo URL">
          <input className={inputClass} value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" />
        </Field>
        <Btn type="submit" disabled={busy} className="w-full py-2.5">
          Save profile
        </Btn>
      </form>

      <form
        className="mt-5 space-y-3 border-t border-border pt-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await api.auth.updateUser({ password: pwd.next, ...({ current_password: pwd.current } as object) });
          setBusy(false);
          if (error) { toast.error(error.message); return; }
          toast.success("Password changed.");
          setPwd({ current: "", next: "" });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current password">
            <input className={inputClass} type="password" required value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
          </Field>
          <Field label="New password">
            <input className={inputClass} type="password" minLength={8} required value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
          </Field>
        </div>
        <Btn type="submit" disabled={busy} variant="ghost" className="w-full py-2.5">
          Change password
        </Btn>
      </form>
    </Panel>
  );
}
