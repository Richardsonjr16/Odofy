import { useEffect, useState } from "react";

const ACTIVE_COLOR = "#5E0009";
const INACTIVE_COLOR = "#707478";

interface NavItem {
  label: string;
  icon: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Home", icon: "🏠", href: "/dashboard" },
  { label: "Trips", icon: "⏱", href: "/dashboard?tab=trips" },
  { label: "Earnings", icon: "💰", href: "/earnings-history" },
  { label: "Notifications", icon: "🔔", href: "/notifications" },
  { label: "More", icon: "⋯", href: "/profile-menu" },
];

export default function DriverFooter() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPath, setCurrentPath] = useState("");

  useEffect(() => {
    setCurrentPath(window.location.pathname + window.location.search);
    const token = sessionStorage.getItem("odofy_driver_token");
    if (token) {
      fetch("/api/v1/odofy/drivers/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setUnreadCount(data.filter((n: { is_read?: boolean }) => !n.is_read).length);
          }
        })
        .catch(() => {});
    }
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-20 bg-white border-t border-gray-100 flex items-center justify-between px-4 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
      {navItems.map((item) => {
        const isActive = currentPath === item.href;
        return (
          <a
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1"
            style={{ color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR }}
          >
            <span className="relative text-xl leading-none">
              {item.icon}
              {item.label === "Notifications" && unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
            <span className="text-[10px] font-semibold leading-none">
              {item.label}
            </span>
          </a>
        );
      })}
    </footer>
  );
}
