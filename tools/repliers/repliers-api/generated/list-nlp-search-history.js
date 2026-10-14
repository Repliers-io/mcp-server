// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /nlp (operationId: get_nlp)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/nlp`);

  if (args.nlpId != null) url.searchParams.set('nlpId', String(args.nlpId));
  if (args.clientId != null) url.searchParams.set('clientId', String(args.clientId));
  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));

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
            "type": "integer",
            "description": "Filter sessions based on the `clientId` to see all NLP sessions associated with a specific client."
          },
          "pageNum": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "resultsPerPage": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100,
            "default": 100,
            "description": "The number of prompts to return per page."
          }
        },
        required: [],
      },
    },
  },
};
