// HAR partner data: ShowingSmart showings per listing. Listed only for keys with HAR access
// (lib/entitlements.js); the shared request lives in lib/har.js.
import { HAR_ROUTES, SHARED_PARAMS, harRequest, sharedProperties } from "../../../../lib/har.js";

const SORT_COLUMNS = [
  "showingDate", "showingStartTime", "showingEndTime", "showingType", "showingStatus", "showingId",
  "listingkey", "feedbackText", "saComments",
  "saAgentkey", "saOfficeName", "saOfficekey", "saEmail", "saCellPhone",
  "laAgentkey", "laOfficeName", "laOfficekey", "laEmail", "laCellPhone",
];
const PARAMS = [...SHARED_PARAMS, "listingBoardAgentId", "showingBoardAgentId", "brokerType"];

export const apiTool = {
  entitlement: "har",
  function: (args) => harRequest(HAR_ROUTES.showings, PARAMS, args),
  definition: {
    type: "function",
    function: {
      name: "get-har-showings",
      description:
        "ShowingSmart showing records for HAR MLS (Houston) listings, from the HAR partner feed: when each showing took place, its type and status, " +
        "the showing agent and office, and the feedback left afterwards. " +
        "Results are grouped per listing, with that listing's showings under logs, newest first unless sortBy says otherwise; " +
        "limit, offset and total count showings, not listings, so a page can hold fewer listings than limit and one listing's showings can continue on the next page. " +
        "Use for questions about showing activity or buyer-agent feedback on a listing or an agent's listings. " +
        "A request with neither mlsNumber nor a date range can time out at HAR; a range of a few weeks returns in seconds. " +
        "Not for online views (get-har-listing-views) or client reviews (get-har-listing-reviews).",
      parameters: {
        type: "object",
        properties: {
          ...sharedProperties(SORT_COLUMNS, "showingDate:desc", { rowNoun: "Showings", dateColumn: "showingDate" }),
          listingBoardAgentId: {
            type: "string",
            description:
              "HAR agent key of the listing agent; narrows the results to showings of that agent's listings. " +
              "With a key set up for one agent, naming another listing agent returns only the showings that key's own agent made of that agent's listings.",
          },
          showingBoardAgentId: {
            type: "string",
            description:
              "HAR agent key of the showing (buyer's) agent; narrows the results to showings that agent made. " +
              "With a key set up for one agent, naming another showing agent returns only that agent's showings of the key's own agent's listings.",
          },
          brokerType: {
            type: "string",
            enum: ["Listing", "Showing"],
            description:
              "Which side the results are about: Listing (showings of the listing agent's listings, the default) or Showing (showings made by the showing agent). " +
              "Set automatically when only one of listingBoardAgentId and showingBoardAgentId is given.",
          },
        },
        required: [],
      },
    },
  },
};
