import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-privacy-statement')({
  component: DriverPrivacyStatementComponent,
})

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-black tracking-tight text-[#5E0009] mb-3">{title}</h2>
      <div className="text-sm text-gray-600 font-medium leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

function DriverPrivacyStatementComponent() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-4">
        <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">
          Effective date: August 12, 2026
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-4">
          Driver Privacy Statement
        </h1>
        <p className="text-base text-gray-600 font-medium leading-relaxed">
          This Privacy Statement explains what personal information Odofy collects from independent
          drivers, why we collect it, how we use and protect it, and the choices you have. It applies
          to all drivers who register and operate on the Odofy delivery platform.
        </p>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <Section title="1. Information We Collect">
            <p>We collect information you provide directly, information we observe as you use the platform, and information from service providers we work with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Registration information.</strong> Your full name, .edu email address, phone number, and the vehicle type you select (Bicycle, E-Bike, Electric Scooter, Car, SUV, Truck, or Van).</li>
              <li><strong>Identity verification information.</strong> A front-camera selfie and multi-angle identity photos, collected when you register and again on our rolling re-verification cycle (every 14 days). Insurance documentation when required for the vehicle type you select.</li>
              <li><strong>Location information.</strong> Your device location and trip-related locations, including merchant storefronts, pickup and drop-off points, and geofence entry/exit events used to validate deliveries.</li>
              <li><strong>Usage and trip information.</strong> Trips you claim, deliver, return, or mark undeliverable; earnings, payouts, and transaction history; ratings you give and receive; and customer service interactions.</li>
              <li><strong>Communications.</strong> SMS messages we send and receive from you in connection with trips and your account.</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-1">
              <li>Creating and maintaining your driver account, verifying your identity, and ensuring platform safety.</li>
              <li>Matching you with nearby delivery trips within the merchant's delivery radius and providing route, geofence, and verification information.</li>
              <li>Processing and delivering earnings, including RTS (return-to-store) and promotional payouts.</li>
              <li>Communicating with you about trips, verification, account status, and important platform updates via SMS.</li>
              <li>Improving the platform, including demand forecasting (heatmaps), lead-scrubbing tools, and safety features.</li>
              <li>Detecting and preventing fraud, abuse, and unauthorized activity, and complying with legal obligations.</li>
            </ul>
          </Section>

          <Section title="3. How We Share Your Information">
            <p>We do not sell your personal information. We share it only as needed to run the platform:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>With merchants</strong> whose trips you deliver, including your name, rating, and delivery confirmation details.</li>
              <li><strong>With customers</strong> receiving a delivery, including your name, live location/tracking, and QR verification details, solely to complete the delivery.</li>
              <li><strong>With service providers</strong> — such as SMS (Twilio), identity verification, mapping (Google Maps/Mapbox), payments, and database hosting providers — who process information on our behalf under confidentiality obligations.</li>
              <li><strong>When required by law</strong> — to comply with legal process, protect the rights and safety of users and the public, or enforce our agreements.</li>
            </ul>
          </Section>

          <Section title="4. How We Protect Your Information">
            <p>
              We use industry-standard technical and organizational safeguards — including encryption in
              transit, access controls, and hashed verification tokens — to protect your information. No
              method of transmission or storage is completely secure, and we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="5. Retention">
            <p>
              We retain personal information for as long as your driver account is active and for a reasonable
              period afterward as needed for security, fraud prevention, legal obligations, and dispute
              resolution. Identity verification records are retained on a rolling 14-day cycle while you are
              an active driver.
            </p>
          </Section>

          <Section title="6. Your Choices and Rights">
            <ul className="list-disc pl-5 space-y-1">
              <li>You may review and update your profile, vehicle type, and contact information through the driver dashboard.</li>
              <li>You may withdraw from trip matching at any time by going offline in the dashboard.</li>
              <li>Subject to applicable law, you may request access to, correction of, or deletion of your personal information by contacting us. Some information may be retained where required by law or needed to protect the platform.</li>
              <li>You may opt out of non-essential SMS communications at any time; transactional messages required to complete trips may still be sent.</li>
            </ul>
          </Section>

          <Section title="7. Contact Us">
            <p>
              Questions about this Privacy Statement or your personal information can be sent to the Odofy
              team through the merchant or driver support channels, or by emailing the address provided in
              your onboarding materials.
            </p>
          </Section>

          <Section title="8. Changes to This Statement">
            <p>
              We may update this Privacy Statement from time to time. When we make material changes, we will
              post the updated statement on this page and update the effective date above. Continued use of
              the platform after changes take effect constitutes acceptance of the updated statement.
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}
