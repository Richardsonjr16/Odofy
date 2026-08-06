import server from "./dist/server/server.js";
import { join, extname } from "path";
const staticDir = join(import.meta.dir, "dist", "client");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}
// ── Group-cart WebSocket ─────────────────────────────────────────────────────
// The real-time group-cart controller lives in the odofy-backend clone (same
// GitHub repo) and is loaded lazily on the first WS message, so a broken module
// can never take down the HTTP server. It creates its own pg pool bound to the
// live Neon project via dotenv override inside the module.
let groupCartModule = null;
async function loadGroupCartModule() {
  if (!groupCartModule) {
    groupCartModule = await import(
      "/home/team/shared/odofy-backend/src/ws/-group-cart.js"
    );
  }
  return groupCartModule;
}
const siteServer = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    // Real-time group-cart WebSocket endpoint: /ws. Must be checked before the
    // /api proxy (a WS handshake is not an API call).
    if (
      url.pathname === "/ws" &&
      req.headers.get("upgrade")?.toLowerCase() === "websocket"
    ) {
      const upgraded = siteServer.upgrade(req, { data: { url: req.url } });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    // Proxy API calls to backend on port 3001
    if (url.pathname.startsWith("/api/")) {
      const backendUrl = "http://localhost:3001" + url.pathname + url.search;
      const headers = new Headers(req.headers);
      headers.set("host", "localhost:3001");
      try {
        const res = await fetch(backendUrl, {
          method: req.method,
          headers,
          body: req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined,
        });
        return new Response(res.body, { status: res.status, headers: res.headers });
      } catch {
        return new Response("Backend unavailable", { status: 502 });
      }
    }
    // Try static file from dist/client/
    const staticPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = join(staticDir, staticPath);
    // Security: ensure resolved path stays within staticDir
    if (!filePath.startsWith(staticDir)) {
      return server.fetch(req);
    }
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const headers = new Headers();
      headers.set("content-type", getMimeType(filePath));
      headers.set("cache-control", "public, max-age=31536000, immutable");
      return new Response(file, { headers });
    }
    // Fall back to SSR for all other routes
    try {
      return await server.fetch(req);
    } catch (e) {
      return new Response("Server error", { status: 500 });
    }
  },
  websocket: {
    open(_ws) {
      // Room subscription happens on join_group_cart; nothing to do here.
    },
    async message(ws, message) {
      try {
        const mod = await loadGroupCartModule();
        await mod.handleMessage(ws, message);
      } catch (err) {
        console.error("[ws] group-cart handler error:", err);
      }
    },
    close(ws) {
      loadGroupCartModule()
        .then((mod) => mod.handleClose(ws))
        .catch((err) =>
          console.error("[ws] group-cart close cleanup error:", err)
        );
    },
  },
});
console.log("Odofy site on port 3000 (+ API proxy to 3001, /ws group cart)");
