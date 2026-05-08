// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /searches/{searchId}/matches (operationId: filter-matches)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/searches/{searchId}/matches';
  urlPath = urlPath.replace('{searchId}', encodeURIComponent(String(args.searchId)));
  const url = new URL(`${baseUrl}${urlPath}`);

  if (args.pageNum !== undefined) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.endDate !== undefined) url.searchParams.set('endDate', String(args.endDate));
  if (args.startDate !== undefined) url.searchParams.set('startDate', String(args.startDate));
  if (args.lastStatus !== undefined) url.searchParams.set('lastStatus', String(args.lastStatus));
  if (args.liked !== undefined) url.searchParams.set('liked', String(args.liked));
  if (args.matchId !== undefined) url.searchParams.set('matchId', String(args.matchId));
  if (args.sortBy !== undefined) url.searchParams.set('sortBy', String(args.sortBy));
  if (args.status !== undefined) url.searchParams.set('status', String(args.status));

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
      name: "list-saved-search-matches",
      description: "Use this endpoint to lookup matches for a saved search. Matches are listings that met the saved search criteria.",
      parameters: {
        type: 'object',
        properties: {
          "searchId": {
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
            "description": "The number of listings to return per page."
          },
          "endDate": {
            "type": "string",
            "format": "date",
            "description": "If specified filters matches whose match date is <= the supplied value."
          },
          "startDate": {
            "type": "string",
            "format": "date",
            "description": "If specified filters matches whose match date is >= the supplied value."
          },
          "lastStatus": {
            "type": "string",
            "description": "If specified filters matches whose last status is the supplied value.<br/><br/>Allowed values:<br/><br/><code>Sus</code>, <code>Exp</code>, <code>Sld</code>, <code>Ter</code>, <code>Dft</code>, <code>Lsd</code>, <code>Sc</code>, <code>Lc</code>, <code>Pc</code>, <code>Ext</code>, <code>New</code>"
          },
          "liked": {
            "type": "boolean",
            "description": "If true filters search matches that were liked, if false filters search matches that were disliked. If not specified, returns all search matches."
          },
          "matchId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "sortBy": {
            "type": "string",
            "default": "updatedOnDesc",
            "description": "Allowed values:<br/><br/><code>updatedOnDesc</code>,<code>createdOnDesc</code>"
          },
          "status": {
            "type": "string",
            "description": "If not specified returns both available and unavailable listings. If specified limits results to specified status.<br/><br/>Allowed values:<br/><br/><code>A</code>,<code>U</code>"
          }
        },
        required: ["searchId"],
      },
    },
  },
};
