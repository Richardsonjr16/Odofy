import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";

/* ── MSU MAROON DESIGN TOKENS ── */
const MSU_MAROON = "#5E0009";
const MSU_MAROON_LIGHT = "rgba(94,0,9,0.08)";
const MSU_MAROON_HOVER = "rgba(94,0,9,0.85)";

/* ── TYPES ── */
interface MerchantOrder {
  id: string;
  customer_email: string;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  status: string;
  route_sequence_index: number | null;
  created_at: string;
  delivery_address: string | null;
}

interface StripeTransaction {
  id: string;
  amount_cents: number;
  status: string;
  created: number;
}

/* ── HELPER ── */
function fmtCents(c: number): string {
  return `$${(c / 100).toFixed(2)}`;
}

function MerchantPage() {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [transactions, setTransactions] = useState<StripeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const email =
    typeof window !== "undefined"
      ? sessionStorage.getItem("merchant_email") || ""
      : "";

  useEffect(() => {
    if (!email) window.location.href = "/merchant-login";
  }, [email]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch orders via the backend API
        const ordersRes = await fetch("/api/v1/odofy/merchants/orders", {
          headers: email ? { "X-Merchant-Email": email } : {},
        });
        if (ordersRes.ok) {
          const data = await ordersRes.json();
          setOrders(data.orders || []);
          setTransactions(data.transactions || []);
        } else {
          setOrders([]);
          setTransactions([]);
        }
      } catch {
        setError("Could not load merchant data. Backend may be offline.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [email]);

  /* ── Nested routes (e.g. /merchant/dashboard) ── */
  const matches = useRouterState({ select: (s) => s.matches });
  if (matches.some((m) => m.id.startsWith("/merchant/"))) {
    return <Outlet />;
  }

  /* ── Stats ── */
  const activeCount = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total_cents, 0);
  const txVolume = transactions.reduce((sum, t) => sum + t.amount_cents, 0);

  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div
            className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200"
            style={{ borderTopColor: MSU_MAROON }}
          />
          <p className="text-sm text-gray-500">Loading merchant portal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* ── HEADER ── */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <a href="/" className="flex items-center gap-3 transition-opacity hover:opacity-75">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: MSU_MAROON }}
            >
              O
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Odofy Merchant</h1>
              {email && (
                <p className="text-xs text-gray-500">{email}</p>
              )}
            </div>
          </a>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1">
              <a
                href="/merchant/dashboard"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Dashboard
              </a>
              <a
                href="/merchant/marketing"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Marketing
              </a>
            </nav>
            <a
              href="/merchant-login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Account
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        {/* ── STAT CARDS ── */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Active Orders */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Active Orders
            </p>
            <p
              className="mt-1 text-3xl font-bold"
              style={{ color: MSU_MAROON }}
            >
              {activeCount}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {orders.length} total
            </p>
          </div>

          {/* Order Revenue */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Order Revenue
            </p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {fmtCents(totalRevenue)}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">All orders</p>
          </div>

          {/* Stripe Connect */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Stripe Connect
            </p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {fmtCents(txVolume)}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {transactions.length} tx processed
            </p>
          </div>
        </div>

        {/* ── STRIPE TRANSACTIONS CARD ── */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2
              className="text-base font-semibold"
              style={{ color: MSU_MAROON }}
            >
              Stripe Connect Transactions
            </h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {transactions.length} tx
            </span>
          </div>
          {transactions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No Stripe transactions yet. Completed payments will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3">Transaction ID</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-mono text-xs text-gray-600">
                        {tx.id.slice(-12)}
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {fmtCents(tx.amount_cents)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {new Date(tx.created * 1000).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── ACTIVE ORDERS TABLE ── */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2
              className="text-base font-semibold"
              style={{ color: MSU_MAROON }}
            >
              Active Orders
            </h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {orders.length}
            </span>
          </div>
          {orders.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: MSU_MAROON_LIGHT }}
              >
                <svg className="h-6 w-6" style={{ color: MSU_MAROON }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">No orders yet</p>
              <p className="mt-1 text-xs text-gray-400">
                Orders from your Shopify store will appear here once processed.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3">Order</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Subtotal</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3">Route #</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">
                        {order.id.slice(0, 8)}…
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {order.customer_email}
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {fmtCents(order.subtotal_cents)}
                      </td>
                      <td className="px-5 py-3 font-semibold" style={{ color: MSU_MAROON }}>
                        {fmtCents(order.total_cents)}
                      </td>
                      <td className="px-5 py-3">
                        {order.route_sequence_index != null ? (
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: MSU_MAROON }}
                          >
                            {order.route_sequence_index}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-gray-400">
          Odofy Merchant Portal &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}

/* ── STATUS BADGE COMPONENT ── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending:    { bg: "bg-yellow-50",    text: "text-yellow-700",    label: "Pending" },
    assigned:   { bg: "bg-blue-50",      text: "text-blue-700",      label: "Assigned" },
    in_transit: { bg: "bg-indigo-50",    text: "text-indigo-700",    label: "In Transit" },
    delivered:  { bg: "bg-green-50",     text: "text-green-700",     label: "Delivered" },
    paid:       { bg: "bg-emerald-50",   text: "text-emerald-700",   label: "Paid" },
    cancelled:  { bg: "bg-red-50",       text: "text-red-700",       label: "Cancelled" },
  };
  const s = map[status] || { bg: "bg-gray-50", text: "text-gray-600", label: status };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

export const Route = createFileRoute("/merchant")({
  component: MerchantPage,
});
