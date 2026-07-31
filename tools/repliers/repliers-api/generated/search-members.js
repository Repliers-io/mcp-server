// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /members (operationId: members)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/members`);

  if (args.agentId !== undefined) url.searchParams.set('agentId', String(args.agentId));
  if (args.agentName !== undefined) url.searchParams.set('agentName', String(args.agentName));
  if (args.boardId !== undefined) url.searchParams.set('boardId', String(args.boardId));
  if (args.brokerage !== undefined) url.searchParams.set('brokerage', String(args.brokerage));
  if (args.keywords !== undefined) url.searchParams.set('keywords', String(args.keywords));
  if (args.officeId !== undefined) url.searchParams.set('officeId', String(args.officeId));
  if (args.pageNum !== undefined) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.position !== undefined) url.searchParams.set('position', String(args.position));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));

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
            "type": "string",
            "description": "Filters members by agent ID using exact match."
          },
          "agentName": {
            "type": "string",
            "description": "Filters members by agent name using exact match."
          },
          "boardId": {
            "type": "string",
            "description": "Filters members by the MLS board they belong to."
          },
          "brokerage": {
            "type": "string",
            "description": "Filters members by brokerage name using partial match."
          },
          "keywords": {
            "type": "string",
            "description": "Searches members by keyword across multiple fields."
          },
          "officeId": {
            "type": "string",
            "description": "Filters members by office ID."
          },
          "pageNum": {
            "type": "integer",
            "format": "int32",
            "default": 1,
            "maximum": 10000,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "position": {
            "type": "string",
            "description": "Filters members by their position or role (e.g., Broker, Sales Representative)."
          },
          "resultsPerPage": {
            "type": "integer",
            "format": "int32",
            "default": 100,
            "maximum": 1000,
            "description": "The number of members to return per page."
          }
        },
        required: [],
      },
    },
  },
};
