import { useCallback, useEffect, useState } from "react";

interface Dispute {
  id: string;
  order_id: string | null;
  order_number: string | null;
  merchant_id: string | null;
  business_name: string | null;
  customer_id: string | null;
  reason_category: "MISSING_ITEM" | "DAMAGED_GOODS" | "LATE_DELIVERY";
  description: string | null;
  proof_image_url: string | null;
  proof_of_delivery_url: string | null;
  status: string;
  created_at: string;
  customer_name: string | null;
  delivery_address: string | null;
  driver_name: string | null;
  driver_id: string | null;
}

const API_BASE = "/api/v1/odofy/admin/disputes";
const formatDate = (value: string) => new Date(value).toLocaleString();

export function DisputesPanel({ adminKey }: { adminKey: string }) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(API_BASE, { headers: { "x-api-key": adminKey } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load disputes");
      setDisputes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load disputes");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (action: "APPROVE" | "DENY") => {
    if (!selected) return;
    setActing(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/${selected.id}/resolve`, {
        method: "POST",
        headers: { "x-api-key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to resolve dispute");
      setDisputes((current) => current.filter((item) => item.id !== selected.id));
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resolve dispute");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-2xl shadow-xl my-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-msu-maroon">Refund &amp; Dispute Center</h2>
        <span className="rounded-full bg-msu-maroon/10 px-4 py-1.5 text-sm font-semibold text-msu-maroon">{disputes.length} pending</span>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="py-12 text-center text-gray-400">Loading disputes…</p> : disputes.length === 0 ? <p className="py-12 text-center text-gray-400">No pending disputes.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-gray-500"><th className="p-3">Order ID</th><th className="p-3">Merchant</th><th className="p-3">Category</th><th className="p-3">Filed Date</th><th className="p-3">Actions</th></tr></thead><tbody>
          {disputes.map((dispute) => <tr key={dispute.id} className="border-b last:border-0 hover:bg-gray-50"><td className="p-3 font-mono text-xs">{dispute.order_number || dispute.order_id || "—"}</td><td className="p-3">{dispute.business_name || "—"}</td><td className="p-3">{dispute.reason_category.replaceAll("_", " ")}</td><td className="p-3">{formatDate(dispute.created_at)}</td><td className="p-3"><button onClick={() => setSelected(dispute)} className="rounded-lg bg-msu-maroon px-4 py-2 font-semibold text-white hover:bg-msu-maroon/80">Review</button></td></tr>)}
        </tbody></table></div>
      )}
      {selected && <div className="fixed inset-0 z-50 bg-black/30" onClick={() => !acting && setSelected(null)}><aside className="absolute right-0 top-0 h-full w-full max-w-lg translate-x-0 overflow-y-auto bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h3 className="text-xl font-bold text-msu-maroon">Review Dispute</h3><button onClick={() => setSelected(null)} disabled={acting} className="text-2xl text-gray-400">×</button></div><div className="mt-6 space-y-5"><div><p className="text-xs font-bold uppercase text-gray-500">Customer description</p><p className="mt-1 text-gray-700">{selected.description || "No description provided."}</p></div><ImageBlock label="Complaint photo" url={selected.proof_image_url} fallback="No image" /><ImageBlock label="Order proof of delivery" url={selected.proof_of_delivery_url} fallback="No delivery proof image available" /><div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700"><p><strong>Driver:</strong> {selected.driver_name || "Not assigned"}</p><p><strong>Delivery address:</strong> {selected.delivery_address || "—"}</p><p className="mt-2">Geofence: 150-ft radius verified at delivery address</p></div></div><div className="mt-8 border-t pt-5"><button disabled={acting} onClick={() => resolve("APPROVE")} className="mr-3 rounded-xl bg-green-600 px-4 py-2 font-bold text-white shadow-md transition-all hover:bg-green-700 disabled:opacity-50">Approve Merchant Credit</button><button disabled={acting} onClick={() => resolve("DENY")} className="rounded-xl border border-gray-200 bg-gray-600 px-4 py-2 font-bold text-white transition-all hover:bg-gray-700 disabled:opacity-50">Deny Claim</button></div></aside></div>}
    </div>
  );
}

function ImageBlock({ label, url, fallback }: { label: string; url: string | null; fallback: string }) {
  return <div><p className="text-xs font-bold uppercase text-gray-500">{label}</p>{url ? <img src={url} alt={label} className="mt-2 max-h-56 w-full rounded-xl border object-contain" /> : <div className="mt-2 rounded-xl border border-dashed p-8 text-center text-sm text-gray-400">{fallback}</div>}</div>;
}
