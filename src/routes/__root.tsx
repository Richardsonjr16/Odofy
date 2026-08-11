import { useState, useEffect, useRef } from 'react'
import { Link, Outlet, HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Odofy — Delivery Routing Platform" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => <div>Page not found</div>,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <RootLayout />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  const [isResourcesOpen, setIsResourcesOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const loginRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (loginRef.current && !loginRef.current.contains(e.target as Node)) {
        setLoginOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 antialiased font-sans">
      {/* Premium Global Navigation Header */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 backdrop-blur-md bg-white/90">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between relative">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center">
            <img src="/Odofy_Embroidery.png" alt="Odofy" className="h-[72px] w-auto" />
          </Link>

          {/* Center Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-xs font-bold text-gray-600">
            <Link to="/overview" className="hover:text-gray-900 transition-colors">Platform Overview</Link>
            
            {/* Interactive Resources Dropdown Menu Link */}
            <div 
              className="relative cursor-pointer py-2"
              onMouseEnter={() => setIsResourcesOpen(true)}
              onMouseLeave={() => setIsResourcesOpen(false)}
            >
              <span className={`hover:text-gray-900 transition-colors flex items-center gap-1 ${isResourcesOpen ? 'text-gray-900' : ''}`}>
                Resources <span className="text-[9px] text-gray-400">▼</span>
              </span>

              {isResourcesOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl p-2 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  <Link 
                    to="/compare/flat-fee-vs-commission" 
                    className="p-2.5 hover:bg-red-50/40 rounded-lg text-left transition-colors block text-gray-700 hover:text-[#800020]"
                  >
                    <span className="block font-black text-[11px] mb-0.5">Compare Platforms</span>
                    <span className="block text-[10px] text-gray-400 font-medium">Flat-Fee vs. Commissions Matrix</span>
                  </Link>
                  <a 
                    href="/calculator.html" 
                    className="p-2.5 hover:bg-red-50/40 rounded-lg text-left transition-colors block text-gray-700 hover:text-[#800020]"
                  >
                    <span className="block font-black text-[11px] mb-0.5">Savings Calculator</span>
                    <span className="block text-[10px] text-gray-400 font-medium">Compute Your Real Leakage Metrics</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Right: Login Dropdown */}
          <div className="relative" ref={loginRef}>
            <button
              onClick={() => setLoginOpen(!loginOpen)}
              className="rounded-lg bg-[#800020] px-5 py-2 text-sm font-medium text-white hover:bg-[#5a0016]"
            >
              Login
            </button>
            {loginOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-lg z-50">
                <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-800">
                  Sign In to Your Dashboard
                </div>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setLoginOpen(false)}
                >
                  🚗 I am a Driver
                </Link>
                <Link
                  to="/merchant-login"
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-b-xl transition-colors"
                  onClick={() => setLoginOpen(false)}
                >
                  🏪 I am a Merchant
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Primary Application Body Routing Workspace */}
      <div className="flex-grow">
        <Outlet />
      </div>

      {/* Structured Corporate Multi-Column Footer Grid Block */}
      <footer className="bg-white border-t border-gray-100 pt-12 pb-6 mt-auto">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Column 1: Brand Capsule */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <Link to="/" className="inline-block">
              <img src="/Odofy_Embroidery.png" alt="Odofy" className="h-[48px] w-auto" />
            </Link>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed max-w-xs">
              Own your delivery routes. Retain your customer records. Protect your local Springfield business profit margins upfront.
            </p>
          </div>

          {/* Column 2: Core Platform Links */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Product Channels</h4>
            <ul className="text-xs font-semibold text-gray-600 space-y-2">
              <li><Link to="/" className="hover:text-[#800020] transition-colors">Merchant Dashboard</Link></li>
              <li><a href="/calculator.html" className="hover:text-[#800020] transition-colors">Shopify Webhooks Integration</a></li>
              <li><Link to="/" className="hover:text-[#800020] transition-colors">Driver Fleet Portal</Link></li>
            </ul>
          </div>

          {/* Column 3: Asset Resource Submenus */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Resources</h4>
            <ul className="text-xs font-semibold text-gray-600 space-y-2">
              <li><Link to="/compare/flat-fee-vs-commission" className="hover:text-[#800020] transition-colors">Compare Platforms</Link></li>
              <li><a href="/calculator.html" className="hover:text-[#800020] transition-colors">Savings Calculator</a></li>
              <li><Link to="/compare/flat-fee-vs-commission" className="hover:text-[#800020] transition-colors">Flat-Fee Operations Guide</Link></li>
            </ul>
          </div>

          {/* Column 4: Compliance and Legal Tags */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Legal Compliance</h4>
            <ul className="text-xs font-semibold text-gray-600 space-y-2">
              <li><span className="text-green-600 font-bold block text-[11px]">✓ A2P 10DLC Verified Campaign</span></li>
              <li><Link to="/" className="hover:text-[#800020] transition-colors">Driver Privacy Statement</Link></li>
              <li><Link to="/" className="hover:text-[#800020] transition-colors">Terms of Operations Service</Link></li>
            </ul>
          </div>
        </div>

        {/* Global Trademark Legal Strip Banner */}
        <div className="max-w-6xl mx-auto px-6 border-t border-gray-50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center sm:text-left">
          <span>&copy; {new Date().getFullYear()} Odofy Logistics, LLC. All rights reserved.</span>
          <span className="font-medium text-gray-300 normal-case tracking-normal">Delivery routing structures engineered flatly in Springfield, MO</span>
        </div>
      </footer>
    </div>
  )
}
