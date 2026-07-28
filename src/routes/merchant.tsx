import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Navbar from "~/components/Navbar";

function MerchantSignupPage() {
  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ apiKey: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/odofy/merchants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName,
          contact_email: contactEmail,
          password,
          storefront_address: storeAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setResult({ apiKey: data.api_secret_key });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (result) {
      await navigator.clipboard.writeText(result.apiKey);
    }
  }

  if (result) {
    return (
      <div className="min-h-dvh bg-white">
        <Navbar />
        <div className="flex items-center justify-center px-4 pt-24">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-md text-center">
            <h1 className="text-2xl font-bold text-msu-maroon mb-4">
              🎉 Your API Key
            </h1>
            <pre className="mb-4 break-all rounded bg-gray-100 p-4 text-sm text-gray-800">
              {result.apiKey}
            </pre>
            <button
              onClick={copyToClipboard}
              className="mb-4 rounded-lg bg-msu-maroon px-5 py-2.5 text-sm font-medium text-white hover:bg-msu-maroon/80"
            >
              Copy to Clipboard
            </button>
            <p className="text-xs text-gray-500">
              Save this key now — you won&apos;t see it again.
            </p>
            <div className="mt-6 border-t border-gray-100 pt-4 text-left text-sm text-gray-600">
              <h2 className="font-semibold text-gray-800 mb-2">Shopify Webhook Setup</h2>
              <p className="mb-1">
                Configure your Shopify store to send order webhooks to:
              </p>
              <pre className="rounded bg-gray-100 p-2 text-xs text-gray-700">
                https://getodofy.com/api/v1/odofy/integrations/shopify
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white">
      <Navbar />
      <div className="flex items-center justify-center px-4 pt-24">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-md">
          <h1 className="mb-1 text-2xl font-bold text-msu-maroon">
            Merchant Sign Up
          </h1>
          <p className="mb-6 text-sm text-gray-500">
            Activate your free trial and start delivering with Odofy.
          </p>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Business Name
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-msu-maroon focus:outline-none focus:ring-1 focus:ring-msu-maroon/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Contact Email
              </label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-msu-maroon focus:outline-none focus:ring-1 focus:ring-msu-maroon/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-msu-maroon focus:outline-none focus:ring-1 focus:ring-msu-maroon/30"
              />
              <p className="mt-1 text-xs text-gray-400">Minimum 8 characters</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Springfield Store Physical Address
              </label>
              <input
                type="text"
                required
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-msu-maroon focus:outline-none focus:ring-1 focus:ring-msu-maroon/30"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-msu-maroon px-5 py-3 text-sm font-medium text-white hover:bg-msu-maroon/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Activate Free Trial & Get API Key"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/merchant")({
  component: MerchantSignupPage,
});
