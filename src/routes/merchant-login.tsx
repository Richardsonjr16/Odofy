import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

function MerchantLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-msu-maroon focus:outline-none focus:ring-1 focus:ring-msu-maroon/30"
              />
            </div>
            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-msu-maroon focus:outline-none focus:ring-1 focus:ring-msu-maroon/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer z-30 transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
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
