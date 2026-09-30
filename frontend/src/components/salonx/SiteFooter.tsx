import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { usePlatformContact, waLink } from "@/lib/contact";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-[oklch(0.13_0.02_270)] py-12 text-white/70">
      <div className="mx-auto grid max-w-[1500px] gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm">
            India's salon discovery and booking marketplace. Find top salons, discover hairstyles and book in seconds.
          </p>
        </div>
        <FooterCol
          title="Explore"
          links={[
            ["Salons", "/salons"],
            ["Hairstyles", "/hairstyles"],
            ["Services", "/services"],
            ["Wedding Packages", "/wedding-packages"],
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            ["About Us", "/about"],
            ["Contact", "/contact"],
            ["Offers", "/offers"],
          ]}
        />
        <FooterCol
          title="For Business"
          links={[
            ["Salon Dashboard", "/owner"],
            ["Book a Demo", "/book-demo"],
          ]}
        />
      </div>
      <FooterContact />
      <div className="mx-auto mt-6 max-w-[1500px] border-t border-white/10 px-4 pt-6 text-xs lg:px-8">
        © {new Date().getFullYear()} SalonX. All rights reserved.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-4 space-y-2 text-sm">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="transition-colors hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterContact() {
  const { data } = usePlatformContact();
  const c = data ?? {};
  const wa = waLink(c.whatsapp);
  if (!c.phone && !c.email && !wa && !c.address) return null;
  return (
    <div className="mx-auto mt-10 flex max-w-[1500px] flex-wrap gap-x-6 gap-y-2 px-4 text-sm lg:px-8">
      {c.phone && <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:text-white">{c.phone}</a>}
      {c.email && <a href={`mailto:${c.email}`} className="hover:text-white">{c.email}</a>}
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-white">WhatsApp</a>}
      {c.address && <span>{c.address}</span>}
    </div>
  );
}
