import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Panel } from "@/components/salonx/DashboardShell";
import { AppointmentDialog, Empty, ErrorNote, Loading, StatusBadge, inputClass } from "@/components/owner/shared";
import {
  ACTIVE_STATUSES,
  bookingEndTime,
  bookingItemName,
  todayISO,
  useOwnerBlocks,
  useOwnerBookings,
  useOwnerHours,
  type OwnerBooking,
} from "@/lib/owner-queries";
import { formatTime } from "@/lib/queries";

type View = "day" | "week" | "month";

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function OwnerCalendar({ salonId }: { salonId: string }) {
  const bookings = useOwnerBookings(salonId);
  const hours = useOwnerHours(salonId);
  const blocks = useOwnerBlocks(salonId);
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<OwnerBooking | null>(null);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week") {
      const start = new Date(`${anchor}T00:00:00`);
      start.setDate(start.getDate() - start.getDay());
      return Array.from({ length: 7 }, (_, i) => addDays(start.toISOString().slice(0, 10), i));
    }
    const d = new Date(`${anchor}T00:00:00`);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const total = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return Array.from({ length: total }, (_, i) => {
      const day = new Date(first);
      day.setDate(i + 1);
      return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    });
  }, [view, anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, OwnerBooking[]>();
    for (const b of bookings.data ?? []) {
      if (statusFilter && b.status !== statusFilter) continue;
      const list = map.get(b.booking_date) ?? [];
      list.push(b);
      map.set(b.booking_date, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.slot_time.localeCompare(b.slot_time));
    return map;
  }, [bookings.data, statusFilter]);

  const step = view === "day" ? 1 : view === "week" ? 7 : 30;

  if (bookings.isLoading) return <Loading label="Loading calendar…" />;
  if (bookings.error) return <ErrorNote error={bookings.error} onRetry={() => void bookings.refetch()} />;

  return (
    <Panel title="Calendar" icon={CalendarDays}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs capitalize ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <button onClick={() => setAnchor(addDays(anchor, -step))} className="rounded-lg border border-border p-1.5" aria-label="Previous">
          <ChevronLeft className="size-4" />
        </button>
        <input type="date" className={`${inputClass} w-auto`} value={anchor} onChange={(e) => setAnchor(e.target.value)} />
        <button onClick={() => setAnchor(addDays(anchor, step))} className="rounded-lg border border-border p-1.5" aria-label="Next">
          <ChevronRight className="size-4" />
        </button>
        <button onClick={() => setAnchor(todayISO())} className="rounded-lg border border-border px-3 py-1.5 text-xs">
          Today
        </button>
        <select className={`${inputClass} w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="service_started">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className={view === "month" ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-3" : view === "week" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" : ""}>
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          const weekday = new Date(`${day}T00:00:00`).getDay();
          const hour = (hours.data ?? []).find((h) => h.weekday === weekday);
          const dayBlocks = (blocks.data ?? []).filter((b) => b.block_date === day);
          const closed = hour?.is_closed || dayBlocks.some((b) => b.full_day);
          if (view === "month" && list.length === 0 && !closed) return null;
          return (
            <div key={day} className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  {new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {closed ? "Closed" : hour ? `${formatTime(hour.open_time.slice(0, 5))}–${formatTime(hour.close_time.slice(0, 5))}` : ""}
                </span>
              </div>
              {dayBlocks.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {dayBlocks.map((b) => (
                    <li key={b.id} className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
                      Blocked {b.full_day ? "all day" : `${formatTime((b.start_time ?? b.slot_time ?? "").slice(0, 5))}–${formatTime((b.end_time ?? "").slice(0, 5))}`}
                      {b.reason ? ` · ${b.reason}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {list.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No appointments.</p>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((b) => (
                    <li key={b.id}>
                      <button
                        onClick={() => setSelected(b)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] hover:bg-muted ${
                          ACTIVE_STATUSES.includes(b.status) ? "" : "opacity-70"
                        }`}
                      >
                        <span className="w-24 shrink-0 font-medium text-foreground">
                          {formatTime(b.slot_time.slice(0, 5))}–{formatTime(bookingEndTime(b))}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {b.profiles?.full_name ?? "Customer"} · {bookingItemName(b)}
                        </span>
                        <StatusBadge status={b.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {view === "month" && days.every((d) => (byDay.get(d) ?? []).length === 0) && (
        <Empty title="No appointments this month" description="Pick another month or wait for new bookings." />
      )}

      <AppointmentDialog booking={selected} salonId={salonId} onClose={() => setSelected(null)} />
    </Panel>
  );
}
