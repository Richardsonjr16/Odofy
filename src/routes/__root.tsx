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
            <Link to="/compare/flat-fee-vs-commission" className="hover:text-gray-900 transition-colors">Compare Platforms</Link>
            <Link to="/calculator" className="hover:text-gray-900 transition-colors">Savings Calculator</Link>
          </div>

          {/* Right Core Action Button Container (Slate/Navy Border Outline applied) */}
          <div className="flex items-center gap-3">
            <Link 
              to="/calculator" 
              className="px-4 py-2 border-2 border-slate-700 text-slate-800 font-black text-xs rounded-xl hover:bg-slate-50 transition-all shadow-sm"
            >
              Calculate Savings
            </Link>
            <Link 
              to="/merchant" 
              className="px-4 py-2 bg-[#5E0009] text-white font-bold text-xs rounded-xl hover:bg-[#3a0004] transition-all shadow-md shadow-red-950/10 block"
            >
              Login
            </Link>
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

          {/* Column 2: Core Platform Links (Merchant Dashboard target fixed) */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Product Channels</h4>
            <ul className="text-xs font-semibold text-gray-600 space-y-2">
              <li><Link to="/merchant" className="hover:text-[#5E0009] transition-colors">Merchant Dashboard</Link></li>
              <li><Link to="/overview" className="hover:text-[#5E0009] transition-colors">Shopify Webhooks Integration</Link></li>
              <li><Link to="/" className="hover:text-[#5E0009] transition-colors">Driver Fleet Portal</Link></li>
            </ul>
          </div>

          {/* Column 3: Asset Resource Submenus */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Resources</h4>
            <ul className="text-xs font-semibold text-gray-600 space-y-2">
              <li><Link to="/compare/flat-fee-vs-commission" className="hover:text-[#5E0009] transition-colors">Compare Platforms</Link></li>
              <li><Link to="/calculator" className="hover:text-[#5E0009] transition-colors">Savings Calculator</Link></li>
              <li><Link to="/overview" className="hover:text-[#5E0009] transition-colors">Flat-Fee Operations Guide</Link></li>
            </ul>
          </div>

          {/* Column 4: Compliance and Legal Tags */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Legal Compliance</h4>
            <ul className="text-xs font-semibold text-gray-600 space-y-2">
              <li><span className="text-green-600 font-bold block text-[11px]">✓ A2P 10DLC Verified Campaign</span></li>
              <li><Link to="/" className="hover:text-[#5E0009] transition-colors">Driver Privacy Statement</Link></li>
              <li><Link to="/" className="hover:text-[#5E0009] transition-colors">Terms of Operations Service</Link></li>
            </ul>
          </div>
        </div>

        {/* Global Trademark Legal Strip Banner */}
        <div className="max-w-6xl mx-auto px-6 border-t border-gray-50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center sm:text-left">
          <span>&copy; {new Date().getFullYear()} Odofy. All rights reserved.</span>
          <span className="font-medium text-gray-300 normal-case tracking-normal">Delivery routing structures engineered flatly in Springfield, MO</span>
        </div>
      </footer>
    </div>
  )
}
