// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /messages (operationId: filter-messages)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/messages`);

  if (args.agentId != null) url.searchParams.set('agentId', String(args.agentId));
  if (args.clientId != null) url.searchParams.set('clientId', String(args.clientId));
  if (args.endTime != null) url.searchParams.set('endTime', String(args.endTime));
  if (args.startTime != null) url.searchParams.set('startTime', String(args.startTime));
  if (args.message != null) url.searchParams.set('message', String(args.message));
  if (args.messageId != null) url.searchParams.set('messageId', String(args.messageId));
  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.sender != null) [args.sender].flat().forEach(v => url.searchParams.append('sender', String(v)));
  if (args.status != null) url.searchParams.set('status', String(args.status));
  if (args.token != null) url.searchParams.set('token', String(args.token));

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
      name: "list-messages",
      description: "List and filter agent↔client messages on the connected account. Use to view a conversation thread or audit communications. Key params: clientId, agentId, sender, status, startTime, endTime, pageNum, resultsPerPage. Operates on the connected account's CRM data.",
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
          "endTime": {
            "type": "string",
            "format": "date-time",
            "example": "2024-06-15T23:59:59.000Z",
            "description": "If specified, filters messages which were sent on or before the supplied value. Format: <code>YYYY-MM-DDTHH:mm:ss.sssZ</code>"
          },
          "startTime": {
            "type": "string",
            "format": "date-time",
            "example": "2024-06-15T00:00:00.000Z",
            "description": "If specified, filters messages which were sent on or after the supplied value. Format: <code>YYYY-MM-DDTHH:mm:ss.sssZ</code>"
          },
          "message": {
            "type": "string",
            "description": ""
          },
          "messageId": {
            "type": "integer",
            "format": "int32",
            "description": ""
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
            "maximum": 100,
            "default": 100,
            "description": "The number of messages to return per page."
          },
          "sender": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "agent",
                "client"
              ]
            },
            "description": "Filters messages by who sent them. Repeat the parameter to supply both values.<br/><br/>Allowed values:<br/><br/><code>agent</code>,<code>client</code>"
          },
          "status": {
            "type": "string",
            "enum": [
              "sent",
              "pending"
            ],
            "description": "Allowed values:<br/><br/><code>sent</code>,<code>pending</code>"
          },
          "token": {
            "type": "string",
            "format": "uuid",
            "description": "Filters messages by their token. Must be a valid GUID."
          }
        },
        required: [],
      },
    },
  },
};
