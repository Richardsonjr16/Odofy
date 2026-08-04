import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import DriverFooter from "../components/DriverFooter";

interface DriverProfile {
  first_name: string;
  last_name: string;
  profile_photo_url: string | null;
  license_photo_url: string | null;
  insurance_proof_url: string | null;
  email: string | null;
  status: string;
  vehicle_make_model: string | null;
  is_verified: boolean;
  insurance_expiration: string | null;
  license_number: string | null;
  vehicle_color: string | null;
  license_plate: string | null;
}

export const Route = createFileRoute("/profile-menu")({
  component: ProfileMenuPage,
});

function maskLicense(license: string | null): string {
  if (!license) return "N/A";
  return license.substring(0, 6) + "XXXXX";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem("odofy_driver_token");
}

function ProfileMenuPage() {
  const [profile, setProfile] = useState<DriverProfile | null>(() => {
    // SSR-safe initial state: try sessionStorage cache
    if (typeof sessionStorage === "undefined") return null;
    try {
      const raw = sessionStorage.getItem("odofy_driver_profile");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!profile);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      setFetchError("No session token. Please sign in on the Dashboard first.");
      return;
    }

    let cancelled = false;

    async function fetchProfile() {
      try {
        const res = await fetch("/api/v1/odofy/drivers/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const data: DriverProfile = await res.json();
        if (!cancelled) {
          setProfile(data);
          setFetchError(null);
          // Refresh the cache
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem("odofy_driver_profile", JSON.stringify(data));
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setFetchError(
            profile
              ? "Could not refresh. Showing cached data."
              : err?.message || "Unable to load profile. Check your connection and try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProfile();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const firstName = profile?.first_name || "DRIVER";
  const isVerified = profile?.is_verified === true;

  const handleSignOut = () => {
    sessionStorage.removeItem("odofy_driver_token");
    sessionStorage.removeItem("odofy_driver_profile");
    window.location.href = "/";
  };

  const toggleRow = (row: string) => {
    setExpandedRow((prev) => (prev === row ? null : row));
  };

  const rows = [
    {
      key: "license",
      label: "Driver's License & Insurance",
      content: (
        <div className="space-y-2">
          <p>
            <span className="font-medium">License Record:</span>{" "}
            {maskLicense(profile?.license_number ?? null)}
          </p>
          <p>
            <span className="font-medium">Insurance Expiration:</span>{" "}
            {formatDate(profile?.insurance_expiration ?? null)}
          </p>
        </div>
      ),
    },
    {
      key: "vehicle",
      label: "Vehicle Profile",
      content: (
        <div className="space-y-2">
          <p>
            <span className="font-medium">Make/Model:</span>{" "}
            {profile?.vehicle_make_model || "Not Set"}
          </p>
          <p>
            <span className="font-medium">Color:</span>{" "}
            {profile?.vehicle_color || "Not Set"}
          </p>
          <p>
            <span className="font-medium">License Plate:</span>{" "}
            {profile?.license_plate || "Not Set"}
          </p>
          <p>
            <span className="font-medium">Insurance Expiration:</span>{" "}
            {profile?.insurance_expiration || "Not Set"}
          </p>
          <p className="text-gray-500 italic">
            Used to verify fleet identity at boutique pickup lanes
          </p>
        </div>
      ),
    },
    {
      key: "terms",
      label: "Fleet Terms & Conditions",
      content: (
        <p className="leading-relaxed">
          Odofy Fleet Operations Agreement: All couriers operating on the Odofy
          platform must adhere to the strict 100% Smoke-Free and Vape-Free
          vehicle cabin mandate. This zero-tolerance policy applies to all
          active delivery windows. A single confirmed violation will result in
          immediate and permanent account deactivation. By operating on the
          Odofy network, you acknowledge and consent to these fleet terms.
        </p>
      ),
    },
    {
      key: "support",
      label: "Get Support",
      content: (
        <p>
          Need immediate assistance with a live trip or route error? Text or
          call our automated dispatch priority desk directly at:{" "}
          <a
            href="tel:+14173742061"
            className="text-blue-600 font-medium hover:underline"
          >
            (417) 374-2061
          </a>
        </p>
      ),
    },
  ];

  return (
    <div className="min-h-dvh bg-gray-50 pb-20">
      {/* Header Card */}
      <div className="bg-msu-maroon px-6 pt-12 pb-8 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/20 overflow-hidden">
          {profile?.profile_photo_url ? (
            <img
              src={profile.profile_photo_url}
              alt="Profile"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-4xl text-white/60">👤</span>
          )}
        </div>
        <h1 className="mt-4 text-2xl font-extrabold uppercase tracking-wider text-white">
          {firstName}
        </h1>
        {profile?.email && (
          <p className="mt-1 text-sm text-white/70">{profile.email}</p>
        )}
        <p className="mt-1 text-xs text-white/50 uppercase tracking-wide">
          {profile?.status || "Active Driver"}
        </p>
      </div>

      {/* Loading / Error / No-Token States */}
      <div className="mx-4 mt-6 space-y-3">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
            <span className="animate-spin">⏳</span>
            Loading profile…
          </div>
        )}

        {!loading && !profile && fetchError && getToken() && (
          <div className="rounded-xl bg-red-50 p-4 text-center text-sm text-red-700">
            {fetchError}
          </div>
        )}

        {!loading && !getToken() && (
          <div className="rounded-xl bg-white p-5 text-center shadow-sm">
            <p className="text-sm text-gray-600">
              Sign in on the Dashboard first.{" "}
              <a
                href="/dashboard"
                className="font-semibold text-blue-600 hover:underline"
              >
                Go to Dashboard →
              </a>
            </p>
          </div>
        )}

        {/* Verification Badge */}
        {profile && (
          <div className="flex items-center justify-center">
            {isVerified ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold"
                style={{ backgroundColor: "#059669", color: "#fff" }}
              >
                ✅ ACTIVE &amp; VERIFIED COURIER
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold"
                style={{ backgroundColor: "#d97706", color: "#fff" }}
              >
                ⏳ PENDING COMPLIANCE REVIEW
              </span>
            )}
          </div>
        )}

        {/* Zone */}
        <p className="text-center text-sm font-medium" style={{ color: "#333333" }}>
          Zone: Springfield, MO Core Grid
        </p>

        {/* Cached-data warning */}
        {!loading && profile && fetchError && (
          <p className="text-center text-xs text-amber-600">{fetchError}</p>
        )}
      </div>

      {/* Compliance Document Menu */}
      {profile && (
        <div className="mx-4 mt-6 rounded-xl bg-white shadow-sm overflow-hidden">
          {rows.map((row, i) => {
            const isExpanded = expandedRow === row.key;
            return (
              <div
                key={row.key}
                className={
                  i < rows.length - 1 ? "border-b border-gray-100" : ""
                }
              >
                <button
                  onClick={() => toggleRow(row.key)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold hover:bg-gray-50 transition"
                  style={{ color: "#333333" }}
                >
                  <span>{row.label}</span>
                  <span className="text-gray-400 text-sm">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                </button>
                {isExpanded && (
                  <div className="bg-gray-50 px-4 py-3 text-sm rounded mx-4 mb-3">
                    {row.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sign Out */}
      <div className="mx-4 mt-6">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl bg-white px-5 py-4 shadow-sm hover:shadow-md transition text-left"
        >
          <span className="text-xl">🚪</span>
          <span className="font-semibold text-red-600">Sign Out</span>
        </button>
      </div>

      <DriverFooter />
    </div>
  );
}
