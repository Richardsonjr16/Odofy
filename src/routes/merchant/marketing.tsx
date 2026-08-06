import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const MSU_MAROON = "#5E0009";
const API = "/api/v1/merchant/marketing";

type ChannelType = "PUSH" | "SMS" | "EMAIL";
type AudienceSegment = "ALL" | "LAPSED" | "VIP";

interface Campaign {
  id: string;
  title: string;
  channel_type: ChannelType;
  audience_segment: AudienceSegment;
  message_body: string;
  discount_code: string | null;
  status: "DRAFT" | "SENT";
  sent_at: string | null;
  created_at: string;
}

const CHANNEL_LIMITS: Record<ChannelType, number> = {
  PUSH: 160,
  SMS: 160,
  EMAIL: 5000,
};

function MarketingPage() {
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [channelType, setChannelType] = useState<ChannelType>("SMS");
  const [audienceSegment, setAudienceSegment] = useState<AudienceSegment>("ALL");
  const [messageBody, setMessageBody] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const e =
      typeof window !== "undefined"
        ? sessionStorage.getItem("merchant_email") || ""
        : "";
    setEmail(e);
    if (!e && typeof window !== "undefined") window.location.href = "/merchant-login";
  }, []);

  const headers = { "Content-Type": "application/json", "X-Merchant-Email": email };

  const loadCampaigns = async () => {
    if (!email) return;
    try {
      const res = await fetch(`${API}/campaigns`, { headers });
      if (!res.ok) throw new Error("Could not load campaign history");
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load campaign history");
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [email]);

  const maxLength = CHANNEL_LIMITS[channelType];
  const charsRemaining = maxLength - messageBody.length;

  const sendCampaign = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    setNotice("");
    if (!title.trim() || !messageBody.trim()) {
      setError("Title and message body are required");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API}/broadcast`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title.trim(),
          channel_type: channelType,
          audience_segment: audienceSegment,
          message_body: messageBody.trim(),
          discount_code: discountCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not send campaign");
      }
      const sent = data.campaign;
      setNotice(
        `Campaign "${title.trim()}" sent to ${sent.recipient_count} recipient${
          sent.recipient_count === 1 ? "" : "s"
        }${sent.failures.length ? ` (${sent.failures.length} failure${sent.failures.length === 1 ? "" : "s"})` : ""}.`
      );
      setTitle("");
      setMessageBody("");
      setDiscountCode("");
      loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send campaign");
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    "w-full border border-gray-200 rounded-xl p-4 text-sm focus:border-[#5E0009] focus:outline-none";
  const labelCls = "block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5";

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl border border-gray-50 shadow-xl my-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-gray-800">📣 Store Marketing &amp; CRM Hub</h1>
          <a
            href="/merchant/dashboard"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            ← Back to Dashboard
          </a>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        {notice && (
          <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>
        )}

        {/* ── CAMPAIGN COMPOSITION ── */}
        <form onSubmit={sendCampaign} className="grid gap-4 rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
          <div>
            <label className={labelCls}>Campaign Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekend Flash Sale"
              maxLength={120}
              className={inputCls}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Channel</label>
              <select
                value={channelType}
                onChange={(e) => setChannelType(e.target.value as ChannelType)}
                className={inputCls}
              >
                <option value="PUSH">Push Notification</option>
                <option value="SMS">SMS (Text Message)</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Audience Segment</label>
              <select
                value={audienceSegment}
                onChange={(e) => setAudienceSegment(e.target.value as AudienceSegment)}
                className={inputCls}
              >
                <option value="ALL">All Customers</option>
                <option value="LAPSED">Lapsed (30+ days)</option>
                <option value="VIP">VIP / High Value</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Message Body</label>
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Type your broadcast message text details here..."
              maxLength={maxLength}
              rows={5}
              className={`${inputCls} resize-y`}
            />
            <p
              className={`mt-1 text-right text-xs font-medium ${
                charsRemaining < 20 ? "text-red-500" : "text-gray-400"
              }`}
            >
              {charsRemaining} characters remaining
            </p>
          </div>

          <div>
            <label className={labelCls}>Discount Code (optional)</label>
            <input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder="e.g. FRESH15"
              maxLength={40}
              className={inputCls}
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-[#5E0009] px-5 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#4a0007] disabled:opacity-50 shadow-md"
          >
            {sending ? "Sending…" : "🚀 Send Campaign"}
          </button>
        </form>

        {/* ── CAMPAIGN HISTORY ── */}
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-gray-800">Campaign History</h2>
          {campaigns.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-8 text-center text-sm text-gray-400">
              No campaigns yet. Compose your first broadcast above.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Audience</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{c.title}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          {c.channel_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{c.audience_segment}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {c.sent_at ? new Date(c.sent_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: Campaign["status"] }) {
  const styles =
    status === "SENT"
      ? "bg-green-100 text-green-700"
      : "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {status}
    </span>
  );
}

export const Route = createFileRoute("/merchant/marketing")({
  component: MarketingPage,
});
