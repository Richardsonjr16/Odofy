import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import DriverFooter from "../components/DriverFooter";
import DriverMap from "../components/DriverMap";

interface DriverProfile {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface AvailableTrip {
  uuid: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  dest_latitude: number;
  dest_longitude: number;
  driver_payout: string;
  driver_tip_allocation: string;
  merchant_id: string;
  created_at: string;
}

const SPRINGFIELD_PICKUPS = [
  "2825 S Glenstone Ave, Springfield, MO 65804 (Boutique Axis)",
  "3300 S Campbell Ave, Springfield, MO 65807 (Battlefield Mall Hub)",
  "1720 W Battlefield Rd, Springfield, MO 65807 (Retail Core)",
];

const SPRINGFIELD_DROPOFFS = [
  "900 E Parkview St, Springfield, MO 65897 (MSU Campus Core)",
  "901 S National Ave, Springfield, MO 65897 (MSU Plaster Center)",
  "1111 E Elm St, Springfield, MO 65806 (Downtown Core)",
];

const MAROON = "#5E0009";

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatTimeDisplay(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function generateTimeSlots(): { value: string; label: string }[] {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const roundedMinutes = Math.ceil(currentMinutes / 30) * 30;
  const slots: { value: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const totalMinutes = roundedMinutes + i * 30;
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    slots.push({ value, label });
  }
  return slots;
}

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [trips, setTrips] = useState<AvailableTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [approveError, setApproveError] = useState<string | null>(null);
  const [showExpiryAlert, setShowExpiryAlert] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [targetedTrip, setTargetedTrip] = useState<AvailableTrip | null>(null);
  const [targetedTimer, setTargetedTimer] = useState(60);
  const [onlineDrivers] = useState(3);
  const [offerEndTime, setOfferEndTime] = useState<string | null>(null);
  const [isTimeDrawerOpen, setIsTimeDrawerOpen] = useState(false);
  const [isOdofyNowActive, setIsOdofyNowActive] = useState(false);
  const targetedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        console.log("got position", position.coords);
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        if (error.PERMISSION_DENIED) {
          setLocationError("Location permission denied");
        } else if (error.POSITION_UNAVAILABLE) {
          setLocationError("Location unavailable");
        } else if (error.TIMEOUT) {
          setLocationError("Location request timed out");
        } else {
          setLocationError("Location error");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const visibleTrips = useMemo(
    () => trips.filter((t) => !removedIds.has(t.uuid)),
    [trips, removedIds]
  );

  const mapMarkers = useMemo(() => {
    return visibleTrips.map((trip) => ({
      lat: Number(trip.dest_latitude),
      lng: Number(trip.dest_longitude),
      label: "📍",
      color: MAROON,
    }));
  }, [visibleTrips]);

  useEffect(() => {
    const saved = sessionStorage.getItem("odofy_driver_token");
    if (saved) {
      setToken(saved);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    fetch("/api/v1/odofy/drivers/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((p: DriverProfile) => {
        setProfile(p);
        sessionStorage.setItem("odofy_driver_profile", JSON.stringify(p));
      })
      .catch(() => {});

    fetch("/api/v1/odofy/trips/available", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: AvailableTrip[]) => {
        const allTrips = Array.isArray(data) ? data : [];
        if (allTrips.length > 0 && !targetedTrip) {
          if (currentLocation) {
            let closestIdx = 0;
            let closestDist = Infinity;
            allTrips.forEach((trip, i) => {
              const dist = haversineDistance(
                currentLocation.lat,
                currentLocation.lng,
                Number(trip.dest_latitude),
                Number(trip.dest_longitude)
              );
              if (dist < closestDist) {
                closestDist = dist;
                closestIdx = i;
              }
            });
            const closest = allTrips[closestIdx];
            setTargetedTrip(closest);
            setTrips(allTrips.filter((_, i) => i !== closestIdx));
          } else {
            setTargetedTrip(allTrips[0]);
            setTrips(allTrips.slice(1));
          }
        } else {
          setTrips(allTrips);
        }
      })
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!showExpiryAlert) return;
    const t = setTimeout(() => setShowExpiryAlert(false), 3000);
    return () => clearTimeout(t);
  }, [showExpiryAlert]);

  useEffect(() => {
    if (!targetedTrip) {
      if (targetedTimerRef.current) {
        clearInterval(targetedTimerRef.current);
        targetedTimerRef.current = null;
      }
      return;
    }
    setTargetedTimer(60);
    targetedTimerRef.current = setInterval(() => {
      setTargetedTimer((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (targetedTimerRef.current) {
        clearInterval(targetedTimerRef.current);
        targetedTimerRef.current = null;
      }
    };
  }, [targetedTrip]);

  useEffect(() => {
    if (targetedTimer === 0 && targetedTrip) {
      if (onlineDrivers <= 3) {
        setTrips((prev) => [...prev, targetedTrip!]);
      }
      setTargetedTrip(null);
    }
  }, [targetedTimer, targetedTrip, onlineDrivers]);

  useEffect(() => {
    if (!isOdofyNowActive || !offerEndTime) return;

    const checkInterval = setInterval(() => {
      const now = new Date();
      const [targetH, targetM] = offerEndTime.split(':').map(Number);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const targetMinutes = targetH * 60 + targetM;

      if (currentMinutes >= targetMinutes) {
        setIsOdofyNowActive(false);
        setOfferEndTime(null);
        setTrips([]);
        setTargetedTrip(null);
        setTargetedTimer(60);
      }
    }, 30000);

    return () => clearInterval(checkInterval);
  }, [isOdofyNowActive, offerEndTime]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) return;
    sessionStorage.setItem("odofy_driver_token", trimmed);
    setToken(trimmed);
    setTokenInput("");
  };

  const handleSignOut = () => {
    sessionStorage.removeItem("odofy_driver_token");
    sessionStorage.removeItem("odofy_driver_profile");
    setToken(null);
    setProfile(null);
    setTrips([]);
    setLoading(true);
  };

  const handleReject = (tripId: string) => {
    setRemovedIds((prev) => new Set(prev).add(tripId));
  };

  const handleApprove = async (tripId: string) => {
    setApproveError(null);
    setApprovingIds((prev) => new Set(prev).add(tripId));
    try {
      const res = await fetch(`/api/v1/odofy/trips/${tripId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "EN_ROUTE" }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      setRemovedIds((prev) => new Set(prev).add(tripId));
    } catch (err) {
      setApproveError(
        err instanceof Error ? err.message : "Failed to approve trip"
      );
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(tripId);
        return next;
      });
    }
  };

  const handleOdofyNow = () => {
    if (!token) return;
    setLoading(true);
    fetch("/api/v1/odofy/trips/available", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: AvailableTrip[]) => {
        const newTrips = Array.isArray(data) ? data : [];
        if (newTrips.length < trips.length) {
          setShowExpiryAlert(true);
        }
        setTrips(newTrips);
        setRemovedIds(new Set());
      })
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  };

  const handleTargetedAccept = async (tripId: string) => {
    setApproveError(null);
    setApprovingIds((prev) => new Set(prev).add(tripId));
    try {
      const res = await fetch(`/api/v1/odofy/trips/${tripId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "EN_ROUTE" }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      setRemovedIds((prev) => new Set(prev).add(tripId));
      setTargetedTrip(null);
    } catch (err) {
      setApproveError(
        err instanceof Error ? err.message : "Failed to approve trip"
      );
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(tripId);
        return next;
      });
    }
  };

  const handleTargetedReject = () => {
    const trip = targetedTrip;
    if (!trip) return;
    if (onlineDrivers > 3) {
      setTargetedTrip(null);
    } else {
      setTrips((prev) => [...prev, trip]);
      setTargetedTrip(null);
    }
  };

  if (!token) {
    return (
      <div className="min-h-dvh bg-[#F8F9FA] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: MAROON }}
            >
              <span className="text-white text-2xl font-extrabold">O</span>
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-1">
              Odofy
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              Driver Dashboard
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="driverToken"
                className="block text-sm font-semibold text-gray-700 mb-1.5"
              >
                Enter your Driver Token
              </label>
              <input
                id="driverToken"
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Driver auth token"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5E0009]/20 focus:border-[#5E0009] transition-shadow shadow-sm"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!tokenInput.trim()}
              className="w-full rounded-xl font-semibold text-white text-sm py-3.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#5E0009]/20 active:scale-[0.98]"
              style={{ backgroundColor: MAROON }}
            >
              Sign In
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-6">
            Powered by Odofy — Springfield delivery network
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#F8F9FA] flex flex-col font-sans relative overflow-hidden pb-20">
      {/* ── TOP 40% — FULL-BLEED GEOCATCH MAP ── */}
      <div className="w-full h-[40vh] relative z-10">
        <DriverMap markers={mapMarkers} currentLocation={currentLocation} />

        {locationError && (
          <div className="absolute bottom-4 left-4 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium px-2 py-1 rounded-full z-20">
            {locationError}
          </div>
        )}

        {/* Upper Right — Tool buttons */}
        <div className="absolute top-4 right-4 flex flex-col items-end z-20 gap-2">
          <button
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100 text-gray-700 transition-transform active:scale-95"
            title="Map Layers"
          >
            🗺️
          </button>
          <button
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100 text-gray-700 transition-transform active:scale-95"
            title="Info"
          >
            ℹ️
          </button>
          <button
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100 text-gray-700 transition-transform active:scale-95"
            title="Recenter"
          >
            🎯
          </button>
        </div>
      </div>

      {/* ── BOTTOM 60% — SLIDING TOUCH CONSOLE SHEET ── */}
      <div className="w-full h-[60vh] bg-white rounded-t-[28px] shadow-[0_-10px_30px_rgba(0,0,0,0.05)] px-4 pt-4 z-20 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [webkit-overflow-scrolling:touch] -mt-6 relative snap-y snap-proximity">
        {/* Get Offers Until anchor — top right of sheet */}
        <div
          onClick={() => setIsTimeDrawerOpen(true)}
          className="absolute top-4 right-4 bg-gray-50 border border-gray-100 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm hover:bg-gray-100 transition-colors z-30 cursor-pointer"
        >
          <span className="text-xs font-semibold text-gray-700">
            Get offers until {offerEndTime ? formatTimeDisplay(offerEndTime) : '--:--'}
          </span>
        </div>

        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 block sticky top-0 bg-white pb-2 z-30" />

        {/* ── "JUST FOR YOU" TARGETED OFFER ── */}
        {targetedTrip && (() => {
          const basePayout = parseFloat(targetedTrip.driver_payout) || 6.5;
          const tip = parseFloat(targetedTrip.driver_tip_allocation) || 0;
          const total = basePayout + tip;
          const idx = 0;
          const pickup = SPRINGFIELD_PICKUPS[0];
          const dropoff = SPRINGFIELD_DROPOFFS[0];
          const isApproving = approvingIds.has(targetedTrip.uuid);
          const strokeDash = (targetedTimer / 60) * 62.83;

          return (
            <div className="w-full bg-[#E8F0FE] rounded-2xl mb-4 overflow-hidden border border-[#D2E3FC] shadow-sm">
              <div className="w-full bg-[#E8F0FE] px-4 py-2.5 flex items-center justify-between border-b border-[#D2E3FC]">
                <span className="text-sm font-semibold text-[#185ABC]">Just for you</span>
                <div className="flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="#D2E3FC" strokeWidth="2" />
                    <circle
                      cx="12" cy="12" r="10"
                      fill="none"
                      stroke="#185ABC"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={`${strokeDash} 62.83`}
                      transform="rotate(-90 12 12)"
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <span className="text-xs font-bold text-[#185ABC] w-8 text-right tabular-nums">
                    {Math.floor(targetedTimer / 60)}:{String(targetedTimer % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>
              <div className="p-4 flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-gray-900">${total.toFixed(2)}</span>
                    <span className="text-xs font-normal text-gray-400 ml-1 pb-1 self-end">estimate</span>
                  </div>
                  <span className="text-gray-400 text-2xl leading-none">›</span>
                </div>
                <p className="text-sm font-semibold text-gray-600 tracking-tight">2 stops • 4.3 miles • 25 mins</p>
                <span className="bg-[#E6F4EA] text-[#137333] px-2.5 py-0.5 rounded-md text-xs font-bold w-fit uppercase tracking-wider">Multi-trip incentive</span>
                <p className="text-sm font-semibold text-gray-800 mt-1">🏪 ASAP • Boutique Retail Pickup • Odofy Axis</p>
                <p className="text-xs font-medium text-gray-500 mt-1 whitespace-pre-line leading-relaxed">
                  📍 Pickup: {pickup}{"\n"}🎯 Dropoff: {dropoff}
                </p>
                <div className="flex items-center gap-3 mt-2 w-full">
                  <button onClick={handleTargetedReject} className="flex-1 py-3 bg-[#EEF0F2] text-[#1A1C1E] font-bold text-sm rounded-full text-center shadow-sm hover:bg-[#E1E3E5] transition-colors">REJECT</button>
                  <button onClick={() => handleTargetedAccept(targetedTrip.uuid)} disabled={isApproving} className="flex-1 py-3 bg-[#5E0009] text-white font-bold text-sm rounded-full text-center shadow-md shadow-[#5E0009]/10 hover:bg-[#4A0007] transition-colors disabled:opacity-60">
                    {isApproving ? <span className="inline-flex items-center gap-1.5"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>Claiming…</span> : "ACCEPT"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {approveError && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between">
            <span>{approveError}</span>
            <button
              onClick={() => setApproveError(null)}
              className="ml-2 underline font-medium shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-[#5E0009] border-t-transparent" />
            <p className="mt-3 text-sm text-gray-400 font-medium">
              Scanning network for available trips…
            </p>
          </div>
        )}

        {/* STATE A: EMPTY QUEUE */}
        {!loading && visibleTrips.length === 0 && !targetedTrip && (
          <>
            <button
              onClick={handleOdofyNow}
              className="w-full py-4 bg-[#5E0009] text-white font-bold text-lg rounded-full shadow-lg shadow-[#5E0009]/20 tracking-wide transition-all active:scale-[0.98] mb-6"
            >
              ODOFY NOW
            </button>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-5xl mb-4">📭</span>
              <p className="text-lg font-semibold text-gray-700">
                No trip offers right now
              </p>
              <p className="text-sm font-medium text-gray-400 mt-1">
                New offers will appear here when available
              </p>
            </div>
          </>
        )}

        {/* STATE B: POPULATED QUEUE */}
        {!loading &&
          visibleTrips.length > 0 &&
          visibleTrips.map((trip, idx) => {
            const basePayout = parseFloat(trip.driver_payout) || 6.5;
            const tip = parseFloat(trip.driver_tip_allocation) || 0;
            const total = basePayout + tip;
            const pickup =
              SPRINGFIELD_PICKUPS[idx % SPRINGFIELD_PICKUPS.length];
            const dropoff =
              SPRINGFIELD_DROPOFFS[idx % SPRINGFIELD_DROPOFFS.length];
            const isApproving = approvingIds.has(trip.uuid);

            return (
              <div
                key={trip.uuid}
                className="w-full bg-white border border-gray-200/80 rounded-2xl p-4 mb-4 shadow-sm relative hover:border-gray-300 transition-all flex flex-col gap-2.5 snap-start"
              >
                {/* Row 1: Payout + estimate + chevron */}
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-gray-900">
                      ${total.toFixed(2)}
                    </span>
                    <span className="text-xs font-normal text-gray-400 ml-1 pb-1 self-end">
                      estimate
                    </span>
                  </div>
                  <span className="text-gray-400 text-2xl leading-none">
                    ›
                  </span>
                </div>

                {/* Row 2: Run metrics */}
                <p className="text-sm font-semibold text-gray-600 tracking-tight">
                  2 stops • 4.3 miles • 25 mins
                </p>

                {/* Row 3: Green incentive badge */}
                <span className="bg-[#E6F4EA] text-[#137333] px-2.5 py-0.5 rounded-md text-xs font-bold w-fit uppercase tracking-wider">
                  Multi-trip incentive
                </span>

                {/* Row 4: Merchant routing context */}
                <p className="text-sm font-semibold text-gray-800 mt-1">
                  🏪 ASAP • Boutique Retail Pickup • Odofy Axis
                </p>
                <p className="text-xs font-medium text-gray-500 mt-1 whitespace-pre-line leading-relaxed">
                  📍 Pickup: {pickup}
                  {"\n"}🎯 Dropoff: {dropoff}
                </p>

                {/* Split action buttons */}
                <div className="flex items-center gap-3 mt-2 w-full">
                  <button
                    onClick={() => handleReject(trip.uuid)}
                    className="flex-1 py-3 bg-[#EEF0F2] text-[#1A1C1E] font-bold text-sm rounded-full text-center shadow-sm hover:bg-[#E1E3E5] transition-colors"
                  >
                    REJECT
                  </button>
                  <button
                    onClick={() => handleApprove(trip.uuid)}
                    disabled={isApproving}
                    className="flex-1 py-3 bg-[#5E0009] text-white font-bold text-sm rounded-full text-center shadow-md shadow-[#5E0009]/10 hover:bg-[#4A0007] transition-colors disabled:opacity-60"
                  >
                    {isApproving ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Claiming…
                      </span>
                    ) : (
                      "ACCEPT"
                    )}
                  </button>
                </div>
              </div>
            );
          })}



      </div>

      {/* ── CONDITIONAL EXPIRY ALERT BANNER ── */}
      {showExpiryAlert && (
        <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto w-full bg-[#0A192F] text-white text-xs font-medium px-4 py-3 leading-snug flex items-center border-t border-white/10 z-30 animate-slide-up">
          <span>
            Some offers are no longer available. They either expired, another
            driver accepted, or orders changed.
          </span>
        </div>
      )}

      <DriverFooter />
    </div>

    {/* ── TIME SELECTION DRAWER ── */}
    {isTimeDrawerOpen && (
      <>
        {/* Dark backdrop */}
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setIsTimeDrawerOpen(false)}
        />
        {/* Drawer */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[28px] z-50 px-6 pt-6 pb-8 animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.15)]">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor:'#5E0009'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Odofy Now</h2>
              <p className="text-sm font-medium text-gray-500 mt-0.5">
                With Odofy Now turned on, you will receive offers until:
              </p>
            </div>
          </div>

          {/* Time slots */}
          <div className="space-y-2 mb-6">
            {generateTimeSlots().map((slot) => {
              const isSelected = offerEndTime === slot.value;
              return (
                <div
                  key={slot.value}
                  onClick={() => setOfferEndTime(slot.value)}
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl cursor-pointer transition-colors hover:bg-gray-50"
                  style={{backgroundColor: isSelected ? '#FDF2F4' : 'transparent'}}
                >
                  <span className="text-base font-semibold text-gray-800">{slot.label}</span>
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{
                      borderColor: isSelected ? '#5E0009' : '#D1D5DB',
                      backgroundColor: isSelected ? '#5E0009' : 'transparent'
                    }}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <button
            onClick={() => {
              setOfferEndTime(null);
              setIsOdofyNowActive(false);
              setIsTimeDrawerOpen(false);
            }}
            className="w-full py-3.5 bg-[#EEF0F2] text-[#1A1C1E] font-bold text-sm rounded-full mb-3 hover:bg-[#E1E3E5] transition-colors"
          >
            TURN OFF
          </button>
          <button
            onClick={() => {
              if (offerEndTime) {
                setIsOdofyNowActive(true);
                setIsTimeDrawerOpen(false);
              }
            }}
            disabled={!offerEndTime}
            className="w-full py-3.5 font-bold text-sm rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{backgroundColor: '#5E0009', color: 'white'}}
          >
            TURN ON
          </button>
        </div>
      </>
    )}
  );
}
