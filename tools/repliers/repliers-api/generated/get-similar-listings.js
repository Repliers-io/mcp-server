// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /listings/{mlsNumber}/similar (operationId: find-similar-listings)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/listings/{mlsNumber}/similar';
  urlPath = urlPath.replace('{mlsNumber}', encodeURIComponent(String(args.mlsNumber)));
  const url = new URL(`${baseUrl}${urlPath}`);

  if (args.boardId !== undefined) args.boardId.forEach(v => url.searchParams.append('boardId', String(v)));
  if (args.fields !== undefined) url.searchParams.set('fields', String(args.fields));
  if (args.listPriceRange !== undefined) url.searchParams.set('listPriceRange', String(args.listPriceRange));
  if (args.radius !== undefined) url.searchParams.set('radius', String(args.radius));
  if (args.sortBy !== undefined) url.searchParams.set('sortBy', String(args.sortBy));

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
      name: "get-similar-listings",
      description: "Return listings similar to a given mlsNumber by price range, type, and location proximity. Use to power a \"similar homes\" or \"you may also like\" section on a listing detail page. Key params: mlsNumber (required), boardId, listPriceRange, radius, sortBy. NOT a general search — use Search_Listings. If results look wrong or incomplete — see send-feedback.",
      parameters: {
        type: 'object',
        properties: {
          "mlsNumber": {
            "type": "string",
            "description": "The MLS number of the listing you wish to retrieve similar listings for."
          },
          "boardId": {
            "type": "array",
            "items": {
              "type": "integer",
              "format": "int32"
            },
            "description": "Filter by boardId. This is only required if your account has access to more than one MLS. You may specify one or more board IDs to filter by, if not specified, returns all boards that that account has access to by default. <a target=\"_blank\" href=\"https://help.repliers.com/en/article/understanding-and-using-boardids-in-the-repliers-api-lfywn2/#2-using-boardids-in-api-requests\">More info</a>."
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
            "description": "If specified, will show similar listings within the specified radius (km). If not specified, defaults to showing listings in the same neighborhood."
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
