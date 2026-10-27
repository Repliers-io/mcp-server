// lib/apiRequest.js
// How every tool talks to the Repliers API: request headers, and reading a failed response into
// the one error contract the server classifies — { status, body } (docs/feedback-v2/design.md §5.1).
import { SERVER_VERSION } from "./serverIdentity.js";

// clientInfo is client-controlled; only printable ASCII reaches a header, capped.
const headerSafe = (value) => String(value ?? "").replace(/[^\x20-\x7e]/g, "").trim().slice(0, 64);

export function userAgent(clientInfo) {
  const base = `repliers-mcp-server/${SERVER_VERSION}`;
  const name = headerSafe(clientInfo?.name);
  if (!name) return base;
  const version = headerSafe(clientInfo?.version);
  return `${base} (client ${version ? `${name}/${version}` : name})`;
}

export function apiHeaders(args = {}, { json = false, accept = "application/json" } = {}) {
  const headers = {
    "REPLIERS-API-KEY": args._repliersApiKey || process.env.REPLIERS_API_KEY,
    "User-Agent": args._userAgent || userAgent(),
  };
  if (accept) headers.Accept = accept;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
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
