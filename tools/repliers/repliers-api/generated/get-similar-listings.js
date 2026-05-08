// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /listings/{mlsNumber}/similar (operationId: find-similar-listings)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
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
      description: "Provide this endpoint with an mls number and it'll retrieve similar properties that are also for sale.\n\nThis is really useful if you'd like to show your users other properties they may be interested in.\n\nBy default this endpoint will retrieve similar properties in the same neighborhood, however you can override this by using a radius parameter.\n\n---\nSimilar Active Listings\nArticles on: Property Search & Filtering\n\nSold Comparables & Similar (Active) Listings Selection Logic\n\nRepliers makes it easy to get Sold Comparables and Similar (Active) Listings for any given property. This is particularly useful for creating a detailed property page, helping your users make more informed decisions with enriched information.\n\nSold Comparables\n\nWhen a new listing hits the market, we check the MLS® history for similar listings. Here's what we consider when identifying comparables:\n\nStatus (sold, leased, or off-market)\nProximity to the new listing\nSame number of bedrooms\nSame transaction type (sale or lease)\nSold/leased within the past three months\nYear built within +/- 10 years of the new listing\nSquare footage within +/- 200 sq. ft. of the new listing\nSame property type or style\nSold/leased price within +/- 10% of the new listing's list price\n\nListings that match these criteria are included in the \"comparables\" section for the new listing. Here is an example of the comparables object:\n\n{\n\"comparables\": [\n{\n\"mlsNumber\": \"E11923411\",\n\"type\": \"Sale\",\n\"listPrice\": 1159000,\n\"soldPrice\": 1450120,\n\"soldDate\": \"2025-01-22T00:00:00.000-00:00\",\n\"address\": {\n\"streetNumber\": \"135\",\n\"streetName\": \"Woodycrest\",\n\"streetSuffix\": \"Avenue\",\n\"city\": \"Toronto\",\n\"neighborhood\": \"Danforth Village-East York\",\n\"zip\": \"M4J 3B7\"\n},\n\"distance\": 0.4\n}\n]\n}\n\nWorking with Distance Data\n\nEach comparable includes a distance field that shows how far the property is from the subject listing in kilometers. We return up to 20 comparables, prioritized by proximity among properties that meet all other criteria.\n\nIn some cases, comparables may be located further away than desired for your application. You can use the distance value to filter results based on your specific requirements—for example, only displaying comparables within a 5km radius.\n\nSimilar (Active) Listings\n\nOur Get Similar Listings Endpoint finds active listings that are similar to a given property. Here's what we consider for these listings:\n\nStatus (active, on-market)\nSame transaction type (sale or lease)\nSame property type\nSame number of bedrooms\nSame neighborhood\n\nYou can also use optional parameters to refine your search:\n\nradius: If specified, the search focuses on similar properties within this radius (in kilometers), ignoring the neighborhood criterion.\nlistPriceRange: If specified, the search includes properties with a list price within the given range.\nFor more details on optional parameters, please refer to our API Reference for Similar Listings.\n\nWhy Are Sold Comparables or Similar Listings Not Found?\n\nIf zero listings meet our selection criteria for Sold Comparables or Similar Listings, it's usually because the property in question is unique or located in a remote area. For instance, while it's common to find many Sold Comparables and Similar Listings for a downtown apartment, it may be challenging to find any for a luxury mansion in the countryside.\n\nWhat questions does this article answer?\n\nHow does Repliers automatically select sold comparables for a listing? \nWhat criteria are used for sold comparables (beds, year built, sqft, price range, timeframe, distance, property type)? \nHow should I interpret the comparables object and its distance field? \nHow are “Similar (Active) Listings” selected and what filters do they use? \nHow many comparables can I expect to receive and how are they ordered?\nUpdated on: 05/12/2025\n---",
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
