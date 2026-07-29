import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import DriverFooter from "../components/DriverFooter";

interface Trip {
  uuid: string;
  customer_name: string;
  driver_payout: string;
  driver_tip_allocation: string;
  batch_id: string | null;
  created_at: string;
}

type ViewMode = "weeks" | { weekStart: string; trips: Trip[] };

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${formatDate(monday)} — ${formatDate(sunday)}`;
}

function getWeekKey(d: Date): string {
  const m = getMonday(d);
  return m.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/earnings-history")({
  component: EarningsHistoryPage,
});

function EarningsHistoryPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("weeks");
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("odofy_driver_token");
    if (!token) {
      setError("Driver token required. Please log in.");
      setLoading(false);
      return;
    }
    fetch("/api/v1/odofy/drivers/earnings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Trip[]) => {
        setTrips(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Group by ISO week
  const weeklyGroups = useMemo(() => {
    const groups: Record<string, { trips: Trip[]; total: number }> = {};
    for (const t of trips) {
      const key = getWeekKey(new Date(t.created_at));
      if (!groups[key]) groups[key] = { trips: [], total: 0 };
      groups[key].trips.push(t);
      groups[key].total += parseFloat(t.driver_payout) + parseFloat(t.driver_tip_allocation || "0");
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [trips]);

  // Current week
  const currentWeekMonday = getMonday(new Date());
  const currentWeekKey = currentWeekMonday.toISOString().slice(0, 10);
  const currentWeekTotal = weeklyGroups.find(([k]) => k === currentWeekKey)?.[1].total ?? 0;

  // Daily drill-down for expanded week
  const dailyGroups = useMemo(() => {
    if (!expandedWeek) return null;
    const weekTrips = weeklyGroups.find(([k]) => k === expandedWeek)?.[1].trips ?? [];
    const days: Record<string, { trips: Trip[]; baseTotal: number; tipTotal: number }> = {};
    for (const t of weekTrips) {
      const day = t.created_at.slice(0, 10);
      if (!days[day]) days[day] = { trips: [], baseTotal: 0, tipTotal: 0 };
      days[day].trips.push(t);
      days[day].baseTotal += parseFloat(t.driver_payout);
      days[day].tipTotal += parseFloat(t.driver_tip_allocation || "0");
    }
    return Object.entries(days).sort((a, b) => b[0].localeCompare(a[0]));
  }, [expandedWeek, weeklyGroups]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading earnings…</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-24">
      <header className="bg-msu-maroon px-6 py-6">
        <h1 className="text-xl font-bold text-white">Earnings History</h1>
      </header>

      <main className="px-4 pt-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Section A: Current Week Summary */}
        <div className="rounded-2xl border-l-4 border-msu-maroon bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Confirmed Earnings This Week
          </p>
          <p className="mt-2 text-4xl font-extrabold text-msu-maroon">
            ${currentWeekTotal.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {formatWeekRange(currentWeekMonday)}
          </p>
        </div>

        {/* Section B: Historical Archive */}
        <div className="rounded-2xl bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-charcoal">Historical Archive</h2>
          </div>
          {weeklyGroups.map(([weekKey, group]) => {
            const monday = new Date(weekKey + "T00:00:00");
            const isExpanded = expandedWeek === weekKey;
            return (
              <div key={weekKey}>
                <button
                  onClick={() =>
                    setExpandedWeek(isExpanded ? null : weekKey)
                  }
                  className="flex w-full items-center justify-between px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50"
                >
                  <div className="text-left">
                    <p className="font-semibold text-charcoal">
                      {formatWeekRange(monday)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {group.trips.length} trip{group.trips.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-msu-maroon">
                      ${group.total.toFixed(2)}
                    </span>
                    <span className="text-gray-400 text-sm">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {/* Section C: Daily Drill-Down */}
                {isExpanded && dailyGroups && (
                  <div className="bg-gray-50 divide-y divide-gray-100">
                    {dailyGroups.map(([dayKey, day]) => {
                      const dayDate = new Date(dayKey + "T00:00:00");
                      const dayName = dayDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      });
                      const isDayExpanded = expandedDay === dayKey;
                      return (
                        <div key={dayKey}>
                          <button
                            onClick={() =>
                              setExpandedDay(isDayExpanded ? null : dayKey)
                            }
                            className="flex w-full items-center justify-between px-8 py-3 hover:bg-gray-100 transition"
                          >
                            <div className="text-left">
                              <p className="text-sm font-semibold text-charcoal">
                                {dayName}
                              </p>
                              <p className="text-xs text-gray-400">
                                Base: ${day.baseTotal.toFixed(2)} · Tips: $
                                {day.tipTotal.toFixed(2)}
                              </p>
                            </div>
                            <span className="font-bold text-charcoal text-sm">
                              ${(day.baseTotal + day.tipTotal).toFixed(2)}
                            </span>
                          </button>

                          {/* Section D: Trip Log */}
                          {isDayExpanded && (
                            <div className="bg-white divide-y divide-gray-50">
                              {day.trips.map((trip) => {
                                const total =
                                  parseFloat(trip.driver_payout) +
                                  parseFloat(trip.driver_tip_allocation || "0");
                                const orderCount = trip.batch_id ? 2 : 1;
                                return (
                                  <div
                                    key={trip.uuid}
                                    className="px-8 py-3 flex items-center justify-between"
                                  >
                                    <div>
                                      <p className="text-xs font-mono text-gray-400">
                                        {trip.uuid.slice(0, 8)}…
                                      </p>
                                      <p className="text-sm text-charcoal">
                                        {orderCount === 1
                                          ? "1 order"
                                          : "2 orders (Batched)"}
                                      </p>
                                      <p className="text-xs text-gray-400">
                                        {new Date(trip.created_at).toLocaleTimeString(
                                          "en-US",
                                          { hour: "numeric", minute: "2-digit" }
                                        )}
                                      </p>
                                    </div>
                                    <span className="font-bold text-msu-maroon">
                                      ${total.toFixed(2)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="px-8 py-3 text-xs text-gray-400 italic">
                      🔒 Odofy Integrity: 100% of your earnings and tips are
                      confirmed instantly with zero 24-hour tip-baiting holds.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {weeklyGroups.length === 0 && !error && (
            <p className="px-5 py-8 text-center text-gray-400">
              No completed trips yet.
            </p>
          )}
        </div>
      </main>

      <DriverFooter />
    </div>
  );
}
