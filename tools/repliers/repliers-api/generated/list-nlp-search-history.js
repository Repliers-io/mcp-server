// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /nlp (operationId: get_nlp)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/nlp`);

  if (args.nlpId !== undefined) url.searchParams.set('nlpId', String(args.nlpId));
  if (args.clientId !== undefined) url.searchParams.set('clientId', String(args.clientId));

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
      name: "list-nlp-search-history",
      description: "This endpoint allows you to list and filter prompts across all sessions.\n",
      parameters: {
        type: 'object',
        properties: {
          "nlpId": {
            "type": "string",
            "description": "Unique identifier for the NLP session."
          },
          "clientId": {
            "type": "string",
            "description": "Filter sessions based on the `clientId` to see all NLP sessions associated with a specific client."
          }
        },
        required: [],
      },
    },
  },
};
