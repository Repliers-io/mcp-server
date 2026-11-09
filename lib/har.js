// lib/har.js
// The HAR partner routes (/partners/har/*): the shared request the three get-har-* tools make, and
// the probe lib/entitlements.js uses to decide whether a key may see them at all
// (mcp-server-docs/content/har-partner/design.md §4).
//
// Access control is the API's, not ours: the account must have partners.har enabled with a broker
// code, and an agent-scoped key is pinned to its own agent server-side. These helpers forward
// parameters and report what the API said.
import { apiBaseUrl } from "./apiBase.js";
import { apiHeaders, readFailure, errorMessage } from "./apiRequest.js";
import { compactEnrichment } from "./listingFields.js";

export const HAR_ROUTES = {
  views: "/partners/har/listings/views",
  showings: "/partners/har/showingsmart/logs",
  reviews: "/partners/har/listings/reviews",
};

// ShowingSmart answers one row per showing, and every row arrives enriched with listing details.
// Without a cap a broker-wide request is unbounded; `total` in the response tells the agent to page.
export const DEFAULT_LIMIT = 50;

// The API's own refusals (ApiError) are always an array of { msg } / { param, msg } entries. On
// these routes the API also relays whatever HAR's gateway answers — status and body verbatim —
// and that body is an object of HAR's making, which may echo the request (the gateway credential,
// the broker code) or carry rows. Only the API's own shape is trusted to reach the model and capture.
export function isRepliersError(body) {
  return Array.isArray(body) && body.length > 0 && body.every((entry) => typeof entry?.msg === "string");
}

/**
 * GET one HAR route. Only `allowed` parameters are forwarded: the API validates these routes with
 * allowUnknownQuery: false, so a stray argument would turn a good call into a 400.
 * Returns the server-wide tool contract: { url, data } or { url, error, status, body }. A failure
 * that is not the API's own refusal keeps its status but not its text (see isRepliersError).
 */
// The API enriches every HAR row with listing data; its address becomes one line and its
// listDate/soldDate days. HAR's own fields, nulls and timestamps included, pass through untouched.
function trimRows(body) {
  if (!body || !Array.isArray(body.data)) return body;
  return { ...body, data: body.data.map(compactEnrichment) };
}

export async function harRequest(route, allowed, args = {}) {
  const url = new URL(`${apiBaseUrl()}${route}`);
  for (const name of allowed) {
    const value = args[name];
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  }
  if (!url.searchParams.has("limit")) url.searchParams.set("limit", String(DEFAULT_LIMIT));
  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, { method: "GET", headers: apiHeaders(args) });
    if (!response.ok) {
      const { status, body } = await readFailure(response);
      if (!isRepliersError(body)) {
        return { url: finalUrl, error: `The HAR partner service returned HTTP ${status}.`, status, body: null };
      }
      return { url: finalUrl, error: errorMessage(body) || `HTTP ${status}`, status, body };
    }
    return { url: finalUrl, data: trimRows(await response.json()) };
  } catch (error) {
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
}

// A database read on the API side; HAR's gateway is not involved.
const PROBE_TIMEOUT_MS = 10_000;

// The same test the API applies before serving any HAR route (assertHarAccess in
// realtime-api/src/api/routes/partners/har.js): enabled, with a broker code.
const harEnabled = (configuration) =>
  configuration?.partners?.har?.enabled === true && Boolean(configuration.partners.har.brokerCode);

/**
 * Asks the API whether `apiKey` may read HAR data: "yes", "no", or "unknown" (design.md §4.1).
 *
 * GET /accounts with an ordinary key answers that key's own account — the API pins accountId to the
 * key — and its `configuration` is the very column the HAR routes read `partners.har` from. A
 * super-user key is answered every account instead, and nothing in that list says which one is its
 * own, so it is "no": those keys do not see the HAR tools.
 *
 * The response carries the account's apiSecret and settings; only `partners.har` is read, and nothing
 * of it is logged or kept. Never throws.
 */
export async function probeHar({ apiKey, userAgent, timeoutMs = PROBE_TIMEOUT_MS }) {
  try {
    const response = await fetch(`${apiBaseUrl()}/accounts`, {
      method: "GET",
      headers: apiHeaders({ _repliersApiKey: apiKey, _userAgent: userAgent }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return (status === 401 || status === 403) && isRepliersError(body) ? "no" : "unknown";
    }
    const accounts = (await response.json())?.accounts;
    if (!Array.isArray(accounts)) return "unknown";
    if (accounts.length !== 1) {
      console.error(`[entitlements] har: the key is answered ${accounts.length} accounts (a super-user key?); HAR tools stay hidden for it`);
      return "no";
    }
    return harEnabled(accounts[0]?.configuration) ? "yes" : "no";
  } catch {
    return "unknown"; // timeout, network failure, or a body that is not JSON
  }
}

// JSON-schema fragments the three tools share. Column lists mirror
// realtime-api/src/api/validation/partners/har.js; the API rejects any other column with a 400.
// `rowNoun` names what limit/offset/total count — "Showings" for ShowingSmart, whose response groups
// showings per listing, so a page of 50 showings can hold a dozen listings.
// `dateColumn` is the one column dateBegin/dateEnd filter on, measured per route against the live
// API (har-partner status.md, 2026-11-09); the routes do not say so themselves.
export function sharedProperties(sortColumns, sortExample, { rowNoun = "Rows", dateColumn }) {
  return {
    mlsNumber: { type: "string", description: "HAR MLS number of one listing." },
    dateBegin: { type: "string", format: "date", description: `Start of the date range on ${dateColumn}, YYYY-MM-DD.` },
    dateEnd: { type: "string", format: "date", description: `End of the date range on ${dateColumn}, YYYY-MM-DD, inclusive.` },
    sortBy: {
      type: "string",
      description: `Sort column, optionally followed by :asc or :desc (default asc), e.g. "${sortExample}". Columns: ${sortColumns.join(", ")}.`,
    },
    limit: { type: "integer", minimum: 1, maximum: 500, description: `${rowNoun} per page, 1-500 (default ${DEFAULT_LIMIT}).` },
    offset: { type: "integer", minimum: 0, description: `${rowNoun} to skip, for paging past the first page; total in the response is the full count of ${rowNoun.toLowerCase()}.` },
  };
}

export const SHARED_PARAMS = ["mlsNumber", "dateBegin", "dateEnd", "sortBy", "limit", "offset"];
