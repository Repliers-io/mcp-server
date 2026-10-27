// Server-side capture (docs/feedback-v2/design.md §6): failures this server observes itself become
// Trello cards without a model call. One card per defect key per 24 h; later instances become
// comments (each prompt is a test case for the NLP team), capped; a breaker caps new cards per hour.
// FEEDBACK_AUTO_CAPTURE=narrow (default) captures only deterministic defects: parameters the API
// discarded, and Repliers service errors; parse corrections (a refine-search call, a restated prompt)
// are offered to the user instead. =full also captures those two parse signals.
// Cards go to their own list (TRELLO_AUTO_LIST_ID), apart from the model-written ones.
import { createCard, addComment, autoCaptureConfigured, effectiveCaptureMode, trelloConfigured } from "./trello.js";

const TTL_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_COMMENTS = 10;
const MAX_CARDS_PER_HOUR = 20;
const MAX_DESC = 16384;
const MAX_PROMPT = 500;
const MAX_SUMMARY_MESSAGE = 200;
const MAX_BODY = 2000;
const PRESENTATION = new Set(["resultsPerPage", "pageNum", "sortBy", "fields"]);
// Response bodies are kept only where they are listing-search output: CRM and message tools return
// client records, which have no place on the triage board.
const BODY_TOOLS = new Set(["Search_Listings", "refine-search"]);

const NLP_ID = /^[A-Za-z0-9-]{1,64}$/;

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max)}…` : text);

// The key must never reach Trello, whole or in part. It is removed from raw values before anything
// is cut, because a cut through the key leaves a prefix no exact-match redaction can find later.
// Covers the forms an echo takes: verbatim, URL-encoded, and escaped inside JSON text.
export function secretScrubber(secret) {
  if (!secret) return (value) => value;
  const forms = [...new Set([secret, encodeURIComponent(secret), JSON.stringify(secret).slice(1, -1)])]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return (value) => (typeof value === "string"
    ? forms.reduce((text, form) => text.split(form).join("[redacted]"), value)
    : value);
}

// Caller text is data on the card, never markup: one line, no way out of the code span, no
// @mention. Applied to every caller-controlled value a builder writes.
const plain = (value) => String(value ?? "")
  .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ")
  .replace(/`/g, "'")
  .replace(/@/g, "＠");
const quote = (value, max = Infinity) => `\`${truncate(plain(value), max)}\``;
const quoteUrl = (value) => {
  let text = String(value ?? "");
  try {
    text = new URL(text).toString();
  } catch {
    // not a URL: quoted as the raw text
  }
  return quote(text);
};

// Error cards record which request failed, not whose data it carried: path and sorted parameter
// names only (design.md §6.4).
function requestShape(raw) {
  try {
    const url = new URL(raw);
    const names = [...new Set(url.searchParams.keys())].sort();
    return names.length ? `${url.pathname}?${names.join("&")}` : url.pathname;
  } catch {
    return String(raw).split(/[?#]/)[0];
  }
}

// Parse signals are shaped by what callers send; error signals by the API's health. Separate
// budgets keep a flood of the first from hiding an outage in the second.
const budgetOf = (key) => (/^(upstream|nlp-scope):/.test(key) ? "error" : "parse");

function card(signal) {
  return {
    name: `[MCP·auto] ${signal.marker} ${truncate(signal.summary, 80)}`,
    desc: [...signal.lines, "", `_Recorded ${new Date().toISOString()}_`].join("\n").slice(0, MAX_DESC),
  };
}

export function createReporter({ trello = { createCard, addComment }, enabled = autoCaptureConfigured, now = Date.now } = {}) {
  const entries = new Map();
  const budgets = { error: { windowStart: -Infinity, cards: 0 }, parse: { windowStart: -Infinity, cards: 0 } };

  function report(signal) {
    if (!enabled()) return { accepted: false, done: Promise.resolve("off") };
    const time = now();
    const existing = entries.get(signal.key);
    if (existing && existing.expires > time) {
      if (existing.comments >= MAX_COMMENTS) return { accepted: true, done: Promise.resolve("suppressed") };
      existing.comments += 1;
      const done = existing.cardId.then((id) => {
        if (!id) {
          // The card this instance was to attach to failed: do not lose the defect, report it afresh.
          existing.comments -= 1;
          return report(signal).done;
        }
        return trello.addComment(id, signal.lines.join("\n").slice(0, MAX_DESC)).then((result) => {
          if (result?.ok) return "comment";
          console.error(`[auto-report] comment on ${id} failed: ${result?.error ?? "unknown error"}`);
          return "failed";
        });
      }).catch((error) => {
        console.error(`[auto-report] comment failed: ${error.message}`);
        return "failed";
      });
      return { accepted: true, done };
    }
    const budget = budgets[budgetOf(signal.key)];
    if (time - budget.windowStart >= HOUR_MS) {
      budget.windowStart = time;
      budget.cards = 0;
    }
    if (budget.cards >= MAX_CARDS_PER_HOUR) {
      console.error(`[auto-report] circuit breaker open (${budgetOf(signal.key)} signals), dropped ${signal.key}`);
      return { accepted: false, done: Promise.resolve("dropped") };
    }
    budget.cards += 1;
    for (const [key, entry] of entries) if (entry.expires <= time) entries.delete(key);
    const entry = { comments: 0, expires: time + TTL_MS };
    entry.cardId = trello.createCard(card(signal), { listId: process.env.TRELLO_AUTO_LIST_ID })
      .then((result) => {
        if (result?.ok && result.cardId) return result.cardId;
        console.error(`[auto-report] card for ${signal.key} failed: ${result?.error ?? "no card id"}`);
        return null;
      })
      .catch((error) => {
        console.error(`[auto-report] card for ${signal.key} failed: ${error.message}`);
        return null;
      })
      .then((id) => {
        // A failed card must not mute the defect for 24 h: forget it so the next instance retries.
        if (!id && entries.get(signal.key) === entry) entries.delete(signal.key);
        return id;
      });
    entries.set(signal.key, entry);
    return { accepted: true, done: entry.cardId.then((id) => (id ? "card" : "failed")) };
  }

  return { report };
}

export const reporter = createReporter();

// Logged once at startup: with the feedback channel configured but no auto list, capture is silently off.
export function autoCaptureNotice() {
  return trelloConfigured() && !autoCaptureConfigured()
    ? "[CONFIG] TRELLO_AUTO_LIST_ID is not set: server-side capture is off; send-feedback still works."
    : null;
}

// ---- signal builders
// Every value a caller or the API shaped goes through `scrub` (the key) first, then `quote`.

const families = (appliedFilters) => new Set(
  Object.entries(appliedFilters ?? {})
    .filter(([name, value]) => !["unrecognized", "other"].includes(name) && value != null)
    .map(([name]) => name)
);

const compact = (lines) => lines.filter((line) => typeof line === "string");

function errorSignal({ toolName, args, result, classification, scrub }) {
  const status = classification.status ?? "network error";
  const message = plain(scrub(classification.message ?? ""));
  const prompt = scrub(args.prompt);
  const body = BODY_TOOLS.has(toolName) && result.body != null ? scrub(JSON.stringify(result.body)) : null;
  return {
    key: classification.kind === "nlp-scope"
      ? `nlp-scope:${message}`
      : `upstream:${toolName}:${classification.status ?? "network"}:${message.slice(0, 80)}`,
    marker: "❌",
    summary: `${toolName} failed: ${truncate(message, MAX_SUMMARY_MESSAGE) || `HTTP ${status}`}`,
    lines: compact([
      `**Signal:** ${classification.kind}`,
      `**Tool:** ${toolName}`,
      `**Status:** ${status}`,
      `**Message:** ${message ? quote(message) : "(empty)"}`,
      `**URL:** ${result.url ? quote(requestShape(scrub(result.url))) : "(none)"}`,
      toolName === "Search_Listings" && prompt && `**Prompt:** ${quote(prompt, MAX_PROMPT)}`,
      body != null && `**Body:** ${quote(truncate(body, MAX_BODY))}`,
    ]),
  };
}

function refineSignal({ args, result, session, scrub }) {
  const origin = session?.searches.get(args.url);
  const set = Object.entries(result.changed.set ?? {}).filter(([name]) => !PRESENTATION.has(name));
  const removed = (result.changed.remove ?? []).filter((name) => !PRESENTATION.has(name));
  const names = [...set.map(([name]) => name), ...removed.map((name) => `-${name}`)].map(plain).sort();
  if (!names.length) return null;
  return {
    key: `refine:${names.join(",")}`,
    marker: "🧩",
    summary: `refine-search corrected ${names.join(", ")}; the original parse missed or mis-mapped it`,
    lines: compact([
      "**Signal:** refine-search correction (probable NLP parse gap)",
      origin?.prompt && `**Prompt:** ${quote(scrub(origin.prompt), MAX_PROMPT)}`,
      origin?.nlpId && `**nlpId:** ${quote(scrub(origin.nlpId))}`,
      `**URL before:** ${quoteUrl(scrub(args.url))}`,
      `**URL after:** ${quoteUrl(scrub(result.url))}`,
      ...set.map(([name, value]) => `- set ${plain(name)} = ${quote(scrub(JSON.stringify(value)))}`),
      ...removed.map((name) => `- removed ${quote(scrub(name))}`),
    ]),
  };
}

function unrecognizedSignal({ args, data, scrub }) {
  const names = [...data.appliedFilters.unrecognized].map((name) => plain(scrub(String(name)))).sort();
  return {
    key: `unrecognized:${names.join(",")}`,
    marker: "🧩",
    summary: `the API discarded ${names.join(", ")} from an NLP-built search`,
    lines: compact([
      "**Signal:** parameters discarded by /listings",
      `**Prompt:** ${quote(scrub(args.prompt), MAX_PROMPT)}`,
      data.nlpId && `**nlpId:** ${quote(scrub(data.nlpId))}`,
      `**URL:** ${data.request?.url ? quoteUrl(scrub(data.request.url)) : "(none)"}`,
      `**Discarded:** ${names.map((name) => quote(name)).join(", ")}`,
    ]),
  };
}

function restatedSignal({ args, data, session, scrub }) {
  const origin = session?.searches.get(args.repairsNlpId);
  const before = families(origin?.appliedFilters);
  const gained = origin ? [...families(data.appliedFilters)].filter((name) => !before.has(name)).map(plain).sort() : [];
  return {
    key: `restated:${gained.length ? gained.join(",") : "unknown"}`,
    marker: "🧩",
    summary: gained.length
      ? `a restated prompt recovered ${gained.join(", ")} that the first parse missed`
      : "a search was restated because its first parse missed a constraint",
    lines: compact([
      "**Signal:** restated search (repairsNlpId)",
      origin
        ? `**First prompt:** ${quote(scrub(origin.prompt), MAX_PROMPT)}`
        : `**First nlpId:** ${quote(scrub(args.repairsNlpId))} (not in this session)`,
      origin?.url && `**First URL:** ${quoteUrl(scrub(origin.url))}`,
      `**Restated prompt:** ${quote(scrub(args.prompt), MAX_PROMPT)}`,
      `**Restated URL:** ${data.request?.url ? quoteUrl(scrub(data.request.url)) : "(none)"}`,
      data.nlpId && `**Restated nlpId:** ${quote(scrub(data.nlpId))}`,
      gained.length > 0 && `**Families gained:** ${gained.join(", ")}`,
    ]),
  };
}

// `secret` is the caller's Repliers key: scrubbed from every raw input before any cut or key.
export function captureSignals({ toolName, args = {}, result, classification, session, secret }) {
  const scrub = secretScrubber(secret);
  if (classification) {
    return classification.capture ? [errorSignal({ toolName, args, result, classification, scrub })] : [];
  }
  const signals = [];
  const full = effectiveCaptureMode() === "full";
  if (full && toolName === "refine-search" && result.constraintPatch !== false && result.changed) {
    const refine = refineSignal({ args, result, session, scrub });
    if (refine) signals.push(refine);
  }
  const data = result.data;
  if (toolName === "Search_Listings" && data && typeof data === "object") {
    if (data.appliedFilters?.unrecognized?.length) signals.push(unrecognizedSignal({ args, data, scrub }));
    // Only a plain id counts: it is caller text that keys a session lookup and lands on the card.
    if (full && typeof args.repairsNlpId === "string" && NLP_ID.test(args.repairsNlpId)) {
      signals.push(restatedSignal({ args, data, session, scrub }));
    }
  }
  return signals;
}
