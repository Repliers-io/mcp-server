// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /listings/{mlsNumber}/similar (operationId: find-similar-listings)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  let urlPath = '/listings/{mlsNumber}/similar';
  urlPath = urlPath.replace('{mlsNumber}', encodeURIComponent(String(args.mlsNumber)));
  const url = new URL(`${baseUrl}${urlPath}`);

  if (args.boardId != null) url.searchParams.set('boardId', String(args.boardId));
  if (args.fields != null) url.searchParams.set('fields', String(args.fields));
  if (args.listPriceRange != null) url.searchParams.set('listPriceRange', String(args.listPriceRange));
  if (args.radius != null) url.searchParams.set('radius', String(args.radius));
  if (args.radiusUnit != null) url.searchParams.set('radiusUnit', String(args.radiusUnit));
  if (args.sortBy != null) url.searchParams.set('sortBy', String(args.sortBy));

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
      name: "get-similar-listings",
      description: "Return listings similar to a given mlsNumber by price range, type, and location proximity. Use to power a \"similar homes\" or \"you may also like\" section on a listing detail page. Key params: mlsNumber (required), boardId, listPriceRange, radius, sortBy. NOT a general search — use Search_Listings.",
      parameters: {
        type: 'object',
        properties: {
          "mlsNumber": {
            "type": "string",
            "description": "The MLS number of the listing you wish to retrieve similar listings for."
          },
          "boardId": {
            "type": "integer",
            "format": "int32",
            "description": "Filter by boardId. This is only required if your account has access to more than one MLS. <a target=\"_blank\" href=\"https://help.repliers.com/en/article/understanding-and-using-boardids-in-the-repliers-api-lfywn2/#2-using-boardids-in-api-requests\">More info</a>."
          },
          "fields": {
            "type": "string",
            "description": "Use if you want to limit the response to containing certain fields only. For example: `fields=listPrice,soldPrice` would limit the response to contain `listPrice` and `soldPrice` only. You can also specify the amount of images to return, for example if a listing has 40 images total and you specify `fields=images[5]` it will only return the first 5 images."
          },
          "listPriceRange": {
            "type": "integer",
            "format": "int32",
            "description": "If specified, returns similar listings whose listPrice are +/- the supplied value, for a given listing. For example, if the given listing is 1M and listPriceRange is 250k, similar listings between 750k and 1.25M will be returned."
          },
          "radius": {
            "type": "integer",
            "format": "int32",
            "description": "If specified, will show similar listings within the specified radius, expressed in the unit set by radiusUnit (KM by default). If not specified, defaults to showing listings in the same neighborhood."
          },
          "radiusUnit": {
            "type": "string",
            "enum": [
              "m",
              "km",
              "mi",
              "yd"
            ],
            "default": "km",
            "description": "Sets the unit of measurement for the `radius` parameter. Can only be used together with `radius`.\n\nAllowed values:\n\n- `km` — kilometers (default)\n- `m` — meters\n- `mi` — miles\n- `yd` — yards"
          },
          "sortBy": {
            "type": "string",
            "default": "updatedOnDesc",
            "description": "Allowed values:<br/><br/><code>updatedOnDesc</code>,<code>updatedOnAsc</code>,<code>createdOnAsc</code>,<code>createdOnDesc</code>"
          }
        },
        required: ["mlsNumber"],
      },
    },
  },
};
