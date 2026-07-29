import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import DriverFooter from "../components/DriverFooter";

interface AvailableTrip {
  uuid: string;
  customer_name: string;
  delivery_address: string;
  dest_latitude: number;
  dest_longitude: number;
  status: string;
  driver_payout: string;
  driver_tip_allocation: string;
  created_at: string;
  cargo_type: string;
  countdown_seconds_remaining?: number;
}

export const Route = createFileRoute("/trips")({
  component: TripsPage,
});

function TripsPage() {
  const [trips, setTrips] = useState<AvailableTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  const fetchTrips = useCallback(() => {
    const token = sessionStorage.getItem("odofy_driver_token");
    if (!token) {
      setError("Driver token required.");
      setLoading(false);
      return;
    }
    fetch("/api/v1/odofy/trips/available", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: AvailableTrip[]) => {
        setTrips(data);
        const initial: Record<string, number> = {};
        for (const t of data) {
          if (t.countdown_seconds_remaining != null) {
            initial[t.uuid] = t.countdown_seconds_remaining;
          }
        }
        setCountdowns(initial);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // Countdown tick
  useEffect(() => {
    const keys = Object.keys(countdowns);
    if (keys.length === 0) return;
    const interval = setInterval(() => {
      setCountdowns((prev) => {
        const next: Record<string, number> = {};
        let changed = false;
        for (const [id, val] of Object.entries(prev)) {
          const newVal = val - 1;
          if (newVal <= 0) {
            changed = true;
          } else {
            next[id] = newVal;
          }
        }
        if (changed) {
          setTrips((prevTrips) =>
            prevTrips.filter((t) => next[t.uuid] !== undefined || t.countdown_seconds_remaining == null)
          );
        }
        return Object.keys(next).length > 0 ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdowns]);

  const handleNavigate = (address: string) => {
    const ua = navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    if (isIOS) {
      window.location.href = `maps://?daddr=${encodeURIComponent(address)}`;
    } else if (isAndroid) {
      window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    } else {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
        "_blank"
      );
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 pb-24">
      <header className="bg-msu-maroon px-6 py-6">
        <h1 className="text-xl font-bold text-white">Available Trips</h1>
      </header>

      <main className="px-4 pt-6 space-y-4">
        {loading && (
          <p className="text-center text-gray-400 py-12">Loading trips…</p>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {!loading &&
          !error &&
          trips.map((trip) => {
            const payout =
              parseFloat(trip.driver_payout) +
              parseFloat(trip.driver_tip_allocation || "0");
            const remaining = countdowns[trip.uuid];
            return (
              <div
                key={trip.uuid}
                className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100"
              >
                {/* Cargo Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    {trip.cargo_type}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    🔒 100% Locked Instant Tip
                  </span>
                </div>

                {/* Countdown */}
                {remaining != null && remaining > 0 && (
                  <div className="mb-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-center">
                    <span className="text-sm font-bold text-orange-600">
                      ⏱ {remaining}s remaining to claim
                    </span>
                  </div>
                )}

                {/* Trip Info */}
                <div className="space-y-2">
                  <p className="font-semibold text-charcoal">
                    {trip.customer_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    📍 {trip.delivery_address}
                  </p>
                  <p className="text-sm text-gray-400">
                    🕒{" "}
                    {new Date(trip.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Action Row */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-extrabold text-msu-maroon">
                    ${payout.toFixed(2)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleNavigate(trip.delivery_address)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                    >
                      🗺️ Navigate
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        {!loading && !error && trips.length === 0 && (
          <p className="text-center text-gray-400 py-12">
            No available trips right now.
          </p>
        )}
      </main>

      <DriverFooter />
    </div>
  );
}
