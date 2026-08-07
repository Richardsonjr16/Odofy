import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

interface Product {
  id: number;
  merchant_id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  in_stock: boolean;
  category?: string;
}
interface CartItem { product: Product; qty: number }
interface Merchant { uuid: string; business_name: string; slug: string }

const SLUG = 'st-michaels';
const CATEGORIES = ['Popular Items', 'Burgers', 'Sandwiches', 'Catering Trays'];

function categoryFor(product: Product) {
  if (product.category && CATEGORIES.includes(product.category)) return product.category;
  const text = `${product.title} ${product.description}`.toLowerCase();
  if (/(burger|cheeseburger)/.test(text)) return 'Burgers';
  if (/(sandwich|sub|wrap|melt)/.test(text)) return 'Sandwiches';
  if (/(tray|catering|platter|serves)/.test(text)) return 'Catering Trays';
  return 'Popular Items';
}

function StorePage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    if (typeof sessionStorage === 'undefined') return [];
    try { return JSON.parse(sessionStorage.getItem(`odofy_cart_${SLUG}`) || '[]'); } catch { return []; }
  });
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledSlot, setScheduledSlot] = useState('');

  const timeSlots = useMemo(() => Array.from({ length: 48 }, (_, i) => {
    const start = new Date(Date.now() + (i + 1) * 3600000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    const format = (date: Date) => date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', hour12: true });
    return { value: start.toISOString(), label: `${format(start)} – ${format(end)}` };
  }), []);

  useEffect(() => {
    fetch(`/api/v1/odofy/merchants/store/${SLUG}/products`)
      .then((response) => response.json())
      .then((data) => { if (data.error) setError(data.error); else { setMerchant(data.merchant); setProducts(data.products || []); } })
      .catch(() => setError('Failed to load store'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(`odofy_cart_${SLUG}`, JSON.stringify(cartItems));
  }, [cartItems]);

  const grouped = useMemo(() => {
    const visible = selectedCategory === 'All Items' ? products : products.filter((p) => categoryFor(p) === selectedCategory);
    return selectedCategory === 'All Items' ? CATEGORIES.map((category) => ({ category, products: visible.filter((p) => categoryFor(p) === category) })).filter((g) => g.products.length) : [{ category: selectedCategory, products: visible }];
  }, [products, selectedCategory]);
  const cartSubtotal = cartItems.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
  const isMinimumMet = cartSubtotal >= 15.00;
  const changeQty = (product: Product, amount: number) => setCartItems((current) => current.flatMap((item) => item.product.id === product.id ? (item.qty + amount > 0 ? [{ ...item, qty: item.qty + amount }] : []) : [item]));
  const addToCart = (product: Product) => changeQty(product, 1);
  const handleCheckout = async () => {
    if (!customerName || !deliveryAddress || (deliveryMode === 'scheduled' && !scheduledSlot)) return;
    setCheckoutSubmitting(true);
    try {
      const payload: Record<string, unknown> = { customer_name: customerName, customer_phone: customerPhone, delivery_address: deliveryAddress, items: cartItems.map((item) => ({ product_id: item.product.id, qty: item.qty })) };
      if (deliveryMode === 'scheduled') { payload.is_scheduled = true; payload.scheduled_window_start = scheduledSlot; payload.scheduled_window_end = new Date(new Date(scheduledSlot).getTime() + 3600000).toISOString(); }
      const response = await fetch(`/api/v1/odofy/merchants/store/${SLUG}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Checkout failed');
      setOrderNumber(data.order.order_number); setCartItems([]); setShowCheckout(false);
    } catch (checkoutError) { window.alert(checkoutError instanceof Error ? checkoutError.message : 'Checkout failed. Please try again.'); }
    finally { setCheckoutSubmitting(false); }
  };

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-500">Loading store…</div>;
  if (error) return <div className="max-w-6xl mx-auto px-4 py-16 text-center text-red-600 font-bold">{error}</div>;
  return <div className="min-h-screen bg-gray-50 pb-16">
    <div className="max-w-[1400px] mx-auto px-4 pt-6">
      <div className="w-full bg-[#1A1A1A] text-white p-8 rounded-2xl mb-8 relative overflow-hidden">
        <h1 className="text-3xl font-black">St. Michael's Restaurant &amp; Catering</h1>
        <p className="text-sm text-gray-300 mt-1">301 South Ave, Springfield, MO | Powered by Odofy Utility Network</p>
        <span className="inline-block mt-4 bg-[#5E0009] text-xs font-bold px-3 py-1 rounded-full">TRUE KITCHEN PRICING — 0% COMMISSION APP EXCLUSIVITY</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-2"><nav className="lg:sticky lg:top-6 space-y-1">
          {['All Items', ...CATEGORIES].map((category) => <button key={category} onClick={() => setSelectedCategory(category)} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition ${selectedCategory === category ? 'bg-[#5E0009] text-white' : 'text-gray-600 hover:bg-white'}`}>{category}</button>)}
        </nav></aside>
        <main className="lg:col-span-7 min-w-0">
          {grouped.map((group) => <section key={group.category} className="mb-8"><h2 className="text-xl font-black text-gray-800 mb-4">{group.category}</h2>{group.products.map((product) => <div key={product.id} className={`flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl mb-4 shadow-sm ${!product.in_stock ? 'opacity-50' : ''}`}>
            <div className="flex items-center min-w-0"><img src={product.image_url || '/branding/brand_mark.png'} alt="" className="w-20 h-20 object-cover rounded-lg mr-4 shrink-0" /><div className="min-w-0"><h3 className="text-sm font-bold text-gray-800">{product.title}</h3><p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{product.description}</p></div></div>
            <div className="flex items-center gap-4 ml-4 shrink-0"><span className="text-sm font-bold text-gray-900">${product.price.toFixed(2)}</span><button disabled={!product.in_stock} onClick={() => addToCart(product)} className="bg-[#5E0009] hover:bg-[#4a0007] text-white font-extrabold text-xs py-2 px-5 rounded-xl shadow-sm transition-all active:scale-[0.97] disabled:bg-gray-400 disabled:cursor-not-allowed">{product.in_stock ? '+ Add' : 'Sold Out'}</button></div>
          </div>)}</section>)}
          {!grouped.length && <p className="text-gray-500">No products in this category.</p>}
        </main>
        <aside className="lg:col-span-3"><div className="sticky top-6 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"><h2 className="text-lg font-bold text-gray-800 mb-4">Your Order</h2>{!cartItems.length ? <p className="text-sm text-gray-500">No items yet</p> : <div className="space-y-4 mb-5">{cartItems.map((item) => <div key={item.product.id} className="flex justify-between gap-2 text-sm"><div className="min-w-0"><p className="font-semibold truncate">{item.product.title}</p><div className="flex items-center gap-2 mt-1"><button onClick={() => changeQty(item.product, -1)} className="w-6 h-6 rounded bg-gray-100">−</button><span>{item.qty}</span><button onClick={() => changeQty(item.product, 1)} className="w-6 h-6 rounded bg-gray-100">+</button></div></div><span className="font-bold">${(item.product.price * item.qty).toFixed(2)}</span></div>)}</div>}
          <div className="border-t pt-4 flex justify-between font-bold text-gray-800 mb-4"><span>Subtotal</span><span>${cartSubtotal.toFixed(2)}</span></div>{cartSubtotal > 0 && !isMinimumMet && <div className="bg-orange-50 border border-orange-200 text-orange-800 text-xs font-semibold rounded-xl p-4 mb-4 text-center">Minimum $15.00 for Delivery. Add ${(15.00 - cartSubtotal).toFixed(2)} more to unlock checkout.</div>}<button disabled={!isMinimumMet} onClick={() => setShowCheckout(true)} className={`w-full text-white font-bold py-3 rounded-xl ${isMinimumMet ? 'bg-[#5E0009] hover:bg-[#4a0007]' : 'opacity-50 cursor-not-allowed bg-gray-400'}`}>Proceed to Checkout</button>
        </div></aside>
      </div>
    </div>
    {showCheckout && <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"><div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl"><h2 className="text-lg font-black text-gray-800 mb-1">🔒 Secure Checkout</h2><p className="text-sm text-gray-500 mb-4">Enter your details to place this order.</p><div className="space-y-3"><input type="text" placeholder="Your Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-sm" /><input type="tel" placeholder="Phone Number (optional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-sm" /><input type="text" placeholder="Delivery Address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-sm" /><div className="flex rounded-xl bg-gray-100 p-1 gap-1"><button onClick={() => setDeliveryMode('now')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${deliveryMode === 'now' ? 'bg-[#5E0009] text-white' : 'text-gray-500'}`}>🚀 Deliver Now</button><button onClick={() => setDeliveryMode('scheduled')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${deliveryMode === 'scheduled' ? 'bg-[#5E0009] text-white' : 'text-gray-500'}`}>📅 Schedule for Later</button></div>{deliveryMode === 'scheduled' && <select value={scheduledSlot} onChange={(e) => setScheduledSlot(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white"><option value="">Select a delivery window…</option>{timeSlots.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select>}</div><div className="flex gap-3 mt-4"><button onClick={() => setShowCheckout(false)} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-xl">Cancel</button><button onClick={handleCheckout} disabled={checkoutSubmitting || !customerName || !deliveryAddress || (deliveryMode === 'scheduled' && !scheduledSlot)} className="flex-1 bg-[#5E0009] text-white font-bold py-3 rounded-xl disabled:opacity-50">{checkoutSubmitting ? 'Placing Order…' : 'Place Order'}</button></div></div></div>}
    {orderNumber && <div className="fixed bottom-6 right-6 z-40 bg-green-50 border border-green-200 rounded-xl p-5 shadow-lg"><p className="font-bold text-green-800">Order confirmed!</p><p className="text-sm text-green-700">Your order number is {orderNumber}</p><button onClick={() => setOrderNumber('')} className="text-xs underline mt-2">Dismiss</button></div>}
  </div>;
}
export const Route = createFileRoute('/store/st-michaels')({ component: StorePage });
