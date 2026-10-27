// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /agents/{agentId} (operationId: get-an-agent)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  let urlPath = '/agents/{agentId}';
  urlPath = urlPath.replace('{agentId}', encodeURIComponent(String(args.agentId)));
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
      name: "get-agent",
      description: "Fetch the full profile of a specific CRM agent by agentId. Use to display an agent's details or verify their record before an update. Key params: agentId (required). Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "agentId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          }
        },
        required: ["agentId"],
      },
    },
  },
};
