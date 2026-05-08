// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /searches (operationId: filter-searches)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/searches`);

  if (args.agentId !== undefined) url.searchParams.set('agentId', String(args.agentId));
  if (args.clientId !== undefined) url.searchParams.set('clientId', String(args.clientId));
  if (args.pageNum !== undefined) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.searchId !== undefined) url.searchParams.set('searchId', String(args.searchId));
  if (args.status !== undefined) url.searchParams.set('status', String(args.status));

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
      name: "list-saved-searches",
      description: "Returns a list of saved searches. Use this to display a client's active searches, or to audit searches across multiple agents.",
      parameters: {
        type: 'object',
        properties: {
          "agentId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "clientId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "pageNum": {
            "type": "integer",
            "format": "int32",
            "default": 1,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "resultsPerPage": {
            "type": "integer",
            "format": "int32",
            "default": 100,
            "description": "The number of searches to return per page."
          },
          "searchId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "status": {
            "type": "boolean",
            "description": ""
          }
        },
        required: [],
      },
    },
  },
};
