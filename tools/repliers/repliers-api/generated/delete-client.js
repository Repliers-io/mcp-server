// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: DELETE /clients/{clientId} (operationId: delete-a-client)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/clients/{clientId}';
  urlPath = urlPath.replace('{clientId}', encodeURIComponent(String(args.clientId)));
  const url = new URL(`${baseUrl}${urlPath}`);

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'DELETE',
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
      name: "delete-client",
      description: "Delete a CRM client and all associated data (saved searches, favorites, messages, estimates). Irreversible. Key params: clientId (required). Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "clientId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          }
        },
        required: ["clientId"],
      },
    },
  },
};
