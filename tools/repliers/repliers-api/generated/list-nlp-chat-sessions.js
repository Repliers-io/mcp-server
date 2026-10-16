// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /nlp/chats (operationId: get_nlp_chats)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  const url = new URL(`${baseUrl}/nlp/chats`);

  if (args.nlpId != null) url.searchParams.set('nlpId', String(args.nlpId));
  if (args.clientId != null) url.searchParams.set('clientId', String(args.clientId));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.prompts != null) url.searchParams.set('prompts', String(args.prompts));

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
      name: "list-nlp-chat-sessions",
      description: "List NLP conversation sessions for a client on the connected account. Use to browse past AI-assisted chat sessions and their prompts. Key params: clientId, nlpId, resultsPerPage, pageNum, prompts. Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "nlpId": {
            "type": "string",
            "description": "Unique identifier for the NLP session."
          },
          "clientId": {
            "type": "integer",
            "description": "Filter sessions based on the `clientId` to see all NLP sessions associated with a specific client."
          },
          "resultsPerPage": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100,
            "default": 100,
            "description": "The number of chats to return per page."
          },
          "pageNum": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "prompts": {
            "type": "boolean",
            "default": null,
            "description": "Fetch all prompts for each of the chats.\n"
          }
        },
        required: [],
      },
    },
  },
};
