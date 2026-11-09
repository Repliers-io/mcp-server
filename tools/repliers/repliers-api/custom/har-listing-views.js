// HAR partner data: daily view counts per listing. Listed only for keys with HAR access
// (lib/entitlements.js); the shared request lives in lib/har.js.
import { HAR_ROUTES, SHARED_PARAMS, harRequest, sharedProperties } from "../../../../lib/har.js";

const SORT_COLUMNS = ["dateTracked", "webView", "mobileView", "mlsNumber", "laAgentkey"];
const PARAMS = [...SHARED_PARAMS, "boardAgentId"];

export const apiTool = {
  entitlement: "har",
  function: (args) => harRequest(HAR_ROUTES.views, PARAMS, args),
  definition: {
    type: "function",
    function: {
      name: "get-har-listing-views",
      description:
        "Daily web and mobile view counts for HAR MLS (Houston) listings, from the HAR partner feed. " +
        "Use to see how much online attention a listing gets, or to compare views across an agent's or brokerage's listings over a date range. " +
        "Each row is one listing on one day (dateTracked, webView, mobileView) with the listing's address, price, beds/baths and first photo. " +
        "Not for showings (get-har-showings) or client reviews (get-har-listing-reviews).",
      parameters: {
        type: "object",
        properties: {
          ...sharedProperties(SORT_COLUMNS, "dateTracked:desc", { dateColumn: "dateTracked (the day the views were counted)" }),
          boardAgentId: {
            type: "string",
            description: "HAR agent key of the listing agent; narrows the rows to that agent's listings. A key set up for one agent is already limited to that agent.",
          },
        },
        required: [],
      },
    },
  },
};
