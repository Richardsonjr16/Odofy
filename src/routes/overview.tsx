import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/overview')({
  component: PlatformOverviewPage,
})

function PlatformOverviewPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased selection:bg-red-100 selection:text-[#5E0009]">
      
      {/* Premium Conversion Hero Headline Hook */}
      <section className="bg-gradient-to-br from-[#5E0009] to-[#3a0004] text-white py-16 sm:py-24 relative overflow-hidden px-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#CFB500] bg-white/5 border border-white/10 px-3 py-1 rounded-full">
            B2B Delivery Infrastructure
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mt-5 mb-6 leading-tight">
            Your Restaurant's Delivery Fleet — Not Someone Else's Marketplace
          </h1>
          <p className="text-sm sm:text-base text-red-100/90 font-medium leading-relaxed max-w-2xl mx-auto mb-8">
            Odofy is a zero-commission, flat-fee delivery dispatch platform for Springfield kitchens. Accept standard, catering, and automated orders straight from your website—without paying a 15–30% percentage tax to third-party delivery apps.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link 
              to="/compare/flat-fee-vs-commission" 
              className="w-full sm:w-auto px-6 py-3 bg-[#CFB500] text-gray-950 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-[#b09a00] transition-all shadow-lg shadow-black/20 text-center"
            >
              Calculate Savings
            </Link>
            <a 
              href="/calculator.html" 
              className="w-full sm:w-auto px-6 py-3 bg-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/20 border border-white/20 transition-all text-center"
            >
              See Pricing Structures
            </a>
          </div>
        </div>
      </section>

      {/* Feature Row Checklist Summary */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl font-black tracking-tight text-gray-900">Everything Contained in One Branded System</h2>
          <p className="text-xs text-gray-500 font-medium mt-1">Odofy configures custom digital ordering capabilities cleanly around your brand.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
            <div className="text-lg">⊘</div>
            <span className="block font-bold text-xs text-gray-800 mt-1">Zero Commission Fees</span>
          </div>
          <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
            <div className="text-lg">🚚</div>
            <span className="block font-bold text-xs text-gray-800 mt-1">Catering & Local Dispatch</span>
          </div>
          <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
            <div className="text-lg">🔌</div>
            <span className="block font-bold text-xs text-gray-800 mt-1">Shopify Webhooks Built-in</span>
          </div>
          <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
            <div className="text-lg">📊</div>
            <span className="block font-bold text-xs text-gray-800 mt-1">You Own All Customer Data</span>
          </div>
        </div>
      </section>

      {/* Multi-Channel Execution Section */}
      <section className="bg-white border-y border-gray-100 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl font-black tracking-tight text-gray-900">Every Dispatch Route Channel, One Dashboard</h2>
            <p className="text-xs text-gray-500 font-medium mt-1">Configure independent rules and pricing parameters based on delivery volume metrics.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Channel 1: Standard Delivery */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-3">
              <span className="text-xl">🛵</span>
              <h3 className="font-black text-sm text-gray-900 tracking-tight">Local Delivery Sprints</h3>
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                Set custom delivery radius maps and dispatch student couriers instantly. The customer pays a transparent, flat delivery processing fee at checkout, meaning your ticket margin stays pristine.
              </p>
            </div>

            {/* Channel 2: Large Catering */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-3">
              <span className="text-xl">🍱</span>
              <h3 className="font-black text-sm text-gray-900 tracking-tight">Catering Order Volume</h3>
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                Manage large-scale orders with custom extended lead times. Supports explicit payment deposit configurations and customized item configurations without cluttering your main storefront lines.
              </p>
            </div>

            {/* Channel 3: Automated API Webhooks */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-3">
              <span className="text-xl">⚡</span>
              <h3 className="font-black text-sm text-gray-900 tracking-tight">45-Second Webhook Links</h3>
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                Connect Odofy straight into your existing Shopify storefront setup using a fast, automated webhook. Orders route directly into our system lines without adding heavy software configuration overhead.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Strategic B2B FAQ Bracket Rows */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-xl font-black tracking-tight text-gray-900 mb-8 text-center">Frequently Asked Questions</h2>
        <div className="space-y-6 divide-y divide-gray-100">
          
          <div className="pt-4">
            <h3 className="font-bold text-sm text-gray-900 mb-1">What makes Odofy different from marketplace delivery apps?</h3>
            <p className="text-xs text-gray-600 font-medium leading-relaxed">
              Predatory third-party apps charge massive commissions per order and cross-advertise your rivals on your menu matrix pages. Odofy is a zero-commission flat software system—your custom menu links belong exclusively to your brand, and you own 100% of your guest data asset values.
            </p>
          </div>

          <div className="pt-6">
            <h3 className="font-bold text-sm text-gray-900 mb-1">How do our couriers clear counter space so efficiently?</h3>
            <p className="text-xs text-gray-600 font-medium leading-relaxed">
              Our courier fleet utilizes localized, high-speed university student networks right here in the Springfield corridor loop. Dispatch loops initialize immediately on order completion to secure lightning-fast door-to-door transit times.
            </p>
          </div>

          <div className="pt-6">
            <h3 className="font-bold text-sm text-gray-900 mb-1">Can Odofy operate standalone without complex point-of-sale setups?</h3>
            <p className="text-xs text-gray-600 font-medium leading-relaxed">
              Yes, entirely. Odofy functions flawlessly as a standalone delivery utility. Orders can print or log directly into your dashboard view panels without requiring you to modify or reprogram any legacy kitchen register hardware.
            </p>
          </div>

        </div>
      </section>

      {/* High-Conversion Bottom CTA Banner */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-gradient-to-r from-[#5E0009] to-[#3a0004] text-white rounded-3xl p-6 sm:p-8 text-center border border-red-950/20 shadow-xl shadow-red-950/10">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">Claim Your Margin Protection Layer</h2>
          <p className="text-xs text-red-100/90 max-w-md mx-auto mb-6 font-medium leading-relaxed">
            Onboard your kitchen link channels today completely for free upfront. Remember, your first 5 system deliveries are 100% free!
          </p>
          <div className="flex gap-3 justify-center items-center">
            <Link 
              to="/compare/flat-fee-vs-commission" 
              className="px-6 py-2.5 bg-[#CFB500] text-gray-950 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-[#b09a00] transition-all shadow-md"
            >
              Secure Your Storefront Link
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
