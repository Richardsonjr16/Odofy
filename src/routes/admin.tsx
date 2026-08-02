import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";

const ADMIN_KEY_STORAGE = "odofy_admin_key";
const API_BASE = "/api/v1/odofy/admin";

interface Driver {
  uuid: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  status: string;
  license_photo_url: string | null;
  insurance_proof_url: string | null;
  profile_photo_url: string | null;
  vehicle_make_model: string | null;
  created_at: string | null;
}

interface Trip {
  uuid: string;
  merchant_id: string;
  driver_id: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  dest_latitude: number;
  dest_longitude: number;
  status: string;
  merchant_fee: number;
  driver_payout: number;
  platform_profit: number;
  driver_tip_allocation: number;
  created_at: string;
  merchant_name: string | null;
  first_name: string | null;
  last_name: string | null;
  vehicle_make_model: string | null;
}

interface Merchant {
  uuid: string;
  business_name: string;
  storefront_address: string;
  latitude: number;
  longitude: number;
  api_secret_key: string;
  shop_domain: string | null;
  free_trial_runs_remaining: number | null;
}

interface Analytics {
  totalCompletedTrips: number;
  driverRevenuePool: number;
  platformNetProfit: number;
  stackedDeliveries: number;
  platformMargin: number;
}

type Tab = "drivers" | "deliveries" | "merchants" | "analytics";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
    }
    return "";
  });
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("drivers");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const router = useRouter();
  const routeId = router.state.matches
    .map((m) => m.routeId)
    .find((id) => id.startsWith("/admin/") && id !== "/admin");
  if (routeId) {
    return <Outlet />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed || validating) return;

    setValidating(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/drivers/pending`, {
        headers: { "x-api-key": trimmed },
      });

      if (response.status !== 200) {
        setError("Invalid API key. Please try again.");
        return;
      }

      sessionStorage.setItem(ADMIN_KEY_STORAGE, trimmed);
      setApiKey(trimmed);
      setKeyInput("");
    } catch {
      setError("Invalid API key. Please try again.");
    } finally {
      setValidating(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    setApiKey("");
    setError(null);
    setFeedback(null);
    setActiveTab("drivers");
  };

  const clearFeedback = () => setFeedback(null);

  if (!apiKey) {
    return (
      <div className="min-h-dvh bg-white text-charcoal flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-msu-maroon">
              Odofy Admin
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Enter your admin API key to continue.
            </p>
          </div>
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
              <p className="text-sm font-semibold">{error}</p>
            </div>
          )}
          <form
            onSubmit={handleLogin}
            className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <label
              htmlFor="admin-key"
              className="block text-sm font-semibold text-gray-700"
            >
              Admin API Key
            </label>
            <div className="relative">
              <input
                id="admin-key"
                type={showKey ? "text" : "password"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Enter your key…"
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/30 outline-none transition"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer z-30 transition-colors p-1"
                aria-label={showKey ? "Hide password" : "Show password"}
              >
                {showKey ? (
                  /* eye-slash icon */
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  /* eye icon */
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <button
              type="submit"
              disabled={!keyInput.trim() || validating}
              className="w-full rounded-lg bg-msu-maroon px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-msu-maroon/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? "Verifying…" : "Unlock Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white text-charcoal">
      <header className="bg-msu-maroon px-6 py-4 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-white">
            Odofy Admin
          </h1>
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="text-sm text-white/70 hover:text-white transition"
            >
              Home
            </a>
            <button
              onClick={handleLogout}
              className="text-sm text-white/70 hover:text-white transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 lg:px-12 overflow-x-auto">
        <div className="mx-auto max-w-6xl flex gap-1 py-2 min-w-max">
          {(
            [
              ["drivers", "Drivers"],
              ["deliveries", "Live Deliveries"],
              ["merchants", "Merchant Ledger"],
              ["analytics", "Financial Analytics"],
            ] as [Tab, string][]
          ).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                clearFeedback();
              }}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition whitespace-nowrap ${
                activeTab === tab
                  ? "bg-msu-maroon text-white"
                  : "border border-msu-maroon text-msu-maroon bg-transparent hover:bg-msu-maroon/5"
              }`}
            >
              {label}
            </button>
          ))}
          <a
            href="/admin/drivers"
            className="px-4 py-2 text-sm font-semibold rounded-lg transition whitespace-nowrap border border-msu-maroon text-msu-maroon bg-transparent hover:bg-msu-maroon/5"
          >
            🚗 Manage Drivers
          </a>
          <a
            href="/admin/taxes"
            className="px-4 py-2 text-sm font-semibold rounded-lg transition whitespace-nowrap border border-msu-maroon text-msu-maroon bg-transparent hover:bg-msu-maroon/5"
          >
            📊 Tax Compliance
          </a>
        </div>
      </nav>

      <main className="px-6 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
              <p className="text-sm font-semibold">{error}</p>
            </div>
          )}
          {feedback && (
            <div
              className={`mb-6 rounded-xl border p-4 ${
                feedback.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <p className="text-sm font-semibold">{feedback.message}</p>
            </div>
          )}

          {activeTab === "drivers" && (
            <DriversTab
              apiKey={apiKey}
              setError={setError}
              setFeedback={setFeedback}
              onAuthFail={() => {
                sessionStorage.removeItem(ADMIN_KEY_STORAGE);
                setApiKey("");
              }}
            />
          )}
          {activeTab === "deliveries" && (
            <DeliveriesTab
              apiKey={apiKey}
              setError={setError}
              onAuthFail={() => {
                sessionStorage.removeItem(ADMIN_KEY_STORAGE);
                setApiKey("");
              }}
            />
          )}
          {activeTab === "merchants" && (
            <MerchantsTab
              apiKey={apiKey}
              setError={setError}
              onAuthFail={() => {
                sessionStorage.removeItem(ADMIN_KEY_STORAGE);
                setApiKey("");
              }}
            />
          )}
          {activeTab === "analytics" && (
            <AnalyticsTab
              apiKey={apiKey}
              setError={setError}
              onAuthFail={() => {
                sessionStorage.removeItem(ADMIN_KEY_STORAGE);
                setApiKey("");
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function DriversTab({
  apiKey,
  setError,
  setFeedback,
  onAuthFail,
}: {
  apiKey: string;
  setError: (e: string | null) => void;
  setFeedback: (f: { type: "success" | "error"; message: string } | null) => void;
  onAuthFail: () => void;
}) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/drivers/pending`, {
        headers: { "x-api-key": apiKey },
      });
      if (res.status === 401) {
        onAuthFail();
        setError("Invalid API key. Please log in again.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data: Driver[] = await res.json();
      setDrivers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch drivers");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleAction = async (driverId: string, action: "approve" | "reject") => {
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/drivers/${driverId}/${action}`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      });
      if (res.status === 401) {
        onAuthFail();
        setError("Invalid API key. Please log in again.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Action failed (${res.status})`);
      }
      setDrivers((prev) => prev.filter((d) => d.uuid !== driverId));
      setFeedback({
        type: "success",
        message: `Driver ${action === "approve" ? "approved" : "rejected"} successfully.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Action failed",
      });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-msu-maroon">
          Pending Driver Reviews
        </h2>
        <span className="inline-flex items-center rounded-full bg-msu-maroon/10 px-4 py-1.5 text-sm font-semibold text-msu-maroon">
          {drivers.length} driver{drivers.length !== 1 ? "s" : ""} pending review
        </span>
      </div>

      {loading && (
        <p className="text-center text-gray-400 py-12">
          Loading pending drivers…
        </p>
      )}

      {!loading && drivers.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
          <p className="text-gray-400 font-medium">No drivers pending review.</p>
          <p className="mt-1 text-sm text-gray-400">
            When drivers register, they&apos;ll appear here.
          </p>
        </div>
      )}

      {!loading && drivers.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {drivers.map((driver) => (
            <DriverCard
              key={driver.uuid}
              driver={driver}
              onApprove={() => handleAction(driver.uuid, "approve")}
              onReject={() => handleAction(driver.uuid, "reject")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DriverCard({
  driver,
  onApprove,
  onReject,
}: {
  driver: Driver;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);

  const handleApprove = async () => {
    setActing("approve");
    await onApprove();
    setActing(null);
  };

  const handleReject = async () => {
    setActing("reject");
    await onReject();
    setActing(null);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-msu-maroon">
            {driver.first_name} {driver.last_name}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{driver.phone_number}</p>
        </div>
      </div>

      {driver.vehicle_make_model && (
        <p className="text-sm text-gray-600 mb-4">
          <span className="font-semibold text-gray-700">Vehicle:</span>{" "}
          {driver.vehicle_make_model}
        </p>
      )}

      <div className="space-y-2 mb-6">
        {driver.license_photo_url && (
          <a
            href={driver.license_photo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-600 hover:text-blue-800 underline truncate"
          >
            📄 License Photo
          </a>
        )}
        {driver.insurance_proof_url && (
          <a
            href={driver.insurance_proof_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-600 hover:text-blue-800 underline truncate"
          >
            🛡️ Insurance Proof
          </a>
        )}
        {driver.profile_photo_url && (
          <a
            href={driver.profile_photo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-600 hover:text-blue-800 underline truncate"
          >
            📷 Profile Photo
          </a>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={acting !== null}
          className="flex-1 rounded-lg bg-msu-maroon px-4 py-2 text-sm font-semibold text-white transition hover:bg-msu-maroon/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {acting === "approve" ? "…" : "✅ Approve"}
        </button>
        <button
          onClick={handleReject}
          disabled={acting !== null}
          className="flex-1 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {acting === "reject" ? "…" : "❌ Reject"}
        </button>
      </div>
    </div>
  );
}

function DeliveriesTab({
  apiKey,
  setError,
  onAuthFail,
}: {
  apiKey: string;
  setError: (e: string | null) => void;
  onAuthFail: () => void;
}) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/trips/live`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => {
        if (res.status === 401) {
          onAuthFail();
          throw new Error("Invalid API key");
        }
        if (!res.ok) return res.json().then((d) => { throw new Error(d.error || `Request failed (${res.status})`); });
        return res.json();
      })
      .then((data: Trip[]) => {
        if (!cancelled) setTrips(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [apiKey]);

  const statusColor = (status: string) => {
    switch (status) {
      case "PENDING_PICKUP": return "bg-yellow-100 text-yellow-800";
      case "EN_ROUTE": return "bg-blue-100 text-blue-800";
      case "DELIVERED": return "bg-green-100 text-green-800";
      case "CANCELLED":
      case "REJECTED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-msu-maroon mb-8">
        Live Deliveries
      </h2>

      {loading && (
        <p className="text-center text-gray-400 py-12">Loading trips…</p>
      )}

      {!loading && trips.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
          <p className="text-gray-400 font-medium">No trips found.</p>
        </div>
      )}

      {!loading && trips.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Merchant</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer Address</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Driver</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Tip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {trips.map((trip) => (
                <tr key={trip.uuid} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{trip.merchant_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate" title={trip.delivery_address}>
                    {trip.delivery_address}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {trip.first_name
                      ? `${trip.first_name} ${trip.last_name}`
                      : "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(trip.status)}`}>
                      {trip.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    ${Number(trip.driver_tip_allocation || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MerchantsTab({
  apiKey,
  setError,
  onAuthFail,
}: {
  apiKey: string;
  setError: (e: string | null) => void;
  onAuthFail: () => void;
}) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/merchants`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => {
        if (res.status === 401) {
          onAuthFail();
          throw new Error("Invalid API key");
        }
        if (!res.ok) return res.json().then((d) => { throw new Error(d.error || `Request failed (${res.status})`); });
        return res.json();
      })
      .then((data: Merchant[]) => {
        if (!cancelled) setMerchants(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [apiKey]);

  const copyKey = async (uuid: string, key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedId(uuid);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback silently
    }
  };

  const trialDisplay = (remaining: number | null) => {
    const r = remaining ?? 5;
    return `${r}/5 remaining`;
  };

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-msu-maroon mb-8">
        Merchant Ledger
      </h2>

      {loading && (
        <p className="text-center text-gray-400 py-12">Loading merchants…</p>
      )}

      {!loading && merchants.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
          <p className="text-gray-400 font-medium">No merchants registered.</p>
        </div>
      )}

      {!loading && merchants.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Business Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Store Address</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Trial Runs</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">API Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {merchants.map((m) => (
                <tr key={m.uuid} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-msu-maroon">{m.business_name}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate" title={m.storefront_address}>
                    {m.storefront_address}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {trialDisplay(m.free_trial_runs_remaining)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 max-w-[180px] truncate">
                        {m.api_secret_key}
                      </code>
                      <button
                        onClick={() => copyKey(m.uuid, m.api_secret_key)}
                        className="text-xs font-medium text-msu-maroon hover:text-msu-maroon/70 whitespace-nowrap"
                      >
                        {copiedId === m.uuid ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnalyticsTab({
  apiKey,
  setError,
  onAuthFail,
}: {
  apiKey: string;
  setError: (e: string | null) => void;
  onAuthFail: () => void;
}) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/analytics`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => {
        if (res.status === 401) {
          onAuthFail();
          throw new Error("Invalid API key");
        }
        if (!res.ok) return res.json().then((d) => { throw new Error(d.error || `Request failed (${res.status})`); });
        return res.json();
      })
      .then((data: Analytics) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [apiKey]);

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-msu-maroon mb-8">
        Financial Analytics
      </h2>

      {loading && (
        <p className="text-center text-gray-400 py-12">Loading analytics…</p>
      )}

      {!loading && !analytics && (
        <div className="text-center py-16 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
          <p className="text-gray-400 font-medium">No data available.</p>
        </div>
      )}

      {!loading && analytics && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Total Completed Deliveries
            </p>
            <p className="mt-3 text-4xl font-bold text-msu-maroon">
              {analytics.totalCompletedTrips.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Driver Revenue Pool
            </p>
            <p className="mt-3 text-4xl font-bold text-msu-maroon">
              ${analytics.driverRevenuePool.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-gray-400">Payouts + tips</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Net Platform Profit
            </p>
            <p className="mt-3 text-4xl font-bold text-msu-maroon">
              ${analytics.platformNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-gray-400">Merchant fees − driver payouts</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Stacked Deliveries
            </p>
            <p className="mt-3 text-4xl font-bold text-msu-maroon">
              {analytics.stackedDeliveries.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-gray-400">2-drop batch deliveries</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Platform Margin
            </p>
            <p className="mt-3 text-4xl font-bold text-msu-maroon">
              ${analytics.platformMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-gray-400">Avg profit per delivery</p>
          </div>
        </div>
      )}
    </div>
  );
}
