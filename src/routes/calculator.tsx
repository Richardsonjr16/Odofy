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

  // Real-time financial calculations
  const totalMonthlyLoss = ((monthlyRevenue * (commissionRate / 100)) + platformFee) * locationsCount
  const totalAnnualLoss = totalMonthlyLoss * 12
  const totalFiveYearLoss = totalAnnualLoss * 5

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased selection:bg-red-100 selection:text-[#5E0009]">
      {/* Page Title & Main Layout Header */}
      <section className="text-center max-w-3xl mx-auto pt-12 pb-8 px-6">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#5E0009] bg-red-50 px-3 py-1 rounded-full border border-red-100">
          Revenue Sovereignty Utility
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mt-4 mb-4">
          Restaurant Online Ordering Savings Calculator
        </h1>
        <p className="text-base text-gray-600 font-medium leading-relaxed">
          See how much you're paying in marketplace commissions — and how much you'd save with an Odofy flat-fee, zero-commission delivery system.
        </p>
      </section>

      {/* Main Dynamic Calculation Box */}
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-24">
        
        {/* Left Side Parameter Form Cards (5 Columns equivalent) */}
        <div className="lg:col-span-5 bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-xl shadow-gray-100/40 space-y-6">
          <h2 className="text-lg font-black tracking-tight text-gray-900 border-b border-gray-50 pb-4">
            Your Current Online Ordering Costs
          </h2>
          
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

        {/* Right Side Results Output (7 Columns equivalent) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl shadow-gray-950/40">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#5E0009]/15 rounded-full blur-3xl pointer-events-none"></div>
            
            <h2 className="text-lg font-black tracking-tight text-white mb-6 border-b border-gray-800 pb-4">
              Your Estimated Costs
            </h2>

            {/* Results Output Grids Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-800/30 rounded-2xl p-4 border border-gray-800/40">
                <span className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Monthly Loss</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-red-400">${Math.round(totalMonthlyLoss).toLocaleString()}</div>
                <span className="block text-[10px] text-gray-500 font-semibold mt-1">Monthly commission cost</span>
              </div>
              
              <div className="bg-gray-800/30 rounded-2xl p-4 border border-gray-800/40">
                <span className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Annual Loss</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-red-400">${Math.round(totalAnnualLoss).toLocaleString()}</div>
                <span className="block text-[10px] text-gray-500 font-semibold mt-1">Annual commission cost</span>
              </div>
              
              <div className="bg-gray-800/30 rounded-2xl p-4 border border-gray-800/40">
                <span className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">5-Year Projection</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-[#CFB500]">${Math.round(totalFiveYearLoss).toLocaleString()}</div>
                <span className="block text-[10px] text-gray-500 font-semibold mt-1">5-year projection</span>
              </div>
            </div>

            <div className="bg-[#5E0009]/10 border border-[#5E0009]/20 rounded-2xl p-4 sm:p-5 flex items-start gap-4">
              <span className="text-2xl mt-0.5">🛡️</span>
              <div>
                <h3 className="font-black text-sm text-white tracking-tight mb-1">With Odofy flat-fee pricing, most of this cost goes back to your restaurant.</h3>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  Contact us for your personalized quote and savings estimate. Because the customer handles the delivery fee directly at check-out, your system commission remains exactly <span className="text-green-400 font-bold">$0.00</span>.
                </p>
              </div>
            </div>
          </div>

          {/* Call to Action Section */}
          <section className="bg-gradient-to-r from-[#5E0009] to-[#3a0004] text-white rounded-3xl p-8 text-center border border-red-950/20 shadow-xl shadow-red-950/10">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">Ready to Stop Paying Commissions?</h2>
            <p className="text-xs text-red-100 max-w-lg mx-auto mb-6 leading-relaxed font-medium">
              Book a free demo and get a custom quote based on your restaurant's actual setup. Remember, your first 5 system deliveries are 100% free!
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link 
                to="/compare/flat-fee-vs-commission" 
                className="w-full sm:w-auto px-6 py-2.5 bg-[#CFB500] text-gray-950 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-[#b09a00] transition-all shadow-md text-center"
              >
                Book a Free Demo
              </Link>
              <Link 
                to="/overview" 
                className="w-full sm:w-auto px-6 py-2.5 bg-transparent border border-red-300 text-white font-bold text-xs rounded-xl hover:bg-white/10 transition-all text-center"
              >
                See How Pricing Works
              </Link>
            </div>
          </section>
        </div>

      </div>
    </div>
  )
}
