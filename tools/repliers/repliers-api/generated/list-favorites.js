// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /favorites (operationId: get-favorites)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/favorites`);

  if (args.boardId != null) [args.boardId].flat().forEach(v => url.searchParams.append('boardId', String(v)));
  if (args.clientId != null) url.searchParams.set('clientId', String(args.clientId));
  if (args.fields != null) url.searchParams.set('fields', String(args.fields));
  if (args.lastStatus != null) [args.lastStatus].flat().forEach(v => url.searchParams.append('lastStatus', String(v)));
  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.status != null) url.searchParams.set('status', String(args.status));
  if (args.standardStatus != null) [args.standardStatus].flat().forEach(v => url.searchParams.append('standardStatus', String(v)));
  if (args.tags != null) url.searchParams.set('tags', String(args.tags));
  if (args.lat != null) url.searchParams.set('lat', String(args.lat));
  if (args.long != null) url.searchParams.set('long', String(args.long));
  if (args.pretty != null) url.searchParams.set('pretty', String(args.pretty));
  if (args.sortBy != null) url.searchParams.set('sortBy', String(args.sortBy));

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
      name: "list-favorites",
      description: "List a client's favorited listings on the connected account, with optional status and tag filters. Use to display a client's saved properties. Key params: clientId (required), status, lastStatus, tags, boardId, fields, pageNum, resultsPerPage. Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "boardId": {
            "type": "array",
            "items": {
              "type": "integer",
              "format": "int32"
            },
            "description": "Filters favorites to one or more boards. If omitted, all boards your account has access to are included. Repeat the parameter to supply multiple boardIds."
          },
          "clientId": {
            "type": "integer",
            "format": "int32",
            "description": "The ID of the client whose favorites to retrieve."
          },
          "fields": {
            "type": "string",
            "description": "Use if you want to limit the response to containing certain fields only. For example: fields?listPrice,soldPrice would limit the response to contain listPrice and soldPrice only. You can also specify the amount of images to return, for example if a listing has 40 images total and you specify fields=images[5] it will only return the first 5 images."
          },
          "lastStatus": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "Sus",
                "Exp",
                "Sld",
                "Ter",
                "Dft",
                "Lsd",
                "Sc",
                "Lc",
                "Pc",
                "Ext",
                "New",
                "Sce",
                "Cs",
                "Lce",
                "Inc"
              ]
            },
            "description": "Filters favorites by the last status of the favorited listing. Cannot be combined with <code>standardStatus</code>. Repeat the parameter to supply multiple values.<br/><br/>Allowed values:<br/><br/><code>Sus</code>, <code>Exp</code>, <code>Sld</code>, <code>Ter</code>, <code>Dft</code>, <code>Lsd</code>, <code>Sc</code>, <code>Lc</code>, <code>Pc</code>, <code>Ext</code>, <code>New</code>, <code>Sce</code>, <code>Cs</code>, <code>Lce</code>, <code>Inc</code>"
          },
          "pageNum": {
            "type": "integer",
            "format": "int32",
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "resultsPerPage": {
            "type": "integer",
            "format": "int32",
            "minimum": 1,
            "maximum": 100,
            "description": "The number of favorites to return per page."
          },
          "status": {
            "type": "string",
            "enum": [
              "A",
              "U"
            ],
            "description": "Filters favorites by the current status of the favorited listing. Cannot be combined with <code>standardStatus</code>.<br/><br/>Allowed values:<br/><br/><code>A</code>, <code>U</code>"
          },
          "standardStatus": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters favorites by the Standard Status of the favorited listing. Cannot be combined with <code>status</code> or <code>lastStatus</code>; doing so returns a 400 error. Repeat the parameter to supply multiple values."
          },
          "tags": {
            "type": "string",
            "description": "Allows you to search tags within favorites, accepts a comma-separated string, for example \"needs work, turn-key\""
          },
          "lat": {
            "type": "number",
            "format": "float",
            "minimum": -90,
            "maximum": 90,
            "description": "Accepts a value for latitude. Can be used only for sorting with `distanceAsc` or `distanceDesc`. Must be used with `long`."
          },
          "long": {
            "type": "number",
            "format": "float",
            "minimum": -180,
            "maximum": 180,
            "description": "Accepts a value for longitude. Can be used only for sorting with `distanceAsc` or `distanceDesc`. Must be used with `lat`."
          },
          "pretty": {
            "type": "boolean",
            "description": "If true, returns the response in a human-readable formatted JSON."
          },
          "sortBy": {
            "type": "string",
            "enum": [
              "createdOnDesc",
              "updatedOnDesc",
              "createdOnAsc",
              "updatedOnAsc",
              "soldDateAsc",
              "soldDateDesc",
              "soldPriceAsc",
              "soldPriceDesc",
              "listPriceAsc",
              "listPriceDesc",
              "bedsAsc",
              "bedsDesc",
              "bathsDesc",
              "bathsAsc",
              "yearBuiltDesc",
              "yearBuiltAsc",
              "random",
              "distanceAsc",
              "distanceDesc",
              "closedDateAsc",
              "closedDateDesc",
              "sqftAsc",
              "sqftDesc",
              "repliersUpdatedOnDesc",
              "repliersUpdatedOnAsc",
              "statusAscListDateAsc",
              "statusAscListDateDesc",
              "statusAscListPriceAsc",
              "statusAscListPriceDesc",
              "qualityAsc",
              "qualityDesc",
              "listPricePerSqFtAsc",
              "listPricePerSqFtDesc",
              "soldPricePerSqFtAsc",
              "soldPricePerSqFtDesc"
            ],
            "description": "The attribute that the favorites will be sorted by. Note, `distanceAsc` and `distanceDesc` must be used in combination with `lat`, `long` parameters. Default is `updatedOnDesc`."
          }
        },
        required: ["clientId"],
      },
    },
  },
};
