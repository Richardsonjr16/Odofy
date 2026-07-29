import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

function MerchantLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email && password) {
      sessionStorage.setItem("merchant_email", email);
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-dvh bg-white">
        <div className="flex items-center justify-center px-4 pt-24">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-md text-center">
            <h1 className="text-2xl font-bold text-msu-maroon mb-2">Signed In</h1>
            <p className="text-sm text-gray-500 mb-4">
              Welcome, {email}. Your merchant dashboard is coming soon.
            </p>
            <a
              href="/"
              className="inline-block rounded-lg bg-msu-maroon px-5 py-2.5 text-sm font-medium text-white"
            >
              Back to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white">
      <div className="flex items-center justify-center px-4 pt-24">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-md">
          <h1 className="mb-1 text-2xl font-bold text-msu-maroon">Merchant Login</h1>
          <p className="mb-6 text-sm text-gray-500">
            Sign in to your Odofy merchant dashboard.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-msu-maroon focus:outline-none focus:ring-1 focus:ring-msu-maroon/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-msu-maroon focus:outline-none focus:ring-1 focus:ring-msu-maroon/30"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-msu-maroon px-5 py-3 text-sm font-medium text-white hover:bg-msu-maroon/80"
            >
              Sign In
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <a href="/merchant" className="font-medium text-msu-maroon hover:underline">
              Register here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/merchant-login")({
  component: MerchantLoginPage,
});
