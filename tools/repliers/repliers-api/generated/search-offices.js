// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /offices (operationId: offices)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/offices`);

  if (args.officeId !== undefined) url.searchParams.set('officeId', String(args.officeId));
  if (args.keywords !== undefined) url.searchParams.set('keywords', String(args.keywords));
  if (args.boardId !== undefined) url.searchParams.set('boardId', String(args.boardId));

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
      name: "search-offices",
      description: "Use this endpoint to list offices belonging to the MLS. A brokerage may have one or more offices.",
      parameters: {
        type: 'object',
        properties: {
          "officeId": {
            "type": "string",
            "description": "If supplied, finds office by officeId using exact match criteria."
          },
          "keywords": {
            "type": "string",
            "description": "If supplied, filters offices by the supplied value."
          },
          "boardId": {
            "type": "string",
            "description": "Find your boardId by visiting https://login.repliers.com/dashboard/data-access"
          }
        },
        required: [],
      },
    },
  },
};
