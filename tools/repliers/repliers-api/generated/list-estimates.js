// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /estimates (operationId: get-estimates)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/estimates`);

  if (args.clientId !== undefined) url.searchParams.set('clientId', String(args.clientId));
  if (args.estimateId !== undefined) url.searchParams.set('estimateId', String(args.estimateId));
  if (args.pageNum !== undefined) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));

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
      name: "list-estimates",
      description: "Returns a list of property value estimates you've created. Useful for managing and reviewing estimates across multiple properties.",
      parameters: {
        type: 'object',
        properties: {
          "clientId": {
            "type": "integer",
            "format": "int32",
            "description": "If specified, filters estimates by clientId"
          },
          "estimateId": {
            "type": "integer",
            "format": "int32",
            "description": "If specified, filters estimates by estimateId"
          },
          "pageNum": {
            "type": "integer",
            "format": "int32",
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "resultsPerPage": {
            "type": "integer",
            "format": "int32",
            "description": "The number of estimates to return per page."
          }
        },
        required: [],
      },
    },
  },
};
