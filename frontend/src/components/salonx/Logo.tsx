import { Scissors } from "lucide-react";

export function Logo({ subtitle = "Book. Style. Shine.", onDark = true }: { subtitle?: string; onDark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Scissors className="size-5" />
      </span>
      <span className="leading-tight">
        <span className={`block text-lg font-bold tracking-tight ${onDark ? "text-white" : "text-foreground"}`}>
          SalonX
        </span>
        <span className={`block text-[10px] ${onDark ? "text-white/60" : "text-muted-foreground"}`}>{subtitle}</span>
      </span>
    </div>
  );
}
