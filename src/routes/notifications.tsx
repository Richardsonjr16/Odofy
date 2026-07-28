import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import DriverFooter from "../components/DriverFooter";

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;
  if (diffSec < 172800) return "Yesterday";
  const days = Math.floor(diffSec / 86400);
  return `${days} days ago`;
}

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("odofy_driver_token");
    if (!token) {
      setError("Driver token required.");
      setLoading(false);
      return;
    }
    fetch("/api/v1/odofy/drivers/notifications", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Notification[]) => setNotifications(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-dvh bg-gray-50 pb-24">
      <header className="bg-msu-maroon px-6 py-6">
        <h1 className="text-xl font-bold text-white">Notifications</h1>
      </header>

      <main className="px-4 pt-6 space-y-3">
        {loading && (
          <p className="text-center text-gray-400 py-12">Loading…</p>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {!loading &&
          !error &&
          notifications.map((n) => (
            <div
              key={n.id}
              className="flex gap-3 rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="mt-1 flex-shrink-0">
                {n.is_read ? (
                  <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                ) : (
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-charcoal text-sm">
                  {n.title}
                </p>
                <p className="mt-0.5 text-sm text-gray-500">{n.body}</p>
                <p className="mt-1.5 text-xs text-gray-400">
                  {relativeTime(n.created_at)}
                </p>
              </div>
            </div>
          ))}
        {!loading && !error && notifications.length === 0 && (
          <p className="text-center text-gray-400 py-12">
            No notifications yet.
          </p>
        )}
      </main>

      <DriverFooter />
    </div>
  );
}
