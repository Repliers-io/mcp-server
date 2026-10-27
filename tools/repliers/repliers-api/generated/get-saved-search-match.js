// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /searches/{searchId}/matches/{matchId} (operationId: get-a-match)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  let urlPath = '/searches/{searchId}/matches/{matchId}';
  urlPath = urlPath.replace('{searchId}', encodeURIComponent(String(args.searchId)));
  urlPath = urlPath.replace('{matchId}', encodeURIComponent(String(args.matchId)));
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
      name: "get-saved-search-match",
      description: "Fetch the details of a specific listing match within a saved search, including the full listing data and the client's liked/viewed status. Key params: searchId (required), matchId (required). Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "searchId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "matchId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          }
        },
        required: ["searchId","matchId"],
      },
    },
  },
};
