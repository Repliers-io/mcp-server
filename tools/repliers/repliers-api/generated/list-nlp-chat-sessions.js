// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /nlp/chats (operationId: get_nlp_chats)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/nlp/chats`);

  if (args.nlpId !== undefined) url.searchParams.set('nlpId', String(args.nlpId));
  if (args.clientId !== undefined) url.searchParams.set('clientId', String(args.clientId));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.pageNum !== undefined) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.prompts !== undefined) url.searchParams.set('prompts', String(args.prompts));

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
      name: "list-nlp-chat-sessions",
      description: "This endpoint allows you to list and filter all sessions. Each session has a unique nlpId and a session can have many prompts.\n",
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
          },
          "resultsPerPage": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100,
            "default": 100,
            "description": "The number of chats to return per page."
          },
          "pageNum": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "prompts": {
            "type": "boolean",
            "default": null,
            "description": "Fetch all prompts for each of the chats.\n"
          }
        },
        required: [],
      },
    },
  },
};
