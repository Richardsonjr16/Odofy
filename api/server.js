// Vercel serverless adapter for TanStack Start SSR.
//
// NOTE: /api/* traffic is reverse-proxied at the EDGE via vercel.json rewrites
// (destination https://odofy-backend.onrender.com/api/$1) — no function code
// is involved, which keeps this handler exactly as simple as it has always
// been. Do NOT reintroduce in-function proxying here: Vercel's web-handler
// runtime passes relative request URLs, and previous in-function proxy
// attempts (PRs #68/#71/#72) either crashed the function (ERR_INVALID_URL on
// `new URL(request.url)`) or hung every request.
import server from "../dist/server/server.js";

export default server;
