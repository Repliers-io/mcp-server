// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /messages/{messageId} (operationId: get-a-message)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  let urlPath = '/messages/{messageId}';
  urlPath = urlPath.replace('{messageId}', encodeURIComponent(String(args.messageId)));
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
