// lib/apiErrors.js
// Classifies a failed call by who can fix it (docs/feedback-v2/design.md §5.2): the user's account
// admin (account), the agent (request, nlp-scope), nobody because it is an answer (not-found), or
// the Repliers team (upstream). Status first, text second — API messages are not a contract, so
// every pattern here is pinned by test/apiErrors.test.js on recorded bodies.
import { errorMessage } from "./apiRequest.js";
import { toolAnnotations } from "./tools.js";

const DASHBOARD = "https://login.repliers.com/dashboard";
const NLP_TOOLS = new Set(["Search_Listings", "refine-search"]);

// The first path segment names the feature (/members, /clients); the rest can be caller-supplied
// ids, which have no place in a text written for the end user.
function feature(toolName, url) {
  if (NLP_TOOLS.has(toolName)) return "natural-language listing search";
  let path = "";
  try {
    const first = new URL(url).pathname.split("/").find(Boolean);
    if (first) path = `/${first}`;
  } catch {
    // no usable url
  }
  return `this API feature (${path || toolName})`;
}

// A failed create or send may still have reached the API: advising a retry could duplicate it.
const repeatable = (toolName) => typeof toolName !== "string" || toolAnnotations(toolName)?.idempotentHint !== false;

export function classifyError({ toolName, url, status, body, error }) {
  const message = errorMessage(body) || errorMessage(String(error ?? ""));
  const nlp = toolName === "Search_Listings";
  const base = { message, status };
  const make = (kind, reason, retry, capture, forAgent, forUser) =>
    ({ ...base, kind, reason, retry, capture, forAgent, ...(forUser && { forUser }) });
  const upstream = (reason, forAgent) => (repeatable(toolName)
    ? make("upstream", reason, true, true, forAgent)
    : make("upstream", reason, false, true,
      "A Repliers service error occurred; the call may or may not have taken effect, so repeating it could duplicate it."));

  if (status === undefined) {
    return make("request", "input", true, false, message || "The tool rejected its arguments.");
  }
  if (status === null || status >= 500) {
    return upstream(status === null ? "network" : "server",
      "A Repliers service error occurred; the same call may succeed later.");
  }
  if (status === 403 || /does not have access/i.test(message)) {
    return make("account", "feature", false, false,
      NLP_TOOLS.has(toolName)
        ? "Search_Listings and refine-search cannot run with this API key. Lookups by MLS number, locations and statistics may still work."
        : `${toolName} is not available with this API key.`,
      `This Repliers account does not include ${feature(toolName, url)}. The account administrator can request access from Repliers; account settings are in the Repliers dashboard: ${DASHBOARD}`);
  }
  if (status === 401) {
    if (nlp && /openai|invalid_api_key/i.test(message)) {
      return make("account", "openai-key", false, false,
        "Search_Listings cannot run until the account's OpenAI key is replaced. Tools that do not use natural language may still work.",
        `Natural-language search could not run because the OpenAI API key configured for this Repliers account was rejected. The account administrator can update it in the Repliers dashboard: ${DASHBOARD}`);
    }
    return make("account", "repliers-key", false, false,
      "Every call with this API key will fail until the key is replaced.",
      `The Repliers API key used by this connection was rejected. The account administrator can review API keys in the Repliers dashboard: ${DASHBOARD}/apikeys`);
  }
  if (status === 404) {
    return make("not-found", "not-found", false, false, "No record matches these parameters.");
  }
  // Per entry: errorMessage joins array bodies with "; ", and a match across entries would pair
  // "boardId: must be a number" with another parameter's "is required".
  if (/boardId[^;]*required/i.test(message)) {
    return make("request", "needs-board", true, false,
      `This account covers several MLS boards and this call needs a boardId. Lookup_Possible_Values with aggregates=boardId lists the boards this key can see. The API said: ${message}`);
  }
  if (nlp && status === 406) {
    return make("nlp-scope", "nlp-scope", true, true,
      "The NLP endpoint interprets listing searches only. A listing search returns a count; Market_Statistics returns aggregate figures.");
  }
  if (status === 400 || status === 422) {
    return make("request", "validation", true, false, `The API rejected the request: ${message || `HTTP ${status}`}.`);
  }
  if (nlp) {
    return upstream("nlp", "The natural-language search service returned an error; the same call may succeed later.");
  }
  return make("request", "other", true, false, `The API rejected the request (${status}): ${message || "no detail given"}.`);
}
