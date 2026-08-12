import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/contact')({
  component: ContactPage,
})

function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    restaurant_name: '',
    email: '',
    phone: '',
    locations: '',
    current_provider: '',
    message: '',
    website: '', // honeypot — real users never see/fill this
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const setField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Honeypot: silently drop bot submissions without hitting the backend.
    if (form.website) {
      setSubmitted(true)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/v1/odofy/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          restaurant_name: form.restaurant_name,
          email: form.email,
          phone: form.phone,
          locations: form.locations || undefined,
          current_provider: form.current_provider || undefined,
          message: form.message || undefined,
        }),
      })
      if (!res.ok) throw new Error('Request failed')
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#5E0009] focus:border-[#5E0009]'
  const labelClass = 'block text-xs font-black uppercase text-gray-500 tracking-wider mb-1.5'

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-16 pb-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-4">
          Book a Free Demo
        </h1>
        <p className="text-base text-gray-600 font-medium leading-relaxed max-w-2xl mx-auto">
          See Odofy in action. We'll show you how it works, answer your questions, and give you a
          custom quote — no pressure, no commitment.
        </p>
      </section>

      {/* Form + Side Cards */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid lg:grid-cols-5 gap-16">
          {/* LEFT — Form */}
          <div className="lg:col-span-3">
            {submitted ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
                <div className="text-4xl mb-4">🎉</div>
                <h3 className="text-xl font-black tracking-tight text-gray-900 mb-2">
                  Demo Request Received
                </h3>
                <p className="text-sm text-gray-600 font-medium leading-relaxed">
                  We'll reach out within one business day to schedule your personalized walkthrough.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-black tracking-tight text-gray-900 mb-8">
                  Tell Us About Your Restaurant
                </h2>
                <form onSubmit={handleSubmit} noValidate={false}>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="demo-name" className={labelClass}>
                        Your Name *
                      </label>
                      <input
                        id="demo-name"
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setField('name', e.target.value)}
                        className={inputClass}
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div>
                      <label htmlFor="demo-restaurant" className={labelClass}>
                        Restaurant / Company Name *
                      </label>
                      <input
                        id="demo-restaurant"
                        type="text"
                        required
                        value={form.restaurant_name}
                        onChange={(e) => setField('restaurant_name', e.target.value)}
                        className={inputClass}
                        placeholder="The Corner Bistro"
                      />
                    </div>
                    <div>
                      <label htmlFor="demo-email" className={labelClass}>
                        Email Address *
                      </label>
                      <input
                        id="demo-email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setField('email', e.target.value)}
                        className={inputClass}
                        placeholder="you@restaurant.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="demo-phone" className={labelClass}>
                        Phone Number *
                      </label>
                      <input
                        id="demo-phone"
                        type="tel"
                        required
                        value={form.phone}
                        onChange={(e) => setField('phone', e.target.value)}
                        className={inputClass}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <label htmlFor="demo-locations" className={labelClass}>
                        Number of Locations
                      </label>
                      <select
                        id="demo-locations"
                        value={form.locations}
                        onChange={(e) => setField('locations', e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select...</option>
                        <option value="1 location">1 location</option>
                        <option value="2–5 locations">2–5 locations</option>
                        <option value="6–20 locations">6–20 locations</option>
                        <option value="20+ locations">20+ locations</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="demo-provider" className={labelClass}>
                        Current Online Ordering Provider
                      </label>
                      <input
                        id="demo-provider"
                        type="text"
                        value={form.current_provider}
                        onChange={(e) => setField('current_provider', e.target.value)}
                        className={inputClass}
                        placeholder="e.g. DoorDash, none, etc."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="demo-message" className={labelClass}>
                        Anything else we should know?
                      </label>
                      <textarea
                        id="demo-message"
                        rows={4}
                        value={form.message}
                        onChange={(e) => setField('message', e.target.value)}
                        className={inputClass}
                        placeholder="Your POS system, delivery setup, questions..."
                      />
                    </div>
                  </div>

                  {/* Honeypot — hidden from real users */}
                  <input
                    type="text"
                    name="website"
                    value={form.website}
                    onChange={(e) => setField('website', e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="hidden"
                  />

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full mt-8 py-4 bg-[#5E0009] hover:bg-[#3a0004] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Sending…' : 'Request My Free Demo →'}
                  </button>
                  <p className="text-xs text-gray-500 font-medium text-center mt-3">
                    We'll respond within one business day. No spam, ever.
                  </p>
                  {error && (
                    <p className="mt-4 text-sm text-red-600 font-bold text-center">{error}</p>
                  )}
                </form>
              </>
            )}
          </div>

          {/* RIGHT — Side cards */}
          <div className="lg:col-span-2 space-y-8">
            {/* What Happens Next */}
            <div className="bg-neutral-50 rounded-2xl p-8">
              <h3 className="text-lg font-black tracking-tight text-gray-900 mb-6">
                What Happens Next
              </h3>
              <ol className="space-y-6">
                {[
                  {
                    title: 'We receive your request',
                    body: 'We review your restaurant type, location count, and current delivery setup.',
                  },
                  {
                    title: 'Schedule a call',
                    body: 'We reach out within one business day to find a time that works.',
                  },
                  {
                    title: 'Live demo',
                    body: 'We walk you through the Odofy platform with your own menu as an example.',
                  },
                  {
                    title: 'Custom quote',
                    body: 'You get a flat-fee quote specific to your restaurant — no surprises.',
                  },
                ].map((step, i) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5E0009] text-white text-sm font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-bold text-sm text-gray-900">{step.title}</p>
                      <p className="text-sm text-gray-600 font-medium leading-relaxed mt-0.5">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Why Odofy? */}
            <div className="bg-neutral-50 rounded-2xl p-8">
              <h3 className="text-lg font-black tracking-tight text-gray-900 mb-5">Why Odofy?</h3>
              <ul className="space-y-3">
                {[
                  'No commissions on orders',
                  'You own your customer data',
                  'Branded ordering experience',
                  'Real support from real people',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700 font-medium">
                    <span className="text-green-600 font-bold">✅</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Get started now */}
            <div className="bg-neutral-50 rounded-2xl p-8">
              <h3 className="text-lg font-black tracking-tight text-gray-900 mb-2">
                Prefer to get started now?
              </h3>
              <p className="text-sm text-gray-600 font-medium mb-5">
                Create your merchant account in minutes and start taking delivery orders today.
              </p>
              <Link
                to="/merchant-signup"
                className="inline-flex items-center justify-center w-full px-6 py-3 border-2 border-[#5E0009] text-[#5E0009] text-sm font-bold rounded-lg hover:bg-[#5E0009] hover:text-white transition-colors"
              >
                Create Your Account →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
