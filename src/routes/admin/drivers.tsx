import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

const ADMIN_KEY_STORAGE = "odofy_admin_key";
const API_URL = "/api/v1/odofy/admin/drivers";

interface Driver {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone_number: string;
  driver_tier: string;
  status: string;
  is_verified: boolean;
  vehicle_make_model: string | null;
  license_photo_url: string | null;
  insurance_proof_url: string | null;
  profile_photo_url: string | null;
  created_at: string | null;
}

export const Route = createFileRoute("/admin/drivers")({
  component: DriverManagementPage,
});

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  SUSPENDED: "bg-red-50 text-red-700 border-red-200",
  PENDING_REVIEW: "bg-yellow-50 text-yellow-700 border-yellow-200",
  PENDING_MANUAL_APPROVAL: "bg-yellow-50 text-yellow-700 border-yellow-200",
  REJECTED: "bg-gray-100 text-gray-600 border-gray-200",
};

function DriverManagementPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    vehicle: "",
    vehicleColor: "",
    licensePlate: "",
    insuranceExpiration: "",
    status: "ACTIVE",
    isVerified: false,
  });

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey("");
    setError("Your admin session has expired. Please sign in again.");
  }, []);

  const fetchDrivers = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_URL, { headers: { "x-api-key": key } });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load drivers");
      setDrivers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load drivers");
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    const key = sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
    setAdminKey(key);
    if (key) fetchDrivers(key);
    else setLoading(false);
  }, [fetchDrivers]);

  const openEditor = (driver: Driver) => {
    setSelectedDriver(driver);
    setForm({
      fullName: `${driver.first_name} ${driver.last_name}`.trim(),
      email: driver.email || "",
      phone: driver.phone_number || "",
      vehicle: driver.vehicle_make_model || "",
      vehicleColor: (driver as any).vehicle_color || "",
      licensePlate: (driver as any).license_plate || "",
      insuranceExpiration: (driver as any).insurance_expiration || "",
      status: driver.status,
      isVerified: driver.is_verified,
    });
    setSuccess(null);
    setIsEditDrawerOpen(true);
  };

  const closeEditor = () => {
    if (!saving) {
      setIsEditDrawerOpen(false);
      setSelectedDriver(null);
    }
  };

  const saveDriver = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDriver || saving) return;
    const nameParts = form.fullName.trim().split(/\s+/).filter(Boolean);
    if (!nameParts.length) return setError("Full name is required.");
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/${selectedDriver.uuid}`, {
        method: "PATCH",
        headers: { "x-api-key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: nameParts[0],
          last_name: nameParts.slice(1).join(" "),
          email: form.email.trim() || null,
          phone_number: form.phone.trim(),
          vehicle_make_model: form.vehicle.trim() || null,
          vehicle_color: form.vehicleColor.trim() || null,
          license_plate: form.licensePlate.trim() || null,
          insurance_expiration: form.insuranceExpiration.trim() || null,
          status: form.status,
          is_verified: form.isVerified,
        }),
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to save driver");
      setIsEditDrawerOpen(false);
      setSelectedDriver(null);
      setSuccess("Driver updated successfully.");
      await fetchDrivers(adminKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save driver");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 px-6 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-msu-maroon">Fleet</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">Driver Management</h1>
            <p className="mt-1 text-sm text-gray-500">Review and manage your delivery drivers.</p>
          </div>
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm">{drivers.length} drivers</span>
        </div>

        {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
        {success && <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{success}</div>}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex h-56 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-msu-maroon" aria-label="Loading" /></div>
          ) : drivers.length === 0 ? (
            <div className="py-20 text-center"><p className="font-semibold text-gray-700">No drivers found</p><p className="mt-1 text-sm text-gray-500">Registered drivers will appear here.</p></div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-4">Name</th><th className="px-5 py-4">Phone</th><th className="px-5 py-4">Vehicle</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Verified</th><th className="px-5 py-4">Tier</th><th className="px-5 py-4" /></tr></thead>
              <tbody className="divide-y divide-gray-100">{drivers.map((driver) => <tr key={driver.uuid} className="hover:bg-gray-50"><td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">{driver.first_name} {driver.last_name}<div className="text-xs font-normal text-gray-400">{driver.email || "No email"}</div></td><td className="whitespace-nowrap px-5 py-4 text-gray-600">{driver.phone_number}</td><td className="px-5 py-4 text-gray-600">{driver.vehicle_make_model || "—"}</td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[driver.status] || statusStyles.REJECTED}`}>{driver.status.replaceAll("_", " ")}</span></td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${driver.is_verified ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-500"}`}>{driver.is_verified ? "Verified" : "Unverified"}</span></td><td className="whitespace-nowrap px-5 py-4 text-gray-600">{driver.driver_tier || "—"}</td><td className="px-5 py-4 text-right"><button onClick={() => openEditor(driver)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:border-msu-maroon hover:text-msu-maroon">Edit</button></td></tr>)}</tbody>
            </table></div>
          )}
        </div>
      </div>

      {isEditDrawerOpen && selectedDriver && <><button aria-label="Close drawer" className="fixed inset-0 z-40 bg-black/25" onClick={closeEditor} /><aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md transform overflow-y-auto border-l border-gray-200 bg-white p-6 shadow-2xl transition-transform">
        <div className="mb-8 flex items-center justify-between"><h2 className="text-2xl font-bold text-gray-900">Edit Driver</h2><button onClick={closeEditor} className="rounded-lg p-2 text-2xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">×</button></div>
        <form onSubmit={saveDriver} className="space-y-5">
          <label className="block text-sm font-semibold text-gray-700">Full Name<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/20" required /></label>
          <label className="block text-sm font-semibold text-gray-700">Email Address<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/20" placeholder="driver@example.com" /></label>
          <label className="block text-sm font-semibold text-gray-700">Phone Number<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/20" required /></label>
          <label className="block text-sm font-semibold text-gray-700">Vehicle Information<input value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/20" placeholder="Make and model" /></label>
          <label className="block text-sm font-semibold text-gray-700">Vehicle Color<input value={form.vehicleColor} onChange={(e) => setForm({ ...form, vehicleColor: e.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/20" placeholder="e.g. Maroon" /></label>
          <label className="block text-sm font-semibold text-gray-700">License Plate<input value={form.licensePlate} onChange={(e) => setForm({ ...form, licensePlate: e.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/20" placeholder="e.g. MO-XYZ12" /></label>
          <label className="block text-sm font-semibold text-gray-700">Insurance Expiration<input type="date" value={form.insuranceExpiration} onChange={(e) => setForm({ ...form, insuranceExpiration: e.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/20" /></label>
          <label className="block text-sm font-semibold text-gray-700">Review Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-msu-maroon"><option value="ACTIVE">ACTIVE</option><option value="SUSPENDED">SUSPENDED</option><option value="PENDING_REVIEW">PENDING_REVIEW</option><option value="PENDING_MANUAL_APPROVAL">PENDING_MANUAL_APPROVAL</option><option value="REJECTED">REJECTED</option></select></label>
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-4"><span><span className="block text-sm font-semibold text-gray-700">Document Verification</span><span className="text-xs text-gray-500">Documents have been reviewed</span></span><input type="checkbox" checked={form.isVerified} onChange={(e) => setForm({ ...form, isVerified: e.target.checked })} className="h-5 w-5 accent-msu-maroon" /></label>
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4"><span className="text-sm font-semibold text-gray-700">Account State</span><button type="button" role="switch" aria-checked={form.status === "ACTIVE"} onClick={() => setForm({ ...form, status: form.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })} className={`relative h-7 w-14 rounded-full transition ${form.status === "ACTIVE" ? "bg-green-600" : "bg-gray-400"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${form.status === "ACTIVE" ? "left-8" : "left-1"}`} /></button></div>
          <div className="flex gap-3 border-t border-gray-100 pt-6"><button type="button" onClick={closeEditor} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" disabled={saving} className="flex-1 rounded-lg bg-msu-maroon px-4 py-2.5 font-semibold text-white hover:bg-msu-maroon/90 disabled:opacity-50">{saving ? "Saving…" : "Save Changes"}</button></div>
        </form>
      </aside></>}
    </div>
  );
}
