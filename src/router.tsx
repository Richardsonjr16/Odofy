import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

function NotFound() {
  return (
    <div className="min-h-dvh bg-white text-charcoal flex flex-col items-center justify-center px-6 text-center">
      <img
        src="/brand_mark.png"
        alt="Odofy"
        className="mx-auto mb-6 h-20 w-auto sm:h-24 lg:h-28"
      />
      <h1 className="text-4xl font-extrabold tracking-tight text-msu-maroon sm:text-5xl lg:text-6xl">
        Deliveries, simplified.
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-charcoal sm:text-xl">
        This page doesn&apos;t exist, but Odofy does. Head back home to get
        started.
      </p>
      <a
        href="/"
        className="mt-8 rounded-lg bg-msu-maroon px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-msu-maroon/80"
      >
        Back to Home
      </a>
    </div>
  );
}

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultNotFoundComponent: () => <NotFound />,
  });
}
