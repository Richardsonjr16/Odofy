import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

function MerchantLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/v1/odofy/merchants/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to sign in");
      }
      sessionStorage.setItem("merchant_email", data.merchant?.contact_email || email);
      window.location.href = "/merchant";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-white">
      <div className="flex items-center justify-center px-4 pt-24">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-md">
          <h1 className="mb-1 text-2xl font-bold text-msu-maroon">Merchant Login</h1>
          <p className="mb-6 text-sm text-gray-500">Sign in to your Odofy merchant dashboard.</p>
          {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-msu-maroon focus:outline-none focus:ring-1 focus:ring-msu-maroon/30" />
            </div>
            <div className="relative">
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-msu-maroon focus:outline-none focus:ring-1 focus:ring-msu-maroon/30" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-sm text-gray-500">{showPassword ? "Hide" : "Show"}</button>
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-msu-maroon px-5 py-3 text-sm font-medium text-white hover:bg-msu-maroon/80 disabled:opacity-60">{loading ? "Signing In…" : "Sign In"}</button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            Don&apos;t have an account? <a href="/merchant-signup" className="font-medium text-msu-maroon hover:underline">Register your shop</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/merchant-login")({ component: MerchantLoginPage });
