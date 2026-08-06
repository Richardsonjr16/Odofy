import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout for the /store section. The listing lives at /store (store/index.tsx)
// and each merchant's storefront renders at /store/:slug — both need this
// Outlet to mount, otherwise only this layout would render and the merchant
// storefront page would never appear.
function StoreLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/store")({
  component: StoreLayout,
});
