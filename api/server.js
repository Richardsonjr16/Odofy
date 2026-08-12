// Vercel serverless adapter for TanStack Start SSR (function-detection
// fallback, used when the Build Output API bundle is not deployed). Web-style
// handler: /api/* requests are reverse-proxied to the backend (BACKEND_URL env
// var); all other paths render through the TanStack SSR handler as before.
import server from "../dist/server/server.js";
import { proxyApiRequest } from "../vercel-api-proxy.js";

const ssrHandler =
  server && typeof server.fetch === "function"
    ? server
    : { fetch: server };

export default async function handler(request) {
  const proxied = await proxyApiRequest(request);
  if (proxied) return proxied;
  return ssrHandler.fetch(request);
}
