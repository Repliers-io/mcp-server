// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: DELETE /searches/{searchId} (operationId: delete-a-saved-search)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/searches/{searchId}';
  urlPath = urlPath.replace('{searchId}', encodeURIComponent(String(args.searchId)));
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
      name: "delete-saved-search",
      description: "Deletes a saved search. The client will no longer receive notifications for this search.",
      parameters: {
        type: 'object',
        properties: {
          "searchId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          }
        },
        required: ["searchId"],
      },
    },
  },
};
