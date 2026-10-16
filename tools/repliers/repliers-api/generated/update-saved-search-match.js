// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: PATCH /searches/{searchId}/matches/{matchId} (operationId: update-a-match)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  let urlPath = '/searches/{searchId}/matches/{matchId}';
  urlPath = urlPath.replace('{searchId}', encodeURIComponent(String(args.searchId)));
  urlPath = urlPath.replace('{matchId}', encodeURIComponent(String(args.matchId)));
  const url = new URL(`${baseUrl}${urlPath}`);

  const body = {};
  if (args.viewed !== undefined) body.viewed = args.viewed;
  if (args.liked !== undefined) body.liked = args.liked;

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'PATCH',
      headers: apiHeaders(args, { json: true }),
      body: JSON.stringify(body),
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
      name: "update-saved-search-match",
      description: "Mark a saved-search match as viewed or liked/disliked by the client. Use to track client engagement with matched listings. Key params: searchId (required), matchId (required), viewed, liked. Operates on the connected account's CRM data.",
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
          },
          "viewed": {
            "type": "boolean",
            "description": "If true, indicates that the match was viewed by the client. Useful for keeping track of what matches clients have viewed."
          },
          "liked": {
            "type": "boolean",
            "nullable": true,
            "description": "If true, indicates that the client liked the match, if false that they disliked it. Useful for keeping track of what matches clients like. Set to <code>null</code> to clear the liked state."
          }
        },
        required: ["searchId","matchId"],
      },
    },
  },
};
