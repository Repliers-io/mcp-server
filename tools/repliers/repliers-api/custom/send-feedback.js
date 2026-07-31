import { buildFeedbackCard } from "../../../../lib/feedbackCard.js";
import { createCard, trelloConfigured } from "../../../../lib/trello.js";

const categories = [
  "nlp-misparse", "empty-results", "wrong-results", "api-error", "user-dissatisfied", "other",
];

const executeFunction = async (args) => {
  if (!categories.includes(args.category)) {
    return { error: `category must be one of: ${categories.join(", ")}` };
  }
  const card = buildFeedbackCard(args);
  const result = await createCard(card);
  return { url: "https://api.trello.com/1/cards", data: result };
};

const definition = {
  type: "function",
  function: {
    name: "send-feedback",
    description: `Report a search-quality or API problem to the Repliers team (creates a triage ticket). WHEN TO USE — technical failures, report directly without asking the user (the report contains nothing beyond what was already sent to the API): a tool returned an error (category api-error); you confirmed the NLP parse dropped or substituted a user constraint, after repairing it via refine-search or a restated prompt (category nlp-misparse — include missedConstraints). Subjective problems — OFFER first, send after the user agrees: results formally match but the user says they are wrong (wrong-results / user-dissatisfied); an empty result set that looks legitimate (empty-results). Always send when the user explicitly asks to report an issue, and always tell the user when a report was sent. Repair first, report second: feedback never replaces serving the user.`,
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
