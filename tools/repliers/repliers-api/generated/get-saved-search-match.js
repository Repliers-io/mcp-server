// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /searches/{searchId}/matches/{matchId} (operationId: get-a-match)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/searches/{searchId}/matches/{matchId}';
  urlPath = urlPath.replace('{searchId}', encodeURIComponent(String(args.searchId)));
  urlPath = urlPath.replace('{matchId}', encodeURIComponent(String(args.matchId)));
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
      name: "get-saved-search-match",
      description: "Returns the details of a specific listing match within a saved search, including the listing data and the match's viewed and liked status.",
      parameters: {
        type: 'object',
        properties: {
          "searchId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "matchId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          }
        },
        required: ["searchId","matchId"],
      },
    },
  },
};
