// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /offices (operationId: offices)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  const url = new URL(`${baseUrl}/offices`);

  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.officeId != null) [args.officeId].flat().forEach(v => url.searchParams.append('officeId', String(v)));
  if (args.keywords != null) url.searchParams.set('keywords', String(args.keywords));
  if (args.boardId != null) url.searchParams.set('boardId', String(args.boardId));

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
      name: "search-offices",
      description: "List and filter offices (branches) belonging to the MLS on the connected account. Use to look up an office by keyword or ID. Key params: officeId, keywords, boardId. NOT for individual agent lookup — use search-members.",
      parameters: {
        type: 'object',
        properties: {
          "pageNum": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "Page number for paginated results."
          },
          "resultsPerPage": {
            "type": "integer",
            "minimum": 1,
            "default": 100,
            "description": "Number of results to return per page."
          },
          "officeId": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 50
            },
            "description": "If supplied, finds offices by officeId using exact (case-insensitive) match criteria. Repeat the parameter to supply multiple values."
          },
          "keywords": {
            "type": "string",
            "description": "If supplied, filters offices by the supplied value."
          },
          "boardId": {
            "type": "string",
            "description": "Filters offices by MLS board. Required if your API key has access to more than one MLS board. Find your boardId by visiting https://login.repliers.com/dashboard/data-access"
          }
        },
        required: [],
      },
    },
  },
};
