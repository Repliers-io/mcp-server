/**
 * Function to get enumerated values using the Repliers API.
 *
 * @param {Object} args - Arguments for getting enumerated values.
 * @param {string} args.aggregates - Comma-separated list of fields to get enumerated values for.
 * @param {boolean} args.listings - Should always be false when getting enumerated values.
 * @returns {Promise<Object>} - The result of getting the enumerated values.
 */
const executeFunction = async (args) => {
  const baseUrl = "https://api.repliers.io";
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;
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
    
    // Set up headers for the request
    const headers = {
      Accept: "application/json",
      "REPLIERS-API-KEY": apiKey,
    };
    
    finalUrl = url.toString(); // Capture the final URL
    
    // Perform the fetch request
    const response = await fetch(finalUrl, {
      method: "GET",
      headers,
    });
    
    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(JSON.stringify(errorData));
    }
    
    // Parse and return the response data
    const data = await response.json();
    return {
      url: finalUrl,
      data
    };
  } catch (error) {
    console.error("Error getting the enumerated values:", error);
    return {
      error: "An error occurred while getting the enumerated values.",
      details: error.message,
      url: finalUrl
    };
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
      description: `It's important that values passed into parameters when fetching statistics
                    are valid. If they're not, for example if propertyType=tree house is specified and
                    that's not a possible value for details.propertyType then the statistics will not have any results.
                    The aggregates feature provides enumerated values to ensure accuracy in requests. Values that don't exist should never be used in statistics parameters.
                    Best practice is to use this prior to getting statistics, so that you know what values to work with when structuring the statistics request.
                    `,
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