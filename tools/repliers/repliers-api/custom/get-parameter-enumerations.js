import { apiHeaders, readFailure, errorMessage } from "../../../../lib/apiRequest.js";
import { apiBaseUrl } from "../../../../lib/apiBase.js";
/**
 * Function to get enumerated values using the Repliers API.
 *
 * @param {Object} args - Arguments for getting enumerated values.
 * @param {string} args.aggregates - Comma-separated list of fields to get enumerated values for.
 * @param {boolean} args.listings - Should always be false when getting enumerated values.
 * @returns {Promise<Object>} - The result of getting the enumerated values.
 */
const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  let finalUrl; // Declare here to use in error handling
  
  try {
    // Construct the URL
    const url = new URL(`${baseUrl}/listings`);
    
    // Add the parameters directly from args
    if (args.aggregates !== undefined && args.aggregates !== null) {
      url.searchParams.set('aggregates', String(args.aggregates));
    }
    
    if (args.listings !== undefined && args.listings !== null) {
      url.searchParams.set('listings', String(args.listings));
    }
    
    finalUrl = url.toString(); // Capture the final URL
    
    // Perform the fetch request
    const response = await fetch(finalUrl, {
      method: "GET",
      headers: apiHeaders(args),
    });
    
    // Check if the response was successful
    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return { url: finalUrl, error: errorMessage(body) || `HTTP ${status}`, status, body };
    }
    
    // Parse and return the response data
    const data = await response.json();
    return {
      url: finalUrl,
      data
    };
  } catch (error) {
    console.error("Error getting the enumerated values:", error);
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
};

/**
 * Tool configuration for getting enumerated values using the Repliers API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "Lookup_Possible_Values",
      description: `Returns the enumerated values this board actually uses for listing fields (via aggregates on /listings). Boards use exact vocabulary — e.g. 'Att/Row/Twnhouse', not 'Townhouse'. USE BEFORE: (1) refine-search calls that set propertyType/style — pass aggregates=details.propertyType,details.style and pick the exact string; (2) Market_Statistics requests, so filter values are valid (invalid values return empty statistics). Set listings=false to fetch only the value lists.`,
      parameters: {
        type: "object",
        properties: {
          aggregates: {
            type: "string",
            description: "A comma-separated list of fields that you want to get enumerated values for, for example 'details.propertyType,address.neighborhood,details.swimmingPool'",
          },
          listings: {
            type: "boolean",
            description: "Always set to false when getting enumerated values.",
          },
        },
        required: ["aggregates", "listings"],
      },
    },
  },
};

export { apiTool };