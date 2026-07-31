import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";

const ADMIN_KEY_STORAGE = "odofy_admin_key";
const API_BASE = "/api/v1/odofy/admin";

interface DriverTaxEntry {
  driver_id: string;
  first_name: string;
  last_name: string;
  email: string;
  total_base_fares: string;
  total_tips_bonus: string;
  gross_earnings: string;
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

export const Route = createFileRoute("/admin/taxes")({
  component: AdminTaxesPage,
});

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
      setPendingDrivers(data.filter((d) => d.status === 'PENDING_MANUAL_APPROVAL'));
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : "Failed to load pending drivers");
    } finally {
      setPendingLoading(false);
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
      setPendingError(err instanceof Error ? err.message : "Failed to approve driver");
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(driverId);
        return next;
      });
    }
  };

  useEffect(() => {
    if (adminKey) {
      fetchTaxData(adminKey);
      fetchPendingDrivers(adminKey);
    } else {
      setLoading(false);
    }
  }, [adminKey, fetchTaxData, fetchPendingDrivers]);

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
                          className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
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
                      <th className="px-6 py-3 font-semibold text-gray-600">Name</th>
                      <th className="px-6 py-3 font-semibold text-gray-600">Email</th>
                      <th className="px-6 py-3 font-semibold text-gray-600">Tier</th>
                      <th className="px-6 py-3 font-semibold text-gray-600">Registered</th>
                      <th className="px-6 py-3 font-semibold text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDrivers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
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
                            {d.email || '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                              d.driver_tier === 'STUDENT_COURIER'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {d.driver_tier || '—'}
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
    </div>
  );
}
