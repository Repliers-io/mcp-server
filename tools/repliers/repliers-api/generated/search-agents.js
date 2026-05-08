// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /agents (operationId: find-agents)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/agents`);

  if (args.agentId !== undefined) url.searchParams.set('agentId', String(args.agentId));
  if (args.boardId !== undefined) url.searchParams.set('boardId', String(args.boardId));
  if (args.brokerage !== undefined) url.searchParams.set('brokerage', String(args.brokerage));
  if (args.designation !== undefined) url.searchParams.set('designation', String(args.designation));
  if (args.email !== undefined) url.searchParams.set('email', String(args.email));
  if (args.fname !== undefined) url.searchParams.set('fname', String(args.fname));
  if (args.lname !== undefined) url.searchParams.set('lname', String(args.lname));
  if (args.phone !== undefined) url.searchParams.set('phone', String(args.phone));
  if (args.status !== undefined) url.searchParams.set('status', String(args.status));
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
      name: "search-agents",
      description: "Use this endpoint to get a list of agents that you've created. You can filter for specific agents using parameters like email address and first name. If you don't use any filters all agents will be returned.",
      parameters: {
        type: 'object',
        properties: {
          "agentId": {
            "type": "integer",
            "format": "int32",
            "description": "Filters agents by their unique ID."
          },
          "boardId": {
            "type": "integer",
            "format": "int32",
            "description": "Filters agents by the MLS board they belong to."
          },
          "brokerage": {
            "type": "string",
            "description": "Filters agents by brokerage name."
          },
          "designation": {
            "type": "string",
            "description": "Filters agents by designation (e.g., Sales Representative)."
          },
          "email": {
            "type": "string",
            "description": "Filters agents by email address."
          },
          "fname": {
            "type": "string",
            "description": "Filters agents by first name."
          },
          "lname": {
            "type": "string",
            "description": "Filters agents by last name."
          },
          "phone": {
            "type": "integer",
            "format": "int32",
            "description": "Filters agents by phone number."
          },
          "status": {
            "type": "boolean",
            "description": "If false, returns only disabled agents. If true, returns only active agents."
          },
          "externalId": {
            "type": "string",
            "description": "Filters agents by their identifier from an external system (such as a CRM)."
          }
        },
        required: [],
      },
    },
  },
};
