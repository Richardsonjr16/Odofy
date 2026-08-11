import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/calculator')({
  component: MerchantCalculatorComponent,
})

function MerchantCalculatorComponent() {
  const [monthlyRevenue, setMonthlyRevenue] = useState(15000)
  const [commissionRate, setCommissionRate] = useState(20)
  const [platformFee, setPlatformFee] = useState(0)
  const [locationsCount, setLocationsCount] = useState(1)
  const [showResults, setShowResults] = useState(false)

  // Real-time financial calculations
  const totalMonthlyLoss = ((monthlyRevenue * (commissionRate / 100)) + platformFee) * locationsCount
  const totalAnnualLoss = totalMonthlyLoss * 12
  const totalFiveYearLoss = totalAnnualLoss * 5

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased">
      {/* Page Title & Subtitle */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-16 pb-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-4">
          Restaurant Online Ordering Savings Calculator
        </h1>
        <p className="text-base text-gray-600 font-medium leading-relaxed">
          See how much you're paying in marketplace commissions — and how much you'd save with an Odofy flat-fee, zero-commission delivery system.
        </p>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Inputs Card — Your Current Online Ordering Costs */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-10 shadow-sm">
          <h2 className="text-xl font-black tracking-tight text-gray-900 mb-8">
            Your Current Online Ordering Costs
          </h2>

          <div className="space-y-6">
            {/* Parameter 1: Revenue */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-black uppercase text-gray-500 tracking-wider">
                  Monthly Online Order Revenue ($)
                </label>
                <input
                  type="number"
                  value={monthlyRevenue}
                  min="0"
                  max="100000"
                  onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                  className="w-24 text-right font-mono font-bold text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-900 focus:outline-none focus:border-[#5E0009] focus:ring-1 focus:ring-[#5E0009]"
                />
              </div>
              <input
                type="range"
                min="1000"
                max="100000"
                step="1000"
                value={monthlyRevenue}
                onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                className="w-full accent-[#5E0009] h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: '#5E0009' }}
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1 font-bold">
                <span>$1,000</span>
                <span>$50,000</span>
                <span>$100,000</span>
              </div>
            </div>

            {/* Parameter 2: Commission Percentage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-black uppercase text-gray-500 tracking-wider">
                  Commission / Marketplace Fee (%)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={commissionRate}
                    min="0"
                    max="40"
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    className="w-16 text-right font-mono font-bold text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-900 focus:outline-none focus:border-[#5E0009] focus:ring-1 focus:ring-[#5E0009]"
                  />
                  <span className="text-xs font-bold text-gray-500">%</span>
                </div>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                step="1"
                value={commissionRate}
                onChange={(e) => setCommissionRate(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: '#5E0009' }}
              />
              <p className="text-[11px] text-gray-400 font-medium mt-1">
                DoorDash / Grubhub / Uber Eats typically charge 15–30%
              </p>
            </div>

            {/* Parameter 3: Platform Fixed Cost */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-black uppercase text-gray-500 tracking-wider">
                  Monthly Platform Fee ($) <span className="text-gray-400 normal-case font-medium">(optional)</span>
                </label>
                <input
                  type="number"
                  value={platformFee}
                  min="0"
                  max="1000"
                  onChange={(e) => setPlatformFee(Number(e.target.value))}
                  className="w-20 text-right font-mono font-bold text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-900 focus:outline-none focus:border-[#5E0009] focus:ring-1 focus:ring-[#5E0009]"
                />
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={platformFee}
                onChange={(e) => setPlatformFee(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: '#5E0009' }}
              />
            </div>

            {/* Parameter 4: Locations Count */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-black uppercase text-gray-500 tracking-wider">
                  Number of Locations
                </label>
                <input
                  type="number"
                  value={locationsCount}
                  min="1"
                  max="10"
                  onChange={(e) => setLocationsCount(Number(e.target.value))}
                  className="w-16 text-right font-mono font-bold text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-900 focus:outline-none focus:border-[#5E0009] focus:ring-1 focus:ring-[#5E0009]"
                />
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={locationsCount}
                onChange={(e) => setLocationsCount(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: '#5E0009' }}
              />
            </div>
          </div>

          <button
            onClick={() => setShowResults(true)}
            className="mt-8 w-full bg-[#5E0009] hover:bg-[#3a0004] text-white font-bold py-4 rounded-lg text-lg transition-colors shadow-md"
          >
            Calculate My Savings
          </button>
        </div>

        {/* Results Card — Your Estimated Costs (revealed on calculate) */}
        <div className={`${showResults ? '' : 'hidden'} bg-neutral-950 text-white rounded-2xl p-8 mb-10 shadow-xl`}>
          <h2 className="text-xl font-black tracking-tight text-white mb-8">
            Your Estimated Costs
          </h2>

          <div className="grid sm:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <div className="text-3xl font-extrabold text-red-400 mb-1">${Math.round(totalMonthlyLoss).toLocaleString()}</div>
              <div className="text-sm text-neutral-400">Monthly commission cost</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-extrabold text-red-300 mb-1">${Math.round(totalAnnualLoss).toLocaleString()}</div>
              <div className="text-sm text-neutral-400">Annual commission cost</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-extrabold text-red-200 mb-1">${Math.round(totalFiveYearLoss).toLocaleString()}</div>
              <div className="text-sm text-neutral-400">5-year projection</div>
            </div>
          </div>

          <div className="bg-[#5E0009]/15 border border-[#5E0009]/30 rounded-xl p-5 text-center">
            <h3 className="font-black text-sm text-white tracking-tight mb-1">
              🛡️ With Odofy flat-fee pricing, most of this cost goes back to your restaurant.
            </h3>
            <p className="text-xs text-gray-400 font-medium leading-relaxed">
              Contact us for your personalized quote and savings estimate. Because the customer handles the delivery fee directly at checkout, your system commission remains exactly <span className="text-green-400 font-bold">$0.00</span>.
            </p>
          </div>
        </div>

        {/* Call to Action Section */}
        <section className="py-16 bg-white rounded-2xl border border-gray-100 text-center">
          <h2 className="text-2xl font-black tracking-tight text-[#5E0009] mb-3">
            Ready to Stop Paying Commissions?
          </h2>
          <p className="text-sm text-gray-600 max-w-lg mx-auto mb-8 leading-relaxed font-medium">
            Book a free demo and get a custom quote based on your restaurant's actual setup. Remember, your first 5 system deliveries are 100% free!
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/compare/flat-fee-vs-commission"
              className="inline-flex items-center justify-center px-8 py-3 bg-[#5E0009] text-white text-sm font-bold rounded-full hover:bg-[#3a0004] transition-colors shadow-md"
            >
              Book a Free Demo
            </Link>
            <Link
              to="/overview"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-slate-700 text-slate-800 text-sm font-bold rounded-full hover:bg-slate-50 transition-colors"
            >
              See How Pricing Works
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
