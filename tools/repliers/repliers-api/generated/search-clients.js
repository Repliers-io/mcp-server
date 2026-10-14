// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /clients (operationId: search-clients)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/clients`);

  if (args.agentId != null) url.searchParams.set('agentId', String(args.agentId));
  if (args.clientId != null) url.searchParams.set('clientId', String(args.clientId));
  if (args.email != null) url.searchParams.set('email', String(args.email));
  if (args.fname != null) url.searchParams.set('fname', String(args.fname));
  if (args.keywords != null) url.searchParams.set('keywords', String(args.keywords));
  if (args.lname != null) url.searchParams.set('lname', String(args.lname));
  if (args.phone != null) url.searchParams.set('phone', String(args.phone));
  if (args.status != null) url.searchParams.set('status', String(args.status));
  if (args.condition != null) url.searchParams.set('condition', String(args.condition));
  if (args.operator != null) url.searchParams.set('operator', String(args.operator));
  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.tags != null) url.searchParams.set('tags', String(args.tags));
  if (args.showSavedSearches != null) url.searchParams.set('showSavedSearches', String(args.showSavedSearches));
  if (args.externalId != null) url.searchParams.set('externalId', String(args.externalId));

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'REPLIERS-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(JSON.stringify(err));
    }

    const data = await response.json();
    return { url: finalUrl, data };
  } catch (error) {
    return { url: finalUrl, error: error.message };
  }
};

export const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: "search-clients",
      description: "List and filter CRM clients on the connected account. Use to find clients by name, email, phone, status, tags, or agentId. Key params: agentId, fname, lname, email, phone, status, tags, keywords, pageNum, resultsPerPage, showSavedSearches, externalId. Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "agentId": {
            "type": "integer",
            "format": "int32",
            "minimum": 1,
            "description": "Filters clients by the ID of their assigned agent."
          },
          "clientId": {
            "type": "integer",
            "format": "int32",
            "minimum": 1,
            "description": "Filters clients by their unique ID."
          },
          "email": {
            "type": "string",
            "description": "Filters clients by email address."
          },
          "fname": {
            "type": "string",
            "description": "Filters clients by first name."
          },
          "keywords": {
            "type": "string",
            "description": "One or more keywords may be specified to filter the results by. Useful for searching clients. If specified all other params are ignored."
          },
          "lname": {
            "type": "string",
            "description": "Filters clients by last name."
          },
          "phone": {
            "type": "string",
            "description": "Filters clients by phone number."
          },
          "status": {
            "type": "boolean",
            "description": "If false, returns only disabled clients. If true, returns only active clients."
          },
          "condition": {
            "type": "string",
            "enum": [
              "EXACT",
              "CONTAINS"
            ],
            "default": "EXACT",
            "description": "Determines the search condition applied to the filters. If EXACT, requires that the given value for one or more params is an exact match of the stored value. If CONTAINS, requires that the given value for one or more params is contained within the stored value. Values are case-insensitive. <br/><br/> Allowed values: <br/><br/> <code>EXACT</code>, <code>CONTAINS</code>"
          },
          "operator": {
            "type": "string",
            "enum": [
              "OR",
              "AND"
            ],
            "default": "OR",
            "description": "Determines the search logic applied to the filters. If OR, requires that one or more params contain/equal the given value. If AND, requires that all params contain/equal the given value. Values are case-insensitive. <br/><br/> Allowed values: <br/><br/> <code>OR</code>, <code>AND</code>"
          },
          "pageNum": {
            "type": "integer",
            "format": "int32",
            "minimum": 1,
            "default": 1,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "resultsPerPage": {
            "type": "integer",
            "format": "int32",
            "minimum": 1,
            "default": 100,
            "description": "The number of clients to return per page."
          },
          "tags": {
            "type": "string",
            "description": "One or more comma separated strings that can be used to filter clients.  For example GET /clients?tags=buyer,toronto. The response contains clients that have any of the tags specified."
          },
          "showSavedSearches": {
            "type": "boolean",
            "default": true,
            "description": "Enables automatic retrieval of Saved Searches for each client in the response. For best performance it's recommended to disable this setting if Saved Searches are not required."
          },
          "externalId": {
            "type": "string",
            "description": "Filter clients by their identifier from an external system (such as a CRM)."
          }
        },
        required: [],
      },
    },
  },
};
