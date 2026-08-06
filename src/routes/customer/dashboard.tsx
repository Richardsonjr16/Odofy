import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "bot";
  text: string;
}

function CustomerDashboard() {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", text: "Hi! I'm the Odofy Shield support bot. I can help track your order or report issues. How can I help?" },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/v1/customer/support/chat-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: "Customer", message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "bot", text: data.reply || "Sorry, I couldn't process that." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="mb-4 text-2xl font-black text-gray-800">Customer Dashboard</h1>
      <p className="mb-8 text-gray-500">Welcome! Use the chat button in the bottom-right corner for support.</p>
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)} aria-label="Open support chat" className="fixed bottom-6 right-6 z-50 rounded-full bg-[#5E0009] p-4 text-white shadow-2xl transition-all hover:scale-105 active:scale-95">
          <span className="text-xl">💬</span>
        </button>
      )}
      {chatOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-96 w-80 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-[#5E0009] p-3 text-xs font-black tracking-wider text-white">
            <span>🐻 ODOFY SHIELD AUTO-SUPPORT</span>
            <button onClick={() => setChatOpen(false)} aria-label="Close support chat" className="text-white hover:text-gray-200">✕</button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((msg, i) => (
              <div key={i} className={`max-w-[85%] rounded-xl p-2 text-xs ${msg.role === "bot" ? "mr-auto bg-gray-100 text-gray-700" : "ml-auto bg-[#5E0009] text-white"}`}>
                {msg.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-2 border-t border-gray-100 p-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Type a message..." className="flex-1 rounded-lg border border-gray-200 p-2 text-xs" />
            <button onClick={handleSend} disabled={sending || !input.trim()} className="rounded-lg bg-[#5E0009] px-3 py-1 text-xs font-bold text-white disabled:opacity-50">{sending ? "..." : "Send"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/customer/dashboard")({ component: CustomerDashboard });
