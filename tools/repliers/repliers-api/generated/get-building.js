// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /buildings/{addressKey} (operationId: get_buildings__addressKey)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  let urlPath = '/buildings/{addressKey}';
  urlPath = urlPath.replace('{addressKey}', encodeURIComponent(String(args.addressKey)));
  const url = new URL(`${baseUrl}${urlPath}`);

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: apiHeaders(args),
    });

    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return { url: finalUrl, error: errorMessage(body) || `HTTP ${status}`, status, body };
    }

    // A 2xx can carry no body (typical for DELETE) or a plain-text one; neither is a failure.
    const text = await response.text();
    let data = { ok: true };
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { url: finalUrl, data };
  } catch (error) {
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
};

export const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: "get-building",
      description: "Use this endpoint to get details about a specific building by its address key.\nThe address key can be found in the `address.addressKey` field of building objects returned by the buildings search endpoint.\n",
      parameters: {
        type: 'object',
        properties: {
          "addressKey": {
            "type": "string",
            "description": "Unique address identifier key for the building. Available from `building.address.addressKey` in search results."
          }
        },
        required: ["addressKey"],
      },
    },
  },
};
