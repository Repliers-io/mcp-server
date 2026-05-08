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
      description: "Returns a list of brokerages registered with the MLS. Useful for building brokerage directory pages or populating brokerage filter options in search interfaces.",
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
};
