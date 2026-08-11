import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/compare/flat-fee-vs-commission")({
  component: ComparePage,
});

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const FLAT_FEE = 8.5; // Odofy flat per-order delivery fee
const DEFAULT_AOV = 45; // average order value ($)
const DEFAULT_VOLUME = 500; // monthly delivery volume
const DEFAULT_RATE = 0.25; // commission rate (25%)
const RATE_OPTIONS = [0.15, 0.2, 0.25, 0.3];

const usd = (n: number, digits = 0): string =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/* ------------------------------------------------------------------ */
/* Animated stat counter (counts up when scrolled into view)           */
/* ------------------------------------------------------------------ */

function StatCounter({
  target,
  format,
  label,
  sub,
}: {
  target: number;
  format: (value: number) => string;
  label: string;
  sub?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setStarted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setStarted(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let raf = 0;
    const duration = 1400;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target]);

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm"
    >
      <div className="text-3xl font-extrabold tabular-nums text-[#800020] sm:text-4xl">
        {format(value)}
      </div>
      <div className="mt-2 text-sm font-bold text-gray-800">{label}</div>
      {sub && <div className="mt-1 text-xs font-medium text-gray-500">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live savings calculator                                             */
/* ------------------------------------------------------------------ */

function BarRow({
  label,
  value,
  pct,
  barClass,
  textClass,
}: {
  label: string;
  value: number;
  pct: number;
  barClass: string;
  textClass: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-gray-500">{label}</span>
        <span className={`font-bold tabular-nums ${textClass}`}>
          {usd(value, 0)}/mo
        </span>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barClass}`}
          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
        />
      </div>
    </div>
  );
}

function SavingsCalculator() {
  const [aov, setAov] = useState(DEFAULT_AOV);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [rate, setRate] = useState(DEFAULT_RATE);

  const gross = aov * volume;
  const commissionCost = gross * rate;
  const odofyCost = volume * FLAT_FEE;
  const savings = commissionCost - odofyCost;
  const perOrderSavings = aov * rate - FLAT_FEE;
  const positive = savings >= 0;
  const maxBar = Math.max(commissionCost, odofyCost, 1);
  const savingsPct = commissionCost > 0 ? (savings / commissionCost) * 100 : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50/70 px-6 py-5 sm:px-8">
        <h2 className="text-xl font-extrabold text-[#800020] sm:text-2xl">
          Live Savings Calculator
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Drag the sliders to see what commission leakage is really costing you
          versus Odofy&rsquo;s flat $8.50 per delivery.
        </p>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-2">
        {/* Controls */}
        <div className="space-y-7">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="calc-aov"
                className="text-sm font-bold text-gray-800"
              >
                Average order value
              </label>
              <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-sm font-extrabold tabular-nums text-[#800020]">
                {usd(aov, 2)}
              </span>
            </div>
            <input
              id="calc-aov"
              type="range"
              min={10}
              max={150}
              step={1}
              value={aov}
              onChange={(e) => setAov(Number(e.target.value))}
              className="w-full accent-[#800020]"
            />
            <div className="mt-1 flex justify-between text-[11px] font-medium text-gray-400">
              <span>$10</span>
              <span>$150</span>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="calc-volume"
                className="text-sm font-bold text-gray-800"
              >
                Monthly deliveries
              </label>
              <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-sm font-extrabold tabular-nums text-[#800020]">
                {volume.toLocaleString("en-US")}
              </span>
            </div>
            <input
              id="calc-volume"
              type="range"
              min={10}
              max={3000}
              step={10}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-[#800020]"
            />
            <div className="mt-1 flex justify-between text-[11px] font-medium text-gray-400">
              <span>10</span>
              <span>3,000</span>
            </div>
          </div>

          <div>
            <span className="text-sm font-bold text-gray-800">
              Commission rate
            </span>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {RATE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRate(option)}
                  className={`rounded-lg border px-2 py-2 text-sm font-bold transition ${
                    rate === option
                      ? "border-[#800020] bg-[#800020] text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-[#800020]/40 hover:text-[#800020]"
                  }`}
                >
                  {Math.round(option * 100)}%
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs leading-relaxed text-gray-500">
            <span className="font-bold text-gray-700">Per-order math: </span>
            At {usd(aov, 2)} per order, a {Math.round(rate * 100)}% commission
            takes {usd(aov * rate, 2)} — Odofy charges a flat{" "}
            {usd(FLAT_FEE, 2)}. That&rsquo;s{" "}
            <span
              className={`font-extrabold ${positive ? "text-green-600" : "text-rose-600"}`}
            >
              {positive ? "−" : "+"}
              {usd(Math.abs(perOrderSavings), 2)} per order
            </span>{" "}
            {positive ? "in your pocket" : "in the platform's pocket"}.
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col justify-center">
          <div
            className={`rounded-2xl border-2 p-5 text-center transition-colors ${
              positive
                ? "border-green-200 bg-green-50"
                : "border-rose-200 bg-rose-50"
            }`}
          >
            <div className="text-xs font-black uppercase tracking-widest text-gray-500">
              Estimated monthly savings
            </div>
            <div
              className={`mt-1 text-4xl font-extrabold tabular-nums sm:text-5xl ${
                positive ? "text-green-600" : "text-rose-600"
              }`}
            >
              {positive ? "+" : "−"}
              {usd(Math.abs(savings), 0)}
            </div>
            <div
              className={`mt-2 text-sm font-bold ${
                positive ? "text-green-700" : "text-rose-700"
              }`}
            >
              {positive
                ? `You keep ${Math.round(Math.abs(savingsPct))}% of what commission platforms would take.`
                : "Commission is cheaper at these settings — try a higher order value."}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <BarRow
              label={`Commission platform (${Math.round(rate * 100)}% of ${usd(gross, 0)} gross)`}
              value={commissionCost}
              pct={(commissionCost / maxBar) * 100}
              barClass="bg-rose-500"
              textClass="text-rose-600"
            />
            <BarRow
              label={`Odofy flat-fee (${usd(FLAT_FEE, 2)} × ${volume.toLocaleString("en-US")} deliveries)`}
              value={odofyCost}
              pct={(odofyCost / maxBar) * 100}
              barClass="bg-[#800020]"
              textClass="text-[#800020]"
            />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Commission
              </div>
              <div className="mt-1 text-sm font-extrabold tabular-nums text-rose-600">
                {usd(commissionCost, 0)}
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Odofy
              </div>
              <div className="mt-1 text-sm font-extrabold tabular-nums text-[#800020]">
                {usd(odofyCost, 0)}
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Savings
              </div>
              <div
                className={`mt-1 text-sm font-extrabold tabular-nums ${
                  positive ? "text-green-600" : "text-rose-600"
                }`}
              >
                {positive ? "+" : "−"}
                {usd(Math.abs(savings), 0)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comparison matrix                                                   */
/* ------------------------------------------------------------------ */

type MatrixRow = {
  feature: string;
  odofy: string;
  commission: string;
  odofyWin?: boolean;
  commissionLoss?: boolean;
};

const MATRIX_ROWS: MatrixRow[] = [
  {
    feature: "Pricing model",
    odofy: "Flat $8.50 per delivery — zero percentage of your order value, ever.",
    commission: "15–30% of every order, on every ticket, forever.",
    odofyWin: true,
    commissionLoss: true,
  },
  {
    feature: "Delivery radius",
    odofy: "4.33-mile geofenced radius from your storefront — fast, reliable local turns.",
    commission: "Marketplace-wide zones with long-range routes and variable driver supply.",
    odofyWin: true,
  },
  {
    feature: "Driver pay model",
    odofy: "Transparent flat trip fee your drivers see before they accept.",
    commission: "Dynamic, opaque pay with surge multipliers and stacked orders.",
    odofyWin: true,
  },
  {
    feature: "Customer data ownership",
    odofy: "You own every customer record and contact — fully exportable.",
    commission: "Marketplace retains customer data; you rent access to it.",
    odofyWin: true,
    commissionLoss: true,
  },
  {
    feature: "SMS updates",
    odofy: "Automated SMS updates at every milestone, compliant and opt-in.",
    commission: "Push notifications inside the marketplace app only — if the customer opts in.",
    odofyWin: true,
  },
  {
    feature: "Per-order cost",
    odofy: "$8.50 flat, regardless of order size — a $150 ticket costs the same as a $15 one.",
    commission: "$3–$15+ per order at typical commission rates, scaling with your ticket.",
    odofyWin: true,
  },
  {
    feature: "Hidden fees",
    odofy: "None. One flat fee — no ads, no placement boosts, no marketing surcharges.",
    commission: "Ads, placement boosts, marketing fees, and chargeback costs on top of commission.",
    odofyWin: true,
    commissionLoss: true,
  },
  {
    feature: "Contract",
    odofy: "No long-term contract. Use it monthly and cancel anytime.",
    commission: "Standard marketplace terms with 30–60 day notice and minimum commitments.",
    odofyWin: true,
    commissionLoss: true,
  },
];

function ComparisonMatrix() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50/70 px-6 py-5 sm:px-8">
        <h2 className="text-xl font-extrabold text-[#800020] sm:text-2xl">
          Odofy vs. Commission Marketplaces
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          The structural differences that show up on your P&amp;L — and in your
          customer relationships.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr>
              <th className="w-[22%] bg-gray-50 px-6 py-4 text-[11px] font-black uppercase tracking-wider text-gray-500">
                Feature
              </th>
              <th className="bg-[#800020] px-6 py-4 text-[11px] font-black uppercase tracking-wider text-white">
                Odofy Flat-Fee
              </th>
              <th className="bg-gray-100 px-6 py-4 text-[11px] font-black uppercase tracking-wider text-gray-500">
                Commission Marketplaces
              </th>
            </tr>
          </thead>
          <tbody>
            {MATRIX_ROWS.map((row) => (
              <tr key={row.feature} className="border-t border-gray-100 align-top">
                <td className="px-6 py-4 font-bold text-gray-800">
                  {row.feature}
                </td>
                <td className="bg-[#800020]/[0.04] px-6 py-4 leading-relaxed text-gray-700">
                  {row.odofyWin && (
                    <span className="mr-1.5 font-bold text-green-600">✓</span>
                  )}
                  {row.odofy}
                </td>
                <td className="px-6 py-4 leading-relaxed text-gray-600">
                  {row.commissionLoss && (
                    <span className="mr-1.5 font-bold text-rose-500">✗</span>
                  )}
                  {row.commission}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabbed section                                                      */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: "why", label: "Why it matters" },
  { id: "cost", label: "Cost breakdown" },
  { id: "merchants", label: "For merchants" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const COST_EXAMPLES = [25, 50, 75, 100];

const MERCHANT_BULLETS: Array<{ title: string; body: string }> = [
  {
    title: "Shopify-native from day one",
    body: "Orders flow in automatically via Shopify webhooks — no manual entry, no middleware spaghetti.",
  },
  {
    title: "Keep your customers",
    body: "Every order and customer record is yours. Run your own CRM campaigns and retain the relationship.",
  },
  {
    title: "Automated SMS updates",
    body: "Customers get live delivery updates by text, so your front counter stops fielding 'where is my order?' calls.",
  },
  {
    title: "Scheduled delivery windows",
    body: "Customers pick a time slot at checkout and our dispatch engine holds the order until the right window.",
  },
  {
    title: "Your drivers, your standards",
    body: "Independent local drivers with .edu-verified registration, identity checks, and two-way ratings.",
  },
  {
    title: "No contract, no lock-in",
    body: "Month-to-month. If we don't earn the flat fee with faster, cheaper delivery — leave.",
  },
];

function TabsSection() {
  const [tab, setTab] = useState<TabId>("why");

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap border-b border-gray-100">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-5 py-3.5 text-sm font-bold transition ${
              tab === t.id
                ? "border-b-2 border-[#800020] text-[#800020]"
                : "text-gray-500 hover:text-[#800020]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-6 sm:px-8 sm:py-8">
        {tab === "why" && (
          <div className="space-y-5 text-sm leading-relaxed text-gray-600">
            <p>
              <span className="font-extrabold text-[#800020]">
                Commission compounds with your success.{" "}
              </span>
              A 25% commission on a $40 order is $10; on a $100 order it&rsquo;s
              $25. The more you grow, the more the marketplace takes — your fee
              scales with your ticket whether or not your cost of delivery does.
            </p>
            <p>
              <span className="font-extrabold text-[#800020]">
                Your customers are your asset.{" "}
              </span>
              Marketplace apps own the checkout relationship: they see your
              buyers, email them, and re-market to them. Odofy hands every order
              and every customer record to you — full ownership, full
              portability.
            </p>
            <p>
              <span className="font-extrabold text-[#800020]">
                Predictable unit economics.{" "}
              </span>
              A flat $8.50 per delivery means your cost per order is identical
              whether the ticket is $15 or $150. You can price your menu,
              forecast margin, and plan promotions without a moving percentage
              underneath you.
            </p>
            <p>
              <span className="font-extrabold text-[#800020]">
                The 4.33-mile edge.{" "}
              </span>
              Local, geofenced delivery keeps trips short, drivers close, and
              food hot. Marketplaces route across wide zones where driver
              supply and delivery time are a lottery.
            </p>
          </div>
        )}

        {tab === "cost" && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] font-black uppercase tracking-wider text-gray-500">
                    <th className="px-3 py-2.5">Order value</th>
                    <th className="px-3 py-2.5">Commission @ 25%</th>
                    <th className="px-3 py-2.5">Odofy flat fee</th>
                    <th className="px-3 py-2.5 text-[#800020]">
                      Your savings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COST_EXAMPLES.map((aov) => {
                    const commission = aov * 0.25;
                    const savings = commission - FLAT_FEE;
                    return (
                      <tr
                        key={aov}
                        className="border-b border-gray-50 last:border-0"
                      >
                        <td className="px-3 py-2.5 font-bold text-gray-800">
                          {usd(aov, 2)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-rose-600">
                          {usd(commission, 2)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-[#800020]">
                          {usd(FLAT_FEE, 2)}
                        </td>
                        <td
                          className={`px-3 py-2.5 font-bold tabular-nums ${
                            savings >= 0 ? "text-green-600" : "text-rose-600"
                          }`}
                        >
                          {savings >= 0 ? "+" : "−"}
                          {usd(Math.abs(savings), 2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-gray-500">
              At very low order values a commission model can look cheaper on
              paper — but you pay for it in customer-data ownership, ad fees,
              and zero control over driver supply. Odofy&rsquo;s flat fee is the
              same $8.50 whether your ticket is $15 or $150.
            </p>
          </div>
        )}

        {tab === "merchants" && (
          <div className="grid gap-5 sm:grid-cols-2">
            {MERCHANT_BULLETS.map((b) => (
              <div
                key={b.title}
                className="rounded-xl border border-gray-100 bg-gray-50/60 p-4"
              >
                <div className="text-sm font-extrabold text-[#800020]">
                  {b.title}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function ComparePage() {
  return (
    <div className="bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#800020] via-[#5E0009] to-[#2e0004] px-6 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full border border-[#D29F13]/40 bg-[#D29F13]/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#D29F13]">
              B2B Platform Comparison
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Flat-Fee vs. Commission{" "}
              <span className="text-[#D29F13]">Delivery Platforms</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-200">
              Commission marketplace apps take a percentage of every order —
              and the percentage grows as you do. Odofy charges one flat $8.50
              per delivery, hands you your customer data, and keeps the
              relationship yours. Here&rsquo;s the math, side by side.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/merchant-signup"
                className="rounded-xl bg-[#D29F13] px-6 py-3 text-center text-sm font-bold text-[#2e0004] transition hover:bg-[#e3b52c]"
              >
                Start With Odofy
              </Link>
              <Link
                to="/register"
                className="rounded-xl border-2 border-white/40 px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10"
              >
                Become a Driver
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Animated stat counters */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="-mt-10 grid gap-4 sm:grid-cols-3">
          <StatCounter
            target={100}
            format={(n) => `${Math.round(n)}%`}
            label="of your revenue retained"
            sub="No percentage on any order"
          />
          <StatCounter
            target={FLAT_FEE}
            format={(n) => usd(n, 2)}
            label="flat per-order fee"
            sub="Same price at $15 or $150 tickets"
          />
          <StatCounter
            target={6.5}
            format={(n) => usd(n, 2)}
            label="saved per order"
            sub="vs. 25% commission at a $60 order"
          />
        </div>
      </section>

      {/* Calculator */}
      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
        <SavingsCalculator />
      </section>

      {/* Comparison matrix */}
      <section className="mx-auto max-w-6xl px-6 pb-14 sm:pb-16">
        <ComparisonMatrix />
      </section>

      {/* Tabs */}
      <section className="mx-auto max-w-6xl px-6 pb-14 sm:pb-16">
        <TabsSection />
      </section>

      {/* CTA */}
      <section className="px-6 pb-16 sm:pb-20">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-gradient-to-br from-[#800020] via-[#5E0009] to-[#2e0004] px-6 py-12 text-center text-white shadow-sm sm:px-12 sm:py-16">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Keep 100% of your revenue.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gray-200 sm:text-base">
            Stop renting your customers from a commission marketplace. Push an
            order, a nearby driver claims it, and your customer gets live SMS
            updates — all for a flat $8.50 per delivery.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/merchant-signup"
              className="w-full rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-[#800020] transition hover:bg-gray-100 sm:w-auto"
            >
              Start With Odofy — Merchant Signup
            </Link>
            <Link
              to="/register"
              className="w-full rounded-xl border-2 border-white/40 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-white/10 sm:w-auto"
            >
              Become a Driver
            </Link>
          </div>
          <p className="mt-6 text-[11px] font-medium text-gray-300">
            No long-term contract · Flat $8.50 per delivery · Your customer data
            stays yours
          </p>
        </div>
      </section>
    </div>
  );
}
