// HAR partner data: customer-experience ratings of agents. Listed only for keys with HAR access
// (lib/entitlements.js); the shared request lives in lib/har.js.
import { HAR_ROUTES, SHARED_PARAMS, harRequest, sharedProperties } from "../../../../lib/har.js";

const SORT_COLUMNS = [
  "score", "competency", "knowledge", "communication", "myExperience",
  "closedDate", "publishDate", "createdDate", "transactionType",
  "mlsNumber", "agentId", "agentkey", "memberNumber", "agentEmail", "clientName", "clientEmail",
];
const PARAMS = [...SHARED_PARAMS, "boardAgentId"];

export const apiTool = {
  entitlement: "har",
  function: (args) => harRequest(HAR_ROUTES.reviews, PARAMS, args),
  definition: {
    type: "function",
    function: {
      name: "get-har-listing-reviews",
      description:
        "Customer-experience ratings of HAR MLS (Houston) agents, from the HAR partner feed: per closed transaction, the overall score and the " +
        "competency, knowledge, communication and experience ratings, with the client, the transaction type and the listing. " +
        "Use for questions about an agent's client satisfaction or the review of a specific deal. " +
        "Not for online views (get-har-listing-views) or showings (get-har-showings).",
      parameters: {
        type: "object",
        properties: {
          ...sharedProperties(SORT_COLUMNS, "closedDate:desc", { dateColumn: "createdDate (when the client submitted the review, not closedDate)" }),
          boardAgentId: {
            type: "string",
            description: "HAR agent key of the reviewed agent; narrows the ratings to that agent. A key set up for one agent is already limited to that agent.",
          },
        },
        required: [],
      },
    },
  },
};
