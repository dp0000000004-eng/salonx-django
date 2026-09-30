import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/**
 * Standard page frame: header, compact title band, content, footer.
 * The column is a flex layout so short pages keep the footer at the bottom
 * without leaving a tall band of empty space above it on desktop.
 */
export function PageShell({
  title,
  subtitle,
  children,
  narrow = false,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
  /** Centre the content in a reading-width column (forms, single cards). */
  narrow?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <div className="bg-[oklch(0.13_0.02_270)] py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[1500px] px-4 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">{subtitle}</p>
        </div>
      </div>
      <main className={`mx-auto w-full flex-1 px-4 py-8 lg:px-8 ${narrow ? "max-w-xl" : "max-w-[1500px]"}`}>{children}</main>
      <SiteFooter />
    </div>
  );
}
