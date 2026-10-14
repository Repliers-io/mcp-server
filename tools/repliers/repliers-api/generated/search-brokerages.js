// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /brokerages (operationId: brokerages)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/brokerages`);

  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.keywords != null) url.searchParams.set('keywords', String(args.keywords));
  if (args.boardId != null) url.searchParams.set('boardId', String(args.boardId));

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
      name: "search-brokerages",
      description: "List all brokerages registered with the MLS on the connected account. Use to build a brokerage directory or populate a brokerage filter dropdown. No filter params available — returns the full list. NOT for searching individual agents or offices — use search-members or search-offices. If results look wrong or incomplete — see send-feedback.",
      parameters: {
        type: 'object',
        properties: {
          "pageNum": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "Page number for paginated results."
          },
          "resultsPerPage": {
            "type": "integer",
            "minimum": 1,
            "default": 100,
            "description": "Number of results to return per page."
          },
          "keywords": {
            "type": "string",
            "description": "If supplied, filters brokerages by the supplied value."
          },
          "boardId": {
            "type": "string",
            "description": "Filters brokerages by MLS board. Required if your API key has access to more than one MLS board. Find your boardId by visiting https://login.repliers.com/dashboard/data-access"
          }
        },
        required: [],
      },
    },
  },
};
