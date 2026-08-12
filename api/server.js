// Vercel serverless adapter for TanStack Start SSR (function-detection
// fallback, used when the Build Output API bundle is not deployed). Web-style
// handler: /api/* requests are reverse-proxied to the backend (BACKEND_URL env
// var); all other paths render through the TanStack SSR handler as before.
//
// Self-contained: the /api/* proxy logic lives in this file (no root-level
// imports) so the function-detection bundler includes it in the deployed
// bundle. Requests whose path starts with /api/ are forwarded verbatim
// (method, headers, body) to `${BACKEND_URL}${pathname}${search}`; the
// upstream status, headers, and body are returned unchanged. When
// BACKEND_URL is unset the caller gets a 502 {"error":"Backend not
// configured"} JSON response instead of a thrown error. Non-/api requests
// return null so the caller falls through to the TanStack SSR handler exactly
// as before.
import server from "../dist/server/server.js";

const BACKEND_TIMEOUT_MS = 30_000;

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

async function proxyApiRequest(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  const backendUrl = String(process.env.BACKEND_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (!backendUrl) {
    return new Response(JSON.stringify({ error: "Backend not configured" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const headers = new Headers(request.headers);
  headers.delete("host"); // let fetch set Host from the target URL
  headers.delete("connection");
  headers.delete("transfer-encoding");

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${backendUrl}${url.pathname}${url.search}`, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const responseHeaders = new Headers(upstream.headers);
    for (const name of HOP_BY_HOP) responseHeaders.delete(name);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    clearTimeout(timer);
    console.error("[api/server] backend request failed", error);
    return new Response(JSON.stringify({ error: "Backend unreachable" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}

const ssrHandler =
  server && typeof server.fetch === "function"
    ? server
    : { fetch: server };

export default async function handler(request) {
  const proxied = await proxyApiRequest(request);
  if (proxied) return proxied;
  try {
    return await ssrHandler.fetch(request);
  } catch (error) {
    console.error("[api/server] SSR request failed", error);
    return new Response("Internal Server Error", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
  }
}
