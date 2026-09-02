// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /favorites (operationId: get-favorites)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/favorites`);

  if (args.boardId !== undefined) url.searchParams.set('boardId', String(args.boardId));
  if (args.clientId !== undefined) url.searchParams.set('clientId', String(args.clientId));
  if (args.fields !== undefined) url.searchParams.set('fields', String(args.fields));
  if (args.lastStatus !== undefined) args.lastStatus.forEach(v => url.searchParams.append('lastStatus', String(v)));
  if (args.pageNum !== undefined) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.status !== undefined) url.searchParams.set('status', String(args.status));
  if (args.tags !== undefined) url.searchParams.set('tags', String(args.tags));

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
      name: "list-favorites",
      description: "List a client's favorited listings on the connected account, with optional status and tag filters. Use to display a client's saved properties. Key params: clientId (required), status, lastStatus, tags, boardId, fields, pageNum, resultsPerPage. Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "boardId": {
            "type": "integer",
            "format": "int32",
            "description": "Required if your account has access to multiple MLSes. Filters favorites to a specific board."
          },
          "clientId": {
            "type": "integer",
            "format": "int32",
            "description": "The ID of the client whose favorites to retrieve."
          },
          "fields": {
            "type": "string",
            "description": "Use if you want to limit the response to containing certain fields only. For example: fields?listPrice,soldPrice would limit the response to contain listPrice and soldPrice only. You can also specify the amount of images to return, for example if a listing has 40 images total and you specify fields=images[5] it will only return the first 5 images."
          },
          "lastStatus": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters favorites by the last status of the favorited listing."
          },
          "pageNum": {
            "type": "integer",
            "format": "int32",
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "resultsPerPage": {
            "type": "integer",
            "format": "int32",
            "description": "The number of favorites to return per page."
          },
          "status": {
            "type": "string",
            "description": "Filters favorites by the current status of the favorited listing."
          },
          "tags": {
            "type": "string",
            "description": "Allows you to search tags within favorites, accepts a comma-separated string, for example \"needs work, turn-key\""
          }
        },
        required: ["clientId"],
      },
    },
  },
};
