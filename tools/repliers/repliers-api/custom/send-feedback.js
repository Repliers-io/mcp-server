import { buildFeedbackCard } from "../../../../lib/feedbackCard.js";
import { createCard, trelloConfigured, autoCaptureConfigured, effectiveCaptureMode } from "../../../../lib/trello.js";

const categories = [
  "nlp-misparse", "empty-results", "wrong-results", "api-error", "user-dissatisfied", "other",
];

const executeFunction = async (args) => {
  if (!categories.includes(args.category)) {
    return { error: `category must be one of: ${categories.join(", ")}` };
  }
  const card = buildFeedbackCard(args);
  const { ok, cardUrl, error } = await createCard(card);
  // The card lands on an internal triage board the end user has no access to. An agent given the
  // link relays it as proof the report went through, leaving a dead link in a conversation about
  // property. Operators get it on stderr; the agent gets a plain, user-safe acknowledgement.
  if (cardUrl) console.error(`[feedback] card created: ${cardUrl}`);
  return {
    url: "https://api.trello.com/1/cards",
    data: ok ? { recorded: true, forUser: "The report was sent to the Repliers team." } : { recorded: false, error },
  };
};

// The automatic-recording sentence is stated only while auto capture can actually happen.
const automatic = autoCaptureConfigured()
  ? " Discarded parameters and Repliers service errors are recorded automatically and need no ticket."
  : "";

const narrowDescription = `Creates a triage ticket for the Repliers team about a search-quality or service problem.${automatic} This tool covers: a report the user asks for; results the user considers wrong (wrong-results, user-dissatisfied, empty-results); a parse correction the user agreed to report (nlp-misparse, with missedConstraints). Required parameters: category, summary, userQuery.`;

// Read at import: a FEEDBACK_AUTO_CAPTURE change needs a restart. =full keeps the pre-2026-10-15 text while capture is on.
const fullDescription = `Creates a triage ticket for the Repliers team about a search-quality or service problem. Failures the server observes itself — Repliers service errors, refine-search corrections, parameters the API discarded, searches restated with repairsNlpId — are recorded automatically and need no ticket. This tool covers what only the conversation shows: a report the user asks for, or results the user considers wrong (wrong-results, user-dissatisfied, empty-results). Required parameters: category, summary, userQuery.`;

const description = effectiveCaptureMode() === "full" ? fullDescription : narrowDescription;

const definition = {
  type: "function",
  function: {
    name: "send-feedback",
    description,
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: categories,
          description: "Problem type for triage.",
        },
        summary: { type: "string", description: "Short problem statement (one sentence)." },
        userQuery: { type: "string", description: "The user's original natural-language request." },
        missedConstraints: {
          type: "array",
          description: "For nlp-misparse: each constraint the parser lost or substituted.",
          items: {
            type: "object",
            properties: {
              constraint: { type: "string", description: "e.g. maxPrice, propertyType" },
              requested: { type: "string", description: "what the user asked for" },
              applied: { type: "string", description: "what the parser actually applied (or 'none')" },
            },
            required: ["constraint", "requested", "applied"],
          },
        },
        toolCalls: {
          type: "array",
          description: "Relevant calls you made: tool name, key params, one-line result summary.",
          items: {
            type: "object",
            properties: {
              tool: { type: "string" },
              params: { type: "object" },
              resultSummary: { type: "string" },
            },
            required: ["tool"],
          },
        },
        nlpId: { type: "string", description: "nlpId from the Search_Listings response, if any." },
        expected: { type: "string", description: "What should have happened." },
      },
      required: ["category", "summary", "userQuery"],
    },
  },
};

// Hidden entirely when the sink is not configured: agents must never offer
// users feedback that goes nowhere.
const apiTool = trelloConfigured() ? { function: executeFunction, definition } : null;

export { apiTool };
