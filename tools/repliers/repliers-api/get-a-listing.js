/**
 * Function to get a listing using the MLS number and board ID from the Repliers API.
 *
 * @param {Object} args - Arguments for getting the listing.
 * @param {string} args.mlsNumber - The MLS number of the listing to retrieve.
 * @param {number} [args.boardId] - Filter by boardId if required.
 * @returns {Promise<Object>} - The result of getting the listing.
 */
const executeFunction = async (args) => {
  const baseUrl = "https://api.repliers.io";
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;
  let finalUrl; // Declare here to use in error handling

  try {
    // Construct the URL with the MLS number and optional board ID, required if the account has access to more than one board
    const url = new URL(`${baseUrl}/listings`);
    if (args.boardId) {
      url.searchParams.set("boardId", args.boardId);
    }
    url.pathname += `/${args.mlsNumber}`;

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
    console.error("Error getting the listing:", error);
    return {
      error: "An error occurred while getting the listing.",
      details: error.message,
      url: finalUrl
    };
  }
};

/**
 * Tool configuration for getting a listing using the Repliers API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "get_listing",
      description: "Get a listing using the MLS.",
      parameters: {
        type: "object",
        properties: {
          mlsNumber: {
            type: "string",
            description: "The MLS number of the listing you wish to retrieve.",
          },
          boardId: {
            type: "number",
            description:
              "Filter by boardId. This is only required if your account has access to more than one MLS.",
          },
        },
        required: ["mlsNumber"],
      },
    },
  },
};

export { apiTool };
