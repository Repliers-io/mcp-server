// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /listings/history (operationId: lookup-address-history)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  const url = new URL(`${baseUrl}/listings/history`);

  if (args.city != null) url.searchParams.set('city', String(args.city));
  if (args.streetName != null) url.searchParams.set('streetName', String(args.streetName));
  if (args.streetNumber != null) url.searchParams.set('streetNumber', String(args.streetNumber));
  if (args.unitNumber != null) url.searchParams.set('unitNumber', String(args.unitNumber));
  if (args.streetSuffix != null) url.searchParams.set('streetSuffix', String(args.streetSuffix));
  if (args.streetDirection != null) url.searchParams.set('streetDirection', String(args.streetDirection));
  if (args.zip != null) url.searchParams.set('zip', String(args.zip));
  if (args.mlsNumber != null) url.searchParams.set('mlsNumber', String(args.mlsNumber));
  if (args.addressKey != null) url.searchParams.set('addressKey', String(args.addressKey));
  if (args.pretty != null) url.searchParams.set('pretty', String(args.pretty));

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
      name: "get-address-listing-history",
      description: "Retrieve all historical MLS listings for a specific address (sold, expired, cancelled cycles). Use to show a property's full MLS history. Key params: streetNumber, streetName, city (or mlsNumber / addressKey for a known listing). NOT for searching listings by criteria — use Search_Listings.",
      parameters: {
        type: 'object',
        properties: {
          "city": {
            "type": "string",
            "description": "The city of the property. Required when searching by `streetName`, unless a `zip` is provided."
          },
          "streetName": {
            "type": "string",
            "description": "The street name of the property. Required unless `mlsNumber` or `addressKey` is provided."
          },
          "streetNumber": {
            "type": "string",
            "description": "The street number of the property. Required when searching by `streetName`."
          },
          "unitNumber": {
            "type": "string",
            "description": ""
          },
          "streetSuffix": {
            "type": "string",
            "description": ""
          },
          "streetDirection": {
            "type": "string",
            "description": ""
          },
          "zip": {
            "type": "string",
            "minLength": 3,
            "description": "The zip code or postal code of the property. Supports partial match, for example if supplied value is \"123\" it will match \"12345\". Required when searching by `streetName`, unless a `city` is provided."
          },
          "mlsNumber": {
            "type": "string",
            "maxLength": 50,
            "description": "If specified, will return the history for the property that can be identified by the given MLS number"
          },
          "addressKey": {
            "type": "string",
            "maxLength": 100,
            "description": "The address key of the property. Please see the address object of a listing to understand how the address key is constructed"
          },
          "pretty": {
            "type": "boolean",
            "default": false,
            "description": "If true, reorders fields within each returned listing into a canonical order optimized for human readability. Does not affect which fields are returned or their values. Default is false."
          }
        },
        required: [],
      },
    },
  },
};
