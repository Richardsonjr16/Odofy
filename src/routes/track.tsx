import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import DriverMap from "../components/DriverMap";
import QRCode from "qrcode";

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
  driver_id: string | null;
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
    match: (status: string) => status === "EN_ROUTE" || status === "CLAIMED",
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
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState("");
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (trip?.status !== "EN_ROUTE" && trip?.status !== "IN_TRANSIT") {
      setQrToken(null);
      setQrDataUrl("");
      return;
    }
    fetch(`/api/v1/orders/${orderId}/verification-token`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.verification_token) setQrToken(data.verification_token);
      })
      .catch(() => {});
  }, [trip?.status, orderId]);

  useEffect(() => {
    if (!qrToken) return;
    QRCode.toDataURL(qrToken, { width: 200, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [qrToken]);

  const submitRating = async () => {
    if (!trip || ratingStars < 1) return;
    setRatingSubmitting(true);
    setRatingError("");
    try {
      const res = await fetch("/api/v1/ratings/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          receiver_id: trip.driver_id,
          role_type: "CUSTOMER_TO_DRIVER",
          stars: ratingStars,
          safety_flags: [],
          notes: "",
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      setRatingSubmitted(true);
    } catch (err) {
      console.error("Rating submission failed:", err);
      setRatingError(
        err instanceof Error ? err.message : "Failed to submit rating.",
      );
    } finally {
      setRatingSubmitting(false);
    }
  };

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

        {qrDataUrl &&
          (trip.status === "EN_ROUTE" || trip.status === "IN_TRANSIT") && (
            <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200 text-center shadow-sm">
              <p className="text-gray-800 font-bold text-xs mb-2">
                📲 Present this secure QR code to your courier upon arrival.
              </p>
              <img
                src={qrDataUrl}
                alt="Delivery verification QR code"
                className="mx-auto"
              />
              <p className="text-xs text-gray-400 mt-2">
                Expires in 30 minutes
              </p>
            </div>
          )}

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

        {trip.status === "DELIVERED" && (
          <div className="mt-6 pt-5 border-t border-gray-200">
            {ratingSubmitted ? (
              <div className="text-center py-3">
                <p className="text-2xl mb-2">🎉</p>
                <p className="text-gray-800 font-semibold">
                  Thank you! Your rating helps our couriers improve.
                </p>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">
                  How was your delivery?
                </h3>
                <p className="text-sm text-gray-500 mt-1 mb-3">
                  Rate your courier
                </p>
                <div className="flex justify-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => {
                        setRatingStars(star);
                        setRatingError("");
                      }}
                      className="text-4xl leading-none transition-transform hover:scale-110 active:scale-95 cursor-pointer select-none"
                      aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                    >
                      <span
                        style={{
                          color: star <= ratingStars ? "#FFC107" : "#D1D5DB",
                          textShadow:
                            star <= ratingStars
                              ? "0 2px 8px rgba(255,193,7,0.4)"
                              : "none",
                        }}
                      >
                        {star <= ratingStars ? "★" : "☆"}
                      </span>
                    </button>
                  ))}
                </div>
                {ratingError && (
                  <p className="text-red-600 text-xs font-medium mb-3">
                    {ratingError}
                  </p>
                )}
                <button
                  onClick={submitRating}
                  disabled={ratingSubmitting || ratingStars < 1}
                  className="w-full py-3.5 text-white font-bold text-sm rounded-full text-center shadow-md transition-all disabled:opacity-60 uppercase tracking-wider"
                  style={{
                    backgroundColor: MAROON,
                    boxShadow: "0 2px 4px rgba(94,0,9,0.1)",
                  }}
                >
                  {ratingSubmitting ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Submitting…
                    </span>
                  ) : (
                    "Submit Rating"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
