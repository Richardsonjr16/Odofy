import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type StoreProduct = { id: string; title: string; description?: string; price_cents: number; image_url?: string; in_stock: boolean; merchant_id: string; merchant_name: string; merchant_slug: string };

function StorePage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/v1/odofy/merchants/public-products");
        if (!r.ok) throw new Error("Could not load products");
        const data = await r.json();
        if (!cancelled) setProducts(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load products");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-black text-gray-800 mb-6">Odofy Storefront</h1>
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!error && products.length === 0 && (
          <p className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow-md border border-gray-100">No products available yet — check back soon.</p>
        )}
        {(() => {
          // Group by merchant
          const byMerchant: Record<string, { name: string; slug: string; products: StoreProduct[] }> = {};
          for (const p of products) {
            const key = p.merchant_slug || p.merchant_id;
            if (!byMerchant[key]) byMerchant[key] = { name: p.merchant_name || 'Store', slug: p.merchant_slug || '', products: [] };
            byMerchant[key].products.push(p);
          }
          return Object.entries(byMerchant).map(([key, m]) => (
            <div key={key} className="mb-8">
              <Link to={m.slug ? `/store/${m.slug}` : '/store'} className="text-lg font-black text-gray-800 hover:text-[#5E0009] transition mb-3 inline-block">
                {m.name} →
              </Link>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {m.products.map(p => (
                  <div key={p.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition relative">
                    <div className="relative">
                      <img src={p.image_url} alt={p.title} className={`h-[150px] w-full object-cover ${p.in_stock ? "" : "opacity-40"}`} onError={e => { e.currentTarget.style.display = "none"; }} />
                      {!p.in_stock && (
                        <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded">Sold Out</span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-bold text-gray-800 truncate">{p.title}</h3>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-black text-gray-900">${(p.price_cents / 100).toFixed(2)}</span>
                        <Link to={`/store/${m.slug}`} className="text-xs font-bold text-[#5E0009] hover:underline">View Store →</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ));
        })()}
      </div>
    </main>
  );
}
export const Route = createFileRoute("/store")({ component: StorePage });
