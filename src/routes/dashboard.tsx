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
  scheduled_pickup_time?: string;
}

interface PickupItem {
  title: string;
  name?: string;
  quantity: number;
  image_url: string;
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
const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23f3f4f6'/%3E%3Crect x='14' y='20' width='36' height='28' rx='3' fill='%23d1d5db' stroke='%239ca3af' stroke-width='1.5'/%3E%3Cpath d='M14 22 L32 14 L50 22' fill='none' stroke='%239ca3af' stroke-width='1.5'/%3E%3Cpath d='M32 14 L32 44' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-dasharray='3,3'/%3E%3C/svg%3E";

const SAMPLE_PICKUP_ITEMS: PickupItem[] = [
  {
    title: "Premium Cotton T-Shirt",
    quantity: 2,
    image_url: PLACEHOLDER_IMG,
  },
  {
    title: "Slim Fit Selvedge Jeans",
    quantity: 1,
    image_url: PLACEHOLDER_IMG,
  },
  {
    title: "Italian Leather Belt",
    quantity: 1,
    image_url: PLACEHOLDER_IMG,
  },
  {
    title: "Cashmere Blend Sweater",
    quantity: 1,
    image_url: PLACEHOLDER_IMG,
  },
];

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
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatPickupTime(date: Date | null): string {
  if (!date) return "--:--";
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const ampm = hours >= 12 ? "PM" : "AM";
  return `${hour}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

function generateTimeSlots(): { value: string; label: string }[] {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const roundedMinutes = Math.ceil(currentMinutes / 30) * 30;
  const slots: { value: string; label: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const totalMinutes = roundedMinutes + i * 30;
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? "PM" : "AM";
    const label = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
    slots.push({ value, label });
  }
  return slots;
}

// ── SLIDE TRACK COMPONENT ──
function SlideTrack({
  label,
  onSlideComplete,
  disabled,
}: {
  label: string;
  onSlideComplete: () => void;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!trackRef.current || disabled) return;
      const rect = trackRef.current.getBoundingClientRect();
      const thumbWidth = 48;
      const maxTravel = rect.width - thumbWidth - 8;
      const raw =
        ((clientX - rect.left - thumbWidth / 2) / maxTravel) * 100;
      setProgress(Math.max(0, Math.min(100, raw)));
    },
    [disabled]
  );

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setDragging(true);
    handleMove(e.touches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (dragging && !disabled) handleMove(e.touches[0].clientX);
  };

  const onTouchEnd = () => {
    setDragging(false);
    if (progress >= 95) {
      setProgress(100);
      onSlideComplete();
    } else {
      setProgress(0);
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setDragging(true);
    handleMove(e.clientX);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging && !disabled) handleMove(e.clientX);
  };

  const onMouseUp = () => {
    setDragging(false);
    if (progress >= 95) {
      setProgress(100);
      onSlideComplete();
    } else {
      setProgress(0);
    }
  };

  const thumbLeft = Math.min(progress, 92);

  return (
    <div
      ref={trackRef}
      className="w-full bg-[#5E0009] text-white font-bold text-sm rounded-full py-4 relative flex items-center justify-center select-none overflow-hidden cursor-pointer touch-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <span className="uppercase tracking-wider text-xs">{label}</span>
      <div
        className="w-12 h-12 bg-[#0A192F] rounded-full absolute left-1 flex items-center justify-center shadow-md transition-transform duration-75"
        style={{ transform: `translateX(${thumbLeft}%)` }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
        >
          <path d="M13 17l5-5-5-5" />
          <path d="M6 17l5-5-5-5" />
        </svg>
      </div>
    </div>
  );
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
  const [onlineDrivers, setOnlineDrivers] = useState<number | null>(null);
  const [onlineDriversError, setOnlineDriversError] = useState(false);

  useEffect(() => {
    const fetchOnlineDrivers = () => {
      fetch("/api/v1/odofy/drivers/online")
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: { count: number }) => {
          setOnlineDrivers(data.count);
          setOnlineDriversError(false);
        })
        .catch(() => {
          setOnlineDriversError(true);
        });
    };
    fetchOnlineDrivers();
    const interval = setInterval(fetchOnlineDrivers, 30_000);
    return () => clearInterval(interval);
  }, []);
  const [offerEndTime, setOfferEndTime] = useState<string | null>(
    () => (typeof window !== "undefined" ? sessionStorage.getItem("odofy_offer_end_time") : null) || null
  );
  const [isTimeDrawerOpen, setIsTimeDrawerOpen] = useState(false);
  const [isOdofyNowActive, setIsOdofyNowActive] = useState(
    () => (typeof window !== "undefined" ? sessionStorage.getItem("odofy_now_active") : null) === "true"
  );
  const [showAlertBanner, setShowAlertBanner] = useState(false);
  const [showAcceptanceModal, setShowAcceptanceModal] = useState(false);
  const targetedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── NEW STATE: Delivery flow ──
  const [activeDeliveryStep, setActiveDeliveryStep] = useState<
    "IDLE" | "LOADING" | "EN_ROUTE" | "MINIMIZED"
  >("IDLE");
  const [claimedTrip, setClaimedTrip] = useState<AvailableTrip | null>(null);
  const [showSeparationModal, setShowSeparationModal] = useState(false);
  const [isTooEarlyModalOpen, setIsTooEarlyModalOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [pickupItems, setPickupItems] = useState<PickupItem[]>([]);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [totalStops] = useState(2);

  // ── FEEDBACK STATE ──
  const [showFeedbackView, setShowFeedbackView] = useState(false);
  const [showThumbsDown, setShowThumbsDown] = useState(false);
  const [selectedPills, setSelectedPills] = useState<string[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const presetReasons = ['Long Store Wait', 'Hard to Find Door', 'Poor Merchant Packaging', 'Wrong Access Code', 'App/GPS Issue'];

  // ── Persist scheduling state across route navigations ──
  useEffect(() => {
    if (isOdofyNowActive && offerEndTime) {
      sessionStorage.setItem("odofy_now_active", "true");
      sessionStorage.setItem("odofy_offer_end_time", offerEndTime);
    } else if (!isOdofyNowActive) {
      sessionStorage.removeItem("odofy_now_active");
      sessionStorage.removeItem("odofy_offer_end_time");
    }
  }, [isOdofyNowActive, offerEndTime]);

  // ── Geolocation ──
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
    const markers = visibleTrips.map((trip) => ({
      lat: Number(trip.dest_latitude),
      lng: Number(trip.dest_longitude),
      label: "📍",
      color: MAROON,
    }));
    if (claimedTrip && activeDeliveryStep === "EN_ROUTE") {
      markers.push({
        lat: Number(claimedTrip.dest_latitude),
        lng: Number(claimedTrip.dest_longitude),
        label: "🎯",
        color: "#0A192F",
      });
    }
    return markers;
  }, [visibleTrips, claimedTrip, activeDeliveryStep]);

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
    if (!showAlertBanner) return;
    const t = setTimeout(() => setShowAlertBanner(false), 4000);
    return () => clearTimeout(t);
  }, [showAlertBanner]);

  useEffect(() => {
    if (trips.length > 0 && isOdofyNowActive) {
      setShowAlertBanner(true);
    }
  }, [trips, isOdofyNowActive]);

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
      if ((onlineDrivers ?? 3) <= 3) {
        setTrips((prev) => [...prev, targetedTrip!]);
      }
      setTargetedTrip(null);
    }
  }, [targetedTimer, targetedTrip, onlineDrivers]);

  useEffect(() => {
    if (!isOdofyNowActive || !offerEndTime) return;

    const checkInterval = setInterval(() => {
      const now = new Date();
      const [targetH, targetM] = offerEndTime.split(":").map(Number);
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
    sessionStorage.removeItem("odofy_now_active");
    sessionStorage.removeItem("odofy_offer_end_time");
    setToken(null);
    setProfile(null);
    setTrips([]);
    setLoading(true);
  };

  const handleReject = (tripId: string) => {
    setRemovedIds((prev) => new Set(prev).add(tripId));
  };

  // ── Accept a trip from the trip deck ──
  const handleApprove = async (tripId: string) => {
    setApproveError(null);
    setApprovingIds((prev) => new Set(prev).add(tripId));
    try {
      const foundTrip = trips.find((t) => t.uuid === tripId);
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
      if (foundTrip) {
        setClaimedTrip(foundTrip);
        setPickupItems(SAMPLE_PICKUP_ITEMS);
      }
      setShowAcceptanceModal(true);
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

  // ── Accept targeted offer ──
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
      if (targetedTrip) {
        setClaimedTrip({ ...targetedTrip });
        setPickupItems(SAMPLE_PICKUP_ITEMS);
      }
      setShowAcceptanceModal(true);
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
    if ((onlineDrivers ?? 3) > 3) {
      setTargetedTrip(null);
    } else {
      setTrips((prev) => [...prev, trip]);
      setTargetedTrip(null);
    }
  };

  // ── GOT IT — transition to claimed state ──
  const handleGotIt = () => {
    setShowAcceptanceModal(false);
    setActiveDeliveryStep("IDLE");
  };

  // ── Slide to start trip complete ──
  const handleSlideToStartComplete = () => {
    if (currentLocation && claimedTrip) {
      const now = new Date();
      const distMiles = haversineDistance(
        currentLocation.lat,
        currentLocation.lng,
        Number(claimedTrip.dest_latitude),
        Number(claimedTrip.dest_longitude)
      );
      const travelTimeMins = distMiles * 3; // ~3 min/mile
      const estimatedArrival = new Date(now.getTime() + travelTimeMins * 60000);
      const targetPickup = claimedTrip?.scheduled_pickup_time
        ? new Date(claimedTrip.scheduled_pickup_time)
        : null;

      const minutesEarly = targetPickup
        ? (targetPickup.getTime() - estimatedArrival.getTime()) / 60000
        : 0;

      if (targetPickup && minutesEarly > 10) {
        setIsTooEarlyModalOpen(true);
        return;
      }
    }
    setActiveDeliveryStep("LOADING");
  };

  // ── Slide to confirm pickup complete ──
  const handleSlideConfirmPickupComplete = () => {
    setShowSeparationModal(true);
  };

  // ── Slide to confirm separation complete ──
  const handleSlideSeparationComplete = () => {
    setShowSeparationModal(false);
    setActiveDeliveryStep("EN_ROUTE");
    setCheckedItems(new Set());
  };

  // ── Slide to confirm arrival complete ──
  const handleSlideArrivalComplete = () => {
    // Check geofence
    if (currentLocation && claimedTrip) {
      const dist = haversineDistance(
        currentLocation.lat,
        currentLocation.lng,
        Number(claimedTrip.dest_latitude),
        Number(claimedTrip.dest_longitude)
      );
      const distFeet = dist * 5280;
      if (distFeet > 150) {
        alert(
          `You are ${Math.round(distFeet)}ft away. Please get within 150ft of the delivery address.`
        );
        return;
      }
    }
    // Complete delivery — show feedback
    setActiveDeliveryStep("IDLE");
    setShowFeedbackView(true);
  };

  // ── Navigate to customer ──
  const handleNavigate = () => {
    if (!claimedTrip) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${claimedTrip.dest_latitude},${claimedTrip.dest_longitude}&dir_action=navigate`;
    window.open(url, "_blank");
  };

  // ── Submit thumbs-down feedback ──
  const handleSubmitFeedback = async () => {
    setFeedbackSubmitting(true);
    try {
      await fetch("/api/v1/odofy/drivers/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reasons: selectedPills,
          details: feedbackText,
          trip_id: claimedTrip?.uuid || null,
        }),
      });
    } catch {
      // fire-and-forget — proceed regardless
    } finally {
      setFeedbackSubmitting(false);
      // Reset all feedback and delivery state
      setShowFeedbackView(false);
      setShowThumbsDown(false);
      setSelectedPills([]);
      setFeedbackText('');
      setClaimedTrip(null);
      setPickupItems([]);
      setCurrentStopIndex(0);
    }
  };

  // ── LOGIN SCREEN ──
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

  // ── EN_ROUTE ACTIVE STOP SCREEN ──
  if (activeDeliveryStep === "EN_ROUTE" && claimedTrip) {
    const customerLat = Number(claimedTrip.dest_latitude);
    const customerLng = Number(claimedTrip.dest_longitude);
    const etaMins = 8; // placeholder; would come from Directions API

    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#0A192F] flex flex-col font-sans relative overflow-hidden">
        {/* ── Navy header bar ── */}
        <div className="w-full bg-[#0A192F] px-4 py-3 flex items-center justify-between z-30 border-b border-white/10">
          <button
            onClick={() => {
              setActiveDeliveryStep("MINIMIZED");
            }}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-white font-bold text-sm">
              Stop #{currentStopIndex + 1} for Order #{(claimedTrip.uuid || "000").slice(0, 6)}
            </p>
            <p className="text-white/50 text-[10px] tracking-wide uppercase">
              Active delivery
            </p>
          </div>
          <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
        </div>

        {/* ── Satellite map area (25vh) ── */}
        <div className="w-full h-[25vh] relative bg-gray-700">
          <DriverMap
            markers={[
              {
                lat: customerLat,
                lng: customerLng,
                label: "📍",
                color: MAROON,
              },
            ]}
            currentLocation={currentLocation}
          />
          {/* Pin overlay */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-20 pointer-events-none">
            <div className="w-8 h-8 bg-[#5E0009] rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="white"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Delivery info panel ── */}
        <div className="flex-1 bg-white rounded-t-[28px] -mt-4 px-4 pt-6 pb-4 overflow-y-auto flex flex-col gap-4 z-20">
          {/* ETA row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-extrabold text-gray-900">
                {etaMins} min
              </p>
              <p className="text-xs font-medium text-gray-500">ETA</p>
            </div>
            <div className="bg-[#0A192F] text-white text-xs font-bold px-3 py-1.5 rounded-full">
              {currentLocation && claimedTrip
                ? `${(haversineDistance(currentLocation.lat, currentLocation.lng, customerLat, customerLng) * 5280).toFixed(0)} ft away`
                : "Calculating..."}
            </div>
          </div>

          {/* Customer info */}
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {claimedTrip.customer_name || "Customer"}
            </h3>
            <p className="text-sm font-medium text-gray-500 mt-0.5">
              {claimedTrip.delivery_address ||
                SPRINGFIELD_DROPOFFS[0]}
            </p>
          </div>

          {/* Cargo pills */}
          <div className="flex flex-wrap gap-2">
            <span className="bg-[#E6F4EA] text-[#137333] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              Multi-trip incentive
            </span>
            <span className="bg-[#E8F0FE] text-[#185ABC] px-3 py-1 rounded-full text-xs font-bold">
              Batch bonus +$3.00
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <a
              href={`tel:${claimedTrip.customer_phone || ""}`}
              className="flex-1 py-3.5 bg-[#0A192F] text-white font-bold text-sm rounded-full text-center shadow-md hover:bg-[#152A4A] transition-colors"
            >
              📞 CONTACT
            </a>
            <button
              onClick={handleNavigate}
              className="flex-1 py-3.5 bg-[#5E0009] text-white font-bold text-sm rounded-full text-center shadow-md shadow-[#5E0009]/10 hover:bg-[#4A0007] transition-colors"
            >
              🗺️ NAVIGATE
            </button>
          </div>

          {/* Slide to confirm arrival */}
          <div className="mt-2">
            <SlideTrack
              label="SLIDE TO CONFIRM ARRIVAL"
              onSlideComplete={handleSlideArrivalComplete}
            />
            <p className="text-[10px] font-medium text-gray-400 text-center mt-2">
              Must be within 150ft of delivery address
            </p>
          </div>
        </div>

        <DriverFooter />
      </div>
    );
  }

  // ── NORMAL DASHBOARD ──
  return (
    <>
      {showAlertBanner && (
        <div
          onClick={() => {
            document
              .querySelector("[data-trip-deck]")
              ?.scrollIntoView({ behavior: "smooth" });
            setShowAlertBanner(false);
          }}
          className="absolute top-4 left-4 right-4 bg-[#2C3E2B]/95 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex items-center justify-between text-white shadow-xl z-50 animate-slide-down cursor-pointer"
        >
          <div className="flex items-center">
            <img
              src="/brand_mark.png"
              alt="Odofy"
              className="w-6 h-6 rounded-md object-contain bg-white/10 p-0.5 mr-3"
            />
            <div>
              <p className="text-xs font-bold text-gray-200 tracking-wide">
                Odofy Driver
              </p>
              <p className="text-sm font-semibold text-white mt-0.5">
                You have offers to preview.
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-gray-400 self-start pt-0.5">
            now
          </span>
        </div>
      )}

      {/* ── ACCEPTANCE MODAL ── */}
      {showAcceptanceModal && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center transition-all">
          <div className="w-full bg-white rounded-t-[28px] px-6 pt-6 pb-8 flex flex-col gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.15)] animate-slide-up max-w-md mx-auto">
            <div className="w-10 h-10 border-2 border-[#1A1C1E] rounded-full flex items-center justify-center font-serif text-xl font-black text-[#1A1C1E]">
              i
            </div>
            <h2 className="text-2xl font-bold text-[#1A1C1E] leading-tight mt-2">
              You accepted an Offer
            </h2>
            <p className="text-sm font-medium text-gray-600 leading-relaxed mt-1">
              Try getting to the store right away to start your Delivery.
            </p>
            <button
              onClick={handleGotIt}
              className="w-full py-4 bg-[#5E0009] text-white font-bold text-sm rounded-full text-center shadow-md shadow-[#5E0009]/10 hover:bg-[#4A0007] transition-all uppercase tracking-wider mt-4 cursor-pointer"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}

      {/* ── EARLY ARRIVAL MODAL ── */}
      {isTooEarlyModalOpen && (() => {
        const now = new Date();
        const distMiles = currentLocation && claimedTrip
          ? haversineDistance(
              currentLocation.lat,
              currentLocation.lng,
              Number(claimedTrip.dest_latitude),
              Number(claimedTrip.dest_longitude)
            )
          : 0;
        const travelTimeMins = distMiles * 3;
        const estimatedArrival = new Date(now.getTime() + travelTimeMins * 60000);
        const targetPickup = claimedTrip?.scheduled_pickup_time
          ? new Date(claimedTrip.scheduled_pickup_time)
          : null;

        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex flex-col justify-end animate-fade-in">
            <div className="bg-white rounded-t-3xl p-6 w-full max-w-md mx-auto flex flex-col items-start gap-4 pb-8 border-t border-gray-100 shadow-2xl animate-slide-up">
              <div className="w-12 h-12 rounded-full bg-[#E8F0FE] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A192F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[#0A192F] tracking-tight mt-2">
                It's a little early
              </h2>
              <div className="w-full space-y-3 mt-1">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-800">Pickup time</span>
                  <span className="text-base font-bold text-gray-900">
                    {formatPickupTime(targetPickup)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-800">Current ETA</span>
                  <span className="text-base font-bold text-gray-900">
                    {formatPickupTime(estimatedArrival)}
                  </span>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-500 leading-relaxed mt-2">
                This business isn't expecting you until the pickup time. You can start the trip when your ETA is closer to {formatPickupTime(targetPickup)}.
              </p>
              <button
                onClick={() => setIsTooEarlyModalOpen(false)}
                className="w-full py-4 bg-[#0A192F] text-white font-bold text-sm rounded-full text-center shadow-md uppercase tracking-wider mt-4 cursor-pointer hover:bg-[#1E2D4A] transition-colors"
              >
                GOT IT
              </button>
            </div>
          </div>
        );
      })()}

      <div className="max-w-md mx-auto min-h-screen bg-[#F8F9FA] flex flex-col font-sans relative overflow-hidden pb-20">
        {/* ── TOP 40% — FULL-BLEED GEOCATCH MAP ── */}
        <div className="w-full h-[40vh] relative z-10">
          <DriverMap markers={mapMarkers} currentLocation={currentLocation} />

          {locationError && (
            <div className="absolute bottom-4 left-4 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium px-2 py-1 rounded-full z-20">
              {locationError}
            </div>
          )}

          {/* Upper Left — Online driver count */}
          <div className="absolute top-4 left-4 z-20">
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md border border-gray-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-gray-700">
                {onlineDrivers === null
                  ? "—"
                  : `${onlineDrivers} driver${onlineDrivers !== 1 ? "s" : ""} online`}
              </span>
            </div>
          </div>

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
        <div className="w-full h-[60vh] bg-white rounded-t-[28px] px-4 pt-5 z-20 overflow-y-auto [webkit-overflow-scrolling:touch] -mt-6 relative flex flex-col">
          {/* Get Offers Until anchor */}
          {isOdofyNowActive && (
            <div
              onClick={() => setIsTimeDrawerOpen(true)}
              className="absolute top-4 right-4 bg-gray-50 border border-gray-100 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm hover:bg-gray-100 transition-colors z-30 cursor-pointer"
            >
              <span className="text-xs font-semibold text-gray-700">
                Get offers until{" "}
                {offerEndTime ? formatTimeDisplay(offerEndTime) : "--:--"}
              </span>
            </div>
          )}

          {/* Drag handle — sticky */}
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 block sticky top-0 bg-white pb-2 z-30" />

          {/* ── LOADING STATE: Pickup Checklist ── */}
          {activeDeliveryStep === "LOADING" ? (
            <div className="flex-1 flex flex-col -mx-4">
              {/* Sticky header */}
              <div className="w-full bg-white border-b border-gray-100 py-3 px-4 flex items-center justify-between sticky top-0 z-30">
                <span className="text-sm font-semibold text-gray-700">
                  {pickupItems.length} items (
                  {pickupItems.reduce((sum, i) => sum + (i.quantity || 1), 0)}{" "}
                  qty)
                </span>
                <span className="text-xs text-gray-400">
                  {checkedItems.size}/{pickupItems.length} checked
                </span>
              </div>

              {/* Scrollable item list */}
              <div className="flex-1 overflow-y-auto">
                {pickupItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="w-full bg-white border-b border-gray-100 p-4 flex gap-4 items-start"
                  >
                    <img
                      src={item.image_url || "/assets/placeholder-package.svg"}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/assets/placeholder-package.svg";
                      }}
                      alt={item.title || item.name || "Package"}
                      className="w-16 h-16 rounded-xl bg-gray-50 flex-shrink-0 object-contain p-1 border border-gray-100/50 shadow-sm"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 leading-snug">
                        {item.title || item.name}
                      </p>
                      <p className="text-base font-bold text-gray-900 mt-1.5">
                        Qty: {item.quantity || 1}
                      </p>
                    </div>
                    <div
                      onClick={() => {
                        const next = new Set(checkedItems);
                        next.has(String(idx))
                          ? next.delete(String(idx))
                          : next.add(String(idx));
                        setCheckedItems(next);
                      }}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors flex-shrink-0 ${
                        checkedItems.has(String(idx))
                          ? "bg-[#5E0009] border-[#5E0009]"
                          : "border-gray-200"
                      }`}
                    >
                      {checkedItems.has(String(idx)) && (
                        <span className="text-white text-xs">✓</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Slide to confirm pickup */}
              <div className="px-4 pb-4 pt-2">
                <SlideTrack
                  label="SLIDE TO CONFIRM PICKUP & SORT"
                  onSlideComplete={handleSlideConfirmPickupComplete}
                  disabled={checkedItems.size < pickupItems.length}
                />
                {checkedItems.size < pickupItems.length && (
                  <p className="text-[10px] font-medium text-gray-400 text-center mt-2">
                    Check all {pickupItems.length} items to enable
                  </p>
                )}
              </div>
            </div>
          ) : claimedTrip && activeDeliveryStep === "IDLE" ? (
            /* ── CLAIMED STATE: Slide to Start Trip ── */
            <>
              <div className="w-full bg-white rounded-2xl p-4 mb-4 border border-[#E6F4EA]">
                <p className="text-sm font-semibold text-[#137333] mb-3">
                  ✓ Offer accepted — ready to start
                </p>
                <SlideTrack
                  label="SLIDE TO START TRIP"
                  onSlideComplete={handleSlideToStartComplete}
                />
              </div>
              <p className="text-xs font-medium text-gray-400 text-center">
                Swipe right on the track above to begin your delivery
              </p>
            </>
          ) : (
            <>
              {activeDeliveryStep !== "MINIMIZED" && (
                <>
              {/* ── "JUST FOR YOU" TARGETED OFFER ── */}
              {targetedTrip &&
                (() => {
                  const basePayout =
                    parseFloat(targetedTrip.driver_payout) || 6.5;
                  const tip =
                    parseFloat(targetedTrip.driver_tip_allocation) || 0;
                  const total = basePayout + tip;
                  const idx = 0;
                  const pickup = SPRINGFIELD_PICKUPS[0];
                  const dropoff = SPRINGFIELD_DROPOFFS[0];
                  const isApproving = approvingIds.has(targetedTrip.uuid);
                  const strokeDash = (targetedTimer / 60) * 62.83;

                  return (
                    <div className="w-full bg-[#E8F0FE] rounded-2xl mb-4 overflow-hidden border border-[#D2E3FC] shadow-sm">
                      <div className="w-full bg-[#E8F0FE] px-4 py-2.5 flex items-center justify-between border-b border-[#D2E3FC]">
                        <span className="text-sm font-semibold text-[#185ABC]">
                          Just for you
                        </span>
                        <div className="flex items-center gap-2">
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            className="shrink-0"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                              fill="none"
                              stroke="#D2E3FC"
                              strokeWidth="2"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
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
                            {Math.floor(targetedTimer / 60)}:
                            {String(targetedTimer % 60).padStart(2, "0")}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 flex flex-col gap-2.5">
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
                        <p className="text-sm font-semibold text-gray-600 tracking-tight">
                          2 stops • 4.3 miles • 25 mins
                        </p>
                        <span className="bg-[#E6F4EA] text-[#137333] px-2.5 py-0.5 rounded-md text-xs font-bold w-fit uppercase tracking-wider">
                          Multi-trip incentive
                        </span>
                        <p className="text-sm font-semibold text-gray-800 mt-1">
                          🏪 ASAP • Boutique Retail Pickup • Odofy Axis
                        </p>
                        <p className="text-xs font-medium text-gray-500 mt-1 whitespace-pre-line leading-relaxed">
                          📍 Pickup: {pickup}
                          {"\n"}🎯 Dropoff: {dropoff}
                        </p>
                        <div className="flex items-center gap-3 mt-2 w-full">
                          <button
                            onClick={handleTargetedReject}
                            className="flex-1 py-3 bg-[#EEF0F2] text-[#1A1C1E] font-bold text-sm rounded-full text-center shadow-sm hover:bg-[#E1E3E5] transition-colors"
                          >
                            REJECT
                          </button>
                          <button
                            onClick={() =>
                              handleTargetedAccept(targetedTrip.uuid)
                            }
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

              {/* STATE OFFLINE: ODOFY NOW button */}
              {!loading && !isOdofyNowActive && (
                <>
                  <button
                    onClick={() => setIsTimeDrawerOpen(true)}
                    className="w-full py-4 bg-[#5E0009] text-white font-bold text-lg rounded-full shadow-lg shadow-[#5E0009]/20 tracking-wide transition-all active:scale-[0.98] mb-6"
                  >
                    ODOFY NOW
                  </button>
                </>
              )}

              {/* STATE ACTIVE: Trip cards or empty mailbox */}
              {!loading && isOdofyNowActive && (
                <>
                  {visibleTrips.length === 0 && !targetedTrip && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <span className="text-5xl mb-4">📭</span>
                      <p className="text-lg font-semibold text-gray-700">
                        No trip offers right now
                      </p>
                      <p className="text-sm font-medium text-gray-400 mt-1">
                        New offers will appear here when available
                      </p>
                    </div>
                  )}
                  {visibleTrips.length > 0 && (
                    <div data-trip-deck>
                      {visibleTrips.map((trip, idx) => {
                        const basePayout =
                          parseFloat(trip.driver_payout) || 6.5;
                        const tip =
                          parseFloat(trip.driver_tip_allocation) || 0;
                        const total = basePayout + tip;
                        const pickup =
                          SPRINGFIELD_PICKUPS[
                            idx % SPRINGFIELD_PICKUPS.length
                          ];
                        const dropoff =
                          SPRINGFIELD_DROPOFFS[
                            idx % SPRINGFIELD_DROPOFFS.length
                          ];
                        const isApproving = approvingIds.has(trip.uuid);

                        return (
                          <div
                            key={trip.uuid}
                            className="w-full bg-white border border-gray-200/80 rounded-2xl p-4 mb-4 shadow-sm relative hover:border-gray-300 transition-all flex flex-col gap-2.5 snap-start"
                          >
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
                            <p className="text-sm font-semibold text-gray-600 tracking-tight">
                              2 stops • 4.3 miles • 25 mins
                            </p>
                            <span className="bg-[#E6F4EA] text-[#137333] px-2.5 py-0.5 rounded-md text-xs font-bold w-fit uppercase tracking-wider">
                              Multi-trip incentive
                            </span>
                            <p className="text-sm font-semibold text-gray-800 mt-1">
                              🏪 ASAP • Boutique Retail Pickup • Odofy Axis
                            </p>
                            <p className="text-xs font-medium text-gray-500 mt-1 whitespace-pre-line leading-relaxed">
                              📍 Pickup: {pickup}
                              {"\n"}🎯 Dropoff: {dropoff}
                            </p>
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
                  )}
                </>
              )}
                </>
              )}
            </>
          )}

          {/* ── MINIMIZED STATE: Compact tracking card ── */}
          {activeDeliveryStep === "MINIMIZED" && claimedTrip && (
            <div className="flex-1 flex flex-col px-2">
              {/* Payout headline */}
              <p className="text-3xl font-bold text-gray-900">
                ${Number(claimedTrip.driver_payout || 0).toFixed(2)}
              </p>
              {/* Sub-metrics */}
              <p className="text-sm font-medium text-emerald-600 mt-1">
                • $2.69 estimated tip &nbsp;
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold cursor-help" title="Tip is estimated and may change">i</span>
              </p>
              <p className="text-sm font-medium text-emerald-600 mt-0.5">
                • Eligible for multi-trip incentive
              </p>
              {/* Trip parameters */}
              <p className="text-sm font-semibold text-gray-600 mt-2">
                {totalStops} stops • 10.1 miles • 29 mins
              </p>
              {/* Destination context */}
              <p className="text-sm font-bold text-gray-800 mt-2">
                🏪 ASAP • Delivery • Odofy Axis
              </p>
              {/* Stop counter */}
              <p className="text-xs font-semibold text-gray-500 mt-2">
                👤 1 drop-off
              </p>
              {/* RESUME TRIP button */}
              <button
                onClick={() => setActiveDeliveryStep("EN_ROUTE")}
                className="w-full py-4 bg-[#2A66FF] text-white font-bold text-sm rounded-full text-center shadow-md uppercase tracking-wider mt-4 cursor-pointer hover:bg-[#1E4ED2] transition-colors"
              >
                RESUME TRIP
              </button>
            </div>
          )}
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

      {/* ── VEHICLE SEPARATION MODAL ── */}
      {showSeparationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center border-2 border-[#5E0009] shadow-xl flex flex-col items-center gap-4 animate-slide-up">
            <span className="text-4xl">⚠️</span>
            <h2 className="text-xl font-bold text-gray-900">
              Separate Batch Orders
            </h2>
            <p className="text-sm font-medium text-gray-600 leading-relaxed">
              To prevent delivering mixed items at the doorstep, please separate
              each unique batch order within your vehicle right now. (Example:
              Place Order A in your Trunk and Order B in your Backseat).
            </p>
            <div className="w-full">
              <SlideTrack
                label="SLIDE TO CONFIRM SEPARATION"
                onSlideComplete={handleSlideSeparationComplete}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── TIME SELECTION DRAWER ── */}
      {isTimeDrawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 transition-opacity"
            onClick={() => setIsTimeDrawerOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[28px] z-50 px-6 pt-6 pb-8 animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.15)]">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#5E0009" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Odofy Now</h2>
                <p className="text-sm font-medium text-gray-500 mt-0.5">
                  With Odofy Now turned on, you will receive offers until:
                </p>
              </div>
            </div>

            <div className="mb-6 overflow-y-auto rounded-2xl border border-gray-100"
              style={{ height: "280px", WebkitOverflowScrolling: "touch" }}>
              {generateTimeSlots().map((slot) => {
                const isSelected = offerEndTime === slot.value;
                return (
                  <div
                    key={slot.value}
                    onClick={() => setOfferEndTime(slot.value)}
                    className="flex items-center justify-center py-4 cursor-pointer transition-colors mx-2 rounded-xl"
                    style={{
                      backgroundColor: isSelected ? "#FDF2F4" : "transparent",
                    }}
                  >
                    <span
                      className="text-lg font-bold transition-all"
                      style={{
                        color: isSelected ? "#5E0009" : "#6B7280",
                      }}
                    >
                      {slot.label}
                    </span>
                  </div>
                );
              })}
            </div>

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
              style={{ backgroundColor: "#5E0009", color: "white" }}
            >
              TURN ON
            </button>
          </div>
        </>
      )}
      {/* ── FEEDBACK MODAL ── */}
      {showFeedbackView && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          {!showThumbsDown ? (
            /* ── STEP 1: Thumbs-up / Thumbs-down ── */
            <div className="bg-[#0A192F] rounded-[28px] p-6 max-w-sm w-full text-center shadow-xl flex flex-col items-center gap-5 animate-slide-up">
              <p className="text-white text-lg font-bold mt-2">
                How was your delivery?
              </p>
              <div className="flex gap-8 mt-2">
                <button
                  onClick={() => {
                    // Thumbs up — skip feedback, reset to dashboard
                    setShowFeedbackView(false);
                    setClaimedTrip(null);
                    setPickupItems([]);
                    setCurrentStopIndex(0);
                  }}
                  className="w-20 h-20 rounded-full bg-[#0D3B0D]/60 border-2 border-[#2ECC71]/30 flex items-center justify-center hover:bg-[#0D3B0D]/80 hover:border-[#2ECC71]/60 transition-all active:scale-95"
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2ECC71" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 22V11M2 13v7a2 2 0 002 2h4.5l3.84 2.88a1 1 0 00.6.18H17a2 2 0 002-2l2-9a2 2 0 00-2-2h-5.72a2 2 0 01-1.72-1l-1.6-4.8A1.5 1.5 0 0010.5 5h-1A1.5 1.5 0 008 6.5v6.5H4a2 2 0 00-2 2z"/>
                  </svg>
                </button>
                <button
                  onClick={() => setShowThumbsDown(true)}
                  className="w-20 h-20 rounded-full bg-[#5E0009]/40 border-2 border-[#5E0009]/60 flex items-center justify-center hover:bg-[#5E0009]/60 hover:border-[#5E0009] transition-all active:scale-95"
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" transform="rotate(180)">
                    <path d="M7 22V11M2 13v7a2 2 0 002 2h4.5l3.84 2.88a1 1 0 00.6.18H17a2 2 0 002-2l2-9a2 2 0 00-2-2h-5.72a2 2 0 01-1.72-1l-1.6-4.8A1.5 1.5 0 0010.5 5h-1A1.5 1.5 0 008 6.5v6.5H4a2 2 0 00-2 2z"/>
                  </svg>
                </button>
              </div>
              <button
                onClick={() => {
                  setShowFeedbackView(false);
                  setClaimedTrip(null);
                  setPickupItems([]);
                  setCurrentStopIndex(0);
                }}
                className="text-white/40 text-xs font-medium mt-2 hover:text-white/70 transition-colors"
              >
                Skip
              </button>
            </div>
          ) : (
            /* ── STEP 2: Thumbs-down detail view ── */
            <div className="bg-[#0A192F] rounded-[28px] p-6 max-w-sm w-full shadow-xl flex flex-col gap-5 animate-slide-up">
              <div className="text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto" transform="rotate(180)">
                  <path d="M7 22V11M2 13v7a2 2 0 002 2h4.5l3.84 2.88a1 1 0 00.6.18H17a2 2 0 002-2l2-9a2 2 0 00-2-2h-5.72a2 2 0 01-1.72-1l-1.6-4.8A1.5 1.5 0 0010.5 5h-1A1.5 1.5 0 008 6.5v6.5H4a2 2 0 00-2 2z"/>
                </svg>
                <h2 className="text-white text-lg font-bold mt-3">
                  What went wrong?
                </h2>
                <p className="text-white/50 text-xs font-medium mt-1">
                  Help us improve your experience
                </p>
              </div>

              {/* Preset reason pills */}
              <div className="flex flex-wrap gap-2 mb-4 w-full justify-center">
                {presetReasons.map((reason) => {
                  const isActive = selectedPills.includes(reason);
                  return (
                    <button
                      key={reason}
                      onClick={() => {
                        setSelectedPills((prev) =>
                          prev.includes(reason)
                            ? prev.filter((r) => r !== reason)
                            : [...prev, reason]
                        );
                      }}
                      className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer transition-all hover:bg-white/10 select-none ${
                        isActive
                          ? "bg-[#5E0009] border-[#5E0009] text-white shadow-sm scale-[0.98]"
                          : "bg-white/5 border-white/30 text-white/80"
                      }`}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>

              {/* Optional text area */}
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Optional: Tell us more details..."
                className="w-full min-h-[100px] bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white font-medium resize-none"
              />

              {/* Submit button */}
              <button
                onClick={handleSubmitFeedback}
                disabled={feedbackSubmitting}
                className="w-full py-3.5 bg-[#5E0009] text-white font-bold text-sm rounded-full text-center shadow-md shadow-[#5E0009]/10 hover:bg-[#4A0007] transition-all disabled:opacity-60 uppercase tracking-wider"
              >
                {feedbackSubmitting ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Submitting…
                  </span>
                ) : (
                  "SUBMIT"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
