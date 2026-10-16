// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /searches (operationId: filter-searches)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  const url = new URL(`${baseUrl}/searches`);

  if (args.agentId != null) url.searchParams.set('agentId', String(args.agentId));
  if (args.clientId != null) url.searchParams.set('clientId', String(args.clientId));
  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.searchId != null) url.searchParams.set('searchId', String(args.searchId));
  if (args.status != null) url.searchParams.set('status', String(args.status));
  if (args.sortBy != null) url.searchParams.set('sortBy', String(args.sortBy));

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
      name: "list-saved-searches",
      description: "List saved searches on the connected account, optionally filtered by client or agent. Use to display a client's active property alerts or browse all configured searches. Key params: clientId, agentId, status, searchId, pageNum, resultsPerPage. Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "agentId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "clientId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "pageNum": {
            "type": "integer",
            "format": "int32",
            "default": 1,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "resultsPerPage": {
            "type": "integer",
            "format": "int32",
            "minimum": 1,
            "maximum": 100,
            "default": 100,
            "description": "The number of searches to return per page."
          },
          "searchId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "status": {
            "type": "boolean",
            "description": ""
          },
          "sortBy": {
            "type": "string",
            "enum": [
              "updated",
              "created"
            ],
            "description": "Sorts the results. <code>updated</code> orders by last update date (newest first), <code>created</code> orders by creation date (newest first). If not specified, results are ordered by searchId descending."
          }
        },
        required: [],
      },
    },
  },
};
