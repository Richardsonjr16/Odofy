import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/terms-of-operations-service')({
  component: TermsOfOperationsServiceComponent,
})

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-600 font-medium leading-relaxed mb-3">{children}</p>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-black tracking-tight text-[#5E0009] mb-3">{title}</h2>
      <div>{children}</div>
    </section>
  )
}

function TermsOfOperationsServiceComponent() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-4">
        <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">
          Last Updated: August 11, 2026
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-4">
          Odofy, LLC — Terms of Operations Service
        </h1>
        <P>
          Welcome to Odofy, LLC (&quot;Odofy,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). These Terms of
          Operations Service (&quot;Terms&quot;) govern the relationship, operational protocols, and platform access
          between Odofy, participating merchant partners (&quot;Merchants&quot;), end-line consumers
          (&quot;Customers&quot;), and decentralized independent student couriers (&quot;Couriers&quot;). By registering
          an account, utilizing our software layers, or initiating an automated data webhook transmission
          at getodofy.com, you explicitly agree to comply with and be bound by these Terms.
        </P>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <Section title="1. Scope of Infrastructure Service">
            <P>
              Odofy operates exclusively as a decentralized, hyperlocal logistics software and dispatch
              routing provider. Odofy does not own physical transport vehicles, operate centralized
              fulfillment warehouses, or prepare food items. Our software acts as a real-time routing
              corridor that automatically parses transactional metadata from integrated merchant digital
              properties and transmits dispatch telemetry requests to an independent, localized network of
              student courier networks.
            </P>
          </Section>

          <Section title="2. Financial Framework & Zero-Commission Model">
            <P>
              Odofy is fundamentally built upon a zero-commission revenue protection philosophy to
              safeguard independent brick-and-mortar storefront profit margins.
            </P>
            <P>
              <strong>Merchant Commissions:</strong> Odofy assesses exactly 0% commission fees against the
              merchant&apos;s kitchen menu subtotals. Merchants retain 100% of their gross retail pricing
              parameters as configured on their independent e-commerce nodes.
            </P>
            <P>
              <strong>Consumer Logistics Fee:</strong> A transparent, non-volatile flat processing and
              delivery dispatch fee of $8.50 is assessed directly to the Customer at the digital checkout
              interface layout line.
            </P>
            <P>
              <strong>Courier Remittance:</strong> From the baseline customer processing fee, a flat
              contractual fulfillment rate of $6.50 is seamlessly funneled directly to the dispatched
              independent Courier upon verified door-to-door transit completion.
            </P>
          </Section>

          <Section title="3. Hyperlocal Courier Fleet & Dispatches">
            <P>
              The courier fleet infrastructure supporting the Odofy platform consists entirely of active
              university student operators acting as independent third-party logistics contractors.
            </P>
            <P>
              <strong>Contractual Status:</strong> Couriers are not employees, agents, or joint-venture
              partners of Odofy or participating Merchants. Couriers retain absolute structural control
              over their operational schedules, vehicle choices, and specific route acceptance parameters.
            </P>
            <P>
              <strong>The .edu Window Restriction:</strong> To maintain strict delivery quality standards,
              certain peak order queues implement a rolling 2-minute competitive head-start routing window
              accessible exclusively by verified active university student email profiles (.edu).
            </P>
          </Section>

          <Section title="4. Data Ownership, Integrity & Telemetry Privacy">
            <P>
              Odofy respects the digital sovereignty of our merchant partners and holds user privacy to
              strict legal and mobile carrier compliance benchmarks.
            </P>
            <P>
              <strong>First-Party Data Ownership:</strong> Unlike traditional marketplace applications,
              Odofy does not intercept, hoard, or hold guest identity records hostage. All Customer
              checkout profiles, emails, phone contacts, and purchase patterns remain 100% owned by and
              accessible to the originating Merchant via native Shopify webhook synchronizations.
            </P>
            <P>
              <strong>The 48-Hour Data Vaporization Protocol:</strong> To guarantee absolute user privacy,
              precise background and foreground geographical coordinates and vehicle velocities tracked
              during active routing loops are permanently scrubbed, anonymized, and deleted from live
              database tracking logs exactly 48 hours following successful trip completion.
            </P>
            <P>
              <strong>Text Compliance Alerting:</strong> All system dispatch updates transmitted via SMS
              layers strictly comply with A2P 10DLC mobile telecommunication carrier guidelines.
            </P>
          </Section>

          <Section title="5. Complimentary Setup & Promotional Pilot Rules">
            <P>
              To accelerate market entry across the Springfield corridor, Odofy provides onboarding
              concessions subject to specific operational limitations.
            </P>
            <P>
              <strong>Done-For-You Visual Layouts:</strong> Odofy provides a complimentary digitizing
              service to input menu items, list category schemas, and apply custom web imagery on behalf
              of incoming Merchants. Merchants remain strictly responsible for validating the accuracy of
              pricing, tax compliance variables, and ingredient disclosures.
            </P>
            <P>
              <strong>The 5-Run Free Introductory Window:</strong> Founding merchant partners onboarding
              during the active allocation cycle receive their first 5 system delivery dispatches with
              $0.00 merchant-facing promotional risk. Odofy fully funds the initial baseline driver payout
              rates out of pocket to facilitate clean technical workflow rehearsals. Following the 5th
              completed run, the system operates under standard flat-fee consumer parameters unless a
              premium white-label feature subscription is explicitly authorized.
            </P>
          </Section>

          <Section title="6. Liability Disclaimers & Indemnification">
            <P>
              <strong>Kitchen Operational Control:</strong> Merchants retain absolute control over food
              preparation safety, packaging integrity, and menu item compliance. Odofy assumes zero
              liability for kitchen fulfillment delays, cross-contamination occurrences, or missing order
              parameters.
            </P>
            <P>
              <strong>Transit Limitations:</strong> Odofy is not liable for structural delays or damages
              resulting from external logistics disruptions, local severe weather instances, road closures
              along the Springfield grid, or transit deviations caused by independent Courier operations.
            </P>
            <P>
              By initializing a data sync layer at getodofy.com, you affirm that you possess the necessary
              executive authority to bind your commercial entity to these operational rules.
            </P>
          </Section>
        </div>
      </div>
    </div>
  )
}
