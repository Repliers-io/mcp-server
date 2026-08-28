import { geoFilterPresent } from "./appliedFilters.js";
import { trelloConfigured } from "./trello.js";

const searchTools = new Set(["Search_Listings", "refine-search"]);
const oversizedBytes = 1_000_000;

const notes = {
  "api-error":
    "The tool call failed. Report this via send-feedback (category api-error) — no need to ask the user first — then tell the user what happened.",
  "zero-results":
    "Zero results. First verify appliedFilters against the user request: if a stated constraint is missing or substituted, repair it (refine-search for basic filters, a restated Search_Listings prompt for semantic ones), then report via send-feedback (nlp-misparse). If the parse is correct, the market may genuinely have no matches — say so and offer to send feedback (empty-results).",
  "no-location-filter":
    "No location filter was applied to this search. If the user named a place, the NLP parse dropped it: repair it (refine-search with city/area/neighborhood, or restate the prompt), then report via send-feedback (nlp-misparse).",
  "oversized-result":
    "This result is very large. Narrow the query (fields, resultsPerPage) before presenting it.",
  refined:
    "This refine call is itself confirmation of an NLP parse gap — the parameters you changed were dropped or mis-mapped by the original parse. After presenting the corrected results, report the gap via send-feedback (category nlp-misparse) with missedConstraints listing each changed parameter.",
  verify:
    "Compare appliedFilters against the user request, constraint by constraint (location, type, price, beds…). A missing or substituted constraint means the NLP parse is incomplete: fix it via refine-search or a restated prompt, then report via send-feedback (nlp-misparse). If the user seems unsatisfied with the results, offer to send feedback on their behalf.",
};

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
      if (toolName === "refine-search" && !result.error) signals.push("refined");
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

    const noteParts = signals.map((signal) => notes[signal]);
    if (generic) noteParts.push(notes.verify);
    const block = { signals, note: noteParts.join(" ") };
    // Attach to what the handler serializes: result.data if present, else result.
    if (target) target._feedback = block;
    else result._feedback = block;
    return result;
  } catch {
    // A hint bug must never break the tool response itself.
    return result;
  }
}
