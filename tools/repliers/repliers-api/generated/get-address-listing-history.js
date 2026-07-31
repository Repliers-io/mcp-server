// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /listings/history (operationId: lookup-address-history)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/listings/history`);

  if (args.city !== undefined) url.searchParams.set('city', String(args.city));
  if (args.streetName !== undefined) url.searchParams.set('streetName', String(args.streetName));
  if (args.streetNumber !== undefined) url.searchParams.set('streetNumber', String(args.streetNumber));
  if (args.unitNumber !== undefined) url.searchParams.set('unitNumber', String(args.unitNumber));
  if (args.streetSuffix !== undefined) url.searchParams.set('streetSuffix', String(args.streetSuffix));
  if (args.streetDirection !== undefined) url.searchParams.set('streetDirection', String(args.streetDirection));
  if (args.zip !== undefined) url.searchParams.set('zip', String(args.zip));
  if (args.mlsNumber !== undefined) url.searchParams.set('mlsNumber', String(args.mlsNumber));
  if (args.addressKey !== undefined) url.searchParams.set('addressKey', String(args.addressKey));

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
      name: "get-address-listing-history",
      description: "Retrieve all historical MLS listings for a specific address (sold, expired, cancelled cycles). Use to show a property's full MLS history. Key params: streetNumber, streetName, city (or mlsNumber / addressKey for a known listing). NOT for searching listings by criteria — use Search_Listings. If results look wrong or incomplete — see send-feedback.",
      parameters: {
        type: 'object',
        properties: {
          "city": {
            "type": "string",
            "description": "The city of the property. Note - a city is not required if a zip is provided."
          },
          "streetName": {
            "type": "string",
            "description": ""
          },
          "streetNumber": {
            "type": "string",
            "description": ""
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
            "description": "The zip code or postal code of the property. Supports partial match, for example if supplied value is \"123\" it will match \"12345\".  Note - a zip is not required if a city is provided."
          },
          "mlsNumber": {
            "type": "string",
            "description": "If specified, will return the history for the property that can be identified by the given MLS number"
          },
          "addressKey": {
            "type": "string",
            "description": "The address key of the property. Please see the address object of a listing to understand how the address key is constructed"
          }
        },
        required: ["city","streetName","streetNumber","zip"],
      },
    },
  },
};
