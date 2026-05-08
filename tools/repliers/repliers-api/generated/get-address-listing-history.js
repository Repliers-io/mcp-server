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
      description: "Use this endpoint to retrieve the MLS history of a specific address.\n\nIn addition to displaying the history you could also use the information in the response to create a graph that illustrates the change in value over time.\n\n---\nHistory for a Specific Address\nArticles on: Property History\n\nAccessing Historical Listings for an Address\n\nWhen working with real estate listings, understanding the historical context of a property can be crucial. At Repliers, our API provides comprehensive access to both current and historical listing data. Here’s how you can access this information through our API.\n\nHistory For A Specific Listing or MLS® Number\n\nWhen you make a request for a specific listing or MLS®number, for example https://api.repliers.io/listings/123456789, the listing response includes a \"history\" object within the listing data itself. This object contains an array of historical transactions for the address. Here's an example of what the history object might look like for a listing:\n\n{\n\"history\": [\n{\n\"mlsNumber\": \"123455677XX\",\n\"type\": \"Sale\",\n\"listPrice\": \"499900.00\",\n\"listDate\": \"2024-05-11T00:00:00.000Z\",\n\"lastStatus\": \"Terminated\",\n\"office\": {\n\"brokerageName\": \"RE/MAX REALTY PEOPLE INC.\"\n},\n\"timestamps\": {\n\"idxUpdated\": \"2024-06-09T16:57:49.000Z\",\n\"listingUpdated\": \"2024-06-09T16:57:49.000Z\",\n\"photosUpdated\": \"2024-05-11T18:02:32.000Z\",\n\"listingEntryDate\": \"2024-05-11T00:00:00.000Z\",\n\"expiryDate\": \"2024-12-31T00:00:00.000Z\"\n}\n}\n]\n}\n\nThis object is built dynamically when the listing is requested, so it will always contain all of the MLS® history for the listing's address.\n\nHistory For A Specific Address \n\nYou can also lookup the history of an address. Depending on your workflow, this may be more efficient than looking up history for a specific listing or MLS® number.\n\nExample Request\n\nHere is an example of how you can make a request using the address history endpoint:\n\nhttps://api.repliers.io/listings/history?streetNumber=101&streetName=Dalmations&streetSuffix=Cres&city=New York&zip=90000\n\nThe response is built dynamically when the address is queried, so it will always contain all of the address history for the provided address.\n\nHistory When Searching For Listings\n\nWhen you search for listings, you can choose to include historical data for all properties in your search results simultaneously. However, there's an important limitation to be aware of:\n\nHistory Completeness for Off-Market Listings\n\nFor older listings that are no longer active on the market, the historical data may be incomplete. Here's why:\n\nActive listings: History gets updated regularly while the property remains on the market\nOff-market listings: Once a listing goes off-market, its history stops being updated in the system\nImpact: Older, off-market properties may show gaps in their historical data or appear to have less comprehensive records\n\nWhat This Means for You\n\nWhen reviewing historical data in your search results, keep in mind that:\n\nRecent and active listings will have the most complete history\nOlder, sold, or expired listings may have incomplete historical records\nThe missing history doesn't mean the data never existed—it simply wasn't captured after the listing went off-market\n\nFor more information on the address history lookup endpoint please refer to our API documentation.\n\nWhat questions does this article answer?\n\nHow do I retrieve historical listing data for a specific MLS® number? \nWhat does the history object in a listing response contain? \nHow can I request history for a specific address instead of a specific listing? \nHow do I use the listings history endpoint for an address? \nHow can I include historical data in bulk when searching for listings? \nWhy might history be incomplete for older or off-market listings? \nHow should I interpret incomplete historic data in my application? \n\nUpdated on: 05/12/2025\n---",
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
