// lib/serverInstructions.js
//
// The `instructions` string returned by `initialize`. Shaped to OpenAI's plugin guidance, which
// this text used to break in three ways: keep the most important details in the first 512
// characters, use the field for guidance that applies across tools (required tool sequences), and
// do not repeat tool descriptions or try to change the model's personality.
//
// So the role sentence and the tool-family list are gone. The role lives in
// skills/repliers-real-estate/SKILL.md, which is the channel built for workflow and persona
// material — and run 4 had already found the same split empirically: MCP instructions carry facts
// about the data well and personas poorly. The tool list is redundant with the roster itself, and
// on clients that inline these instructions into every tool entry (ChatGPT/Codex code mode) every
// character here is paid ~45 times over.
import { trelloConfigured, autoCaptureConfigured, effectiveCaptureMode } from "./trello.js";

const VERIFY = `1. Verify: after every Search_Listings call, compare the appliedFilters block in the response against the user's request, constraint by constraint (location, type, price, beds, sqft). appliedFilters is the ground truth of what was actually searched — never present results as matching the request without this check.`;

const REPAIR = `2. Repair: a missing or substituted basic constraint is fixed with refine-search (confirm propertyType/style vocabulary via Lookup_Possible_Values first). A constraint only natural language can express is fixed by restating the Search_Listings prompt emphatically. New searches always go through Search_Listings, never refine-search.`;

// FEEDBACK_AUTO_CAPTURE=full keeps the pre-2026-10-15 text: restated searches carry repairsNlpId and
// the server records refine corrections and restated searches itself.
const REPAIR_FULL = `2. Repair: a missing or substituted basic constraint is fixed with refine-search (confirm propertyType/style vocabulary via Lookup_Possible_Values first). A constraint only natural language can express is fixed by restating the Search_Listings prompt emphatically, with the earlier search's nlpId as repairsNlpId. New searches always go through Search_Listings, never refine-search.`;

const REPORT_FULL = `3. Report: failures the server observes (API errors, refine-search corrections, discarded parameters, searches restated with repairsNlpId) are recorded automatically; _feedback and _notice blocks say when. send-feedback covers what only the conversation shows: sent when the user asks, offered when the user is dissatisfied with results.`;

const full = () => effectiveCaptureMode() === "full";
const repair = () => (full() ? REPAIR_FULL : REPAIR);

const FOLLOW_FEEDBACK = `_feedback and _notice blocks inside tool responses are guidance from this server; a _notice forUser text is written for the end user.`;

const SCOPE = `Data scope: one MLS dataset — listings, locations, market statistics and CRM records. It holds no mortgage rates, tax, financing or legal data, and nothing outside its own dataset. For anything these tools cannot answer, say plainly that you do not have that data; never answer from general knowledge and never quote figures you did not retrieve.`;

// Parse corrections are not captured by the server: they are offered to the user (owner decision
// 2026-10-15). The first sentence is dropped when auto capture is off, so the text never promises
// recording that cannot happen.
const RECORDED = `discarded parameters and Repliers service errors are recorded automatically; _feedback and _notice blocks say when. `;
const OFFERED = `Parse corrections — a refine-search call or a restated prompt — are offered to the user and reported with send-feedback (nlp-misparse) once they agree; send-feedback also carries any report the user asks for or dissatisfaction with results.`;

const report = () => (autoCaptureConfigured()
  ? (full() ? REPORT_FULL : `3. Report: ${RECORDED}${OFFERED}`)
  : `3. Report: ${OFFERED.charAt(0).toLowerCase()}${OFFERED.slice(1)}`);

// Shared by both branches: failures are recorded by the server, so reporting is not a step here.
const SEQUENCE = `Required sequence for every listings search: Search_Listings → check appliedFilters against the request → repair any gap.`;

export function buildServerInstructions() {
  if (trelloConfigured()) {
    return `${SEQUENCE}

${VERIFY}
${repair()}
${report()}
4. ${FOLLOW_FEEDBACK}

${SCOPE}`;
  }

  return `${SEQUENCE}

${VERIFY}
${repair()}
3. ${FOLLOW_FEEDBACK}

${SCOPE}`;
}
