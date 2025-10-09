/**
 * Function to find similar listings using the Repliers API.
 *
 * @param {Object} args - Arguments for finding similar listings.
 * @param {string} args.mlsNumber - The MLS number of the listing to find similar listings for.
 * @param {number[]} [args.boardId] - Filter by one or more board IDs.
 * @param {string} [args.fields] - Limit the response to specific fields (e.g., "listPrice,soldPrice" or "images[5]").
 * @param {number} [args.listPriceRange] - Returns similar listings within a price range (e.g., 250000 for +/- $250,000).
 * @param {number} [args.radius] - Show similar listings within a specified radius in kilometers.
 * @param {string} [args.sortBy] - Sort similar listings by a specific field (e.g., "updatedOnDesc", "createdOnAsc").
 * @returns {Promise<Object>} - The result of finding similar listings.
 */
const executeFunction = async (args, apiKey) => {
  const baseUrl = 'https://api.repliers.io';
  const repliersApiKey = apiKey || process.env.REPLIERS_API_KEY;

  try {
    // Construct the URL for finding similar listings
    const url = new URL(`${baseUrl}/listings/${args.mlsNumber}/similar`);

    // Add query parameters if provided
    if (args.boardId) {
      args.boardId.forEach((id) => url.searchParams.append('boardId', id));
    }
    if (args.fields) {
      url.searchParams.set('fields', args.fields);
    }
    if (args.listPriceRange) {
      url.searchParams.set('listPriceRange', args.listPriceRange);
    }
    if (args.radius) {
      url.searchParams.set('radius', args.radius);
    }
    if (args.sortBy) {
      url.searchParams.set('sortBy', args.sortBy);
    }

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
      throw new Error(JSON.stringify(errorData));
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error finding similar listings:', error);
    return { error: 'An error occurred while finding similar listings.' };
  }
};

/**
 * Tool configuration for finding similar listings using the Repliers API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'find_similar_listings',
      description: 'Find similar listings using the MLS number.',
      parameters: {
        type: 'object',
        properties: {
          mlsNumber: {
            type: 'string',
            description: 'The MLS number of the listing to find similar listings for.'
          },
          boardId: {
            type: 'array',
            items: {
              type: 'number'
            },
            description: 'Filter by one or more board IDs.'
          },
          fields: {
            type: 'string',
            description: 'Limit the response to specific fields (e.g., "listPrice,soldPrice" or "images[5]").'
          },
          listPriceRange: {
            type: 'number',
            description: 'Returns similar listings within a price range (e.g., 250000 for +/- $250,000).'
          },
          radius: {
            type: 'number',
            description: 'Show similar listings within a specified radius in kilometers.'
          },
          sortBy: {
            type: 'string',
            description: 'Sort similar listings by a specific field (e.g., "updatedOnDesc", "createdOnAsc").',
            enum: ['updatedOnDesc', 'updatedOnAsc', 'createdOnAsc', 'createdOnDesc']
          }
        },
        required: ['mlsNumber']
      }
    }
  }
};

export { apiTool };