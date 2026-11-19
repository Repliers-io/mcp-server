// lib/apiRequest.js
// How every tool talks to the Repliers API: request headers, and reading a failed response into
// the one error contract the server classifies — { status, body } (docs/feedback-v2/design.md §5.1).
import { SERVER_VERSION } from "./serverIdentity.js";
import { apiOrigin } from "./apiBase.js";

// clientInfo is client-controlled; only printable ASCII reaches a header, capped.
const headerSafe = (value) => String(value ?? "").replace(/[^\x20-\x7e]/g, "").trim().slice(0, 64);

export function userAgent(clientInfo) {
  const base = `repliers-mcp-server/${SERVER_VERSION}`;
  const name = headerSafe(clientInfo?.name);
  if (!name) return base;
  const version = headerSafe(clientInfo?.version);
  return `${base} (client ${version ? `${name}/${version}` : name})`;
}

// REPLIERS_INTEGRATION_KEY attributes hosted traffic. Off until mcpServer.js enables it in hosted
// HTTP mode, so stdio and self-hosted servers never send it, whatever their environment holds; when
// off or unset the header is absent, never empty. Read per call: mcpServer.js imports this module
// before it loads .env. Never taken from args, which are client-controlled JSON. The issued format
// is enforced: anything else (control characters fetch would echo in its error, a short value the
// scrubber would mangle text with, a literal "undefined") is dropped.
const INTEGRATION_KEY = /^[A-Za-z0-9_-]{24,256}$/;
const rawIntegrationKey = () => (process.env.REPLIERS_INTEGRATION_KEY ?? "").trim();
let integrationEnabled = false;

export function enableIntegrationKey(enabled = true) {
  integrationEnabled = enabled;
}

export function integrationKey() {
  if (!integrationEnabled) return null;
  const value = rawIntegrationKey();
  return INTEGRATION_KEY.test(value) ? value : null;
}

// Logged once at startup, after the mode is known. Names the variable and the rule, never the
// value or any part of it. `forced` means a self-hosted HTTP server sends the key because of
// --send-integration-key: always worth a line, so the log says which state the server is in.
export function integrationKeyNotice({ forced = false } = {}) {
  if (!rawIntegrationKey()) return null;
  if (!integrationEnabled) {
    return "[CONFIG] REPLIERS_INTEGRATION_KEY is ignored outside hosted HTTP mode (stdio or self-hosted): the REPLIERS-INTEGRATION-KEY header is not sent. A self-hosted HTTP server sends it with --send-integration-key.";
  }
  if (!integrationKey()) {
    return "[CONFIG] REPLIERS_INTEGRATION_KEY is set but invalid (24-256 characters from A-Z, a-z, 0-9, _ and -): the REPLIERS-INTEGRATION-KEY header is not sent.";
  }
  return forced
    ? "[CONFIG] --send-integration-key: this self-hosted HTTP server sends the REPLIERS-INTEGRATION-KEY header to the API origin."
    : null;
}

// The integration key goes to the configured API origin only. A url that does not parse is not
// at it: fails closed.
function atApiOrigin(url) {
  try {
    return new URL(url).origin === apiOrigin();
  } catch {
    return false;
  }
}

// `url` is required: the headers are only ever built for a known destination, so a caller cannot
// get the integration key without the origin guard seeing where it goes.
export function apiHeaders(args = {}, { json = false, accept = "application/json", url } = {}) {
  if (url === undefined || url === null || url === "") {
    throw new TypeError("apiHeaders: url is required (call apiFetch instead)");
  }
  const headers = {
    "REPLIERS-API-KEY": args._repliersApiKey || process.env.REPLIERS_API_KEY,
    "User-Agent": args._userAgent || userAgent(),
  };
  const integration = integrationKey();
  if (integration && atApiOrigin(url)) headers["REPLIERS-INTEGRATION-KEY"] = integration;
  if (accept) headers.Accept = accept;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

// Every request to the Repliers API is made here. The url feeds the origin guard, so a fetch
// outside apiBaseUrl() never carries the integration key. The API never redirects, so a 3xx is
// handed back as the failure it is (lib/apiErrors.js classifies it upstream) instead of followed:
// fetch keeps custom headers across a redirect, so following would send REPLIERS-API-KEY and
// REPLIERS-INTEGRATION-KEY to whatever host Location names.
export function apiFetch(url, args, { json, accept, ...init } = {}) {
  const target = String(url);
  return fetch(target, { ...init, headers: apiHeaders(args, { json, accept, url: target }), redirect: "manual" });
}

export async function readFailure(response) {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return { status: response.status, body: null };
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: text };
  }
}

// The message reaches the model in _notice; an HTML error page or an echoing body can be huge.
const MAX_MESSAGE = 1000;

function fullMessage(body) {
  if (body == null) return "";
  if (typeof body === "string") return body.trim();
  if (Array.isArray(body)) {
    return body
      .map((entry) => (entry?.param ? `${entry.param}: ${entry.msg}` : entry?.msg ?? JSON.stringify(entry)))
      .join("; ");
  }
  const candidate = [body.request?.error, body.error, body.message, body.msg]
    .find((value) => typeof value === "string" && value.trim());
  return (candidate ?? JSON.stringify(body)).trim();
}

export function errorMessage(body) {
  const message = fullMessage(body);
  return message.length > MAX_MESSAGE ? `${message.slice(0, MAX_MESSAGE - 1)}…` : message;
}
