import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { useState } from "react";

const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "Odofy";
  } catch {
    return "Odofy";
  }
});

export const Route = createFileRoute("/order")({
  loader: () => getBusinessName(),
  component: OrderPage,
});

const TIP_OPTIONS = [
  { label: "$3", value: 3 },
  { label: "$5", value: 5 },
  { label: "$10", value: 10 },
] as const;

const BASE_PAYOUT = 6.5;

function OrderPage() {
  const businessName = Route.useLoaderData();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [tipAmount, setTipAmount] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [activeTipPreset, setActiveTipPreset] = useState<number | "custom" | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
    trip?: Record<string, unknown>;
  } | null>(null);

  const displayTip = activeTipPreset === "custom" ? (parseFloat(customTip) || 0) : tipAmount;
  const totalPayout = BASE_PAYOUT + displayTip;

  const handleTipPreset = (value: number) => {
    setActiveTipPreset(value);
    setTipAmount(value);
    setCustomTip("");
  };

  const handleCustomTip = () => {
    setActiveTipPreset("custom");
    setTipAmount(0);
  };

  const handleCustomTipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "" || /^\d+(\.\d{0,2})?$/.test(raw)) {
      setCustomTip(raw);
      setActiveTipPreset("custom");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !deliveryAddress || !apiKey) return;

    setLoading(true);
    setResult(null);

    const tip =
      activeTipPreset === "custom" ? parseFloat(customTip) || 0 : tipAmount;

    try {
      const backendUrl = "https://getodofy.com";

      const res = await fetch(
        `${backendUrl}/api/v1/odofy/trips/manual`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            customer_name: customerName,
            customer_phone: customerPhone,
            delivery_address: deliveryAddress,
            driver_tip_allocation: tip,
          }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        setResult({
          type: "success",
          message:
            data.status === "rejected"
              ? `Trip created but outside delivery radius (${data.reason}).`
              : "Delivery created successfully!",
          trip: data.trip || data,
        });
      } else {
        setResult({
          type: "error",
          message: data.error || `Request failed with status ${res.status}`,
        });
      }
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    customerName && customerPhone && deliveryAddress && apiKey && !loading;

  return (
    <div className="min-h-dvh bg-white text-charcoal">
      <nav className="flex items-center justify-between px-6 py-5 sm:px-8 lg:px-12 border-b border-gray-100">
        <a
          href="/"
          className="text-xl font-bold tracking-tight text-msu-maroon hover:text-msu-maroon/80"
        >
          {businessName}
        </a>
        <a
          href="/"
          className="text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          &larr; Home
        </a>
      </nav>

      <main className="px-6 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-lg">
          <h1 className="text-2xl font-bold tracking-tight text-msu-maroon sm:text-3xl">
            Create a Delivery
          </h1>
          <p className="mt-2 text-charcoal">
            Fill in the details below to dispatch a new delivery.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label
                htmlFor="customerName"
                className="block text-sm font-semibold text-gray-700"
              >
                Customer Name
              </label>
              <input
                id="customerName"
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Jane Smith"
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/30 outline-none transition"
              />
            </div>

            <div>
              <label
                htmlFor="customerPhone"
                className="block text-sm font-semibold text-gray-700"
              >
                Customer Phone
              </label>
              <input
                id="customerPhone"
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+1 555-123-4567"
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/30 outline-none transition"
              />
            </div>

            <div>
              <label
                htmlFor="deliveryAddress"
                className="block text-sm font-semibold text-gray-700"
              >
                Delivery Address
              </label>
              <input
                id="deliveryAddress"
                type="text"
                required
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="123 Main St, Springfield, MO 65804"
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/30 outline-none transition"
              />
            </div>

            <div>
              <label
                htmlFor="apiKey"
                className="block text-sm font-semibold text-gray-700"
              >
                Merchant API Key
              </label>
              <input
                id="apiKey"
                type="password"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/30 outline-none transition"
              />
            </div>

            <fieldset className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <legend className="text-sm font-semibold text-gray-700 px-1">
                Driver Gratuity (Optional)
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {TIP_OPTIONS.map((opt) => {
                  const isActive = activeTipPreset === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleTipPreset(opt.value)}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? "bg-msu-maroon text-white shadow-sm"
                          : "border border-gray-300 bg-white text-charcoal hover:border-msu-maroon/50 hover:text-msu-maroon"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={handleCustomTip}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    activeTipPreset === "custom"
                      ? "bg-msu-maroon text-white shadow-sm"
                      : "border border-gray-300 bg-white text-charcoal hover:border-msu-maroon/50 hover:text-msu-maroon"
                  }`}
                >
                  Custom
                </button>
                {activeTipPreset === "custom" && (
                  <div className="relative mt-1 w-full sm:w-auto">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customTip}
                      onChange={handleCustomTipChange}
                      placeholder="0.00"
                      className="w-28 rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm shadow-sm focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/30 outline-none transition"
                    />
                  </div>
                )}
              </div>
            </fieldset>

            <div className="rounded-xl border border-msu-maroon/20 bg-msu-maroon/10 p-4 text-center">
              <p className="text-sm font-medium text-msu-maroon">
                Total Driver Payout: ${BASE_PAYOUT.toFixed(2)} Base
                {displayTip > 0 && (
                  <> + ${displayTip.toFixed(2)} Tip</>
                )}{" "}
                = <span className="font-bold">${totalPayout.toFixed(2)}</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-msu-maroon px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-msu-maroon/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Delivery"}
            </button>
          </form>

          {result && (
            <div
              className={`mt-6 rounded-xl border p-5 ${
                result.type === "success"
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  result.type === "success" ? "text-green-800" : "text-red-800"
                }`}
              >
                {result.type === "success" ? "✓" : "✗"} {result.message}
              </p>
              {result.trip && (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-white/50 p-3 text-xs text-gray-700">
                  {JSON.stringify(result.trip, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-100 px-6 py-8 text-center sm:px-8 lg:px-12">
        <p className="text-sm text-gray-400">
          &copy; {new Date().getFullYear()} {businessName}.
        </p>
      </footer>
    </div>
  );
}
