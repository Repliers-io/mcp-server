import { parseAppliedFilters } from "../../../../lib/appliedFilters.js";

/**
 * Function to search listings using the Repliers API.
 *
 * @param {Object} args - Arguments for searching listings.
 * @param {string} args.prompt - The user's natural language search string.
 * @param {boolean} args.listings - Should always be true to return listing results.
 * @returns {Promise<Object>} - The result of the search.
 */
const executeFunction = async (args) => {
  const baseUrl = "https://api.repliers.io";
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;
  let finalUrl; // Declare here to use in error handling
  
  try {
    // Construct the URL
    const url = new URL(`${baseUrl}/nlp?nlpVersion=3`);
    
    // Set up headers for the request
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "REPLIERS-API-KEY": apiKey,
    };
    
    finalUrl = url.toString(); // Capture the final URL
    
    // Perform the fetch request with body
    const response = await fetch(finalUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: args.prompt,
        listings: true
      })
    });
    
    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(JSON.stringify(errorData));
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
    return {
      error: "An error occurred while searching listings.",
      details: error.message,
      url: finalUrl
    };
  }
};

/**
 * Tool configuration for searching listings using the Repliers API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "Search_Listings",
      description: `Natural-language listings search — the entry point for ALL new property searches. Pass the user's request as a plain-English prompt (translate if needed); the NLP engine converts it into API filters and returns listings. RESPONSE CONTRACT: appliedFilters (leading block) shows which filters were ACTUALLY applied, family by family (location, propertyType, style, priceRange, bedrooms…— null means not applied); appliedFilters.unrecognized lists parameters the API discarded — a constraint named there was NOT searched however convincing the rest of the block looks, so treat it exactly like a dropped constraint: repair it (correct parameter name via refine-search) and report it; complexQuery=true means a multi-query union search that refine-search cannot patch; nlpId correlates with server logs — include it in send-feedback reports. ALWAYS verify appliedFilters against the user's request before presenting results: the parser sometimes drops or substitutes constraints. Missing/wrong basic filter → fix via refine-search; dropped semantic constraint → re-run with it restated emphatically; then report via send-feedback (nlp-misparse). If results look wrong or incomplete — see send-feedback.`,
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "The user's natural language search string. Pass the place names the user actually said and nothing more — do not add a parent city, area, state or country you inferred, and do not carry a location from a previous search onto a new place name. Neighborhood names repeat across cities in this dataset, so an invented parent yields the wrong geography or none; resolve ambiguous places with search-locations first.",
          }
         
        },
        required: ["prompt"],
      },
    },
  },
};

export { apiTool };