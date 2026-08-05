import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import DriverMap from "../components/DriverMap";

// ── COLLEGIATE MARKET THEME DIRECTORY ──
const marketThemeDirectory: Record<string, { primary: string; secondary: string }> = {
  springfield: { primary: "#5E0009", secondary: "#FFFFFF" }, // Missouri State
  columbia:    { primary: "#000000", secondary: "#FDB719" }, // Mizzou
  columbus:    { primary: "#ba0c2f", secondary: "#a7b1b7" }, // Ohio State
};

function darkenColor(hex: string, factor: number = 0.18): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (c: number) => Math.round(c * factor).toString(16).padStart(2, "0");
  return `#${d(r)}${d(g)}${d(b)}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface DriverProfile {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  status?: string;
  driver_tier?: string;
  is_verified?: boolean;
  profile_photo_url?: string | null;
  marketHub?: string;
  needs_periodic_identity_check?: boolean;
  last_identity_check_at?: string | null;
  is_first_login?: boolean;
  session_valid?: boolean;
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
  order_number?: string;
  total_stops?: number;
  cross_stack_bonus?: number;
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
  trackColor = "#5E0009",
  thumbColor = "#0A192F",
}: {
  label: string;
  onSlideComplete: () => void;
  disabled?: boolean;
  trackColor?: string;
  thumbColor?: string;
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
      className="w-full text-white font-bold text-sm rounded-full py-4 relative flex items-center justify-center select-none overflow-hidden cursor-pointer touch-none"
      style={{ backgroundColor: trackColor }}
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
        className="w-12 h-12 rounded-full absolute left-1 flex items-center justify-center shadow-md transition-transform duration-75"
        style={{ backgroundColor: thumbColor, transform: `translateX(${thumbLeft}%)` }}
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

function GeofenceMiniMap({ destLat, destLng }: { destLat: number; destLng: number }) {
  const miniRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [miniReady, setMiniReady] = useState(false);

  // Wait for Google Maps API to be loaded
  useEffect(() => {
    if (window.google?.maps) {
      setMiniReady(true);
      return;
    }
    const check = setInterval(() => {
      if (window.google?.maps) {
        setMiniReady(true);
        clearInterval(check);
      }
    }, 200);
    return () => clearInterval(check);
  }, []);

  useEffect(() => {
    if (!miniReady || !miniRef.current || mapRef.current) return;

    mapRef.current = new window.google.maps.Map(miniRef.current, {
      center: { lat: destLat, lng: destLng },
      zoom: 18,
      disableDefaultUI: true,
      gestureHandling: "none",
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [{ featureType: "poi.business", stylers: [{ visibility: "off" }] }],
    });

    // Destination pin
    new window.google.maps.Marker({
      position: { lat: destLat, lng: destLng },
      map: mapRef.current,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: "#5E0009",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 8,
      },
    });

    // 150-foot radius circle (150 ft = 45.72 meters)
    circleRef.current = new window.google.maps.Circle({
      map: mapRef.current,
      center: { lat: destLat, lng: destLng },
      radius: 45.72, // 150 feet in meters
      fillColor: "#22c55e",
      fillOpacity: 0.15,
      strokeColor: "#22c55e",
      strokeWeight: 2,
      strokeOpacity: 0.7,
    });
  }, [miniReady, destLat, destLng]);

  return (
    <div ref={miniRef} className="w-full h-full" />
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
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [identitySubmitting, setIdentitySubmitting] = useState(false);
  const [identitySuccess, setIdentitySuccess] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identityFiles, setIdentityFiles] = useState<Record<string, File | null>>({ front: null, left: null, right: null });

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
  const [currentTab, setCurrentTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "trips") return "trips";
    }
    return "home";
  });
  const [showAlertBanner, setShowAlertBanner] = useState(false);
  const [showAcceptanceModal, setShowAcceptanceModal] = useState(false);
  const targetedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [currentPostedLimit, setCurrentPostedLimit] = useState<number | null>(null);

  // ── Speed limit resolution via OpenStreetMap Overpass API ──
  useEffect(() => {
    if (!currentLocation) return;

    let cancelled = false;
    const { lat, lng } = currentLocation;

    // Query OSM Overpass API for maxspeed tag on the nearest highway segment
    const query = `[out:json];way(around:40,${lat},${lng})["highway"]["maxspeed"];out tags 1;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data: { elements?: Array<{ tags?: { maxspeed?: string } }> }) => {
        if (cancelled) return;
        const elements = data.elements ?? [];
        if (elements.length === 0) {
          setCurrentPostedLimit(null);
          return;
        }
        // maxspeed can be a plain number ("25") or with unit ("25 mph")
        const raw = elements[0].tags?.maxspeed;
        if (!raw) {
          setCurrentPostedLimit(null);
          return;
        }
        const numeric = parseInt(raw, 10);
        setCurrentPostedLimit(Number.isFinite(numeric) ? numeric : null);
      })
      .catch(() => {
        if (!cancelled) setCurrentPostedLimit(null);
      });

    return () => { cancelled = true; };
  }, [currentLocation]);

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
  const [showArrivalError, setShowArrivalError] = useState(false);
  const [showGeofenceWarning, setShowGeofenceWarning] = useState(false);
  const [arrivalSlideKey, setArrivalSlideKey] = useState(0);
  // ── Derived from claimed/selected trip data ──
  const totalStops = useMemo(() => {
    if (claimedTrip?.total_stops) return claimedTrip.total_stops;
    if (targetedTrip?.total_stops) return targetedTrip.total_stops;
    return 2;
  }, [claimedTrip, targetedTrip]);

  const crossStackBonus = useMemo(() => {
    if (claimedTrip?.cross_stack_bonus) return claimedTrip.cross_stack_bonus;
    if (targetedTrip?.cross_stack_bonus) return targetedTrip.cross_stack_bonus;
    return 0;
  }, [claimedTrip, targetedTrip]);

  // ── RATING STATE ──
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingSafetyFlags, setRatingSafetyFlags] = useState<string[]>([]);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const ratingSafetyOptions = ['Loose Animal', 'Poor Lighting', 'Hostile Interaction'];

  // ── Collegiate theme ──
  const activeCityHub = (profile?.marketHub || "springfield").toLowerCase();
  const currentMarketColors = marketThemeDirectory[activeCityHub] || marketThemeDirectory["springfield"];
  const darkPrimary = darkenColor(currentMarketColors.primary);
  const primaryHover = darkenColor(currentMarketColors.primary, 0.78);
  const darkHover = darkenColor(darkPrimary, 2.5);

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
      color: currentMarketColors.primary,
    }));
    if (claimedTrip && activeDeliveryStep === "EN_ROUTE") {
      markers.push({
        lat: Number(claimedTrip.dest_latitude),
        lng: Number(claimedTrip.dest_longitude),
        label: "🎯",
        color: darkPrimary,
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
      .then(async (r) => {
        if (r.status === 401) {
          // Token no longer valid (e.g. admin rotated it): force logout.
          sessionStorage.clear();
          setToken(null);
          setProfile(null);
          return;
        }
        const p: DriverProfile = await r.json();
        if (p.session_valid === false) {
          // Session invalidated by administration: force logout.
          sessionStorage.clear();
          setToken(null);
          setProfile(null);
          return;
        }
        setProfile(p);
        sessionStorage.setItem("odofy_driver_profile", JSON.stringify(p));
        // One-time welcome walkthrough: show the onboarding modal on first
        // login only; the backend clears is_first_login permanently when the
        // driver taps "Got It, Let's Drive!".
        if (p.is_first_login === true) {
          setShowWelcome(true);
        }
        // Rolling 14-day periodic identity verification: the backend flags
        // needs_periodic_identity_check when the driver's last identity check
        // is stale, and clears it on a successful re-verification upload.
        const verificationExpired = p.needs_periodic_identity_check === true;
        if (verificationExpired) setIdentityModalOpen(true);
      })
      .catch(() => {
        sessionStorage.clear();
        setToken(null);
        setProfile(null);
      });

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
    if (totalStops > 2) {
      setShowSeparationModal(true);
    } else {
      setActiveDeliveryStep("EN_ROUTE");
      setCheckedItems(new Set());
    }
  };

  // ── Slide to confirm separation complete ──
  const handleSlideSeparationComplete = () => {
    setShowSeparationModal(false);
    setActiveDeliveryStep("EN_ROUTE");
    setCheckedItems(new Set());
  };

  // ── Slide to confirm arrival complete ──
  const handleSlideArrivalComplete = async () => {
    if (currentLocation && claimedTrip) {
      const dist = haversineDistance(
        currentLocation.lat,
        currentLocation.lng,
        Number(claimedTrip.dest_latitude),
        Number(claimedTrip.dest_longitude)
      );
      const distFeet = dist * 5280;
      if (distFeet > 150) {
        setShowGeofenceWarning(true);
        setArrivalSlideKey((prev) => prev + 1);
        return;
      }
    }
    if (!claimedTrip) return;
    try {
      const res = await fetch(`/api/v1/odofy/trips/${claimedTrip.uuid}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "DELIVERED" }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
    } catch (err) {
      setShowArrivalError(true);
      setArrivalSlideKey((prev) => prev + 1);
      console.error("Failed to mark trip DELIVERED:", err);
      return;
    }
    setActiveDeliveryStep("IDLE");
    setShowRatingModal(true);
  };

  // ── Navigate to customer ──
  const handleNavigate = () => {
    if (!claimedTrip) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${claimedTrip.dest_latitude},${claimedTrip.dest_longitude}&dir_action=navigate`;
    window.open(url, "_blank");
  };

  // ── Submit star rating ──
  const handleSubmitRating = async () => {
    if (!claimedTrip) return;
    if (ratingStars < 1) {
      setRatingError("Please select a star rating.");
      return;
    }
    setRatingSubmitting(true);
    setRatingError("");
    try {
      const res = await fetch("/api/v1/ratings/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: claimedTrip.uuid,
          receiver_id: claimedTrip.merchant_id,
          role_type: "DRIVER_TO_CUSTOMER",
          stars: ratingStars,
          safety_flags: ratingStars <= 3 ? ratingSafetyFlags : [],
          notes: "",
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("Rating submission failed:", err);
      setRatingError(
        err instanceof Error ? err.message : "Failed to submit rating."
      );
      setRatingSubmitting(false);
      return;
    }
    setRatingSubmitting(false);
    // Reset all rating and delivery state, driver goes back to IDLE
    setShowRatingModal(false);
    setRatingStars(0);
    setRatingSafetyFlags([]);
    setRatingError("");
    setClaimedTrip(null);
    setPickupItems([]);
    setCurrentStopIndex(0);
    setActiveDeliveryStep("IDLE");
  };

  // ── LOGIN SCREEN ──
  if (!token) {
    return (
      <div className="min-h-dvh bg-[#F8F9FA] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: currentMarketColors.primary }}
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
          <form onSubmit={handleLogin} className="space-y-4" style={{ "--odofy-p": currentMarketColors.primary } as React.CSSProperties}>
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
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--odofy-p)]/20 focus:border-[var(--odofy-p)] transition-shadow shadow-sm"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!tokenInput.trim()}
              className="w-full rounded-xl font-semibold text-white text-sm py-3.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              style={{ backgroundColor: currentMarketColors.primary, boxShadow: `0 4px 6px -1px ${hexToRgba(currentMarketColors.primary, 0.2)}` }}
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

  // ── PENDING APPROVAL GATE ──
  if (profile && profile.status === 'PENDING_MANUAL_APPROVAL') {
    return (
      <div className="min-h-dvh bg-gray-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Account Pending Approval
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-2">
            Your driver application is being reviewed by our team.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            You'll receive an email when approved.
          </p>
          <div className="inline-block bg-gray-100 rounded-full px-4 py-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider">
            Tier: {profile.driver_tier || 'PENDING'}
          </div>
          <div className="mt-6">
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── BOTTOM NAV (inline, replaces DriverFooter) ──
  const bottomNav = (
    <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-20 bg-white border-t border-gray-100 flex items-center justify-between px-4 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
      {/* Home tab */}
      <button onClick={() => setCurrentTab('home')} className="flex flex-col items-center justify-center flex-1 py-2 cursor-pointer transition-all z-40 select-none" style={{ color: currentTab === 'home' ? '#5E0009' : '#707478' }}>
        <span className="text-xl leading-none">🏠</span>
        <span className="text-[10px] font-semibold tracking-wide uppercase mt-0.5">Home</span>
      </button>

      {/* Trips tab — between Home and Earnings */}
      <button onClick={() => setCurrentTab('trips')} className="flex flex-col items-center justify-center flex-1 py-2 cursor-pointer transition-all z-40 select-none" style={{ color: currentTab === 'trips' ? '#5E0009' : '#707478' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <span className="text-[10px] font-semibold tracking-wide uppercase mt-0.5">Trips</span>
      </button>

      {/* Earnings tab */}
      <a href="/earnings-history" className="flex flex-col items-center justify-center flex-1 py-2 cursor-pointer transition-all z-40 select-none no-underline" style={{ color: '#707478' }}>
        <span className="text-xl leading-none">💰</span>
        <span className="text-[10px] font-semibold tracking-wide uppercase mt-0.5">Earnings</span>
      </a>

      {/* Notifications tab */}
      <a href="/notifications" className="flex flex-col items-center justify-center flex-1 py-2 cursor-pointer transition-all z-40 select-none no-underline" style={{ color: '#707478' }}>
        <span className="text-xl leading-none">🔔</span>
        <span className="text-[10px] font-semibold tracking-wide uppercase mt-0.5">Notifications</span>
      </a>

      {/* More tab */}
      <a href="/profile-menu" className="flex flex-col items-center justify-center flex-1 py-2 cursor-pointer transition-all z-40 select-none no-underline" style={{ color: '#707478' }}>
        <span className="text-xl leading-none">⋯</span>
        <span className="text-[10px] font-semibold tracking-wide uppercase mt-0.5">More</span>
      </a>
    </footer>
  );

  // ── EN_ROUTE ACTIVE STOP SCREEN ──
  if (activeDeliveryStep === "EN_ROUTE" && claimedTrip) {
    const customerLat = Number(claimedTrip.dest_latitude);
    const customerLng = Number(claimedTrip.dest_longitude);
    const tripDistance = currentLocation
      ? haversineDistance(currentLocation.lat, currentLocation.lng, customerLat, customerLng)
      : 4.3;
    const estimatedMins = Math.round(tripDistance * 3);
    const estimatedArrivalTime = (() => {
      const now = new Date();
      now.setMinutes(now.getMinutes() + estimatedMins);
      const h = now.getHours();
      const m = now.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    })();
    const orderNumber = claimedTrip.order_number || claimedTrip.uuid.slice(0, 6);
    const customerName = claimedTrip.customer_name || "Customer";
    const deliveryAddress = claimedTrip.delivery_address || SPRINGFIELD_DROPOFFS[0];

    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col font-sans relative overflow-hidden bg-white">
        {/* ── Header stripe ── */}
        <div className="w-full px-4 py-3 flex items-center justify-between z-30" style={{ backgroundColor: currentMarketColors.primary }}>
          <button
            onClick={() => {
              setActiveDeliveryStep("MINIMIZED");
            }}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors text-lg font-bold"
            aria-label="Minimize"
          >
            ✕
          </button>
          <div className="text-center">
            <p className="text-white font-bold text-sm">
              Stop #{currentStopIndex + 1} for Order {orderNumber}
            </p>
          </div>
          <div className="w-9 h-9" />
        </div>

        {/* ── Full-bleed map area ── */}
        <div className="w-full flex-1 relative bg-gray-200 min-h-0">
          <DriverMap
            markers={[
              {
                lat: customerLat,
                lng: customerLng,
                label: "📍",
                color: currentMarketColors.primary,
              },
            ]}
            currentLocation={currentLocation}
          />
          {/* Pin overlay */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-20 pointer-events-none">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white" style={{ backgroundColor: currentMarketColors.primary }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              </svg>
            </div>
          </div>

          {/* ── Speed Limit Sign ── */}
          <div className="absolute bottom-4 left-4 bg-white border border-gray-900/90 rounded-lg w-12 h-16 flex flex-col items-center justify-between py-2 shadow-sm z-40 select-none pointer-events-none transition-all">
            <span className="text-[8px] font-bold text-gray-500 tracking-wider uppercase leading-none">
              SPEED
            </span>
            <span className="text-[8px] font-bold text-gray-500 tracking-wider uppercase leading-none -mt-0.5">
              LIMIT
            </span>
            <span className="text-xl font-black text-gray-900 tracking-tight leading-none mb-0.5">
              {currentPostedLimit ? currentPostedLimit : '--'}
            </span>
          </div>
        </div>

        {/* ── Bottom info panel ── */}
        <div className="bg-white rounded-t-[28px] -mt-4 px-4 pt-6 pb-4 flex flex-col gap-4 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          {/* ETA row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-extrabold text-gray-900">
                ~{estimatedMins} min drop-off
              </p>
              <p className="text-xs font-medium text-gray-400">
                Estimated arrival {estimatedArrivalTime}
              </p>
            </div>
            <div className="text-white text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: currentMarketColors.primary }}>
              {currentLocation && claimedTrip
                ? `${(tripDistance * 5280).toFixed(0)} ft`
                : "..."}
            </div>
          </div>

          {/* Customer row */}
          <div className="flex flex-col">
            <p className="text-base font-bold text-gray-900">
              {customerName}
            </p>
            <p className="text-sm font-medium text-gray-500">
              {deliveryAddress}
            </p>
          </div>

          {/* Cargo pills */}
          {crossStackBonus > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="bg-[#E6F4EA] text-[#137333] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Multi-trip incentive: +${crossStackBonus.toFixed(2)} cross-stack bonus included
              </span>
            </div>
          )}

          {/* Circular action buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.open(`tel:${claimedTrip.customer_phone || ""}`, "_self")}
              className="w-16 h-16 rounded-full flex flex-col items-center justify-center text-white font-bold text-[10px] shadow-md transition-transform active:scale-95"
              style={{ backgroundColor: darkPrimary }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" className="mb-0.5">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
              </svg>
              CONTACT
            </button>
            <button
              onClick={handleNavigate}
              className="w-16 h-16 rounded-full flex flex-col items-center justify-center text-white font-bold text-[10px] shadow-md transition-transform active:scale-95"
              style={{ backgroundColor: currentMarketColors.primary }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              NAVIGATE
            </button>
          </div>

          {/* Slide to confirm arrival */}
          <div className="mt-1">
            <SlideTrack
              key={arrivalSlideKey}
              label="SLIDE TO CONFIRM ARRIVAL"
              onSlideComplete={handleSlideArrivalComplete}
              trackColor={currentMarketColors.primary}
              thumbColor={darkPrimary}
            />
            <p className="text-[10px] font-medium text-gray-400 text-center mt-2">
              Must be within 150ft of delivery address
            </p>
          </div>
        </div>

        {bottomNav}
      </div>
    );
  }

  const submitIdentityCheck = async () => {
    if (!profile?.uuid || !identityFiles.front || !identityFiles.left || !identityFiles.right) {
      setIdentityError("Please select all three photos before submitting.");
      return;
    }
    setIdentitySubmitting(true);
    setIdentityError(null);
    const formData = new FormData();
    formData.append("driver_id", profile.uuid);
    formData.append("front", identityFiles.front);
    formData.append("left", identityFiles.left);
    formData.append("right", identityFiles.right);
    try {
      const response = await fetch("/api/v1/odofy/drivers/verify-identity", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to submit identity check");
      setIdentitySuccess(true);
      setIdentityModalOpen(false);
      // Clear the periodic flag locally so the modal closes instantly and the
      // driver sees their map right away (no wait for a profile refetch).
      setProfile((current) => {
        if (!current) return current;
        const updated = { ...current, needs_periodic_identity_check: false };
        sessionStorage.setItem("odofy_driver_profile", JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : "Unable to submit identity check");
    } finally {
      setIdentitySubmitting(false);
    }
  };

  // ── NORMAL DASHBOARD ──
  return (
    <>
      {showWelcome && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-[#5E0009] text-center mb-4">🐻 Welcome to the Bear Fleet Crew!</h2>
            <div className="space-y-3 text-sm text-gray-700">
              <p>🗺️ 1. GO ONLINE: Tap 'Odofy Now' and select your shift duration from the dropdown menu to start driving.</p>
              <p>🥇 2. JUST FOR YOU: You get 60 secs to claim exclusive offers before they blast out to the general fleet.</p>
              <p>📦 3. ONE-TAP PICKUP: Match the bag ID tag at the store counter. No need to check individual grocery items.</p>
              <p>🛑 4. GEOCONTROLS: You must be inside a strict 150-ft radius of BOTH the store and the customer doorstep to tap check-in actions or submit photos.</p>
            </div>
            <div className="bg-[#5E0009]/5 text-[#5E0009] rounded-xl p-3 my-4 text-xs font-bold text-center">
              🚭 CRITICAL REQUIREMENT: All courier vehicles and cargo trunks must maintain a 100% smoke-free status at all times.
            </div>
            <button
              onClick={async () => {
                try {
                  await fetch("/api/v1/odofy/drivers/clear-first-login", {
                    method: "PUT",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                } catch (_) {}
                setShowWelcome(false);
              }}
              className="w-full bg-[#5E0009] text-white font-extrabold py-4 rounded-xl shadow-md transition-all active:scale-[0.99]"
            >
              Got It, Let's Drive!
            </button>
          </div>
        </div>
      )}
      {identityModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#5E0009] text-xl text-white">O</div>
              <h2 className="text-xl font-extrabold text-gray-900">Identity Check</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">Identity Check: Take a clear Front, Left, and Right view selfie to verify your driver profile.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[{ key: "front", label: "Front" }, { key: "left", label: "Left" }, { key: "right", label: "Right" }].map(({ key, label }) => (
                <label key={key} className="cursor-pointer text-center">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#5E0009]">{label}</span>
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#5E0009]/30 bg-gray-50">
                    {identityFiles[key] ? <img src={URL.createObjectURL(identityFiles[key]!)} alt={`${label} preview`} className="h-full w-full object-cover" /> : <span className="text-2xl text-[#5E0009]">＋</span>}
                  </div>
                  <input type="file" accept="image/*" capture="user" name={key} className="sr-only" onChange={(event) => setIdentityFiles((current) => ({ ...current, [key]: event.target.files?.[0] || null }))} />
                </label>
              ))}
            </div>
            {identityError && <p className="mt-4 text-center text-sm font-medium text-red-600">{identityError}</p>}
            <button type="button" onClick={submitIdentityCheck} disabled={identitySubmitting} className="mt-6 w-full rounded-xl bg-[#5E0009] py-3.5 text-sm font-bold text-white transition hover:bg-[#470007] disabled:opacity-50">{identitySubmitting ? "Submitting…" : "Submit Identity Check"}</button>
          </div>
        </div>
      )}
      {identitySuccess && <div className="fixed left-4 right-4 top-4 z-[70] rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-bold text-white shadow-lg">Identity check submitted successfully.</div>}
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
              className="w-full py-4 text-white font-bold text-sm rounded-full text-center shadow-md transition-all uppercase tracking-wider mt-4 cursor-pointer"
              style={{ backgroundColor: currentMarketColors.primary, boxShadow: `0 2px 4px ${hexToRgba(currentMarketColors.primary, 0.1)}` }}
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
        {currentTab === 'trips' ? (
          <div className="w-full h-full bg-gray-50 overflow-y-auto px-4 py-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Available Trips</h2>
            {trips.filter(t => !removedIds.has(t.uuid)).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-12">No trips available right now.</p>
            ) : (
              <div className="space-y-3">
                {trips.filter(t => !removedIds.has(t.uuid)).map((trip) => (
                  <div key={trip.uuid} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">{trip.customer_name || "Customer"}</p>
                        <p className="text-sm text-gray-500">{trip.delivery_address}</p>
                        {trip.order_number && <p className="text-xs text-gray-400">Order #{trip.order_number}</p>}
                      </div>
                      <span className="text-sm font-bold text-green-700">${trip.driver_payout}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
        {/* ── TOP 40% — FULL-BLEED GEOCATCH MAP ── */}
        <div className="w-full h-[40vh] relative z-10">
          <DriverMap ref={mapRef} markers={mapMarkers} currentLocation={currentLocation} />

          {locationError && (
            <div className="absolute bottom-4 left-4 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium px-2 py-1 rounded-full z-20">
              {locationError}
            </div>
          )}

          {/* ── Speed Limit Sign ── */}
          <div className="absolute bottom-4 left-4 bg-white border border-gray-900/90 rounded-lg w-12 h-16 flex flex-col items-center justify-between py-2 shadow-sm z-40 select-none pointer-events-none transition-all">
            <span className="text-[8px] font-bold text-gray-500 tracking-wider uppercase leading-none">
              SPEED
            </span>
            <span className="text-[8px] font-bold text-gray-500 tracking-wider uppercase leading-none -mt-0.5">
              LIMIT
            </span>
            <span className="text-xl font-black text-gray-900 tracking-tight leading-none mb-0.5">
              {currentPostedLimit ? currentPostedLimit : '--'}
            </span>
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
            <div className="flex-1 flex flex-col justify-center px-4">
              {/* Merchant Card Summary */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 my-4 text-center">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Merchant Pickup
                </p>
                <p className="text-2xl font-extrabold text-gray-900">
                  Order: {claimedTrip?.order_number || claimedTrip?.uuid?.slice(0, 6) || "—"}
                </p>
                <p className="text-lg font-bold text-gray-700 mt-1">
                  Customer: {claimedTrip?.customer_name || "Customer"}
                </p>
                <p className="text-[11px] font-medium text-gray-400 mt-3 leading-relaxed">
                  Ensure bag tag label matches the Order ID above before loading vehicle.
                </p>
              </div>

              {/* Confirm Button */}
              <button
                onClick={() => {
                  setActiveDeliveryStep("EN_ROUTE");
                  setCheckedItems(new Set());
                }}
                className="w-full bg-[#5E0009] text-white font-bold py-4 rounded-xl transition-all shadow-md active:scale-[0.98]"
              >
                Confirm Order Loaded &amp; Start Route
              </button>
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
                  trackColor={currentMarketColors.primary}
                  thumbColor={darkPrimary}
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
                          {targetedTrip?.total_stops || 2} stops • 4.3 miles • 25 mins
                        </p>
                        {targetedTrip?.cross_stack_bonus && targetedTrip.cross_stack_bonus > 0 ? (
                          <span className="bg-[#E6F4EA] text-[#137333] px-2.5 py-0.5 rounded-md text-xs font-bold w-fit uppercase tracking-wider">
                            Multi-trip incentive: +${targetedTrip.cross_stack_bonus.toFixed(2)} cross-stack bonus
                          </span>
                        ) : null}
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
                            className="flex-1 py-3 text-white font-bold text-sm rounded-full text-center shadow-md transition-colors disabled:opacity-60"
                            style={{ backgroundColor: currentMarketColors.primary, boxShadow: `0 2px 4px ${hexToRgba(currentMarketColors.primary, 0.1)}` }}
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
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-t-transparent" style={{ borderColor: currentMarketColors.primary }} />
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
                    className="w-full py-4 text-white font-bold text-lg rounded-full shadow-lg tracking-wide transition-all active:scale-[0.98] mb-6"
                    style={{ backgroundColor: currentMarketColors.primary, boxShadow: `0 4px 6px ${hexToRgba(currentMarketColors.primary, 0.2)}` }}
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
                              {trip.total_stops || 2} stops • 4.3 miles • 25 mins
                            </p>
                            {trip.cross_stack_bonus && trip.cross_stack_bonus > 0 ? (
                              <span className="bg-[#E6F4EA] text-[#137333] px-2.5 py-0.5 rounded-md text-xs font-bold w-fit uppercase tracking-wider">
                                Multi-trip incentive: +${trip.cross_stack_bonus.toFixed(2)} cross-stack bonus
                              </span>
                            ) : null}
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
                                className="flex-1 py-3 text-white font-bold text-sm rounded-full text-center shadow-md transition-colors disabled:opacity-60"
                                style={{ backgroundColor: currentMarketColors.primary, boxShadow: `0 2px 4px ${hexToRgba(currentMarketColors.primary, 0.1)}` }}
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
                👤 {totalStops} drop-off{totalStops !== 1 ? "s" : ""}
              </p>
              {/* RESUME TRIP button */}
              <button
                onClick={() => setActiveDeliveryStep("EN_ROUTE")}
                className="w-full py-4 text-white font-bold text-sm rounded-full text-center shadow-md uppercase tracking-wider mt-4 cursor-pointer transition-colors"
                style={{ backgroundColor: currentMarketColors.primary }}
              >
                RESUME TRIP
              </button>
            </div>
          )}
        </div>

        {/* ── CONDITIONAL EXPIRY ALERT BANNER ── */}
        {showExpiryAlert && (
          <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto w-full text-white text-xs font-medium px-4 py-3 leading-snug flex items-center border-t border-white/10 z-30 animate-slide-up" style={{ backgroundColor: darkPrimary }}>
            <span>
              Some offers are no longer available. They either expired, another
              driver accepted, or orders changed.
            </span>
          </div>
        )}
          </>
        )}
        {bottomNav}
      </div>

      {/* ── ARRIVAL ERROR MODAL ── */}
      {showGeofenceWarning && claimedTrip && (() => {
        const destLat = Number(claimedTrip.dest_latitude);
        const destLng = Number(claimedTrip.dest_longitude);
        const distFeet = currentLocation
          ? haversineDistance(currentLocation.lat, currentLocation.lng, destLat, destLng) * 5280
          : 999;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-t-[28px] sm:rounded-2xl w-full max-w-md mx-auto flex flex-col items-center gap-3 px-6 pt-8 pb-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
              {/* Warning Icon */}
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>

              {/* Headline */}
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight text-center">
                You may not be close enough to the stop
              </h2>

              {/* Mini Map */}
              <div className="w-full h-40 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 border border-gray-200 relative">
                <GeofenceMiniMap
                  destLat={destLat}
                  destLng={destLng}
                />
              </div>

              {/* Instructional Copy */}
              <p className="text-sm font-medium text-gray-600 text-center px-2 leading-relaxed">
                Once you're within the 150-foot radius circle, you can try confirming your arrival again.
              </p>

              {/* Open Location Settings */}
              <button
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(() => {}, () => {});
                  }
                  // Attempt to open device location settings
                  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
                  if (isIOS) {
                    window.open('App-Prefs:root=Privacy&path=LOCATION', '_blank');
                  } else {
                    window.open('app-settings:', '_blank');
                  }
                }}
                className="w-full py-3 border-2 border-gray-200 text-gray-700 font-bold text-sm rounded-full text-center uppercase tracking-wider hover:bg-gray-50 transition-colors cursor-pointer"
              >
                OPEN LOCATION SETTINGS
              </button>

              {/* GOT IT Button */}
              <button
                onClick={() => setShowGeofenceWarning(false)}
                className="w-full py-4 text-white font-bold text-sm rounded-full text-center shadow-md uppercase tracking-wider cursor-pointer"
                style={{ backgroundColor: currentMarketColors.primary }}
              >
                GOT IT
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── VEHICLE SEPARATION MODAL ── */}
      {showSeparationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-xl flex flex-col items-center gap-4 animate-slide-up" style={{ borderColor: currentMarketColors.primary, borderWidth: 2 }}>
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
                trackColor={currentMarketColors.primary}
                thumbColor={darkPrimary}
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
                style={{ backgroundColor: currentMarketColors.primary }}
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
                      backgroundColor: isSelected ? hexToRgba(currentMarketColors.primary, 0.08) : "transparent",
                    }}
                  >
                    <span
                      className="text-lg font-bold transition-all"
                      style={{
                        color: isSelected ? currentMarketColors.primary : "#6B7280",
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
              style={{ backgroundColor: currentMarketColors.primary, color: "white" }}
            >
              TURN ON
            </button>
          </div>
        </>
      )}
      {/* ── RATING MODAL ── */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="rounded-[28px] p-6 max-w-sm w-full text-center shadow-xl flex flex-col items-center gap-5 animate-slide-up" style={{ backgroundColor: darkPrimary }}>
            <p className="text-white text-lg font-bold mt-2">
              Rate Your Delivery Experience
            </p>
            <p className="text-white/50 text-xs font-medium">
              Tap a star to rate this delivery
            </p>
            {/* Star picker */}
            <div className="flex gap-2 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => {
                    setRatingStars(star);
                    setRatingSafetyFlags([]);
                    setRatingError("");
                  }}
                  className="text-4xl leading-none transition-transform hover:scale-110 active:scale-95 cursor-pointer select-none"
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                >
                  <span
                    style={{
                      color: star <= ratingStars ? "#FFC107" : "rgba(255,255,255,0.25)",
                      textShadow: star <= ratingStars ? "0 2px 8px rgba(255,193,7,0.4)" : "none",
                    }}
                  >
                    {star <= ratingStars ? "★" : "☆"}
                  </span>
                </button>
              ))}
            </div>
            {/* Safety flags shown only for low ratings */}
            {ratingStars > 0 && ratingStars <= 3 && (
              <div className="flex flex-wrap gap-2 mb-1 w-full justify-center">
                {ratingSafetyOptions.map((flag) => {
                  const isActive = ratingSafetyFlags.includes(flag);
                  return (
                    <button
                      key={flag}
                      onClick={() => {
                        setRatingSafetyFlags((prev) =>
                          prev.includes(flag)
                            ? prev.filter((f) => f !== flag)
                            : [...prev, flag]
                        );
                      }}
                      className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer transition-all hover:bg-white/10 select-none ${
                        isActive
                          ? "text-white shadow-sm scale-[0.98]"
                          : "bg-white/5 border-white/30 text-white/80"
                      }`}
                      style={isActive ? { backgroundColor: currentMarketColors.primary, borderColor: currentMarketColors.primary } : undefined}
                    >
                      {flag}
                    </button>
                  );
                })}
              </div>
            )}
            {ratingError && (
              <p className="text-red-300 text-xs font-medium">{ratingError}</p>
            )}
            {/* Submit button */}
            <button
              onClick={handleSubmitRating}
              disabled={ratingSubmitting || ratingStars < 1}
              className="w-full py-3.5 text-white font-bold text-sm rounded-full text-center shadow-md transition-all disabled:opacity-60 uppercase tracking-wider"
              style={{ backgroundColor: currentMarketColors.primary, boxShadow: `0 2px 4px ${hexToRgba(currentMarketColors.primary, 0.1)}` }}
            >
              {ratingSubmitting ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Submitting…
                </span>
              ) : (
                "Submit Rating & Go Online"
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
