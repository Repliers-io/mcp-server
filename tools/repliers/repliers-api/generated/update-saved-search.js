// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: PATCH /searches/{searchId} (operationId: update-a-saved-search)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/searches/{searchId}';
  urlPath = urlPath.replace('{searchId}', encodeURIComponent(String(args.searchId)));
  const url = new URL(`${baseUrl}${urlPath}`);

  const body = {};
  if (args.clientId !== undefined) body.clientId = args.clientId;
  if (args.name !== undefined) body.name = args.name;
  if (args.amenities !== undefined) body.amenities = args.amenities;
  if (args.areas !== undefined) body.areas = args.areas;
  if (args.basement !== undefined) body.basement = args.basement;
  if (args.cities !== undefined) body.cities = args.cities;
  if (args.class !== undefined) body.class = args.class;
  if (args.heating !== undefined) body.heating = args.heating;
  if (args.keywords !== undefined) body.keywords = args.keywords;
  if (args.neighborhoods !== undefined) body.neighborhoods = args.neighborhoods;
  if (args.notificationFrequency !== undefined) body.notificationFrequency = args.notificationFrequency;
  if (args.map !== undefined) body.map = args.map;
  if (args.maxBaths !== undefined) body.maxBaths = args.maxBaths;
  if (args.maxBeds !== undefined) body.maxBeds = args.maxBeds;
  if (args.maxCoveredSpaces !== undefined) body.maxCoveredSpaces = args.maxCoveredSpaces;
  if (args.minParkingSpaces !== undefined) body.minParkingSpaces = args.minParkingSpaces;
  if (args.maxPrice !== undefined) body.maxPrice = args.maxPrice;
  if (args.maxSqft !== undefined) body.maxSqft = args.maxSqft;
  if (args.maxYearBuilt !== undefined) body.maxYearBuilt = args.maxYearBuilt;
  if (args.maxStories !== undefined) body.maxStories = args.maxStories;
  if (args.minBaths !== undefined) body.minBaths = args.minBaths;
  if (args.minBeds !== undefined) body.minBeds = args.minBeds;
  if (args.minCoveredSpaces !== undefined) body.minCoveredSpaces = args.minCoveredSpaces;
  if (args.minGarageSpaces !== undefined) body.minGarageSpaces = args.minGarageSpaces;
  if (args.minKitchens !== undefined) body.minKitchens = args.minKitchens;
  if (args.maxMaintenanceFee !== undefined) body.maxMaintenanceFee = args.maxMaintenanceFee;
  if (args.minPrice !== undefined) body.minPrice = args.minPrice;
  if (args.minSqft !== undefined) body.minSqft = args.minSqft;
  if (args.minYearBuilt !== undefined) body.minYearBuilt = args.minYearBuilt;
  if (args.minStories !== undefined) body.minStories = args.minStories;
  if (args.pets !== undefined) body.pets = args.pets;
  if (args.priceChangeNotifications !== undefined) body.priceChangeNotifications = args.priceChangeNotifications;
  if (args.propertyTypes !== undefined) body.propertyTypes = args.propertyTypes;
  if (args.sewer !== undefined) body.sewer = args.sewer;
  if (args.status !== undefined) body.status = args.status;
  if (args.soldNotifications !== undefined) body.soldNotifications = args.soldNotifications;
  if (args.streetNames !== undefined) body.streetNames = args.streetNames;
  if (args.streetNumbers !== undefined) body.streetNumbers = args.streetNumbers;
  if (args.styles !== undefined) body.styles = args.styles;
  if (args.swimmingPool !== undefined) body.swimmingPool = args.swimmingPool;
  if (args.type !== undefined) body.type = args.type;
  if (args.waterSource !== undefined) body.waterSource = args.waterSource;
  if (args.minLotSizeSqft !== undefined) body.minLotSizeSqft = args.minLotSizeSqft;
  if (args.maxLotSizeSqft !== undefined) body.maxLotSizeSqft = args.maxLotSizeSqft;
  if (args.minOpenHouseDate !== undefined) body.minOpenHouseDate = args.minOpenHouseDate;
  if (args.maxOpenHouseDate !== undefined) body.maxOpenHouseDate = args.maxOpenHouseDate;
  if (args.standardStatus !== undefined) body.standardStatus = args.standardStatus;

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
      'Content-Type': 'application/json',
        'REPLIERS-API-KEY': apiKey,
      },
      body: JSON.stringify(body),
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
      name: "update-saved-search",
      description: "Use this endpoint to update a saved search.\n\n<strong>Important</strong> - When a saved search is updated the filters must be specific enough so that the initial matches do not exceed 100 listings otherwise a 406 (not accepted) response will be received.",
      parameters: {
        type: 'object',
        properties: {
          "searchId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "clientId": {
            "type": "integer",
            "description": "The clientId of the client that the search is for. This client will receive notifications from the agent that's assigned to them when listings that match the saved search criteria are listed.",
            "format": "int32"
          },
          "name": {
            "type": "string",
            "description": "You can specify a name for the saved search. This is useful in cases where users have multiple saved searches, to help them distinguish between saved searches."
          },
          "amenities": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": ""
          },
          "areas": {
            "type": "array",
            "description": "An array of areas to be used as a filter for this search. Required if a value for map is not provided.",
            "items": {
              "type": "string"
            }
          },
          "basement": {
            "type": "array",
            "description": "If specified, matches only listings whose basement description match all of the supplied values. For a list of supported values, make a GET /listings?listings=false&aggregates=details.basement1,details.basement2 request.",
            "items": {
              "type": "string"
            }
          },
          "cities": {
            "type": "array",
            "description": "An array of cities to be used as a filter for this search. Required if a value for map is not provided.",
            "items": {
              "type": "string"
            }
          },
          "class": {
            "type": "array",
            "description": "Indicates what class of property to search for.<br/><br/>Allowed values:<br/><br/><code>residential</code>,<code>condo</code>,<code>commercial</code>",
            "items": {
              "type": "string"
            }
          },
          "heating": {
            "type": "array",
            "description": "An array of heating values to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "keywords": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": ""
          },
          "neighborhoods": {
            "type": "array",
            "description": "An array of neighborhoods to be used as a filter for this search. Required if a value for map is not provided.",
            "items": {
              "type": "string"
            }
          },
          "notificationFrequency": {
            "type": "string",
            "description": "Sets the frequency that clients will be notified of listings that match their search criteria.<br/><br/>Allowed values:<br/><br/><code>instant</code>, <code>daily</code>, <code>weekly</code>, <code>monthly</code>"
          },
          "map": {
            "type": "string",
            "description": "An array of polygons arrays with arrays of longitude/latitude shapes to be used as a filter for this search. If used, only listings that area geographically located within these shapes will be matched. Required if values for areas, cities and neighborhoods are not provided.",
            "format": "json"
          },
          "maxBaths": {
            "type": "integer",
            "description": "The maximum amount of bathrooms to be used as a filter for this search.",
            "format": "int32"
          },
          "maxBeds": {
            "type": "integer",
            "description": "The maximum amount of bedrooms to be used as a filter for this search.",
            "format": "int32"
          },
          "maxCoveredSpaces": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "minParkingSpaces": {
            "type": "integer",
            "description": "If specified, matches only listings whose parking space count is >= the supplied value.",
            "format": "int32"
          },
          "maxPrice": {
            "type": "integer",
            "description": "The maximum list price to be used as a filter for this search.",
            "format": "int32"
          },
          "maxSqft": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "maxYearBuilt": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "maxStories": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "minBaths": {
            "type": "integer",
            "description": "The minimum amount of bathrooms to be used as a filter for this search.",
            "format": "int32"
          },
          "minBeds": {
            "type": "integer",
            "description": "The minimum amount of bedrooms to be used as a filter for this search.",
            "format": "int32"
          },
          "minCoveredSpaces": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "minGarageSpaces": {
            "type": "integer",
            "description": "If specified, matches only listings whose garage space count is >= the supplied value.",
            "format": "int32"
          },
          "minKitchens": {
            "type": "integer",
            "description": "If specified, matches only listings whose kitchen count is >= the supplied value.",
            "format": "int32"
          },
          "maxMaintenanceFee": {
            "type": "integer",
            "description": "If supplied limits matches to listings where the maintenance fee is <= the supplied value.",
            "format": "int32"
          },
          "minPrice": {
            "type": "integer",
            "description": "The minimum list price to be used as a filter for this search.",
            "format": "int32"
          },
          "minSqft": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "minYearBuilt": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "minStories": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "pets": {
            "type": "string",
            "description": ""
          },
          "priceChangeNotifications": {
            "type": "boolean",
            "description": "If set to true, clients will receive price change notifications for listings that have been matched for them."
          },
          "propertyTypes": {
            "type": "array",
            "description": "An array of property types to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "sewer": {
            "type": "array",
            "description": "An array of sewer values to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "status": {
            "type": "boolean",
            "description": "If set to false, disables this search.",
            "default": true
          },
          "soldNotifications": {
            "type": "boolean",
            "description": "If set to true, clients will receive sold notifications for listings that have been matched for them."
          },
          "streetNames": {
            "type": "array",
            "description": "An array of street names to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "streetNumbers": {
            "type": "array",
            "description": "An array of street numbers to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "styles": {
            "type": "array",
            "description": "An array of property styles to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "swimmingPool": {
            "type": "array",
            "description": "An array of swimming pool values to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "type": {
            "type": "string",
            "description": "Indicates whether the search is for a property that's for sale or for lease.<br/></br>Allowed values:<br/><br/><code>Sale</code>,<code>Lease</code>"
          },
          "waterSource": {
            "type": "array",
            "description": "An array of water source values to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "minLotSizeSqft": {
            "type": "integer",
            "format": "int32",
            "description": "The minimum lot size in square feet to be used as a filter for this search."
          },
          "maxLotSizeSqft": {
            "type": "integer",
            "format": "int32",
            "description": "The maximum lot size in square feet to be used as a filter for this search."
          },
          "minOpenHouseDate": {
            "description": "Indicates whether the search is for properties that have an Open House on or after the supplied date. Date format: <code>YYYY-MM-DD</code>",
            "type": "string",
            "format": "date"
          },
          "maxOpenHouseDate": {
            "description": "Indicates whether the search is for properties that have an Open House on or before the supplied date. Date format: <code>YYYY-MM-DD</code>. It's not recommended to use it unless you have a very good reason to set it.",
            "type": "string",
            "format": "date"
          },
          "standardStatus": {
            "type": "array",
            "description": "Indicates what Standard Status of property to search for. <br/><br/>Allowed values:<br/><br/><code>Active</code>, <code>Active Under Contract</code>, <code>Closed</code>, <code>Expired</code>, <code>Pending</code>, <code>Canceled</code>, <code>Incomplete</code>",
            "items": {
              "type": "string"
            },
            "enum": [
              "Active",
              "Active Under Contract",
              "Closed",
              "Expired",
              "Pending",
              "Canceled",
              "Incomplete"
            ]
          }
        },
        required: ["searchId"],
      },
    },
  },
};
