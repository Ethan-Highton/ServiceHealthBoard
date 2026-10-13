// Service Health Board server. No dependencies; needs Node 18+.
//   node server.mjs                     (uses host and port from config/services.json)
//   HOST=127.0.0.1 PORT=8095 node server.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkService } from "./lib/checks.mjs";
import { restartService } from "./lib/actions.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await readFile(path.join(root, "config", "services.json"), "utf8"));
const HOST = process.env.HOST || config.host;
const PORT = Number(process.env.PORT || config.port);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
const PUBLIC = [/^\/index\.html$/, /^\/css\/[\w.-]+$/, /^\/js\/[\w.-]+$/];

// The services file is re-read on each request, so edits show up without a restart.
async function loadServices() {
  const fresh = JSON.parse(await readFile(path.join(root, "config", "services.json"), "utf8"));
  return fresh.services;
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

// A restart must come from this page, not from some other site the phone has open.
function sameOrigin(req) {
  const origin = req.headers.origin;
  return !origin || new URL(origin).host === req.headers.host;
}

async function handle(req, res) {
  const url = new URL(req.url, "http://board");

  if (req.method === "GET" && url.pathname === "/api/services") {
    const services = await loadServices();
    return send(res, 200, { services: await Promise.all(services.map(checkService)) });
  }

  const restart = /^\/api\/services\/([\w-]+)\/restart$/.exec(url.pathname);
  if (restart) {
    if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
    if (!sameOrigin(req)) return send(res, 403, { error: "Wrong origin" });
    const service = (await loadServices()).find((s) => s.id === restart[1]);
    if (!service) return send(res, 404, { error: "Unknown service" });
    const result = await restartService(service);
    return send(res, result.ok ? 200 : 500, { ...result, service: await checkService(service) });
  }

  if (req.method === "GET") {
    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    if (PUBLIC.some((rule) => rule.test(file))) {
      try {
        const body = await readFile(path.join(root, file));
        return send(res, 200, body, TYPES[path.extname(file)] || "application/octet-stream");
      } catch {
        /* fall through to 404 */
      }
    }
  }
  send(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => send(res, 500, { error: error.message }));
});

server.on("error", (error) => {
  console.error(`Could not listen on ${HOST}:${PORT}: ${error.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => console.log(`Service Health Board on http://${HOST}:${PORT}/`));
