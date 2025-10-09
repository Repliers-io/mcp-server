/**
 * Function to list geographical location data such as areas, cities, and neighborhoods.
 *
 * @param {Object} args - Arguments for the location listing.
 * @param {string} [args.area] - Limits location metadata to areas matching the supplied value.
 * @param {string} [args.city] - Limits location metadata to cities matching the supplied value.
 * @param {string} [args.class] - Limits location metadata to classes matching the supplied value.
 * @param {string} [args.neighborhood] - Limits location metadata to neighborhoods matching the supplied value.
 * @param {string} [args.search] - Limits location metadata to areas, cities, or neighborhoods that match or partially match the supplied value.
 * @returns {Promise<Object>} - The result of the location listing.
 */
const executeFunction = async ({ area, city, class: locationClass, neighborhood, search }, apiKey) => {
  const baseUrl = 'https://api.repliers.io';
  const repliersApiKey = apiKey || process.env.REPLIERS_API_KEY;
  try {
    // Construct the URL with query parameters
    const url = new URL(`${baseUrl}/listings/locations`);
    if (area) url.searchParams.append('area', area);
    if (city) url.searchParams.append('city', city);
    if (locationClass) url.searchParams.append('class', locationClass);
    if (neighborhood) url.searchParams.append('neighborhood', neighborhood);
    if (search) url.searchParams.append('search', search);

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
    console.error('Error fetching location data:', error);
    return { error: 'An error occurred while fetching location data.' };
  }
};

/**
 * Tool configuration for listing geographical locations.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'list_locations',
      description: 'List geographical location data such as areas, cities, and neighborhoods.',
      parameters: {
        type: 'object',
        properties: {
          area: {
            type: 'string',
            description: 'Limits location metadata to areas matching the supplied value.'
          },
          city: {
            type: 'string',
            description: 'Limits location metadata to cities matching the supplied value.'
          },
          class: {
            type: 'string',
            description: 'Limits location metadata to classes matching the supplied value.'
          },
          neighborhood: {
            type: 'string',
            description: 'Limits location metadata to neighborhoods matching the supplied value.'
          },
          search: {
            type: 'string',
            description: 'Limits location metadata to areas, cities, or neighborhoods that match or partially match the supplied value.'
          }
        }
      }
    }
  }
};

export { apiTool };