// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /listings/{mlsNumber} (operationId: get-a-listing)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  let urlPath = '/listings/{mlsNumber}';
  urlPath = urlPath.replace('{mlsNumber}', encodeURIComponent(String(args.mlsNumber)));
  const url = new URL(`${baseUrl}${urlPath}`);

  if (args.boardId != null) url.searchParams.set('boardId', String(args.boardId));
  if (args.fields != null) url.searchParams.set('fields', String(args.fields));
  if (args.locations != null) url.searchParams.set('locations', String(args.locations));
  if (args.locationsSource != null) [args.locationsSource].flat().forEach(v => url.searchParams.append('locationsSource', String(v)));
  if (args.locationsType != null) [args.locationsType].flat().forEach(v => url.searchParams.append('locationsType', String(v)));

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: apiHeaders(args),
    });

    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return { url: finalUrl, error: errorMessage(body) || `HTTP ${status}`, status, body };
    }

    // A 2xx can carry no body (typical for DELETE) or a plain-text one; neither is a failure.
    const text = await response.text();
    let data = { ok: true };
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { url: finalUrl, data };
  } catch (error) {
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
};

export const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: "get-listing",
      description: "Fetch full details for a single listing by mlsNumber. Use to display a property detail page or retrieve all fields for one known listing. Key params: mlsNumber (required), boardId (required if multi-board account), fields, locations. NOT for browsing or searching — use Search_Listings.",
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
                "MLS",
                "UserDefined",
                "LiveBy",
                "PublicRecord"
              ],
              "description": "Location data source"
            },
            "description": "Filters the locations returned by `locations=true` by source:\n- `MLS` - Locations sourced from MLS (Multiple Listing Service) data.\n- `UserDefined` - Custom locations created and defined by users.\n- `LiveBy` - Locations sourced from LiveBy, a third-party neighborhood and community data provider.\n- `PublicRecord` - Locations sourced from Public Records Data.\n"
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
                "school",
                "property"
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
