// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /buildings/{addressKey} (operationId: get_buildings__addressKey)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/buildings/{addressKey}';
  urlPath = urlPath.replace('{addressKey}', encodeURIComponent(String(args.addressKey)));
  const url = new URL(`${baseUrl}${urlPath}`);

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'REPLIERS-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(JSON.stringify(err));
    }

    const data = await response.json();
    return { url: finalUrl, data };
  } catch (error) {
    return { url: finalUrl, error: error.message };
  }
};

export const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: "get-building",
      description: "Use this endpoint to get details about a specific building by its address key.\nThe address key can be found in the `address.addressKey` field of building objects returned by the buildings search endpoint.\n",
      parameters: {
        type: 'object',
        properties: {
          "addressKey": {
            "type": "string",
            "description": "Unique address identifier key for the building. Available from `building.address.addressKey` in search results."
          }
        },
        required: ["addressKey"],
      },
    },
  },
};
