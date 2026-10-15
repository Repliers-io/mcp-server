// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /searches/{searchId}/matches (operationId: filter-matches)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  let urlPath = '/searches/{searchId}/matches';
  urlPath = urlPath.replace('{searchId}', encodeURIComponent(String(args.searchId)));
  const url = new URL(`${baseUrl}${urlPath}`);

  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.endDate != null) url.searchParams.set('endDate', String(args.endDate));
  if (args.startDate != null) url.searchParams.set('startDate', String(args.startDate));
  if (args.lastStatus != null) [args.lastStatus].flat().forEach(v => url.searchParams.append('lastStatus', String(v)));
  if (args.liked != null) url.searchParams.set('liked', String(args.liked));
  if (args.viewed != null) url.searchParams.set('viewed', String(args.viewed));
  if (args.matchId != null) url.searchParams.set('matchId', String(args.matchId));
  if (args.sortBy != null) url.searchParams.set('sortBy', String(args.sortBy));
  if (args.status != null) url.searchParams.set('status', String(args.status));

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
      name: "list-saved-search-matches",
      description: "List listings matched against a saved search on the connected account. Use to show a client which new listings triggered their alert. Key params: searchId (required), liked, viewed, status, lastStatus, startDate, endDate, pageNum, resultsPerPage. Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "searchId": {
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
            "description": "The number of listings to return per page."
          },
          "endDate": {
            "type": "string",
            "format": "date-time",
            "example": "2024-06-15T23:59:59.000Z",
            "description": "If specified filters matches whose match date is <= the supplied value. Format: <code>YYYY-MM-DDTHH:mm:ss.sssZ</code>"
          },
          "startDate": {
            "type": "string",
            "format": "date-time",
            "example": "2024-06-15T00:00:00.000Z",
            "description": "If specified filters matches whose match date is >= the supplied value. Format: <code>YYYY-MM-DDTHH:mm:ss.sssZ</code>"
          },
          "lastStatus": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "Sus",
                "Exp",
                "Sld",
                "Ter",
                "Dft",
                "Lsd",
                "Sc",
                "Lc",
                "Pc",
                "Ext",
                "New",
                "Sce",
                "Cs",
                "Lce",
                "Inc"
              ]
            },
            "description": "If specified filters matches whose last status is one of the supplied values. Repeat the parameter to supply multiple values.<br/><br/>Allowed values:<br/><br/><code>Sus</code>, <code>Exp</code>, <code>Sld</code>, <code>Ter</code>, <code>Dft</code>, <code>Lsd</code>, <code>Sc</code>, <code>Lc</code>, <code>Pc</code>, <code>Ext</code>, <code>New</code>, <code>Sce</code>, <code>Cs</code>, <code>Lce</code>, <code>Inc</code>"
          },
          "liked": {
            "type": "boolean",
            "description": "If true filters search matches that were liked, if false filters search matches that were disliked. If not specified, returns all search matches."
          },
          "viewed": {
            "type": "boolean",
            "description": "If true filters search matches that the client has viewed, if false filters search matches that have not been viewed. If not specified, returns all search matches."
          },
          "matchId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "sortBy": {
            "type": "string",
            "enum": [
              "createdOnDesc",
              "updatedOnDesc"
            ],
            "default": "createdOnDesc",
            "description": "Sorts the matches by creation or last update date, newest first.<br/><br/>Allowed values:<br/><br/><code>createdOnDesc</code>,<code>updatedOnDesc</code>"
          },
          "status": {
            "type": "string",
            "description": "If not specified returns both available and unavailable listings. If specified limits results to specified status.<br/><br/>Allowed values:<br/><br/><code>A</code>,<code>U</code>"
          }
        },
        required: ["searchId"],
      },
    },
  },
};
