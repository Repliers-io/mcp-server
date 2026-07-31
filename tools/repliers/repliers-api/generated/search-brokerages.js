// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /brokerages (operationId: brokerages)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/brokerages`);

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
      name: "search-brokerages",
      description: "List all brokerages registered with the MLS on the connected account. Use to build a brokerage directory or populate a brokerage filter dropdown. No filter params available — returns the full list. NOT for searching individual agents or offices — use search-members or search-offices. If results look wrong or incomplete — see send-feedback.",
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
};
