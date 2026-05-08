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
    return {
      url: finalUrl,
      data
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
      description: `If the user's message gestures for a listings search, for example 'i'm looking for a home to buy in boston', the parameters of their
      search should be extracted and sent to this endpoint. This endpoint is designed to translate their conversational search into listing results.`,
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "The user's natural language search string.",
          }
         
        },
        required: ["prompt"],
      },
    },
  },
};

export { apiTool };