// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /messages (operationId: filter-messages)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/messages`);

  if (args.agentId !== undefined) url.searchParams.set('agentId', String(args.agentId));
  if (args.clientId !== undefined) url.searchParams.set('clientId', String(args.clientId));
  if (args.endTime !== undefined) url.searchParams.set('endTime', String(args.endTime));
  if (args.startTime !== undefined) url.searchParams.set('startTime', String(args.startTime));
  if (args.message !== undefined) url.searchParams.set('message', String(args.message));
  if (args.messageId !== undefined) url.searchParams.set('messageId', String(args.messageId));
  if (args.pageNum !== undefined) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.sender !== undefined) url.searchParams.set('sender', String(args.sender));
  if (args.status !== undefined) url.searchParams.set('status', String(args.status));
  if (args.token !== undefined) url.searchParams.set('token', String(args.token));

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
      description: "Use this endpoint to list and filter sent messages.",
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
            "format": "date",
            "description": "If specified, filters messages which were sent  on or before the supplied value."
          },
          "startTime": {
            "type": "string",
            "format": "date",
            "description": "If specified, filters messages which were sent on or after the supplied value."
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
            "default": 1,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "resultsPerPage": {
            "type": "integer",
            "format": "int32",
            "default": 100,
            "description": "The number of messages to return per page."
          },
          "sender": {
            "type": "string",
            "description": "Allowed values:<br/><br/><code>agent</code>,<code>client</code>"
          },
          "status": {
            "type": "string",
            "description": "Allowed values:<br/><br/><code>sent</code>,<code>pending</code>"
          },
          "token": {
            "type": "string",
            "description": ""
          }
        },
        required: [],
      },
    },
  },
};
