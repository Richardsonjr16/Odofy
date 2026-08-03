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

function ProfileMenuPage() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("odofy_driver_token");
    if (!token) {
      const cached = sessionStorage.getItem("odofy_driver_profile");
      if (cached) {
        try {
          setProfile(JSON.parse(cached));
        } catch {}
      }
      setProfileLoading(false);
      return;
    }
    setHasToken(true);
    fetch("/api/v1/odofy/drivers/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: DriverProfile) => {
        console.log("Profile API response:", data);
        setProfile(data);
        sessionStorage.setItem("odofy_driver_profile", JSON.stringify(data));
      })
      .catch((err) => {
        console.error("Profile fetch failed:", err);
        // Fall back to the last cached profile so the UI never shows stale
        // "Not Set" placeholders when the API is unreachable.
        const cached = sessionStorage.getItem("odofy_driver_profile");
        if (cached) {
          try {
            setProfile(JSON.parse(cached));
          } catch {}
        } else {
          setProfileError(true);
        }
      })
      .finally(() => setProfileLoading(false));
  }, []);

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
            {profile?.vehicle_make_model || "N/A"}
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

      {/* Account Reconciliation Summary */}
      <div className="mx-4 mt-6 space-y-3">
        {/* Verification Badge */}
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

        {/* Zone */}
        <p className="text-center text-sm font-medium" style={{ color: "#333333" }}>
          Zone: Springfield, MO Core Grid
        </p>

        {/* Loading indicator */}
        {profileLoading && (
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            <span className="text-sm text-gray-500">Loading profile…</span>
          </div>
        )}
        {profileError && (
          <p className="mt-2 text-center text-sm text-red-600">
            Unable to load the latest profile details.
          </p>
        )}
      </div>

      {/* Signed-out prompt */}
      {!hasToken && !profile && !profileLoading && (
        <div className="mx-4 mt-6 rounded-xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm text-gray-600">
            You must sign in first.{" "}
            <a
              href="/dashboard"
              className="font-semibold text-blue-600 hover:underline"
            >
              Go to Dashboard →
            </a>
          </p>
        </div>
      )}

      {/* Compliance Document Menu */}
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
