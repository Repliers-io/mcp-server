// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /listings/{mlsNumber} (operationId: get-a-listing)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/listings/{mlsNumber}';
  urlPath = urlPath.replace('{mlsNumber}', encodeURIComponent(String(args.mlsNumber)));
  const url = new URL(`${baseUrl}${urlPath}`);

  if (args.boardId !== undefined) url.searchParams.set('boardId', String(args.boardId));
  if (args.fields !== undefined) url.searchParams.set('fields', String(args.fields));
  if (args.locations !== undefined) url.searchParams.set('locations', String(args.locations));
  if (args.locationsSource !== undefined) args.locationsSource.forEach(v => url.searchParams.append('locationsSource', String(v)));
  if (args.locationsType !== undefined) args.locationsType.forEach(v => url.searchParams.append('locationsType', String(v)));

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
      name: "get-listing",
      description: "Use this endpoint to get details about a specific listing.\n\nWhen requesting a specific listing an expanded view of the listing is provided which includes comparables as well as the MLS history for the specific property. This is useful for building single property views within your app or website.",
      parameters: {
        type: 'object',
        properties: {
          "mlsNumber": {
            "type": "string",
            "description": "The MLS number of the listing you wish to retrieve."
          },
          "boardId": {
            "type": "integer",
            "format": "int32",
            "description": "Filter by boardId. This is only required if your account has access to more than one MLS."
          },
          "fields": {
            "type": "string",
            "enum": [
              "raw"
            ],
            "description": "If set to `raw`, returns raw fields the way data fields come from MLS."
          },
          "locations": {
            "type": "boolean",
            "description": "If set to `true`, fetches locations whose boundary contains this listing's coordinates. Under the hood uses [GET /locations](/reference/get_locations) with `pointWithinBoundary=true`."
          },
          "locationsSource": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "MSL",
                "UserDefined",
                "LiveBy"
              ],
              "description": "Location data source"
            },
            "description": "Filters the locations returned by `locations=true` by source:\n- `MSL` - Locations sourced from MLS (Multiple Listing Service) data.\n- `UserDefined` - Custom locations created and defined by users.\n- `LiveBy` - Locations sourced from LiveBy, a third-party neighborhood and community data provider.\n"
          },
          "locationsType": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "area",
                "city",
                "city-alternate",
                "neighborhood",
                "neighborhood-alternate",
                "postalCode",
                "district",
                "schoolDistrict",
                "school"
              ],
              "description": "Location type classification"
            },
            "description": "Filters the locations returned by `locations=true` by type. Same values as the `type` parameter of [GET /locations](/reference/get_locations)."
          }
        },
        required: ["mlsNumber"],
      },
    },
  },
};
