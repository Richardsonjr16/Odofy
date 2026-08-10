import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

interface Product {
  id: string;
  merchant_id: string;
  title: string;
  description: string;
  price_cents: number;
  price: number;
  image_url: string;
  in_stock: boolean;
  category?: string;
}
interface CartItem { product: Product; qty: number }
interface Merchant { uuid: string; business_name: string; slug: string }

const SLUG = 'st-michaels';
const CATEGORIES = ['Starters', 'Fresh Garden Salads', 'Burgers', 'Cold Subs', 'Hot Subs', 'Wraps', 'Sandwiches'];

const COLD_SUB_TITLES = new Set(['regular italian', 'spicy capicola', 'turkey sub', 'salami sub', 'chicken salad sub', 'italian blt']);
const HOT_SUB_TITLES = new Set(['cheesesteak', 'meatball sub', 'chicken parm', 'italian dip', 'pizza sub', 'russo', 'turkey russo']);

// ---------------------------------------------------------------------------
// Product photos (Unsplash).
//
// Every St. Michael's product has `image_url = NULL` in the DB, so the old
// fallback (`/branding/brand_mark.png`) showed the Odofy logo for all 46 items.
// `productImageUrl()` maps each product to a real Unsplash food photo instead.
//
// NOTE: `https://source.unsplash.com/...` (the old "source" service) was
// retired by Unsplash and returns HTTP 503, so we hotlink the official CDN
// (`images.unsplash.com/photo-<id>`) with fixed crop params. All photo IDs
// below were curl-verified to return HTTP 200 image/jpeg.
// ---------------------------------------------------------------------------

const UNSPLASH_IMG_PARAMS = '?w=200&h=200&fit=crop&crop=entropy&q=80';

// Exact product-title -> Unsplash photo ID. Each of the 46 seeded menu items
// gets its own photo; IDs are unique across the whole map.
const PRODUCT_PHOTO_IDS: Record<string, string> = {
  // Burgers
  '500 Club': '1568901346375-23c9450c58cd',
  'King Kong': '1571091718767-18b5b1457add',
  'Mississippi Ave': '1550547660-d9450f859349',
  'NY Yankee': '1551782450-a2132b4ba21d',
  'Schoolyard': '1561758033-d89a9ad46330',
  'Steel Pier': '1553979459-d2229ba7433b',
  'The Dante Hall': '1607013251379-e6eecfffe234',
  // Cold Subs
  'Regular Italian': '1528735602780-2552fd46c7af',
  'Spicy Capicola': '1553909489-cd47e0907980',
  'Turkey Sub': '1550507992-eb63ffee0847',
  'Salami Sub': '1567234669003-dce7a7a88821',
  'Italian BLT': '1481070414801-51fd732d7184',
  'Chicken Salad Sub': '1509440159596-0249088772ff',
  // Fresh Garden Salads
  'Blackened Salmon Salad': '1467003909585-2f8a72700288',
  'Crab Cake Salad': '1490645935967-10de6ba17061',
  'Crispy Chicken Salad': '1540189549336-e6e99c3679fe',
  'Grilled Chicken Salad': '1540420773420-3366772f4999',
  'Large House Salad': '1512621776951-a57141f2eefd',
  'Small Side Salad': '1505253716362-afaea1d3d1af',
  'Tomato & Mozzarella Salad': '1546069901-ba9599a7e63c',
  // Hot Subs
  'Cheesesteak': '1600891964092-4316c288032e',
  'Chicken Parm': '1608039755401-742074f0548d',
  'Italian Dip': '1547592166-23ac45744acd',
  'Meatball Sub': '1625943553852-781c6dd46faa',
  'Pizza Sub': '1565299624946-b28f40a0ae38',
  'Russo': '1473093295043-cdd812d0e601',
  'Turkey Russo': '1621996346565-e3dbc646d9a9',
  // Sandwiches
  'Chicken Club': '1414235077428-338989a2e8c0',
  'Crab Cake Sandwich': '1482049016688-2d3e1b311543',
  'Guacamole Chicken': '1505576399279-565b52d4ac71',
  'Montreal Grilled Chicken': '1550317138-10000687a72b',
  'Spicy Jalapeño Grilled Cheese': '1529042410759-befb1204b468',
  // Starters
  'Basket of Fries': '1573080496219-bb080dd4f877',
  'Chicken Tenders': '1562967914-608f82629710',
  'Crab Cakes': '1555939594-58d7cb561ad1',
  'Soup and Salad': '1504674900247-0877df9cc836',
  'Soup of the Day': '1476718406336-bb5a9690ee2a',
  'Spicy Cheese Ravioli': '1569718212165-3a8278d5f624',
  'Spinach & Artichoke Dip': '1617196034796-73dfa7b1fd56',
  // Wraps
  'Black Bean Wrap': '1626700051175-6818013e1d4f',
  'Caribbean Jerk Wrap': '1512058564366-18510be2db19',
  'Chicken Caesar Wrap': '1562059390-a761a084768e',
  'Chicken Salad Wrap': '1601050690597-df0568f70950',
  'Grilled Turkey Provolone Wrap': '1519708227418-c8fd9a32b7a2',
  'Turkey Club Wrap': '1476224203421-9ac39bcb3327',
  'Veggie Wrap': '1512852939750-1305098529bf',
};

// Category fallback pools for menu items not in the exact-title map above
// (keeps new/unknown products on a relevant photo instead of a placeholder).
const CATEGORY_PHOTO_POOLS: Record<string, string[]> = {
  'Burgers': ['1568901346375-23c9450c58cd', '1571091718767-18b5b1457add', '1550547660-d9450f859349', '1551782450-a2132b4ba21d', '1561758033-d89a9ad46330'],
  'Cold Subs': ['1528735602780-2552fd46c7af', '1550507992-eb63ffee0847', '1553909489-cd47e0907980', '1481070414801-51fd732d7184'],
  'Fresh Garden Salads': ['1512621776951-a57141f2eefd', '1540420773420-3366772f4999', '1546069901-ba9599a7e63c', '1490645935967-10de6ba17061'],
  'Hot Subs': ['1625943553852-781c6dd46faa', '1473093295043-cdd812d0e601', '1600891964092-4316c288032e', '1565299624946-b28f40a0ae38'],
  'Sandwiches': ['1550507992-eb63ffee0847', '1567234669003-dce7a7a88821', '1481070414801-51fd732d7184'],
  'Starters': ['1573080496219-bb080dd4f877', '1562967914-608f82629710', '1547592166-23ac45744acd', '1555939594-58d7cb561ad1'],
  'Wraps': ['1626700051175-6818013e1d4f', '1562059390-a761a084768e', '1512058564366-18510be2db19'],
};
const DEFAULT_PHOTO_POOL = ['1540189549336-e6e99c3679fe', '1504674900247-0877df9cc836', '1482049016688-2d3e1b311543', '1414235077428-338989a2e8c0'];

// Deterministic pool pick so a product always renders the same photo.
function photoIdFor(product: Product): string {
  const title = product.title.trim();
  const exact = PRODUCT_PHOTO_IDS[title];
  if (exact) return exact;
  const pool = CATEGORY_PHOTO_POOLS[categoryFor(product)] ?? DEFAULT_PHOTO_POOL;
  let hash = 0;
  const key = `${title} ${product.category || ''}`;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
}

function productImageUrl(product: Product): string {
  if (product.image_url) return product.image_url;
  return `https://images.unsplash.com/photo-${photoIdFor(product)}${UNSPLASH_IMG_PARAMS}`;
}

// Fallback categorizer used when the API product row has no `category` (or an
// unknown one). Rule order matters — named items are matched exactly first so
// they don't collide with keyword rules (e.g. "Chicken Salad Sub" vs Wraps).
function categoryFor(product: Product) {
  if (product.category && CATEGORIES.includes(product.category)) return product.category;
  const title = product.title.trim().toLowerCase();
  const text = `${product.title} ${product.description}`.toLowerCase();
  if (COLD_SUB_TITLES.has(title)) return 'Cold Subs';
  if (HOT_SUB_TITLES.has(title)) return 'Hot Subs';
  if (/\bwrap\b/.test(title)) return 'Wraps';
  // Signature burgers (e.g. "The Dante Hall", "King Kong") say "burger" only in the description.
  if (/(burger|cheeseburger)/.test(text)) return 'Burgers';
  if (/(sandwich|melt|grilled cheese)/.test(title)) return 'Sandwiches';
  // Named grilled-chicken sandwiches whose titles don't say "sandwich".
  if (/(montreal|chicken club|guacamole chicken)/.test(title)) return 'Sandwiches';
  if (title === 'soup and salad') return 'Starters'; // combo item; seeded under Starters
  if (/(salad|greens)/.test(title)) return 'Fresh Garden Salads';
  if (/(dip|tenders|crab cake|ravioli|fries|soup)/.test(title)) return 'Starters';
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
      .then((data) => { if (data.error) setError(data.error); else { setMerchant(data.merchant); setProducts((data.products || []).map((p) => ({ ...p, price: p.price_cents / 100 }))); } })
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
  const changeQty = (product: Product, amount: number) => setCartItems((current) => {
    const existing = current.find((item) => item.product.id === product.id);
    // Item not in the cart yet — append it (the old flatMap-only version could
    // never add a new item, so "+ Add" on an empty cart was a silent no-op).
    if (!existing) return amount > 0 ? [...current, { product, qty: amount }] : current;
    const qty = existing.qty + amount;
    return qty > 0
      ? current.map((item) => (item.product.id === product.id ? { ...item, qty } : item))
      : current.filter((item) => item.product.id !== product.id);
  });
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
            <div className="flex items-center min-w-0"><img src={productImageUrl(product)} alt={product.title} className="w-20 h-20 object-cover rounded-lg mr-4 shrink-0" /><div className="min-w-0"><h3 className="text-sm font-bold text-gray-800">{product.title}</h3><p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{product.description}</p></div></div>
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
