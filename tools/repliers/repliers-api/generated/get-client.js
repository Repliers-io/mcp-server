// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /clients/{clientId} (operationId: get-a-client)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/clients/{clientId}';
  urlPath = urlPath.replace('{clientId}', encodeURIComponent(String(args.clientId)));
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
      name: "get-client",
      description: "Returns the full profile of a specific client, including their contact information, preferences, and tags.",
      parameters: {
        type: 'object',
        properties: {
          "clientId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          }
        },
        required: ["clientId"],
      },
    },
  },
};
