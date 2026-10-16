import { apiHeaders, readFailure, errorMessage } from "../../../../lib/apiRequest.js";
import { apiBaseUrl } from "../../../../lib/apiBase.js";
import { parseAppliedFilters } from "../../../../lib/appliedFilters.js";
import { autoCaptureConfigured, effectiveCaptureMode } from "../../../../lib/trello.js";

/**
 * Function to search listings using the Repliers API.
 *
 * @param {Object} args - Arguments for searching listings.
 * @param {string} args.prompt - The user's natural language search string.
 * @param {boolean} args.listings - Should always be true to return listing results.
 * @returns {Promise<Object>} - The result of the search.
 */
const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  let finalUrl; // Declare here to use in error handling
  
  try {
    // Construct the URL
    const url = new URL(`${baseUrl}/nlp?nlpVersion=3`);
    
    finalUrl = url.toString(); // Capture the final URL
    
    // Perform the fetch request with body
    const response = await fetch(finalUrl, {
      method: "POST",
      headers: apiHeaders(args, { json: true }),
      body: JSON.stringify({
        prompt: args.prompt,
        listings: true
      })
    });
    
    // Check if the response was successful
    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return { url: finalUrl, error: errorMessage(body) || `HTTP ${status}`, status, body };
    }
    
    // Parse and return the response data
    const data = await response.json();
    const requestUrl = data.request?.url || null;
    const { appliedFilters: _af, complexQuery: _cq, ...rest } = data;
    return {
      url: finalUrl,
      data: {
        appliedFilters: requestUrl
          ? parseAppliedFilters(requestUrl, data.listings?.unrecognizedParams)
          : null,
        complexQuery: Boolean(data.request?.body?.queries),
        ...rest,
      },
    };
  } catch (error) {
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
};

/**
 * Tool configuration for searching listings using the Repliers API.
 * @type {Object}
 */
// Read at import: a FEEDBACK_AUTO_CAPTURE change needs a restart. Effective full mode (requested and
// capture on) restores repairsNlpId and the claim that restated searches are recorded.
const full = effectiveCaptureMode() === "full";
const recording = autoCaptureConfigured()
  ? (full ? " Discarded parameters and restated searches are recorded for the Repliers team." : " Discarded parameters are recorded for the Repliers team.")
  : "";
const repair = full
  ? "a restated prompt with repairsNlpId repairs a semantic one"
  : "a restated prompt repairs a semantic one";

const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "Search_Listings",
      description: `Natural-language listings search — the entry point for every new property search. Takes the user's request as a plain-English prompt (translated if needed); the NLP engine converts it into API filters and returns listings. Response contract: appliedFilters (leading block) shows which filters were actually applied, family by family (location, propertyType, style, priceRange, bedrooms… — null means not applied); appliedFilters.unrecognized lists parameters the API discarded — a constraint named there was NOT searched, however complete the rest of the block looks; complexQuery=true marks a multi-query union search that refine-search cannot patch; nlpId identifies this parse. The parser sometimes drops or substitutes constraints, so appliedFilters is the check before results are presented as matching: refine-search repairs a basic filter, and ${repair}.${recording}`,
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "The user's natural language search string. Pass the place names the user actually said and nothing more — do not add a parent city, area, state or country you inferred, and do not carry a location from a previous search onto a new place name. Neighborhood names repeat across cities in this dataset, so an invented parent yields the wrong geography or none; resolve ambiguous places with search-locations first.",
          },
          ...(full && {
            repairsNlpId: {
              type: "string",
              description: "nlpId of an earlier Search_Listings call that this call restates because its parse missed a constraint. Omit for a new search.",
            },
          }),
        },
        required: ["prompt"],
      },
    },
  },
};

export { apiTool };