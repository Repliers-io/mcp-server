// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: PATCH /searches/{searchId}/matches/{matchId} (operationId: update-a-match)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/searches/{searchId}/matches/{matchId}';
  urlPath = urlPath.replace('{searchId}', encodeURIComponent(String(args.searchId)));
  urlPath = urlPath.replace('{matchId}', encodeURIComponent(String(args.matchId)));
  const url = new URL(`${baseUrl}${urlPath}`);

  const body = {};
  if (args.viewed !== undefined) body.viewed = args.viewed;
  if (args.liked !== undefined) body.liked = args.liked;

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
      'Content-Type': 'application/json',
        'REPLIERS-API-KEY': apiKey,
      },
      body: JSON.stringify(body),
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
      name: "update-saved-search-match",
      description: "Updates the viewed or liked status of a specific listing match. Use this to track client engagement — for example, marking a match as viewed when a client opens a listing, or liked when they express interest.",
      parameters: {
        type: 'object',
        properties: {
          "searchId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "matchId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "viewed": {
            "type": "boolean",
            "description": "If true, indicates that the match was viewed by the client. Useful for keeping track of what matches clients have viewed."
          },
          "liked": {
            "type": "boolean",
            "description": "If true, indicates that the client liked the match. Useful for keeping track of what matches clients like."
          }
        },
        required: ["searchId","matchId"],
      },
    },
  },
};
