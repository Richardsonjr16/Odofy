import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

interface Product {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  image_url: string;
  in_stock: boolean;
}

interface Merchant {
  uuid: string;
  business_name: string;
  slug: string;
}

interface CartItem {
  product: Product;
  qty: number;
}

function StorePage() {
  const { merchant_slug } = createFileRoute("/store/$merchant_slug")().useParams();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(`odofy_cart_${merchant_slug}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  // Group cart (shared ordering)
  const [showGroupCart, setShowGroupCart] = useState(false);
  const [groupRoomCode, setGroupRoomCode] = useState("");
  const [groupCartItems, setGroupCartItems] = useState<any[]>([]);
  const [groupWs, setGroupWs] = useState<WebSocket | null>(null);
  const [groupUserId] = useState(() => "user-" + Math.random().toString(36).slice(2, 8));
  const [groupJoined, setGroupJoined] = useState(false);

  // Checkout form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledSlot, setScheduledSlot] = useState("");

  // Generate 1-hour time slots over the next 48 hours
  const timeSlots = (() => {
    const slots: { label: string; value: string }[] = [];
    const now = new Date();
    for (let h = 1; h <= 48; h++) {
      const start = new Date(now.getTime() + h * 3600000);
      start.setMinutes(0, 0, 0);
      const end = new Date(start.getTime() + 3600000);
      const fmt = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', hour12: true });
      slots.push({ label: `${fmt(start)} – ${fmt(end)}`, value: start.toISOString() });
    }
    return slots;
  })();

  useEffect(() => {
    fetch(`/api/v1/odofy/merchants/store/${merchant_slug}/products`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setMerchant(data.merchant);
          setProducts(data.products);
        }
      })
      .catch(() => setError("Failed to load store"))
      .finally(() => setLoading(false));
  }, [merchant_slug]);

  useEffect(() => {
    sessionStorage.setItem(`odofy_cart_${merchant_slug}`, JSON.stringify(cart));
  }, [cart, merchant_slug]);

  // Close the group-cart WebSocket when the storefront unmounts.
  useEffect(() => {
    return () => {
      groupWs?.close();
    };
  }, [groupWs]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.product.id === product.id);
      if (existing) {
        return prev.map((ci) =>
          ci.product.id === product.id ? { ...ci, qty: ci.qty + 1 } : ci
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const handleStartGroupCart = async () => {
    // POST to create group cart
    const res = await fetch(`/api/v1/store/${merchant_slug}/group-cart`, { method: "POST" });
    const data = await res.json();
    if (!data.room_code) return alert("Failed to create group cart");

    setGroupRoomCode(data.room_code);
    setShowGroupCart(true);

    // Connect WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "join_group_cart",
        roomCode: data.room_code,
        userId: groupUserId
      }));
      setGroupJoined(true);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "cart_update") {
        setGroupCartItems(msg.items || []);
      } else if (msg.type === "error") {
        console.error("Group cart error:", msg.message);
      }
    };

    ws.onclose = () => {
      setGroupJoined(false);
    };

    setGroupWs(ws);
  };

  const handleAddToGroup = (product: Product) => {
    if (!groupWs || groupWs.readyState !== WebSocket.OPEN) return;
    groupWs.send(JSON.stringify({
      type: "add_item_to_group",
      roomCode: groupRoomCode,
      userId: groupUserId,
      productId: product.id,
      quantity: 1
    }));
  };

  const cartTotal = cart.reduce(
    (sum, ci) => sum + ci.product.price_cents * ci.qty,
    0
  );

  const handleCheckout = async () => {
    if (!customerName || !deliveryAddress) return;
    if (deliveryMode === 'scheduled' && !scheduledSlot) return;
    setCheckoutSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        items: cart.map((ci) => ({
          product_id: ci.product.id,
          qty: ci.qty,
        })),
      };
      if (deliveryMode === 'scheduled' && scheduledSlot) {
        payload.is_scheduled = true;
        payload.scheduled_window_start = scheduledSlot;
        // Window ends 1 hour after start
        payload.scheduled_window_end = new Date(new Date(scheduledSlot).getTime() + 3600000).toISOString();
      }
      const res = await fetch(
        `/api/v1/odofy/merchants/store/${merchant_slug}/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (data.success) {
        setOrderNumber(data.order.order_number);
        setOrderComplete(true);
        setCart([]);
        setShowCheckout(false);
      } else {
        alert(data.error || "Checkout failed");
      }
    } catch {
      alert("Checkout failed. Please try again.");
    }
    setCheckoutSubmitting(false);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-500">
        Loading store…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-red-600 font-bold text-lg mb-4">{error}</p>
        <Link
          to="/store"
          className="text-[#5E0009] underline font-semibold"
        >
          ← Back to all stores
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <Link
              to="/store"
              className="text-sm text-gray-500 hover:text-[#5E0009]"
            >
              ← All Stores
            </Link>
            <h1 className="text-xl font-black text-gray-800 mt-1">
              {merchant?.business_name || "Store"}
            </h1>
          </div>
          {cart.length > 0 && (
            <div className="text-sm font-bold text-[#5E0009]">
              🛒 {cart.reduce((s, ci) => s + ci.qty, 0)} items
            </div>
          )}
        </div>
      </div>

      {/* Order complete banner */}
      {orderComplete && (
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-green-800 font-bold text-lg">
              ✅ Order Placed!
            </p>
            <p className="text-green-700 text-sm">
              Order #{orderNumber} — A driver will be assigned shortly.
            </p>
          </div>
        </div>
      )}

      {/* Product grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Group order cart */}
        <button
          onClick={handleStartGroupCart}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm mb-4 transition-all"
        >
          👥 Start a Group Order Cart
        </button>
        {showGroupCart && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 my-2 text-center">
            <p className="text-xs font-semibold text-gray-700">
              Invite code: <span className="text-[#5E0009] font-black text-sm tracking-widest">{groupRoomCode}</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {groupJoined ? "🟢 Connected — share this code!" : "⏳ Connecting..."}
            </p>
          </div>
        )}
        {showGroupCart && groupCartItems.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4">
            <h4 className="text-xs font-bold text-gray-500 mb-2">🛒 Group Cart ({groupCartItems.length} items)</h4>
            {groupCartItems.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-700">
                  {item.title} <span className="text-gray-400">x{item.quantity}</span>
                </span>
                <span className="font-bold text-[#5E0009]">
                  ${((item.price_cents * item.quantity) / 100).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-black mt-2 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span className="text-[#5E0009]">
                ${(groupCartItems.reduce((s: number, i: any) => s + i.price_cents * i.quantity, 0) / 100).toFixed(2)}
              </span>
            </div>
          </div>
        )}
        {showGroupCart && (
          <button
            onClick={() => {
              groupWs?.close();
              setShowGroupCart(false);
              setGroupRoomCode("");
              setGroupCartItems([]);
              setGroupJoined(false);
            }}
            className="w-full text-xs text-red-500 font-semibold py-2 hover:text-red-700 mb-4"
          >
            Leave Group
          </button>
        )}
        {products.length === 0 ? (
          <p className="text-center text-gray-400 py-16">
            No products available yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md ${
                  !product.in_stock ? "opacity-60" : ""
                }`}
              >
                <div className="relative">
                  <img
                    src={
                      product.image_url || '/assets/images/default-item-placeholder.png'
                    }
                    alt={product.title}
                    className="w-full h-40 object-cover rounded-xl"
                  />
                  {!product.in_stock && (
                    <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                      Sold Out
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-gray-800 text-sm truncate">
                    {product.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                    {product.description}
                  </p>
                  <p className="text-[#5E0009] font-black text-lg mt-2">
                    ${(product.price_cents / 100).toFixed(2)}
                  </p>
                  {product.in_stock ? (
                    <button
                      onClick={() => (showGroupCart ? handleAddToGroup(product) : addToCart(product))}
                      className="w-full bg-[#5E0009] hover:bg-[#4a0007] text-white font-extrabold py-2.5 px-4 rounded-xl text-xs mt-3 shadow-sm transition-all active:scale-[0.98]"
                    >
                      + Add to Bag
                    </button>
                  ) : (
                    <button disabled className="w-full bg-gray-100 text-gray-400 font-bold py-2.5 px-4 rounded-xl text-xs mt-3 cursor-not-allowed">
                      Sold Out
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky checkout bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-40">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                🛒 {cart.reduce((s, ci) => s + ci.qty, 0)} items
              </p>
              <p className="text-xl font-black text-gray-800">
                ${(cartTotal / 100).toFixed(2)}
              </p>
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              className="bg-[#5E0009] text-white font-bold py-3 px-8 rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              Checkout →
            </button>
          </div>
        </div>
      )}

      {/* Checkout modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-lg font-black text-gray-800 mb-1">
              🔒 Secure Checkout
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Enter your details to place this order.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Your Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm"
              />
              <input
                type="tel"
                placeholder="Phone Number (optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm"
              />
              <input
                type="text"
                placeholder="Delivery Address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm"
              />
              {/* Delivery mode toggle */}
              <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
                <button
                  onClick={() => setDeliveryMode('now')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    deliveryMode === 'now'
                      ? 'bg-[#5E0009] text-white shadow'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🚀 Deliver Now
                </button>
                <button
                  onClick={() => setDeliveryMode('scheduled')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    deliveryMode === 'scheduled'
                      ? 'bg-[#5E0009] text-white shadow'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📅 Schedule for Later
                </button>
              </div>
              {deliveryMode === 'scheduled' && (
                <select
                  value={scheduledSlot}
                  onChange={(e) => setScheduledSlot(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white"
                >
                  <option value="">Select a delivery window…</option>
                  {timeSlots.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              )}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm text-gray-600">
                  {cart.reduce((s, ci) => s + ci.qty, 0)} items · $
                  {(cartTotal / 100).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckout}
                disabled={checkoutSubmitting || !customerName || !deliveryAddress || (deliveryMode === 'scheduled' && !scheduledSlot)}
                className="flex-1 bg-[#5E0009] text-white font-bold py-3 rounded-xl disabled:opacity-50"
              >
                {checkoutSubmitting ? "Placing Order…" : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/store/$merchant_slug")({
  component: StorePage,
});
