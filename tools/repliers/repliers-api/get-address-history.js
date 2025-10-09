/**
 * Function to get the address history from the Repliers API.
 *
 * @param {Object} args - Arguments for the address history request.
 * @param {string} args.city - The city of the property (required).
 * @param {string} args.streetName - The street name of the property (required).
 * @param {string} args.streetNumber - The street number of the property (required).
 * @param {string} [args.unitNumber] - The unit number of the property (optional).
 * @param {string} [args.streetSuffix] - The street suffix of the property (optional).
 * @param {string} [args.streetDirection] - The street direction of the property (optional).
 * @param {string} args.zip - The zip code of the property (required).
 * @returns {Promise<Object>} - The result of the address history request.
 */
const executeFunction = async (args, apiKey) => {  // Fixed parameter destructuring
  const baseUrl = "https://api.repliers.io";
  const repliersApiKey = apiKey || process.env.REPLIERS_API_KEY;
  let finalUrl;

  try {
    const url = new URL(`${baseUrl}/listings`);
    url.searchParams.set("city", args.city);
    url.searchParams.set("streetName", args.streetName);
    url.searchParams.set("streetNumber", args.streetNumber);
    if (args.unitNumber) url.searchParams.set("unitNumber", args.unitNumber);
    if (args.streetSuffix) url.searchParams.set("streetSuffix", args.streetSuffix);
    if (args.streetDirection) url.searchParams.set("streetDirection", args.streetDirection);
    url.searchParams.set("zip", args.zip);

    finalUrl = url.toString();
    const headers = { 
      Accept: "application/json",
      "REPLIERS-API-KEY": repliersApiKey
    };

    // Fixed fetch call - removed invalid 'url' property
    const response = await fetch(finalUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { url: finalUrl, error: errorData };
    }

    const data = await response.json();
    return { url: finalUrl, data };
  } catch (error) {
    console.error("Error getting address history:", error);
    return { 
      url: finalUrl,
      error: "An error occurred while retrieving the address history.",
      details: error.message 
    };
  }
};

/**
 * Tool configuration for getting address history from the Repliers API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "get_address_history",
      description: "Retrieve the MLS history of a specific address.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "The city of the property." },
          streetName: { type: "string", description: "The street name of the property." },
          streetNumber: { type: "string", description: "The street number of the property." },
          unitNumber: { type: "string", description: "The unit number of the property." },
          streetSuffix: { type: "string", description: "The street suffix of the property." },
          streetDirection: { type: "string", description: "The street direction of the property." },
          zip: { type: "string", description: "The zip code of the property." },
        },
        required: ["city", "streetName", "streetNumber", "zip"],
      },
    },
  },
};

export { apiTool };