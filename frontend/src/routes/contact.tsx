import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Facebook, Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageShell } from "@/components/salonx/PageShell";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { safeUrl, usePlatformContact, waLink } from "@/lib/contact";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact SalonX Support" },
      { name: "description", content: "Reach the SalonX team for booking help, salon partnerships and platform support." },
      { property: "og:title", content: "Contact SalonX Support" },
      { property: "og:description", content: "Reach the SalonX team for booking help and salon partnerships." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().trim().regex(/^[0-9+ ()-]{7,20}$/, "Enter a valid phone number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email").max(255)]),
  subject: z.string().trim().min(1, "Subject is required").max(150),
  message: z.string().trim().min(1, "Message is required").max(2000),
});

function ContactPage() {
  const { user } = useAuth();
  const contact = usePlatformContact();
  const c = contact.data ?? {};
  const [form, setForm] = useState({ name: "", phone: "", email: "", subject: "", message: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the form"); return; }
    setBusy(true);
    const { error } = await api.from("contact_messages").insert({
      ...parsed.data,
      email: parsed.data.email || null,
      user_id: user?.id ?? null,
    } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Message sent. Our team will get back to you soon.");
    setForm({ name: "", phone: "", email: "", subject: "", message: "" });
  }

  const wa = waLink(c.whatsapp);
  const ig = safeUrl(c.instagram);
  const fb = safeUrl(c.facebook);
  const hasAny = c.phone || c.email || c.address || c.hours || wa || ig || fb;

  return (
    <PageShell title="Contact" subtitle="Send us a message and our team will reply.">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form className="salonx-card space-y-4 p-6" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={form.name} onChange={set("name")} max={100} />
            <Field label="Phone" value={form.phone} onChange={set("phone")} max={20} type="tel" />
          </div>
          <Field label="Email (optional)" value={form.email} onChange={set("email")} max={255} type="email" />
          <Field label="Subject" value={form.subject} onChange={set("subject")} max={150} />
          <div>
            <label className="text-xs font-medium text-foreground">Message</label>
            <textarea
              rows={5}
              maxLength={2000}
              value={form.message}
              onChange={set("message")}
              placeholder="How can we help?"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button disabled={busy} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy ? "Sending…" : "Send Message"}
          </button>
        </form>

        <div className="salonx-card space-y-4 p-6 text-sm">
          {contact.isPending ? (
            <p className="text-muted-foreground">Loading contact details…</p>
          ) : contact.isError ? (
            <p className="text-destructive">Could not load contact details.</p>
          ) : !hasAny ? (
            <p className="text-muted-foreground">Use the form to reach our team.</p>
          ) : (
            <>
              {c.phone && <Row icon={Phone} href={`tel:${c.phone.replace(/\s/g, "")}`} text={c.phone} />}
              {c.email && <Row icon={Mail} href={`mailto:${c.email}`} text={c.email} />}
              {wa && <Row icon={MessageCircle} href={wa} text="Chat on WhatsApp" external />}
              {c.address && <Row icon={MapPin} text={c.address} />}
              {c.hours && <Row icon={Clock} text={c.hours} />}
              {ig && <Row icon={Instagram} href={ig} text="Instagram" external />}
              {fb && <Row icon={Facebook} href={fb} text="Facebook" external />}
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Row({ icon: Icon, text, href, external }: { icon: React.ComponentType<{ className?: string }>; text: string; href?: string; external?: boolean }) {
  const inner = (<><Icon className="size-4 shrink-0 text-primary" /> <span className="break-words">{text}</span></>);
  return href ? (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="flex items-center gap-3 text-muted-foreground hover:text-foreground">{inner}</a>
  ) : (
    <p className="flex items-center gap-3 text-muted-foreground">{inner}</p>
  );
}

function Field({ label, value, onChange, max, type = "text" }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; max: number; type?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      <input type={type} maxLength={max} value={value} onChange={onChange}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
