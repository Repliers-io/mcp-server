import { geoFilterPresent } from "./appliedFilters.js";
import { trelloConfigured } from "./trello.js";

const searchTools = new Set(["Search_Listings", "refine-search"]);
const oversizedBytes = 1_000_000;

// In always-ask mode no report may be sent without the user's agreement, so the
// shared "then report" clause becomes a "then ask" clause everywhere it appears.
const misparseReport = (ask) =>
  ask
    ? "then tell the user which constraints the parser missed and ask whether to report it — call send-feedback (nlp-misparse) only after they agree"
    : "then report via send-feedback (nlp-misparse)";

const buildNotes = (ask) => ({
  "api-error": ask
    ? "The tool call failed. Tell the user what happened, then ask whether to report it — call send-feedback (category api-error) only after they agree."
    : "The tool call failed. Report this via send-feedback (category api-error) — no need to ask the user first — then tell the user what happened.",
  "zero-results":
    `Zero results. First verify appliedFilters against the user request: if a stated constraint is missing or substituted, repair it (refine-search for basic filters, a restated Search_Listings prompt for semantic ones), ${misparseReport(ask)}. If the parse is correct, the market may genuinely have no matches — say so and offer to send feedback (empty-results).`,
  "no-location-filter":
    `No location filter was applied to this search. If the user named a place, the NLP parse dropped it: repair it (refine-search with city/area/neighborhood, or restate the prompt), ${misparseReport(ask)}.`,
  "oversized-result":
    "This result is very large. Narrow the query (fields, resultsPerPage) before presenting it.",
  refined: ask
    ? "This refine call is itself proof of an NLP parse gap — the parameters you changed were dropped or mis-mapped by the original parse. Present the corrected results, tell the user which constraints the parser missed, and ask whether to report it; call send-feedback (category nlp-misparse, missedConstraints listing each changed parameter) only after they agree."
    : "This refine call is itself proof of an NLP parse gap — the parameters you changed were dropped or mis-mapped by the original parse. Reporting it is a REQUIRED step, not optional: call send-feedback (category nlp-misparse, missedConstraints listing each changed parameter) as your NEXT tool call, then present the corrected results. The task is NOT complete until both the report is sent and the results are presented.",
  verify:
    `Compare appliedFilters against the user request, constraint by constraint (location, type, price, beds…). A missing or substituted constraint means the NLP parse is incomplete: fix it via refine-search or a restated prompt, ${misparseReport(ask)}. If the user seems unsatisfied with the results, offer to send feedback on their behalf.`,
});

export function consentMode() {
  return process.env.FEEDBACK_CONSENT === "always-ask" ? "always-ask" : "auto";
}

export function promptLevel() {
  const level = process.env.FEEDBACK_PROMPT_LEVEL || "high";
  return ["off", "low", "high"].includes(level) ? level : "high";
}

function allCountsZero(data) {
  const counts = [data.count, data.listings?.count].filter((c) => typeof c === "number");
  return counts.length > 0 && counts.every((c) => c === 0);
}

export function augmentResult(toolName, result) {
  try {
    // Suppress hints when Trello is not configured — send-feedback is hidden then.
    if (!trelloConfigured()) return result;
    const level = promptLevel();
    if (level === "off") return result;

    const target =
      result?.data && typeof result.data === "object" && !Array.isArray(result.data)
        ? result.data
        : null;
    if (!target && !result?.error) return result;

    const signals = [];
    if (result.error) signals.push("api-error");
    if (target) {
      if (toolName === "refine-search" && !result.error && result.constraintPatch !== false) {
        signals.push("refined");
      }
      if (searchTools.has(toolName) && allCountsZero(target)) signals.push("zero-results");
      if (
        toolName === "Search_Listings" &&
        target.request?.url &&
        !geoFilterPresent(target.request.url) &&
        !target.request?.body?.queries
      ) {
        signals.push("no-location-filter");
      }
      if (JSON.stringify(target).length > oversizedBytes) signals.push("oversized-result");
    }

    const generic = level === "high" && searchTools.has(toolName);
    if (!signals.length && !generic) return result;

    const notes = buildNotes(consentMode() === "always-ask");
    const noteParts = signals.map((signal) => notes[signal]);
    if (generic) noteParts.push(notes.verify);
    const block = { signals, note: noteParts.join(" ") };
    // Attach to what the handler serializes: result.data if present, else result —
    // and LEAD with it: huge listing payloads get truncated head-first by clients,
    // so a trailing nudge is invisible exactly when it matters most.
    if (target) result.data = { _feedback: block, ...target };
    else result._feedback = block;
    return result;
  } catch {
    // A hint bug must never break the tool response itself.
    return result;
  }
}
