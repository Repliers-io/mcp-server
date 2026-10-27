// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: DELETE /estimates/{estimateId} (operationId: delete-an-estimate)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  let urlPath = '/estimates/{estimateId}';
  urlPath = urlPath.replace('{estimateId}', encodeURIComponent(String(args.estimateId)));
  const url = new URL(`${baseUrl}${urlPath}`);

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'DELETE',
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
      name: "delete-estimate",
      description: "Delete a property value estimate from the connected account. Key params: estimateId (required). Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "estimateId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          }
        },
        required: ["estimateId"],
      },
    },
  },
};
