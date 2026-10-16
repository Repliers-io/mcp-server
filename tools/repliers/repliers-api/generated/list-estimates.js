// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /estimates (operationId: get-estimates)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  const url = new URL(`${baseUrl}/estimates`);

  if (args.clientId != null) url.searchParams.set('clientId', String(args.clientId));
  if (args.estimateId != null) url.searchParams.set('estimateId', String(args.estimateId));
  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.sortBy != null) url.searchParams.set('sortBy', String(args.sortBy));
  if (args.ulid != null) url.searchParams.set('ulid', String(args.ulid));

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
      name: "list-estimates",
      description: "List property value estimates created on the connected account, optionally filtered by clientId or estimateId. Use to show a client their saved valuations. Key params: clientId, estimateId, pageNum, resultsPerPage. Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "clientId": {
            "type": "integer",
            "format": "int32",
            "description": "If specified, filters estimates by clientId"
          },
          "estimateId": {
            "type": "integer",
            "format": "int32",
            "description": "If specified, filters estimates by estimateId"
          },
          "pageNum": {
            "type": "integer",
            "format": "int32",
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "resultsPerPage": {
            "type": "integer",
            "format": "int32",
            "default": 100,
            "description": "The number of estimates to return per page."
          },
          "sortBy": {
            "type": "string",
            "enum": [
              "createdOnDesc",
              "createdOnAsc",
              "updatedOnDesc",
              "updatedOnAsc"
            ],
            "description": "Sorts the results by creation or last update date. If not specified, no particular order is applied."
          },
          "ulid": {
            "type": "string",
            "minLength": 26,
            "maxLength": 26,
            "description": "If specified, filters estimates by their ULID. Must be exactly 26 characters."
          }
        },
        required: [],
      },
    },
  },
};
