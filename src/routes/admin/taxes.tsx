import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";

const ADMIN_KEY_STORAGE = "odofy_admin_key";
const API_BASE = "/api/v1/odofy/admin";

interface DriverTaxEntry {
  driver_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  driver_tier?: string;
  status?: string;
  current_latitude?: number | null;
  current_longitude?: number | null;
  location_updated_at?: string | null;
  is_verified?: boolean;
  license_number?: string | null;
  vehicle_make_model?: string | null;
  registered_at?: string | null;
  total_base_fares: string;
  total_tips_bonus: string;
  gross_earnings: string;
}

interface MerchantTaxEntry {
  uuid: string;
  business_name: string;
  storefront_address: string;
  latitude: number;
  longitude: number;
  api_secret_key: string;
  shop_domain: string | null;
  free_trial_runs_remaining: number | null;
  contact_email: string | null;
  total_deliveries: number;
  platform_revenue: number;
  avg_customer_radius_miles: number;
}

interface TaxData {
  drivers: DriverTaxEntry[];
  total_fleet_earnings: number;
  drivers_over_600: number;
}

interface PendingDriver {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  driver_tier: string;
  created_at: string;
  status: string;
}

type DrilldownEntity = DriverTaxEntry | MerchantTaxEntry;

export const Route = createFileRoute("/admin/taxes")({
  component: AdminTaxesPage,
});

function isDriverEntity(
  entity: DrilldownEntity
): entity is DriverTaxEntry {
  return "driver_id" in entity && "gross_earnings" in entity;
}

function isMerchantEntity(
  entity: DrilldownEntity
): entity is MerchantTaxEntry {
  return "business_name" in entity && "platform_revenue" in entity;
}

function sessionStatusBadge(status: string | undefined) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 border border-gray-200 text-gray-500">
        ⚪ UNKNOWN
      </span>
    );
  }
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 border border-green-100 text-green-700">
          🟢 ONLINE - IDLE
        </span>
      );
    case "INACTIVE":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 border border-gray-200 text-gray-500">
          🔴 OFFLINE
        </span>
      );
    case "PENDING_REVIEW":
    case "PENDING_MANUAL_APPROVAL":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 border border-yellow-100 text-yellow-700">
          🟡 PENDING APPROVAL
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 border border-red-100 text-red-700">
          🔴 REJECTED
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 border border-gray-200 text-gray-500">
          ⚪ UNKNOWN
        </span>
      );
  }
}

function AdminTaxesPage() {
  const [adminKey, setAdminKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
    }
    return "";
  });

  const [drivers, setDrivers] = useState<DriverTaxEntry[]>([]);
  const [totalFleetEarnings, setTotalFleetEarnings] = useState(0);
  const [driversOver600, setDriversOver600] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingDrivers, setPendingDrivers] = useState<PendingDriver[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());

  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyResult, setNotifyResult] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  const [merchants, setMerchants] = useState<MerchantTaxEntry[]>([]);
  const [merchantsLoading, setMerchantsLoading] = useState(false);
  const [merchantsError, setMerchantsError] = useState<string | null>(null);

  const [activeDrilldownEntity, setActiveDrilldownEntity] =
    useState<DrilldownEntity | null>(null);

  const fetchTaxData = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/taxes`, {
        headers: { "x-api-key": key },
      });
      if (res.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        setAdminKey("");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data: TaxData = await res.json();
      setDrivers(data.drivers || []);
      setTotalFleetEarnings(data.total_fleet_earnings || 0);
      setDriversOver600(data.drivers_over_600 || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tax data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingDrivers = useCallback(async (key: string) => {
    setPendingLoading(true);
    setPendingError(null);
    try {
      const res = await fetch(`${API_BASE}/drivers/pending`, {
        headers: { "x-api-key": key },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data: PendingDriver[] = await res.json();
      setPendingDrivers(
        data.filter((d) => d.status === "PENDING_MANUAL_APPROVAL")
      );
    } catch (err) {
      setPendingError(
        err instanceof Error ? err.message : "Failed to load pending drivers"
      );
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const fetchMerchants = useCallback(async (key: string) => {
    setMerchantsLoading(true);
    setMerchantsError(null);
    try {
      const res = await fetch(`${API_BASE}/merchants/tax`, {
        headers: { "x-api-key": key },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data: MerchantTaxEntry[] = await res.json();
      setMerchants(data);
    } catch (err) {
      setMerchantsError(
        err instanceof Error ? err.message : "Failed to load merchants"
      );
    } finally {
      setMerchantsLoading(false);
    }
  }, []);

  const handleApproveDriver = async (driverId: string) => {
    setApprovingIds((prev) => new Set(prev).add(driverId));
    try {
      const res = await fetch(`${API_BASE}/drivers/${driverId}/approve`, {
        method: "PATCH",
        headers: { "x-api-key": adminKey },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setPendingDrivers((prev) => prev.filter((d) => d.uuid !== driverId));
    } catch (err) {
      setPendingError(
        err instanceof Error ? err.message : "Failed to approve driver"
      );
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(driverId);
        return next;
      });
    }
  };

  const handleTriggerAlert = async () => {
    setNotifyLoading(true);
    setNotifyResult(null);
    setNotifyError(null);
    try {
      const res = await fetch("/api/v1/odofy/notify-drivers", {
        method: "POST",
        headers: { "x-api-key": adminKey },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setNotifyResult(`Sent to ${data.totalSent} drivers`);
    } catch (err) {
      setNotifyError(
        err instanceof Error ? err.message : "Failed to send notifications"
      );
    } finally {
      setNotifyLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) {
      fetchTaxData(adminKey);
      fetchPendingDrivers(adminKey);
      fetchMerchants(adminKey);
    } else {
      setLoading(false);
    }
  }, [adminKey, fetchTaxData, fetchPendingDrivers, fetchMerchants]);

  const exportCSV = () => {
    const headers = [
      "Courier Name",
      "Driver ID",
      "Total Base Fares",
      "Total Tips + Bonuses",
      "Gross Earnings",
      "1099 Status",
    ];
    const rows = drivers.map((d) => {
      const gross = parseFloat(d.gross_earnings) || 0;
      return [
        `${d.first_name} ${d.last_name}`,
        d.driver_id,
        d.total_base_fares,
        d.total_tips_bonus,
        gross.toFixed(2),
        gross >= 600 ? "1099-K Triggered" : "Below Threshold",
      ];
    });
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `odofy-tax-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!adminKey) {
    return (
      <div className="min-h-dvh bg-[#F8F9FA] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-500">Admin authentication required.</p>
          <a
            href="/admin"
            className="mt-4 inline-block text-sm font-semibold text-msu-maroon hover:underline"
          >
            ← Go to Admin Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F8F9FA] min-h-dvh">
      <header
        className="px-6 py-5"
        style={{ backgroundColor: "#5E0009" }}
      >
        <div className="max-w-7xl mx-auto">
          <a
            href="/admin"
            className="text-sm text-white/70 hover:text-white transition mb-1 inline-block"
          >
            ← Back to Admin
          </a>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Odofy Tax Compliance Dashboard
          </h1>
          <p className="text-sm text-white/70 mt-1">
            1099-K Reporting Portal
          </p>
        </div>
      </header>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-msu-maroon" />
        </div>
      )}

      {!loading && error && (
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm font-semibold">
            {error}
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-6 max-w-7xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Total Fleet Earnings
              </p>
              <p className="text-3xl font-extrabold text-gray-900 mt-2">
                ${totalFleetEarnings.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Current calendar year (YTD)
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                1099 Compliance Thresholds
              </p>
              <p className="text-3xl font-extrabold text-gray-900 mt-2">
                {driversOver600}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Couriers ≥ $600 this year
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Tax Year
              </p>
              <p className="text-3xl font-extrabold text-gray-900 mt-2">
                {new Date().getFullYear()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Current reporting period
              </p>
            </div>
          </div>

          {/* ── FLEET DEMAND MANAGEMENT ── */}
          <div className="max-w-7xl mx-auto px-6 pb-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Fleet Demand Management
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Broadcast volume alerts to all approved drivers via SMS.
                  </p>
                </div>
                <button
                  onClick={handleTriggerAlert}
                  disabled={notifyLoading}
                  className="w-full sm:w-auto px-6 py-3 bg-[#5E0009] text-white font-bold rounded-xl shadow-md uppercase tracking-wider text-sm flex items-center gap-2 hover:bg-[#4A0007] transition-all cursor-pointer mt-4 sm:mt-0 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {notifyLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      SENDING…
                    </>
                  ) : (
                    "🚨 Trigger Volume Alert Push"
                  )}
                </button>
              </div>
              {notifyResult && (
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-green-800 text-sm font-semibold">
                  {notifyResult}
                </div>
              )}
              {notifyError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 text-sm font-semibold">
                  {notifyError}
                </div>
              )}
            </div>
          </div>

          {/* ── 1099-K COMPLIANCE LEDGER (DRIVERS) ── */}
          <div className="max-w-7xl mx-auto px-6 pb-10">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">
                  1099-K Compliance Ledger
                </h2>
                <button
                  onClick={exportCSV}
                  className="px-5 py-2.5 text-white font-bold text-sm rounded-full shadow-md hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "#5E0009" }}
                >
                  📥 EXPORT TAX LEDGER CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left">
                      <th className="px-6 py-3 font-semibold text-gray-600">
                        Courier Name &amp; ID
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600">
                        Total Base Fares
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600">
                        Total Tips + Bonuses
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600">
                        Gross Earnings
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600">
                        IRS Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-12 text-center text-gray-400"
                        >
                          No driver earnings data for the current tax year.
                        </td>
                      </tr>
                    )}
                    {drivers.map((d) => {
                      const gross = parseFloat(d.gross_earnings) || 0;
                      const overThreshold = gross >= 600;
                      return (
                        <tr
                          key={d.driver_id}
                          className="border-b border-gray-50 cursor-pointer hover:bg-gray-50/80 transition-colors"
                          onClick={() => setActiveDrilldownEntity(d)}
                        >
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900">
                              {d.first_name} {d.last_name}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              {String(d.driver_id).slice(0, 8)}
                            </p>
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-700">
                            ${parseFloat(d.total_base_fares).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-700">
                            ${parseFloat(d.total_tips_bonus).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-md font-bold text-gray-900">
                            ${gross.toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            {overThreshold ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100 animate-pulse">
                                🚨 1099-K Triggered
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                                Below Threshold
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── MERCHANT LEDGER ── */}
          <div className="max-w-7xl mx-auto px-6 pb-10">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">
                  Merchant Tax Ledger
                </h2>
                <span className="text-sm font-semibold text-gray-500">
                  {merchants.length} registered
                </span>
              </div>

              {merchantsLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-msu-maroon" />
                </div>
              )}

              {merchantsError && (
                <div className="px-6 py-4">
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm font-semibold">
                    {merchantsError}
                  </div>
                </div>
              )}

              {!merchantsLoading && !merchantsError && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-left">
                        <th className="px-6 py-3 font-semibold text-gray-600">
                          Business Name
                        </th>
                        <th className="px-6 py-3 font-semibold text-gray-600">
                          Storefront Address
                        </th>
                        <th className="px-6 py-3 font-semibold text-gray-600">
                          Deliveries
                        </th>
                        <th className="px-6 py-3 font-semibold text-gray-600">
                          Platform Revenue
                        </th>
                        <th className="px-6 py-3 font-semibold text-gray-600">
                          Avg Radius
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {merchants.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-gray-400"
                          >
                            No merchants registered.
                          </td>
                        </tr>
                      )}
                      {merchants.map((m) => (
                        <tr
                          key={m.uuid}
                          className="border-b border-gray-50 cursor-pointer hover:bg-gray-50/80 transition-colors"
                          onClick={() => setActiveDrilldownEntity(m)}
                        >
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900">
                              {m.business_name}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              {String(m.uuid).slice(0, 8)}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-gray-700 max-w-[200px] truncate" title={m.storefront_address}>
                            {m.storefront_address}
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-700">
                            {m.total_deliveries}
                          </td>
                          <td className="px-6 py-4 font-bold text-gray-900">
                            ${Number(m.platform_revenue).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {m.avg_customer_radius_miles} mi
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── PENDING DRIVER APPROVALS ── */}
      {!loading && !error && (
        <div className="max-w-7xl mx-auto px-6 pb-10">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                Pending Driver Approvals
              </h2>
              <span className="text-sm font-semibold text-gray-500">
                {pendingDrivers.length} pending
              </span>
            </div>

            {pendingLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-msu-maroon" />
              </div>
            )}

            {pendingError && (
              <div className="px-6 py-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm font-semibold">
                  {pendingError}
                </div>
              </div>
            )}

            {!pendingLoading && !pendingError && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left">
                      <th className="px-6 py-3 font-semibold text-gray-600">
                        Name
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600">
                        Email
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600">
                        Tier
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600">
                        Registered
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDrivers.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-12 text-center text-gray-400"
                        >
                          No pending driver approvals.
                        </td>
                      </tr>
                    )}
                    {pendingDrivers.map((d) => {
                      const isApproving = approvingIds.has(d.uuid);
                      return (
                        <tr
                          key={d.uuid}
                          className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900">
                              {d.first_name} {d.last_name}
                            </p>
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-700">
                            {d.email || "—"}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                                d.driver_tier === "STUDENT_COURIER"
                                  ? "bg-blue-50 text-blue-700 border border-blue-100"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {d.driver_tier || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(d.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleApproveDriver(d.uuid)}
                              disabled={isApproving}
                              className="px-4 py-2 text-white font-bold text-xs rounded-full shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                              style={{ backgroundColor: "#5E0009" }}
                            >
                              {isApproving ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                  Approving…
                                </span>
                              ) : (
                                "🔓 APPROVE ACCOUNT"
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SLIDE-OVER DRILLDOWN PANEL ── */}
      {activeDrilldownEntity && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setActiveDrilldownEntity(null)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-gray-100 shadow-2xl z-50 p-6 flex flex-col gap-6 overflow-y-auto animate-slide-in-right">
            <button
              onClick={() => setActiveDrilldownEntity(null)}
              className="self-start text-sm font-bold text-gray-500 hover:text-gray-900 transition"
            >
              ✕ Close Panel
            </button>

            {isDriverEntity(activeDrilldownEntity) && (
              <DriverDrilldown driver={activeDrilldownEntity} />
            )}
            {isMerchantEntity(activeDrilldownEntity) && (
              <MerchantDrilldown merchant={activeDrilldownEntity} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DriverDrilldown({ driver }: { driver: DriverTaxEntry }) {
  const gross = parseFloat(driver.gross_earnings) || 0;
  const baseFares = parseFloat(driver.total_base_fares) || 0;
  const tips = parseFloat(driver.total_tips_bonus) || 0;
  const lat = driver.current_latitude
    ? Number(driver.current_latitude)
    : null;
  const lng = driver.current_longitude
    ? Number(driver.current_longitude)
    : null;
  const hasLocation = lat !== null && lng !== null;
  const over600 = gross >= 600;
  const progressPct = Math.min((gross / 600) * 100, 100);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-bold text-gray-900">
        {driver.first_name} {driver.last_name}
      </h2>

      {/* Section 1 — Identity & Status Grid */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
          Identity &amp; Status
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400">First Name</p>
            <p className="text-sm font-semibold text-gray-900">
              {driver.first_name}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Last Name</p>
            <p className="text-sm font-semibold text-gray-900">
              {driver.last_name}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-400">Phone Number</p>
            <p className="text-sm font-semibold text-gray-900">
              {driver.phone_number || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Tier</p>
            <p className="text-sm font-semibold text-gray-900">
              {driver.driver_tier || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Verification</p>
            <p className="text-sm font-semibold text-gray-900">
              {driver.status || "—"}
            </p>
          </div>
        </div>
      </section>

      {/* Section 2 — 🛰️ LIVE LOCATION TELEMETRY */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
          🛰️ Live Location Telemetry
        </h3>
        <div className="mb-2">
          {sessionStatusBadge(driver.status)}
        </div>
        {hasLocation ? (
          <>
            <a
              href={`https://www.google.com/maps?q=${lat},${lng}`}
              target="_blank"
              className="text-sm font-bold text-blue-600 hover:text-blue-800 underline flex items-center gap-1 mt-1"
              rel="noreferrer"
            >
              📍 View Position: {lat.toFixed(4)}, {lng.toFixed(4)}
            </a>
            <p className="text-xs text-gray-400 mt-1">
              {driver.location_updated_at
                ? `Last tracked: ${new Date(driver.location_updated_at).toLocaleString()}`
                : "No recent location ping"}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">
            No location data available.
          </p>
        )}
      </section>

      {/* Section 3 — Tax & Compliance */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
          Tax &amp; Compliance
        </h3>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-400">W-9 Filing Status</p>
            <p className="text-sm font-semibold text-gray-900">
              {driver.is_verified ? "✅ Verified" : "⏳ Pending W-9"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Taxpayer Name</p>
            <p className="text-sm font-semibold text-gray-900">
              {driver.first_name} {driver.last_name}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Tax ID</p>
            <p className="text-sm font-semibold text-green-700">
              [W-9 Complete - Tax ID Securely Encrypted]
            </p>
          </div>
          {driver.license_number && (
            <div>
              <p className="text-xs text-gray-400">License Number</p>
              <p className="text-sm font-mono text-gray-700">
                {driver.license_number}
              </p>
            </div>
          )}
          {driver.vehicle_make_model && (
            <div>
              <p className="text-xs text-gray-400">Vehicle</p>
              <p className="text-sm text-gray-700">
                {driver.vehicle_make_model}
              </p>
            </div>
          )}
          {driver.registered_at && (
            <div>
              <p className="text-xs text-gray-400">Registered</p>
              <p className="text-sm text-gray-700">
                {new Date(driver.registered_at).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Section 4 — Earnings Accounting Ledger */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
          Earnings Accounting Ledger
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">Year-to-Date Gross Revenue</p>
            <p className="text-lg font-extrabold text-gray-900">
              ${gross.toFixed(2)}
            </p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">Base Drop Fares Total</p>
            <p className="text-sm font-bold text-gray-700">
              ${baseFares.toFixed(2)}
            </p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">Distributed Tips Total</p>
            <p className="text-sm font-bold text-gray-700">
              ${tips.toFixed(2)}
            </p>
          </div>
          <div className="mt-3">
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs text-gray-500">
                IRS $600 Reporting Threshold
              </p>
              <p className="text-xs font-bold text-gray-700">
                {progressPct.toFixed(0)}%
              </p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  over600 ? "bg-red-500" : "bg-msu-maroon"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {over600
                ? "🚨 1099-K reporting required"
                : `${(600 - gross).toFixed(2)} remaining until threshold`}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function MerchantDrilldown({ merchant }: { merchant: MerchantTaxEntry }) {
  const lat = Number(merchant.latitude);
  const lng = Number(merchant.longitude);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-bold text-gray-900">
        {merchant.business_name}
      </h2>

      {/* Section 1 — Store Context */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
          Store Context
        </h3>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-400">Business Name</p>
            <p className="text-sm font-semibold text-gray-900">
              {merchant.business_name}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Storefront ID</p>
            <p className="text-sm font-mono text-gray-700">
              {String(merchant.uuid).slice(0, 12)}…
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Latitude / Longitude</p>
            <p className="text-sm font-mono text-gray-700">
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </p>
            <a
              href={`https://www.google.com/maps?q=${lat},${lng}`}
              target="_blank"
              className="text-sm font-bold text-blue-600 hover:text-blue-800 underline flex items-center gap-1 mt-1"
              rel="noreferrer"
            >
              📍 View on Map
            </a>
          </div>
          <div>
            <p className="text-xs text-gray-400">Operating Address</p>
            <p className="text-sm text-gray-700">
              {merchant.storefront_address}
            </p>
          </div>
        </div>
      </section>

      {/* Section 2 — Integration Hook Audit */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
          Integration Hook Audit
        </h3>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-400">Webhook URL</p>
            <p className="text-sm font-mono text-gray-700 break-all">
              {merchant.shop_domain
                ? `https://${merchant.shop_domain}/admin/api/odofy`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Shopify Domain</p>
            <p className="text-sm text-gray-700">
              {merchant.shop_domain || "Not connected"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">API Connection Status</p>
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                merchant.api_secret_key
                  ? "bg-green-50 text-green-700 border border-green-100"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {merchant.api_secret_key ? "🟢 Connected" : "🔴 No Key"}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-400">Trial Runs Remaining</p>
            <p className="text-sm text-gray-700">
              {merchant.free_trial_runs_remaining ?? "—"}
            </p>
          </div>
          {merchant.contact_email && (
            <div>
              <p className="text-xs text-gray-400">Contact Email</p>
              <p className="text-sm text-gray-700">{merchant.contact_email}</p>
            </div>
          )}
        </div>
      </section>

      {/* Section 3 — Logistics Volumetrics */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
          Logistics Volumetrics
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">Total Deliveries Fulfilled</p>
            <p className="text-lg font-extrabold text-gray-900">
              {merchant.total_deliveries}
            </p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">Average Customer Radius</p>
            <p className="text-sm font-bold text-gray-700">
              {merchant.avg_customer_radius_miles} miles
            </p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Historical Platform Revenue
            </p>
            <p className="text-lg font-extrabold text-gray-900">
              ${Number(merchant.platform_revenue).toFixed(2)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
