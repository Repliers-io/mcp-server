// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /members (operationId: members)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/members`);

  if (args.agentId != null) [args.agentId].flat().forEach(v => url.searchParams.append('agentId', String(v)));
  if (args.agentName != null) [args.agentName].flat().forEach(v => url.searchParams.append('agentName', String(v)));
  if (args.boardId != null) url.searchParams.set('boardId', String(args.boardId));
  if (args.hasEmail != null) url.searchParams.set('hasEmail', String(args.hasEmail));
  if (args.originatingSystemName != null) url.searchParams.set('originatingSystemName', String(args.originatingSystemName));
  if (args.brokerage != null) [args.brokerage].flat().forEach(v => url.searchParams.append('brokerage', String(v)));
  if (args.officeId != null) [args.officeId].flat().forEach(v => url.searchParams.append('officeId', String(v)));
  if (args.position != null) [args.position].flat().forEach(v => url.searchParams.append('position', String(v)));
  if (args.keywords != null) url.searchParams.set('keywords', String(args.keywords));
  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));

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
      name: "search-members",
      description: "List and filter MLS member agents on the connected account. Use to look up an agent by name, brokerage, or office. Key params: agentName, brokerage, officeId, keywords, boardId, position, resultsPerPage. NOT for CRM agents — use search-agents. If results look wrong or incomplete — see send-feedback.",
      parameters: {
        type: 'object',
        properties: {
          "agentId": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 50
            },
            "description": "Filters members by agent ID using exact match. Repeat the parameter to supply multiple values (OR)."
          },
          "agentName": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filters members by agent name using exact match. Repeat the parameter to supply multiple values (OR)."
          },
          "boardId": {
            "type": "string",
            "description": "Filters members by the MLS board they belong to. Required if your API key has access to more than one MLS board. Find your boardId by visiting https://login.repliers.com/dashboard/data-access"
          },
          "hasEmail": {
            "type": "boolean",
            "description": "If supplied, filters members by whether they have an email address on record."
          },
          "originatingSystemName": {
            "type": "string",
            "description": "Filters members by the name of the originating MLS system."
          },
          "brokerage": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filters members by brokerage name using partial match. Repeat the parameter to supply multiple values."
          },
          "officeId": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filters members by the ID of the office they belong to. Repeat the parameter to supply multiple values (OR)."
          },
          "position": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filters members by their position or role. Repeat the parameter to supply multiple values (OR)."
          },
          "keywords": {
            "type": "string",
            "maxLength": 100,
            "description": "Searches members by keyword across multiple fields. Maximum 100 characters."
          },
          "pageNum": {
            "type": "integer",
            "format": "int32",
            "default": 1,
            "minimum": 1,
            "maximum": 10000,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "resultsPerPage": {
            "type": "integer",
            "format": "int32",
            "default": 100,
            "minimum": 1,
            "maximum": 1000,
            "description": "The number of members to return per page."
          }
        },
        required: [],
      },
    },
  },
};
