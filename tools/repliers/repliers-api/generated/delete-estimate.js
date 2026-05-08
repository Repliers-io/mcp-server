// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: DELETE /estimates/{estimateId} (operationId: delete-an-estimate)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/estimates/{estimateId}';
  urlPath = urlPath.replace('{estimateId}', encodeURIComponent(String(args.estimateId)));
  const url = new URL(`${baseUrl}${urlPath}`);

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'DELETE',
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
      name: "delete-estimate",
      description: "Deletes a specific property value estimate.",
      parameters: {
        type: 'object',
        properties: {
          "estimateId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          }
        },
        required: ["estimateId"],
      },
    },
  },
};
