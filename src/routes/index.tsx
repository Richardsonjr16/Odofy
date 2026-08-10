import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { useEffect, useState } from "react";
const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "Odofy";
  } catch {
    return "Odofy";
  }
});

export const Route = createFileRoute("/")({
  loader: () => getBusinessName(),
  component: Home,
});

function CountdownTimer() {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = new Date("2026-08-17T08:00:00-05:00").getTime(); // Forces 8:00 AM Central Daylight Time

    function tick() {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setTime({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");

  const boxes = [
    { label: "DAYS", value: time.days },
    { label: "HOURS", value: pad(time.hours) },
    { label: "MINUTES", value: pad(time.minutes) },
    { label: "SECONDS", value: pad(time.seconds) },
  ];

  return (
    <div className="flex justify-center gap-2 sm:gap-4 my-6">
      {boxes.map((box) => (
        <div
          key={box.label}
          className="flex flex-col items-center bg-[#5E0009] text-white rounded-xl px-3 py-3 sm:px-5 sm:py-4 w-16 sm:w-20 shadow-lg"
        >
          <span className="text-2xl sm:text-3xl font-extrabold tabular-nums">
            {box.value}
          </span>
          <span className="text-[10px] sm:text-xs font-semibold tracking-wider mt-1 opacity-80">
            {box.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Home() {
  const businessName = Route.useLoaderData();

  return (
    <div className="min-h-dvh bg-white text-charcoal">

      {/* Hero */}
      <section className="px-6 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20 lg:px-12 lg:pb-32 lg:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <img
            src="/brand_mark.png"
            alt="Odofy"
            className="mx-auto mb-6 h-20 w-auto sm:h-24 lg:h-28"
          />
          <h1 className="text-4xl font-extrabold tracking-tight text-msu-maroon sm:text-5xl lg:text-6xl">
            Deliveries, simplified.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-charcoal sm:text-xl">
            {businessName} connects Shopify merchants with independent local
            drivers for last-mile delivery within a 4.33-mile radius. Push an
            order, a nearby driver claims it, and your customer gets live SMS
            updates — all in one seamless flow.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="/merchant-signup"
              className="w-full rounded-lg bg-msu-maroon px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-msu-maroon/80 sm:w-auto"
            >
              Register Your Shop
            </a>
            <a
              href="/register"
              className="w-full rounded-lg border-2 border-msu-maroon bg-white px-6 py-3 text-base font-semibold text-msu-maroon transition hover:bg-msu-maroon/10 sm:w-auto"
            >
              Become a Driver
            </a>
          </div>

          {/* Countdown Timer */}
          <CountdownTimer />
          <p className="text-[#5E0009] font-bold text-center text-sm tracking-wider uppercase mt-4 animate-pulse">
            Final Phase: Launching August 17 — Lock in Your Pilot Accounts
          </p>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="bg-msu-maroon px-6 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-32"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-center text-white/70">
            Three steps from order to doorstep — no dispatch desk, no radio
            chatter, just a clean pipeline.
          </p>
          <div className="mt-16 grid gap-10 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Merchant integration",
                body: "Connect your Shopify store in minutes with a one-click webhook, or enter orders manually through the Odofy dashboard. Every delivery is automatically geofenced to a 4.33-mile radius around your storefront.",
              },
              {
                step: "2",
                title: "Driver claims the delivery",
                body: "Nearby independent drivers see available trips the moment they're published. One tap to claim, clear pickup and drop-off details, and turn-by-turn directions — no back-and-forth required.",
              },
              {
                step: "3",
                title: "Customer SMS updates",
                body: "From order confirmation through delivery confirmation, customers receive automated text updates at every milestone. They know who's coming, when, and when the package has arrived.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-white/20 bg-white/10 p-8"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                  {item.step}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 leading-relaxed text-white/70">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Merchants / For Drivers */}
      <section className="px-6 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Merchants */}
            <div
              id="for-merchants"
              className="rounded-2xl border border-gray-200 bg-gray-50 p-8 sm:p-10"
            >
              <h2 className="text-2xl font-bold tracking-tight text-msu-maroon sm:text-3xl">
                For Merchants
              </h2>
              <p className="mt-4 leading-relaxed text-charcoal">
                Stop wrestling with courier phone calls and missed delivery
                windows. Odofy gives your Shopify store a delivery layer that
                works the moment an order is paid.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "One-click Shopify integration — no custom dev work",
                  "Every order geofenced to 4.33 miles automatically",
                  "Flat-rate delivery pricing you control",
                  "Customer gets SMS updates; you get peace of mind",
                  "Manual order entry for phone / in-store sales",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-charcoal">
                    <span className="mt-0.5 shrink-0 text-msu-maroon">→</span>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="/merchant-signup"
                className="mt-6 inline-block rounded-lg bg-msu-maroon px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-msu-maroon/80"
              >
                Register Your Shop
              </a>
            </div>

            {/* Drivers */}
            <div
              id="for-drivers"
              className="rounded-2xl border border-msu-maroon/20 bg-white p-8 shadow-sm sm:p-10"
            >
              <h2 className="text-2xl font-bold tracking-tight text-msu-maroon sm:text-3xl">
                For Drivers
              </h2>
              <p className="mt-4 leading-relaxed text-charcoal">
                Earn on your schedule. Verified student .edu profiles receive an
                exclusive 2-minute competitive head-start window to claim the
                best local retail routes before they open to the backup pool.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "See only deliveries within your preferred radius",
                  "One-tap claim — no bidding or scheduling",
                  "Clear pickup address, drop-off address, and item details",
                  "Built-in turn-by-turn directions",
                  "Get paid per delivery with instant payouts straight to your account.",
                  "Keep 100% of driver gratitude tips with built-in $3, $5, and $10 merchant checkout presets.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-charcoal">
                    <span className="mt-0.5 shrink-0 text-msu-maroon">→</span>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="/register"
                className="mt-6 inline-block rounded-lg bg-msu-maroon px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-msu-maroon/80"
              >
                Become a Driver
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-msu-maroon/10 px-6 py-16 sm:px-8 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-msu-maroon sm:text-3xl">
            Ready to simplify your deliveries?
          </h2>
          <p className="mt-3 text-charcoal">
            {businessName} is live and onboarding merchants and drivers.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="#for-merchants"
              className="w-full rounded-lg bg-msu-maroon px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-msu-maroon/80 sm:w-auto"
            >
              Start delivering
            </a>
            <a
              href="#how-it-works"
              className="w-full rounded-lg border border-msu-maroon/30 bg-white px-6 py-3 text-base font-semibold text-msu-maroon transition hover:bg-msu-maroon/10 sm:w-auto"
            >
              Learn more
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>© 2026 {businessName}. Built with cto.new</span>
          <a
            href="/admin"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            Admin
          </a>
        </div>
      </footer>
    </div>
  );
}
