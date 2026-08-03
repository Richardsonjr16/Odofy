import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

function MerchantSignupPage() {
  const [form, setForm] = useState({ business_name: "", storefront_address: "", shop_domain: "", contact_email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/v1/odofy/merchants/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to create account");
      sessionStorage.setItem("merchant_email", form.contact_email);
      window.location.href = "/merchant";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally { setLoading(false); }
  }

  const fields: Array<[keyof typeof form, string, string, boolean]> = [
    ["business_name", "Business Name", "Your business name", true],
    ["storefront_address", "Storefront Address", "Street address", true],
    ["shop_domain", "Shop Domain (optional)", "your-store.myshopify.com", false],
    ["contact_email", "Contact Email", "you@example.com", true],
    ["password", "Password", "Create a password", true],
  ];
  return <div className="min-h-dvh bg-white"><div className="flex items-center justify-center px-4 py-16"><div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-md">
    <h1 className="mb-1 text-2xl font-bold text-msu-maroon">Register Your Shop</h1><p className="mb-6 text-sm text-gray-500">Create your Odofy merchant account.</p>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    <form onSubmit={handleSubmit} className="space-y-4">{fields.map(([field, label, placeholder, required]) => <div key={field}><label htmlFor={field} className="mb-1 block text-sm font-medium text-gray-700">{label}</label><input id={field} type={field === "contact_email" ? "email" : field === "password" ? "password" : "text"} required={required} value={form[field]} placeholder={placeholder} onChange={(e) => update(field, e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-msu-maroon focus:outline-none focus:ring-1 focus:ring-msu-maroon/30" /></div>)}
      <button type="submit" disabled={loading} className="w-full rounded-lg bg-msu-maroon px-5 py-3 text-sm font-medium text-white hover:bg-msu-maroon/80 disabled:opacity-60">{loading ? "Creating Account…" : "Create Merchant Account"}</button>
    </form><p className="mt-4 text-center text-sm text-gray-500">Already have an account? <a href="/merchant-login" className="font-medium text-msu-maroon hover:underline">Sign in</a></p>
  </div></div></div>;
}
export const Route = createFileRoute("/merchant-signup")({ component: MerchantSignupPage });
