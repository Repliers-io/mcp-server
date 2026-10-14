// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: PATCH /searches/{searchId} (operationId: update-a-saved-search)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/searches/{searchId}';
  urlPath = urlPath.replace('{searchId}', encodeURIComponent(String(args.searchId)));
  const url = new URL(`${baseUrl}${urlPath}`);

  const body = {};
  if (args.clientId !== undefined) body.clientId = args.clientId;
  if (args.name !== undefined) body.name = args.name;
  if (args.amenities !== undefined) body.amenities = args.amenities === null || Array.isArray(args.amenities) ? args.amenities : [args.amenities];
  if (args.areas !== undefined) body.areas = args.areas === null || Array.isArray(args.areas) ? args.areas : [args.areas];
  if (args.basement !== undefined) body.basement = args.basement === null || Array.isArray(args.basement) ? args.basement : [args.basement];
  if (args.cities !== undefined) body.cities = args.cities === null || Array.isArray(args.cities) ? args.cities : [args.cities];
  if (args.class !== undefined) body.class = args.class === null || Array.isArray(args.class) ? args.class : [args.class];
  if (args.heating !== undefined) body.heating = args.heating === null || Array.isArray(args.heating) ? args.heating : [args.heating];
  if (args.keywords !== undefined) body.keywords = args.keywords === null || Array.isArray(args.keywords) ? args.keywords : [args.keywords];
  if (args.neighborhoods !== undefined) body.neighborhoods = args.neighborhoods === null || Array.isArray(args.neighborhoods) ? args.neighborhoods : [args.neighborhoods];
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
  if (args.pets !== undefined) body.pets = args.pets === null || Array.isArray(args.pets) ? args.pets : [args.pets];
  if (args.priceChangeNotifications !== undefined) body.priceChangeNotifications = args.priceChangeNotifications;
  if (args.propertyTypes !== undefined) body.propertyTypes = args.propertyTypes === null || Array.isArray(args.propertyTypes) ? args.propertyTypes : [args.propertyTypes];
  if (args.sewer !== undefined) body.sewer = args.sewer === null || Array.isArray(args.sewer) ? args.sewer : [args.sewer];
  if (args.status !== undefined) body.status = args.status;
  if (args.soldNotifications !== undefined) body.soldNotifications = args.soldNotifications;
  if (args.streetNames !== undefined) body.streetNames = args.streetNames === null || Array.isArray(args.streetNames) ? args.streetNames : [args.streetNames];
  if (args.streetNumbers !== undefined) body.streetNumbers = args.streetNumbers === null || Array.isArray(args.streetNumbers) ? args.streetNumbers : [args.streetNumbers];
  if (args.styles !== undefined) body.styles = args.styles === null || Array.isArray(args.styles) ? args.styles : [args.styles];
  if (args.swimmingPool !== undefined) body.swimmingPool = args.swimmingPool === null || Array.isArray(args.swimmingPool) ? args.swimmingPool : [args.swimmingPool];
  if (args.type !== undefined) body.type = args.type;
  if (args.waterSource !== undefined) body.waterSource = args.waterSource === null || Array.isArray(args.waterSource) ? args.waterSource : [args.waterSource];
  if (args.minLotSizeSqft !== undefined) body.minLotSizeSqft = args.minLotSizeSqft;
  if (args.maxLotSizeSqft !== undefined) body.maxLotSizeSqft = args.maxLotSizeSqft;
  if (args.minLotWidth !== undefined) body.minLotWidth = args.minLotWidth;
  if (args.maxLotWidth !== undefined) body.maxLotWidth = args.maxLotWidth;
  if (args.minOpenHouseDate !== undefined) body.minOpenHouseDate = args.minOpenHouseDate;
  if (args.maxOpenHouseDate !== undefined) body.maxOpenHouseDate = args.maxOpenHouseDate;
  if (args.standardStatus !== undefined) body.standardStatus = args.standardStatus === null || Array.isArray(args.standardStatus) ? args.standardStatus : [args.standardStatus];
  if (args.fields !== undefined) body.fields = args.fields;
  if (args.locationIds !== undefined) body.locationIds = args.locationIds === null || Array.isArray(args.locationIds) ? args.locationIds : [args.locationIds];
  if (args.agentId !== undefined) body.agentId = args.agentId;

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
      description: "Update a saved search's criteria or notification settings. All filter fields are replaced on update — include the complete desired criteria, not just changed fields. Key params: searchId (required), clientId, and any filter criteria to apply. Operates on the connected account's CRM data.",
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
            "maxLength": 50,
            "description": "You can specify a name for the saved search. This is useful in cases where users have multiple saved searches, to help them distinguish between saved searches. Maximum 50 characters."
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
            "description": "An array of areas to be used as a filter for this search. Required, together with cities, if neither map nor locationIds is provided.",
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
            "description": "An array of cities to be used as a filter for this search. Required, together with areas, if neither map nor locationIds is provided.",
            "items": {
              "type": "string"
            }
          },
          "class": {
            "type": "array",
            "description": "Indicates what class of property to search for.<br/><br/>Allowed values:<br/><br/><code>residential</code>,<code>condo</code>,<code>commercial</code>",
            "items": {
              "type": "string",
              "enum": [
                "residential",
                "condo",
                "commercial"
              ]
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
            "description": "An array of neighborhoods to be used as a filter for this search. Optional. Does not replace the areas and cities requirement when map is not provided.",
            "items": {
              "type": "string"
            }
          },
          "notificationFrequency": {
            "type": "string",
            "description": "Sets the frequency that clients will be notified of listings that match their search criteria.<br/><br/>Allowed values:<br/><br/><code>instant</code>, <code>daily</code>, <code>weekly</code>, <code>monthly</code>",
            "enum": [
              "instant",
              "daily",
              "weekly",
              "monthly"
            ]
          },
          "map": {
            "type": "string",
            "description": "An array of polygons arrays with arrays of longitude/latitude shapes to be used as a filter for this search. If used, only listings that area geographically located within these shapes will be matched. Required if neither locationIds nor both areas and cities are provided.",
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
            "format": "int32",
            "minimum": 1,
            "maximum": 32767
          },
          "maxCoveredSpaces": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "minParkingSpaces": {
            "type": "integer",
            "description": "If specified, matches only listings whose parking space count is >= the supplied value.",
            "format": "int32",
            "minimum": 1,
            "maximum": 32767
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
            "minimum": 1,
            "maximum": 32767,
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
            "format": "int32",
            "minimum": 1,
            "maximum": 32767
          },
          "minCoveredSpaces": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "minGarageSpaces": {
            "type": "integer",
            "description": "If specified, matches only listings whose garage space count is >= the supplied value.",
            "format": "int32",
            "minimum": 1,
            "maximum": 32767
          },
          "minKitchens": {
            "type": "integer",
            "description": "If specified, matches only listings whose kitchen count is >= the supplied value.",
            "format": "int32",
            "minimum": 1,
            "maximum": 32767
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
            "minimum": 1,
            "maximum": 32767,
            "description": ""
          },
          "minStories": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "pets": {
            "type": "array",
            "description": "An array of pet policy values to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
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
            "description": "Indicates whether the search is for a property that's for sale or for lease.<br/></br>Allowed values:<br/><br/><code>sale</code>,<code>lease</code>",
            "enum": [
              "sale",
              "lease"
            ]
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
          "minLotWidth": {
            "type": "number",
            "format": "float",
            "description": "The minimum lot width to be used as a filter for this search. If specified, matches only listings whose lot width is >= the supplied value. Must be greater than 0 and cannot be greater than maxLotWidth. The unit of measurement is the same as the one the MLS board provides in its data."
          },
          "maxLotWidth": {
            "type": "number",
            "format": "float",
            "description": "The maximum lot width to be used as a filter for this search. If specified, matches only listings whose lot width is <= the supplied value. Must be greater than 0 and cannot be less than minLotWidth. The unit of measurement is the same as the one the MLS board provides in its data."
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
              "type": "string",
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
          "fields": {
            "type": "object",
            "description": "An object of raw MLS field filters to be used for this search. Each key is a raw field name and each value is an array of possible values for that field. Raw field names must be prefixed with <code>raw.</code>, for example <code>raw.Room13level</code> or <code>raw.PropertyUse</code>. Supports up to 50 fields and up to 50 values per field.<br/><br/>Only the fields supplied are updated. The values supplied for a field replace its existing values, and fields that are not supplied are left unchanged. Set a field to <code>null</code> to remove it, or set <code>fields</code> to <code>null</code> to remove all raw field filters.<br/><br/>Example: <code>{\"raw.Room13level\": [\"Main\"]}</code>",
            "additionalProperties": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "example": {
              "raw.Room13level": [
                "Main"
              ]
            }
          },
          "locationIds": {
            "type": "array",
            "description": "An array of locationIds (see GET /locations) to be used as a filter for this search. If provided, map, areas and cities are not required. Values must be alphanumeric. Duplicates are removed.",
            "items": {
              "type": "string",
              "maxLength": 100,
              "pattern": "^[A-Za-z0-9]+$"
            }
          },
          "agentId": {
            "type": "integer",
            "description": "The agentId of the agent that the search is assigned to. Must be an agent in your account. When changing the agent, the search's client must be assigned to the new agent, otherwise a 400 error is returned.",
            "format": "int32"
          }
        },
        required: ["searchId"],
      },
    },
  },
};
