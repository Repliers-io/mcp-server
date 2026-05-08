// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /clients (operationId: search-clients)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/clients`);

  if (args.agentId !== undefined) url.searchParams.set('agentId', String(args.agentId));
  if (args.clientId !== undefined) url.searchParams.set('clientId', String(args.clientId));
  if (args.email !== undefined) url.searchParams.set('email', String(args.email));
  if (args.fname !== undefined) url.searchParams.set('fname', String(args.fname));
  if (args.keywords !== undefined) url.searchParams.set('keywords', String(args.keywords));
  if (args.lname !== undefined) url.searchParams.set('lname', String(args.lname));
  if (args.phone !== undefined) url.searchParams.set('phone', String(args.phone));
  if (args.status !== undefined) url.searchParams.set('status', String(args.status));
  if (args.condition !== undefined) url.searchParams.set('condition', String(args.condition));
  if (args.operator !== undefined) url.searchParams.set('operator', String(args.operator));
  if (args.pageNum !== undefined) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.tags !== undefined) url.searchParams.set('tags', String(args.tags));
  if (args.showSavedSearches !== undefined) url.searchParams.set('showSavedSearches', String(args.showSavedSearches));
  if (args.externalId !== undefined) url.searchParams.set('externalId', String(args.externalId));

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
      description: "Use this endpoint to get a list of clients that you've created. You can filter for specific clients using parameters like email address and first name. If you don't use any filters all clients will be returned.",
      parameters: {
        type: 'object',
        properties: {
          "agentId": {
            "type": "integer",
            "format": "int32",
            "description": "Filters clients by the ID of their assigned agent."
          },
          "clientId": {
            "type": "integer",
            "format": "int32",
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
            "type": "integer",
            "format": "int32",
            "description": "Filters clients by phone number."
          },
          "status": {
            "type": "boolean",
            "description": "If false, returns only disabled clients. If true, returns only active clients."
          },
          "condition": {
            "type": "string",
            "default": "EXACT",
            "description": "Determines the search condition applied to the filters. If EXACT, requires that the given value for one or more params is an exact match of the stored value. If CONTAINS, requires that the given value for one or more params is contained within the stored value. <br/><br/> Allowed values: <br/><br/> <code>EXACT</code>, <code>CONTAINS</code>"
          },
          "operator": {
            "type": "string",
            "default": "OR",
            "description": "Determines the search logic applied to the filters. If OR, requires that one or more params contain/equal the given value. If AND, requires that all params contain/equal the given value. <br/><br/> Allowed values: <br/><br/> <code>OR</code>, <code>AND</code>"
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
