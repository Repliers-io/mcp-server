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
      description: "List past NLP search prompts submitted by a client on the connected account. Use to review a client's natural-language query history. Key params: clientId, nlpId. Operates on the connected account's CRM data.",
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
