/**
 * Function to retrieve deleted listings from the Repliers API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.updatedOn - The date when the listing was updated.
 * @param {string} args.minUpdatedOn - The minimum date for updated listings.
 * @param {string} args.maxUpdatedOn - The maximum date for updated listings.
 * @returns {Promise<Object>} - The response from the Repliers API containing deleted listings.
 */
const executeFunction = async ({ updatedOn, minUpdatedOn, maxUpdatedOn }, apiKey) => {
  const baseUrl = 'https://api.repliers.io';
  const repliersApiKey = apiKey || process.env.REPLIERS_API_KEY;

  try {
    // Construct the URL with query parameters
    const url = new URL(`${baseUrl}/listings/deleted`);
    url.searchParams.append('updatedOn', updatedOn);
    url.searchParams.append('minUpdatedOn', minUpdatedOn);
    url.searchParams.append('maxUpdatedOn', maxUpdatedOn);

    // Set up headers for the request
    const headers = {
      'Accept': 'application/json',
      'REPLIERS-API-KEY': repliersApiKey
    };

    // Perform the fetch request
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving deleted listings:', error);
    return { error: 'An error occurred while retrieving deleted listings.' };
  }
};

/**
 * Tool configuration for retrieving deleted listings from the Repliers API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_deleted_listings',
      description: 'Retrieve deleted listings from the Repliers API.',
      parameters: {
        type: 'object',
        properties: {
          updatedOn: {
            type: 'string',
            description: 'The date when the listing was updated.'
          },
          minUpdatedOn: {
            type: 'string',
            description: 'The minimum date for updated listings.'
          },
          maxUpdatedOn: {
            type: 'string',
            description: 'The maximum date for updated listings.'
          }
        },
        required: ['updatedOn', 'minUpdatedOn', 'maxUpdatedOn']
      }
    }
  }
};

export { apiTool };