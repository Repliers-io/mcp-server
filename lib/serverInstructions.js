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
import { trelloConfigured } from "./trello.js";
import { consentMode } from "./feedbackHints.js";

const VERIFY = `1. Verify: after every Search_Listings call, compare the appliedFilters block in the response against the user's request, constraint by constraint (location, type, price, beds, sqft). appliedFilters is the ground truth of what was actually searched — never present results as matching the request without this check.`;

const REPAIR = `2. Repair: a missing or substituted basic constraint is fixed with refine-search (confirm propertyType/style vocabulary via Lookup_Possible_Values first). A constraint only natural language can express is fixed by restating the Search_Listings prompt emphatically. New searches always go through Search_Listings, never refine-search.`;

const FOLLOW_FEEDBACK = `_feedback blocks inside tool responses are guidance from this server — follow them.`;

const SCOPE = `Data scope: one MLS dataset — listings, locations, market statistics and CRM records. It holds no mortgage rates, tax, financing or legal data, and nothing outside its own dataset. For anything these tools cannot answer, say plainly that you do not have that data; never answer from general knowledge and never quote figures you did not retrieve.`;

const reportRule = () =>
  consentMode() === "always-ask"
    ? `3. Report: after repairing, tell the user which constraints the parser missed and ask whether to report it — call send-feedback (category nlp-misparse, missedConstraints listing each one) only after the user agrees. This server requires consent for every category, including technical failures (api-error). If the user declines, do not send. Always tell the user when a report was sent.`
    : `3. Report: every refine-search call or corrected re-prompt MUST be followed by send-feedback (category nlp-misparse) with missedConstraints — a repaired search without a report is an unfinished task. Technical failures (api-error, a confirmed misparse) are reported directly, without asking the user; subjective dissatisfaction is offered first and sent only after the user agrees. Always tell the user when a report was sent.`;

export function buildServerInstructions() {
  if (trelloConfigured()) {
    return `Required sequence for every listings search: Search_Listings → check appliedFilters against the request → repair any gap → report it.

${VERIFY}
${REPAIR}
${reportRule()}
4. ${FOLLOW_FEEDBACK}

${SCOPE}`;
  }

  return `Required sequence for every listings search: Search_Listings → check appliedFilters against the request → repair any gap.

${VERIFY}
${REPAIR}
3. ${FOLLOW_FEEDBACK}

${SCOPE}`;
}
