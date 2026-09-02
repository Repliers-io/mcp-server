// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /messages/{messageId} (operationId: get-a-message)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/messages/{messageId}';
  urlPath = urlPath.replace('{messageId}', encodeURIComponent(String(args.messageId)));
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
      name: "get-message",
      description: "Fetch details of a specific message by messageId on the connected account. Use to retrieve the full content and metadata of a sent message. Key params: messageId (required). Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "messageId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          }
        },
        required: ["messageId"],
      },
    },
  },
};
