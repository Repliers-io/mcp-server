import { geoFilterPresent } from "./appliedFilters.js";
import { trelloConfigured, effectiveCaptureMode } from "./trello.js";

const searchTools = new Set(["Search_Listings", "refine-search"]);
const oversizedBytes = 1_000_000;
// Patching only these does not imply an NLP misparse.
const presentationParams = new Set(["resultsPerPage", "pageNum", "sortBy", "fields"]);

const notes = {
  "zero-results":
    "Zero results. If appliedFilters matches the request, the market may simply have no matches; a constraint missing from appliedFilters, or substituted there, was not applied as asked — refine-search repairs a basic filter, a restated Search_Listings prompt repairs the rest.",
  "no-location-filter":
    "No location filter was applied to this search. If the user named a place, the parse dropped it; refine-search with city, area or neighborhood, or a restated prompt, restores it.",
  "oversized-result":
    "This result is very large; narrowing the query (fields, resultsPerPage) keeps it readable.",
  verify:
    "appliedFilters shows what was actually searched; a constraint from the request that is missing or substituted there was not applied. If the user is unsatisfied with the results, send-feedback can carry their report.",
};

// A refine-search call that changed a constraint is a probable parse gap. Capturing it automatically
// would flood the board with caller-shaped cards, so the model is told it can be reported instead.
function refinedNote(result) {
  if (result?.constraintPatch === false || !result?.changed) return null;
  const set = Object.keys(result.changed.set ?? {}).filter((name) => !presentationParams.has(name));
  const removed = (result.changed.remove ?? []).filter((name) => !presentationParams.has(name));
  const names = [...set, ...removed.map((name) => `${name} (removed)`)];
  if (!names.length) return null;
  return `This call changed ${names.join(", ")}, which the original parse missed or mis-mapped. send-feedback (category nlp-misparse, missedConstraints) can report it to the Repliers team if the user agrees.`;
}

// Full capture mode keeps the pre-2026-10-15 wording, where a restated prompt carries repairsNlpId.
const FULL_ZERO = notes["zero-results"].replace("a restated Search_Listings prompt repairs the rest.", "a restated Search_Listings prompt with repairsNlpId repairs the rest.");

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
    // Errors are the call path's job: it attaches a _notice.
    if (result?.error) return result;

    const target =
      result?.data && typeof result.data === "object" && !Array.isArray(result.data)
        ? result.data
        : null;
    if (!target) return result;

    const signals = [];
    const noteBySignal = { ...notes };
    if (effectiveCaptureMode() === "full") noteBySignal["zero-results"] = FULL_ZERO;
    // In full mode the server records the correction itself ("recorded" note), so nothing is offered.
    if (toolName === "refine-search" && effectiveCaptureMode() === "narrow") {
      const refined = refinedNote(result);
      if (refined) {
        signals.push("refined");
        noteBySignal.refined = refined;
      }
    }
    if (target) {
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

    const noteParts = signals.map((signal) => noteBySignal[signal]);
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
