import { useState, useEffect, useRef } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav className="flex items-center justify-between px-6 py-4 sm:px-8 lg:px-12 border-b border-gray-100 bg-white">
      <a href="/" className="flex items-center">
        <img src="/brand_mark.png" alt="Odofy" className="h-8 w-auto" />
      </a>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg bg-msu-maroon px-5 py-2 text-sm font-medium text-white hover:bg-msu-maroon/80"
        >
          Login
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-lg z-50">
            <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-800">
              Sign In to Your Dashboard
            </div>
            <a
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              🚗 I am a Driver
            </a>
            <a
              href="/merchant-login"
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-b-xl transition-colors"
              onClick={() => setOpen(false)}
            >
              🏪 I am a Merchant
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
