import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import DriverMap from "../components/DriverMap";

export const Route = createFileRoute("/track")({
  component: TrackPage,
});

function getOrderIdFromPath(): string {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/");
  return parts[parts.length - 1] || "";
}

interface TripData {
  status: string;
  driver_latitude: number | null;
  driver_longitude: number | null;
  customer_name: string;
  delivery_address: string;
  created_at: string;
  driver_name: string | null;
  driver_eta_mins: number | null;
}

const MAROON = "#5E0009";
const GRAY = "#D1D5DB";

const STATUS_STAGES = [
  {
    key: "PENDING",
    match: (status: string) =>
      status === "PENDING_PICKUP" || status === "HOLD_UNTIL_OPENING",
    label: "📦 Order Confirmed & Preparing at Store",
  },
  {
    key: "CLAIMED",
    match: (status: string) =>
      status === "EN_ROUTE" || status === "CLAIMED",
    label: "🚗 Courier On The Way",
  },
  {
    key: "DELIVERED",
    match: (status: string) => status === "DELIVERED",
    label: "🏁 Package Safely Arrived",
  },
];

function getActiveStageIndex(status: string): number {
  if (status === "DELIVERED") return 2;
  if (status === "EN_ROUTE" || status === "CLAIMED") return 1;
  return 0;
}

function TrackPage() {
  const orderId = getOrderIdFromPath();
  const [trip, setTrip] = useState<TripData | null>(null);
  const [driverLoc, setDriverLoc] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [etaMins, setEtaMins] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTrip() {
      try {
        const res = await fetch(`/api/v1/odofy/trips/public/${orderId}`);
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) {
              setError("Delivery not found. Check your link and try again.");
              setLoading(false);
            }
          }
          return;
        }
        const data: TripData = await res.json();
        if (!cancelled) {
          setTrip(data);
          setEtaMins(data.driver_eta_mins);
          if (data.driver_latitude && data.driver_longitude) {
            setDriverLoc({
              lat: data.driver_latitude,
              lng: data.driver_longitude,
            });
          }
          setLoading(false);
        }
      } catch {
        // keep loading on transient errors
      }
    }

    fetchTrip();

    pollRef.current = setInterval(fetchTrip, 5000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#5E0009]" />
          <p className="text-gray-600 text-lg">Loading your delivery...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <span className="text-2xl">😕</span>
          </div>
          <p className="text-gray-800 text-lg font-semibold">
            {error || "Delivery not found. Check your link and try again."}
          </p>
        </div>
      </div>
    );
  }

  const activeStageIndex = getActiveStageIndex(trip.status);

  return (
    <div className="min-h-dvh flex flex-col bg-gray-100">
      <div className="h-[45vh] w-full relative">
        <DriverMap currentLocation={driverLoc} />
      </div>

      <div className="bg-white rounded-t-[28px] p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] flex-1 -mt-6 z-20 relative">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          Your courier is approximately {etaMins != null ? etaMins : "--"} mins
          away
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {trip.driver_name
            ? `Courier: ${trip.driver_name}`
            : "Waiting for a courier to accept your delivery..."}
        </p>

        <div className="space-y-0">
          {STATUS_STAGES.map((stage, index) => {
            const isActive = index === activeStageIndex;
            const isComplete = index < activeStageIndex;
            const isPending = index > activeStageIndex;

            const circleColor = isComplete || isActive ? MAROON : GRAY;
            const lineColor = isComplete ? MAROON : GRAY;
            const textColor =
              isComplete || isActive ? "text-gray-900" : "text-gray-400";

            return (
              <div key={stage.key} className="flex items-stretch">
                <div className="flex flex-col items-center mr-4">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center relative"
                    style={{
                      backgroundColor: isComplete ? MAROON : "transparent",
                      border: isComplete
                        ? `3px solid ${MAROON}`
                        : isActive
                          ? `3px solid ${MAROON}`
                          : `3px solid ${GRAY}`,
                    }}
                  >
                    {isComplete && (
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                    {isActive && (
                      <div
                        className="w-3 h-3 rounded-full animate-pulse"
                        style={{ backgroundColor: MAROON }}
                      />
                    )}
                  </div>
                  {index < STATUS_STAGES.length - 1 && (
                    <div
                      className="w-0.5 flex-1 min-h-[28px]"
                      style={{ backgroundColor: lineColor }}
                    />
                  )}
                </div>
                <div className={`pb-5 text-sm font-medium ${textColor}`}>
                  {stage.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Order ID: {orderId.slice(0, 8)}...
          </p>
          {trip.delivery_address && (
            <p className="text-xs text-gray-400 mt-1">
              Delivering to: {trip.delivery_address}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
