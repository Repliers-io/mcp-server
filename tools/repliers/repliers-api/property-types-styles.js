/**
 * Function to list property types and styles from the Repliers API.
 *
 * @returns {Promise<Object>} - The result of the property types and styles request.
 */
const executeFunction = async (args, apiKey) => {
  const baseUrl = 'https://api.repliers.io';
  const repliersApiKey = apiKey || process.env.REPLIERS_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${baseUrl}/listings/property-types`;

    // Set up headers for the request
    const headers = {
      'Accept': 'application/json',
      'REPLIERS-API-KEY': repliersApiKey
    };

    // Perform the fetch request
    const response = await fetch(url, {
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
    console.error('Error fetching property types and styles:', error);
    return { error: 'An error occurred while fetching property types and styles.' };
  }
};

/**
 * Tool configuration for listing property types and styles from the Repliers API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'list_property_types_and_styles',
      description: 'List property types and styles from the Repliers API.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
};

export { apiTool };